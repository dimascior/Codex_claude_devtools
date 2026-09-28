/**
 * CodexProvenance - Where an execution's facts come from: the viewer's id for
 * it, the provider records behind it (type, provider id, rollout line), the
 * script call site, and how they were related (`explicit_id`, `turn_window`,
 * `content`, `unresolved`).
 */

import { CopyablePath } from '@renderer/components/common/CopyablePath';
import {
  COLOR_TEXT,
  COLOR_TEXT_MUTED,
  COLOR_TEXT_SECONDARY,
} from '@renderer/constants/cssVariables';

import { buildProvenance, provenanceClass } from './codexProvenance';

import type { Execution } from '@shared/types';

interface CodexProvenanceProps {
  execution: Execution;
}

export const CodexProvenance = ({ execution }: CodexProvenanceProps): React.JSX.Element => {
  const kind = provenanceClass(execution);
  const groups = buildProvenance(execution);

  return (
    <section aria-label="Provenance" className="space-y-1.5 text-xs">
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: COLOR_TEXT_MUTED }}
        >
          Provenance
        </span>
        <span
          className="rounded px-1 text-[10px]"
          style={{
            backgroundColor: 'var(--tag-bg)',
            border: '1px solid var(--tag-border)',
            color: 'var(--tag-text)',
          }}
          title={kind.title}
        >
          {kind.label}
        </span>
      </div>
      {groups.map((group) => (
        <div key={group.title}>
          <div style={{ color: COLOR_TEXT_SECONDARY }} title={group.description}>
            {group.title}
          </div>
          <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-0.5 pl-3">
            {group.rows.map((row) => (
              <div key={row.label} className="contents">
                <dt style={{ color: COLOR_TEXT_MUTED }}>{row.label}</dt>
                <dd className="min-w-0 break-words" style={{ color: COLOR_TEXT }}>
                  {row.copyable ? (
                    <CopyablePath
                      displayText={row.value}
                      copyText={row.value}
                      className="font-mono"
                    />
                  ) : (
                    <span className={row.mono ? 'font-mono' : undefined}>{row.value}</span>
                  )}
                  {row.note && <span style={{ color: COLOR_TEXT_MUTED }}> · {row.note}</span>}
                  {row.detail && <div style={{ color: COLOR_TEXT_MUTED }}>{row.detail}</div>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
};
