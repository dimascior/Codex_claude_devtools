/**
 * CodexScanner - Discovers Codex rollouts and summarizes them.
 *
 * Codex partitions rollouts by date (`sessions/YYYY/MM/DD`), which says
 * nothing about which project a session belongs to. Sessions are therefore
 * grouped by the working directory recorded in each rollout's `session_meta`.
 *
 * Only the head of each rollout is read for listing (metadata, model, first
 * user request); results are cached per file.
 */

import * as fs from 'fs';
import * as path from 'path';

import { parseCodexEvent } from './CodexEventParser';
import {
  type CodexSessionMetadata,
  isInheritedRecord,
  isInjectedContext,
  parseSessionMeta,
  projectKeyForCwd,
  projectNameForCwd,
  toPreview,
} from './CodexMetadataParser';
import {
  isCompressedRollout,
  isRolloutFileName,
  parseRolloutFileName,
  resolveSessionFilePath,
  toSessionId,
} from './codexPaths';
import { isZstdSupported, readRolloutRecords, readRolloutTail } from './CodexRolloutParser';

import type { CodexRolloutRecord } from './types';
import type { AgentProjectGroup, AgentSessionList, AgentSessionSummary } from '@main/domain';

/** Rollouts written within this window count as live. */
const CODEX_LIVE_WINDOW_MS = 10 * 60 * 1000;
/** Default cap on listed sessions (most recent first). */
const DEFAULT_MAX_LISTED = 500;
/** Head reads stop after this many lines. */
const HEAD_MAX_LINES = 400;
/** Bytes read from the end of live rollouts to detect an in-progress turn. */
const TAIL_BYTES = 256 * 1024;
/** Maximum directory depth below the sessions directory. */
const MAX_DEPTH = 4;
/** Parallel file reads while summarizing. */
const READ_CONCURRENCY = 16;

export interface RolloutFile {
  sessionId: string;
  filePath: string;
  fileName: string;
  mtimeMs: number;
  size: number;
  compressed: boolean;
}

/** What the head of a rollout tells us. */
export interface RolloutHead {
  metadata: CodexSessionMetadata;
  model?: string;
  title?: string;
  error?: string;
}

interface HeadCacheEntry {
  mtimeMs: number;
  size: number;
  head: RolloutHead;
  /** Head fields can no longer change (title found or whole file read) */
  final: boolean;
}

export interface CodexScannerOptions {
  maxListed?: number;
  liveWindowMs?: number;
  /** Clock override for tests */
  now?: () => number;
}

export class CodexScanner {
  private readonly headCache = new Map<string, HeadCacheEntry>();
  private readonly maxListed: number;
  private readonly liveWindowMs: number;
  private readonly now: () => number;

  constructor(
    private readonly sessionsDir: string,
    options: CodexScannerOptions = {}
  ) {
    this.maxListed = options.maxListed ?? DEFAULT_MAX_LISTED;
    this.liveWindowMs = options.liveWindowMs ?? CODEX_LIVE_WINDOW_MS;
    this.now = options.now ?? Date.now;
  }

  getSessionsDir(): string {
    return this.sessionsDir;
  }

  /**
   * Whether a file modified at `mtimeMs` counts as live.
   */
  isLive(mtimeMs: number): boolean {
    return this.now() - mtimeMs <= this.liveWindowMs;
  }

  /**
   * List and summarize rollouts, most recently written first.
   */
  async scan(): Promise<AgentSessionList> {
    const rootExists = await directoryExists(this.sessionsDir);
    const base: AgentSessionList = {
      provider: 'codex',
      rootDir: this.sessionsDir,
      rootExists,
      sessions: [],
      projects: [],
      totalFiles: 0,
      liveSessionId: null,
      latestSessionId: null,
      compressedSupported: isZstdSupported(),
      scannedAt: this.now(),
    };
    if (!rootExists) {
      return base;
    }

    const files = await this.listFiles();
    files.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const listed = files.slice(0, this.maxListed);

    const sessions = await mapWithConcurrency(listed, READ_CONCURRENCY, async (file) => {
      const head = await this.readHead(file);
      const summary = buildSessionSummary(file, head, this.isLive(file.mtimeMs));
      if (summary.isLive && !file.compressed) {
        summary.turnInProgress = await detectTurnInProgress(file.filePath);
      }
      return summary;
    });

    this.pruneHeadCache(new Set(files.map((file) => file.filePath)));

    return {
      ...base,
      sessions,
      projects: groupByProject(sessions),
      totalFiles: files.length,
      liveSessionId: pickLiveSession(sessions),
      latestSessionId: sessions[0]?.id ?? null,
    };
  }

