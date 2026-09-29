/**
 * CodexSessionRelations - Relates a Codex rollout to the subagent rollouts it
 * spawned and to the rollout that spawned it.
 *
 * The only link is the explicit id chain of `CodexSpawnObservations`:
 * `spawn_agent` call id = `SubAgentActivity` (`started`) id, whose
 * `agent_thread_id` = the child rollout's `session_meta.id`.
 *
 * - Parent → child: each spawn call in the rollout's own history names a child
 *   thread through its started item; the child is the one rollout file whose
 *   `session_meta.id` is that thread.
 * - Child → parent: the child's declared parent thread only narrows the search
 *   to that thread's rollout files (one thread can span several files, e.g. a
 *   continuation `rollout-…-<thread>_<suffix>.jsonl`); the parent is the one
 *   file whose own history holds a spawn call whose started item names the
 *   child's thread.
 *
 * Nothing else is guessed: no file → `missing_session`; several files, or
 * records naming several threads → `ambiguous`; no proving records →
 * `unresolved`.
 *
 * Rollout files are found by the thread id in their name (Codex names each
 * rollout after its thread and parses it back the same way) or by an already
 * read `session_meta`, and every file is confirmed by its `session_meta.id`
 * before it counts.
 *
 * Cost: listing never reads spawn records. A request reads the rollout's own
 * spawn records (incrementally, parsing only lines that can carry them, or
 * from the records its detail view already holds), stats the rollout files
 * (cached; refreshed by watcher add/unlink events), reads the heads of the
 * files named for the threads it looks up (cached by the scanner) and, for a
 * subagent, the spawn records of its declared parent thread's files only.
 */

import { createLogger } from '@shared/utils/logger';
import * as fs from 'fs';

import { parseRolloutFileName, resolveSessionFilePath } from './codexPaths';
import {
  type CodexSpawnObservation,
  type CodexSpawnObservations,
  readSpawnObservations,
  SpawnObservationCollector,
  STARTED_ACTIVITY_RECORD_TYPE,
} from './CodexSpawnObservations';

import type { CodexScanner, RolloutFile, RolloutHead } from './CodexScanner';
import type { CodexWatchEvent } from './CodexSessionWatcher';
import type { CodexRolloutRecord } from './types';
import type {
  AgentSessionRelation,
  AgentSessionRelationEvidence,
  AgentSessionRelations,
  AgentSessionRelationTarget,
} from '@main/domain';

const logger = createLogger('Codex:SessionRelations');

/** How long the list of rollout files is reused (watcher add/unlink events clear it sooner). */
const FILE_LIST_TTL_MS = 2000;
/** Rollouts whose spawn records are kept for incremental re-reads. */
const MAX_OBSERVED_FILES = 64;

/** Complete-line records of a rollout that the detail cache already holds. */
export interface CachedRolloutRecords {
  ino: number;
  records: readonly CodexRolloutRecord[];
  /** Byte offset after the last complete line */
  offset: number;
  nextLineNumber: number;
}

interface ObservationEntry {
  ino: number;
  mtimeMs: number;
  size: number;
  offset: number;
  nextLineNumber: number;
  collector: SpawnObservationCollector;
}

/** Rollout files of one thread. */
interface ThreadFiles {
  /** Files whose `session_meta.id` is the thread */
  matches: { file: RolloutFile; head: RolloutHead }[];
  /** Files named for the thread whose `session_meta` could not be read */
  unreadable: RolloutFile[];
}

export class CodexSessionRelations {
  private readonly observed = new Map<string, ObservationEntry>();
  private readonly inFlight = new Map<string, Promise<CodexSpawnObservations | null>>();
  private fileList: { files: RolloutFile[]; expiresAt: number } | null = null;

  /**
   * @param cachedRecords complete records the detail cache holds for a session
   *   id, used instead of a second read of the same file
   */
  constructor(
    private readonly scanner: CodexScanner,
    private readonly cachedRecords: (sessionId: string) => CachedRolloutRecords | undefined = () =>
      undefined,
    private readonly now: () => number = Date.now
  ) {}

