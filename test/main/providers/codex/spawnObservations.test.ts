/**
 * Spawn observations: the records of one rollout that tie a `spawn_agent`
 * call to the thread it started (exact id join, `started` items only, own
 * history only), and the line pre-filter that lets them be read without
 * parsing a whole rollout.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, describe, expect, it } from 'vitest';

import { readRolloutRecords } from '../../../../src/main/providers/codex/CodexRolloutParser';
import {
  mayCarrySpawnEvidence,
  readSpawnObservations,
  SpawnObservationCollector,
} from '../../../../src/main/providers/codex/CodexSpawnObservations';
import {
  activity,
  CALLS,
  callOutput,
  childMeta,
  childRollout,
  lineOf,
  rolloutLines,
  rootRollout,
  type RolloutSpec,
  spawnCall,
  subagentFamily,
  THREADS,
  turnEnd,
  turnStart,
  uuidV7,
} from '../../../fixtures/codex/subagentFamily';

import type { CodexSpawnObservations } from '../../../../src/main/providers/codex/CodexSpawnObservations';
import type { CodexRolloutRecord } from '../../../../src/main/providers/codex/types';

const REAL_OBSERVED = path.resolve(__dirname, '../../../../tests/fixtures/codex/real-observed');
const SYNTHETIC = path.resolve(__dirname, '../../../fixtures/codex');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-spawn-observations-'));
afterAll(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

let fileCounter = 0;
function writeLines(lines: readonly string[]): string {
  const filePath = path.join(tempRoot, `rollout-${++fileCounter}.jsonl`);
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
  return filePath;
}

/** Observations from every record of a file (no pre-filter). */
async function observeAll(filePath: string): Promise<CodexSpawnObservations> {
  const collector = new SpawnObservationCollector();
  const { records } = await readRolloutRecords(filePath);
  for (const record of records) collector.accept(record);
  return collector.observations();
}

/** Observations through the pre-filtered reader. */
async function observeFiltered(filePath: string): Promise<CodexSpawnObservations> {
  const collector = new SpawnObservationCollector();
  await readSpawnObservations(filePath, collector);
  return collector.observations();
}

function observeSpec(spec: RolloutSpec): Promise<CodexSpawnObservations> {
  return observeAll(writeLines(rolloutLines(spec)));
}

/** A rollout transcript from tests/fixtures/codex/real-observed written back as a rollout. */
function realRollout(file: string): string {
  const lines = fs
    .readFileSync(path.join(REAL_OBSERVED, file), 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((entry) => typeof entry.type === 'string' && typeof entry.line === 'number')
    .map((entry) =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(entry).filter(([key]) => key !== 'line' && key !== 'bytes')
        )
      )
    );
  return writeLines(lines);
}

