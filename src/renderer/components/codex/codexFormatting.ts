/**
 * Display helpers for the Codex execution timeline.
 */

import { hasAppliedFileWrites, isStaticOnly } from '@shared/utils/executionEvidence';
import {
  Ban,
  Braces,
  CircleCheck,
  CircleDashed,
  CircleStop,
  CircleX,
  FileDiff,
  Globe,
  Hourglass,
  Image,
  Keyboard,
  ListChecks,
  LoaderCircle,
  type LucideIcon,
  Plug,
  Search,
  SquareTerminal,
  Wrench,
} from 'lucide-react';

import type {
  CommandAction,
  DurationSource,
  Execution,
  ExecutionKind,
  ExecutionStatus,
  FileWrite,
  RecordedFileDiff,
  RecordEvidence,
} from '@shared/types';

export interface StatusAppearance {
  icon: LucideIcon;
  color: string;
  background: string;
  border: string;
}

const STATUS_APPEARANCE: Record<ExecutionStatus, StatusAppearance> = {
  completed: {
    icon: CircleCheck,
    color: 'var(--tool-result-success-text)',
    background: 'var(--tool-result-success-bg)',
    border: 'var(--tool-result-success-border)',
  },
  failed: {
    icon: CircleX,
    color: 'var(--tool-result-error-text)',
    background: 'var(--tool-result-error-bg)',
    border: 'var(--tool-result-error-border)',
  },
  declined: {
    icon: Ban,
    color: 'var(--warning-text)',
    background: 'var(--warning-bg)',
    border: 'var(--warning-border)',
  },
  interrupted: {
    icon: CircleStop,
    color: 'var(--interruption-text)',
    background: 'var(--interruption-bg)',
    border: 'var(--interruption-border)',
  },
  running: {
    icon: LoaderCircle,
    color: '#60a5fa',
    background: 'rgba(59, 130, 246, 0.12)',
    border: 'rgba(59, 130, 246, 0.35)',
  },
  unknown: {
    icon: CircleDashed,
    color: 'var(--tag-text)',
    background: 'var(--tag-bg)',
    border: 'var(--tag-border)',
  },
};

export function statusAppearance(status: ExecutionStatus): StatusAppearance {
  return STATUS_APPEARANCE[status];
}

/**
 * Short status text: the exit code when known, otherwise the state.
 */
export function statusLabel(exec: Execution): string {
  if (exec.exitCode !== undefined) {
    return `exit ${exec.exitCode}`;
  }
  switch (exec.status) {
    case 'completed':
      return 'done';
    case 'failed':
      return 'failed';
    case 'running':
      return 'running';
    case 'declined':
      return 'declined';
    case 'interrupted':
      return 'interrupted';
    case 'unknown':
      // A result record without a readable outcome is not the same as no record.
      return exec.evidence.result ? 'outcome unknown' : 'not recorded';
  }
}

const UNAPPLIED_WRITES: Record<ExecutionStatus, string> = {
  completed: 'no file change recorded',
  failed: 'failed',
  declined: 'declined',
  interrupted: 'interrupted',
  running: 'in progress',
  unknown: 'no result recorded',
};

/**
 * How an execution's file list relates to what Codex recorded: nothing to add
 * for a patch Codex recorded as applied; otherwise that the files come from a
 * file change Codex recorded for this execution, or that they were not
 * recorded as written, and why.
 */
export function fileWritesNote(exec: Execution): string | undefined {
  if (hasAppliedFileWrites(exec)) {
    return exec.kind === 'patch' ? undefined : 'Codex recorded a file change for this execution';
  }
  return `Not recorded as written (${UNAPPLIED_WRITES[exec.fileChangeStatus ?? exec.status]})`;
}

export const KIND_ICONS: Record<ExecutionKind, LucideIcon> = {
  command: SquareTerminal,
  command_input: Keyboard,
  code_cell: Braces,
  code_wait: Hourglass,
  patch: FileDiff,
  mcp: Plug,
  web_search: Globe,
  tool_search: Search,
  image_generation: Image,
  plan: ListChecks,
  tool: Wrench,
};

/**
 * Label shown before an execution's command/summary.
 */
export function executionLabel(exec: Execution): string {
  switch (exec.kind) {
    case 'code_cell':
      return 'exec cell';
    case 'code_wait':
      return 'wait';
    case 'command_input':
      return 'stdin';
    case 'command':
      return exec.source === 'user_shell' ? 'user shell' : exec.name;
    case 'patch':
      // A call site found in a cell script is not a write until Codex records one.
      return isUnrecordedCallSite(exec) ? exec.name : 'file write';
    default:
      return exec.namespace ? `${exec.namespace}.${exec.name}` : exec.name;
  }
}

