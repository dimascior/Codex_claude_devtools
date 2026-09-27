/**
 * CodexExecutionParser - Normalizes Codex tool calls and results into Executions.
 *
 * Codex has encoded commands in three generations, all normalized here:
 *
 * 1. Function tools: `function_call` named `shell` / `container.exec` (argv),
 *    `shell_command` (string), `exec_command` / `write_stdin` (unified exec).
 * 2. Direct shell: the Responses API `local_shell_call` item (argv action).
 * 3. Code mode: a `custom_tool_call` named `exec` whose JavaScript input
 *    dispatches nested tools (`await tools.exec_command({...})`). The cell is
 *    one model-visible call; its nested calls are the operations that actually
 *    ran, so they are kept as children rather than flattened.
 *
 * Results are correlated by `call_id` (`function_call_output`,
 * `custom_tool_call_output`, `tool_search_output`). Exit codes and timings are
 * recovered from the output headers (see execOutput.ts); paginated rollouts
 * additionally persist per-command results (`item_completed` CommandExecution),
 * which are applied to the matching top-level or nested execution.
 */

import { isDynamicExpression, parseCodeCell, renderScriptValue } from './codeCell';
import { trimTrailingSeparators } from './codexPaths';
import {
  classifyOutcomeText,
  outputBodyToText,
  type ParsedToolOutput,
  parseToolOutput,
  type ScriptStatus,
} from './execOutput';
import { describeArgv, executableName, shellDisplayName } from './shellCommand';

import type { CodexCommandResult } from './CodexEventParser';
import type { CodexRolloutRecord } from './types';
import type { Execution, ExecutionKind, ExecutionStatus, NestedCallSource } from '@main/domain';

/** Per-execution output cap for transport to the renderer. */
const MAX_OUTPUT_CHARS = 256 * 1024;
/** Cap for raw inputs (patches, cell scripts, arguments). */
const MAX_INPUT_CHARS = 128 * 1024;

const TRUNCATED_ARGS_KEY = '_codex_executed_tool_call_truncated';
const RAW_ARGS_KEY = '_codex_executed_tool_call_raw';

/** Turn-scoped context supplied by the normalizer. */
export interface ExecutionContext {
  turnId?: string;
  /** Working directory of the current turn */
  cwd?: string;
  /** Last known timestamp, for records without one */
  timestamp?: string;
}

interface Classified {
  kind: ExecutionKind;
  command?: string;
  argv?: string[];
  shell?: string;
  cwd?: string;
  processId?: string;
  cellId?: string;
  patchFiles?: string[];
}

export class CodexExecutionParser {
  /** Latest execution registered for each provider call id */
  private readonly byCallId = new Map<string, Execution>();
  /** Top-level executions in call order */
  private readonly topLevel: Execution[] = [];
  /** Unified exec sessions still running → the command that started them */
  private readonly processOrigins = new Map<string, Execution>();
  /** Code-mode cell id → cell execution */
  private readonly cellsById = new Map<string, Execution>();
  /** Code-mode cells in call order */
  private readonly codeCells: Execution[] = [];
  private readonly usedIds = new Set<string>();
  /** Executions whose output came from a per-command result and should be
   * replaced by the model-visible output when it arrives */
  private readonly provisionalOutputs = new WeakSet<Execution>();
  private syntheticCounter = 0;

  /**
   * Handle a tool-call response item. Returns the new top-level execution.
   */
  handleCall(
    record: CodexRolloutRecord,
    item: Record<string, unknown>,
    context: ExecutionContext
  ): Execution | undefined {
    switch (item.type) {
      case 'function_call':
        return this.register(this.fromFunctionCall(record, item, context), str(item.call_id));
      case 'local_shell_call':
        return this.register(
          this.fromLocalShellCall(record, item, context),
          str(item.call_id) ?? str(item.id)
        );
      case 'custom_tool_call':
        return this.register(this.fromCustomToolCall(record, item, context), str(item.call_id));
      case 'tool_search_call':
        return this.register(
          this.fromToolSearchCall(record, item, context),
          str(item.call_id) ?? str(item.id)
        );
      case 'web_search_call':
        return this.register(this.fromWebSearchCall(record, item, context), str(item.id));
      case 'image_generation_call':
        return this.register(this.fromImageGenerationCall(record, item, context), str(item.id));
      default:
        return undefined;
    }
  }

  /**
   * Handle a tool output response item. Returns a new top-level execution only
   * when the output has no matching call in this rollout.
   */
  handleOutput(
    record: CodexRolloutRecord,
    item: Record<string, unknown>,
    context: ExecutionContext
  ): Execution | undefined {
    const callId = str(item.call_id);
    if (item.type === 'tool_search_output') {
      return this.handleToolSearchOutput(record, item, context, callId);
    }

    let exec = callId ? this.byCallId.get(callId) : undefined;
    let created: Execution | undefined;
    if (!exec) {
      exec = this.base(record, context, {
        callId,
        kind: 'tool',
        source: String(item.type),
        name: str(item.name) ?? 'unknown',
      });
      exec.statusDetail = 'Call record not found in this rollout';
      created = this.register(exec, callId);
    }

    const { text, imageCount } = outputBodyToText(item.output);
    const parsed = parseToolOutput(text);
    this.appendOutput(exec, parsed.body, imageCount, record);
    this.applyOutcome(exec, parsed, text, record);
    this.applyPassthroughMetadata(exec, item, record, context);
    return created;
  }

