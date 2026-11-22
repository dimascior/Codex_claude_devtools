/**
 * Parent ↔ subagent session relations (CodexSessionService.getSessionRelations)
 * on a SYNTHETIC rollout family (test/fixtures/codex/subagentFamily.ts).
 *
 * The only accepted link is the explicit id chain: spawn_agent call id =
 * SubAgentActivity(started) id, whose agent_thread_id = the child rollout's
 * session_meta.id. The negative cases pin down that timing, agent paths,
 * generic activities, session_id and declared parent ids never relate
 * sessions on their own, and that unknown or ambiguous stays so.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CodexSessionService } from '../../../../src/main/providers/codex/CodexSessionService';
import {
  activity,
  CALLS,
  callOutput,
  childMeta,
  childRollout,
  lateChildRollout,
  lineOf,
  rootContinuationRollout,
  rootRollout,
  type RolloutSpec,
  SESSION_IDS,
  spawnCall,
  subagentFamily,
  THREADS,
  turnEnd,
  turnStart,
  uuidV7,
  writeRollouts,
} from '../../../fixtures/codex/subagentFamily';

import type { CodexWatchEvent } from '../../../../src/main/providers/codex/CodexSessionWatcher';
import type { AgentSessionRelations } from '@shared/types';

/** Files whose spawn records were read (the only way relations read rollout bodies). */
const spawnReads = vi.hoisted(() => ({ files: [] as string[] }));
vi.mock('../../../../src/main/providers/codex/CodexSpawnObservations', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../../src/main/providers/codex/CodexSpawnObservations')
    >();
  return {
    ...actual,
    readSpawnObservations: (...args: Parameters<typeof actual.readSpawnObservations>) => {
      spawnReads.files.push(path.basename(args[0]));
      return actual.readSpawnObservations(...args);
    },
  };
});