function isUnrecordedCallSite(exec: Execution): boolean {
  return exec.evidence.code !== undefined && exec.evidence.result === undefined;
}

/**
 * A patch execution Codex recorded a result for (a `FileChange` item, a
 * `patch_apply_end` event, a call's output). The timeline shows each one as
 * an entry of its own, also when it was recorded while a code cell ran.
 */
export function isRecordedFileWrite(exec: Execution): boolean {
  return exec.kind === 'patch' && exec.evidence.result !== undefined;
}

/**
 * The patch text of a patch execution's own call (`apply_patch` input or
 * argument, or the patch argv of a shell call). Script call sites and
 * file-change records have none.
 */
export function patchText(exec: Execution): string | undefined {
  if (exec.kind !== 'patch') {
    return undefined;
  }
  if (exec.source === 'custom_tool_call') {
    return exec.input;
  }
  const fromArgs = exec.args?.input ?? exec.args?.patch;
  if (typeof fromArgs === 'string') {
    return fromArgs;
  }
  return exec.argv && exec.argv.length > 1 ? exec.argv[1] : undefined;
}

/** The three ways Codex has encoded commands. */
const GENERATION_LABELS: Record<NonNullable<Execution['generation']>, string> = {
  function_call: 'function tool',
  local_shell: 'direct shell',
  code_mode: 'code mode',
};

export function generationLabel(exec: Execution): string | undefined {
  return exec.generation ? GENERATION_LABELS[exec.generation] : undefined;
}

/**
 * One-line summary for executions without a command.
 */
export function executionSummary(exec: Execution): string | undefined {
  if (exec.kind === 'patch') {
    return (
      fileWritesSummary(exec.fileWrites ?? []) ??
      (isUnrecordedCallSite(exec) ? undefined : exec.command)
    );
  }
  if (exec.command) {
    return exec.command;
  }
  if (exec.kind === 'code_cell') {
    // The nested operations are what matters; list them compactly. Recorded
    // file writes are entries of their own.
    const nested = (exec.children ?? [])
      .filter((child) => !isRecordedFileWrite(child))
      .map((child) => child.command ?? child.name);
    return nested.length > 0 ? nested.join(' · ') : firstLine(exec.input);
  }
  if (exec.kind === 'code_wait') {
    return exec.cellId ? `cell ${exec.cellId}` : undefined;
  }
  if (exec.kind === 'plan') {
    const plan = exec.args?.plan;
    return Array.isArray(plan) ? `${plan.length} step${plan.length === 1 ? '' : 's'}` : undefined;
  }
  if (exec.args) {
    const firstString = Object.values(exec.args).find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0
    );
    if (firstString) {
      return firstLine(firstString);
    }
  }
  return firstLine(exec.input);
}

function firstLine(text: string | undefined): string | undefined {
  const line = text?.trim().split('\n')[0];
  return line ? line : undefined;
}

// =============================================================================
// File writes and recorded command actions
// =============================================================================

/** "src/a.ts (added)", "src/b.ts → src/c.ts", "src/d.ts (deleted)", "src/e.ts". */
export function describeFileWrite(write: FileWrite): string {
  if (write.movedTo) {
    return `${write.path} → ${write.movedTo}`;
  }
  switch (write.change) {
    case 'add':
      return `${write.path} (added)`;
    case 'delete':
      return `${write.path} (deleted)`;
    default:
      return write.path;
  }
}

/** What a recorded file change carries: "unified diff" or "file content" ("…: empty"). */
export function recordedDiffLabel(diff: RecordedFileDiff): string {
  const what = diff.field === 'unified_diff' ? 'unified diff' : 'file content';
  return diff.text.length === 0 && !diff.omittedChars ? `${what}: empty` : what;
}

/** How much of a recorded file change was not loaded (size limit per file and per record). */
export function omittedDiffNote(diff: RecordedFileDiff): string | undefined {
  if (!diff.omittedChars) {
    return undefined;
  }
  const size = `${diff.omittedChars.toLocaleString('en-US')} characters`;
  return diff.text.length === 0
    ? `${size} recorded, not loaded (size limit per record)`
    : `… ${size} more recorded, not loaded (size limit)`;
}

/** "src/a.ts (added), src/b.ts" or "4 files: src/a.ts (added), src/b.ts, …". */
export function fileWritesSummary(writes: readonly FileWrite[]): string | undefined {
  if (writes.length === 0) {
    return undefined;
  }
  const shown = writes.slice(0, 3).map(describeFileWrite).join(', ');
  return writes.length > 3 ? `${writes.length} files: ${shown}, …` : shown;
}

