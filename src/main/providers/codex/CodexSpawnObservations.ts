/**
 * CodexSpawnObservations - The records that tie a subagent spawn call to the
 * thread it started, read from one rollout's own history.
 *
 * Codex persists a `spawn_agent` function call (namespace `collaboration`)
 * and, in the same rollout, an `item_completed` event whose item is
 * `SubAgentActivity {id, kind: 'started', agent_thread_id}`. The item's `id` is
 * the call's `call_id`, and its `agent_thread_id` is the `session_meta.id` of
 * the subagent's rollout: 22 of 22 real spawns, each resolving to exactly one
 * rollout and agreeing with the child's declared parent
 * (docs/codex-real-validation). That id chain is the only evidence used to
 * relate sessions.
 *
 * Not used, because the real records contradict it or cannot support it:
 * `SubAgentActivity` items of other kinds (their `agent_thread_id` also names
 * roots and siblings), a child's `parent_thread_id` or `session_id` on their
 * own (one thread can span several rollout files; `session_id` is the root
 * session, not the direct parent), `agent_path`, and timing.
 *
 * Records copied from the parent thread into a subagent rollout are the
 * parent's history (`InheritedHistoryTracker`) and are skipped, so a subagent
 * never appears to have spawned its siblings.
 */

import {
  type CodexSessionMetadata,
  InheritedHistoryTracker,
  parseSessionMeta,
} from './CodexMetadataParser';
import { readRolloutRecords } from './CodexRolloutParser';

import type { CodexRolloutRecord } from './types';

/** Provider record of the started thread, as named in relation evidence. */
export const STARTED_ACTIVITY_RECORD_TYPE = 'item_completed/SubAgentActivity (started)';

/** A `SubAgentActivity` item of kind `started`. */
export interface CodexStartedActivity {
  /** The item's id; equals the id of the spawn call it is joined to */
  activityId: string;
  /** Thread the item names (`agent_thread_id`) */
  childThreadId: string;
  activityLineNumber: number;
}

/** A spawn call of the rollout's own history and the started items carrying its id. */
export interface CodexSpawnObservation {
  spawnCallId: string;
  /** Namespace the call was recorded under (`collaboration`), if any */
  spawnNamespace?: string;
  spawnLineNumber: number;
  /** Started items with the call's id, one per distinct thread, in record order */
  started: CodexStartedActivity[];
}

export interface CodexSpawnObservations {
  /** `session_meta.id`: the rollout's own thread */
  threadId?: string;
  /**
   * Parent thread the rollout declares as a spawned subagent (`parent_thread_id`,
   * else `source.subagent.thread_spawn.parent_thread_id`). It only narrows which
   * rollouts may hold the spawn; a fork's `forked_from_id` is not a spawn.
   */
  declaredParentThreadId?: string;
  /** Spawn calls in record order */
  spawns: CodexSpawnObservation[];
}

/**
 * Byte markers of every record the collector reads: the spawn call, the
 * started item, `session_meta`, and the records `InheritedHistoryTracker`
 * needs to find the end of an inherited prefix. Serialized JSON never escapes
 * these ASCII names, so a line without any of them carries none of those
 * records, and skipping it changes nothing: it neither matches nor moves the
 * tracker.
 */
const LINE_MARKERS = [
  'spawn_agent',
  'SubAgentActivity',
  'session_meta',
  'thread_settings_applied',
  'task_started',
  'turn_context',
].map((marker) => Buffer.from(marker));

/**
 * Line pre-filter for `readRolloutRecords`: whether a line may carry a record
 * the collector reads. The first line is always read (legacy rollouts start
 * with an untyped session_meta).
 */
export function mayCarrySpawnEvidence(line: Buffer, lineNumber: number): boolean {
  return lineNumber === 1 || LINE_MARKERS.some((marker) => line.includes(marker));
}

/**
 * Streams records and keeps the spawn calls and started items of the rollout's
 * own history. Feed it every record in file order (or every record the
 * pre-filter kept); it can continue across incremental reads.
 */
export class SpawnObservationCollector {
  private metadata: CodexSessionMetadata = {};
  private haveMetadata = false;
  private readonly tracker = new InheritedHistoryTracker();
  private readonly calls = new Map<string, { namespace?: string; lineNumber: number }>();
  private readonly startedById = new Map<string, CodexStartedActivity[]>();

  accept(record: CodexRolloutRecord): void {
    if (this.tracker.isInherited(record, this.metadata)) {
      return;
    }
    const { payload } = record;
    if (record.type === 'session_meta') {
      if (!this.haveMetadata) {
        this.metadata = parseSessionMeta(payload);
        this.haveMetadata = true;
      }
    } else if (record.type === 'response_item') {
      const call = spawnCall(payload);
      if (call && !this.calls.has(call.callId)) {
        this.calls.set(call.callId, { namespace: call.namespace, lineNumber: record.lineNumber });
      }
    } else if (record.type === 'event_msg') {
      const activity = startedActivity(payload, record.lineNumber);
      if (activity) {
        const known = this.startedById.get(activity.activityId) ?? [];
        // Identical repeats name the same thread; the first record is kept.
        if (!known.some((item) => item.childThreadId === activity.childThreadId)) {
          this.startedById.set(activity.activityId, [...known, activity]);
        }
      }
    }
  }

  observations(): CodexSpawnObservations {
    return {
      threadId: this.metadata.sessionMetaId,
      declaredParentThreadId: this.metadata.spawnParentThreadId,
      spawns: [...this.calls].map(([spawnCallId, call]) => ({
        spawnCallId,
        spawnNamespace: call.namespace,
        spawnLineNumber: call.lineNumber,
        started: this.startedById.get(spawnCallId) ?? [],
      })),
    };
  }
}

/** Position of a read in a rollout, to continue from. */
export interface SpawnReadPosition {
  offset: number;
  lineNumber: number;
}

/**
 * Read a rollout's spawn records into `collector`, starting at `from`
 * (plain rollouts only; compressed ones are always read whole). Only lines
 * that may carry such records are parsed. Returns where the next read starts.
 */
export async function readSpawnObservations(
  filePath: string,
  collector: SpawnObservationCollector,
  from: SpawnReadPosition = { offset: 0, lineNumber: 1 }
): Promise<SpawnReadPosition> {
  const result = await readRolloutRecords(filePath, {
    fromOffset: from.offset,
    startLineNumber: from.lineNumber,
    lineFilter: mayCarrySpawnEvidence,
  });
  for (const record of result.records) {
    collector.accept(record);
  }
  return { offset: result.nextOffset, lineNumber: result.nextLineNumber };
}

/** A `spawn_agent` function call (namespace `collaboration`, or none). */
function spawnCall(
  item: Record<string, unknown>
): { callId: string; namespace?: string } | undefined {
  if (item.type !== 'function_call' || item.name !== 'spawn_agent') {
    return undefined;
  }
  const namespace = str(item.namespace);
  if (namespace !== undefined && namespace !== 'collaboration') {
    return undefined;
  }
  const callId = str(item.call_id);
  return callId ? { callId, namespace } : undefined;
}

function startedActivity(
  event: Record<string, unknown>,
  lineNumber: number
): CodexStartedActivity | undefined {
  if (event.type !== 'item_completed' || !isRecord(event.item)) {
    return undefined;
  }
  const { item } = event;
  if (item.type !== 'SubAgentActivity' || item.kind !== 'started') {
    return undefined;
  }
  const activityId = str(item.id);
  const childThreadId = str(item.agent_thread_id);
  return activityId && childThreadId
    ? { activityId, childThreadId, activityLineNumber: lineNumber }
    : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