describe('spawn observations: the id chain', () => {
  it('joins a spawn_agent call to the started activity carrying its call id', async () => {
    const root = rootRollout();
    const observed = await observeSpec(root);

    expect(observed.threadId).toBe(THREADS.root);
    expect(observed.declaredParentThreadId).toBeUndefined();
    expect(observed.spawns).toEqual([
      {
        spawnCallId: CALLS.spawnChild,
        spawnNamespace: 'collaboration',
        spawnLineNumber: lineOf(root, (r) => r.payload.call_id === CALLS.spawnChild),
        started: [
          {
            activityId: CALLS.spawnChild,
            childThreadId: THREADS.child,
            activityLineNumber: lineOf(
              root,
              (r) => (r.payload.item as { id?: string } | undefined)?.id === CALLS.spawnChild
            ),
          },
        ],
      },
      {
        spawnCallId: CALLS.spawnMissing,
        spawnNamespace: 'collaboration',
        spawnLineNumber: lineOf(root, (r) => r.payload.call_id === CALLS.spawnMissing),
        started: [expect.objectContaining({ childThreadId: THREADS.missing })],
      },
      {
        spawnCallId: CALLS.spawnUnconfirmed,
        spawnNamespace: 'collaboration',
        spawnLineNumber: lineOf(root, (r) => r.payload.call_id === CALLS.spawnUnconfirmed),
        started: [],
      },
    ]);
    // Invariant of every join: the activity id is the spawn call id.
    for (const spawn of observed.spawns) {
      for (const started of spawn.started) expect(started.activityId).toBe(spawn.spawnCallId);
    }
  });

  it('ignores activities whose id matches no spawn call, and non-started kinds', async () => {
    const turn = uuidV7(Date.UTC(2026, 8, 20, 10, 0, 1), 1);
    const observed = await observeSpec({
      sessionId: 'x.jsonl',
      startMs: 0,
      records: [
        rootRollout().records[0],
        ...turnStart(turn),
        spawnCall('call_A', 'a'),
        // Same thread named by an interacted item carrying the spawn call id: not a start.
        activity({
          thread: THREADS.root,
          turn,
          id: 'call_A',
          kind: 'interacted',
          agentThreadId: THREADS.child,
          agentPath: '/root/a',
        }),
        // A started item whose id is another call's: not this spawn's.
        activity({
          thread: THREADS.root,
          turn,
          id: 'call_B',
          kind: 'started',
          agentThreadId: THREADS.grandchild,
          agentPath: '/root/a',
        }),
        // Only the exact id counts (no prefix or case folding).
        activity({
          thread: THREADS.root,
          turn,
          id: 'CALL_A',
          kind: 'started',
          agentThreadId: THREADS.missing,
          agentPath: '/root/a',
        }),
        turnEnd(turn),
      ],
    });
    expect(observed.spawns).toEqual([
      expect.objectContaining({ spawnCallId: 'call_A', started: [] }),
    ]);
  });

  it('keeps conflicting started activities for one call, and collapses identical ones', async () => {
    const turn = uuidV7(Date.UTC(2026, 8, 20, 10, 0, 1), 2);
    const started = (agentThreadId: string) =>
      activity({
        thread: THREADS.root,
        turn,
        id: 'call_A',
        kind: 'started',
        agentThreadId,
        agentPath: '/root/a',
      });
    const observed = await observeSpec({
      sessionId: 'x.jsonl',
      startMs: 0,
      records: [
        rootRollout().records[0],
        ...turnStart(turn),
        // Recorded before its call: the join does not depend on record order.
        started(THREADS.child),
        spawnCall('call_A', 'a'),
        started(THREADS.child),
        started(THREADS.grandchild),
        turnEnd(turn),
      ],
    });
    expect(observed.spawns).toHaveLength(1);
    expect(
      observed.spawns[0].started.map((item) => [item.childThreadId, item.activityLineNumber])
    ).toEqual([
      [THREADS.child, 4],
      [THREADS.grandchild, 7],
    ]);
  });

  it('reads spawn_agent under the collaboration namespace or none, not other namespaces', async () => {
    const turn = uuidV7(Date.UTC(2026, 8, 20, 10, 0, 1), 3);
    const observed = await observeSpec({
      sessionId: 'x.jsonl',
      startMs: 0,
      records: [
        rootRollout().records[0],
        ...turnStart(turn),
        spawnCall('call_mcp', 'a', 'mcp__agents'),
        {
          type: 'response_item',
          payload: {
            type: 'function_call',
            name: 'spawn_agent',
            arguments: '{}',
            call_id: 'call_bare',
          },
        },
        callOutput('call_bare', 'ok'),
        turnEnd(turn),
      ],
    });
    expect(observed.spawns.map((spawn) => [spawn.spawnCallId, spawn.spawnNamespace])).toEqual([
      ['call_bare', undefined],
    ]);
  });
});

