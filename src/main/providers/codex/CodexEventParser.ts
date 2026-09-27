/**
 * CodexEventParser - Interprets `event_msg` rollout records.
 *
 * Which events are persisted depends on the rollout's history mode:
 * - Legacy rollouts keep `user_message`, `agent_message`, `agent_reasoning`,
 *   `patch_apply_end`, `mcp_tool_call_end`, … alongside the response items.
 * - Paginated rollouts keep `item_completed` events carrying `TurnItem`s,
 *   including `CommandExecution` items with per-command exit codes.
 * Both keep `token_count`, `task_started`, `task_complete` and `turn_aborted`.
 */

import { durationToMs } from './execOutput';

import type { CodexTokenUsageRaw } from './types';
import type { AgentTokenUsage, AgentTokenUsageTotals } from '@main/domain';

/**
 * A per-command result (from `item_completed` CommandExecution items or
 * `exec_command_end` events).
 */
export interface CodexCommandResult {
  callId: string;
  command?: string[];
  cwd?: string;
  source?: string;
  processId?: string;
  exitCode?: number;
  durationMs?: number;
  status?: string;
  output?: string;
  interactionInput?: string;
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
  | { kind: 'command_result'; result: CodexCommandResult }
  | {
      kind: 'patch_result';
      callId: string;
      success?: boolean;
      stdout?: string;
      stderr?: string;
    }
  | { kind: 'mcp_result'; callId: string; durationMs?: number; isError: boolean; error?: string }
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
    case 'exec_command_end': {
      const result = parseCommandResult(payload, str(payload.call_id));
      return result ? { kind: 'command_result', result } : { kind: 'ignored', type };
    }
    case 'patch_apply_end': {
      const callId = str(payload.call_id);
      if (!callId) {
        return { kind: 'ignored', type };
      }
      return {
        kind: 'patch_result',
        callId,
        success: typeof payload.success === 'boolean' ? payload.success : undefined,
        stdout: str(payload.stdout),
        stderr: str(payload.stderr),
      };
    }
    case 'mcp_tool_call_end': {
      const callId = str(payload.call_id);
      if (!callId) {
        return { kind: 'ignored', type };
      }
      const outcome = describeMcpResult(payload.result);
      return {
        kind: 'mcp_result',
        callId,
        durationMs: durationToMs(payload.duration),
        isError: outcome.isError,
        error: outcome.error,
      };
    }
    case 'item_completed':
      return parseCompletedItem(payload.item);
    default:
      return { kind: 'ignored', type };
  }
}

/**
 * Parse a `TurnItem` from an `item_completed` event.
 */
function parseCompletedItem(item: unknown): CodexEvent {
  if (!item || typeof item !== 'object') {
    return { kind: 'ignored', type: 'item_completed' };
  }
  const record = item as Record<string, unknown>;
  const itemType = str(record.type) ?? '';

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
      const result = parseCommandResult(record, str(record.id));
      return result ? { kind: 'command_result', result } : { kind: 'ignored', type: itemType };
    }
    case 'FileChange': {
      const callId = str(record.id);
      if (!callId) {
        return { kind: 'ignored', type: itemType };
      }
      const status = str(record.status);
      return {
        kind: 'patch_result',
        callId,
        success: status === undefined ? undefined : status === 'completed',
        stdout: str(record.stdout),
        stderr: str(record.stderr),
      };
    }
    case 'McpToolCall': {
      const callId = str(record.id);
      if (!callId) {
        return { kind: 'ignored', type: itemType };
      }
      const status = str(record.status);
      const errorMessage = describeError(record.error);
      const resultIsError =
        !!record.result &&
        typeof record.result === 'object' &&
        (record.result as { isError?: unknown; is_error?: unknown }).isError === true;
      return {
        kind: 'mcp_result',
        callId,
        durationMs: durationToMs(record.duration),
        isError: status === 'failed' || errorMessage !== undefined || resultIsError,
        error: errorMessage,
      };
    }
    default:
      return { kind: 'ignored', type: itemType || 'item_completed' };
  }
}

function parseCommandResult(
  record: Record<string, unknown>,
  callId: string | undefined
): CodexCommandResult | null {
  if (!callId) {
    return null;
  }
  const command = Array.isArray(record.command)
    ? record.command.filter((part): part is string => typeof part === 'string')
    : undefined;
  const output =
    str(record.formatted_output) ?? str(record.aggregated_output) ?? joinStreams(record);
  return {
    callId,
    command,
    cwd: pathFromUri(record.cwd),
    source: str(record.source),
    processId: str(record.process_id),
    exitCode: typeof record.exit_code === 'number' ? record.exit_code : undefined,
    durationMs: durationToMs(record.duration),
    status: str(record.status),
    output,
    interactionInput: str(record.interaction_input),
  };
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
