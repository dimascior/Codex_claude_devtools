/**
 * Display helpers for the Codex execution timeline.
 */

import { isStaticOnly } from '@shared/utils/executionEvidence';
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
  CorrelationMethod,
  DurationSource,
  Execution,
  ExecutionKind,
  ExecutionStatus,
  FileWrite,
  RecordEvidence,
  TimelineEntry,
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
      return 'file write';
    default:
      return exec.namespace ? `${exec.namespace}.${exec.name}` : exec.name;
  }
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
    return fileWritesSummary(exec.fileWrites ?? []) ?? exec.command;
  }
  if (exec.command) {
    return exec.command;
  }
  if (exec.kind === 'code_cell') {
    // The nested operations are what matters; list them compactly.
    const nested = (exec.children ?? []).map((child) => child.command ?? child.name);
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

const CORRELATION_TEXT: Record<CorrelationMethod, string> = {
  explicit_id: 'shared identifier',
  turn_window: 'same turn, only running cell (record order)',
  content: 'identical content',
  unresolved: 'not linked',
};

function sameRecord(a: RecordEvidence, b: RecordEvidence): boolean {
  return a.lineNumber === b.lineNumber && a.recordType === b.recordType;
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

/**
 * Lines describing what is known about an execution and how it was linked.
 */
export function describeEvidence(exec: Execution): string[] {
  const { code, observed, result, cellLink, callSiteLink } = exec.evidence;
  const lines: string[] = [];
  if (code) {
    lines.push(
      `Script call site at line ${code.line} of the cell${code.dynamic ? ' (arguments only known at runtime)' : ''}`
    );
  }
  if (observed) {
    lines.push(`Observed: ${describeRecord(observed)}`);
  }
  if (result && !(observed && sameRecord(result, observed))) {
    lines.push(`Result: ${describeRecord(result)}`);
  } else if (!result) {
    lines.push('Result: none recorded');
  }
  if (cellLink) {
    const detail = cellLink.detail ? ` (${cellLink.detail})` : '';
    // A top-level record has no cell: its link is to a call, or says why none was found.
    const label = exec.parentId ? 'Cell link' : 'Attribution';
    lines.push(`${label}: ${CORRELATION_TEXT[cellLink.method]}${detail}`);
  }
  if (callSiteLink) {
    const detail = callSiteLink.detail ? ` (${callSiteLink.detail})` : '';
    lines.push(`Call site link: ${CORRELATION_TEXT[callSiteLink.method]}${detail}`);
  }
  return lines;
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

export type CodexTimelineFilter = 'all' | 'executions' | 'problems';

const PROBLEM_STATUSES = new Set(['failed', 'declined', 'interrupted']);

function hasProblem(exec: Execution): boolean {
  return (
    PROBLEM_STATUSES.has(exec.status) ||
    (exec.children ?? []).some((child) => PROBLEM_STATUSES.has(child.status))
  );
}

export function filterTimeline(
  timeline: readonly TimelineEntry[],
  filter: CodexTimelineFilter
): TimelineEntry[] {
  switch (filter) {
    case 'all':
      return [...timeline];
    case 'executions':
      return timeline.filter((entry) => entry.kind === 'execution');
    case 'problems':
      return timeline.filter(
        (entry) =>
          entry.kind === 'turn_event' || (entry.kind === 'execution' && hasProblem(entry.execution))
      );
  }
}
