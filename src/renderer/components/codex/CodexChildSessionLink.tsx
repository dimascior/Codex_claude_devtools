/**
 * CodexChildSessionLink - The subagent session a spawn execution started,
 * shown under its card header. Only a resolved relation gets an "Open child"
 * button; a missing, ambiguous or unresolved one is a plain status line. The
 * card itself never navigates.
 */

import {
  CARD_ICON_MUTED,
  COLOR_BORDER,
  COLOR_TEXT,
  COLOR_TEXT_MUTED,
  COLOR_TEXT_SECONDARY,
} from '@renderer/constants/cssVariables';
import { getCodexRelationTarget } from '@renderer/store/slices/codexSlice';
import { ArrowRight, GitFork } from 'lucide-react';

import { relatedSessionName, relationStatusLabel } from './codexRelationFormatting';

import type { AgentSessionRelation } from '@shared/types';

interface CodexChildSessionLinkProps {
  relation: AgentSessionRelation;
  onOpen: (relation: AgentSessionRelation) => void;
}

export const CodexChildSessionLink = ({
  relation,
  onOpen,
}: CodexChildSessionLinkProps): React.JSX.Element => {
  const target = getCodexRelationTarget(relation);
  const { name, detail } = relatedSessionName(relation);

  return (
    <div
      className="flex min-w-0 items-center gap-2 text-[11px]"
      data-relation-status={relation.status}
    >
      <GitFork className="size-3.5 shrink-0" style={{ color: CARD_ICON_MUTED }} />
      {target ? (
        <>
          <span className="shrink-0" style={{ color: COLOR_TEXT_MUTED }}>
            Child session
          </span>
          <span
            className="min-w-0 truncate"
            style={{ color: COLOR_TEXT }}
            title={relation.relatedSessionId}
          >
            {name}
            {detail && <span style={{ color: COLOR_TEXT_MUTED }}> · {detail}</span>}
          </span>
          <button
            type="button"
            onClick={(): void => onOpen(relation)}
            className="flex shrink-0 items-center gap-1 rounded px-1.5 py-px transition-colors hover:bg-surface-raised"
            style={{ border: `1px solid ${COLOR_BORDER}`, color: COLOR_TEXT_SECONDARY }}
            aria-label={`Open child session ${name}`}
          >
            Open child
            <ArrowRight className="size-3" />
          </button>
        </>
      ) : (
        <span style={{ color: COLOR_TEXT_MUTED }} title={relation.reason}>
          {relationStatusLabel(relation)}
        </span>
      )}
    </div>
  );
};