  /**
   * Apply a per-command result (paginated `CommandExecution` items or
   * `exec_command_end` events). Returns a new top-level execution when the
   * result belongs to no known call (e.g. a user shell command).
   */
  handleCommandResult(
    result: CodexCommandResult,
    record: CodexRolloutRecord,
    context: ExecutionContext
  ): Execution | undefined {
    const direct = this.byCallId.get(result.callId);
    if (direct) {
      this.applyResult(direct, result, record);
      return undefined;
    }

    const display = result.command ? describeArgv(result.command).command : undefined;
    const cell = this.findRunningCell();
    if (cell && result.source !== 'user_shell') {
      const child = findMatchingChild(cell, display);
      if (child) {
        this.applyResult(child, result, record);
        return undefined;
      }
      const extra = this.commandFromResult(result, record, context, display);
      extra.id = `${cell.id}:${(cell.children?.length ?? 0) + 1}`;
      extra.parentId = cell.id;
      extra.generation = 'code_mode';
      cell.children = [...(cell.children ?? []), extra];
      cell.childrenSource ??= 'recorded';
      return undefined;
    }

    // Model calls whose result id differs from the call id: match recent commands by text.
    if (display && result.source !== 'user_shell') {
      const candidate = [...this.topLevel]
        .reverse()
        .slice(0, 50)
        .find(
          (exec) =>
            exec.kind === 'command' &&
            exec.exitCode === undefined &&
            exec.command !== undefined &&
            normalizeCommand(exec.command) === normalizeCommand(display)
        );
      if (candidate) {
        this.applyResult(candidate, result, record);
        return undefined;
      }
    }

    return this.register(this.commandFromResult(result, record, context, display), result.callId);
  }

  private applyResult(
    exec: Execution,
    result: CodexCommandResult,
    record: CodexRolloutRecord
  ): void {
    const hadOutput = exec.output !== undefined;
    applyCommandResult(exec, result, record);
    if (!hadOutput && exec.output !== undefined) {
      this.provisionalOutputs.add(exec);
    }
  }

  /**
   * Apply a patch result (`patch_apply_end` / FileChange item).
   */
  handlePatchResult(
    callId: string,
    success: boolean | undefined,
    stderr?: string,
    stdout?: string
  ): void {
    const exec = this.byCallId.get(callId);
    if (!exec) {
      return;
    }
    if (success === false) {
      exec.status = 'failed';
      exec.statusDetail = firstLine(stderr) ?? 'Patch failed to apply';
    } else if (success === true && exec.status === 'running') {
      exec.status = 'completed';
    }
    if (exec.output === undefined && (stdout || stderr)) {
      exec.output = truncateText([stdout, stderr].filter(Boolean).join('\n'), MAX_OUTPUT_CHARS);
    }
  }

  /**
   * Apply an MCP call result (`mcp_tool_call_end` / McpToolCall item).
   */
  handleMcpResult(
    callId: string,
    durationMs: number | undefined,
    isError: boolean,
    error?: string
  ): void {
    const exec = this.byCallId.get(callId);
    if (!exec) {
      return;
    }
    if (durationMs !== undefined) {
      exec.durationMs = durationMs;
      exec.durationReported = true;
    }
    if (isError) {
      exec.status = 'failed';
      exec.statusDetail = error ?? exec.statusDetail;
    }
  }

  /**
   * Mark executions still running in an aborted turn as interrupted.
   */
  interruptTurn(turnId: string | undefined): void {
    for (const exec of this.allExecutions()) {
      if (exec.status !== 'running') continue;
      if (turnId && exec.turnId && exec.turnId !== turnId) continue;
      exec.status = 'interrupted';
      exec.statusDetail = 'Turn aborted before a result was recorded';
      if (exec.processId) {
        this.processOrigins.delete(exec.processId);
      }
    }
  }

  /**
   * Resolve executions that never received a result.
   * @param inProgressAfterLine executions recorded after this line belong to a
   *   turn that is still running and keep their `running` status
   */
  finalize(inProgressAfterLine: number): void {
    for (const exec of this.allExecutions()) {
      if (exec.status !== 'running') continue;
      if (exec.lineNumber > inProgressAfterLine) continue;
      exec.status = 'unknown';
      if (exec.processId) {
        exec.statusDetail = `Process was still running when the log ended (session ${exec.processId})`;
      } else if (exec.kind === 'code_cell' && exec.cellId) {
        exec.statusDetail = `Cell ${exec.cellId} was still running when the log ended`;
      } else {
        exec.statusDetail = 'No result was recorded';
      }
    }
  }

