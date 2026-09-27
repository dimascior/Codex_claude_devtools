/**
 * Codex slice — Codex CLI sessions and the selected session's execution timeline.
 *
 * Holds:
 *  - the rollout listing ($CODEX_HOME/sessions), grouped by working directory
 *  - the selected session and whether selection follows the live rollout
 *  - the selected session's normalized detail (timeline + stats)
 *
 * Detail refreshes pass the last fingerprint so unchanged rollouts cost one
 * stat() in the main process and no re-render here.
 */

import { api } from '@renderer/api';

import type { AppState } from '../types';
import type { AgentSessionDetail, AgentSessionList } from '@shared/types';
import type { StateCreator } from 'zustand';

export interface CodexSlice {
  codexSessions: AgentSessionList | null;
  codexSessionsLoading: boolean;
  codexSessionsError: string | null;
  codexSelectedSessionId: string | null;
  /** Keep the live (most recently written) rollout selected as rollouts change */
  codexFollowLive: boolean;
  codexDetail: AgentSessionDetail | null;
  codexDetailLoading: boolean;
  codexDetailError: string | null;

  openCodexTab: () => void;
  fetchCodexSessions: () => Promise<void>;
  /** Select a session; a manual pick stops following unless it is the live session */
  selectCodexSession: (sessionId: string, options?: { manual?: boolean }) => void;
  setCodexFollowLive: (follow: boolean) => void;
  refreshCodexDetail: () => Promise<void>;
}

/** Guards against out-of-order detail responses when the selection changes quickly. */
let detailRequestSeq = 0;

/**
 * The session to follow: the live rollout, else the most recently written one.
 */
export function getCodexFollowTarget(list: AgentSessionList | null): string | null {
  return list?.liveSessionId ?? list?.latestSessionId ?? null;
}

export const createCodexSlice: StateCreator<AppState, [], [], CodexSlice> = (set, get) => ({
  codexSessions: null,
  codexSessionsLoading: false,
  codexSessionsError: null,
  codexSelectedSessionId: null,
  codexFollowLive: true,
  codexDetail: null,
  codexDetailLoading: false,
  codexDetailError: null,

  openCodexTab: (): void => {
    const state = get();
    for (const pane of state.paneLayout.panes) {
      const existing = pane.tabs.find((tab) => tab.type === 'codex');
      if (existing) {
        state.setActiveTab(existing.id);
        return;
      }
    }
    state.openTab({ type: 'codex', label: 'Codex' });
  },

  fetchCodexSessions: async (): Promise<void> => {
    // Only show a loading state for the first load; refreshes swap in place.
    set((state) => ({
      codexSessionsLoading: state.codexSessions === null,
      codexSessionsError: null,
    }));
    try {
      const list = await api.codex.listSessions();
      set({ codexSessions: list, codexSessionsLoading: false });
      if (!list) {
        return;
      }

      const state = get();
      const target = getCodexFollowTarget(list);
      const selectedStillExists =
        state.codexSelectedSessionId !== null &&
        list.sessions.some((session) => session.id === state.codexSelectedSessionId);

      if ((state.codexFollowLive || !selectedStillExists) && target) {
        if (target !== state.codexSelectedSessionId) {
          state.selectCodexSession(target);
        }
      } else if (!selectedStillExists && state.codexSelectedSessionId !== null) {
        set({ codexSelectedSessionId: null, codexDetail: null });
      }
    } catch (error) {
      set({
        codexSessionsLoading: false,
        codexSessionsError:
          error instanceof Error ? error.message : 'Failed to list Codex sessions',
      });
    }
  },

  selectCodexSession: (sessionId: string, options?: { manual?: boolean }): void => {
    const state = get();
    const followLive = options?.manual
      ? sessionId === getCodexFollowTarget(state.codexSessions)
      : state.codexFollowLive;
    if (sessionId === state.codexSelectedSessionId) {
      set({ codexFollowLive: followLive });
      return;
    }
    set({
      codexSelectedSessionId: sessionId,
      codexFollowLive: followLive,
      codexDetail: null,
      codexDetailError: null,
      codexDetailLoading: true,
    });
    void get().refreshCodexDetail();
  },

  setCodexFollowLive: (follow: boolean): void => {
    set({ codexFollowLive: follow });
    if (!follow) {
      return;
    }
    const state = get();
    const target = getCodexFollowTarget(state.codexSessions);
    if (target && target !== state.codexSelectedSessionId) {
      state.selectCodexSession(target);
    }
  },

  refreshCodexDetail: async (): Promise<void> => {
    const { codexSelectedSessionId: sessionId, codexDetail } = get();
    if (!sessionId) {
      return;
    }
    const requestId = ++detailRequestSeq;
    const knownFingerprint =
      codexDetail?.session.id === sessionId ? codexDetail.fingerprint : undefined;
    try {
      const response = await api.codex.getSessionDetail(sessionId, knownFingerprint);
      if (requestId !== detailRequestSeq || get().codexSelectedSessionId !== sessionId) {
        return;
      }
      if (!response) {
        set({ codexDetailLoading: false, codexDetailError: 'Session not found' });
      } else if ('unchanged' in response) {
        set({ codexDetailLoading: false });
      } else {
        set({ codexDetail: response, codexDetailLoading: false, codexDetailError: null });
      }
    } catch (error) {
      if (requestId !== detailRequestSeq) {
        return;
      }
      set({
        codexDetailLoading: false,
        codexDetailError: error instanceof Error ? error.message : 'Failed to load session',
      });
    }
  },
});
