/**
 * Provider-neutral execution model.
 *
 * An Execution is one operation an agent asked its harness to perform: a shell
 * command, a patch, an MCP call, a code-mode cell and so on. Providers encode
 * these very differently on disk (Codex alone has three generations of command
 * encoding); each provider's parser normalizes into this shape so the renderer
 * never needs to know where an execution came from.
 */

/** Agent runtime that produced a session. */
export type AgentProvider = 'claude' | 'codex';

/**
 * What an execution does, independent of how the provider encoded it.
 */
export type ExecutionKind =
  /** A shell command (argv or script) */
  | 'command'
  /** Input written to an already-running command session (e.g. Codex `write_stdin`) */
  | 'command_input'
  /** A code-mode cell that dispatches nested tool calls from a script */
  | 'code_cell'
  /** A poll on a yielded code-mode cell (Codex `wait`) */
  | 'code_wait'
  /** A file edit expressed as a patch */
  | 'patch'
  /** A Model Context Protocol tool call */
  | 'mcp'
  | 'web_search'
  | 'tool_search'
  | 'image_generation'
  /** A plan/checklist update */
  | 'plan'
  /** Any other tool */
  | 'tool';

/**
 * Lifecycle state of an execution as far as the persisted record shows.
 */
export type ExecutionStatus =
  /** No result yet and the session is still active */
  | 'running'
  /** A result was recorded and nothing indicates failure (exit code 0 when known) */
  | 'completed'
  /** Non-zero exit code or an error result */
  | 'failed'
  /** Rejected by the user or the approval policy */
  | 'declined'
  /** Aborted or terminated before it finished */
  | 'interrupted'
  /** No result was persisted (e.g. per-call results inside a code cell) */
  | 'unknown';

/**
 * How the command encoding was produced. Codex has used three generations:
 * - `function_call`: model-visible function tools (`shell`, `shell_command`, `exec_command`, …)
 * - `local_shell`: the Responses API `local_shell_call` item
 * - `code_mode`: nested calls dispatched from a code-mode `exec` cell
 */
export type ExecutionGeneration = 'function_call' | 'local_shell' | 'code_mode';

/**
 * Provider record classes that can evidence an execution.
 * - `call`: a model-issued call record (`function_call`, `custom_tool_call`, hosted calls)
 * - `output`: the call's output record (`function_call_output`, `custom_tool_call_output`, …)
 * - `item`: a harness item or event record (`item_completed`, `exec_command_end`, …)
 * - `inventory`: an entry in a provider-recorded list of nested calls (`executed_tool_calls`)
 */
export type RecordEvidenceKind = 'call' | 'output' | 'item' | 'inventory';

export interface RecordEvidence {
  kind: RecordEvidenceKind;
  /** Provider record type, e.g. `custom_tool_call` or `item_completed/FileChange` */
  recordType: string;
  /** 1-based line of the record in the session file */
  lineNumber: number;
  /** Provider id carried by the record (call id or item id) */
  recordId?: string;
}

/** A call site in a code-mode cell script, found by static analysis. */
interface CodeEvidence {
  /** 1-based line of the call site within the cell source */
  line: number;
  /** Whether the call's arguments are only known at runtime */
  dynamic: boolean;
}

/**
 * How one record was related to another, strongest first.
 * - `explicit_id`: the records share an identifier
 * - `turn_window`: same turn id, recorded while exactly one code cell of that
 *   turn was running (record order); no identifier links them
 * - `content`: matched by content (identical normalized command); used only
 *   when the match is unique on both sides
 * - `unresolved`: no defensible relation could be established
 */
export type CorrelationMethod = 'explicit_id' | 'turn_window' | 'content' | 'unresolved';

export interface EvidenceLink {
  method: CorrelationMethod;
  /** Why this method applies (or why no link could be made) */
  detail?: string;
}

/**
 * What is actually known about an execution. The classes are kept apart
 * because they mean different things:
 * - `code`: represented in a code-mode script. A `tools.x(...)` expression is
 *   not evidence that anything ran.
 * - `observed`: a provider record shows the operation was attempted
 * - `result`: a provider record carries the operation's result
 * An execution with `code` and neither `observed` nor `result` is inferred by
 * static parsing only (see `isStaticOnly` in `@shared/utils/executionEvidence`).
 */
export interface ExecutionEvidence {
  code?: CodeEvidence;
  observed?: RecordEvidence;
  result?: RecordEvidence;
  /**
   * Nested item records: how the item was attributed to its code cell.
   * Top-level item records: how the item was linked to a call recorded after it
   * (`explicit_id`, e.g. a hosted search item persisted before its call), or
   * why no call or cell could be linked (`unresolved`).
   */
  cellLink?: EvidenceLink;
  /** How a recorded item was matched to a call site (script or inventory entry) */
  callSiteLink?: EvidenceLink;
  /**
   * The file-change record (`FileChange` item or `patch_apply_end` event) Codex
   * wrote under the id of an execution that is not itself a patch, such as a
   * shell call that ran one. It evidences `fileWrites` and `fileChangeStatus`,
   * not the execution's own outcome.
   */
  fileChange?: RecordEvidence;
}

/**
 * Where `durationMs` came from.
 * - `reported`: measured by the provider (a duration field or an output header wall time)
 * - `provider_timestamps`: computed from the provider's own start/completion timestamps
 * - `record_timestamps`: computed from the envelope timestamps of the call and result records
 */