  /** Top-level executions in call order. */
  getExecutions(): Execution[] {
    return this.topLevel;
  }

  // ===========================================================================
  // Call builders
  // ===========================================================================

  private fromFunctionCall(
    record: CodexRolloutRecord,
    item: Record<string, unknown>,
    context: ExecutionContext
  ): Execution {
    const name = str(item.name) ?? 'unknown';
    const namespace = str(item.namespace);
    const rawArguments = item.arguments;
    const input =
      typeof rawArguments === 'string'
        ? rawArguments
        : rawArguments !== undefined
          ? JSON.stringify(rawArguments)
          : undefined;
    const args = parseArguments(rawArguments);
    const classified = classifyTool(name, namespace, args, context.cwd);

    const exec = this.base(record, context, {
      callId: str(item.call_id),
      kind: classified.kind,
      source: 'function_call',
      name,
    });
    exec.namespace = namespace;
    exec.input = input !== undefined ? truncateText(input, MAX_INPUT_CHARS) : undefined;
    exec.args = args;
    applyClassification(exec, classified, 'function_call');

    if (exec.kind === 'code_wait' && exec.cellId) {
      exec.parentId = this.cellsById.get(exec.cellId)?.id;
    }
    if (exec.kind === 'command_input' && exec.processId) {
      exec.parentId = this.processOrigins.get(exec.processId)?.id;
    }
    return exec;
  }

  private fromLocalShellCall(
    record: CodexRolloutRecord,
    item: Record<string, unknown>,
    context: ExecutionContext
  ): Execution {
    const action = isRecord(item.action) ? item.action : {};
    const argv = stringArray(action.command) ?? [];
    const cwd = resolveWorkdir(context.cwd, str(action.working_directory));
    const isPatch = argv.length > 0 && executableName(argv[0]) === 'apply_patch';

    const exec = this.base(record, context, {
      callId: str(item.call_id) ?? str(item.id),
      kind: isPatch ? 'patch' : 'command',
      source: 'local_shell_call',
      name: 'local_shell',
    });
    exec.generation = 'local_shell';
    exec.argv = argv;
    exec.cwd = cwd;
    exec.args = action;
    exec.input = JSON.stringify(action);
    if (isPatch) {
      exec.command = 'apply_patch';
      exec.patchFiles = extractPatchFiles(argv[1] ?? '');
    } else {
      const display = describeArgv(argv);
      exec.command = display.command;
      exec.shell = display.shell;
    }
    return exec;
  }

  private fromCustomToolCall(
    record: CodexRolloutRecord,
    item: Record<string, unknown>,
    context: ExecutionContext
  ): Execution {
    const name = str(item.name) ?? 'custom';
    const namespace = str(item.namespace);
    const input = typeof item.input === 'string' ? item.input : '';

    if (name === 'exec' && !namespace) {
      const cell = this.base(record, context, {
        callId: str(item.call_id),
        kind: 'code_cell',
        source: 'custom_tool_call',
        name,
      });
      const parsed = parseCodeCell(input);
      cell.input = truncateText(input, MAX_INPUT_CHARS);
      cell.args = parsed.pragma;
      cell.cwd = context.cwd;
      if (parsed.calls.length > 0) {
        cell.children = parsed.calls.map((call, index) =>
          this.childFromCall(cell, index, call.name, call.args, record, context, 'script')
        );
        cell.childrenSource = 'script';
      }
      this.codeCells.push(cell);
      return cell;
    }

    const isPatch = name === 'apply_patch';
    const exec = this.base(record, context, {
      callId: str(item.call_id),
      kind: isPatch ? 'patch' : 'tool',
      source: 'custom_tool_call',
      name,
    });
    exec.namespace = namespace;
    exec.input = truncateText(input, MAX_INPUT_CHARS);
    if (isPatch) {
      exec.command = 'apply_patch';
      exec.cwd = context.cwd;
      exec.patchFiles = extractPatchFiles(input);
    }
    return exec;
  }

  private fromToolSearchCall(
    record: CodexRolloutRecord,
    item: Record<string, unknown>,
    context: ExecutionContext
  ): Execution {
    const args = isRecord(item.arguments) ? item.arguments : undefined;
    const exec = this.base(record, context, {
      callId: str(item.call_id) ?? str(item.id),
      kind: 'tool_search',
      source: 'tool_search_call',
      name: 'tool_search',
    });
    exec.args = args;
    exec.input = item.arguments !== undefined ? JSON.stringify(item.arguments) : undefined;
    exec.command = str(args?.query) ?? str(args?.q);
    if (item.status === 'failed') {
      exec.status = 'failed';
    }
    return exec;
  }

