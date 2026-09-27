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
 * Where a code cell's nested calls came from.
 * - `recorded`: the harness persisted the call inventory (authoritative)
 * - `script`: statically extracted from the cell source (best effort)
 */
export type NestedCallSource = 'recorded' | 'script';

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
  /** Duration in ms: reported wall time when available, otherwise observed */
  durationMs?: number;
  /** Whether `durationMs` came from the provider's own measurement */
  durationReported?: boolean;
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
  /** Nested operations (code-mode cells) */
  children?: Execution[];
  /** Where `children` came from */
  childrenSource?: NestedCallSource;
  /** Whether the provider certified the nested call inventory as complete */
  childrenComplete?: boolean;
  /** Paths touched by a patch execution */
  patchFiles?: string[];
}

/**
 * Aggregate counts for a session's executions.
 */
export interface ExecutionStats {
  /** Top-level executions */
  total: number;
  /** Command executions including nested ones */
  commands: number;
  /** Nested executions inside code cells */
  nested: number;
  failed: number;
  running: number;
  declined: number;
  interrupted: number;
  byKind: Partial<Record<ExecutionKind, number>>;
}