  /**
   * Stat a single rollout by session id.
   */
  async getFile(sessionId: string): Promise<RolloutFile | null> {
    const filePath = resolveSessionFilePath(this.sessionsDir, sessionId);
    if (!filePath) {
      return null;
    }
    try {
      const stats = await fs.promises.stat(filePath);
      if (!stats.isFile()) {
        return null;
      }
      return {
        sessionId,
        filePath,
        fileName: path.basename(filePath),
        mtimeMs: stats.mtimeMs,
        size: stats.size,
        compressed: isCompressedRollout(filePath),
      };
    } catch {
      return null;
    }
  }

  /**
   * Find all rollout files below the sessions directory.
   */
  async listFiles(): Promise<RolloutFile[]> {
    const files: RolloutFile[] = [];
    const walk = async (dir: string, depth: number): Promise<void> => {
      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (depth < MAX_DEPTH) {
              await walk(fullPath, depth + 1);
            }
            return;
          }
          if (!entry.isFile() || !isRolloutFileName(entry.name)) {
            return;
          }
          try {
            const stats = await fs.promises.stat(fullPath);
            files.push({
              sessionId: toSessionId(this.sessionsDir, fullPath),
              filePath: fullPath,
              fileName: entry.name,
              mtimeMs: stats.mtimeMs,
              size: stats.size,
              compressed: isCompressedRollout(entry.name),
            });
          } catch {
            // File vanished between readdir and stat.
          }
        })
      );
    };
    await walk(this.sessionsDir, 1);
    return files;
  }

  /**
   * Read (or reuse) the head of a rollout.
   */
  async readHead(file: RolloutFile): Promise<RolloutHead> {
    const cached = this.headCache.get(file.filePath);
    if (
      cached &&
      (cached.final || (cached.mtimeMs === file.mtimeMs && cached.size === file.size))
    ) {
      return cached.head;
    }

    let head: RolloutHead;
    let final = false;
    try {
      const extractor = new HeadExtractor();
      const result = await readRolloutRecords(file.filePath, {
        maxLines: HEAD_MAX_LINES,
        stopWhen: (record) => extractor.accept(record),
      });
      head = extractor.head();
      final = extractor.done() || (!result.stoppedEarly && !this.isLive(file.mtimeMs));
    } catch (error) {
      head = { metadata: {}, error: error instanceof Error ? error.message : String(error) };
      final = file.compressed && !isZstdSupported();
    }

    this.headCache.set(file.filePath, { mtimeMs: file.mtimeMs, size: file.size, head, final });
    return head;
  }

  private pruneHeadCache(existing: Set<string>): void {
    for (const filePath of this.headCache.keys()) {
      if (!existing.has(filePath)) {
        this.headCache.delete(filePath);
      }
    }
  }
}

/**
 * Collects metadata, model and the first user request from leading records.
 */
class HeadExtractor {
  private metadata: CodexSessionMetadata = {};
  private haveMetadata = false;
  private model: string | undefined;
  private eventTitle: string | undefined;
  private itemTitle: string | undefined;

  /** Returns true once nothing more is needed. */
  accept(record: CodexRolloutRecord): boolean {
    const { payload } = record;
    // A subagent's title and model come from its own history, not the copy
    // of its parent's history that precedes it.
    if (isInheritedRecord(record.ordinal, this.metadata)) {
      return false;
    }
    if (record.type === 'session_meta' && !this.haveMetadata) {
      this.metadata = parseSessionMeta(payload);
      this.haveMetadata = true;
    } else if (record.type === 'turn_context' && !this.model && typeof payload.model === 'string') {
      this.model = payload.model;
    } else if (record.type === 'event_msg' && !this.eventTitle) {
      const event = parseCodexEvent(payload);
      if (event.kind === 'user_message' && event.text.trim()) {
        this.eventTitle = toPreview(event.text);
      }
    } else if (
      record.type === 'response_item' &&
      !this.itemTitle &&
      payload.type === 'message' &&
      payload.role === 'user'
    ) {
      const text = firstUserText(payload.content);
      if (text) {
        this.itemTitle = toPreview(text);
      }
    }
    return this.done();
  }

  done(): boolean {
    return this.haveMetadata && this.model !== undefined && this.eventTitle !== undefined;
  }

  head(): RolloutHead {
    return {
      metadata: this.metadata,
      model: this.model,
      title: this.eventTitle ?? this.itemTitle,
    };
  }
}