  private fromWebSearchCall(
    record: CodexRolloutRecord,
    item: Record<string, unknown>,
    context: ExecutionContext
  ): Execution {
    const action = isRecord(item.action) ? item.action : {};
    const exec = this.base(record, context, {
      callId: str(item.id),
      kind: 'web_search',
      source: 'web_search_call',
      name: 'web_search',
    });
    exec.args = action;
    exec.command = describeWebSearchAction(action);
    exec.status = mapHostedStatus(str(item.status));
    exec.completedAt = exec.status === 'running' ? undefined : exec.timestamp;
    return exec;
  }

  private fromImageGenerationCall(
    record: CodexRolloutRecord,
    item: Record<string, unknown>,
    context: ExecutionContext
  ): Execution {
    const exec = this.base(record, context, {
      callId: str(item.id),
      kind: 'image_generation',
      source: 'image_generation_call',
      name: 'image_generation',
    });
    exec.command = str(item.revised_prompt);
    exec.status = mapHostedStatus(str(item.status));
    if (typeof item.result === 'string' && item.result) {
      exec.output = 'Image generated (image data is not shown)';
      exec.outputImageCount = 1;
    }
    return exec;
  }

  private commandFromResult(
    result: CodexCommandResult,
    record: CodexRolloutRecord,
    context: ExecutionContext,
    display: string | undefined
  ): Execution {
    const isUserShell = result.source === 'user_shell';
    const exec = this.base(record, context, {
      callId: result.callId,
      kind: 'command',
      source: isUserShell ? 'user_shell' : 'command_execution',
      name: isUserShell ? 'user_shell' : 'command',
    });
    exec.argv = result.command;
    exec.command = display;
    exec.shell = result.command ? describeArgv(result.command).shell : undefined;
    exec.cwd = result.cwd ?? context.cwd;
    applyCommandResult(exec, result, record);
    return exec;
  }

  /**
   * Build a nested execution for a code-cell call.
   */
  private childFromCall(
    cell: Execution,
    index: number,
    name: string,
    rawArgs: unknown,
    record: CodexRolloutRecord,
    context: ExecutionContext,
    source: NestedCallSource
  ): Execution {
    let args: unknown = rawArgs;
    let truncatedBytes: number | undefined;
    if (isRecord(args) && RAW_ARGS_KEY in args) {
      args = args[RAW_ARGS_KEY];
    } else if (isRecord(args) && TRUNCATED_ARGS_KEY in args) {
      const info = isRecord(args[TRUNCATED_ARGS_KEY]) ? args[TRUNCATED_ARGS_KEY] : {};
      truncatedBytes = typeof info.original_bytes === 'number' ? info.original_bytes : 0;
      args = undefined;
    }

    // Freeform tools (e.g. apply_patch) take a string input.
    const argsObject: Record<string, unknown> | undefined = isRecord(args)
      ? args
      : typeof args === 'string'
        ? { input: args }
        : undefined;
    const classified = classifyTool(name, undefined, renderDynamicFields(argsObject), cell.cwd);

    const child: Execution = {
      id: `${cell.id}:${index + 1}`,
      parentId: cell.id,
      provider: 'codex',
      kind: classified.kind,
      source: source === 'recorded' ? 'executed_tool_call' : 'cell_script',
      name,
      args: argsObject,
      input: args !== undefined ? truncateText(JSON.stringify(args), MAX_INPUT_CHARS) : undefined,
      status: 'unknown',
      statusDetail:
        truncatedBytes !== undefined
          ? `Arguments truncated by Codex (${truncatedBytes} bytes)`
          : source === 'recorded'
            ? 'Per-call result not recorded; see the cell output'
            : 'Extracted from the cell script; per-call result not recorded',
      timestamp: record.timestamp ?? context.timestamp ?? cell.timestamp,
      lineNumber: record.lineNumber,
      turnId: cell.turnId,
    };
    applyClassification(child, classified, 'code_mode');
    return child;
  }

  // ===========================================================================
  // Output handling
  // ===========================================================================

  private appendOutput(
    draft: Execution,
    body: string,
    imageCount: number,
    record: CodexRolloutRecord
  ): void {
    if (this.provisionalOutputs.has(draft)) {
      // Prefer the output the model actually saw over the per-command result text.
      this.provisionalOutputs.delete(draft);
      draft.output = undefined;
      draft.outputCount = 0;
      draft.outputTruncated = undefined;
    }
    const combined =
      draft.output === undefined ? body : body ? `${draft.output}\n${body}` : draft.output;
    if (combined.length > MAX_OUTPUT_CHARS) {
      draft.output = combined.slice(0, MAX_OUTPUT_CHARS);
      draft.outputTruncated = true;
    } else {
      draft.output = combined;
    }
    draft.outputCount = (draft.outputCount ?? 0) + 1;
    if (imageCount > 0) {
      draft.outputImageCount = (draft.outputImageCount ?? 0) + imageCount;
    }
    draft.completedAt = record.timestamp ?? draft.completedAt;
    draft.outputLineNumber = record.lineNumber;
  }

