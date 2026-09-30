/**
 * SYNTHETIC subagent rollouts for session-relation tests. Not real Codex
 * output: ids, names, commands and texts are invented.
 *
 * The record shapes follow what real rollouts persist
 * (docs/codex-real-validation: runtime-state-survey-2026-09-28.md section F,
 * local-full-corpus-verification-2026-09-27.md Q4, and the sanitized
 * tests/fixtures/codex/real-observed/subagent-*.jsonl):
 * - the parent's `spawn_agent` function call (namespace `collaboration`) and
 *   an `item_completed` `SubAgentActivity` with kind `started`, the call's id
 *   and the child's thread id in `agent_thread_id`
 * - generic activities (`interacted` with a `send_message` call id,
 *   `completed` with `subagent-completed-<uuid>`) that also name threads
 * - a child whose `session_meta` declares `parent_thread_id`,
 *   `source.subagent.thread_spawn`, `session_id` = the root session and a
 *   history boundary, and whose file starts with a copy of the parent's
 *   history, including the parent's spawn records
 * - a grandchild whose `session_id` is the root, not its direct parent
 * - a parent thread continued in a second file (`rollout-…-<thread>_<suffix>`)
 *
 * The real-derived fixtures cannot prove the join itself: the sanitizer
 * replaces `agent_thread_id` with `<string:36>`.
 */

import * as fs from 'fs';
import * as path from 'path';

/** A rollout record before the envelope fields are added. */
export interface RecordSpec {
  type: string;
  payload: Record<string, unknown>;
}

export interface RolloutSpec {
  /** Path relative to the sessions directory */
  sessionId: string;
  /** Envelope start time (ms); records are 100 ms apart */
  startMs: number;
  records: RecordSpec[];
}

const BASE_MS = Date.UTC(2026, 8, 20, 10, 0, 0);
const CWD = '/work/synthetic-app';

/** A UUIDv7 minted at `ms` (canonical form; the tail makes it unique). */
export function uuidV7(ms: number, tail: number): string {
  const time = ms.toString(16).padStart(12, '0');
  const rest = tail.toString(16).padStart(12, '0');
  return `${time.slice(0, 8)}-${time.slice(8, 12)}-7000-8000-${rest}`;
}

export const THREADS = {
  root: uuidV7(BASE_MS, 0xa),
  child: uuidV7(BASE_MS + 5_000, 0xc),
  grandchild: uuidV7(BASE_MS + 9_000, 0xd),
  /** Named by a started activity; no rollout of it exists */
  missing: uuidV7(BASE_MS + 12_000, 0xe),
  /** Spawned from the root's continuation file */
  lateChild: uuidV7(BASE_MS + 86_400_000 + 60_000, 0xf),
};

export const CALLS = {
  spawnChild: 'call_spawnChild0001',
  spawnMissing: 'call_spawnMissing002',
  /** A spawn call no started activity confirms */
  spawnUnconfirmed: 'call_spawnNoActivity3',
  sendToChild: 'call_sendMessage0004',
  spawnGrandchild: 'call_spawnGrandkid05',
  spawnLateChild: 'call_spawnLateKid006',
};

const TURNS = {
  root1: uuidV7(BASE_MS + 1_000, 0x101),
  child1: uuidV7(BASE_MS + 6_000, 0x201),
  grandchild1: uuidV7(BASE_MS + 10_000, 0x301),
  rootLate: uuidV7(BASE_MS + 86_400_000 + 1_000, 0x401),
  lateChild1: uuidV7(BASE_MS + 86_400_000 + 61_000, 0x501),
};

export const SESSION_IDS = {
  root: `2026/09/20/rollout-2026-09-20T10-00-00-${THREADS.root}.jsonl`,
  child: `2026/09/20/rollout-2026-09-20T10-00-05-${THREADS.child}.jsonl`,
  grandchild: `2026/09/20/rollout-2026-09-20T10-00-09-${THREADS.grandchild}.jsonl`,
  rootContinuation: `2026/09/21/rollout-2026-09-21T10-00-00-${THREADS.root}_${uuidV7(BASE_MS + 86_400_000, 0xb)}.jsonl`,
  lateChild: `2026/09/21/rollout-2026-09-21T10-01-00-${THREADS.lateChild}.jsonl`,
  /** Where the missing thread's rollout would be */
  missing: `2026/09/20/rollout-2026-09-20T10-00-12-${THREADS.missing}.jsonl`,
};

