/**
 * CodexNestedExecutions - Tree of the operations a code-mode cell dispatched.
 *
 * A code cell is one model-visible call; the nested calls are what actually
 * ran. Each row expands to that call's details.
 */

import { useState } from 'react';

import {
  CARD_ICON_MUTED,
  COLOR_TEXT,
  COLOR_TEXT_MUTED,
  COLOR_TEXT_SECONDARY,
} from '@renderer/constants/cssVariables';
import { formatDuration } from '@renderer/utils/formatters';

import { CodexExecutionDetails } from './CodexExecutionDetails';
import { executionLabel, executionSummary, KIND_ICONS } from './codexFormatting';
import { CodexStatusBadge } from './CodexStatusBadge';

import type { Execution } from '@shared/types';

interface CodexNestedExecutionsProps {
  cell: Execution;
}

function describeSource(cell: Execution): string {
  if (cell.childrenSource === 'recorded') {
    return cell.childrenComplete
      ? 'recorded by Codex · complete inventory'
      : 'recorded by Codex · inventory may be partial';
  }
  return 'from static analysis of the cell script';
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
        {children.length} nested call{children.length === 1 ? '' : 's'} · {describeSource(cell)}
      </div>
      <ul>
        {children.map((child, index) => {
          const isLast = index === children.length - 1;
          const Icon = KIND_ICONS[child.kind];
          const isExpanded = expandedId === child.id;
          const cwd = relativeCwd(child, cell);
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
                {cwd && (
                  <span
                    className="max-w-40 shrink-0 truncate text-[11px]"
                    style={{ color: COLOR_TEXT_MUTED }}
                  >
                    in {cwd}
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