  private applyOutcome(
    draft: Execution,
    parsed: ParsedToolOutput,
    text: string,
    record: CodexRolloutRecord
  ): void {
    if (parsed.wallTimeMs !== undefined) {
      draft.durationMs = parsed.wallTimeMs;
      draft.durationReported = true;
    } else if (!draft.durationReported) {
      draft.durationMs = observedDuration(draft.timestamp, draft.completedAt);
    }

    switch (draft.kind) {
      case 'command':
      case 'command_input':
      case 'patch':
        this.applyCommandOutcome(draft, parsed, text, record);
        return;
      case 'code_cell':
      case 'code_wait':
        this.applyScriptOutcome(draft, parsed, text, record);
        return;
      default:
        draft.status = classifyOutcomeText(text) ?? 'completed';
    }
  }

  private applyCommandOutcome(
    draft: Execution,
    parsed: ParsedToolOutput,
    text: string,
    record: CodexRolloutRecord
  ): void {
    if (parsed.exitCode !== undefined) {
      draft.exitCode = parsed.exitCode;
      draft.status = parsed.exitCode === 0 ? 'completed' : 'failed';
      draft.statusDetail = undefined;
    } else if (parsed.processId !== undefined) {
      draft.processId = parsed.processId;
      if (draft.kind === 'command') {
        draft.status = 'running';
        draft.statusDetail = `Process running with session ID ${parsed.processId}`;
        this.processOrigins.set(parsed.processId, draft);
      } else {
        draft.status = 'completed';
        draft.statusDetail = `Process still running (session ${parsed.processId})`;
      }
    } else {
      const outcome = classifyOutcomeText(parsed.body || text);
      draft.status = outcome ?? 'completed';
      if (outcome) {
        draft.statusDetail = firstLine(parsed.body || text);
      }
    }

    // A write_stdin poll that observed the process exit completes the origin command.
    if (draft.kind === 'command_input' && draft.processId && parsed.exitCode !== undefined) {
      const origin = this.processOrigins.get(draft.processId);
      if (origin && origin !== draft) {
        origin.exitCode = parsed.exitCode;
        origin.status = parsed.exitCode === 0 ? 'completed' : 'failed';
        origin.completedAt = record.timestamp ?? origin.completedAt;
        origin.durationMs = observedDuration(origin.timestamp, origin.completedAt);
        origin.durationReported = false;
        origin.statusDetail = `Exited while polled by ${draft.id}`;
        this.processOrigins.delete(draft.processId);
      }
    }
  }

  private applyScriptOutcome(
    draft: Execution,
    parsed: ParsedToolOutput,
    text: string,
    record: CodexRolloutRecord
  ): void {
    if (parsed.cellId) {
      draft.cellId ??= parsed.cellId;
      if (draft.kind === 'code_cell') {
        this.cellsById.set(parsed.cellId, draft);
      }
    }

    const cell =
      draft.kind === 'code_cell'
        ? draft
        : ((draft.cellId ? this.cellsById.get(draft.cellId) : undefined) ??
          (draft.parentId ? this.findById(draft.parentId) : undefined));

    if (!parsed.scriptStatus) {
      // Extra outputs (e.g. `notify()`) carry no script header; only failures change state.
      const outcome = classifyOutcomeText(parsed.body || text);
      if (outcome && draft.kind !== 'code_cell') {
        draft.status = outcome;
      } else if (draft.kind === 'code_wait') {
        draft.status = 'completed';
      }
      return;
    }

    const cellStatus = mapScriptStatus(parsed.scriptStatus);
    const detail =
      parsed.scriptStatus === 'running'
        ? `Script running with cell ID ${parsed.cellId ?? draft.cellId ?? '?'}`
        : `Script ${parsed.scriptStatus}`;

    if (draft.kind === 'code_cell') {
      draft.status = cellStatus;
      draft.statusDetail = detail;
      return;
    }

    // `wait`: the poll itself completed; the cell's state is what it reports.
    draft.status = 'completed';
    draft.statusDetail = detail;
    if (cell && cell !== draft) {
      draft.parentId ??= cell.id;
      if (parsed.scriptStatus !== 'running') {
        cell.status = cellStatus;
        cell.statusDetail = `${detail} (reported by ${draft.id})`;
        cell.completedAt = record.timestamp ?? cell.completedAt;
        cell.durationMs = observedDuration(cell.timestamp, cell.completedAt);
        cell.durationReported = false;
      }
    }
  }

