/**
 * CodexRuntimeSummary - The session's current runtime in the header: model,
 * effort, approval, sandbox and permission profile of the latest effective turn
 * state, with the other current settings (the latest turn's, then thread-level
 * ones such as the service tier) behind a details toggle.
 */

import { useState } from 'react';

import {
  COLOR_TEXT,
  COLOR_TEXT_MUTED,
  COLOR_TEXT_SECONDARY,
} from '@renderer/constants/cssVariables';
import { ChevronRight } from 'lucide-react';

import { type CurrentRuntime, RUNTIME_FIELD_LABELS } from './codexRuntimeFormatting';

interface CodexRuntimeSummaryProps {
  current: CurrentRuntime;
}

export const CodexRuntimeSummary = ({ current }: CodexRuntimeSummaryProps): React.JSX.Element => {
  const [expanded, setExpanded] = useState(false);

  return (
    <section aria-label="Runtime settings" className="mt-1.5 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className="text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: COLOR_TEXT_MUTED }}
          title={
            current.source
              ? `Effective settings of the latest turn (${current.source})`
              : 'No turn state recorded; thread settings only'
          }
        >
          Runtime
        </span>
        {current.primary.map((row) => (
          <span
            key={row.field}
            title={`${RUNTIME_FIELD_LABELS[row.field]}, latest turn (${current.source ?? 'turn_context'})`}
          >
            <span style={{ color: COLOR_TEXT_MUTED }}>{row.label}</span>{' '}
            <span style={{ color: COLOR_TEXT }}>{row.value}</span>
          </span>
        ))}
        {current.details.length > 0 && (
          <button
            type="button"
            onClick={(): void => setExpanded(!expanded)}
            className="flex items-center gap-0.5 underline-offset-2 hover:underline"
            style={{ color: COLOR_TEXT_MUTED }}
            aria-expanded={expanded}
          >
            <ChevronRight
              className={`size-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
            {expanded ? 'less' : 'more'}
          </button>
        )}
      </div>
      {expanded && (
        <div className="mt-1.5 space-y-1.5">
          {current.details.map((group) => (
            <div key={group.title}>
              <div style={{ color: COLOR_TEXT_SECONDARY }} title={group.description}>
                {group.title}
                <span style={{ color: COLOR_TEXT_MUTED }}> · {group.source}</span>
              </div>
              <dl className="grid grid-cols-[11rem_1fr] gap-x-3 gap-y-0.5 pl-3">
                {group.rows.map((row) => (
                  <div key={row.field} className="contents">
                    <dt style={{ color: COLOR_TEXT_MUTED }}>{row.label}</dt>
                    <dd
                      className={`min-w-0 break-words ${row.field === 'cwd' ? 'font-mono' : ''}`}
                      style={{ color: COLOR_TEXT }}
                    >
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