  /**
   * Relations of one rollout, or null when the session id is invalid, the file
   * is gone or it cannot be read.
   */
  async getRelations(sessionId: string): Promise<AgentSessionRelations | null> {
    const file = await this.scanner.getFile(sessionId);
    if (!file) {
      return null;
    }
    const own = await this.observationsFor(file);
    if (!own) {
      return null;
    }
    const index = await this.threadIndex();
    const children: AgentSessionRelation[] = [];
    for (const spawn of own.spawns) {
      children.push(await this.resolveChild(spawn, own, file, index));
    }
    const parent =
      own.declaredParentThreadId !== undefined
        ? await this.resolveParent(own, own.declaredParentThreadId, file, index)
        : undefined;
    return { sessionId, threadId: own.threadId, parent, children };
  }

  onWatchEvent(event: CodexWatchEvent): void {
    // Content changes are caught by stat; files appearing or vanishing are not.
    if (event.type !== 'change' || !event.sessionId) {
      this.fileList = null;
    }
    if (event.type === 'unlink' && event.sessionId) {
      const filePath = resolveSessionFilePath(this.scanner.getSessionsDir(), event.sessionId);
      if (filePath) {
        this.observed.delete(filePath);
      }
    }
  }

  clear(): void {
    this.observed.clear();
    this.fileList = null;
  }

  // ===========================================================================
  // Resolution
  // ===========================================================================

  private async resolveChild(
    spawn: CodexSpawnObservation,
    own: CodexSpawnObservations,
    file: RolloutFile,
    index: Map<string, RolloutFile[]>
  ): Promise<AgentSessionRelation> {
    const evidence: AgentSessionRelationEvidence = {
      ...spawnEvidence(spawn),
      parentThreadId: own.threadId,
    };
    const base = { kind: 'spawned_child' as const, executionId: spawn.spawnCallId, evidence };

    if (spawn.started.length === 0) {
      return {
        ...base,
        status: 'unresolved',
        reason: 'No SubAgentActivity "started" record carries this call id',
      };
    }
    if (spawn.started.length > 1) {
      return {
        ...base,
        status: 'ambiguous',
        candidateThreadIds: spawn.started.map((activity) => activity.childThreadId),
        reason: `${spawn.started.length} "started" records with this call id name different threads`,
      };
    }
    const childThreadId = evidence.childThreadId;
    if (childThreadId === undefined || childThreadId === own.threadId) {
      return {
        ...base,
        status: 'unresolved',
        reason: 'The "started" record names this session\'s own thread',
      };
    }

    const found = await this.threadFiles(index, childThreadId, file.filePath);
    const total = found.matches.length + found.unreadable.length;
    if (total === 0) {
      return {
        ...base,
        status: 'missing_session',
        relatedThreadId: childThreadId,
        reason: 'No rollout of this thread is present',
      };
    }
    if (found.matches.length === 1 && found.unreadable.length === 0) {
      const [child] = found.matches;
      evidence.declaredParentThreadId = child.head.metadata.spawnParentThreadId;
      return {
        ...base,
        status: 'resolved',
        relatedSessionId: child.file.sessionId,
        relatedThreadId: childThreadId,
        related: targetOf(child.head),
      };
    }
    if (total > 1) {
      return {
        ...base,
        status: 'ambiguous',
        relatedThreadId: childThreadId,
        candidateSessionIds: sessionIds([...found.matches.map((m) => m.file), ...found.unreadable]),
        reason: `${total} rollouts belong to this thread`,
      };
    }
    return {
      ...base,
      status: 'unresolved',
      relatedThreadId: childThreadId,
      reason: 'The rollout of this thread could not be read',
    };
  }