  private applyPassthroughMetadata(
    draft: Execution,
    item: Record<string, unknown>,
    record: CodexRolloutRecord,
    context: ExecutionContext
  ): void {
    const metadata = item.internal_chat_message_metadata_passthrough;
    if (!isRecord(metadata)) {
      return;
    }
    const cellId = str(metadata.cell_id);
    if (cellId && (draft.kind === 'code_cell' || draft.kind === 'code_wait')) {
      draft.cellId ??= cellId;
      if (draft.kind === 'code_cell') {
        this.cellsById.set(cellId, draft);
      }
    }

    // Direct calls record themselves; only code-cell inventories describe nested work.
    const target =
      draft.kind === 'code_cell'
        ? draft
        : draft.kind === 'code_wait'
          ? ((cellId ? this.cellsById.get(cellId) : undefined) ??
            (draft.parentId ? this.findById(draft.parentId) : undefined))
          : undefined;
    if (!target) {
      return;
    }

    const calls = Array.isArray(metadata.executed_tool_calls) ? metadata.executed_tool_calls : [];
    if (calls.length > 0) {
      // Script-derived children are replaced by the recorded inventory, but any
      // per-command results already matched to them are carried over.
      let carried: Execution[] = [];
      if (target.childrenSource !== 'recorded') {
        carried = (target.children ?? []).filter(hasResult);
        target.children = [];
        target.childrenSource = 'recorded';
      }
      const children = target.children ?? [];
      for (const call of calls) {
        if (!isRecord(call)) continue;
        const child = this.childFromCall(
          target,
          children.length,
          str(call.name) ?? 'unknown',
          call.arguments,
          record,
          context,
          'recorded'
        );
        const matchIndex = carried.findIndex((previous) => sameOperation(previous, child));
        if (matchIndex !== -1) {
          copyResult(carried[matchIndex], child);
          carried.splice(matchIndex, 1);
        }
        children.push(child);
      }
      for (const leftover of carried) {
        leftover.id = `${target.id}:${children.length + 1}`;
        children.push(leftover);
      }
      target.children = children;
    }
    if (metadata.tool_calls_complete === true) {
      target.childrenComplete = true;
      target.childrenSource ??= 'recorded';
      target.children ??= [];
    }
  }

  private handleToolSearchOutput(
    record: CodexRolloutRecord,
    item: Record<string, unknown>,
    context: ExecutionContext,
    callId: string | undefined
  ): Execution | undefined {
    let exec = callId ? this.byCallId.get(callId) : undefined;
    // Hosted tool search may omit call ids; pair with the latest unanswered search.
    exec ??= [...this.topLevel]
      .reverse()
      .find((candidate) => candidate.kind === 'tool_search' && candidate.outputCount === undefined);
    let created: Execution | undefined;
    if (!exec) {
      exec = this.base(record, context, {
        callId,
        kind: 'tool_search',
        source: 'tool_search_output',
        name: 'tool_search',
      });
      created = this.register(exec, callId);
    }
    const tools = Array.isArray(item.tools) ? item.tools : [];
    const names = tools
      .map((tool) =>
        isRecord(tool)
          ? (str(tool.name) ?? str(isRecord(tool.function) ? tool.function.name : undefined))
          : undefined
      )
      .filter((name): name is string => name !== undefined);
    this.appendOutput(
      exec,
      names.length > 0
        ? `Found ${names.length} tool(s): ${names.join(', ')}`
        : `Found ${tools.length} tool(s)`,
      0,
      record
    );
    exec.status = item.status === 'failed' ? 'failed' : 'completed';
    exec.durationMs = observedDuration(exec.timestamp, exec.completedAt);
    return created;
  }

  // ===========================================================================
  // Registration helpers
  // ===========================================================================

  private base(
    record: CodexRolloutRecord,
    context: ExecutionContext,
    init: { callId: string | undefined; kind: ExecutionKind; source: string; name: string }
  ): Execution {
    return {
      id: this.uniqueId(init.callId),
      provider: 'codex',
      kind: init.kind,
      source: init.source,
      name: init.name,
      status: 'running',
      timestamp: record.timestamp ?? context.timestamp ?? '',
      lineNumber: record.lineNumber,
      turnId: context.turnId,
    };
  }

  private register(exec: Execution, callId: string | undefined): Execution {
    if (callId) {
      this.byCallId.set(callId, exec);
    }
    this.topLevel.push(exec);
    return exec;
  }

  private uniqueId(callId: string | undefined): string {
    let id = callId ?? `codex-${++this.syntheticCounter}`;
    if (this.usedIds.has(id)) {
      let suffix = 2;
      while (this.usedIds.has(`${id}#${suffix}`)) suffix++;
      id = `${id}#${suffix}`;
    }
    this.usedIds.add(id);
    return id;
  }

  private findById(id: string): Execution | undefined {
    return this.topLevel.find((exec) => exec.id === id);
  }

  private findRunningCell(): Execution | undefined {
    for (let i = this.codeCells.length - 1; i >= 0; i--) {
      if (this.codeCells[i].status === 'running') {
        return this.codeCells[i];
      }
    }
    return undefined;
  }

  private *allExecutions(): Generator<Execution> {
    for (const exec of this.topLevel) {
      yield exec;
      for (const child of exec.children ?? []) {
        yield child;
      }
    }
  }
}

