/**
 * CodexCommandActions - What Codex itself recorded a command as doing
 * (`parsed_cmd`: read, list, search). Shown only where Codex recorded it; the
 * viewer never derives these tags from the command text.
 */

import { commandActionLabel, commandActionTarget } from './codexFormatting';

import type { CommandAction } from '@shared/types';

interface CodexCommandActionsProps {
  actions: readonly CommandAction[];
}

function describe(action: CommandAction): string {
  const lines = [`Recorded by Codex as: ${commandActionLabel(action)}`];
  if (action.path) {
    lines.push(`Path: ${action.path}`);
  }
  if (action.query) {
    lines.push(`Query: ${action.query}`);
  }
  if (action.command) {
    lines.push(`Command: ${action.command}`);
  }
  return lines.join('\n');
}

export const CodexCommandActions = ({
  actions,
}: CodexCommandActionsProps): React.JSX.Element | null => {
  if (actions.length === 0) {
    return null;
  }
  return (
    <span className="inline-flex min-w-0 shrink items-center gap-1">
      {actions.map((action, index) => {
        const target = commandActionTarget(action);
        return (
          <span
            key={`${index}:${action.type}:${action.path ?? ''}`}
            className="inline-flex min-w-0 max-w-56 items-center gap-1 rounded px-1 font-sans text-[10px]"
            style={{
              backgroundColor: 'var(--tag-bg)',
              border: '1px solid var(--tag-border)',
              color: 'var(--tag-text)',
            }}
            title={describe(action)}
          >
            <span className="shrink-0 font-semibold uppercase tracking-wide">
              {commandActionLabel(action)}
            </span>
            {target && <span className="truncate font-mono">{target}</span>}
          </span>
        );
      })}
    </span>
  );
};