/** Codex's own action types (`parsed_cmd`); types it adds later are shown as recorded. */
export function commandActionLabel(action: CommandAction): string {
  switch (action.type) {
    case 'read':
      return 'read';
    case 'list_files':
      return 'list';
    case 'search':
      return 'search';
    case 'unknown':
      return 'unclassified';
    default:
      return action.type;
  }
}

/** What an action is about: the file read, the directory listed, the query searched. */
export function commandActionTarget(action: CommandAction): string | undefined {
  switch (action.type) {
    case 'read':
      return action.name ?? action.path;
    case 'list_files':
      return action.path;
    case 'search':
      if (action.query && action.path) {
        return `"${action.query}" in ${action.path}`;
      }
      return action.query ? `"${action.query}"` : action.path;
    default:
      return undefined;
  }
}

/** Actions Codex could classify (`unknown` ones are left to the details panel). */
export function classifiedActions(exec: Execution): CommandAction[] {
  return (exec.commandActions ?? []).filter((action) => action.type !== 'unknown');
}

/** "3 reads · 1 search · 2 listings" from session stats. */
export function commandActionCounts(counts: Partial<Record<string, number>>): string | undefined {
  const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
  const parts = Object.entries(counts)
    .filter((entry): entry is [string, number] => (entry[1] ?? 0) > 0)
    .map(([type, n]) => {
      switch (type) {
        case 'read':
          return plural(n, 'read', 'reads');
        case 'search':
          return plural(n, 'search', 'searches');
        case 'list_files':
          return plural(n, 'listing', 'listings');
        default:
          return `${n} ${type}`;
      }
    });
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

// =============================================================================
// Evidence
// =============================================================================

export interface EvidenceBadge {
  label: string;
  title: string;
}

function describeRecord(record: RecordEvidence): string {
  return `${record.recordType}, rollout line ${record.lineNumber}`;
}

/**
 * Evidence badge for a nested execution or an unlinked item record. Direct
 * calls with their own call and output records get none.
 */
export function evidenceBadge(exec: Execution): EvidenceBadge | undefined {
  const { observed, result, cellLink, callSiteLink } = exec.evidence;
  if (isStaticOnly(exec)) {
    return {
      label: 'script only',
      title:
        'Found in the cell script by static analysis. Codex recorded nothing for this call, so it may not have run.',
    };
  }
  if (observed?.kind === 'inventory' && !result) {
    return {
      label: 'attempted',
      title: 'Listed by Codex as attempted; no result was recorded for this call.',
    };
  }
  if (callSiteLink?.method === 'content' && result) {
    return {
      label: 'script + record',
      title: `Call site linked to ${describeRecord(result)} by identical command text.`,
    };
  }
  if (observed?.kind === 'item' && cellLink?.method === 'turn_window') {
    return {
      label: 'recorded',
      title: `Recorded by Codex (${describeRecord(observed)}). Attributed to this cell by turn and record order; no identifier links them.`,
    };
  }
  if (observed?.kind === 'item' && cellLink?.method === 'unresolved') {
    return {
      label: 'unlinked record',
      title: `Recorded by Codex (${describeRecord(observed)}). ${cellLink.detail ?? 'Not linked to a call.'}`,
    };
  }
  return undefined;
}

const DURATION_SOURCE_TEXT: Record<DurationSource, string> = {
  reported: 'reported by Codex',
  provider_timestamps: 'from Codex start and end times',
  record_timestamps: 'between rollout records',
};

export function durationSourceLabel(source: DurationSource | undefined): string {
  return source ? DURATION_SOURCE_TEXT[source] : 'source unknown';
}

/**
 * Local wall-clock time (HH:MM:SS) of an ISO timestamp.
 */
export function formatClockTime(iso: string | undefined): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Coarse relative time ("just now", "5m ago", "3h ago", "2d ago").
 */
export function formatRelativeTime(timestampMs: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestampMs) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestampMs).toLocaleDateString();
}

/**
 * Last 8 characters of a call id, for compact display.
 */
export function shortCallId(id: string): string {
  const base = id.split(':')[0];
  return base.length > 8 ? base.slice(-8) : base;
}

// =============================================================================
// Timeline filtering
// =============================================================================

/** Timeline filters (applied by `filterTimelineRows` in `codexTimelineRows.ts`) */
export type CodexTimelineFilter = 'all' | 'executions' | 'problems';
