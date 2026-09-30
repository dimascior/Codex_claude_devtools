/**
 * Display helpers for Codex runtime settings: labels and values, the current
 * state shown in the session header, an execution's effective runtime, and how
 * a settings change is described.
 *
 * A transition Codex recorded (`thread_settings_applied`) and a change the
 * viewer observed between two turns' effective settings (`turn_context_diff`)
 * are always described differently: no provider event records the second kind.
 */

import type {
  RuntimeSettingKey,
  RuntimeSettings,
  RuntimeSettingValue,
  SessionRuntimeState,
  SettingsChangeEntry,
  ThreadSettingsState,
  TurnRuntimeState,
} from '@shared/types';

export const RUNTIME_FIELD_LABELS: Record<RuntimeSettingKey, string> = {
  model: 'Model',
  reasoningEffort: 'Reasoning effort',
  turnSummary: 'Turn summary mode',
  reasoningSummary: 'Reasoning summary setting',
  approvalPolicy: 'Approval policy',
  approvalsReviewer: 'Approvals reviewer',
  sandboxPolicy: 'Sandbox',
  fileSystemSandboxPolicy: 'File-system sandbox',
  permissionProfile: 'Permission profile',
  activePermissionProfile: 'Active permission profile',
  collaborationMode: 'Collaboration mode',
  personality: 'Personality',
  serviceTier: 'Service tier',
  cwd: 'Working dir',
  workspaceRootCount: 'Workspace roots',
  realtimeActive: 'Realtime',
};

/** The header line: what most shapes how a turn runs. */
const HEADER_FIELDS: readonly RuntimeSettingKey[] = [
  'model',
  'reasoningEffort',
  'approvalPolicy',
  'sandboxPolicy',
  'permissionProfile',
];

const HEADER_LABELS: Partial<Record<RuntimeSettingKey, string>> = {
  reasoningEffort: 'Effort',
  approvalPolicy: 'Approval',
  permissionProfile: 'Profile',
};

/** The other current settings, behind the header's details toggle. */
const DETAIL_FIELDS: readonly RuntimeSettingKey[] = [
  'serviceTier',
  'collaborationMode',
  'personality',
  'activePermissionProfile',
  'approvalsReviewer',
  'fileSystemSandboxPolicy',
  'turnSummary',
  'reasoningSummary',
  'cwd',
  'workspaceRootCount',
  'realtimeActive',
];

/** Settings of the turn an execution ran in (its working dir is in its own facts). */
const EXECUTION_FIELDS: readonly RuntimeSettingKey[] = [
  'model',
  'reasoningEffort',
  'turnSummary',
  'approvalPolicy',
  'approvalsReviewer',
  'sandboxPolicy',
  'fileSystemSandboxPolicy',
  'permissionProfile',
  'activePermissionProfile',
  'collaborationMode',
  'personality',
];

export interface RuntimeRow {
  field: RuntimeSettingKey;
  label: string;
  value: string;
}

export interface RuntimeGroup {
  title: string;
  /** The record the values come from */
  source: string;
  /** What the values mean */
  description: string;
  rows: RuntimeRow[];
}

function formatRuntimeValue(field: RuntimeSettingKey, value: RuntimeSettingValue): string {
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (field === 'workspaceRootCount' && typeof value === 'number') {
    return `${value} ${value === 1 ? 'root' : 'roots'}`;
  }
  return String(value);
}

function settingRows(
  settings: RuntimeSettings,
  fields: readonly RuntimeSettingKey[]
): RuntimeRow[] {
  return fields.flatMap((field) => {
    const value = settings[field];
    return value === undefined
      ? []
      : [{ field, label: RUNTIME_FIELD_LABELS[field], value: formatRuntimeValue(field, value) }];
  });
}

export function turnStateSource(state: TurnRuntimeState): string {
  return `turn_context · rollout line ${state.lineNumber}`;
}

function threadStateSource(state: ThreadSettingsState): string {
  return `thread_settings_applied · rollout line ${state.lineNumber}`;
}

// =============================================================================
// Current state (session header)
// =============================================================================

export interface CurrentRuntime {
  /** Header items, from the latest effective turn state */
  primary: RuntimeRow[];
  /** Source of the header items */
  source?: string;
  /** The other current settings: the latest turn's, then thread-level ones */
  details: RuntimeGroup[];
}