  private async resolveParent(
    own: CodexSpawnObservations,
    declaredParentThreadId: string,
    file: RolloutFile,
    index: Map<string, RolloutFile[]>
  ): Promise<AgentSessionRelation> {
    const evidence: AgentSessionRelationEvidence = {
      method: 'explicit_id_chain',
      childThreadId: own.threadId,
      declaredParentThreadId,
    };
    const base = { kind: 'spawned_by' as const, evidence };
    const childThreadId = own.threadId;
    if (childThreadId === undefined) {
      return {
        ...base,
        status: 'unresolved',
        reason: 'This rollout records no thread id (session_meta.id)',
      };
    }

    const found = await this.threadFiles(index, declaredParentThreadId, file.filePath);
    if (found.matches.length + found.unreadable.length === 0) {
      return {
        ...base,
        status: 'missing_session',
        reason: 'No rollout of the declared parent thread is present',
      };
    }

    const unreadable = [...found.unreadable];
    /** Spawns naming only this thread */
    const proofs: { file: RolloutFile; head: RolloutHead; spawn: CodexSpawnObservation }[] = [];
    /** Files with a spawn whose started records name this thread and another */
    const conflicting: RolloutFile[] = [];
    for (const candidate of found.matches) {
      const observations = await this.observationsFor(candidate.file);
      if (!observations) {
        unreadable.push(candidate.file);
        continue;
      }
      for (const spawn of observations.spawns) {
        if (!spawn.started.some((activity) => activity.childThreadId === childThreadId)) continue;
        if (spawn.started.length === 1) {
          proofs.push({ ...candidate, spawn });
        } else {
          conflicting.push(candidate.file);
        }
      }
    }

    if (proofs.length === 1 && conflicting.length === 0 && unreadable.length === 0) {
      const [proof] = proofs;
      return {
        kind: 'spawned_by',
        status: 'resolved',
        executionId: proof.spawn.spawnCallId,
        relatedSessionId: proof.file.sessionId,
        relatedThreadId: declaredParentThreadId,
        related: targetOf(proof.head),
        evidence: {
          ...spawnEvidence(proof.spawn),
          parentThreadId: declaredParentThreadId,
          declaredParentThreadId,
        },
      };
    }
    const matching = proofs.length + conflicting.length;
    if (matching > 1 || (matching === 1 && (conflicting.length > 0 || unreadable.length > 0))) {
      return {
        ...base,
        status: 'ambiguous',
        candidateSessionIds: sessionIds([
          ...proofs.map((proof) => proof.file),
          ...conflicting,
          ...unreadable,
        ]),
        reason:
          proofs.length > 1
            ? `${proofs.length} spawn calls in the declared parent thread's rollouts started this thread`
            : conflicting.length > 0
              ? 'A spawn call that started this thread also names another thread'
              : 'A rollout of the declared parent thread could not be read',
      };
    }
    const count = found.matches.length + found.unreadable.length;
    return {
      ...base,
      status: 'unresolved',
      reason:
        unreadable.length > 0
          ? `${unreadable.length} of ${count} rollout(s) of the declared parent thread could not be read`
          : `None of the ${count} rollout(s) of the declared parent thread records a spawn_agent call whose "started" record names this thread`,
    };
  }

  // ===========================================================================
  // Files and threads
  // ===========================================================================

  /** Rollout files by thread id: the `session_meta.id` already read, else the id in the name. */
  private async threadIndex(): Promise<Map<string, RolloutFile[]>> {
    const index = new Map<string, RolloutFile[]>();
    for (const file of await this.listFiles()) {
      const threadId =
        this.scanner.peekHead(file)?.metadata.sessionMetaId ??
        parseRolloutFileName(file.fileName)?.threadId ??
        (await this.scanner.readHead(file)).metadata.sessionMetaId;
      if (threadId === undefined) continue;
      const files = index.get(threadId);
      if (files) {
        files.push(file);
      } else {
        index.set(threadId, [file]);
      }
    }
    return index;
  }

  /** Files of `threadId` other than `excludePath`, each confirmed by its `session_meta.id`. */
  private async threadFiles(
    index: Map<string, RolloutFile[]>,
    threadId: string,
    excludePath: string
  ): Promise<ThreadFiles> {
    const result: ThreadFiles = { matches: [], unreadable: [] };
    for (const file of index.get(threadId) ?? []) {
      if (file.filePath === excludePath) continue;
      const head = await this.scanner.readHead(file);
      const recorded = head.metadata.sessionMetaId;
      if (recorded === threadId) {
        result.matches.push({ file, head });
      } else if (recorded === undefined) {
        result.unreadable.push(file);
      }
    }
    return result;
  }

  private async listFiles(): Promise<RolloutFile[]> {
    const now = this.now();
    if (this.fileList && this.fileList.expiresAt > now) {
      return this.fileList.files;
    }
    const files = await this.scanner.listFiles();
    files.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
    this.fileList = { files, expiresAt: now + FILE_LIST_TTL_MS };
    return files;
  }

