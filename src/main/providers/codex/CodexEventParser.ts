/**
 * CodexEventParser - Interprets `event_msg` rollout records.
 *
 * Which events are persisted depends on the rollout's history mode:
 * - Legacy rollouts keep `user_message`, `agent_message`, `agent_reasoning`,
 *   `patch_apply_end`, `mcp_tool_call_end`, … alongside the response items.
 * - Paginated rollouts keep `item_completed` events carrying `TurnItem`s.
 * Both keep `token_count`, `task_started`, `task_complete` and `turn_aborted`.
 *
 * Execution items (CommandExecution, FileChange, McpToolCall, WebSearch,
 * Extension) and the legacy `*_end` events are normalized into one
 * `recorded_item` shape. Real rollouts show these records are the only
 * persisted evidence of operations dispatched from code-mode cells; their ids
 * (`exec-<uuid>`) never equal a call id, so linking them to a call or cell is
 * left to the execution parser (see docs/codex-real-validation).
 */

import { durationToMs } from './execOutput';

import type { CodexTokenUsageRaw } from './types';
import type {
  AgentTokenUsage,
  AgentTokenUsageTotals,
  CommandAction,
  FileWrite,
  RecordedFileDiff,
} from '@main/domain';

/** Recorded diff text kept per file of a file-change record */
const MAX_FILE_DIFF_CHARS = 64 * 1024;
/** Recorded diff text kept per file-change record, across its files */
const MAX_RECORD_DIFF_CHARS = 256 * 1024;

/**
 * An execution recorded by the harness. `id` is the item id: the call id for
 * direct calls, `exec-<uuid>` for calls dispatched from a code-mode cell.
 */
export type CodexRecordedItem =
  | {
      type: 'command';
      id: string;
      command?: string[];
      cwd?: string;
      /** `agent`, `user_shell`, `unified_exec_startup`, `unified_exec_interaction` */
      source?: string;
      processId?: string;
      exitCode?: number;
      /** Duration field reported by the provider */
      durationMs?: number;
      status?: string;
      output?: string;
      interactionInput?: string;
      /** Codex's own classification of the command (`parsed_cmd`) */
      actions?: CommandAction[];
    }
  | {
      type: 'file_change';
      id: string;
      status?: string;
      writes: FileWrite[];
      stdout?: string;
      stderr?: string;
    }
  | {
      type: 'mcp';
      id: string;
      server?: string;
      tool?: string;
      arguments?: unknown;
      status?: string;
      durationMs?: number;
      isError: boolean;
      error?: string;
    }
  | {
      type: 'web_search';
      id: string;
      query?: string;
      actionType?: string;
      resultCount?: number;
    }
  | {
      type: 'extension';
      id: string;
      /** Extension kind, e.g. `clock.sleep` */
      extensionKind?: string;
      query?: string;
    };

/** Fields of the record that carried a recorded item. */
export interface CodexItemEnvelope {
  /** e.g. `item_completed/FileChange`, `exec_command_end` */
  recordType: string;
  turnId?: string;
  threadId?: string;
  /** Provider start time (ms since epoch), when recorded */
  startedAtMs?: number;
  /** Provider completion time (ms since epoch), when recorded */
  completedAtMs?: number;
}

export type CodexEvent =
  | { kind: 'user_message'; text: string; imageCount: number }
  | { kind: 'agent_message'; text: string; phase?: string }
  | { kind: 'agent_reasoning'; text: string; raw: boolean }
  | { kind: 'reasoning_item'; summary: string[]; content: string[] }
  | { kind: 'token_count'; usage: AgentTokenUsage }
  | { kind: 'turn_started'; turnId?: string }
  | { kind: 'turn_complete'; turnId?: string; error?: string; durationMs?: number }
  | { kind: 'turn_aborted'; turnId?: string; reason?: string; durationMs?: number }
  | { kind: 'context_compacted' }
  /** `thread_settings_applied`: the thread settings as recorded (raw; see CodexRuntimeState) */
  | { kind: 'thread_settings'; threadId?: string; settings: Record<string, unknown> }
  | { kind: 'recorded_item'; item: CodexRecordedItem; envelope: CodexItemEnvelope }
  | { kind: 'ignored'; type: string };

/**
 * Parse an `event_msg` payload.
 */