/**
 * The session's current runtime: the latest effective turn state, plus the
 * recorded thread settings that state does not carry (e.g. the service tier,
 * which Codex records only for the thread). Undefined when the session records
 * neither.
 */
export function currentRuntime(
  runtime: SessionRuntimeState | undefined
): CurrentRuntime | undefined {
  if (!runtime) return undefined;
  const turn = runtime.turns.length > 0 ? runtime.turns[runtime.turns.length - 1] : undefined;
  const { thread } = runtime;
  if (!turn && !thread) return undefined;
  const effective = turn?.settings ?? {};

  const details: RuntimeGroup[] = [];
  const turnRows = settingRows(effective, DETAIL_FIELDS);
  if (turn && turnRows.length > 0) {
    details.push({
      title: 'Latest turn',
      source: turnStateSource(turn),
      description: 'Effective settings of the latest turn: its first turn_context record.',
      rows: turnRows,
    });
  }
  const threadRows = thread
    ? settingRows(
        thread.settings,
        [...HEADER_FIELDS, ...DETAIL_FIELDS].filter((field) => effective[field] === undefined)
      )
    : [];
  if (thread && threadRows.length > 0) {
    details.push({
      title: 'Thread settings',
      source: threadStateSource(thread),
      description:
        'Latest thread settings Codex recorded that the latest turn record does not carry. A thread setting recorded after the latest turn applies from the next turn.',
      rows: threadRows,
    });
  }

  return {
    primary: settingRows(effective, HEADER_FIELDS).map((row) => ({
      ...row,
      label: HEADER_LABELS[row.field] ?? row.label,
    })),
    source: turn ? turnStateSource(turn) : undefined,
    details,
  };
}

// =============================================================================
// Effective runtime of an execution's turn
// =============================================================================

/** Effective turn states by turn id, for resolving an execution's runtime. */
export function turnStatesById(
  runtime: SessionRuntimeState | undefined
): ReadonlyMap<string, TurnRuntimeState> {
  const byId = new Map<string, TurnRuntimeState>();
  for (const turn of runtime?.turns ?? []) {
    if (turn.turnId) byId.set(turn.turnId, turn);
  }
  return byId;
}

export function executionRuntimeRows(state: TurnRuntimeState): RuntimeRow[] {
  return settingRows(state.settings, EXECUTION_FIELDS);
}

// =============================================================================
// Settings changes (timeline)
// =============================================================================

export function isRecordedChange(entry: SettingsChangeEntry): boolean {
  return entry.source === 'thread_settings_applied';
}

export function settingsChangeTitle(entry: SettingsChangeEntry): string {
  return isRecordedChange(entry) ? 'Settings changed' : 'Runtime state changed';
}

export function settingsChangeScope(entry: SettingsChangeEntry): string {
  switch (entry.appliesTo) {
    case 'first_turn':
      return 'Applies from the first turn';
    case 'next_turn':
      return 'Applies from the next turn';
    case 'this_turn':
      return 'Observed at this turn';
  }
}

export function settingsChangeOrigin(entry: SettingsChangeEntry): string {
  if (isRecordedChange(entry)) return `Recorded by Codex · rollout line ${entry.lineNumber}`;
  return entry.previousLineNumber !== undefined
    ? `Derived from effective turn contexts · rollout lines ${entry.previousLineNumber}, ${entry.lineNumber}`
    : `Derived from effective turn contexts · rollout line ${entry.lineNumber}`;
}

export function settingsChangeExplanation(entry: SettingsChangeEntry): string {
  if (!isRecordedChange(entry)) {
    return "Codex recorded no settings event for this change: this turn's effective settings (its first turn_context) differ from the previous turn's. Settings not listed did not change.";
  }
  const during = entry.turnId
    ? ' It was recorded while a turn was running; that turn keeps its settings.'
    : '';
  return `Codex recorded new thread settings (thread_settings_applied).${during} Settings not listed did not change.`;
}

export function changeRows(
  entry: SettingsChangeEntry
): { field: RuntimeSettingKey; label: string; previous: string; next: string }[] {
  return entry.changes.map((change) => ({
    field: change.field,
    label: RUNTIME_FIELD_LABELS[change.field],
    previous: formatRuntimeValue(change.field, change.previous),
    next: formatRuntimeValue(change.field, change.next),
  }));
}