function firstUserText(content: unknown): string | undefined {
  if (!Array.isArray(content)) {
    return undefined;
  }
  for (const part of content) {
    if (!part || typeof part !== 'object') continue;
    const text = (part as { text?: unknown }).text;
    if (typeof text === 'string' && text.trim() && !isInjectedContext(text)) {
      return text;
    }
  }
  return undefined;
}

/**
 * Build a summary from a file's stat data and head.
 */
export function buildSessionSummary(
  file: RolloutFile,
  head: RolloutHead,
  isLive: boolean
): AgentSessionSummary {
  const fromName = parseRolloutFileName(file.fileName);
  const { metadata } = head;
  return {
    id: file.sessionId,
    provider: 'codex',
    threadId: metadata.threadId ?? fromName?.threadId,
    filePath: file.filePath,
    cwd: metadata.cwd,
    projectKey: projectKeyForCwd(metadata.cwd),
    projectName: projectNameForCwd(metadata.cwd),
    title: head.title,
    startedAt: metadata.startedAt ?? fromName?.startedAt,
    updatedAt: file.mtimeMs,
    sizeBytes: file.size,
    compressed: file.compressed,
    isLive,
    originator: metadata.originator,
    cliVersion: metadata.cliVersion,
    source: metadata.source,
    model: head.model,
    modelProvider: metadata.modelProvider,
    gitBranch: metadata.gitBranch,
    gitCommit: metadata.gitCommit,
    repositoryUrl: metadata.repositoryUrl,
    parentThreadId: metadata.parentThreadId,
    agentNickname: metadata.agentNickname,
    agentRole: metadata.agentRole,
    inheritedRecordCount:
      metadata.historyStartOrdinal !== undefined ? metadata.historyStartOrdinal - 1 : undefined,
    error: head.error,
  };
}

/**
 * Whether the last turn event in a rollout's tail is a turn start.
 */
async function detectTurnInProgress(filePath: string): Promise<boolean | undefined> {
  try {
    const records = await readRolloutTail(filePath, TAIL_BYTES);
    for (let i = records.length - 1; i >= 0; i--) {
      const { type, payload } = records[i];
      if (type !== 'event_msg') continue;
      const eventType = payload.type;
      if (eventType === 'task_started' || eventType === 'turn_started') {
        return true;
      }
      if (
        eventType === 'task_complete' ||
        eventType === 'turn_complete' ||
        eventType === 'turn_aborted'
      ) {
        return false;
      }
    }
  } catch {
    // Unreadable tail: unknown.
  }
  return undefined;
}

/**
 * The session to follow: the most recently written live session, preferring
 * one with a turn in progress.
 */
function pickLiveSession(sessions: readonly AgentSessionSummary[]): string | null {
  const live = sessions.filter((session) => session.isLive);
  const running = live.filter((session) => session.turnInProgress === true);
  const pool = running.length > 0 ? running : live;
  let best: AgentSessionSummary | null = null;
  for (const session of pool) {
    if (!best || session.updatedAt > best.updatedAt) {
      best = session;
    }
  }
  return best?.id ?? null;
}

/**
 * Group sessions by working directory, most recently active group first.
 */
function groupByProject(sessions: readonly AgentSessionSummary[]): AgentProjectGroup[] {
  const groups = new Map<string, AgentProjectGroup>();
  for (const session of sessions) {
    let group = groups.get(session.projectKey);
    if (!group) {
      group = {
        key: session.projectKey,
        name: session.projectName,
        cwd: session.cwd,
        sessionIds: [],
        lastActivity: 0,
      };
      groups.set(session.projectKey, group);
    }
    group.sessionIds.push(session.id);
    group.lastActivity = Math.max(group.lastActivity, session.updatedAt);
  }

  // Different directories with the same last segment get their parent prepended.
  const nameCounts = new Map<string, number>();
  for (const group of groups.values()) {
    nameCounts.set(group.name, (nameCounts.get(group.name) ?? 0) + 1);
  }
  for (const group of groups.values()) {
    if ((nameCounts.get(group.name) ?? 0) > 1 && group.cwd) {
      const segments = group.cwd.split(/[\\/]+/).filter(Boolean);
      if (segments.length >= 2) {
        const separator = group.cwd.includes('\\') && !group.cwd.includes('/') ? '\\' : '/';
        group.name = segments.slice(-2).join(separator);
      }
    }
  }

  return [...groups.values()].sort((a, b) => b.lastActivity - a.lastActivity);
}

async function directoryExists(dir: string): Promise<boolean> {
  try {
    return (await fs.promises.stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
