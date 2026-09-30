/**
 * CodexExecutionNormalizer - Turns Codex rollout records into the
 * provider-neutral session timeline.
 *
 * Rollouts often contain the same information twice (a response item and a
 * legacy event, or a response item and a paginated `item_completed` event).
 * Each timeline entry kind therefore has one preferred source and a fallback:
 *
 * | Entry          | Preferred source                        | Fallback                          |
 * |----------------|-----------------------------------------|-----------------------------------|
 * | User message   | `user_message` / `UserMessage` events   | `message` items with role `user`  |
 * | Agent message  | `message` items with role `assistant`   | `agent_message` events            |
 * | Inter-agent    | `agent_message` items                   | —                                 |
 * | Reasoning      | `reasoning` items                       | `agent_reasoning` events          |
 * | Executions     | tool call items + outputs, item records | —                                 |
 *
 * Reasoning is surfaced as its readable summary; encrypted reasoning content
 * is reported as unavailable and never decoded.
 *
 * Subagent rollouts start with records copied from the parent thread
 * (`session_meta.subagent_history_start_ordinal`, see `InheritedHistoryTracker`).
 * Those are the parent's history, so they are summarized by one
 * `inherited_context` entry instead of being rendered as the subagent's own
 * activity. A subagent's own history has no user message; its title is its
 * task name (see `SubagentTaskNameFinder`).
 *
 * Runtime settings (the effective settings of each turn, recorded thread
 * settings and the changes between them) come from `turn_context` and
 * `thread_settings_applied`; see `CodexRuntimeStateBuilder`.
 */

import {
  hasAppliedFileWrites,
  hasRecordedResult,
  isStaticOnly,
} from '@shared/utils/executionEvidence';

import { parseCodexEvent } from './CodexEventParser';
import { CodexExecutionParser, type ExecutionContext } from './CodexExecutionParser';
import {
  type CodexSessionMetadata,
  InheritedHistoryTracker,
  isInjectedContext,
  parseSessionMeta,
  SubagentTaskNameFinder,
  toPreview,
} from './CodexMetadataParser';
import { CodexRuntimeStateBuilder } from './CodexRuntimeState';

import type { CodexRolloutRecord } from './types';
import type {
  AgentMessageEntry,
  AgentTokenUsage,
  CompactionEntry,
  Execution,
  ExecutionStats,
  InheritedContextEntry,
  ReasoningEntry,
  SessionRuntimeState,
  SessionTitleSource,
  TimelineEntry,
  UserMessageEntry,
} from '@main/domain';

export interface NormalizeOptions {
  /** Whether the rollout is still being written; keeps the current turn's executions running */
  active: boolean;
}

export interface NormalizedCodexSession {
  metadata: CodexSessionMetadata;
  /** Model of the latest effective turn state */
  model?: string;
  /** First user request as a preview, else a subagent's task name */
  title?: string;
  titleSource?: SessionTitleSource;
  /** Records skipped as inherited parent history (subagents only) */
  inheritedRecordCount?: number;
  timeline: TimelineEntry[];
  executions: Execution[];
  stats: ExecutionStats;
  tokenUsage?: AgentTokenUsage;
  /** Effective settings per turn and recorded thread settings */
  runtime: SessionRuntimeState;
  /** Non-fatal inconsistencies in the records (safe structural descriptions) */
  warnings: string[];
  /** Whether the last recorded turn started but has not finished */
  turnInProgress: boolean;
}

/** Compaction markers this close together describe the same compaction. */
const COMPACTION_MERGE_WINDOW = 5;

const TOOL_CALL_TYPES = new Set([
  'function_call',
  'local_shell_call',
  'custom_tool_call',
  'tool_search_call',
  'web_search_call',
  'image_generation_call',
]);

const TOOL_OUTPUT_TYPES = new Set([
  'function_call_output',
  'custom_tool_call_output',
  'tool_search_output',
]);

const COMPACTION_ITEM_TYPES = new Set(['compaction', 'compaction_summary', 'context_compaction']);

