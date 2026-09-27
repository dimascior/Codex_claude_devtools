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
 *    one model-visible call; its nested operations are kept as children.
 *
 * Evidence is kept by class (see `ExecutionEvidence`) and linked only as far
 * as the persisted records allow (docs/codex-real-validation):
 * - Calls and outputs are joined by `call_id` (explicit).
 * - Harness item records (`item_completed`, legacy `*_end` events) are applied
 *   to the call whose id they carry (explicit).
 * - Items dispatched from a code cell carry fresh `exec-<uuid>` ids that match
 *   no call, and real rollouts record no cell id on them. Such an item is
 *   attached to a cell only when exactly one cell of the item's turn is
 *   running at that point of the rollout (turn-scoped, record order).
 *   Otherwise it stays a top-level, unattributed recorded execution.
 * - A cell's script call sites (static analysis) are children without a
 *   result. A call site is linked to a recorded item only when their
 *   normalized command text is identical and unique on both sides (content).
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

import type { CodexItemEnvelope, CodexRecordedItem } from './CodexEventParser';
import type { CodexRolloutRecord } from './types';
import type {
  EvidenceLink,
  Execution,
  ExecutionKind,
  ExecutionStatus,
  RecordEvidence,
} from '@main/domain';

/** Per-execution output cap for transport to the renderer. */
const MAX_OUTPUT_CHARS = 256 * 1024;
/** Cap for raw inputs (patches, cell scripts, arguments). */
const MAX_INPUT_CHARS = 128 * 1024;

const TRUNCATED_ARGS_KEY = '_codex_executed_tool_call_truncated';
const RAW_ARGS_KEY = '_codex_executed_tool_call_raw';

/**
 * Codex names calls dispatched from a code-mode cell `exec-<uuid>`
 * (`format!("{PUBLIC_TOOL_NAME}-{}", Uuid::new_v4())`, PUBLIC_TOOL_NAME = "exec").
 */
const CODE_MODE_ITEM_ID_PREFIX = 'exec-';

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

interface BaseInit {
  callId: string | undefined;
  kind: ExecutionKind;
  source: string;
  name: string;
  /** Turn id recorded on the item itself (preferred over the context's) */
  turnId?: string;
  observed: RecordEvidence;
}

export class CodexExecutionParser {
  /** Latest execution registered for each provider call id */
  private readonly byCallId = new Map<string, Execution>();
  /** Executions built from item records, by item id */
  private readonly byItemId = new Map<string, Execution>();
  /** Top-level executions in record order */
  private readonly topLevel: Execution[] = [];
  /** Unified exec sessions still running → the command that started them */
  private readonly processOrigins = new Map<string, Execution>();
  /** Code-mode cell id → cell execution */
  private readonly cellsById = new Map<string, Execution>();
  /** Code-mode cells in call order */
  private readonly codeCells: Execution[] = [];
  /** Cells whose running window is open: call recorded, no terminal state yet */
  private readonly openCells = new Set<Execution>();
  private readonly usedIds = new Set<string>();
  /** Executions whose output came from an item record and should be replaced
   * by the model-visible output when it arrives */
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
      case 'web_search_call': {
        const id = str(item.id);
        // Hosted search: the WebSearch item is persisted one record before its
        // call (25/25 real cases), so the call may find its item already known.
        // Only a top-level WebSearch item that no call has claimed is adopted.
        const prior = id ? this.byItemId.get(id) : undefined;
        if (
          prior?.kind === 'web_search' &&
          prior.parentId === undefined &&
          prior.evidence.observed?.kind === 'item'
        ) {
          this.adoptWebSearchCall(prior, record, item, id);
          return undefined;
        }
        return this.register(this.fromWebSearchCall(record, item, context), id);
      }
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
    const evidence = recordEvidence('output', String(item.type), record, callId);
    if (item.type === 'tool_search_output') {
      return this.handleToolSearchOutput(record, item, context, callId, evidence);
    }

