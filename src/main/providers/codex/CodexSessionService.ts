/**
 * CodexSessionService - Entry point for Codex session data.
 *
 * Responsibilities:
 * - List rollouts (via CodexScanner) with a short-lived cache
 * - Build session details (records → normalized timeline) with fingerprint
 *   short-circuiting, mirroring the Claude `getSessionDetail` contract
 * - Parse live rollouts incrementally: rollouts are append-only, so only the
 *   bytes written since the previous request are read
 * - Relate a rollout to the subagent rollouts it spawned and to the rollout
 *   that spawned it (`CodexSessionRelations`)
 * - Forward watcher events as `session-change` events
 */

import { createLogger } from '@shared/utils/logger';
import { EventEmitter } from 'events';
import * as fs from 'fs';

import { normalizeCodexRollout } from './CodexExecutionNormalizer';
import { getCodexSessionsPath } from './codexPaths';
import { readRolloutRecords } from './CodexRolloutParser';
import { buildSessionSummary, CodexScanner, type RolloutFile } from './CodexScanner';
import { type CachedRolloutRecords, CodexSessionRelations } from './CodexSessionRelations';
import { CodexSessionWatcher, type CodexWatchEvent } from './CodexSessionWatcher';

import type { CodexRolloutRecord } from './types';
import type {
  AgentSessionChangeEvent,
  AgentSessionDetail,
  AgentSessionDetailResponse,
  AgentSessionList,
  AgentSessionRelations,
} from '@main/domain';

const logger = createLogger('Codex:SessionService');

/** How long a session listing is reused when nothing changed. */
const LIST_CACHE_TTL_MS = 2000;
/** Parsed rollouts kept in memory for incremental re-parsing. */
const MAX_CACHED_SESSIONS = 4;

interface ParsedRolloutCache {
  /** File identity, to detect replacement */
  ino: number;
  records: CodexRolloutRecord[];
  /** Byte offset after the last complete line */
  offset: number;
  nextLineNumber: number;
  malformedLines: number;
  fingerprint: string;
  detail: AgentSessionDetail | null;
}

export interface CodexSessionServiceOptions {
  sessionsDir?: string;
  scanner?: CodexScanner;
  /** Disable file watching (tests) */
  watch?: boolean;
}

export class CodexSessionService extends EventEmitter {
  private readonly sessionsDir: string;
  private readonly scanner: CodexScanner;
  private readonly watcher: CodexSessionWatcher | null;
  private readonly parsed = new Map<string, ParsedRolloutCache>();
  private readonly relations: CodexSessionRelations;
  private listCache: { result: AgentSessionList; expiresAt: number } | null = null;
  private listInFlight: Promise<AgentSessionList> | null = null;

  constructor(options: CodexSessionServiceOptions = {}) {
    super();
    this.sessionsDir = options.sessionsDir ?? getCodexSessionsPath();
    this.scanner = options.scanner ?? new CodexScanner(this.sessionsDir);
    this.watcher = options.watch === false ? null : new CodexSessionWatcher(this.sessionsDir);
    this.relations = new CodexSessionRelations(this.scanner, (sessionId) =>
      this.cachedRecords(sessionId)
    );
    this.watcher?.on('change', (event: CodexWatchEvent) => this.onWatchEvent(event));
  }

  getSessionsDir(): string {
    return this.sessionsDir;
  }

  start(): void {
    logger.info(`Watching Codex sessions: ${this.sessionsDir}`);
    this.watcher?.start();
  }

  dispose(): void {
    this.watcher?.stop();
    this.removeAllListeners();
    this.parsed.clear();
    this.relations.clear();
    this.listCache = null;
  }

  /**
   * List Codex sessions, most recently written first.
   */
  async listSessions(): Promise<AgentSessionList> {
    const now = Date.now();
    if (this.listCache && this.listCache.expiresAt > now) {
      return this.listCache.result;
    }
    if (this.listInFlight) {
      return this.listInFlight;
    }
    this.listInFlight = this.scanner
      .scan()
      .then((result) => {
        this.listCache = { result, expiresAt: Date.now() + LIST_CACHE_TTL_MS };
        return result;
      })
      .finally(() => {
        this.listInFlight = null;
      });
    return this.listInFlight;
  }