// =============================================================================
// Record builders
// =============================================================================

export function sessionMeta(payload: Record<string, unknown>): RecordSpec {
  return {
    type: 'session_meta',
    payload: {
      cwd: CWD,
      originator: 'codex_vscode',
      cli_version: '0.153.4',
      model_provider: 'openai',
      history_mode: 'paginated',
      ...payload,
    },
  };
}

function rootMeta(threadId: string, extra: Record<string, unknown> = {}): RecordSpec {
  return sessionMeta({
    id: threadId,
    session_id: threadId,
    source: 'vscode',
    thread_source: 'user',
    ...extra,
  });
}

/** `session_meta` of a subagent spawned by `parent` under the root session `root`. */
export function childMeta(options: {
  threadId: string;
  parent: string;
  root: string;
  nickname: string;
  agentPath: string;
  depth?: number;
  historyStartOrdinal?: number;
}): RecordSpec {
  return sessionMeta({
    id: options.threadId,
    session_id: options.root,
    forked_from_id: options.parent,
    parent_thread_id: options.parent,
    source: {
      subagent: {
        thread_spawn: {
          parent_thread_id: options.parent,
          depth: options.depth ?? 1,
          agent_path: options.agentPath,
          agent_nickname: options.nickname,
          agent_role: null,
        },
      },
    },
    thread_source: 'subagent',
    agent_nickname: options.nickname,
    agent_path: options.agentPath,
    subagent_history_start_ordinal: options.historyStartOrdinal,
  });
}

function event(payload: Record<string, unknown>): RecordSpec {
  return { type: 'event_msg', payload };
}

export function turnStart(turnId: string): RecordSpec[] {
  return [
    event({ type: 'task_started', turn_id: turnId }),
    {
      type: 'turn_context',
      payload: {
        turn_id: turnId,
        cwd: CWD,
        model: 'synthetic-model',
        approval_policy: 'never',
        sandbox_policy: { type: 'workspace-write' },
      },
    },
  ];
}

export function turnEnd(turnId: string): RecordSpec {
  return event({ type: 'task_complete', turn_id: turnId });
}

function userMessage(text: string): RecordSpec {
  return event({ type: 'user_message', message: text });
}

export function spawnCall(
  callId: string,
  taskName: string,
  namespace = 'collaboration'
): RecordSpec {
  return {
    type: 'response_item',
    payload: {
      type: 'function_call',
      name: 'spawn_agent',
      namespace,
      arguments: JSON.stringify({ task_name: taskName, message: 'Synthetic task text.' }),
      call_id: callId,
    },
  };
}

function toolCall(callId: string, name: string, args: Record<string, unknown>): RecordSpec {
  return {
    type: 'response_item',
    payload: {
      type: 'function_call',
      name,
      namespace: 'collaboration',
      arguments: JSON.stringify(args),
      call_id: callId,
    },
  };
}

export function callOutput(callId: string, output: string): RecordSpec {
  return {
    type: 'response_item',
    payload: { type: 'function_call_output', call_id: callId, output },
  };
}

export function activity(options: {
  thread: string;
  turn: string;
  id: string;
  kind: 'started' | 'interacted' | 'interrupted' | 'completed';
  agentThreadId: string;
  agentPath: string;
}): RecordSpec {
  return event({
    type: 'item_completed',
    thread_id: options.thread,
    turn_id: options.turn,
    item: {
      type: 'SubAgentActivity',
      id: options.id,
      kind: options.kind,
      agent_thread_id: options.agentThreadId,
      agent_path: options.agentPath,
    },
  });
}

function threadSettings(threadId: string): RecordSpec {
  return event({
    type: 'thread_settings_applied',
    thread_id: threadId,
    thread_settings: { model: 'synthetic-model', approval_policy: 'never' },
  });
}

