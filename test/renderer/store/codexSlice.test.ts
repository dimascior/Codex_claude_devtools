import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AgentSessionDetail,
  AgentSessionList,
  AgentSessionRelation,
  AgentSessionRelations,
  AgentSessionSummary,
} from '../../../src/main/domain';

const codexMock = {
  listSessions: vi.fn(),
  getSessionDetail: vi.fn(),
  getSessionRelations: vi.fn(),
  onSessionChange: vi.fn(),
};

vi.mock('@renderer/api', () => ({
  api: { codex: codexMock },
  isElectronMode: () => true,
}));

function summary(id: string, overrides: Partial<AgentSessionSummary> = {}): AgentSessionSummary {
  return {
    id,
    provider: 'codex',
    filePath: `/codex/sessions/${id}`,
    projectKey: '/work/app',
    projectName: 'app',
    updatedAt: 1,
    sizeBytes: 10,
    compressed: false,
    isLive: false,
    ...overrides,
  };
}

function list(sessions: AgentSessionSummary[], liveSessionId: string | null): AgentSessionList {
  return {
    provider: 'codex',
    rootDir: '/codex/sessions',
    rootExists: true,
    sessions,
    projects: [],
    totalFiles: sessions.length,
    liveSessionId,
    latestSessionId: sessions[0]?.id ?? null,
    compressedSupported: true,
    scannedAt: 0,
  };
}

