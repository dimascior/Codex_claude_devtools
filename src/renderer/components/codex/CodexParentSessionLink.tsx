/**
 * CodexParentSessionLink - "Spawned by" line of a subagent session's header:
 * the parent session and its spawn call, an "Open parent" button that opens
 * the parent rollout at that call (resolved relations only), and the relation
 * evidence on demand.
 */

import { useState } from 'react';

import {
  COLOR_BORDER,
  COLOR_TEXT,
  COLOR_TEXT_MUTED,
  COLOR_TEXT_SECONDARY,
} from '@renderer/constants/cssVariables';
import { getCodexRelationTarget } from '@renderer/store/slices/codexSlice';
import { CornerLeftUp } from 'lucide-react';

import { shortCallId } from './codexFormatting';
import { CodexRelationDetails } from './CodexRelationDetails';
import { relatedSessionName, relationStatusLabel } from './codexRelationFormatting';

import type { AgentSessionRelation } from '@shared/types';

interface CodexParentSessionLinkProps {
  relation: AgentSessionRelation;
  onOpen: (relation: AgentSessionRelation) => void;
}

export const CodexParentSessionLink = ({
  relation,
  onOpen,
}: CodexParentSessionLinkProps): React.JSX.Element => {
  const [showEvidence, setShowEvidence] = useState(false);
  const target = getCodexRelationTarget(relation);
  const { name, detail } = relatedSessionName(relation);

  return (
    <div className="mt-1.5 text-xs" data-relation-status={relation.status}>
      <div className="flex min-w-0 items-center gap-1.5" style={{ color: COLOR_TEXT_SECONDARY }}>
        <CornerLeftUp className="size-3.5 shrink-0" />
        <span className="shrink-0" style={{ color: COLOR_TEXT_MUTED }}>
          Spawned by
        </span>
        {target ? (
          <>
            <span
              className="min-w-0 truncate"
              style={{ color: COLOR_TEXT }}
              title={relation.relatedSessionId}
            >
              {name}
              {detail && <span style={{ color: COLOR_TEXT_MUTED }}> · {detail}</span>}
            </span>
            {relation.executionId && (
              <span
                className="shrink-0 font-mono text-[10px]"
                style={{ color: COLOR_TEXT_MUTED }}
                title={`Spawn call ${relation.executionId}`}
              >
                spawn {shortCallId(relation.executionId)}
              </span>
            )}
            <button
              type="button"
              onClick={(): void => onOpen(relation)}
              className="shrink-0 rounded px-1.5 py-px text-[11px] transition-colors hover:bg-surface-raised"
              style={{ border: `1px solid ${COLOR_BORDER}` }}
              aria-label={`Open parent session ${name}`}
            >
              Open parent
            </button>
          </>
        ) : (
          <span style={{ color: COLOR_TEXT_MUTED }} title={relation.reason}>
            {relationStatusLabel(relation)}
          </span>
        )}
        <button
          type="button"
          onClick={(): void => setShowEvidence(!showEvidence)}
          className="shrink-0 rounded px-1 text-[11px] transition-colors hover:bg-surface-raised"
          style={{ color: COLOR_TEXT_MUTED }}
          aria-expanded={showEvidence}
        >
          {showEvidence ? 'Hide evidence' : 'Evidence'}
        </button>
      </div>
      {showEvidence && (
        <div className="mt-1.5 pl-5">
          <CodexRelationDetails relation={relation} />
        </div>
      )}
    </div>
  );
};
