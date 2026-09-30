/**
 * CodexTimeline - Chronological view of a Codex session: requests, agent
 * messages, reasoning, executions, file writes, turn events and settings
 * changes, in rollout order. Every file write Codex recorded is an entry of
 * its own (`codexTimelineRows.ts`), also one recorded while a code cell ran.
 * Provides each turn's effective runtime state and the session's
 * spawned-child relations to execution cards, and brings a requested execution
 * (the spawn call a child session was opened from) into view.
 */

import { useEffect, useMemo, useRef } from 'react';

import { COLOR_TEXT_MUTED } from '@renderer/constants/cssVariables';
import { useAutoScrollBottom } from '@renderer/hooks/useAutoScrollBottom';
import { TriangleAlert } from 'lucide-react';

import { CodexEventItem } from './CodexEventItem';
import { CodexExecutionCard } from './CodexExecutionCard';
import { CodexFileWriteCard } from './CodexFileWriteCard';
import { type CodexTimelineFilter, formatClockTime } from './codexFormatting';
import { CodexMessageItem } from './CodexMessageItem';
import { CodexReasoningItem } from './CodexReasoningItem';
import { CodexRelationsContext } from './codexRelationsContext';
import { TurnRuntimeContext } from './codexRuntimeContext';
import { turnStatesById } from './codexRuntimeFormatting';
import { CodexSettingsChangeItem } from './CodexSettingsChangeItem';
import { buildTimelineRows, type CodexTimelineRow, filterTimelineRows } from './codexTimelineRows';

import type { AgentSessionDetail, AgentSessionRelation, TimelineEntry } from '@shared/types';

/** How long a focused execution stays highlighted. */
const FOCUS_HIGHLIGHT_MS = 2500;

interface CodexTimelineProps {
  detail: AgentSessionDetail;
  filter: CodexTimelineFilter;
  /** Stick to the newest entry while it keeps arriving */
  followLive: boolean;
  /** This session's spawned-child relations */
  childRelations: readonly AgentSessionRelation[];
  onOpenRelated: (relation: AgentSessionRelation) => void;
  /** Execution to bring into view once it is rendered */
  focusExecutionId: string | null;
  onFocusHandled: () => void;
}

function renderRow(row: CodexTimelineRow): React.JSX.Element {
  return row.kind === 'file_write' ? <CodexFileWriteCard row={row} /> : renderEntry(row.entry);
}

function renderEntry(entry: TimelineEntry): React.JSX.Element {
  switch (entry.kind) {
    case 'execution':
      return <CodexExecutionCard execution={entry.execution} />;
    case 'user_message':
    case 'agent_message':
      return <CodexMessageItem entry={entry} />;
    case 'reasoning':
      return <CodexReasoningItem entry={entry} />;
    case 'turn_event':
    case 'compaction':
    case 'inherited_context':
      return <CodexEventItem entry={entry} />;
    case 'settings_change':
      return <CodexSettingsChangeItem entry={entry} />;
  }
}