function taskMessage(recipient: string): RecordSpec[] {
  return [
    { type: 'inter_agent_communication_metadata', payload: { trigger_turn: true } },
    {
      type: 'response_item',
      payload: {
        type: 'agent_message',
        author: '/root',
        recipient,
        content: [
          { type: 'input_text', text: `Message Type: NEW_TASK\nTask name: ${recipient}\n` },
          { type: 'encrypted_content', encrypted_content: 'synthetic-ciphertext' },
        ],
      },
    },
  ];
}

function shellCall(callId: string, cmd: string): RecordSpec[] {
  return [
    {
      type: 'response_item',
      payload: {
        type: 'function_call',
        name: 'exec_command',
        arguments: JSON.stringify({ cmd }),
        call_id: callId,
      },
    },
    callOutput(callId, 'Process exited with code 0\nOutput:\nok\n'),
  ];
}

// =============================================================================
// The family
// =============================================================================

/** The root's first turn, up to and including the child's started activity. */
function rootFirstTurnUntilChildStarted(): RecordSpec[] {
  return [
    ...turnStart(TURNS.root1),
    userMessage('Review the synthetic app with a helper agent.'),
    spawnCall(CALLS.spawnChild, 'reviewer'),
    activity({
      thread: THREADS.root,
      turn: TURNS.root1,
      id: CALLS.spawnChild,
      kind: 'started',
      agentThreadId: THREADS.child,
      agentPath: '/root/reviewer',
    }),
    callOutput(CALLS.spawnChild, '{"agent_path":"/root/reviewer"}'),
  ];
}

/**
 * Root session (first file of its thread): spawns the child (resolved), a
 * helper whose rollout is missing, and a call no started activity confirms.
 */
export function rootRollout(): RolloutSpec {
  return {
    sessionId: SESSION_IDS.root,
    startMs: BASE_MS,
    records: [
      rootMeta(THREADS.root),
      ...rootFirstTurnUntilChildStarted(),
      toolCall(CALLS.sendToChild, 'send_message', { target: '/root/reviewer', message: 'hi' }),
      activity({
        thread: THREADS.root,
        turn: TURNS.root1,
        id: CALLS.sendToChild,
        kind: 'interacted',
        agentThreadId: THREADS.child,
        agentPath: '/root/reviewer',
      }),
      callOutput(CALLS.sendToChild, '{}'),
      spawnCall(CALLS.spawnMissing, 'tester'),
      activity({
        thread: THREADS.root,
        turn: TURNS.root1,
        id: CALLS.spawnMissing,
        kind: 'started',
        agentThreadId: THREADS.missing,
        agentPath: '/root/tester',
      }),
      callOutput(CALLS.spawnMissing, '{"agent_path":"/root/tester"}'),
      spawnCall(CALLS.spawnUnconfirmed, 'writer'),
      callOutput(CALLS.spawnUnconfirmed, 'spawn failed'),
      activity({
        thread: THREADS.root,
        turn: TURNS.root1,
        id: `subagent-completed-${uuidV7(BASE_MS + 20_000, 0x999)}`,
        kind: 'completed',
        agentThreadId: THREADS.child,
        agentPath: '/root/reviewer',
      }),
      turnEnd(TURNS.root1),
    ],
  };
}

/**
 * Child spawned by the root. Its file starts with a copy of the root's
 * history (including the root's spawn call and started activity for this very
 * child); its own history spawns the grandchild.
 */
export function childRollout(): RolloutSpec {
  const inherited = rootFirstTurnUntilChildStarted();
  const historyStartOrdinal = 1 + inherited.length;
  return {
    sessionId: SESSION_IDS.child,
    startMs: BASE_MS + 5_000,
    records: [
      childMeta({
        threadId: THREADS.child,
        parent: THREADS.root,
        root: THREADS.root,
        nickname: 'Noether',
        agentPath: '/root/reviewer',
        historyStartOrdinal,
      }),
      ...inherited,
      threadSettings(THREADS.child),
      ...turnStart(TURNS.child1),
      ...taskMessage('/root/reviewer'),
      ...shellCall('call_childShell0001', 'ls'),
      spawnCall(CALLS.spawnGrandchild, 'checker'),
      activity({
        thread: THREADS.child,
        turn: TURNS.child1,
        id: CALLS.spawnGrandchild,
        kind: 'started',
        agentThreadId: THREADS.grandchild,
        agentPath: '/root/reviewer/checker',
      }),
      callOutput(CALLS.spawnGrandchild, '{"agent_path":"/root/reviewer/checker"}'),
      turnEnd(TURNS.child1),
    ],
  };
}

