/**
 * CodexRelationDetails - The records a session relation rests on: the spawn
 * call, the started record with the same provider id, the thread ids, the
 * related rollout (or the candidates when it is ambiguous), and why it is not
 * resolved when it is not. The only link method is the explicit provider ID
 * chain; nothing is matched by time.
 */

import { CopyablePath } from '@renderer/components/common/CopyablePath';
import {
  COLOR_TEXT,
  COLOR_TEXT_MUTED,
  TAG_BG,
  TAG_BORDER,
  TAG_TEXT,
} from '@renderer/constants/cssVariables';

import { RELATION_METHOD_EXPLANATION, relationDetailRows } from './codexRelationFormatting';

import type { AgentSessionRelation } from '@shared/types';

interface CodexRelationDetailsProps {
  relation: AgentSessionRelation;
}

export const CodexRelationDetails = ({
  relation,
}: CodexRelationDetailsProps): React.JSX.Element => (
  <section aria-label="Session relation" className="space-y-1.5 text-xs">
    <div className="flex items-center gap-2">
      <span
        className="text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: COLOR_TEXT_MUTED }}
      >
        Session relation
      </span>
      <span
        className="rounded px-1 text-[10px]"
        style={{ backgroundColor: TAG_BG, border: `1px solid ${TAG_BORDER}`, color: TAG_TEXT }}
        title={RELATION_METHOD_EXPLANATION}
      >
        Explicit provider ID chain
      </span>
    </div>
    <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-0.5 pl-3">
      {relationDetailRows(relation).map((row) => (
        <div key={row.label} className="contents">
          <dt style={{ color: COLOR_TEXT_MUTED }}>{row.label}</dt>
          <dd className="min-w-0 whitespace-pre-line break-words" style={{ color: COLOR_TEXT }}>
            {row.copyable ? (
              <CopyablePath displayText={row.value} copyText={row.value} className="font-mono" />
            ) : (
              <span className={row.mono ? 'font-mono' : undefined}>{row.value}</span>
            )}
            {row.note && <span style={{ color: COLOR_TEXT_MUTED }}> · {row.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  </section>
);