const tempDirs: string[] = [];
beforeEach(() => {
  spawnReads.files.length = 0;
});
afterEach(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

function sessionsWith(specs: readonly RolloutSpec[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-relations-'));
  tempDirs.push(dir);
  writeRollouts(dir, specs);
  return dir;
}

function serviceFor(sessionsDir: string): CodexSessionService {
  return new CodexSessionService({ sessionsDir, watch: false });
}

/** Deliver a watcher event as the real watcher would. */
function watchEvent(service: CodexSessionService, event: CodexWatchEvent): void {
  (service as unknown as { onWatchEvent(event: CodexWatchEvent): void }).onWatchEvent(event);
}

async function relationsOf(
  service: CodexSessionService,
  sessionId: string
): Promise<AgentSessionRelations> {
  const relations = await service.getSessionRelations(sessionId);
  if (!relations) throw new Error(`no relations for ${sessionId}`);
  return relations;
}

const byText = (a: string, b: string): number => a.localeCompare(b);

const itemId = (record: { payload: Record<string, unknown> }): unknown =>
  (record.payload.item as { id?: unknown } | undefined)?.id;

describe('session relations: the synthetic family', () => {
  it('parent → child: resolves each spawn call through its started activity', async () => {
    const service = serviceFor(sessionsWith(subagentFamily()));
    const root = rootRollout();
    const relations = await relationsOf(service, SESSION_IDS.root);

    expect(relations.threadId).toBe(THREADS.root);
    expect(relations.parent).toBeUndefined();
    expect(relations.children).toEqual([
      {
        kind: 'spawned_child',
        status: 'resolved',
        executionId: CALLS.spawnChild,
        relatedSessionId: SESSION_IDS.child,
        relatedThreadId: THREADS.child,
        related: {
          title: 'reviewer',
          titleSource: 'agent_task',
          agentNickname: 'Noether',
          agentRole: undefined,
        },
        evidence: {
          method: 'explicit_id_chain',
          callId: CALLS.spawnChild,
          callRecordType: 'function_call collaboration.spawn_agent',
          callLineNumber: lineOf(root, (r) => r.payload.call_id === CALLS.spawnChild),
          activityRecordType: 'item_completed/SubAgentActivity (started)',
          activityLineNumber: lineOf(root, (r) => itemId(r) === CALLS.spawnChild),
          childThreadId: THREADS.child,
          parentThreadId: THREADS.root,
          declaredParentThreadId: THREADS.root,
        },
      },
      expect.objectContaining({
        status: 'missing_session',
        executionId: CALLS.spawnMissing,
        relatedThreadId: THREADS.missing,
      }),
      expect.objectContaining({
        status: 'unresolved',
        executionId: CALLS.spawnUnconfirmed,
        reason: 'No SubAgentActivity "started" record carries this call id',
      }),
    ]);
    // Not navigable without a proven target.
    for (const child of relations.children.slice(1)) {
      expect(child.relatedSessionId).toBeUndefined();
    }
  });

  it('child → parent: resolves the spawn call in the parent rollout', async () => {
    const service = serviceFor(sessionsWith(subagentFamily()));
    const root = rootRollout();
    const relations = await relationsOf(service, SESSION_IDS.child);

    expect(relations.threadId).toBe(THREADS.child);
    expect(relations.parent).toEqual({
      kind: 'spawned_by',
      status: 'resolved',
      executionId: CALLS.spawnChild,
      relatedSessionId: SESSION_IDS.root,
      relatedThreadId: THREADS.root,
      related: expect.objectContaining({ title: 'Review the synthetic app with a helper agent.' }),
      evidence: {
        method: 'explicit_id_chain',
        callId: CALLS.spawnChild,
        callRecordType: 'function_call collaboration.spawn_agent',
        callLineNumber: lineOf(root, (r) => r.payload.call_id === CALLS.spawnChild),
        activityRecordType: 'item_completed/SubAgentActivity (started)',
        activityLineNumber: lineOf(root, (r) => itemId(r) === CALLS.spawnChild),
        childThreadId: THREADS.child,
        parentThreadId: THREADS.root,
        declaredParentThreadId: THREADS.root,
      },
    });
  });

  it("a subagent's inherited copy of its parent's spawn records relates nothing", async () => {
    // The child's prefix repeats the root's spawn call and started activity
    // for this very child; its own history spawns only the grandchild.
    const service = serviceFor(sessionsWith(subagentFamily()));
    const relations = await relationsOf(service, SESSION_IDS.child);
    expect(relations.children).toEqual([
      expect.objectContaining({
        status: 'resolved',
        executionId: CALLS.spawnGrandchild,
        relatedSessionId: SESSION_IDS.grandchild,
      }),
    ]);
  });

  it('child session_id alone is no edge: a depth-2 subagent resolves to its direct parent', async () => {
    // The grandchild's session_meta.session_id is the ROOT's thread; its
    // parent is the child, whose rollout holds the spawn chain.
    const service = serviceFor(sessionsWith(subagentFamily()));
    const relations = await relationsOf(service, SESSION_IDS.grandchild);
    expect(relations.parent).toMatchObject({
      status: 'resolved',
      relatedSessionId: SESSION_IDS.child,
      executionId: CALLS.spawnGrandchild,
    });

    // Without the direct parent's rollout, the root (session_id) is not used instead.
    const withoutChild = serviceFor(
      sessionsWith(subagentFamily().filter((spec) => spec.sessionId !== SESSION_IDS.child))
    );
    const orphan = (await relationsOf(withoutChild, SESSION_IDS.grandchild)).parent;
    expect(orphan?.status).toBe('missing_session');
    expect(orphan?.relatedSessionId).toBeUndefined();
  });

  it('a parent thread continued in a second file: the file holding the chain is the parent', async () => {
    const service = serviceFor(sessionsWith(subagentFamily()));
    expect((await relationsOf(service, SESSION_IDS.lateChild)).parent).toMatchObject({
      status: 'resolved',
      relatedSessionId: SESSION_IDS.rootContinuation,
      executionId: CALLS.spawnLateChild,
    });
    // The first file of the same thread does not hold the child's spawn.
    expect((await relationsOf(service, SESSION_IDS.child)).parent?.relatedSessionId).toBe(
      SESSION_IDS.root
    );
    expect((await relationsOf(service, SESSION_IDS.rootContinuation)).children).toEqual([
      expect.objectContaining({ status: 'resolved', relatedSessionId: SESSION_IDS.lateChild }),
    ]);
  });
});

describe('session relations: cost', () => {
  const name = (sessionId: string): string => path.basename(sessionId);

  it('listing sessions reads no spawn records', async () => {
    const service = serviceFor(sessionsWith(subagentFamily()));
    expect((await service.listSessions()).sessions).toHaveLength(5);
    expect(spawnReads.files).toEqual([]);
  });

  it('a parent opened after its detail reuses the parsed records', async () => {
    const service = serviceFor(sessionsWith(subagentFamily()));
    await service.getSessionDetail(SESSION_IDS.root);
    const relations = await relationsOf(service, SESSION_IDS.root);
    expect(relations.children[0]).toMatchObject({ status: 'resolved' });
    // Children are resolved from file names and heads, never from their bodies.
    expect(spawnReads.files).toEqual([]);
  });

  it('a child reads spawn records of its own file and its declared parent thread only', async () => {
    const service = serviceFor(sessionsWith(subagentFamily()));
    await relationsOf(service, SESSION_IDS.lateChild);
    expect([...spawnReads.files].sort(byText)).toEqual(
      [SESSION_IDS.lateChild, SESSION_IDS.root, SESSION_IDS.rootContinuation].map(name).sort(byText)
    );
  });

  it('repeated requests read nothing while the files are unchanged', async () => {
    const service = serviceFor(sessionsWith(subagentFamily()));
    const first = await relationsOf(service, SESSION_IDS.child);
    spawnReads.files.length = 0;
    expect(await relationsOf(service, SESSION_IDS.child)).toEqual(first);
    expect(spawnReads.files).toEqual([]);
  });
});

describe('session relations: ambiguity and missing records stay visible', () => {
  it('several rollouts of the child thread: ambiguous, no candidate chosen', async () => {
    const duplicate: RolloutSpec = {
      ...childRollout(),
      sessionId: `2026/09/22/rollout-2026-09-22T08-00-00-${THREADS.child}_${uuidV7(Date.UTC(2026, 8, 22), 1)}.jsonl`,
    };
    const service = serviceFor(sessionsWith([...subagentFamily(), duplicate]));
    const [child] = (await relationsOf(service, SESSION_IDS.root)).children;
    expect(child).toMatchObject({
      status: 'ambiguous',
      relatedThreadId: THREADS.child,
      candidateSessionIds: [SESSION_IDS.child, duplicate.sessionId].sort(byText),
    });
    expect(child.relatedSessionId).toBeUndefined();
  });

  it('a rollout named for the child thread without a readable session_meta: not unique', async () => {
    const dir = sessionsWith(subagentFamily());
    const corrupt = `2026/09/22/rollout-2026-09-22T08-00-00-${THREADS.child}_${uuidV7(Date.UTC(2026, 8, 22), 2)}.jsonl`;
    fs.mkdirSync(path.join(dir, '2026/09/22'), { recursive: true });
    fs.writeFileSync(path.join(dir, ...corrupt.split('/')), 'not json\n');
    const [child] = (await relationsOf(serviceFor(dir), SESSION_IDS.root)).children;
    expect(child).toMatchObject({
      status: 'ambiguous',
      candidateSessionIds: [SESSION_IDS.child, corrupt].sort(byText),
    });
  });

  it('a rollout named for the child thread that records another thread does not count', async () => {
    const impostor: RolloutSpec = {
      ...lateChildRollout(),
      sessionId: `2026/09/22/rollout-2026-09-22T08-00-00-${THREADS.child}_${uuidV7(Date.UTC(2026, 8, 22), 3)}.jsonl`,
    };
    const service = serviceFor(sessionsWith([...subagentFamily(), impostor]));
    const [child] = (await relationsOf(service, SESSION_IDS.root)).children;
    expect(child).toMatchObject({ status: 'resolved', relatedSessionId: SESSION_IDS.child });
  });

  it('started activities naming two threads for one call: ambiguous', async () => {
    const root = rootRollout();
    const at = root.records.findIndex((record) => itemId(record) === CALLS.spawnChild);
    root.records.splice(
      at + 1,
      0,
      activity({
        thread: THREADS.root,
        turn: String(root.records[1].payload.turn_id),
        id: CALLS.spawnChild,
        kind: 'started',
        agentThreadId: THREADS.grandchild,
        agentPath: '/root/reviewer',
      })
    );
    const service = serviceFor(
      sessionsWith([root, ...subagentFamily().filter((s) => s.sessionId !== SESSION_IDS.root)])
    );
    const [child] = (await relationsOf(service, SESSION_IDS.root)).children;
    expect(child).toMatchObject({
      status: 'ambiguous',
      candidateThreadIds: [THREADS.child, THREADS.grandchild],
    });
    expect(child.relatedSessionId).toBeUndefined();
    // The child cannot claim this call as its unique spawn either.
    expect((await relationsOf(service, SESSION_IDS.child)).parent).toMatchObject({
      status: 'ambiguous',
      candidateSessionIds: [SESSION_IDS.root],
    });
  });

  it('two parent rollouts that both prove the spawn: ambiguous', async () => {
    const original = rootRollout();
    const copy = rootContinuationRollout();
    // The first file of the thread also records the late child's spawn chain.
    original.records.splice(
      original.records.length - 1,
      0,
      spawnCall(CALLS.spawnLateChild, 'fixer'),
      activity({
        thread: THREADS.root,
        turn: String(original.records[1].payload.turn_id),
        id: CALLS.spawnLateChild,
        kind: 'started',
        agentThreadId: THREADS.lateChild,
        agentPath: '/root/fixer',
      })
    );
    const service = serviceFor(
      sessionsWith([
        original,
        copy,
        ...subagentFamily().filter(
          (s) => s.sessionId !== SESSION_IDS.root && s.sessionId !== SESSION_IDS.rootContinuation
        ),
      ])
    );
    const parent = (await relationsOf(service, SESSION_IDS.lateChild)).parent;
    expect(parent).toMatchObject({
      status: 'ambiguous',
      candidateSessionIds: [SESSION_IDS.root, SESSION_IDS.rootContinuation].sort(byText),
    });
    expect(parent?.relatedSessionId).toBeUndefined();
    expect(parent?.executionId).toBeUndefined();
  });

  it('declared parent thread without a rollout: missing_session', async () => {
    const service = serviceFor(
      sessionsWith(
        subagentFamily().filter(
          (spec) =>
            spec.sessionId !== SESSION_IDS.root && spec.sessionId !== SESSION_IDS.rootContinuation
        )
      )
    );
    expect((await relationsOf(service, SESSION_IDS.child)).parent).toMatchObject({
      status: 'missing_session',
      evidence: { declaredParentThreadId: THREADS.root },
    });
  });

  it('only another rollout of the parent thread present: it does not prove the spawn', async () => {
    const service = serviceFor(
      sessionsWith(subagentFamily().filter((spec) => spec.sessionId !== SESSION_IDS.root))
    );
    const parent = (await relationsOf(service, SESSION_IDS.child)).parent;
    expect(parent?.status).toBe('unresolved');
    expect(parent?.relatedSessionId).toBeUndefined();
    expect(parent?.reason).toContain('None of the 1 rollout(s) of the declared parent thread');
  });
});

describe('session relations: what is never evidence', () => {
  /** A subagent that declares the root as parent but that no started activity names. */
  function strayChild(options: { threadMs: number; agentPath: string }): RolloutSpec {
    const threadId = uuidV7(options.threadMs, 0x77);
    const turn = uuidV7(options.threadMs + 500, 0x78);
    return {
      sessionId: `2026/09/20/rollout-2026-09-20T10-00-${String(Math.round((options.threadMs - Date.UTC(2026, 8, 20, 10)) / 1000)).padStart(2, '0')}-${threadId}.jsonl`,
      startMs: options.threadMs,
      records: [
        childMeta({
          threadId,
          parent: THREADS.root,
          root: THREADS.root,
          nickname: 'Stray',
          agentPath: options.agentPath,
        }),
        ...turnStart(turn),
        turnEnd(turn),
      ],
    };
  }

  it('declared parent thread alone: the parent file exists but proves nothing → unresolved', async () => {
    const stray = strayChild({
      threadMs: Date.UTC(2026, 8, 20, 10, 0, 30),
      agentPath: '/root/stray',
    });
    const service = serviceFor(sessionsWith([...subagentFamily(), stray]));
    const parent = (await relationsOf(service, stray.sessionId)).parent;
    expect(parent).toMatchObject({
      status: 'unresolved',
      evidence: { declaredParentThreadId: THREADS.root },
    });
    expect(parent?.relatedSessionId).toBeUndefined();
    expect(parent?.reason).toContain('None of the 2 rollout(s) of the declared parent thread');
  });

  it('timing alone: a child that starts right after an unconfirmed spawn call is not its child', async () => {
    // The unconfirmed spawn call is at line ~20 of the root (≈ 2 s after the
    // file start); this stray starts 100 ms later with a matching agent path.
    const root = rootRollout();
    const callLine = lineOf(root, (r) => r.payload.call_id === CALLS.spawnUnconfirmed);
    const stray = strayChild({
      threadMs: root.startMs + callLine * 100 + 100,
      agentPath: '/root/writer',
    });
    const service = serviceFor(sessionsWith([...subagentFamily(), stray]));
    const children = (await relationsOf(service, SESSION_IDS.root)).children;
    const unconfirmed = children.find((child) => child.executionId === CALLS.spawnUnconfirmed);
    expect(unconfirmed).toMatchObject({ status: 'unresolved' });
    expect(unconfirmed?.relatedSessionId).toBeUndefined();
    expect(children.some((child) => child.relatedSessionId === stray.sessionId)).toBe(false);
    expect((await relationsOf(service, stray.sessionId)).parent?.status).toBe('unresolved');
  });

  it('agent path alone: a started item for another call with the same path relates nothing', async () => {
    const root = rootRollout();
    const stray = strayChild({
      threadMs: Date.UTC(2026, 8, 20, 10, 0, 40),
      agentPath: '/root/writer',
    });
    // A started item whose path matches the unconfirmed spawn's task, but whose id is another call's.
    root.records.splice(
      root.records.length - 1,
      0,
      activity({
        thread: THREADS.root,
        turn: String(root.records[1].payload.turn_id),
        id: 'call_someOtherCall9',
        kind: 'started',
        agentThreadId: stray.records[0].payload.id as string,
        agentPath: '/root/writer',
      })
    );
    const service = serviceFor(
      sessionsWith([
        root,
        stray,
        ...subagentFamily().filter((s) => s.sessionId !== SESSION_IDS.root),
      ])
    );
    const children = (await relationsOf(service, SESSION_IDS.root)).children;
    expect(children.find((c) => c.executionId === CALLS.spawnUnconfirmed)?.status).toBe(
      'unresolved'
    );
    expect(children.some((c) => c.relatedSessionId === stray.sessionId)).toBe(false);
    expect((await relationsOf(service, stray.sessionId)).parent?.status).toBe('unresolved');
  });

  it('generic activities naming a thread (interacted, completed) create no edge', async () => {
    // The root records an interacted item (send_message call id) and a
    // completed item that both name the child thread; only the spawn relates.
    const service = serviceFor(sessionsWith(subagentFamily()));
    const children = (await relationsOf(service, SESSION_IDS.root)).children;
    expect(children.map((child) => child.executionId)).toEqual([
      CALLS.spawnChild,
      CALLS.spawnMissing,
      CALLS.spawnUnconfirmed,
    ]);
    expect(children.filter((child) => child.relatedSessionId === SESSION_IDS.child)).toHaveLength(
      1
    );
  });

  it('a fork (forked_from_id only) is not a spawned subagent', async () => {
    const forkThread = uuidV7(Date.UTC(2026, 8, 20, 11), 0x55);
    const turn = uuidV7(Date.UTC(2026, 8, 20, 11, 0, 1), 0x56);
    const fork: RolloutSpec = {
      sessionId: `2026/09/20/rollout-2026-09-20T11-00-00-${forkThread}.jsonl`,
      startMs: Date.UTC(2026, 8, 20, 11),
      records: [
        {
          type: 'session_meta',
          payload: {
            id: forkThread,
            session_id: forkThread,
            forked_from_id: THREADS.root,
            source: 'cli',
          },
        },
        ...turnStart(turn),
        turnEnd(turn),
      ],
    };
    const service = serviceFor(sessionsWith([...subagentFamily(), fork]));
    expect((await relationsOf(service, fork.sessionId)).parent).toBeUndefined();
  });
});

describe('session relations: live changes', () => {
  it('a missing child becomes navigable once its rollout appears (watcher add)', async () => {
    const dir = sessionsWith(subagentFamily());
    const service = serviceFor(dir);
    const missing = () =>
      relationsOf(service, SESSION_IDS.root).then((r) =>
        r.children.find((child) => child.executionId === CALLS.spawnMissing)
      );
    expect(await missing()).toMatchObject({ status: 'missing_session' });

    const threadMs = Date.UTC(2026, 8, 20, 10, 0, 12);
    const turn = uuidV7(threadMs + 500, 0x66);
    writeRollouts(dir, [
      {
        sessionId: SESSION_IDS.missing,
        startMs: threadMs,
        records: [
          childMeta({
            threadId: THREADS.missing,
            parent: THREADS.root,
            root: THREADS.root,
            nickname: 'Turing',
            agentPath: '/root/tester',
          }),
          ...turnStart(turn),
        ],
      },
    ]);
    watchEvent(service, { type: 'add', sessionId: SESSION_IDS.missing });
    expect(await missing()).toMatchObject({
      status: 'resolved',
      relatedSessionId: SESSION_IDS.missing,
      related: { agentNickname: 'Turing' },
    });
    expect((await relationsOf(service, SESSION_IDS.missing)).parent).toMatchObject({
      status: 'resolved',
      relatedSessionId: SESSION_IDS.root,
      executionId: CALLS.spawnMissing,
    });
  });

  it('a deleted child is no longer a navigation target (watcher unlink)', async () => {
    const dir = sessionsWith(subagentFamily());
    const service = serviceFor(dir);
    expect((await relationsOf(service, SESSION_IDS.root)).children[0]).toMatchObject({
      status: 'resolved',
      relatedSessionId: SESSION_IDS.child,
    });
    fs.rmSync(path.join(dir, ...SESSION_IDS.child.split('/')));
    watchEvent(service, { type: 'unlink', sessionId: SESSION_IDS.child });
    const [child] = (await relationsOf(service, SESSION_IDS.root)).children;
    expect(child).toMatchObject({ status: 'missing_session', relatedThreadId: THREADS.child });
    expect(child.relatedSessionId).toBeUndefined();
    expect(await service.getSessionRelations(SESSION_IDS.child)).toBeNull();
  });

  it('a spawn appended to a live parent is picked up incrementally', async () => {
    const dir = sessionsWith(subagentFamily());
    const service = serviceFor(dir);
    expect((await relationsOf(service, SESSION_IDS.rootContinuation)).children).toHaveLength(1);

    const turn = uuidV7(Date.UTC(2026, 8, 21, 10, 5), 0x42);
    const appended = [
      ...turnStart(turn),
      spawnCall('call_appendedSpawn1', 'extra'),
      activity({
        thread: THREADS.root,
        turn,
        id: 'call_appendedSpawn1',
        kind: 'started',
        agentThreadId: THREADS.child,
        agentPath: '/root/extra',
      }),
      callOutput('call_appendedSpawn1', '{}'),
    ];
    const filePath = path.join(dir, ...SESSION_IDS.rootContinuation.split('/'));
    const existing = fs.readFileSync(filePath, 'utf8').trimEnd().split('\n').length;
    fs.appendFileSync(
      filePath,
      `${appended
        .map((record, index) =>
          JSON.stringify({
            timestamp: '2026-09-21T10:05:00.000Z',
            ...record,
            ordinal: existing + index,
          })
        )
        .join('\n')}\n`
    );
    const children = (await relationsOf(service, SESSION_IDS.rootContinuation)).children;
    expect(
      children.map((child) => [child.executionId, child.status, child.evidence.callLineNumber])
    ).toEqual([
      [CALLS.spawnLateChild, 'resolved', expect.any(Number)],
      ['call_appendedSpawn1', 'resolved', existing + 3],
    ]);
  });

  it('uses the records the detail view already parsed, with the same result', async () => {
    const dir = sessionsWith(subagentFamily());
    const fresh = await relationsOf(serviceFor(dir), SESSION_IDS.root);
    const service = serviceFor(dir);
    await service.getSessionDetail(SESSION_IDS.root);
    expect(await relationsOf(service, SESSION_IDS.root)).toEqual(fresh);
  });

  it('returns null for unknown or invalid session ids', async () => {
    const service = serviceFor(sessionsWith(subagentFamily()));
    expect(
      await service.getSessionRelations('2026/09/20/rollout-2026-09-20T10-00-00-nope.jsonl')
    ).toBeNull();
    expect(await service.getSessionRelations('../outside.jsonl')).toBeNull();
  });
});