export const CodexTimeline = ({
  detail,
  filter,
  followLive,
  childRelations,
  onOpenRelated,
  focusExecutionId,
  onFocusHandled,
}: CodexTimelineProps): React.JSX.Element => {
  const allRows = useMemo(() => buildTimelineRows(detail.timeline), [detail.timeline]);
  const rows = useMemo(() => filterTimelineRows(allRows, filter), [allRows, filter]);
  const turnStates = useMemo(() => turnStatesById(detail.runtime), [detail.runtime]);
  const relations = useMemo(
    () => ({
      childrenByExecutionId: new Map(
        childRelations.flatMap((relation): [string, AgentSessionRelation][] =>
          relation.executionId ? [[relation.executionId, relation]] : []
        )
      ),
      openRelated: onOpenRelated,
    }),
    [childRelations, onOpenRelated]
  );
  const { scrollContainerRef } = useAutoScrollBottom([rows.length, detail.fingerprint], {
    threshold: 150,
    enabled: followLive,
    autoBehavior: 'auto',
    resetKey: `${detail.session.id}:${filter}`,
  });
  // A focus request stays pending until its execution is shown (a live rollout
  // may not have it yet); the next selection replaces it.
  const focusShown =
    focusExecutionId !== null &&
    rows.some(
      (row) =>
        row.kind === 'entry' &&
        row.entry.kind === 'execution' &&
        row.entry.execution.id === focusExecutionId
    );
  const highlight = useRef<{ element: HTMLElement; timer: ReturnType<typeof setTimeout> } | null>(
    null
  );

  useEffect(() => {
    if (!focusExecutionId || !focusShown) {
      return;
    }
    const target = Array.from(
      scrollContainerRef.current?.querySelectorAll<HTMLElement>('[data-execution-id]') ?? []
    ).find((element) => element.dataset.executionId === focusExecutionId);
    if (!target) {
      return;
    }
    target.scrollIntoView({ block: 'center' });
    if (highlight.current) {
      clearTimeout(highlight.current.timer);
      highlight.current.element.style.boxShadow = '';
    }
    target.style.boxShadow = '0 0 0 2px var(--highlight-ring)';
    highlight.current = {
      element: target,
      timer: setTimeout(() => {
        target.style.boxShadow = '';
        highlight.current = null;
      }, FOCUS_HIGHLIGHT_MS),
    };
    onFocusHandled();
  }, [focusExecutionId, focusShown, onFocusHandled, scrollContainerRef]);

  useEffect(
    () => (): void => {
      if (highlight.current) clearTimeout(highlight.current.timer);
    },
    []
  );

  return (
    <TurnRuntimeContext.Provider value={turnStates}>
      <CodexRelationsContext.Provider value={relations}>
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl space-y-2 p-4">
            {focusExecutionId && !focusShown && (
              <div
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs"
                style={{
                  backgroundColor: 'var(--warning-bg)',
                  border: '1px solid var(--warning-border)',
                  color: 'var(--warning-text)',
                }}
              >
                <TriangleAlert className="size-3.5 shrink-0" />
                The spawn call {focusExecutionId} is not shown in this timeline.
              </div>
            )}
            {detail.warnings.map((warning) => (
              <div
                key={warning}
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs"
                style={{
                  backgroundColor: 'var(--warning-bg)',
                  border: '1px solid var(--warning-border)',
                  color: 'var(--warning-text)',
                }}
              >
                <TriangleAlert className="size-3.5 shrink-0" />
                {warning}
              </div>
            ))}

            {rows.length === 0 && (
              <div className="py-12 text-center text-sm" style={{ color: COLOR_TEXT_MUTED }}>
                {filter === 'all'
                  ? 'Nothing recorded in this rollout yet.'
                  : filter === 'executions'
                    ? 'No tool calls or commands recorded yet.'
                    : 'No failed, declined or interrupted executions.'}
              </div>
            )}

            {rows.map((row) => (
              <div
                key={row.key}
                className="flex gap-3 rounded-md transition-shadow"
                style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 48px' }}
                data-execution-id={
                  row.kind === 'entry' && row.entry.kind === 'execution'
                    ? row.entry.execution.id
                    : undefined
                }
              >
                <div
                  className="w-16 shrink-0 pt-2 text-right font-mono text-[11px] tabular-nums"
                  style={{ color: COLOR_TEXT_MUTED }}
                  title={
                    row.timestamp
                      ? `${row.timestamp} · line ${row.lineNumber}`
                      : `line ${row.lineNumber}`
                  }
                >
                  {formatClockTime(row.timestamp)}
                </div>
                <div className="min-w-0 flex-1">{renderRow(row)}</div>
              </div>
            ))}
          </div>
        </div>
      </CodexRelationsContext.Provider>
    </TurnRuntimeContext.Provider>
  );
};
