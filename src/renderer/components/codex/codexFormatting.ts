/**
 * Display helpers for the Codex execution timeline.
 */

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

import type { Execution, ExecutionKind, ExecutionStatus, TimelineEntry } from '@shared/types';

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
      return 'not recorded';
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