/**
 * Normalize a rollout's records into a session timeline.
 */
export function normalizeCodexRollout(
  records: readonly CodexRolloutRecord[],
  options: NormalizeOptions
): NormalizedCodexSession {
  const parser = new CodexExecutionParser();
  let metadata: CodexSessionMetadata = {};
  let haveMetadata = false;
  let model: string | undefined;
  let turnId: string | undefined;
  let turnCwd: string | undefined;
  let lastTimestamp: string | undefined;
  let tokenUsage: AgentTokenUsage | undefined;
  let turnInProgress = false;
  let sawTurnEvents = false;
  let currentTurnStartLine = 0;
  let lastReasoningEventLine = -1;
  let inherited: InheritedContextEntry | undefined;
  const inheritedTracker = new InheritedHistoryTracker();
  const taskNameFinder = new SubagentTaskNameFinder();
  const runtime = new CodexRuntimeStateBuilder();

  const entries: TimelineEntry[] = [];
  const eventUserMessages: UserMessageEntry[] = [];
  const itemUserMessages: UserMessageEntry[] = [];
  const itemAgentMessages: AgentMessageEntry[] = [];
  const eventAgentMessages: AgentMessageEntry[] = [];
  // Messages from other agents have no event duplicate; they never replace the agent's own.
  const interAgentMessages: AgentMessageEntry[] = [];
  const itemReasoning: ReasoningEntry[] = [];
  const eventReasoning: ReasoningEntry[] = [];
  const compactions: CompactionEntry[] = [];

  const context = (): ExecutionContext => ({
    turnId,
    cwd: turnCwd ?? metadata.cwd,
    timestamp: lastTimestamp,
  });

  const pushExecution = (exec: Execution | undefined): void => {
    if (exec) {
      entries.push({
        kind: 'execution',
        id: `x-${exec.id}`,
        timestamp: exec.timestamp || undefined,
        lineNumber: exec.lineNumber,
        turnId: exec.turnId,
        execution: exec,
      });
    }
  };

  for (const record of records) {
    if (record.timestamp) {
      lastTimestamp = record.timestamp;
    }
    const base = { timestamp: record.timestamp ?? lastTimestamp, lineNumber: record.lineNumber };

    if (inheritedTracker.isInherited(record, metadata)) {
      inherited ??= {
        kind: 'inherited_context',
        id: `i-${record.lineNumber}`,
        ...base,
        recordCount: 0,
        parentThreadId: metadata.parentThreadId,
        lastLineNumber: record.lineNumber,
      };
      inherited.recordCount++;
      inherited.lastLineNumber = record.lineNumber;
      continue;
    }
    taskNameFinder.accept(record, metadata);

    switch (record.type) {
      case 'session_meta':
        if (!haveMetadata) {
          metadata = parseSessionMeta(record.payload);
          haveMetadata = true;
          // Legacy rollouts have no per-line timestamps; start from the session's.
          lastTimestamp ??= metadata.startedAt;
        }
        break;

      case 'turn_context': {
        turnCwd = str(record.payload.cwd) ?? turnCwd;
        model = str(record.payload.model) ?? model;
        turnId = str(record.payload.turn_id) ?? turnId;
        runtime.turnContext(record, base.timestamp);
        break;
      }

      case 'compacted':
        compactions.push({
          kind: 'compaction',
          id: `c-${record.lineNumber}`,
          ...base,
          summary: str(record.payload.message),
          encrypted: false,
        });
        break;

      case 'response_item': {
        const item = record.payload;
        const type = str(item.type) ?? '';

        if (TOOL_CALL_TYPES.has(type)) {
          pushExecution(parser.handleCall(record, item, context()));
        } else if (TOOL_OUTPUT_TYPES.has(type)) {
          pushExecution(parser.handleOutput(record, item, context()));
        } else if (type === 'message') {
          const role = str(item.role);
          const { text, imageCount } = messageText(item.content, role === 'user');
          if (role === 'user') {
            if (text || imageCount > 0) {
              itemUserMessages.push({
                kind: 'user_message',
                id: `u-${record.lineNumber}`,
                ...base,
                turnId,
                text,
                imageCount: imageCount || undefined,
              });
            }
          } else if (role === 'assistant' && text) {
            itemAgentMessages.push({
              kind: 'agent_message',
              id: `a-${record.lineNumber}`,
              ...base,
              turnId,
              text,
              phase: messagePhase(item.phase),
            });
          }
        } else if (type === 'agent_message') {
          const { text, encrypted } = agentMessageText(item.content);
          interAgentMessages.push({
            kind: 'agent_message',
            id: `a-${record.lineNumber}`,
            ...base,
            turnId,
            text,
            author: str(item.author),
            recipient: str(item.recipient),
            encrypted: encrypted || undefined,
          });
        } else if (type === 'reasoning') {
          const summary = contentTexts(item.summary);
          const content = contentTexts(item.content);
          const encrypted =
            typeof item.encrypted_content === 'string' && item.encrypted_content.length > 0;
          if (summary.length > 0 || content.length > 0 || encrypted) {
            itemReasoning.push({
              kind: 'reasoning',
              id: `r-${record.lineNumber}`,
              ...base,
              turnId,
              summary,
              content: content.length > 0 ? content : undefined,
              encrypted,
            });
          }
        } else if (COMPACTION_ITEM_TYPES.has(type)) {
          compactions.push({
            kind: 'compaction',
            id: `c-${record.lineNumber}`,
            ...base,
            encrypted: typeof item.encrypted_content === 'string',
          });
        }
        break;
      }

      case 'event_msg': {
        const event = parseCodexEvent(record.payload);
        switch (event.kind) {
          case 'user_message':
            if (event.text.trim() || event.imageCount > 0) {
              eventUserMessages.push({
                kind: 'user_message',
                id: `u-${record.lineNumber}`,
                ...base,
                turnId,
                text: event.text,
                imageCount: event.imageCount || undefined,
              });
            }
            break;
          case 'agent_message':
            if (event.text.trim()) {
              eventAgentMessages.push({
                kind: 'agent_message',
                id: `a-${record.lineNumber}`,
                ...base,
                turnId,
                text: event.text,
                phase: messagePhase(event.phase),
              });
            }
            break;
          case 'agent_reasoning': {
            if (!event.text.trim()) break;
            // Reasoning events on consecutive lines are sections of one block.
            const previous =
              eventReasoning.length > 0 ? eventReasoning[eventReasoning.length - 1] : undefined;
            const continues = lastReasoningEventLine === record.lineNumber - 1;
            lastReasoningEventLine = record.lineNumber;
            if (previous && continues) {
              if (event.raw) {
                previous.content = [...(previous.content ?? []), event.text];
              } else {
                previous.summary = [...previous.summary, event.text];
              }
            } else {
              eventReasoning.push({
                kind: 'reasoning',
                id: `r-${record.lineNumber}`,
                ...base,
                turnId,
                summary: event.raw ? [] : [event.text],
                content: event.raw ? [event.text] : undefined,
                encrypted: false,
              });
            }
            break;
          }
          case 'reasoning_item':
            if (event.summary.length > 0 || event.content.length > 0) {
              eventReasoning.push({
                kind: 'reasoning',
                id: `r-${record.lineNumber}`,
                ...base,
                turnId,
                summary: event.summary,
                content: event.content.length > 0 ? event.content : undefined,
                encrypted: false,
              });
            }
            break;
          case 'token_count':
            tokenUsage = event.usage;
            break;
          case 'turn_started':
            sawTurnEvents = true;
            turnInProgress = true;
            currentTurnStartLine = record.lineNumber;
            turnId = event.turnId ?? turnId;
            runtime.turnStarted(event.turnId);
            break;
          case 'turn_complete':
            sawTurnEvents = true;
            turnInProgress = false;
            runtime.turnEnded();
            parser.closeTurn(event.turnId ?? turnId);
            if (event.error) {
              entries.push({
                kind: 'turn_event',
                id: `t-${record.lineNumber}`,
                ...base,
                turnId: event.turnId ?? turnId,
                event: 'failed',
                reason: event.error,
                durationMs: event.durationMs,
              });
            }
            break;
          case 'turn_aborted':
            sawTurnEvents = true;
            turnInProgress = false;
            runtime.turnEnded();
            parser.interruptTurn(event.turnId ?? turnId);
            entries.push({
              kind: 'turn_event',
              id: `t-${record.lineNumber}`,
              ...base,
              turnId: event.turnId ?? turnId,
              event: 'aborted',
              reason: event.reason,
              durationMs: event.durationMs,
            });
            break;
          case 'context_compacted':
            compactions.push({
              kind: 'compaction',
              id: `c-${record.lineNumber}`,
              ...base,
              encrypted: false,
            });
            break;
          case 'recorded_item':
            pushExecution(parser.handleRecordedItem(event.item, event.envelope, record, context()));
            break;
          case 'thread_settings':
            runtime.threadSettings(record, base.timestamp, event, metadata.threadId);
            break;
          case 'ignored':
            break;
        }
        break;
      }

      default:
        break;
    }
  }

  if (!sawTurnEvents) {
    // Without turn events, an actively written rollout is assumed mid-turn.
    turnInProgress = options.active;
  }
  parser.finalize(
    options.active && turnInProgress ? currentTurnStartLine : Number.POSITIVE_INFINITY
  );

  const userMessages = eventUserMessages.length > 0 ? eventUserMessages : itemUserMessages;
  const agentMessages = itemAgentMessages.length > 0 ? itemAgentMessages : eventAgentMessages;
  const reasoning = itemReasoning.length > 0 ? itemReasoning : eventReasoning;
  const settings = runtime.finish();

  const timeline: TimelineEntry[] = [
    ...(inherited ? [inherited] : []),
    ...entries,
    ...userMessages,
    ...agentMessages,
    ...interAgentMessages,
    ...reasoning,
    ...mergeCompactions(compactions),
    ...settings.entries,
  ];
  // File order is chronological; the sort is stable for entries from one line.
  timeline.sort((a, b) => a.lineNumber - b.lineNumber);

  const executions = parser.getExecutions();
  const firstRequest = userMessages.find((message) => message.text.trim());
  const { taskName } = taskNameFinder;
  let titleSource: SessionTitleSource | undefined;
  if (firstRequest) {
    titleSource = 'user_message';
  } else if (taskName) {
    titleSource = 'agent_task';
  }

  // The current model is the latest effective turn state's, not a later
  // re-emitted turn context's.
  const latestModel = [...settings.runtime.turns].reverse().find((turn) => turn.settings.model)
    ?.settings.model;

  return {
    metadata,
    model: latestModel ?? model,
    title: firstRequest ? toPreview(firstRequest.text) : taskName,
    titleSource,
    inheritedRecordCount:
      metadata.historyStartOrdinal !== undefined ? (inherited?.recordCount ?? 0) : undefined,
    timeline,
    executions,
    stats: computeExecutionStats(executions),
    tokenUsage,
    runtime: settings.runtime,
    warnings: settings.warnings,
    turnInProgress: options.active && turnInProgress,
  };
}