  /**
   * Build the normalized detail for a session.
   * Returns `{ unchanged }` when `knownFingerprint` is current, or null when the
   * session id is invalid or the file is gone.
   */
  async getSessionDetail(
    sessionId: string,
    knownFingerprint?: string
  ): Promise<AgentSessionDetailResponse | null> {
    const file = await this.scanner.getFile(sessionId);
    if (!file) {
      return null;
    }
    const isLive = this.scanner.isLive(file.mtimeMs);
    const fingerprint = `${file.mtimeMs}-${file.size}-${isLive ? 'live' : 'idle'}`;
    if (knownFingerprint !== undefined && knownFingerprint === fingerprint) {
      return { unchanged: true, fingerprint };
    }

    const cached = this.parsed.get(sessionId);
    if (cached?.fingerprint === fingerprint && cached.detail) {
      return cached.detail;
    }

    const { entry, records } = await this.readRecords(file, cached);
    const normalized = normalizeCodexRollout(records, { active: isLive });
    const summary = buildSessionSummary(
      file,
      {
        metadata: normalized.metadata,
        model: normalized.model,
        title: normalized.title,
        titleSource: normalized.titleSource,
        inheritedRecordCount: normalized.inheritedRecordCount,
      },
      isLive
    );
    summary.turnInProgress = normalized.turnInProgress;

    const warnings: string[] = [];
    if (entry.malformedLines > 0) {
      warnings.push(`${entry.malformedLines} malformed line(s) were skipped`);
    }
    warnings.push(...normalized.warnings);

    const detail: AgentSessionDetail = {
      session: summary,
      timeline: normalized.timeline,
      stats: normalized.stats,
      tokenUsage: normalized.tokenUsage,
      runtime: normalized.runtime,
      warnings,
      fingerprint,
    };
    entry.fingerprint = fingerprint;
    entry.detail = detail;
    this.remember(sessionId, entry);
    return detail;
  }

  /**
   * Relations of a session to the subagent sessions it spawned and to the
   * session that spawned it. Returns null when the session id is invalid, the
   * file is gone or it cannot be read.
   */
  async getSessionRelations(sessionId: string): Promise<AgentSessionRelations | null> {
    return this.relations.getRelations(sessionId);
  }

  /**
   * Read a rollout's records, incrementally when the cached prefix is still valid.
   * Returns the cacheable entry (complete lines only) and the records to
   * normalize, which additionally include an unterminated tail line (a write in
   * progress) that must be re-read next time.
   */
  private async readRecords(
    file: RolloutFile,
    cached: ParsedRolloutCache | undefined
  ): Promise<{ entry: ParsedRolloutCache; records: CodexRolloutRecord[] }> {
    const stats = await fs.promises.stat(file.filePath);
    const canAppend =
      cached !== undefined &&
      !file.compressed &&
      cached.ino === stats.ino &&
      stats.size >= cached.offset;

    const result = await readRolloutRecords(file.filePath, {
      fromOffset: canAppend ? cached.offset : 0,
      startLineNumber: canAppend ? cached.nextLineNumber : 1,
    });

    const complete = canAppend ? [...cached.records, ...result.records] : result.records;
    const entry: ParsedRolloutCache = {
      ino: stats.ino,
      records: complete,
      offset: result.nextOffset,
      nextLineNumber: result.nextLineNumber,
      malformedLines: (canAppend ? cached.malformedLines : 0) + result.malformedLines,
      fingerprint: '',
      detail: null,
    };
    return { entry, records: result.tail ? [...complete, result.tail] : complete };
  }

  private remember(sessionId: string, entry: ParsedRolloutCache): void {
    // Re-insert to mark as most recently used.
    this.parsed.delete(sessionId);
    this.parsed.set(sessionId, entry);
    while (this.parsed.size > MAX_CACHED_SESSIONS) {
      const oldest = this.parsed.keys().next().value;
      if (oldest === undefined) break;
      this.parsed.delete(oldest);
    }
  }

  /** Complete records already parsed for a session's detail. */
  private cachedRecords(sessionId: string): CachedRolloutRecords | undefined {
    const entry = this.parsed.get(sessionId);
    return entry
      ? {
          ino: entry.ino,
          records: entry.records,
          offset: entry.offset,
          nextLineNumber: entry.nextLineNumber,
        }
      : undefined;
  }

  private onWatchEvent(event: CodexWatchEvent): void {
    this.listCache = null;
    if (event.type === 'unlink' && event.sessionId) {
      this.parsed.delete(event.sessionId);
    }
    this.relations.onWatchEvent(event);
    const change: AgentSessionChangeEvent = {
      provider: 'codex',
      type: event.type,
      sessionId: event.sessionId,
    };
    this.emit('session-change', change);
  }
}
