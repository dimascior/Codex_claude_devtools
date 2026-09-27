/**
 * CodexExecutionCard - One execution in the Codex timeline.
 *
 * Header: what ran and how it ended (label, exact command, status, duration).
 * Context line: where it ran and how Codex encoded it.
 * Code cells always show their nested-call tree; details expand on click.
 */

import { useState } from 'react';

import {
  CARD_BG,
  CARD_BORDER_STYLE,
  CARD_HEADER_BG,
  CARD_ICON_MUTED,
  COLOR_BORDER,
  COLOR_TEXT,
  COLOR_TEXT_MUTED,
  COLOR_TEXT_SECONDARY,
  TOOL_CALL_TEXT,
} from '@renderer/constants/cssVariables';
import { formatDuration } from '@renderer/utils/formatters';
import { ChevronRight } from 'lucide-react';

import { CodexExecutionDetails } from './CodexExecutionDetails';
import {
  evidenceBadge,
  executionLabel,
  executionSummary,
  generationLabel,
  KIND_ICONS,
  shortCallId,
  statusAppearance,
} from './codexFormatting';
import { CodexNestedExecutions } from './CodexNestedExecutions';
import { CodexStatusBadge } from './CodexStatusBadge';

import type { Execution } from '@shared/types';

interface CodexExecutionCardProps {
  execution: Execution;
}

function contextParts(exec: Execution): string[] {
  const parts: string[] = [];
  if (exec.kind === 'command_input' && exec.processId) {
    parts.push(
      exec.parentId
        ? `session ${exec.processId} (started by ${shortCallId(exec.parentId)})`
        : `session ${exec.processId}`
    );
  }
  if (exec.kind === 'code_wait' && exec.parentId) {
    parts.push(`polls ${shortCallId(exec.parentId)}`);
  }
  if (exec.cwd) {
    parts.push(exec.cwd);
  }
  if (exec.shell) {
    parts.push(exec.shell);
  }
  const generation = generationLabel(exec);
  if (generation) {
    parts.push(generation);
  }
  const badge = evidenceBadge(exec);
  if (badge) {
    parts.push(badge.label);
  }
  if (exec.patchFiles && exec.patchFiles.length > 0) {
    parts.push(exec.patchFiles.join(', '));
  }
  return parts;
}

export const CodexExecutionCard = ({
  execution: exec,
}: CodexExecutionCardProps): React.JSX.Element => {
  const [expanded, setExpanded] = useState(false);
  const Icon = KIND_ICONS[exec.kind];
  const summary = executionSummary(exec);
  const context = contextParts(exec);
  const isCell = exec.kind === 'code_cell';
  const appearance = statusAppearance(exec.status);

  return (
    <div
      className="overflow-hidden rounded-md"
      style={{
        backgroundColor: CARD_BG,
        border: CARD_BORDER_STYLE,
        borderLeft: `3px solid ${appearance.border}`,
      }}
    >
      <button
        type="button"
        onClick={(): void => setExpanded(!expanded)}
        className="block w-full px-3 py-2 text-left transition-colors"
        style={{ backgroundColor: expanded ? CARD_HEADER_BG : 'transparent' }}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <ChevronRight
            className={`size-3.5 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
            style={{ color: CARD_ICON_MUTED }}
          />
          <Icon
            className="size-4 shrink-0"
            style={{ color: isCell ? TOOL_CALL_TEXT : COLOR_TEXT_SECONDARY }}
          />
          <span
            className="shrink-0 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: isCell ? TOOL_CALL_TEXT : COLOR_TEXT_SECONDARY }}
          >
            {executionLabel(exec)}
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-xs" style={{ color: COLOR_TEXT }}>
            {summary}
          </span>
          <CodexStatusBadge execution={exec} />
          {exec.durationMs !== undefined && (
            <span
              className="w-14 shrink-0 text-right text-[11px] tabular-nums"
              style={{ color: COLOR_TEXT_MUTED }}
            >
              {formatDuration(exec.durationMs)}
            </span>
          )}
          <span
            className="hidden shrink-0 font-mono text-[10px] lg:inline"
            style={{ color: CARD_ICON_MUTED }}
            title={exec.id}
          >
            {shortCallId(exec.id)}
          </span>
        </div>
        {context.length > 0 && (
          <div
            className="ml-[52px] mt-0.5 truncate text-[11px]"
            style={{ color: COLOR_TEXT_MUTED }}
            title={context.join(' · ')}
          >
            {context.join(' · ')}
          </div>
        )}
      </button>

      {isCell && (exec.children?.length ?? 0) > 0 && (
        <div className="px-3 pb-2 pl-[38px]">
          <CodexNestedExecutions cell={exec} />
        </div>
      )}

      {expanded && (
        <div className="p-3" style={{ borderTop: `1px solid ${COLOR_BORDER}` }}>
          <CodexExecutionDetails execution={exec} />
        </div>
      )}
    </div>
  );
};
