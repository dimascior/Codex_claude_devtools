/**
 * CodexView - Codex CLI sessions as execution timelines.
 *
 * Left: rollouts from $CODEX_HOME/sessions grouped by working directory.
 * Right: the selected rollout's requests, reasoning summaries and every tool
 * call with its output, in chronological order. The live rollout is selected
 * automatically and followed as Codex writes to it. Spawn executions link to
 * the subagent sessions they started and subagent sessions to their parent's
 * spawn call; both are opened by viewer session id.
 */

import { useCallback, useEffect, useState } from 'react';

import { COLOR_TEXT_MUTED } from '@renderer/constants/cssVariables';
import { useStore } from '@renderer/store';
import { LoaderCircle, SquareTerminal } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import { CodexSessionHeader } from './CodexSessionHeader';
import { CodexSessionList } from './CodexSessionList';
import { CodexTimeline } from './CodexTimeline';

import type { CodexTimelineFilter } from './codexFormatting';
import type { AgentSessionRelation } from '@shared/types';

/** Periodic refresh so live/idle state updates even when nothing is written. */
const PERIODIC_REFRESH_MS = 30_000;

const NO_RELATIONS: readonly AgentSessionRelation[] = [];

export const CodexView = (): React.JSX.Element => {
  const {
    detail,
    detailLoading,
    detailError,
    selectedId,
    followLive,
    relations,
    focusExecutionId,
    fetchCodexSessions,
    refreshCodexDetail,
    refreshCodexRelations,
    openCodexRelatedSession,
    clearCodexFocusExecution,
  } = useStore(
    useShallow((s) => ({
      detail: s.codexDetail,
      detailLoading: s.codexDetailLoading,
      detailError: s.codexDetailError,
      selectedId: s.codexSelectedSessionId,
      followLive: s.codexFollowLive,
      relations: s.codexRelations,
      focusExecutionId: s.codexFocusExecutionId,
      fetchCodexSessions: s.fetchCodexSessions,
      refreshCodexDetail: s.refreshCodexDetail,
      refreshCodexRelations: s.refreshCodexRelations,
      openCodexRelatedSession: s.openCodexRelatedSession,
      clearCodexFocusExecution: s.clearCodexFocusExecution,
    }))
  );
  const [filter, setFilter] = useState<CodexTimelineFilter>('all');

  useEffect(() => {
    void fetchCodexSessions();
    const timer = setInterval(() => {
      void fetchCodexSessions();
      void refreshCodexDetail().then(() => refreshCodexRelations());
    }, PERIODIC_REFRESH_MS);
    return (): void => clearInterval(timer);
  }, [fetchCodexSessions, refreshCodexDetail, refreshCodexRelations]);

  const openRelated = useCallback(
    (relation: AgentSessionRelation): void => {
      // The parent opens at its spawn call, which the current filter might hide.
      if (relation.kind === 'spawned_by' && relation.status === 'resolved') {
        setFilter('all');
      }
      openCodexRelatedSession(relation);
    },
    [openCodexRelatedSession]
  );

  const showDetail = detail !== null && detail.session.id === selectedId;
  const sessionRelations =
    showDetail && relations?.sessionId === detail.session.id ? relations : null;

  return (
    <div
      className="flex flex-1 overflow-hidden"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      <CodexSessionList />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {showDetail ? (
          <>
            <CodexSessionHeader
              detail={detail}
              filter={filter}
              onFilterChange={setFilter}
              parentRelation={sessionRelations?.parent}
              onOpenRelated={openRelated}
            />
            <CodexTimeline
              detail={detail}
              filter={filter}
              followLive={followLive}
              childRelations={sessionRelations?.children ?? NO_RELATIONS}
              onOpenRelated={openRelated}
              focusExecutionId={focusExecutionId}
              onFocusHandled={clearCodexFocusExecution}
            />
          </>
        ) : (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-3 text-sm"
            style={{ color: COLOR_TEXT_MUTED }}
          >
            {detailLoading ? (
              <LoaderCircle className="size-6 animate-spin" />
            ) : (
              <SquareTerminal className="size-10" />
            )}
            <span>
              {detailError ??
                (detailLoading
                  ? 'Reading rollout…'
                  : selectedId
                    ? 'Select a session'
                    : 'Codex sessions appear here as Codex writes them.')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
