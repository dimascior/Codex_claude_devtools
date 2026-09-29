/**
 * CodexRecordedDiffs - The change of each file as Codex recorded it in the
 * execution's file-change record (`FileChange` item or `patch_apply_end`
 * event): the unified diff of an update, the content of an added or deleted
 * file. For executions without patch text of their own, such as patches run
 * from a code-mode cell or by a shell command. Nothing here comes from a
 * script's `tools.apply_patch(...)` argument.
 */

import { COLOR_TEXT, COLOR_TEXT_MUTED } from '@renderer/constants/cssVariables';
import { hasAppliedFileWrites } from '@shared/utils/executionEvidence';

import {
  describeFileWrite,
  fileWritesNote,
  omittedDiffNote,
  recordedDiffLabel,
} from './codexFormatting';
import { CodexPatchView, type PatchViewTone } from './CodexPatchView';

import type { Execution, FileWrite, RecordedFileDiff } from '@shared/types';

interface CodexRecordedDiffsProps {
  execution: Execution;
}

type RecordedWrite = FileWrite & { diff: RecordedFileDiff };

function toneOf(write: RecordedWrite): PatchViewTone {
  if (write.diff.field === 'unified_diff') {
    return 'diff';
  }
  if (write.change === 'add') {
    return 'added';
  }
  return write.change === 'delete' ? 'removed' : 'plain';
}

export const CodexRecordedDiffs = ({
  execution: exec,
}: CodexRecordedDiffsProps): React.JSX.Element | null => {
  const writes = (exec.fileWrites ?? []).filter(
    (write): write is RecordedWrite => write.diff !== undefined
  );
  if (writes.length === 0) {
    return null;
  }
  const record = exec.evidence.fileChange ?? exec.evidence.result;
  const note = hasAppliedFileWrites(exec) ? undefined : fileWritesNote(exec);

  return (
    <section aria-label="Recorded changes" className="space-y-2 text-xs">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span
          className="text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: COLOR_TEXT_MUTED }}
        >
          Recorded changes
        </span>
        {record && (
          <span style={{ color: COLOR_TEXT_MUTED }}>
            as Codex recorded them: {record.recordType}, line {record.lineNumber}
          </span>
        )}
        {note && <span style={{ color: COLOR_TEXT_MUTED }}>· {note}</span>}
      </div>
      {writes.map((write) => {
        const omitted = omittedDiffNote(write.diff);
        return (
          <div key={write.path} className="space-y-1">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <span className="break-all font-mono" style={{ color: COLOR_TEXT }}>
                {describeFileWrite(write)}
              </span>
              <span style={{ color: COLOR_TEXT_MUTED }}>{recordedDiffLabel(write.diff)}</span>
            </div>
            {write.diff.text.length > 0 && (
              <CodexPatchView patch={write.diff.text} tone={toneOf(write)} />
            )}
            {omitted && <div style={{ color: COLOR_TEXT_MUTED }}>{omitted}</div>}
          </div>
        );
      })}
    </section>
  );
};
