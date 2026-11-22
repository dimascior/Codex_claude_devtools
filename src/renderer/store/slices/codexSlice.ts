/**
 * Codex slice — Codex CLI sessions and the selected session's execution timeline.
 *
 * Holds:
 *  - the rollout listing ($CODEX_HOME/sessions), grouped by working directory
 *  - the selected session and whether selection follows the live rollout
 *  - the selected session's normalized detail (timeline + stats)
 *  - the selected session's relations to the sessions it spawned and the
 *    session that spawned it (resolved in the main process; the renderer
 *    only navigates by viewer session id)
 *
 * Detail refreshes pass the last fingerprint so unchanged rollouts cost one
 * stat() in the main process and no re-render here.
 */

import { api } from '@renderer/api';

import type { AppState } from '../types';
import type {
  AgentSessionDetail,
  AgentSessionList,
  AgentSessionRelation,
  AgentSessionRelations,
} from '@shared/types';
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
  /** Spawned-child and spawned-by relations of the selected session */
  codexRelations: AgentSessionRelations | null;
  /** Execution to bring into view once the selected session's timeline shows it */
  codexFocusExecutionId: string | null;

  openCodexTab: () => void;
  fetchCodexSessions: () => Promise<void>;
  /**
   * Select a session; a manual pick stops following unless it is the live
   * session. `focusExecutionId` asks the timeline to bring that execution into
   * view (and stops following).
   */
  selectCodexSession: (
    sessionId: string,
    options?: { manual?: boolean; focusExecutionId?: string }
  ) => void;
  setCodexFollowLive: (follow: boolean) => void;
  refreshCodexDetail: () => Promise<void>;
  refreshCodexRelations: () => Promise<void>;
  /** Open the session a resolved relation points to; does nothing for any other status */
  openCodexRelatedSession: (relation: AgentSessionRelation) => void;
  clearCodexFocusExecution: () => void;
}

/** Guards against out-of-order detail responses when the selection changes quickly. */
let detailRequestSeq = 0;
/** Same for relation responses. */
let relationsRequestSeq = 0;

/**
 * The session to follow: the live rollout, else the most recently written one.
 */
export function getCodexFollowTarget(list: AgentSessionList | null): string | null {
  return list?.liveSessionId ?? list?.latestSessionId ?? null;
}

/**
 * Where a relation navigates: the related session's viewer id, and for a
 * parent the spawn execution to bring into view. Only resolved relations
 * navigate; missing, ambiguous and unresolved ones have no target.
 */
export function getCodexRelationTarget(
  relation: AgentSessionRelation
): { sessionId: string; focusExecutionId?: string } | null {
  if (relation.status !== 'resolved' || !relation.relatedSessionId) {
    return null;
  }
  return {
    sessionId: relation.relatedSessionId,
    focusExecutionId: relation.kind === 'spawned_by' ? relation.executionId : undefined,
  };
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
  codexRelations: null,
  codexFocusExecutionId: null,

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
      const selectedId = state.codexSelectedSessionId;
      const selectedStillExists =
        selectedId !== null &&
        (list.sessions.some((session) => session.id === selectedId) ||
          // A session opened through a relation can be older than the listing's cap.
          (state.codexDetail?.session.id === selectedId && state.codexDetailError === null));

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

  selectCodexSession: (
    sessionId: string,
    options?: { manual?: boolean; focusExecutionId?: string }
  ): void => {
    const state = get();
    const focusExecutionId = options?.focusExecutionId ?? null;
    let followLive = state.codexFollowLive;
    if (focusExecutionId) {
      // Following would scroll away from the execution to focus.
      followLive = false;
    } else if (options?.manual) {
      followLive = sessionId === getCodexFollowTarget(state.codexSessions);
    }
    if (sessionId === state.codexSelectedSessionId) {
      set({
        codexFollowLive: followLive,
        ...(focusExecutionId ? { codexFocusExecutionId: focusExecutionId } : {}),
      });
      return;
    }
    set({
      codexSelectedSessionId: sessionId,
      codexFollowLive: followLive,
      codexDetail: null,
      codexDetailError: null,
      codexDetailLoading: true,
      codexRelations: null,
      codexFocusExecutionId: focusExecutionId,
    });
    // Relations after the detail: the main process then reuses the parsed records.
    void get()
      .refreshCodexDetail()
      .then(() => get().refreshCodexRelations());
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

  refreshCodexRelations: async (): Promise<void> => {
    const sessionId = get().codexSelectedSessionId;
    if (!sessionId) {
      return;
    }
    const requestId = ++relationsRequestSeq;
    let relations: AgentSessionRelations | null;
    try {
      relations = (await api.codex.getSessionRelations(sessionId)) ?? null;
    } catch {
      // No relations rather than stale navigation targets.
      relations = null;
    }
    if (requestId !== relationsRequestSeq || get().codexSelectedSessionId !== sessionId) {
      return;
    }
    // Relations are refreshed on every rollout change; skip identical results.
    if (JSON.stringify(relations) !== JSON.stringify(get().codexRelations)) {
      set({ codexRelations: relations });
    }
  },

  openCodexRelatedSession: (relation: AgentSessionRelation): void => {
    const target = getCodexRelationTarget(relation);
    if (!target) {
      return;
    }
    get().selectCodexSession(target.sessionId, {
      manual: true,
      focusExecutionId: target.focusExecutionId,
    });
  },

  clearCodexFocusExecution: (): void => {
    set({ codexFocusExecutionId: null });
  },
});
