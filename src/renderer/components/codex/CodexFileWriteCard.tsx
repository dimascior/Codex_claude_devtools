/**
 * CodexFileWriteCard - One file write in the Codex timeline, with its changes
 * visible without expanding anything: the patch's own text when its call has
 * one, else the change text Codex recorded for each file.
 *
 * The context line says where the write comes from: the code cell it was
 * recorded under (and how it was attributed), the execution a file change was
 * recorded for, or where the patch ran. Provenance, runtime and output expand
 * on click (not for a file change recorded for another execution, whose own
 * card has them).
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
} from '@renderer/constants/cssVariables';
import { formatDuration } from '@renderer/utils/formatters';
import { ChevronRight, FileDiff } from 'lucide-react';

import { CodexExecutionDetails } from './CodexExecutionDetails';
import {
  describeFileWrite,
  evidenceBadge,
  executionLabel,
  fileWritesNote,
  fileWritesSummary,
  generationLabel,
  patchText,
  shortCallId,
  statusAppearance,
} from './codexFormatting';
import { CodexPatchView } from './CodexPatchView';
import { CodexRecordedDiffs } from './CodexRecordedDiffs';
import { CodexStatusBadge } from './CodexStatusBadge';
import { type CodexFileWriteRow, fileWriteStatus } from './codexTimelineRows';

import type { Execution } from '@shared/types';

/** Lines of each change shown before "Show all" */
const PREVIEW_LINES = 20;

interface CodexFileWriteCardProps {
  row: CodexFileWriteRow;
}

const CELL_LINK_WORDING: Partial<Record<string, string>> = {
  turn_window: 'attributed by turn and record order, no shared id',
  explicit_id: 'same provider id',
};

function contextParts(row: CodexFileWriteRow): string[] {
  const exec = row.execution;
  const parts: string[] = [];
  if (row.source === 'file_change') {
    const record = exec.evidence.fileChange;
    parts.push(`recorded for ${executionLabel(exec)} ${shortCallId(exec.id)}`);
    if (record) {
      parts.push(`${record.recordType}, line ${record.lineNumber}`);
    }
    return parts;
  }
  if (row.cell) {
    const method = exec.evidence.cellLink?.method;
    const wording = method ? CELL_LINK_WORDING[method] : undefined;
    const recorded = `recorded while exec cell ${shortCallId(row.cell.id)} ran`;
    parts.push(wording ? `${recorded} (${wording})` : recorded);
  } else if (exec.cwd) {
    parts.push(exec.cwd);
  }
  const generation = generationLabel(exec);
  if (generation && !row.cell) {
    parts.push(generation);
  }
  const badge = evidenceBadge(exec);
  if (badge && !row.cell) {
    parts.push(badge.label);
  }
  return parts;
}

/** The status the badge shows: a file change's own outcome for `file_change` rows. */
function statusView(row: CodexFileWriteRow): Execution {
  if (row.source === 'patch') {
    return row.execution;
  }
  return {
    ...row.execution,
    status: fileWriteStatus(row),
    exitCode: undefined,
    statusDetail: undefined,
  };
}

const Changes = ({ row }: Readonly<CodexFileWriteCardProps>): React.JSX.Element => {
  const exec = row.execution;
  const patch = row.source === 'patch' ? patchText(exec) : undefined;
  if (patch !== undefined) {
    return <CodexPatchView patch={patch} previewLines={PREVIEW_LINES} />;
  }
  const writes = exec.fileWrites ?? [];
  if (writes.some((write) => write.diff !== undefined)) {
    return <CodexRecordedDiffs execution={exec} previewLines={PREVIEW_LINES} />;
  }
  const note = fileWritesNote(exec);
  return (
    <div className="space-y-0.5 text-xs">
      {writes.length > 0 ? (
        <ul className="space-y-0.5 font-mono" style={{ color: COLOR_TEXT }}>
          {writes.map((write) => (
            <li key={write.path} className="break-all">
              {describeFileWrite(write)}
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ color: COLOR_TEXT_MUTED }}>Codex recorded no file list for this write.</div>
      )}
      <div style={{ color: COLOR_TEXT_MUTED }}>
        {writes.length > 0 && 'Codex recorded no change text for these files.'}
        {note && ` ${note}.`}
      </div>
    </div>
  );
};

export const CodexFileWriteCard = ({ row }: CodexFileWriteCardProps): React.JSX.Element => {
  const [expanded, setExpanded] = useState(false);
  const exec = row.execution;
  const appearance = statusAppearance(fileWriteStatus(row));
  const summary = fileWritesSummary(exec.fileWrites ?? []) ?? exec.command;
  const context = contextParts(row);
  const expandable = row.source === 'patch';

  const header = (
    <>
      <div className="flex items-center gap-2">
        <ChevronRight
          className={`size-3.5 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''} ${expandable ? '' : 'invisible'}`}
          style={{ color: CARD_ICON_MUTED }}
        />
        <FileDiff className="size-4 shrink-0" style={{ color: COLOR_TEXT_SECONDARY }} />
        <span
          className="shrink-0 text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: COLOR_TEXT_SECONDARY }}
        >
          file write
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs" style={{ color: COLOR_TEXT }}>
          {summary}
        </span>
        <CodexStatusBadge execution={statusView(row)} />
        {row.source === 'patch' && exec.durationMs !== undefined && (
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
          className="ml-[52px] mt-0.5 min-w-0 truncate text-[11px]"
          style={{ color: COLOR_TEXT_MUTED }}
          title={context.join(' · ')}
        >
          {context.join(' · ')}
        </div>
      )}
    </>
  );

  return (
    <div
      className="overflow-hidden rounded-md"
      style={{
        backgroundColor: CARD_BG,
        border: CARD_BORDER_STYLE,
        borderLeft: `3px solid ${appearance.border}`,
      }}
      data-file-write={exec.id}
    >
      {expandable ? (
        <button
          type="button"
          onClick={(): void => setExpanded(!expanded)}
          className="block w-full px-3 py-2 text-left transition-colors"
          style={{ backgroundColor: expanded ? CARD_HEADER_BG : 'transparent' }}
          aria-expanded={expanded}
        >
          {header}
        </button>
      ) : (
        <div className="px-3 py-2">{header}</div>
      )}

      <div className="px-3 pb-2 pl-[40px]">
        <Changes row={row} />
      </div>

      {expanded && (
        <div className="p-3" style={{ borderTop: `1px solid ${COLOR_BORDER}` }}>
          <CodexExecutionDetails execution={exec} showChanges={false} />
        </div>
      )}
    </div>
  );
};