/**
 * Count executions by kind and status (nested executions included).
 */
function computeExecutionStats(executions: readonly Execution[]): ExecutionStats {
  const stats: ExecutionStats = {
    total: executions.length,
    commands: 0,
    nested: 0,
    recorded: 0,
    scriptOnly: 0,
    unattributed: 0,
    failed: 0,
    running: 0,
    declined: 0,
    interrupted: 0,
    byKind: {},
    filesWritten: 0,
    commandActions: {},
  };
  const written = new Set<string>();
  const visit = (exec: Execution, nested: boolean): void => {
    stats.byKind[exec.kind] = (stats.byKind[exec.kind] ?? 0) + 1;
    // A script call site is not a command that ran; count commands with a provider record.
    if (exec.kind === 'command' && (exec.evidence.observed || exec.evidence.result)) {
      stats.commands++;
    }
    if (nested) stats.nested++;
    if (hasRecordedResult(exec)) stats.recorded++;
    if (isStaticOnly(exec)) stats.scriptOnly++;
    if (
      !nested &&
      exec.evidence.observed?.kind === 'item' &&
      exec.evidence.cellLink?.method === 'unresolved'
    ) {
      stats.unattributed++;
    }
    if (exec.status === 'failed') stats.failed++;
    if (exec.status === 'running') stats.running++;
    if (exec.status === 'declined') stats.declined++;
    if (exec.status === 'interrupted') stats.interrupted++;
    if (hasAppliedFileWrites(exec)) {
      for (const write of exec.fileWrites ?? []) written.add(write.movedTo ?? write.path);
    }
    for (const action of exec.commandActions ?? []) {
      if (action.type !== 'unknown') {
        stats.commandActions[action.type] = (stats.commandActions[action.type] ?? 0) + 1;
      }
    }
    for (const child of exec.children ?? []) {
      visit(child, true);
    }
  };
  for (const exec of executions) {
    visit(exec, false);
  }
  stats.filesWritten = written.size;
  return stats;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Text of a `message` item. For user messages, harness-injected context
 * blocks are dropped part by part.
 */
function messageText(
  content: unknown,
  dropInjected: boolean
): { text: string; imageCount: number } {
  if (typeof content === 'string') {
    return {
      text: dropInjected && isInjectedContext(content) ? '' : content.trim(),
      imageCount: 0,
    };
  }
  if (!Array.isArray(content)) {
    return { text: '', imageCount: 0 };
  }
  const parts: string[] = [];
  let imageCount = 0;
  for (const part of content) {
    if (!part || typeof part !== 'object') continue;
    const { type, text } = part as { type?: unknown; text?: unknown };
    if (
      (type === 'input_text' || type === 'output_text' || type === 'text') &&
      typeof text === 'string'
    ) {
      if (dropInjected && isInjectedContext(text)) continue;
      parts.push(text);
    } else if (type === 'input_image') {
      imageCount++;
    }
  }
  return { text: parts.join('\n').trim(), imageCount };
}

function agentMessageText(content: unknown): { text: string; encrypted: boolean } {
  if (!Array.isArray(content)) {
    return { text: '', encrypted: false };
  }
  const parts: string[] = [];
  let encrypted = false;
  for (const part of content) {
    if (!part || typeof part !== 'object') continue;
    const { type, text } = part as { type?: unknown; text?: unknown };
    if (type === 'encrypted_content') {
      encrypted = true;
    } else if (typeof text === 'string') {
      parts.push(text);
    }
  }
  return { text: parts.join('\n').trim(), encrypted };
}

function contentTexts(content: unknown): string[] {
  if (!Array.isArray(content)) {
    return [];
  }
  return content
    .map((part) =>
      part && typeof part === 'object' ? (part as { text?: unknown }).text : undefined
    )
    .filter((text): text is string => typeof text === 'string' && text.trim().length > 0);
}

function messagePhase(phase: unknown): AgentMessageEntry['phase'] {
  return phase === 'commentary' || phase === 'final_answer' ? phase : undefined;
}

function mergeCompactions(markers: CompactionEntry[]): CompactionEntry[] {
  const sorted = [...markers].sort((a, b) => a.lineNumber - b.lineNumber);
  const merged: CompactionEntry[] = [];
  for (const marker of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && marker.lineNumber - previous.lineNumber <= COMPACTION_MERGE_WINDOW) {
      previous.summary ??= marker.summary;
      previous.encrypted ||= marker.encrypted;
      continue;
    }
    merged.push({ ...marker });
  }
  return merged;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