export function parseCodexEvent(payload: Record<string, unknown>): CodexEvent {
  const type = typeof payload.type === 'string' ? payload.type : '';

  switch (type) {
    case 'user_message': {
      const images = Array.isArray(payload.images) ? payload.images.length : 0;
      return { kind: 'user_message', text: str(payload.message) ?? '', imageCount: images };
    }
    case 'agent_message':
      return { kind: 'agent_message', text: str(payload.message) ?? '', phase: str(payload.phase) };
    case 'agent_reasoning':
      return { kind: 'agent_reasoning', text: str(payload.text) ?? '', raw: false };
    case 'agent_reasoning_raw_content':
      return { kind: 'agent_reasoning', text: str(payload.text) ?? '', raw: true };
    case 'token_count': {
      const usage = parseTokenUsage(payload.info);
      return usage ? { kind: 'token_count', usage } : { kind: 'ignored', type };
    }
    case 'task_started':
    case 'turn_started':
      return { kind: 'turn_started', turnId: str(payload.turn_id) };
    case 'task_complete':
    case 'turn_complete':
      return {
        kind: 'turn_complete',
        turnId: str(payload.turn_id),
        error: describeError(payload.error),
        durationMs: num(payload.duration_ms),
      };
    case 'turn_aborted':
      return {
        kind: 'turn_aborted',
        turnId: str(payload.turn_id),
        reason: str(payload.reason),
        durationMs: num(payload.duration_ms),
      };
    case 'context_compacted':
      return { kind: 'context_compacted' };
    case 'thread_settings_applied':
      return isRecord(payload.thread_settings)
        ? {
            kind: 'thread_settings',
            threadId: str(payload.thread_id),
            settings: payload.thread_settings,
          }
        : { kind: 'ignored', type };
    case 'exec_command_end': {
      const item = parseCommandItem(payload, str(payload.call_id));
      return item ? recorded(item, type, payload) : { kind: 'ignored', type };
    }
    case 'patch_apply_end': {
      const id = str(payload.call_id);
      if (!id) {
        return { kind: 'ignored', type };
      }
      const success = typeof payload.success === 'boolean' ? payload.success : undefined;
      return recorded(
        {
          type: 'file_change',
          id,
          status: success === undefined ? undefined : success ? 'completed' : 'failed',
          writes: parseFileWrites(payload.changes),
          stdout: str(payload.stdout),
          stderr: str(payload.stderr),
        },
        type,
        payload
      );
    }
    case 'mcp_tool_call_end': {
      const id = str(payload.call_id);
      if (!id) {
        return { kind: 'ignored', type };
      }
      const outcome = describeMcpResult(payload.result);
      const invocation = isRecord(payload.invocation) ? payload.invocation : {};
      return recorded(
        {
          type: 'mcp',
          id,
          server: str(invocation.server),
          tool: str(invocation.tool),
          arguments: invocation.arguments,
          durationMs: durationToMs(payload.duration),
          isError: outcome.isError,
          error: outcome.error,
        },
        type,
        payload
      );
    }
    case 'item_completed':
      return parseCompletedItem(payload);
    default:
      return { kind: 'ignored', type };
  }
}

function recorded(
  item: CodexRecordedItem,
  recordType: string,
  payload: Record<string, unknown>
): CodexEvent {
  return {
    kind: 'recorded_item',
    item,
    envelope: {
      recordType,
      turnId: str(payload.turn_id),
      threadId: str(payload.thread_id),
      startedAtMs: positiveNum(payload.started_at_ms),
      completedAtMs: positiveNum(payload.completed_at_ms),
    },
  };
}

/**
 * Parse the `TurnItem` of an `item_completed` event.
 */
