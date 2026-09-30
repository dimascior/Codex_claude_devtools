/**
 * Provider-neutral runtime state: the model and policies a session ran under.
 *
 * Settings are recorded at two levels, which are kept apart:
 * - per turn: the effective values a turn ran with (Codex `turn_context`)
 * - per thread: settings the provider recorded for the thread (Codex
 *   `thread_settings_applied`), including ones that have no per-turn record
 *
 * Executions are not given a copy of their turn's state; they are related to it
 * through `Execution.turnId`.
 */

/**
 * Normalized settings. Values are the provider's own strings, kept verbatim
 * (enum values such as `on-request` or `xhigh`, model names, paths).
 */
export interface RuntimeSettings {
  model?: string;
  reasoningEffort?: string;
  /**
   * Summary mode recorded with each turn (Codex `turn_context.summary`). Not the
   * same field as `reasoningSummary`: real rollouts record `auto` here while the
   * thread setting reads `none` or `detailed`.
   */
  turnSummary?: string;
  /** Reasoning summary thread setting (Codex `thread_settings.reasoning_summary`) */
  reasoningSummary?: string;
  approvalPolicy?: string;
  /** Who reviews approval requests */
  approvalsReviewer?: string;
  /** Sandbox policy type (e.g. `workspace-write`) */
  sandboxPolicy?: string;
  /** File-system sandbox policy kind (e.g. `restricted`) */
  fileSystemSandboxPolicy?: string;
  /** Permission profile type (e.g. `disabled`, `managed`) */
  permissionProfile?: string;
  /** Id of the active permission profile (built-in ids start with `:`) */
  activePermissionProfile?: string;
  collaborationMode?: string;
  personality?: string;
  /** Recorded only as a thread setting in the observed Codex rollouts */
  serviceTier?: string;
  /** Working directory, as the provider spelled it */
  cwd?: string;
  /** Number of workspace roots (the roots themselves are not kept) */
  workspaceRootCount?: number;
  realtimeActive?: boolean;
}

export type RuntimeSettingKey = keyof RuntimeSettings;

export type RuntimeSettingValue = string | number | boolean;

/** One setting that differs between two states. */
export interface RuntimeSettingsChange {
  field: RuntimeSettingKey;
  previous: RuntimeSettingValue;
  next: RuntimeSettingValue;
}

/**
 * The effective settings of one turn: the first turn context recorded for it.
 * Later records for the same turn repeat it (Codex writes them again after a
 * mid-turn compaction) and do not replace it.
 */
export interface TurnRuntimeState {
  /** Provider turn id; absent when the record names no turn and none was open */
  turnId?: string;
  /** 1-based line of the turn context record that set this state */
  lineNumber: number;
  timestamp?: string;
  settings: RuntimeSettings;
}

/** Thread settings as last recorded by the provider. */
export interface ThreadSettingsState {
  /** 1-based line of the latest thread settings record */
  lineNumber: number;
  timestamp?: string;
  /** Latest recorded value of each setting */
  settings: RuntimeSettings;
}

/**
 * Where a settings change shown in the timeline comes from.
 * - `thread_settings_applied`: a transition the provider recorded
 * - `turn_context_diff`: the effective settings of two consecutive turns differ;
 *   observed by the viewer, no provider event records it
 */
export type SettingsChangeSource = 'thread_settings_applied' | 'turn_context_diff';

export interface SessionRuntimeState {
  /** Effective settings per turn, in file order */
  turns: TurnRuntimeState[];
  /** Latest recorded thread settings, when the session records any */
  thread?: ThreadSettingsState;
  /**
   * Line of the first recorded thread settings. A change between two
   * consecutive turns is left to the recorded transitions when the earlier
   * turn's state comes after this line; otherwise (and in sessions without
   * thread settings) it is observed by comparing the two turn states.
   */
  recordedSettingsFrom?: number;
}