  // ===========================================================================
  // Spawn records
  // ===========================================================================

  private observationsFor(file: RolloutFile): Promise<CodexSpawnObservations | null> {
    const pending = this.inFlight.get(file.filePath);
    if (pending) {
      return pending;
    }
    const request = this.readObservations(file).finally(() => {
      this.inFlight.delete(file.filePath);
    });
    this.inFlight.set(file.filePath, request);
    return request;
  }

  private async readObservations(file: RolloutFile): Promise<CodexSpawnObservations | null> {
    let stats: fs.Stats;
    try {
      stats = await fs.promises.stat(file.filePath);
    } catch {
      this.observed.delete(file.filePath);
      return null;
    }

    const previous = this.observed.get(file.filePath);
    if (
      previous?.ino === stats.ino &&
      previous.mtimeMs === stats.mtimeMs &&
      previous.size === stats.size
    ) {
      this.remember(file.filePath, previous);
      return previous.collector.observations();
    }

    // Rollouts are append-only: continue after the last complete line read.
    const canAppend =
      previous !== undefined &&
      !file.compressed &&
      previous.ino === stats.ino &&
      stats.size >= previous.offset;
    const entry: ObservationEntry = canAppend
      ? previous
      : (this.fromDetailCache(file, stats) ?? {
          ino: stats.ino,
          mtimeMs: 0,
          size: 0,
          offset: 0,
          nextLineNumber: 1,
          collector: new SpawnObservationCollector(),
        });

    // A plain rollout is only read past the lines already seen.
    if (file.compressed || stats.size > entry.offset) {
      try {
        const next = await readSpawnObservations(file.filePath, entry.collector, {
          offset: entry.offset,
          lineNumber: entry.nextLineNumber,
        });
        entry.offset = next.offset;
        entry.nextLineNumber = next.lineNumber;
      } catch (error) {
        logger.error(`Failed to read spawn records of ${file.sessionId}:`, error);
        this.observed.delete(file.filePath);
        return null;
      }
    }
    entry.mtimeMs = stats.mtimeMs;
    entry.size = stats.size;
    this.remember(file.filePath, entry);
    return entry.collector.observations();
  }

  /** Start from the records the detail cache holds for this file, if they are still valid. */
  private fromDetailCache(file: RolloutFile, stats: fs.Stats): ObservationEntry | undefined {
    const cached = file.compressed ? undefined : this.cachedRecords(file.sessionId);
    if (cached?.ino !== stats.ino || stats.size < cached.offset) {
      return undefined;
    }
    const collector = new SpawnObservationCollector();
    for (const record of cached.records) {
      collector.accept(record);
    }
    return {
      ino: cached.ino,
      mtimeMs: 0,
      size: 0,
      offset: cached.offset,
      nextLineNumber: cached.nextLineNumber,
      collector,
    };
  }

  private remember(filePath: string, entry: ObservationEntry): void {
    this.observed.delete(filePath);
    this.observed.set(filePath, entry);
    while (this.observed.size > MAX_OBSERVED_FILES) {
      const oldest = this.observed.keys().next().value;
      if (oldest === undefined) break;
      this.observed.delete(oldest);
    }
  }
}

function spawnEvidence(spawn: CodexSpawnObservation): AgentSessionRelationEvidence {
  const [activity] = spawn.started.length === 1 ? spawn.started : [];
  const tool = spawn.spawnNamespace ? `${spawn.spawnNamespace}.spawn_agent` : 'spawn_agent';
  return {
    method: 'explicit_id_chain',
    callId: spawn.spawnCallId,
    callRecordType: `function_call ${tool}`,
    callLineNumber: spawn.spawnLineNumber,
    activityRecordType: activity ? STARTED_ACTIVITY_RECORD_TYPE : undefined,
    activityLineNumber: activity?.activityLineNumber,
    childThreadId: activity?.childThreadId,
  };
}

function targetOf(head: RolloutHead): AgentSessionRelationTarget {
  return {
    title: head.title,
    titleSource: head.titleSource,
    agentNickname: head.metadata.agentNickname,
    agentRole: head.metadata.agentRole,
  };
}

function sessionIds(files: readonly RolloutFile[]): string[] {
  return [...new Set(files.map((file) => file.sessionId))].sort((a, b) => a.localeCompare(b));
}