// =============================================================================
// Classification
// =============================================================================

/**
 * Classify a function-style tool by name and arguments.
 */
function classifyTool(
  name: string,
  namespace: string | undefined,
  args: Record<string, unknown> | undefined,
  turnCwd: string | undefined
): Classified {
  const a = args ?? {};
  const cwd = resolveWorkdir(turnCwd, str(a.workdir) ?? str(a.working_directory) ?? str(a.cwd));

  switch (name) {
    case 'shell':
    case 'container.exec':
    case 'local_shell': {
      const argv = stringArray(a.command);
      if (argv && argv.length > 0) {
        if (executableName(argv[0]) === 'apply_patch') {
          return {
            kind: 'patch',
            command: 'apply_patch',
            argv,
            cwd,
            patchFiles: extractPatchFiles(argv[1] ?? ''),
          };
        }
        const display = describeArgv(argv);
        return { kind: 'command', command: display.command, argv, shell: display.shell, cwd };
      }
      return { kind: 'command', command: str(a.command), cwd };
    }
    case 'shell_command':
      return { kind: 'command', command: str(a.command), shell: shellDisplayName(a.shell), cwd };
    case 'exec_command':
      return {
        kind: 'command',
        command: str(a.cmd) ?? str(a.command),
        shell: shellDisplayName(a.shell),
        cwd,
      };
    case 'unified_exec': {
      const argv = stringArray(a.input);
      const sessionId = idString(a.session_id);
      if (sessionId !== undefined) {
        return {
          kind: 'command_input',
          command: argv ? argv.join(' ') : undefined,
          processId: sessionId,
        };
      }
      if (argv && argv.length > 0) {
        const display = describeArgv(argv);
        return { kind: 'command', command: display.command, argv, shell: display.shell, cwd };
      }
      return { kind: 'command', cwd };
    }
    case 'write_stdin':
      return {
        kind: 'command_input',
        command: describeStdin(a.chars),
        processId: idString(a.session_id),
      };
    case 'apply_patch': {
      const patch = str(a.input) ?? str(a.patch) ?? '';
      return { kind: 'patch', command: 'apply_patch', cwd, patchFiles: extractPatchFiles(patch) };
    }
    case 'update_plan':
      return { kind: 'plan' };
    case 'wait':
      if (a.cell_id !== undefined) {
        return { kind: 'code_wait', cellId: idString(a.cell_id) };
      }
      break;
    case 'web_search':
      return { kind: 'web_search', command: str(a.query) };
    default:
      break;
  }

  if (name.startsWith('mcp__') || namespace?.startsWith('mcp')) {
    return { kind: 'mcp' };
  }
  return { kind: 'tool' };
}

function applyClassification(
  draft: Execution,
  classified: Classified,
  generation: 'function_call' | 'code_mode'
): void {
  draft.kind = classified.kind;
  draft.command = classified.command;
  draft.argv = classified.argv;
  draft.shell = classified.shell;
  draft.cwd = classified.cwd ?? draft.cwd;
  draft.processId = classified.processId;
  draft.cellId = classified.cellId;
  draft.patchFiles = classified.patchFiles;
  if (
    classified.kind === 'command' ||
    classified.kind === 'command_input' ||
    classified.kind === 'patch'
  ) {
    draft.generation = generation;
  }
}

function applyCommandResult(
  draft: Execution,
  result: CodexCommandResult,
  record: CodexRolloutRecord
): void {
  if (result.exitCode !== undefined) {
    draft.exitCode = result.exitCode;
  }
  draft.status = mapCommandStatus(result.status, result.exitCode) ?? draft.status;
  if (draft.status === 'running' && result.exitCode !== undefined) {
    draft.status = result.exitCode === 0 ? 'completed' : 'failed';
  }
  if (result.durationMs !== undefined) {
    draft.durationMs = result.durationMs;
    draft.durationReported = true;
  }
  draft.cwd ??= result.cwd;
  draft.processId ??= result.processId;
  if (draft.output === undefined && result.output) {
    draft.output = truncateText(result.output, MAX_OUTPUT_CHARS);
    draft.outputTruncated = result.output.length > MAX_OUTPUT_CHARS || undefined;
    draft.outputCount = 1;
  }
  draft.completedAt ??= record.timestamp;
  draft.outputLineNumber ??= record.lineNumber;
  draft.statusDetail = undefined;
}

function findMatchingChild(cell: Execution, display: string | undefined): Execution | undefined {
  const children = cell.children ?? [];
  const unresolved = children.filter((child) => child.status === 'unknown' && !child.completedAt);
  if (display) {
    const wanted = normalizeCommand(display);
    const exact = unresolved.find(
      (child) => child.command !== undefined && normalizeCommand(child.command) === wanted
    );
    if (exact) {
      return exact;
    }
  }
  // A script call with a runtime-only command (e.g. inside a loop).
  return unresolved.find((child) => child.kind === 'command' && child.command?.includes('‹'));
}

