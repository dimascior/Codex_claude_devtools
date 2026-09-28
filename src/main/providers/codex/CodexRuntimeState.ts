/**
 * CodexRuntimeState - Runtime settings of a Codex rollout: the effective
 * settings of each turn (`turn_context`) and the thread settings Codex recorded
 * (`thread_settings_applied`), with the changes between them.
 *
 * Rules, from the 61-rollout survey
 * (docs/codex-real-validation/runtime-state-survey-2026-09-28.md):
 * - The first `turn_context` of a turn is that turn's effective state. Codex
 *   writes it again after a mid-turn compaction with the same settings; a later
 *   one that differs is reported as a warning and never replaces the first.
 * - `thread_settings_applied` records the thread's settings. A value that
 *   differs from the one recorded before is a transition, effective from the
 *   next turn state; the turn already running keeps its settings. Identical
 *   repeats are not transitions. The first record has nothing to differ from.
 * - Where no recorded transition can account for a change (sessions without
 *   thread settings, and turns up to the first thread settings record), the
 *   effective states of consecutive turns are compared instead. Such changes are
 *   marked `turn_context_diff`: the viewer observed them, Codex recorded no event.
 * - `summary` (per turn) and `reasoning_summary` (thread) are different fields;
 *   `service_tier` is only recorded for the thread. Values are compared only
 *   when both states record them.
 * - Windows paths are compared without regard to letter case or separator
 *   style; the provider's spelling is kept for display.
 */

import type { CodexRolloutRecord } from './types';
import type {
  RuntimeSettingKey,
  RuntimeSettings,
  RuntimeSettingsChange,
  RuntimeSettingValue,
  SessionRuntimeState,
  SettingsChangeEntry,
  ThreadSettingsState,
  TurnRuntimeState,
} from '@main/domain';

/** Order in which changes are listed. */
const FIELD_ORDER: readonly RuntimeSettingKey[] = [
  'model',
  'reasoningEffort',
  'approvalPolicy',
  'approvalsReviewer',
  'sandboxPolicy',
  'fileSystemSandboxPolicy',
  'permissionProfile',
  'activePermissionProfile',
  'collaborationMode',
  'personality',
  'serviceTier',
  'reasoningSummary',
  'turnSummary',
  'cwd',
  'workspaceRootCount',
  'realtimeActive',
];

/** `turn_context` keys, for warnings. */
const TURN_CONTEXT_KEYS: Partial<Record<RuntimeSettingKey, string>> = {
  model: 'model',
  reasoningEffort: 'effort',
  turnSummary: 'summary',
  approvalPolicy: 'approval_policy',
  approvalsReviewer: 'approvals_reviewer',
  sandboxPolicy: 'sandbox_policy',
  fileSystemSandboxPolicy: 'file_system_sandbox_policy',
  permissionProfile: 'permission_profile',
  activePermissionProfile: 'active_permission_profile',
  collaborationMode: 'collaboration_mode',
  personality: 'personality',
  cwd: 'cwd',
  workspaceRootCount: 'workspace_roots',
  realtimeActive: 'realtime_active',
};

/**
 * Effective settings recorded in a `turn_context` payload.
 */
function turnContextSettings(payload: Record<string, unknown>): RuntimeSettings {
  const sandbox = payload.sandbox_policy;
  return compact({
    model: str(payload.model),
    reasoningEffort: str(payload.effort),
    turnSummary: str(payload.summary),
    approvalPolicy: str(payload.approval_policy),
    approvalsReviewer: str(payload.approvals_reviewer),
    // Older rollouts record the sandbox as `{ mode }` instead of `{ type }`.
    sandboxPolicy: variant(sandbox, 'type') ?? (isRecord(sandbox) ? str(sandbox.mode) : undefined),
    fileSystemSandboxPolicy: variant(payload.file_system_sandbox_policy, 'kind'),
    permissionProfile: variant(payload.permission_profile, 'type'),
    activePermissionProfile: variant(payload.active_permission_profile, 'id'),
    collaborationMode: variant(payload.collaboration_mode, 'mode'),
    personality: str(payload.personality),
    cwd: str(payload.cwd),
    workspaceRootCount: Array.isArray(payload.workspace_roots)
      ? payload.workspace_roots.length
      : undefined,
    realtimeActive:
      typeof payload.realtime_active === 'boolean' ? payload.realtime_active : undefined,
  });
}

