import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AgentSessionDetail,
  AgentSessionList,
  AgentSessionSummary,
} from '../../../src/main/domain';

const codexMock = {
  listSessions: vi.fn(),
  getSessionDetail: vi.fn(),
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
    },
    warnings: [],
    fingerprint,
  };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
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

  it('opens a single Codex tab', async () => {
    const { createTestStore } = await import('./storeTestUtils');
    const store = createTestStore();
    store.getState().openCodexTab();
    store.getState().openCodexTab();
    const tabs = store.getState().paneLayout.panes.flatMap((pane) => pane.tabs);
    expect(tabs.filter((tab) => tab.type === 'codex')).toHaveLength(1);
  });
});