function hasResult(exec: Execution): boolean {
  return exec.completedAt !== undefined || exec.exitCode !== undefined;
}

function sameOperation(a: Execution, b: Execution): boolean {
  if (a.command !== undefined && b.command !== undefined) {
    return normalizeCommand(a.command) === normalizeCommand(b.command);
  }
  return a.name === b.name;
}

function copyResult(source: Execution, draft: Execution): void {
  draft.exitCode = source.exitCode;
  draft.status = source.status;
  draft.statusDetail = source.statusDetail;
  draft.durationMs = source.durationMs;
  draft.durationReported = source.durationReported;
  draft.output = source.output;
  draft.outputCount = source.outputCount;
  draft.outputTruncated = source.outputTruncated;
  draft.completedAt = source.completedAt;
  draft.outputLineNumber = source.outputLineNumber;
  draft.processId ??= source.processId;
  draft.cwd ??= source.cwd;
}

function mapCommandStatus(
  status: string | undefined,
  exitCode: number | undefined
): ExecutionStatus | undefined {
  switch (status) {
    case 'completed':
      return exitCode === undefined || exitCode === 0 ? 'completed' : 'failed';
    case 'failed':
      return 'failed';
    case 'declined':
      return 'declined';
    case 'in_progress':
      return 'running';
    default:
      return undefined;
  }
}

function mapScriptStatus(status: ScriptStatus): ExecutionStatus {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'terminated':
      return 'interrupted';
    case 'running':
      return 'running';
  }
}

function mapHostedStatus(status: string | undefined): ExecutionStatus {
  switch (status) {
    case undefined:
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'incomplete':
      return 'interrupted';
    default:
      return 'running';
  }
}

// =============================================================================
// Helpers
// =============================================================================

function describeWebSearchAction(action: Record<string, unknown>): string | undefined {
  switch (action.type) {
    case 'search': {
      const queries = stringArray(action.queries);
      return str(action.query) ?? (queries ? queries.join(' | ') : undefined);
    }
    case 'open_page': {
      const url = str(action.url);
      return url ? `open ${url}` : undefined;
    }
    case 'find_in_page':
      return `find "${str(action.pattern) ?? ''}" in ${str(action.url) ?? 'page'}`;
    default:
      return str(action.query);
  }
}

function describeStdin(chars: unknown): string {
  if (typeof chars !== 'string' || chars.length === 0) {
    return '(poll for output)';
  }
  return JSON.stringify(chars).slice(1, -1);
}

/**
 * Paths touched by an apply_patch envelope.
 */
export function extractPatchFiles(patch: string): string[] {
  const files: string[] = [];
  const re = /^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(patch)) !== null) {
    const file = match[1].trim();
    if (file && !files.includes(file)) {
      files.push(file);
    }
  }
  return files;
}

/**
 * Resolve a (possibly relative) workdir against the turn's cwd.
 */
export function resolveWorkdir(
  base: string | undefined,
  workdir: string | undefined
): string | undefined {
  if (!workdir) {
    return base;
  }
  if (workdir.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(workdir) || workdir.startsWith('\\\\')) {
    return workdir;
  }
  if (!base) {
    return workdir;
  }
  const separator = base.includes('\\') && !base.includes('/') ? '\\' : '/';
  const relative = workdir.replace(/^\.[\\/]/, '');
  if (relative === '.' || relative === '') {
    return base;
  }
  return `${trimTrailingSeparators(base)}${separator}${relative}`;
}

function renderDynamicFields(
  args: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!args) {
    return undefined;
  }
  let changed = false;
  const rendered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (isDynamicExpression(value)) {
      rendered[key] = renderScriptValue(value);
      changed = true;
    } else {
      rendered[key] = value;
    }
  }
  return changed ? rendered : args;
}

function parseArguments(raw: unknown): Record<string, unknown> | undefined {
  if (isRecord(raw)) {
    return raw;
  }
  if (typeof raw !== 'string' || !raw.trim().startsWith('{')) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function observedDuration(start: string | undefined, end: string | undefined): number | undefined {
  if (!start || !end) {
    return undefined;
  }
  const ms = Date.parse(end) - Date.parse(start);
  return Number.isFinite(ms) && ms >= 0 ? ms : undefined;
}

function normalizeCommand(command: string): string {
  return command.replace(/\s+/g, ' ').trim();
}

function truncateText(text: string, max: number): string {
  return text.length > max
    ? `${text.slice(0, max)}\n… [truncated ${text.length - max} characters]`
    : text;
}

function firstLine(text: string | undefined): string | undefined {
  const line = text?.trim().split('\n')[0]?.trim();
  if (!line) {
    return undefined;
  }
  return line.length > 200 ? `${line.slice(0, 199)}…` : line;
}

function idString(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return str(value);
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