describe('spawn observations: inherited history', () => {
  it("never counts the parent's copied spawn records as the child's own", async () => {
    // The child's file starts with a copy of the root's first turn, including
    // the root's spawn call and the started activity for this very child.
    const child = childRollout();
    const copied = child.records.filter(
      (record) =>
        record.payload.call_id === CALLS.spawnChild ||
        (record.payload.item as { id?: string } | undefined)?.id === CALLS.spawnChild
    );
    expect(copied.length).toBeGreaterThanOrEqual(2);

    const observed = await observeSpec(child);
    expect(observed.threadId).toBe(THREADS.child);
    expect(observed.declaredParentThreadId).toBe(THREADS.root);
    expect(observed.spawns.map((spawn) => spawn.spawnCallId)).toEqual([CALLS.spawnGrandchild]);
  });

  it('excludes them because of the history boundary, not because they are absent', async () => {
    const child = childRollout();
    const withoutBoundary: RolloutSpec = {
      ...child,
      records: child.records.map((record, index) =>
        index === 0
          ? {
              ...record,
              payload: { ...record.payload, subagent_history_start_ordinal: undefined },
            }
          : record
      ),
    };
    const observed = await observeSpec(withoutBoundary);
    expect(observed.spawns.map((spawn) => spawn.spawnCallId)).toEqual([
      CALLS.spawnChild,
      CALLS.spawnGrandchild,
    ]);
  });

  it("real subagent rollout: the inherited started item is not the subagent's spawn", async () => {
    // tests/fixtures/codex/real-observed/subagent-thread-spawn.jsonl (cli
    // 0.153.0): line 19 is a SubAgentActivity "started" item inside the
    // inherited prefix (lines 2-161). The sanitizer replaced its
    // agent_thread_id with <string:36>, so this fixture cannot show a join.
    const filePath = realRollout('subagent-thread-spawn.jsonl');
    const { records } = await readRolloutRecords(filePath);
    const started = records.filter(
      (record: CodexRolloutRecord) =>
        record.type === 'event_msg' &&
        (record.payload.item as { type?: string; kind?: string } | undefined)?.type ===
          'SubAgentActivity' &&
        (record.payload.item as { kind?: string }).kind === 'started'
    );
    expect(started.map((record) => record.lineNumber)).toEqual([19]);

    expect(await observeFiltered(filePath)).toEqual({
      threadId: '01a0a8c9-2bb8-7920-a65b-c88be2bc900f',
      declaredParentThreadId: '01a09d90-2086-7f92-9e12-670bc277cf90',
      spawns: [],
    });
  });

  it('real subagent rollout: declares its parent thread, which spans two rollouts', async () => {
    // subagent-declared-boundary.jsonl: the parent thread 01a07967-… is the
    // one the survey found in two rollout files (a continuation file).
    const observed = await observeFiltered(realRollout('subagent-declared-boundary.jsonl'));
    expect(observed).toEqual({
      threadId: '01a08b56-a905-7712-bb7e-f2747c374a39',
      declaredParentThreadId: '01a07967-8252-7b21-8524-3164700549b1',
      spawns: [],
    });
  });
});

type OwnHistoryMarker = 'thread_settings_applied' | 'task_started' | 'turn_context';

/**
 * A subagent rollout shaped like the migrated legacy ones (10 of 22 real
 * subagents): the declared history boundary equals the record count, so only
 * the first own-history marker ends the copied prefix. Its own history starts
 * with `marker` and spawns one agent right away.
 */
function migratedChild(marker: OwnHistoryMarker): RolloutSpec {
  const child = childRollout();
  const ownTurn = uuidV7(Date.UTC(2026, 8, 20, 10, 0, 6), 0x7a);
  const inherited = child.records.slice(
    1,
    child.records.findIndex((r) => r.payload.type === 'thread_settings_applied')
  );
  const start = {
    thread_settings_applied: {
      type: 'event_msg',
      payload: { type: 'thread_settings_applied', thread_id: THREADS.child, thread_settings: {} },
    },
    task_started: { type: 'event_msg', payload: { type: 'task_started', turn_id: ownTurn } },
    turn_context: { type: 'turn_context', payload: { turn_id: ownTurn, model: 'synthetic-model' } },
  }[marker];
  const own = [
    start,
    spawnCall('call_ownSpawnAfter01', 'helper'),
    activity({
      thread: THREADS.child,
      turn: ownTurn,
      id: 'call_ownSpawnAfter01',
      kind: 'started',
      agentThreadId: THREADS.grandchild,
      agentPath: '/root/reviewer/helper',
    }),
    turnEnd(ownTurn),
  ];
  const count = 1 + inherited.length + own.length;
  return {
    ...child,
    records: [
      childMeta({
        threadId: THREADS.child,
        parent: THREADS.root,
        root: THREADS.root,
        nickname: 'Noether',
        agentPath: '/root/reviewer',
        historyStartOrdinal: count,
      }),
      ...inherited,
      ...own,
    ],
  };
}