function parseCompletedItem(payload: Record<string, unknown>): CodexEvent {
  const record = isRecord(payload.item) ? payload.item : undefined;
  if (!record) {
    return { kind: 'ignored', type: 'item_completed' };
  }
  const itemType = str(record.type) ?? '';
  const recordType = `item_completed/${itemType || 'unknown'}`;

  switch (itemType) {
    case 'UserMessage': {
      const content = Array.isArray(record.content) ? record.content : [];
      const texts: string[] = [];
      let imageCount = 0;
      for (const input of content) {
        if (!input || typeof input !== 'object') continue;
        const inputType = (input as { type?: unknown }).type;
        const text = (input as { text?: unknown }).text;
        if (inputType === 'text' && typeof text === 'string') {
          texts.push(text);
        } else if (inputType === 'image' || inputType === 'local_image') {
          imageCount++;
        }
      }
      return { kind: 'user_message', text: texts.join(''), imageCount };
    }
    case 'AgentMessage': {
      const content = Array.isArray(record.content) ? record.content : [];
      const text = content
        .map((part) =>
          part && typeof part === 'object' ? str((part as { text?: unknown }).text) : undefined
        )
        .filter((part): part is string => part !== undefined)
        .join('\n');
      return { kind: 'agent_message', text, phase: str(record.phase) };
    }
    case 'Reasoning':
      return {
        kind: 'reasoning_item',
        summary: stringArray(record.summary_text),
        content: stringArray(record.raw_content),
      };
    case 'CommandExecution': {
      const item = parseCommandItem(record, str(record.id));
      return item ? recorded(item, recordType, payload) : { kind: 'ignored', type: itemType };
    }
    case 'FileChange': {
      const id = str(record.id);
      if (!id) {
        return { kind: 'ignored', type: itemType };
      }
      return recorded(
        {
          type: 'file_change',
          id,
          status: str(record.status),
          writes: parseFileWrites(record.changes),
          stdout: str(record.stdout),
          stderr: str(record.stderr),
        },
        recordType,
        payload
      );
    }
    case 'McpToolCall': {
      const id = str(record.id);
      if (!id) {
        return { kind: 'ignored', type: itemType };
      }
      const status = str(record.status);
      const errorMessage = describeError(record.error);
      const resultIsError =
        isRecord(record.result) &&
        (record.result.isError === true || record.result.is_error === true);
      return recorded(
        {
          type: 'mcp',
          id,
          server: str(record.server),
          tool: str(record.tool),
          arguments: record.arguments,
          status,
          durationMs: durationToMs(record.duration),
          isError: status === 'failed' || errorMessage !== undefined || resultIsError,
          error: errorMessage,
        },
        recordType,
        payload
      );
    }
    case 'WebSearch': {
      const id = str(record.id);
      if (!id) {
        return { kind: 'ignored', type: itemType };
      }
      const action = isRecord(record.action) ? record.action : {};
      return recorded(
        {
          type: 'web_search',
          id,
          query: str(record.query),
          actionType: str(action.type),
          resultCount: Array.isArray(record.results) ? record.results.length : undefined,
        },
        recordType,
        payload
      );
    }
    case 'Extension': {
      const id = str(record.id);
      if (!id) {
        return { kind: 'ignored', type: itemType };
      }
      return recorded(
        { type: 'extension', id, extensionKind: str(record.kind), query: str(record.query) },
        recordType,
        payload
      );
    }
    // Recognized and deliberately not rendered (see docs/codex-real-validation):
    // ContextCompaction duplicates the `compacted` record; SubAgentActivity
    // `started` items link a spawn call to its child rollout and are read by
    // CodexSpawnObservations for session relations, not shown as entries; other
    // SubAgentActivity kinds and CollabAgentToolCall carry no verified relation.
    default:
      return { kind: 'ignored', type: itemType || 'item_completed' };
  }
}

function parseCommandItem(
  record: Record<string, unknown>,
  id: string | undefined
): CodexRecordedItem | null {
  if (!id) {
    return null;
  }
  const command = Array.isArray(record.command)
    ? record.command.filter((part): part is string => typeof part === 'string')
    : undefined;
  const output =
    str(record.formatted_output) ?? str(record.aggregated_output) ?? joinStreams(record);
  return {
    type: 'command',
    id,
    command,
    cwd: pathFromUri(record.cwd),
    source: str(record.source),
    processId: str(record.process_id),
    exitCode: typeof record.exit_code === 'number' ? record.exit_code : undefined,
    durationMs: durationToMs(record.duration),
    status: str(record.status),
    output,
    interactionInput: str(record.interaction_input),
    actions: parseCommandActions(record.parsed_cmd),
  };
}

/**
 * Codex `parsed_cmd`: `read {cmd, name, path}`, `list_files {cmd, path}`,
 * `search {cmd, query, path}`, `unknown {cmd}`.
 */
function parseCommandActions(value: unknown): CommandAction[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const actions = value.filter(isRecord).flatMap((entry): CommandAction[] => {
    const type = str(entry.type);
    if (!type) {
      return [];
    }
    return [
      {
        type,
        command: str(entry.cmd),
        name: str(entry.name),
        path: str(entry.path),
        query: str(entry.query),
      },
    ];
  });
  return actions.length > 0 ? actions : undefined;
}

