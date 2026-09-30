/**
 * codexTimelineRows - The rows the Codex timeline shows: the session's
 * timeline entries, with every file write Codex recorded as a row of its own.
 *
 * - A patch execution entry is a file-write row in place.
 * - A patch execution Codex recorded while a code cell ran (a `FileChange`
 *   item or `patch_apply_end` event attributed to the cell) is lifted out of
 *   the cell's nested operations into a row of its own.
 * - A file change Codex recorded for another execution (e.g. a shell call that
 *   ran a patch) gets a file-write row; the execution keeps its own row.
 *
 * Lifted and derived rows are placed by the rollout line of their record,
 * never before the entry they came from. Presentation only: executions, their
 * attribution to cells and their evidence are unchanged.
 */

import { type CodexTimelineFilter, isRecordedFileWrite } from './codexFormatting';

import type { Execution, ExecutionStatus, TimelineEntry } from '@shared/types';

interface RowBase {
  /** Stable React key */
  key: string;
  /** Rollout line the row stands for */
  lineNumber: number;
  timestamp?: string;
}

export interface CodexEntryRow extends RowBase {
  kind: 'entry';
  entry: TimelineEntry;
}

export interface CodexFileWriteRow extends RowBase {
  kind: 'file_write';
  /**
   * `patch`: the execution is the write. `file_change`: Codex recorded a file
   * change for this execution, which is not a patch (its row shows the rest).
   */
  source: 'patch' | 'file_change';
  execution: Execution;
  /** The code cell the write was recorded under, for a write lifted out of it */
  cell?: Execution;
  /** Id of the timeline entry the write came from; the row never precedes it */
  hostId?: string;
}

export type CodexTimelineRow = CodexEntryRow | CodexFileWriteRow;

const PROBLEM_STATUSES = new Set<ExecutionStatus>(['failed', 'declined', 'interrupted']);

/** Outcome of the write a row shows: the patch's, or the recorded file change's. */
export function fileWriteStatus(row: CodexFileWriteRow): ExecutionStatus {
  return row.source === 'patch'
    ? row.execution.status
    : (row.execution.fileChangeStatus ?? 'unknown');
}

function fileChangeRow(exec: Execution, hostId: string): CodexFileWriteRow | undefined {
  const record = exec.evidence.fileChange;
  if (exec.kind === 'patch' || !record || !exec.fileWrites || exec.fileWrites.length === 0) {
    return undefined;
  }
  return {
    kind: 'file_write',
    key: `file-change:${exec.id}`,
    lineNumber: record.lineNumber,
    source: 'file_change',
    execution: exec,
    hostId,
  };
}

function writesOf(exec: Execution): CodexFileWriteRow[] {
  const rows: CodexFileWriteRow[] = [];
  const own = fileChangeRow(exec, exec.id);
  if (own) {
    rows.push(own);
  }
  for (const child of exec.children ?? []) {
    if (isRecordedFileWrite(child)) {
      rows.push({
        kind: 'file_write',
        key: `write:${child.id}`,
        lineNumber: child.lineNumber,
        timestamp: child.timestamp || undefined,
        source: 'patch',
        execution: child,
        cell: exec,
        hostId: exec.id,
      });
    } else {
      const derived = fileChangeRow(child, exec.id);
      if (derived) {
        rows.push(derived);
      }
    }
  }
  return rows;
}

export function buildTimelineRows(timeline: readonly TimelineEntry[]): CodexTimelineRow[] {
  const rows: CodexTimelineRow[] = [];
  const pending: CodexFileWriteRow[] = [];
  for (const entry of timeline) {
    if (entry.kind === 'execution' && entry.execution.kind === 'patch') {
      rows.push({
        kind: 'file_write',
        key: entry.id,
        lineNumber: entry.lineNumber,
        timestamp: entry.timestamp,
        source: 'patch',
        execution: entry.execution,
      });
    } else {
      rows.push({
        kind: 'entry',
        key: entry.id,
        lineNumber: entry.lineNumber,
        timestamp: entry.timestamp,
        entry,
      });
    }
    if (entry.kind === 'execution') {
      pending.push(...writesOf(entry.execution));
    }
  }
  if (pending.length === 0) {
    return rows;
  }

  pending.sort((a, b) => a.lineNumber - b.lineNumber);
  const merged: CodexTimelineRow[] = [];
  const shown = new Set<string>();
  const hostShown = (write: CodexFileWriteRow): boolean =>
    write.hostId === undefined || shown.has(write.hostId);
  let next = 0;
  for (const row of rows) {
    while (
      next < pending.length &&
      pending[next].lineNumber < row.lineNumber &&
      hostShown(pending[next])
    ) {
      merged.push(pending[next++]);
    }
    merged.push(row);
    if (row.kind === 'entry' && row.entry.kind === 'execution') {
      shown.add(row.entry.execution.id);
    }
  }
  merged.push(...pending.slice(next));
  return merged;
}

/**
 * Whether an execution entry shows a problem: its own outcome, or that of a
 * nested operation still listed under it (not a lifted file write).
 */
function hasProblem(exec: Execution): boolean {
  return (
    PROBLEM_STATUSES.has(exec.status) ||
    (exec.children ?? []).some(
      (child) => !isRecordedFileWrite(child) && PROBLEM_STATUSES.has(child.status)
    )
  );
}

export function filterTimelineRows(
  rows: readonly CodexTimelineRow[],
  filter: CodexTimelineFilter
): CodexTimelineRow[] {
  switch (filter) {
    case 'all':
      return [...rows];
    case 'executions':
      return rows.filter((row) => row.kind === 'file_write' || row.entry.kind === 'execution');
    case 'problems':
      return rows.filter((row) =>
        row.kind === 'file_write'
          ? PROBLEM_STATUSES.has(fileWriteStatus(row))
          : row.entry.kind === 'turn_event' ||
            (row.entry.kind === 'execution' && hasProblem(row.entry.execution))
      );
  }
}
