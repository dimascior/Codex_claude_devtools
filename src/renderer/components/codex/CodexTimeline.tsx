/**
 * CodexTimeline - Chronological view of a Codex session: requests, agent
 * messages, reasoning, executions and turn events, in rollout order.
 */

import { useMemo } from 'react';

import { COLOR_TEXT_MUTED } from '@renderer/constants/cssVariables';
import { useAutoScrollBottom } from '@renderer/hooks/useAutoScrollBottom';
import { TriangleAlert } from 'lucide-react';

import { CodexEventItem } from './CodexEventItem';
import { CodexExecutionCard } from './CodexExecutionCard';
import { type CodexTimelineFilter, filterTimeline, formatClockTime } from './codexFormatting';
import { CodexMessageItem } from './CodexMessageItem';
import { CodexReasoningItem } from './CodexReasoningItem';

import type { AgentSessionDetail, TimelineEntry } from '@shared/types';

interface CodexTimelineProps {
  detail: AgentSessionDetail;
  filter: CodexTimelineFilter;
  /** Stick to the newest entry while it keeps arriving */
  followLive: boolean;
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
      return <CodexEventItem entry={entry} />;
  }
}

export const CodexTimeline = ({
  detail,
  filter,
  followLive,
}: CodexTimelineProps): React.JSX.Element => {
  const entries = useMemo(() => filterTimeline(detail.timeline, filter), [detail.timeline, filter]);
  const { scrollContainerRef } = useAutoScrollBottom([entries.length, detail.fingerprint], {
    threshold: 150,
    enabled: followLive,
    autoBehavior: 'auto',
    resetKey: `${detail.session.id}:${filter}`,
  });

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-2 p-4">
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

        {entries.length === 0 && (
          <div className="py-12 text-center text-sm" style={{ color: COLOR_TEXT_MUTED }}>
            {filter === 'all'
              ? 'Nothing recorded in this rollout yet.'
              : filter === 'executions'
                ? 'No tool calls or commands recorded yet.'
                : 'No failed, declined or interrupted executions.'}
          </div>
        )}

        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex gap-3"
            style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 48px' }}
          >
            <div
              className="w-16 shrink-0 pt-2 text-right font-mono text-[11px] tabular-nums"
              style={{ color: COLOR_TEXT_MUTED }}
              title={
                entry.timestamp
                  ? `${entry.timestamp} · line ${entry.lineNumber}`
                  : `line ${entry.lineNumber}`
              }
            >
              {formatClockTime(entry.timestamp)}
            </div>
            <div className="min-w-0 flex-1">{renderEntry(entry)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