function detail(id: string, fingerprint: string): AgentSessionDetail {
  return {
    session: summary(id),
    timeline: [],
    stats: {
      total: 0,
      commands: 0,
      nested: 0,
      failed: 0,
      running: 0,
      declined: 0,
      interrupted: 0,
      byKind: {},
      filesWritten: 0,
      commandActions: {},
    },
    warnings: [],
    fingerprint,
  };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function childRelation(overrides: Partial<AgentSessionRelation> = {}): AgentSessionRelation {
  return {
    kind: 'spawned_child',
    status: 'resolved',
    executionId: 'call_spawn',
    relatedSessionId: 'child.jsonl',
    relatedThreadId: 'thread-child',
    evidence: { method: 'explicit_id_chain', callId: 'call_spawn' },
    ...overrides,
  };
}

function relationsFor(
  sessionId: string,
  children: AgentSessionRelation[] = [],
  parent?: AgentSessionRelation
): AgentSessionRelations {
  return { sessionId, children, parent };
}

describe('codexSlice', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('auto-selects the live rollout on first load', async () => {
    const { createTestStore } = await import('./storeTestUtils');
    codexMock.listSessions.mockResolvedValue(
      list([summary('live.jsonl', { isLive: true }), summary('old.jsonl')], 'live.jsonl')
    );
    codexMock.getSessionDetail.mockResolvedValue(detail('live.jsonl', 'f1'));

    const store = createTestStore();
    await store.getState().fetchCodexSessions();
    await flush();

    const state = store.getState();
    expect(state.codexSelectedSessionId).toBe('live.jsonl');
    expect(state.codexDetail?.fingerprint).toBe('f1');
    expect(state.codexFollowLive).toBe(true);
    expect(codexMock.getSessionDetail).toHaveBeenCalledWith('live.jsonl', undefined);
  });

  it('falls back to the latest rollout when none is live', async () => {
    const { createTestStore } = await import('./storeTestUtils');
    codexMock.listSessions.mockResolvedValue(list([summary('latest.jsonl')], null));
    codexMock.getSessionDetail.mockResolvedValue(detail('latest.jsonl', 'f1'));

    const store = createTestStore();
    await store.getState().fetchCodexSessions();
    await flush();
    expect(store.getState().codexSelectedSessionId).toBe('latest.jsonl');
  });

  it('stops following on a manual pick and switches to a new live rollout when following', async () => {
    const { createTestStore } = await import('./storeTestUtils');
    codexMock.listSessions.mockResolvedValue(
      list([summary('a.jsonl', { isLive: true }), summary('b.jsonl')], 'a.jsonl')
    );
    codexMock.getSessionDetail.mockImplementation((id: string) =>
      Promise.resolve(detail(id, `fp-${id}`))
    );

    const store = createTestStore();
    await store.getState().fetchCodexSessions();
    await flush();

    store.getState().selectCodexSession('b.jsonl', { manual: true });
    await flush();
    expect(store.getState().codexSelectedSessionId).toBe('b.jsonl');
    expect(store.getState().codexFollowLive).toBe(false);

    // A new rollout starts: not followed while the user is browsing b.
    codexMock.listSessions.mockResolvedValue(
      list(
        [summary('c.jsonl', { isLive: true }), summary('a.jsonl'), summary('b.jsonl')],
        'c.jsonl'
      )
    );
    await store.getState().fetchCodexSessions();
    await flush();
    expect(store.getState().codexSelectedSessionId).toBe('b.jsonl');

    // Re-enabling follow jumps to the live rollout.
    store.getState().setCodexFollowLive(true);
    await flush();
    expect(store.getState().codexSelectedSessionId).toBe('c.jsonl');
    expect(store.getState().codexDetail?.fingerprint).toBe('fp-c.jsonl');
  });

  it('keeps the current detail when the fingerprint is unchanged', async () => {
    const { createTestStore } = await import('./storeTestUtils');
    codexMock.listSessions.mockResolvedValue(
      list([summary('a.jsonl', { isLive: true })], 'a.jsonl')
    );
    codexMock.getSessionDetail.mockResolvedValueOnce(detail('a.jsonl', 'f1'));

    const store = createTestStore();
    await store.getState().fetchCodexSessions();
    await flush();
    const before = store.getState().codexDetail;

    codexMock.getSessionDetail.mockResolvedValueOnce({ unchanged: true, fingerprint: 'f1' });
    await store.getState().refreshCodexDetail();
    expect(codexMock.getSessionDetail).toHaveBeenLastCalledWith('a.jsonl', 'f1');
    expect(store.getState().codexDetail).toBe(before);
  });

  it('ignores a stale response after the selection changed', async () => {
    const { createTestStore } = await import('./storeTestUtils');
    let resolveSlow: (value: AgentSessionDetail) => void = () => {};
    codexMock.getSessionDetail.mockImplementation((id: string) =>
      id === 'slow.jsonl'
        ? new Promise<AgentSessionDetail>((resolve) => {
            resolveSlow = resolve;
          })
        : Promise.resolve(detail(id, 'fast'))
    );

    const store = createTestStore();
    store.getState().selectCodexSession('slow.jsonl', { manual: true });
    store.getState().selectCodexSession('fast.jsonl', { manual: true });
    await flush();
    resolveSlow(detail('slow.jsonl', 'slow'));
    await flush();

    expect(store.getState().codexSelectedSessionId).toBe('fast.jsonl');
    expect(store.getState().codexDetail?.session.id).toBe('fast.jsonl');
  });

  it('loads the relations of a selected session after its detail', async () => {
    const { createTestStore } = await import('./storeTestUtils');
    codexMock.getSessionDetail.mockImplementation((id: string) => Promise.resolve(detail(id, 'f')));
    codexMock.getSessionRelations.mockImplementation((id: string) =>
      Promise.resolve(relationsFor(id, [childRelation()]))
    );

    const store = createTestStore();
    store.getState().selectCodexSession('parent.jsonl', { manual: true });
    await flush();

    expect(codexMock.getSessionRelations).toHaveBeenCalledWith('parent.jsonl');
    expect(codexMock.getSessionDetail.mock.invocationCallOrder[0]).toBeLessThan(
      codexMock.getSessionRelations.mock.invocationCallOrder[0]
    );
    expect(store.getState().codexRelations?.children).toEqual([childRelation()]);
  });

  it('navigates only through resolved relations, by viewer session id', async () => {
    const { createTestStore } = await import('./storeTestUtils');
    codexMock.getSessionDetail.mockImplementation((id: string) => Promise.resolve(detail(id, 'f')));
    codexMock.getSessionRelations.mockResolvedValue(null);
    const store = createTestStore();
    store.getState().selectCodexSession('parent.jsonl', { manual: true });
    await flush();

    for (const status of ['missing_session', 'ambiguous', 'unresolved'] as const) {
      store
        .getState()
        .openCodexRelatedSession(childRelation({ status, relatedSessionId: undefined }));
      // A relatedSessionId without a resolved status is not a target either.
      store.getState().openCodexRelatedSession(childRelation({ status }));
    }
    expect(store.getState().codexSelectedSessionId).toBe('parent.jsonl');

    store.getState().openCodexRelatedSession(childRelation());
    expect(store.getState().codexSelectedSessionId).toBe('child.jsonl');
    expect(store.getState().codexFocusExecutionId).toBeNull();

    store.getState().openCodexRelatedSession({
      kind: 'spawned_by',
      status: 'resolved',
      executionId: 'call_spawn',
      relatedSessionId: 'parent.jsonl',
      evidence: { method: 'explicit_id_chain', callId: 'call_spawn' },
    });
    expect(store.getState().codexSelectedSessionId).toBe('parent.jsonl');
    expect(store.getState().codexFocusExecutionId).toBe('call_spawn');
    expect(store.getState().codexFollowLive).toBe(false);
    store.getState().clearCodexFocusExecution();
    expect(store.getState().codexFocusExecutionId).toBeNull();
  });

  it('ignores relations of a previous selection', async () => {
    const { createTestStore } = await import('./storeTestUtils');
    const slow: { resolve?: (value: AgentSessionRelations) => void } = {};
    codexMock.getSessionDetail.mockImplementation((id: string) => Promise.resolve(detail(id, 'f')));
    codexMock.getSessionRelations.mockImplementation((id: string) =>
      id === 'slow.jsonl'
        ? new Promise<AgentSessionRelations>((resolve) => {
            slow.resolve = resolve;
          })
        : Promise.resolve(relationsFor(id))
    );

    const store = createTestStore();
    store.getState().selectCodexSession('slow.jsonl', { manual: true });
    await flush();
    store.getState().selectCodexSession('fast.jsonl', { manual: true });
    await flush();
    slow.resolve?.(relationsFor('slow.jsonl', [childRelation()]));
    await flush();

    expect(store.getState().codexRelations).toEqual(relationsFor('fast.jsonl'));
  });

  it('drops a stale target when refreshed relations no longer resolve it', async () => {
    const { createTestStore } = await import('./storeTestUtils');
    codexMock.getSessionDetail.mockImplementation((id: string) => Promise.resolve(detail(id, 'f')));
    codexMock.getSessionRelations.mockResolvedValue(
      relationsFor('parent.jsonl', [childRelation()])
    );
    const store = createTestStore();
    store.getState().selectCodexSession('parent.jsonl', { manual: true });
    await flush();
    const before = store.getState().codexRelations;

    // Unchanged relations keep the same object (no re-render).
    await store.getState().refreshCodexRelations();
    expect(store.getState().codexRelations).toBe(before);

    // The child's rollout was deleted.
    const missing = childRelation({ status: 'missing_session', relatedSessionId: undefined });
    codexMock.getSessionRelations.mockResolvedValue(relationsFor('parent.jsonl', [missing]));
    await store.getState().refreshCodexRelations();
    expect(store.getState().codexRelations?.children).toEqual([missing]);
    store.getState().openCodexRelatedSession(missing);
    expect(store.getState().codexSelectedSessionId).toBe('parent.jsonl');
  });

  it('keeps a session opened through a relation selected when the listing omits it', async () => {
    const { createTestStore } = await import('./storeTestUtils');
    codexMock.listSessions.mockResolvedValue(list([summary('recent.jsonl')], null));
    codexMock.getSessionDetail.mockImplementation((id: string) => Promise.resolve(detail(id, 'f')));
    codexMock.getSessionRelations.mockResolvedValue(null);
    const store = createTestStore();
    await store.getState().fetchCodexSessions();
    await flush();

    // An older parent beyond the listing's cap, opened from its child.
    store.getState().openCodexRelatedSession({
      kind: 'spawned_by',
      status: 'resolved',
      executionId: 'call_spawn',
      relatedSessionId: 'old-parent.jsonl',
      evidence: { method: 'explicit_id_chain' },
    });
    await flush();
    await store.getState().fetchCodexSessions();
    await flush();
    expect(store.getState().codexSelectedSessionId).toBe('old-parent.jsonl');

    // Once its detail can no longer be read, the listing's session takes over.
    codexMock.getSessionDetail.mockResolvedValue(null);
    await store.getState().refreshCodexDetail();
    await store.getState().fetchCodexSessions();
    await flush();
    expect(store.getState().codexSelectedSessionId).toBe('recent.jsonl');
  });

  it('opens a single Codex tab', async () => {
    const { createTestStore } = await import('./storeTestUtils');
    const store = createTestStore();
    store.getState().openCodexTab();
    store.getState().openCodexTab();
    const tabs = store.getState().paneLayout.panes.flatMap((pane) => pane.tabs);
    expect(tabs.filter((tab) => tab.type === 'codex')).toHaveLength(1);
  });
});