export type DurationSource = 'reported' | 'provider_timestamps' | 'record_timestamps';

/**
 * What a shell command does, as the provider classified it when it ran (Codex
 * `parsed_cmd`). Recorded, never derived from the command text by this app, so
 * most commands have none.
 */
export interface CommandAction {
  /** `read`, `list_files`, `search` or `unknown` (Codex's own types; others kept verbatim) */
  type: string;
  /** The command, or the part of a pipeline, the action was parsed from */
  command?: string;
  /** File name, for reads */
  name?: string;
  /** Path read, listed or searched */
  path?: string;
  /** Search query */
  query?: string;
}

/**
 * A file a patch execution writes. The change comes from the provider's record
 * of the applied patch, or from the patch's own file headers.
 */
export interface FileWrite {
  path: string;
  change?: 'add' | 'update' | 'delete';
  /** New path when an update also moved the file */
  movedTo?: string;
}

export interface Execution {
  /** Provider call id (e.g. `call_…`), or `${parentId}:${index}` for nested calls */
  id: string;
  /** Parent execution id (code cell for nested calls, cell for `wait` polls) */
  parentId?: string;
  provider: AgentProvider;
  kind: ExecutionKind;
  /** Command encoding generation, when the execution is a command */
  generation?: ExecutionGeneration;
  /** Raw record type the execution was read from (e.g. `function_call`, `local_shell_call`) */
  source: string;
  /** Tool name exactly as invoked (e.g. `exec_command`, `shell`, `exec`, `apply_patch`) */
  name: string;
  /** Tool namespace, when the provider records one (MCP server, dynamic tool namespace) */
  namespace?: string;
  /** Human-readable command: the script body for `bash -lc …`, otherwise the joined argv */
  command?: string;
  /** Exact argv when the provider recorded one */
  argv?: string[];
  /** Shell or interpreter wrapping the command (bash, powershell, cmd, …) */
  shell?: string;
  /** Working directory the command ran in (explicit workdir or the turn's cwd) */
  cwd?: string;
  /** Raw input as persisted (JSON arguments string or freeform input) */
  input?: string;
  /** Parsed arguments when the input is a JSON object */
  args?: Record<string, unknown>;
  /** Output text as the model saw it, with recognised status headers stripped */
  output?: string;
  /** Number of output records merged into `output` */
  outputCount?: number;
  /** Whether `output` was shortened for transport */
  outputTruncated?: boolean;
  /** Number of images attached to the output (image data is never transported) */
  outputImageCount?: number;
  exitCode?: number;
  status: ExecutionStatus;
  /** Short explanation of the status (e.g. "Process running with session ID 3") */
  statusDetail?: string;
  /** ISO timestamp when the call was recorded */
  timestamp: string;
  /** ISO timestamp when the final output was recorded */
  completedAt?: string;
  /** Duration in ms (see `durationSource`) */
  durationMs?: number;
  /** Where `durationMs` came from */
  durationSource?: DurationSource;
  /** Provider turn id the execution belongs to */
  turnId?: string;
  /** 1-based line of the call record in the session file (audit anchor) */
  lineNumber: number;
  /** 1-based line of the final output record in the session file */
  outputLineNumber?: number;
  /** Code-mode cell id, when known */
  cellId?: string;
  /** Long-running process/session id (Codex unified exec) */
  processId?: string;
  /**
   * Nested operations (code-mode cells). Script call sites, provider inventory
   * entries and recorded items can all appear here; `evidence` tells them apart.
   */
  children?: Execution[];
  /** Whether the provider certified its recorded call inventory as complete */
  childrenComplete?: boolean;
  /**
   * Files the execution writes: a patch's own file headers, or the file change
   * Codex recorded for it (see `fileChangeStatus`). Never derived from command
   * text.
   */
  fileWrites?: FileWrite[];
  /**
   * Outcome of the file change Codex recorded for this execution (a
   * `FileChange` item or `patch_apply_end` event), whatever the execution's
   * kind. Kept apart from `status`, the execution's own outcome: a command can
   * fail after the patch it ran was applied.
   */
  fileChangeStatus?: ExecutionStatus;
  /** The provider's own classification of a command, when it recorded one */
  commandActions?: CommandAction[];
  /** What is actually known about this execution, and from which records */
  evidence: ExecutionEvidence;
}

/**
 * Aggregate counts for a session's executions.
 */
export interface ExecutionStats {
  /** Top-level executions */
  total: number;
  /** Command executions with a provider record, nested ones included */
  commands: number;
  /** Nested executions inside code cells */
  nested: number;
  /** Executions (top-level or nested) with a provider-recorded result */
  recorded: number;
  /** Nested executions known only from static analysis of a cell script */
  scriptOnly: number;
  /** Item records that could not be linked to a call or code cell */
  unattributed: number;
  failed: number;
  running: number;
  declined: number;
  interrupted: number;
  byKind: Partial<Record<ExecutionKind, number>>;
  /**
   * Distinct files Codex recorded as written: by completed patches and by
   * applied file-change records of any execution (`hasAppliedFileWrites`)
   */
  filesWritten: number;
  /** Provider-recorded command actions by type (`unknown` excluded) */
  commandActions: Partial<Record<string, number>>;
}
