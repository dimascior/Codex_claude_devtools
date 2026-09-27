/**
 * CodexEventItem - Turn-level markers: aborted/failed turns and compactions.
 */

import { useState } from 'react';

import { COLOR_BORDER, COLOR_TEXT_MUTED } from '@renderer/constants/cssVariables';
import { formatDuration } from '@renderer/utils/formatters';
import { ChevronRight, CircleStop, Layers, TriangleAlert } from 'lucide-react';

import type { CompactionEntry, TurnEventEntry } from '@shared/types';

interface CodexEventItemProps {
  entry: TurnEventEntry | CompactionEntry;
}

export const CodexEventItem = ({ entry }: CodexEventItemProps): React.JSX.Element => {
  const [showSummary, setShowSummary] = useState(false);

  if (entry.kind === 'compaction') {
    return (
      <div>
        <div className="flex items-center gap-2 text-[11px]" style={{ color: COLOR_TEXT_MUTED }}>
          <div className="h-px flex-1" style={{ backgroundColor: COLOR_BORDER }} />
          <Layers className="size-3.5" />
          <span>
            Context compacted
            {entry.encrypted && !entry.summary ? ' (history stored encrypted)' : ''}
          </span>
          {entry.summary && (
            <button
              type="button"
              onClick={(): void => setShowSummary(!showSummary)}
              className="flex items-center gap-0.5 underline-offset-2 hover:underline"
              aria-expanded={showSummary}
            >
              <ChevronRight
                className={`size-3 transition-transform ${showSummary ? 'rotate-90' : ''}`}
              />
              summary
            </button>
          )}
          <div className="h-px flex-1" style={{ backgroundColor: COLOR_BORDER }} />
        </div>
        {showSummary && entry.summary && (
          <pre
            className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md p-3 font-mono text-xs"
            style={{
              backgroundColor: 'var(--output-bg)',
              border: '1px solid var(--output-border)',
              color: 'var(--output-text)',
            }}
          >
            {entry.summary}
          </pre>
        )}
      </div>
    );
  }

  const isAbort = entry.event === 'aborted';
  const Icon = isAbort ? CircleStop : TriangleAlert;
  return (
    <div
      className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs"
      style={{
        backgroundColor: 'var(--interruption-bg)',
        border: '1px solid var(--interruption-border)',
        color: 'var(--interruption-text)',
      }}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="font-medium">{isAbort ? 'Turn aborted' : 'Turn failed'}</span>
      {entry.reason && <span className="min-w-0 truncate">{entry.reason}</span>}
      {entry.durationMs !== undefined && (
        <span className="ml-auto shrink-0 tabular-nums">{formatDuration(entry.durationMs)}</span>
      )}
    </div>
  );
};