/**
 * Settings recorded in a `thread_settings_applied` payload's `thread_settings`.
 */
function threadSettings(settings: Record<string, unknown>): RuntimeSettings {
  return compact({
    model: str(settings.model),
    reasoningEffort: str(settings.reasoning_effort),
    reasoningSummary: str(settings.reasoning_summary),
    approvalPolicy: str(settings.approval_policy),
    approvalsReviewer: str(settings.approvals_reviewer),
    sandboxPolicy: variant(settings.sandbox_policy, 'type'),
    permissionProfile: variant(settings.permission_profile, 'type'),
    activePermissionProfile: variant(settings.active_permission_profile, 'id'),
    collaborationMode: variant(settings.collaboration_mode, 'mode'),
    personality: str(settings.personality),
    serviceTier: str(settings.service_tier),
    cwd: str(settings.cwd),
  });
}

/**
 * Whether two working directories name the same place. Windows paths (drive or
 * UNC) ignore letter case and separator style there; other paths must be equal.
 */
function sameCwd(a: string, b: string): boolean {
  if (a === b) return true;
  const windows = /^(?:[A-Za-z]:[\\/]|\\\\)/;
  if (!windows.test(a) || !windows.test(b)) return false;
  const key = (path: string): string => {
    let normalized = path.replace(/\//g, '\\').toLowerCase();
    while (normalized.endsWith('\\')) normalized = normalized.slice(0, -1);
    return normalized;
  };
  return key(a) === key(b);
}

/**
 * Settings whose value differs between two states. A setting either state does
 * not record is not compared.
 */
function diffSettings(previous: RuntimeSettings, next: RuntimeSettings): RuntimeSettingsChange[] {
  const changes: RuntimeSettingsChange[] = [];
  for (const field of FIELD_ORDER) {
    const before = previous[field];
    const after = next[field];
    if (before === undefined || after === undefined || sameValue(field, before, after)) continue;
    changes.push({ field, previous: before, next: after });
  }
  return changes;
}

/**
 * Collects runtime state from a rollout's own records (inherited parent history
 * excluded), in file order.
 */
export class CodexRuntimeStateBuilder {
  private readonly turns: TurnRuntimeState[] = [];
  private readonly byTurnId = new Map<string, TurnRuntimeState>();
  private readonly recorded: SettingsChangeEntry[] = [];
  private readonly warnings: string[] = [];
  private thread: ThreadSettingsState | undefined;
  /** Line of the first thread settings record */
  private recordedFrom: number | undefined;
  private turnOpen = false;
  private openTurnId: string | undefined;
  /** State of the open turn, for turns whose records carry no turn id */
  private openTurnState: TurnRuntimeState | undefined;

  turnStarted(turnId: string | undefined): void {
    this.turnOpen = true;
    this.openTurnId = turnId;
    this.openTurnState = turnId !== undefined ? this.byTurnId.get(turnId) : undefined;
  }

  turnEnded(): void {
    this.turnOpen = false;
    this.openTurnId = undefined;
    this.openTurnState = undefined;
  }

  turnContext(record: CodexRolloutRecord, timestamp: string | undefined): void {
    const recordTurnId = str(record.payload.turn_id);
    const inOpenTurn =
      this.turnOpen && (recordTurnId === undefined || recordTurnId === this.openTurnId);
    const turnId = recordTurnId ?? (inOpenTurn ? this.openTurnId : undefined);
    const settings = turnContextSettings(record.payload);

    const first =
      (turnId !== undefined ? this.byTurnId.get(turnId) : undefined) ??
      (inOpenTurn ? this.openTurnState : undefined);
    if (first) {
      const differing = diffSettings(first.settings, settings);
      if (differing.length > 0) {
        const keys = differing.map((change) => TURN_CONTEXT_KEYS[change.field] ?? change.field);
        this.warnings.push(
          `turn_context at line ${record.lineNumber} differs from the first turn_context of its turn (line ${first.lineNumber}) in ${keys.join(', ')}; the first is kept as the turn's effective settings`
        );
      }
      return;
    }

    const state: TurnRuntimeState = {
      turnId,
      lineNumber: record.lineNumber,
      timestamp,
      settings,
    };
    this.turns.push(state);
    if (turnId !== undefined) this.byTurnId.set(turnId, state);
    if (inOpenTurn) this.openTurnState = state;
  }

  threadSettings(
    record: CodexRolloutRecord,
    timestamp: string | undefined,
    event: { threadId?: string; settings: Record<string, unknown> },
    ownThreadId: string | undefined
  ): void {
    // Settings addressed to another thread say nothing about this one.
    if (event.threadId && ownThreadId && event.threadId !== ownThreadId) return;
    const settings = threadSettings(event.settings);
    const previous = this.thread;
    this.thread = {
      lineNumber: record.lineNumber,
      timestamp,
      settings: previous ? { ...previous.settings, ...settings } : settings,
    };
    if (!previous) {
      this.recordedFrom = record.lineNumber;
      return;
    }
    const changes = diffSettings(previous.settings, settings);
    if (changes.length === 0) return;
    this.recorded.push({
      kind: 'settings_change',
      id: `s-${record.lineNumber}`,
      timestamp,
      lineNumber: record.lineNumber,
      turnId: this.turnOpen ? this.openTurnId : undefined,
      source: 'thread_settings_applied',
      appliesTo: this.turns.length === 0 ? 'first_turn' : 'next_turn',
      changes,
    });
  }

  /**
   * The collected state, the settings-change entries (recorded transitions and
   * observed turn-to-turn changes) and warnings.
   */
  finish(): {
    runtime: SessionRuntimeState;
    entries: SettingsChangeEntry[];
    warnings: string[];
  } {
    const { recordedFrom } = this;
    const observed: SettingsChangeEntry[] = [];
    for (let i = 1; i < this.turns.length; i++) {
      const previous = this.turns[i - 1];
      const current = this.turns[i];
      // Recorded transitions account for this step when thread settings were
      // already recorded before the earlier turn's state.
      if (recordedFrom !== undefined && recordedFrom < previous.lineNumber) continue;
      const changes = diffSettings(previous.settings, current.settings);
      if (changes.length === 0) continue;
      observed.push({
        kind: 'settings_change',
        id: `s-${current.lineNumber}`,
        timestamp: current.timestamp,
        lineNumber: current.lineNumber,
        turnId: current.turnId,
        source: 'turn_context_diff',
        appliesTo: 'this_turn',
        changes,
        previousLineNumber: previous.lineNumber,
      });
    }
    return {
      runtime: {
        turns: this.turns,
        thread: this.thread,
        recordedSettingsFrom: recordedFrom,
      },
      entries: [...this.recorded, ...observed],
      warnings: this.warnings,
    };
  }
}

// =============================================================================
// Helpers
// =============================================================================

function sameValue(
  field: RuntimeSettingKey,
  a: RuntimeSettingValue,
  b: RuntimeSettingValue
): boolean {
  if (field === 'cwd' && typeof a === 'string' && typeof b === 'string') return sameCwd(a, b);
  return a === b;
}

/** A tagged setting's variant: the value itself, or `value[key]` of an object. */
function variant(value: unknown, key: string): string | undefined {
  if (typeof value === 'string') return str(value);
  return isRecord(value) ? str(value[key]) : undefined;
}

function compact(settings: RuntimeSettings): RuntimeSettings {
  const out: RuntimeSettings = {};
  for (const field of FIELD_ORDER) {
    const value = settings[field];
    if (value !== undefined) (out as Record<RuntimeSettingKey, RuntimeSettingValue>)[field] = value;
  }
  return out;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
