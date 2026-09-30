/**
 * CodexStatusBadge - Exit code / state pill for an execution.
 */

import { Hourglass } from 'lucide-react';

import { statusAppearance, statusLabel } from './codexFormatting';

import type { Execution } from '@shared/types';

interface CodexStatusBadgeProps {
  execution: Execution;
  /**
   * The parent cell is still running, so a missing result is not final yet
   * (shown as "pending" instead of "no result").
   */
  parentRunning?: boolean;
}

export const CodexStatusBadge = ({
  execution,
  parentRunning = false,
}: CodexStatusBadgeProps): React.JSX.Element => {
  const pending = parentRunning && execution.status === 'unknown';
  const appearance = statusAppearance(pending ? 'running' : execution.status);
  const Icon = pending ? Hourglass : appearance.icon;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] font-medium"
      style={{
        color: appearance.color,
        backgroundColor: appearance.background,
        border: `1px solid ${appearance.border}`,
      }}
      title={pending ? 'The cell is still running' : (execution.statusDetail ?? execution.status)}
    >
      <Icon className={`size-3 ${execution.status === 'running' ? 'animate-spin' : ''}`} />
      {pending ? 'pending' : statusLabel(execution)}
    </span>
  );
};