/** Depth-2 subagent: spawned by the child; its `session_id` is the root's. */
export function grandchildRollout(): RolloutSpec {
  return {
    sessionId: SESSION_IDS.grandchild,
    startMs: BASE_MS + 9_000,
    records: [
      childMeta({
        threadId: THREADS.grandchild,
        parent: THREADS.child,
        root: THREADS.root,
        nickname: 'Hopper',
        agentPath: '/root/reviewer/checker',
        depth: 2,
      }),
      threadSettings(THREADS.grandchild),
      ...turnStart(TURNS.grandchild1),
      ...taskMessage('/root/reviewer/checker'),
      ...shellCall('call_grandkidShell01', 'pwd'),
      turnEnd(TURNS.grandchild1),
    ],
  };
}

/** The root thread continued in a second file; it spawns the late child. */
export function rootContinuationRollout(): RolloutSpec {
  return {
    sessionId: SESSION_IDS.rootContinuation,
    startMs: BASE_MS + 86_400_000,
    records: [
      rootMeta(THREADS.root, {
        history_base: { thread_id: THREADS.root, end_ordinal_exclusive: 20, end_byte_offset: 4096 },
      }),
      ...turnStart(TURNS.rootLate),
      userMessage('Continue with another helper.'),
      spawnCall(CALLS.spawnLateChild, 'fixer'),
      activity({
        thread: THREADS.root,
        turn: TURNS.rootLate,
        id: CALLS.spawnLateChild,
        kind: 'started',
        agentThreadId: THREADS.lateChild,
        agentPath: '/root/fixer',
      }),
      callOutput(CALLS.spawnLateChild, '{"agent_path":"/root/fixer"}'),
      turnEnd(TURNS.rootLate),
    ],
  };
}

/** Subagent spawned from the root's continuation file. */
export function lateChildRollout(): RolloutSpec {
  return {
    sessionId: SESSION_IDS.lateChild,
    startMs: BASE_MS + 86_400_000 + 60_000,
    records: [
      childMeta({
        threadId: THREADS.lateChild,
        parent: THREADS.root,
        root: THREADS.root,
        nickname: 'Lovelace',
        agentPath: '/root/fixer',
      }),
      threadSettings(THREADS.lateChild),
      ...turnStart(TURNS.lateChild1),
      ...taskMessage('/root/fixer'),
      turnEnd(TURNS.lateChild1),
    ],
  };
}

export function subagentFamily(): RolloutSpec[] {
  return [
    rootRollout(),
    childRollout(),
    grandchildRollout(),
    rootContinuationRollout(),
    lateChildRollout(),
  ];
}

// =============================================================================
// Writing
// =============================================================================

/** Rollout lines with envelope timestamps and ordinals. */
export function rolloutLines(spec: RolloutSpec): string[] {
  return spec.records.map((record, ordinal) =>
    JSON.stringify({
      timestamp: new Date(spec.startMs + ordinal * 100).toISOString(),
      type: record.type,
      payload: record.payload,
      ordinal,
    })
  );
}

/** Write rollouts below `sessionsDir`; returns their absolute paths. */
export function writeRollouts(sessionsDir: string, specs: readonly RolloutSpec[]): string[] {
  return specs.map((spec) => {
    const filePath = path.join(sessionsDir, ...spec.sessionId.split('/'));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${rolloutLines(spec).join('\n')}\n`);
    return filePath;
  });
}

/** 1-based line of the first record matching `predicate`. */
export function lineOf(spec: RolloutSpec, predicate: (record: RecordSpec) => boolean): number {
  const index = spec.records.findIndex(predicate);
  if (index === -1) throw new Error('record not found');
  return index + 1;
}