    let exec = callId ? this.byCallId.get(callId) : undefined;
    let created: Execution | undefined;
    if (!exec) {
      exec = this.base(record, context, {
        callId,
        kind: 'tool',
        source: String(item.type),
        name: str(item.name) ?? 'unknown',
        turnId: passthroughTurnId(item),
        observed: evidence,
      });
      exec.statusDetail = 'Call record not found in this rollout';
      exec.evidence.cellLink = {
        method: 'unresolved',
        detail: 'Call record not found in this rollout',
      };
      created = this.register(exec, callId);
    }

    // An item record for the same call is the structured result; the output
    // text is still shown, but does not override the item's outcome.
    const itemResult = exec.evidence.result?.kind === 'item';
    const itemStatus = itemResult ? exec.status : undefined;
    const { text, imageCount } = outputBodyToText(item.output);
    const parsed = parseToolOutput(text);
    // Code-mode `notify()` injects extra outputs for the cell's call id; they
    // carry the tool name and no status header, and the cell keeps running.
    const intermediate =
      exec.kind === 'code_cell' && typeof item.name === 'string' && !parsed.scriptStatus;
    this.appendOutput(exec, parsed.body, imageCount, record);
    if (!itemResult) {
      exec.evidence.result = evidence;
    }
    this.applyOutcome(exec, parsed, text, record, intermediate);
    if (itemStatus !== undefined && itemStatus !== 'running' && itemStatus !== 'unknown') {
      exec.status = itemStatus;
    }
    if (created && exec.status === 'completed') {
      // Without its call the kind is unknown, so is the outcome (e.g. a yield).
      exec.status = 'unknown';
    }
    this.applyPassthroughMetadata(exec, item, record, context);
    return created;
  }

  /**
   * Handle an execution recorded by the harness (`item_completed` items,
   * legacy `*_end` events). Returns a new top-level execution when the item
   * could not be linked to a call or attributed to a code cell.
   */
  handleRecordedItem(
    item: CodexRecordedItem,
    envelope: CodexItemEnvelope,
    record: CodexRolloutRecord,
    context: ExecutionContext
  ): Execution | undefined {
    const evidence = recordEvidence('item', envelope.recordType, record, item.id);

    // Explicit: the item carries the id of a call in this rollout.
    const call = this.byCallId.get(item.id);
    if (call) {
      this.applyItem(call, item, envelope, evidence, record);
      return undefined;
    }
    // The same item recorded again.
    const known = this.byItemId.get(item.id);
    if (known) {
      this.applyItem(known, item, envelope, evidence, record);
      return undefined;
    }

    const exec = this.executionFromItem(item, envelope, evidence, record, context);
    this.byItemId.set(item.id, exec);

    if (item.type === 'command' && item.source === 'user_shell') {
      // Commands the user ran in the session have no model call to link to.
      return this.register(exec, undefined);
    }

    if (item.id.startsWith(CODE_MODE_ITEM_ID_PREFIX)) {
      if (exec.kind === 'command' || exec.kind === 'command_input' || exec.kind === 'patch') {
        exec.generation = 'code_mode';
      }
      const running = [...this.openCells].filter(
        (cell) => envelope.turnId !== undefined && cell.turnId === envelope.turnId
      );
      if (running.length === 1) {
        this.attachRecordedChild(running[0].id, exec, {
          method: 'turn_window',
          detail:
            'Recorded in the same turn while this was the only running code cell; no identifier links them',
        });
        return undefined;
      }
      exec.evidence.cellLink = {
        method: 'unresolved',
        detail:
          running.length === 0
            ? 'Dispatched from a code cell, but no cell of its turn was running when it was recorded'
            : `Dispatched from a code cell, but ${running.length} cells of its turn were running`,
      };
    } else {
      exec.evidence.cellLink = {
        method: 'unresolved',
        detail: 'No call record with this id in the rollout',
      };
    }
    return this.register(exec, undefined);
  }

  /**
   * A turn ended: its code cells can no longer be attributed new items.
   */
  closeTurn(turnId: string | undefined): void {
    for (const cell of [...this.openCells]) {
      if (!turnId || !cell.turnId || cell.turnId === turnId) {
        this.openCells.delete(cell);
      }
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
    this.closeTurn(turnId);
  }

  /**
   * Resolve executions that never received a result, and link script call
   * sites to recorded items where the content match is unique.
   * @param inProgressAfterLine executions recorded after this line belong to a
   *   turn that is still running and keep their `running` status
   */
  finalize(inProgressAfterLine: number): void {
    for (const cell of this.codeCells) {
      this.linkCallSites(cell);
    }
    for (const exec of this.allExecutions()) {
      if (exec.status !== 'running') continue;
      if (exec.lineNumber > inProgressAfterLine) continue;
      exec.status = 'unknown';
      if (exec.processId) {
        exec.statusDetail = `Process was still running when the log ended (session ${exec.processId})`;
      } else if (exec.kind === 'code_cell' && exec.cellId) {
        exec.statusDetail = `Cell ${exec.cellId} was still running when the log ended`;
      } else if (exec.outputCount) {
        exec.statusDetail = 'Output recorded without a final status';
      } else {
        exec.statusDetail = 'No result was recorded';
      }
    }
  }

  /** Top-level executions in record order. */
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
    const callId = str(item.call_id);

    const exec = this.base(record, context, {
      callId,
      kind: classified.kind,
      source: 'function_call',
      name,
      turnId: passthroughTurnId(item),
      observed: recordEvidence('call', 'function_call', record, callId),
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
    const callId = str(item.call_id) ?? str(item.id);

    const exec = this.base(record, context, {
      callId,
      kind: isPatch ? 'patch' : 'command',
      source: 'local_shell_call',
      name: 'local_shell',
      turnId: passthroughTurnId(item),
      observed: recordEvidence('call', 'local_shell_call', record, callId),
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
    const callId = str(item.call_id);
    const observed = recordEvidence('call', 'custom_tool_call', record, callId);
    const turnId = passthroughTurnId(item);

    if (name === 'exec' && !namespace) {
      const cell = this.base(record, context, {
        callId,
        kind: 'code_cell',
        source: 'custom_tool_call',
        name,
        turnId,
        observed,
      });
      const parsed = parseCodeCell(input);
      cell.input = truncateText(input, MAX_INPUT_CHARS);
      cell.args = parsed.pragma;
      cell.cwd = context.cwd;
      if (parsed.calls.length > 0) {
        cell.children = parsed.calls.map((call, index) =>
          this.childFromCall(cell, index, call.name, call.args, record, context, {
            code: { line: call.line, dynamic: call.dynamic },
          })
        );
      }
      this.codeCells.push(cell);
      this.openCells.add(cell);
      return cell;
    }

    const isPatch = name === 'apply_patch';
    const exec = this.base(record, context, {
      callId,
      kind: isPatch ? 'patch' : 'tool',
      source: 'custom_tool_call',
      name,
      turnId,
      observed,
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
    const callId = str(item.call_id) ?? str(item.id);
    const exec = this.base(record, context, {
      callId,
      kind: 'tool_search',
      source: 'tool_search_call',
      name: 'tool_search',
      turnId: passthroughTurnId(item),
      observed: recordEvidence('call', 'tool_search_call', record, callId),
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
    const id = str(item.id);
    const evidence = recordEvidence('call', 'web_search_call', record, id);
    const exec = this.base(record, context, {
      callId: id,
      kind: 'web_search',
      source: 'web_search_call',
      name: 'web_search',
      turnId: passthroughTurnId(item),
      observed: evidence,
    });
    exec.args = action;
    exec.command = describeWebSearchAction(action);
    // Hosted calls are recorded once, with their final status and no timing.
    exec.status = mapHostedStatus(str(item.status));
    if (exec.status !== 'running') {
      exec.completedAt = exec.timestamp;
      exec.evidence.result = evidence;
    }
    return exec;
  }

  /**
   * Link a hosted `web_search_call` to the WebSearch item recorded before it.
   */
  private adoptWebSearchCall(
    draft: Execution,
    record: CodexRolloutRecord,
    item: Record<string, unknown>,
    id: string | undefined
  ): void {
    draft.evidence.observed = recordEvidence('call', 'web_search_call', record, id);
    draft.evidence.cellLink = {
      method: 'explicit_id',
      detail: 'Item recorded one record before its call; linked by web_search_call.id',
    };
    if (isRecord(item.action)) {
      draft.args = item.action;
      draft.command ??= describeWebSearchAction(item.action);
    }
    draft.turnId ??= passthroughTurnId(item);
    if (mapHostedStatus(str(item.status)) === 'failed') {
      draft.status = 'failed';
    }
    if (id) {
      this.byCallId.set(id, draft);
    }
  }

  private fromImageGenerationCall(
    record: CodexRolloutRecord,
    item: Record<string, unknown>,
    context: ExecutionContext
  ): Execution {
    const id = str(item.id);
    const evidence = recordEvidence('call', 'image_generation_call', record, id);
    const exec = this.base(record, context, {
      callId: id,
      kind: 'image_generation',
      source: 'image_generation_call',
      name: 'image_generation',
      turnId: passthroughTurnId(item),
      observed: evidence,
    });
    exec.command = str(item.revised_prompt);
    exec.status = mapHostedStatus(str(item.status));
    if (typeof item.result === 'string' && item.result) {
      exec.output = 'Image generated (image data is not shown)';
      exec.outputImageCount = 1;
    }
    if (exec.status !== 'running') {
      exec.evidence.result = evidence;
    }
    return exec;
  }

  /**
   * Build a nested execution for a code-cell call site or inventory entry.
   */
  private childFromCall(
    cell: Execution,
    index: number,
    name: string,
    rawArgs: unknown,
    record: CodexRolloutRecord,
    context: ExecutionContext,
    evidence: Execution['evidence']
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
    const fromInventory = evidence.observed?.kind === 'inventory';

    const child: Execution = {
      id: `${cell.id}:${index + 1}`,
      parentId: cell.id,
      provider: 'codex',
      kind: classified.kind,
      source: fromInventory ? 'executed_tool_call' : 'cell_script',
      name,
      args: argsObject,
      input: args !== undefined ? truncateText(JSON.stringify(args), MAX_INPUT_CHARS) : undefined,
      status: 'unknown',
      statusDetail:
        truncatedBytes !== undefined
          ? `Arguments truncated by Codex (${truncatedBytes} bytes)`
          : fromInventory
            ? 'Listed by Codex as attempted; no result was recorded for this call'
            : 'Found in the cell script; Codex recorded no result for this call',
      timestamp: record.timestamp ?? context.timestamp ?? cell.timestamp,
      lineNumber: record.lineNumber,
      turnId: cell.turnId,
      evidence,
    };
    applyClassification(child, classified, 'code_mode');
    return child;
  }

  // ===========================================================================
  // Recorded items
  // ===========================================================================

  private executionFromItem(
    item: CodexRecordedItem,
    envelope: CodexItemEnvelope,
    evidence: RecordEvidence,
    record: CodexRolloutRecord,
    context: ExecutionContext
  ): Execution {
    const startedAt = isoFromMs(envelope.startedAtMs);
    const completedAt = isoFromMs(envelope.completedAtMs);
    const exec: Execution = {
      id: this.uniqueId(item.id),
      provider: 'codex',
      kind: 'tool',
      source: envelope.recordType,
      name: 'item',
      status: 'completed',
      timestamp: startedAt ?? completedAt ?? record.timestamp ?? context.timestamp ?? '',
      completedAt: completedAt ?? record.timestamp,
      lineNumber: record.lineNumber,
      outputLineNumber: record.lineNumber,
      turnId: envelope.turnId ?? context.turnId,
      evidence: { observed: evidence, result: evidence },
    };

    switch (item.type) {
      case 'command': {
        const display = item.command ? describeArgv(item.command) : undefined;
        const interaction =
          item.source === 'unified_exec_interaction' || item.interactionInput !== undefined;
        exec.kind = interaction ? 'command_input' : 'command';
        exec.name = item.source === 'user_shell' ? 'user_shell' : 'command';
        exec.source = item.source === 'user_shell' ? 'user_shell' : envelope.recordType;
        exec.argv = item.command;
        exec.command = interaction ? item.interactionInput : display?.command;
        exec.shell = display?.shell;
        exec.cwd = item.cwd ?? context.cwd;
        exec.processId = item.processId;
        exec.exitCode = item.exitCode;
        exec.status = commandItemStatus(item.status, item.exitCode);
        this.setItemOutput(exec, item.output);
        break;
      }
      case 'file_change':
        exec.kind = 'patch';
        exec.name = 'apply_patch';
        exec.command = 'apply_patch';
        exec.cwd = context.cwd;
        exec.patchFiles = item.files;
        exec.status = mapPatchStatus(item.status);
        this.setItemOutput(exec, joinText(item.stdout, item.stderr));
        break;
      case 'mcp':
        exec.kind = 'mcp';
        exec.name = item.tool ?? 'mcp';
        exec.namespace = item.server;
        exec.args = isRecord(item.arguments) ? item.arguments : undefined;
        exec.status = item.isError ? 'failed' : mapMcpStatus(item.status);
        exec.statusDetail = item.error;
        break;
      case 'web_search':
        exec.kind = 'web_search';
        exec.name = 'web_search';
        exec.command = item.query;
        exec.args = item.actionType ? { action: item.actionType } : undefined;
        if (item.resultCount !== undefined) {
          this.setItemOutput(exec, `${item.resultCount} result(s)`);
        }
        break;
      case 'extension':
        exec.name = item.extensionKind ?? 'extension';
        exec.command = item.query;
        break;
    }
    applyItemTiming(
      exec,
      item.type === 'command' || item.type === 'mcp' ? item.durationMs : undefined,
      envelope
    );
    return exec;
  }

  /**
   * Apply an item record to an execution it was explicitly linked to.
   */
  private applyItem(
    draft: Execution,
    item: CodexRecordedItem,
    envelope: CodexItemEnvelope,
    evidence: RecordEvidence,
    record: CodexRolloutRecord
  ): void {
    draft.evidence.observed ??= evidence;
    draft.evidence.result = evidence;
    switch (item.type) {
      case 'command': {
        if (item.exitCode !== undefined) {
          draft.exitCode = item.exitCode;
        }
        const status = commandItemStatus(item.status, item.exitCode);
        if (item.status !== undefined || item.exitCode !== undefined) {
          draft.status = status;
          draft.statusDetail = undefined;
        }
        draft.cwd ??= item.cwd;
        draft.processId ??= item.processId;
        if (draft.output === undefined && item.output) {
          this.setItemOutput(draft, item.output);
          this.provisionalOutputs.add(draft);
        }
        break;
      }
      case 'file_change': {
        const status = mapPatchStatus(item.status);
        if (status !== 'completed' || draft.status === 'running' || draft.status === 'unknown') {
          draft.status = status;
        }
        if (!draft.patchFiles || draft.patchFiles.length === 0) {
          draft.patchFiles = item.files;
        }
        if (draft.output === undefined) {
          const text = joinText(item.stdout, item.stderr);
          if (text) {
            this.setItemOutput(draft, text);
            this.provisionalOutputs.add(draft);
          }
        }
        if (status === 'failed') {
          draft.statusDetail = firstLine(item.stderr) ?? 'Patch failed to apply';
        }
        break;
      }
      case 'mcp':
        if (item.isError) {
          draft.status = 'failed';
          draft.statusDetail = item.error ?? draft.statusDetail;
        } else if (draft.status === 'running' || draft.status === 'unknown') {
          draft.status = mapMcpStatus(item.status);
        }
        break;
      case 'web_search':
      case 'extension':
        if (draft.status === 'running' || draft.status === 'unknown') {
          draft.status = 'completed';
        }
        break;
    }
    applyItemTiming(
      draft,
      item.type === 'command' || item.type === 'mcp' ? item.durationMs : undefined,
      envelope
    );
    draft.completedAt ??= isoFromMs(envelope.completedAtMs) ?? record.timestamp;
    draft.outputLineNumber ??= record.lineNumber;
  }

  private setItemOutput(draft: Execution, text: string | undefined): void {
    if (!text) {
      return;
    }
    draft.output = truncateText(text, MAX_OUTPUT_CHARS);
    draft.outputTruncated = text.length > MAX_OUTPUT_CHARS || undefined;
    draft.outputCount = 1;
  }

  private attachRecordedChild(cellId: string, draft: Execution, link: EvidenceLink): void {
    const cell = this.codeCells.find((candidate) => candidate.id === cellId);
    if (!cell) {
      return;
    }
    draft.parentId = cell.id;
    draft.turnId ??= cell.turnId;
    draft.evidence.cellLink = link;
    cell.children = [...(cell.children ?? []), draft];
  }

  /**
   * Link a cell's call sites (script or inventory) to recorded command items
   * when the normalized command text is identical and unique on both sides.
   */
  private linkCallSites(draft: Execution): void {
    const children = draft.children ?? [];
    const sites = new Map<string, Execution[]>();
    const items = new Map<string, Execution[]>();
    for (const child of children) {
      if (child.kind !== 'command' || child.command === undefined) continue;
      const key = normalizeCommand(child.command);
      const isSite =
        (child.evidence.code !== undefined || child.evidence.observed?.kind === 'inventory') &&
        child.evidence.result === undefined;
      const isItem = child.evidence.observed?.kind === 'item' && child.evidence.code === undefined;
      if (isSite) sites.set(key, [...(sites.get(key) ?? []), child]);
      if (isItem) items.set(key, [...(items.get(key) ?? []), child]);
    }

    const merged = new Set<Execution>();
    for (const [key, candidates] of sites) {
      const matches = items.get(key);
      if (candidates.length !== 1 || matches?.length !== 1) continue;
      mergeRecordedInto(candidates[0], matches[0]);
      merged.add(matches[0]);
      this.byItemId.set(matches[0].id, candidates[0]);
    }
    if (merged.size > 0) {
      draft.children = children.filter((child) => !merged.has(child));
    }
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
      // Prefer the output the model actually saw over the item record's text.
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
    record: CodexRolloutRecord,
    intermediate: boolean
  ): void {
    const itemReported =
      draft.evidence.result?.kind === 'item' && draft.durationSource === 'reported';
    if (parsed.wallTimeMs !== undefined && !itemReported) {
      draft.durationMs = parsed.wallTimeMs;
      draft.durationSource = 'reported';
    } else if (draft.durationSource === undefined || draft.durationSource === 'record_timestamps') {
      draft.durationMs = observedDuration(draft.timestamp, draft.completedAt);
      draft.durationSource = draft.durationMs === undefined ? undefined : 'record_timestamps';
    }

    switch (draft.kind) {
      case 'command':
      case 'command_input':
      case 'patch':
        this.applyCommandOutcome(draft, parsed, text, record);
        return;
      case 'code_cell':
      case 'code_wait':
        this.applyScriptOutcome(draft, parsed, text, record, intermediate);
        return;
      default: {
        const outcome = classifyOutcomeText(parsed.body || text);
        draft.status = outcome ?? 'completed';
        if (outcome) {
          draft.statusDetail = firstLine(parsed.body || text);
        }
      }
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
        origin.durationSource = origin.durationMs === undefined ? undefined : 'record_timestamps';
        origin.statusDetail = `Exited while polled by ${draft.id}`;
        origin.evidence.result = recordEvidence('output', 'function_call_output', record, draft.id);
        this.processOrigins.delete(draft.processId);
      }
    }
  }

  private applyScriptOutcome(
    draft: Execution,
    parsed: ParsedToolOutput,
    text: string,
    record: CodexRolloutRecord,
    intermediate: boolean
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
      if (intermediate) {
        return;
      }
      const outcome = classifyOutcomeText(parsed.body || text);
      if (draft.kind === 'code_cell') {
        // No status header: the outcome is unknown, and without a yield header
        // the cell cannot be shown to still be running.
        draft.status = outcome ?? 'unknown';
        draft.statusDetail = outcome
          ? firstLine(parsed.body || text)
          : 'Output recorded without a script status header';
        this.openCells.delete(draft);
      } else {
        draft.status = outcome ?? 'completed';
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
      if (parsed.scriptStatus !== 'running') {
        this.openCells.delete(draft);
      }
      return;
    }

    // `wait`: the poll itself completed; the cell's state is what it reports.
    draft.status = 'completed';
    draft.statusDetail = detail;
    if (cell && cell !== draft) {
      draft.parentId ??= cell.id;
      if (parsed.scriptStatus !== 'running') {
        this.completeCell(cell, cellStatus, `${detail} (reported by ${draft.id})`, record);
      }
    }
  }

  private completeCell(
    draft: Execution,
    status: ExecutionStatus,
    detail: string,
    record: CodexRolloutRecord
  ): void {
    draft.status = status;
    draft.statusDetail = detail;
    draft.completedAt = record.timestamp ?? draft.completedAt;
    draft.durationMs = observedDuration(draft.timestamp, draft.completedAt);
    draft.durationSource = draft.durationMs === undefined ? undefined : 'record_timestamps';
    draft.evidence.result = recordEvidence('output', 'function_call_output', record);
    this.openCells.delete(draft);
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
      // A recorded inventory supersedes the script's call sites; recorded items stay.
      const existing = target.children ?? [];
      const inventory = existing.filter((child) => child.evidence.observed?.kind === 'inventory');
      const recorded = existing.filter(
        (child) =>
          child.evidence.code === undefined && child.evidence.observed?.kind !== 'inventory'
      );
      for (const call of calls) {
        if (!isRecord(call)) continue;
        inventory.push(
          this.childFromCall(
            target,
            inventory.length,
            str(call.name) ?? 'unknown',
            call.arguments,
            record,
            context,
            {
              observed: recordEvidence('inventory', 'executed_tool_calls', record),
            }
          )
        );
      }
      target.children = [...inventory, ...recorded];
    }
    if (metadata.tool_calls_complete === true) {
      target.childrenComplete = true;
      target.children ??= [];
    }
  }

  private handleToolSearchOutput(
    record: CodexRolloutRecord,
    item: Record<string, unknown>,
    context: ExecutionContext,
    callId: string | undefined,
    evidence: RecordEvidence
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
        turnId: passthroughTurnId(item),
        observed: evidence,
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
    exec.evidence.result = evidence;
    exec.durationMs = observedDuration(exec.timestamp, exec.completedAt);
    exec.durationSource = exec.durationMs === undefined ? undefined : 'record_timestamps';
    return created;
  }

  // ===========================================================================
  // Registration helpers
  // ===========================================================================

  private base(record: CodexRolloutRecord, context: ExecutionContext, init: BaseInit): Execution {
    return {
      id: this.uniqueId(init.callId),
      provider: 'codex',
      kind: init.kind,
      source: init.source,
      name: init.name,
      status: 'running',
      timestamp: record.timestamp ?? context.timestamp ?? '',
      lineNumber: record.lineNumber,
      turnId: init.turnId ?? context.turnId,
      evidence: { observed: init.observed },
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

/**
 * Evidence for one persisted record.
 */
function recordEvidence(
  kind: RecordEvidence['kind'],
  recordType: string,
  record: CodexRolloutRecord,
  recordId?: string
): RecordEvidence {
  return { kind, recordType, lineNumber: record.lineNumber, recordId };
}

/** Turn id the harness stamped on a response item, when present. */
function passthroughTurnId(item: Record<string, unknown>): string | undefined {
  const metadata = item.internal_chat_message_metadata_passthrough;
  return isRecord(metadata) ? str(metadata.turn_id) : undefined;
}

function isoFromMs(ms: number | undefined): string | undefined {
  if (ms === undefined) {
    return undefined;
  }
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * Timing from an item record: a duration the provider reported wins over one
 * computed from the provider's own start/completion timestamps.
 */
function applyItemTiming(
  draft: Execution,
  reportedMs: number | undefined,
  envelope: CodexItemEnvelope
): void {
  if (reportedMs !== undefined) {
    draft.durationMs = reportedMs;
    draft.durationSource = 'reported';
    return;
  }
  const { startedAtMs, completedAtMs } = envelope;
  if (
    draft.durationSource !== 'reported' &&
    startedAtMs !== undefined &&
    completedAtMs !== undefined &&
    completedAtMs >= startedAtMs
  ) {
    draft.durationMs = completedAtMs - startedAtMs;
    draft.durationSource = 'provider_timestamps';
  }
}

/**
 * Move a recorded command item's result onto the script call site it matched.
 */
function mergeRecordedInto(draft: Execution, recorded: Execution): void {
  draft.status = recorded.status;
  draft.statusDetail = recorded.statusDetail;
  draft.exitCode = recorded.exitCode;
  draft.durationMs = recorded.durationMs;
  draft.durationSource = recorded.durationSource;
  draft.output = recorded.output;
  draft.outputCount = recorded.outputCount;
  draft.outputTruncated = recorded.outputTruncated;
  draft.completedAt = recorded.completedAt;
  draft.outputLineNumber = recorded.outputLineNumber;
  draft.processId ??= recorded.processId;
  draft.cwd = recorded.cwd ?? draft.cwd;
  draft.argv ??= recorded.argv;
  draft.shell ??= recorded.shell;
  draft.generation ??= recorded.generation;
  draft.evidence = {
    ...draft.evidence,
    observed: recorded.evidence.observed,
    result: recorded.evidence.result,
    cellLink: recorded.evidence.cellLink,
    callSiteLink: {
      method: 'content',
      detail:
        'Identical command text: the only such call site and the only such recorded command in this cell',
    },
  };
}

function commandItemStatus(
  status: string | undefined,
  exitCode: number | undefined
): ExecutionStatus {
  const mapped = mapCommandStatus(status, exitCode);
  if (mapped) {
    return mapped;
  }
  if (exitCode !== undefined) {
    return exitCode === 0 ? 'completed' : 'failed';
  }
  return 'completed';
}

function mapPatchStatus(status: string | undefined): ExecutionStatus {
  switch (status) {
    case 'failed':
      return 'failed';
    case 'declined':
      return 'declined';
    case 'in_progress':
      return 'running';
    default:
      return 'completed';
  }
}

function mapMcpStatus(status: string | undefined): ExecutionStatus {
  switch (status) {
    case 'failed':
      return 'failed';
    case 'in_progress':
    case 'inProgress':
      return 'running';
    default:
      return 'completed';
  }
}

function joinText(...parts: (string | undefined)[]): string | undefined {
  const present = parts.filter((part): part is string => !!part);
  return present.length > 0 ? present.join('\n') : undefined;
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