/**
 * `changes` maps each path to `{type: 'add' | 'delete' | 'update', move_path?}`
 * with the change itself: `unified_diff` for an update, `content` for an added
 * or deleted file. That text is kept up to a size per file and per record; the
 * size of the rest is kept with it.
 */
function parseFileWrites(changes: unknown): FileWrite[] {
  if (!isRecord(changes)) {
    return [];
  }
  let budget = MAX_RECORD_DIFF_CHARS;
  return Object.entries(changes).map(([path, change]): FileWrite => {
    if (!isRecord(change)) {
      return { path };
    }
    const type = change.type;
    const diff = recordedDiff(change, Math.min(MAX_FILE_DIFF_CHARS, budget));
    budget -= diff?.text.length ?? 0;
    return {
      path,
      change: type === 'add' || type === 'delete' || type === 'update' ? type : undefined,
      movedTo: str(change.move_path),
      diff,
    };
  });
}

function recordedDiff(change: Record<string, unknown>, max: number): RecordedFileDiff | undefined {
  const field =
    typeof change.unified_diff === 'string'
      ? 'unified_diff'
      : typeof change.content === 'string'
        ? 'content'
        : undefined;
  if (!field) {
    return undefined;
  }
  const text = change[field] as string;
  return text.length > max
    ? { field, text: text.slice(0, max), omittedChars: text.length - max }
    : { field, text };
}

function joinStreams(record: Record<string, unknown>): string | undefined {
  const parts = [str(record.stdout), str(record.stderr)].filter(
    (part): part is string => part !== undefined
  );
  return parts.length > 0 ? parts.join('\n') : undefined;
}

/**
 * Parse `TokenCountEvent.info`.
 */
function parseTokenUsage(info: unknown): AgentTokenUsage | undefined {
  if (!info || typeof info !== 'object') {
    return undefined;
  }
  const record = info as {
    total_token_usage?: CodexTokenUsageRaw;
    last_token_usage?: CodexTokenUsageRaw;
    model_context_window?: unknown;
  };
  const total = toTotals(record.total_token_usage);
  if (!total) {
    return undefined;
  }
  return {
    total,
    lastTurn: toTotals(record.last_token_usage),
    contextWindow: num(record.model_context_window),
  };
}

function toTotals(raw: CodexTokenUsageRaw | undefined): AgentTokenUsageTotals | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const inputTokens = num(raw.input_tokens) ?? 0;
  const outputTokens = num(raw.output_tokens) ?? 0;
  return {
    inputTokens,
    cachedInputTokens: num(raw.cached_input_tokens) ?? 0,
    outputTokens,
    reasoningOutputTokens: num(raw.reasoning_output_tokens) ?? 0,
    totalTokens: num(raw.total_tokens) ?? inputTokens + outputTokens,
  };
}

/**
 * `cwd` may be serialized as a plain path or a `file://` URI.
 */
function pathFromUri(value: unknown): string | undefined {
  const text = str(value);
  if (!text?.startsWith('file://')) {
    return text;
  }
  try {
    const url = new URL(text);
    const decoded = decodeURIComponent(url.pathname);
    // file:///C:/Users/... → C:/Users/...
    return /^\/[a-zA-Z]:\//.test(decoded) ? decoded.slice(1) : decoded;
  } catch {
    return text;
  }
}

function describeError(error: unknown): string | undefined {
  if (typeof error === 'string') {
    return error || undefined;
  }
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) {
      return message;
    }
    return JSON.stringify(error);
  }
  return undefined;
}

function describeMcpResult(result: unknown): { isError: boolean; error?: string } {
  if (!result || typeof result !== 'object') {
    return { isError: false };
  }
  const record = result as { Ok?: unknown; Err?: unknown };
  if ('Err' in record) {
    return { isError: true, error: describeError(record.Err) };
  }
  const ok = record.Ok as { is_error?: unknown; isError?: unknown } | undefined;
  return { isError: ok?.is_error === true || ok?.isError === true };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Provider timestamps; old rollouts default missing ones to 0. */
function positiveNum(value: unknown): number | undefined {
  const n = num(value);
  return n !== undefined && n > 0 ? n : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
