/**
 * CodexRuntimeDetails - The effective runtime of the turn an execution ran in
 * (model, effort, approval, sandbox, profile), resolved through the execution's
 * `turnId`. It describes the turn, not the execution's evidence, so it is kept
 * apart from the provenance section.
 */

import { useContext } from 'react';

import { COLOR_BORDER, COLOR_TEXT, COLOR_TEXT_MUTED } from '@renderer/constants/cssVariables';

import { TurnRuntimeContext } from './codexRuntimeContext';
import { executionRuntimeRows, turnStateSource } from './codexRuntimeFormatting';

import type { Execution } from '@shared/types';

interface CodexRuntimeDetailsProps {
  execution: Execution;
}

export const CodexRuntimeDetails = ({
  execution,
}: CodexRuntimeDetailsProps): React.JSX.Element | null => {
  const states = useContext(TurnRuntimeContext);
  const state = execution.turnId ? states.get(execution.turnId) : undefined;
  if (!state) return null;
  const rows = executionRuntimeRows(state);
  if (rows.length === 0) return null;

  return (
    <section
      aria-label="Effective runtime"
      className="space-y-1.5 border-t pt-2 text-xs"
      style={{ borderColor: COLOR_BORDER }}
    >
      <div
        className="text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: COLOR_TEXT_MUTED }}
        title="Settings Codex recorded for the turn this execution ran in. Context about the turn, not evidence about the execution."
      >
        Effective runtime
      </div>
      <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-0.5 pl-3">
        {rows.map((row) => (
          <div key={row.field} className="contents">
            <dt style={{ color: COLOR_TEXT_MUTED }}>{row.label}</dt>
            <dd className="min-w-0 break-words" style={{ color: COLOR_TEXT }}>
              {row.value}
            </dd>
          </div>
        ))}
        <dt style={{ color: COLOR_TEXT_MUTED }}>Source</dt>
        <dd className="min-w-0 break-words font-mono" style={{ color: COLOR_TEXT }}>
          {turnStateSource(state)}
        </dd>
      </dl>
    </section>
  );
};
