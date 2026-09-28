/**
 * CodexNestedExecutions - Tree of a code-mode cell's nested operations.
 *
 * Rows come from different evidence: call sites found in the cell script
 * (static analysis, nothing proves they ran), calls Codex listed as attempted,
 * and executions Codex recorded while the cell was running. Each row carries a
 * badge saying which, and expands to its details.
 */

import { useState } from 'react';

import {
  CARD_ICON_MUTED,
  COLOR_TEXT,
  COLOR_TEXT_MUTED,
  COLOR_TEXT_SECONDARY,
} from '@renderer/constants/cssVariables';
import { formatDuration } from '@renderer/utils/formatters';

import { CodexCommandActions } from './CodexCommandActions';
import { CodexExecutionDetails } from './CodexExecutionDetails';
import {
  classifiedActions,
  evidenceBadge,
  executionLabel,
  executionSummary,
  KIND_ICONS,
} from './codexFormatting';
import { CodexStatusBadge } from './CodexStatusBadge';

import type { Execution } from '@shared/types';

interface CodexNestedExecutionsProps {
  cell: Execution;
}

/**
 * "3 recorded by Codex · 1 matched to the script by command · 2 found in the script only".
 */
function describeEvidence(cell: Execution): string {
  const children = cell.children ?? [];
  let recorded = 0;
  let linked = 0;
  let scriptOnly = 0;
  let attempted = 0;
  for (const child of children) {
    const { code, observed, result } = child.evidence;
    if (code && result) linked++;
    else if (code && !observed) scriptOnly++;
    else if (observed?.kind === 'inventory' && !result) attempted++;
    else if (result) recorded++;
  }
  const parts: string[] = [];
  if (recorded + linked > 0) {
    parts.push(`${recorded + linked} recorded by Codex`);
  }
  if (linked > 0) {
    parts.push(`${linked} matched to the script by command`);
  }
  if (attempted > 0) {
    parts.push(
      `${attempted} listed as attempted${cell.childrenComplete ? ' (complete list)' : ''}, no result`
    );
  }
  if (scriptOnly > 0) {
    parts.push(`${scriptOnly} found in the script only`);
  }
  return parts.join(' · ');
}

/**
 * Show a child's cwd only when it differs from the cell's, relative when possible.
 */
function relativeCwd(child: Execution, cell: Execution): string | undefined {
  if (!child.cwd || child.cwd === cell.cwd) {
    return undefined;
  }
  if (cell.cwd && child.cwd.startsWith(cell.cwd)) {
    const rest = child.cwd.slice(cell.cwd.length).replace(/^[\\/]/, '');
    return rest || undefined;
  }
  return child.cwd;
}

export const CodexNestedExecutions = ({ cell }: CodexNestedExecutionsProps): React.JSX.Element => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const children = cell.children ?? [];

  return (
    <div>
      <div className="mb-1 text-[11px]" style={{ color: COLOR_TEXT_MUTED }}>
        {children.length} nested operation{children.length === 1 ? '' : 's'} ·{' '}
        {describeEvidence(cell)}
      </div>
      <ul>
        {children.map((child, index) => {
          const isLast = index === children.length - 1;
          const Icon = KIND_ICONS[child.kind];
          const isExpanded = expandedId === child.id;
          const cwd = relativeCwd(child, cell);
          const badge = evidenceBadge(child);
          return (
            <li key={child.id}>
              <button
                type="button"
                onClick={(): void => setExpandedId(isExpanded ? null : child.id)}
                className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left font-mono text-xs transition-colors hover:bg-surface-raised"
                aria-expanded={isExpanded}
              >
                <span className="w-5 shrink-0 select-none" style={{ color: CARD_ICON_MUTED }}>
                  {isLast ? '└─' : '├─'}
                </span>
                <Icon className="size-3.5 shrink-0" style={{ color: COLOR_TEXT_MUTED }} />
                <span className="shrink-0" style={{ color: COLOR_TEXT_SECONDARY }}>
                  {executionLabel(child)}
                </span>
                <span className="min-w-0 flex-1 truncate" style={{ color: COLOR_TEXT }}>
                  {executionSummary(child)}
                </span>
                <CodexCommandActions actions={classifiedActions(child)} />
                {cwd && (
                  <span
                    className="max-w-40 shrink-0 truncate text-[11px]"
                    style={{ color: COLOR_TEXT_MUTED }}
                  >
                    in {cwd}
                  </span>
                )}
                {badge && (
                  <span
                    className="shrink-0 rounded px-1 font-sans text-[10px]"
                    style={{
                      backgroundColor: 'var(--tag-bg)',
                      border: '1px solid var(--tag-border)',
                      color: 'var(--tag-text)',
                    }}
                    title={badge.title}
                  >
                    {badge.label}
                  </span>
                )}
                <CodexStatusBadge execution={child} parentRunning={cell.status === 'running'} />
                {child.durationMs !== undefined && (
                  <span
                    className="w-14 shrink-0 text-right text-[11px] tabular-nums"
                    style={{ color: COLOR_TEXT_MUTED }}
                  >
                    {formatDuration(child.durationMs)}
                  </span>
                )}
              </button>
              {isExpanded && (
                <div className="mb-2 ml-7 mt-1">
                  <CodexExecutionDetails execution={child} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