const MARKERS: OwnHistoryMarker[] = ['thread_settings_applied', 'task_started', 'turn_context'];

describe('spawn observations: migrated subagent rollouts', () => {
  it.each(MARKERS)('own history starting at %s: only the own spawn counts', async (marker) => {
    const observed = await observeSpec(migratedChild(marker));
    expect(observed.spawns.map((spawn) => spawn.spawnCallId)).toEqual(['call_ownSpawnAfter01']);
  });
});

describe('spawn observations: line pre-filter', () => {
  const fixtureFiles = (): string[] => [
    ...subagentFamily().map((spec) => writeLines(rolloutLines(spec))),
    ...MARKERS.map((marker) => writeLines(rolloutLines(migratedChild(marker)))),
    ...fs
      .readdirSync(SYNTHETIC)
      .filter((name) => name.endsWith('.jsonl'))
      .map((name) => path.join(SYNTHETIC, name)),
    ...fs
      .readdirSync(REAL_OBSERVED)
      .filter((name) => name.endsWith('.jsonl'))
      .map(realRollout),
  ];

  it('gives the same observations as reading every record, on every fixture', async () => {
    for (const filePath of fixtureFiles()) {
      expect(await observeFiltered(filePath), filePath).toEqual(await observeAll(filePath));
    }
  });

  it('gives the same observations when read incrementally from any line boundary', async () => {
    for (const spec of subagentFamily()) {
      const lines = rolloutLines(spec);
      const filePath = writeLines(lines);
      const whole = await observeAll(filePath);
      for (let split = 1; split < lines.length; split++) {
        const partialPath = writeLines(lines.slice(0, split));
        const collector = new SpawnObservationCollector();
        const next = await readSpawnObservations(partialPath, collector);
        fs.writeFileSync(partialPath, `${lines.join('\n')}\n`);
        await readSpawnObservations(partialPath, collector, next);
        expect(collector.observations(), `${spec.sessionId} split at ${split}`).toEqual(whole);
      }
    }
  });

  it('keeps every line that can carry a spawn record or move the history boundary', () => {
    const accepted = (line: object | string, lineNumber = 2): boolean =>
      mayCarrySpawnEvidence(
        Buffer.from(typeof line === 'string' ? line : JSON.stringify(line)),
        lineNumber
      );
    expect(accepted(spawnCall('call_x', 'x'))).toBe(true);
    expect(
      accepted(
        activity({
          thread: 't',
          turn: 't',
          id: 'call_x',
          kind: 'started',
          agentThreadId: 'c',
          agentPath: '/root/x',
        })
      )
    ).toBe(true);
    for (const type of ['session_meta', 'turn_context']) {
      expect(accepted({ timestamp: 't', type, payload: {} })).toBe(true);
    }
    for (const type of ['task_started', 'thread_settings_applied']) {
      expect(accepted({ timestamp: 't', type: 'event_msg', payload: { type } })).toBe(true);
    }
    // The first line is always read: legacy rollouts start with an untyped session_meta.
    expect(accepted({ id: 'legacy', timestamp: 't' }, 1)).toBe(true);
    expect(accepted({ timestamp: 't', type: 'event_msg', payload: { type: 'token_count' } })).toBe(
      false
    );
  });
});
