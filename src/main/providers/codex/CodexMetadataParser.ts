/**
 * CodexMetadataParser - Session-level metadata from Codex rollouts.
 *
 * Responsibilities:
 * - Read `session_meta` (thread id, cwd, originator, CLI version, source, git)
 * - Describe the session source (`cli`, `vscode`, `exec`, sub-agents, …)
 * - Derive project grouping keys and names from the working directory
 * - Recognise harness-injected context blocks inside user messages
 */

import { trimTrailingSeparators } from './codexPaths';

import type { CodexRolloutRecord, CodexSessionMetaPayload } from './types';

export interface CodexSessionMetadata {
  threadId?: string;
  startedAt?: string;
  cwd?: string;
  originator?: string;
  cliVersion?: string;
  source?: string;
  modelProvider?: string;
  gitBranch?: string;
  gitCommit?: string;
  repositoryUrl?: string;
  parentThreadId?: string;
  agentNickname?: string;
  agentRole?: string;
  /**
   * First envelope ordinal of a subagent's own history. Records with a lower
   * ordinal were copied from the parent thread when the subagent was spawned.
   */
  historyStartOrdinal?: number;
}

/**
 * Extract metadata from a `session_meta` payload.
 */
export function parseSessionMeta(payload: Record<string, unknown>): CodexSessionMetadata {
  const meta = payload as CodexSessionMetaPayload;
  const source = describeSessionSource(meta.source);
  const git = meta.git && typeof meta.git === 'object' ? meta.git : undefined;

  return {
    threadId: str(meta.id) ?? str(meta.session_id),
    startedAt: str(meta.timestamp),
    cwd: str(meta.cwd),
    originator: str(meta.originator),
    cliVersion: str(meta.cli_version),
    source: source.label,
    modelProvider: str(meta.model_provider),
    gitBranch: str(git?.branch),
    gitCommit: str(git?.commit_hash),
    repositoryUrl: str(git?.repository_url),
    parentThreadId: str(meta.parent_thread_id) ?? source.parentThreadId ?? str(meta.forked_from_id),
    agentNickname: str(meta.agent_nickname) ?? source.agentNickname,
    agentRole: str(meta.agent_role) ?? str(meta.agent_type) ?? source.agentRole,
    historyStartOrdinal: positiveInteger(meta.subagent_history_start_ordinal),
  };
}

/**
 * Whether a record was inherited from the parent thread (it precedes the
 * subagent's own history). Records without an ordinal cannot be placed and
 * count as the session's own.
 */
export function isInheritedRecord(
  ordinal: number | undefined,
  metadata: Pick<CodexSessionMetadata, 'historyStartOrdinal'>
): boolean {
  return (
    ordinal !== undefined &&
    ordinal > 0 &&
    metadata.historyStartOrdinal !== undefined &&
    ordinal < metadata.historyStartOrdinal
  );
}

/**
 * Streams records and decides which ones belong to the inherited prefix.
 *
 * `subagent_history_start_ordinal` marks the boundary correctly in 12 of the
 * 22 real subagent rollouts. In the other 10 (cli 0.147.0-alpha.6.6 and some
 * 0.153.0 rollouts) it equals the rollout's record count, so every record,
 * including the subagent's own turns and tool calls, lies below it. The prefix
 * therefore also ends at the first structural marker of the subagent's own
 * history: a `thread_settings_applied` event for the rollout's own thread id,
 * or a turn whose UUIDv7 turn id was minted after the rollout's own thread id.
 * In every real rollout both markers sit at (or one record after) the declared
 * boundary where it is correct, and no parent-era turn follows them.
 */
export class InheritedHistoryTracker {
  private ownHistoryStarted = false;

  isInherited(
    record: Pick<CodexRolloutRecord, 'ordinal' | 'type' | 'payload'>,
    metadata: Pick<CodexSessionMetadata, 'historyStartOrdinal' | 'threadId'>
  ): boolean {
    if (this.ownHistoryStarted || !isInheritedRecord(record.ordinal, metadata)) {
      return false;
    }
    if (startsOwnHistory(record, metadata.threadId)) {
      this.ownHistoryStarted = true;
      return false;
    }
    return true;
  }
}

function startsOwnHistory(
  record: Pick<CodexRolloutRecord, 'type' | 'payload'>,
  threadId: string | undefined
): boolean {
  const { payload } = record;
  if (record.type === 'event_msg' && payload.type === 'thread_settings_applied') {
    return threadId !== undefined && payload.thread_id === threadId;
  }
  if (
    (record.type === 'event_msg' && payload.type === 'task_started') ||
    record.type === 'turn_context'
  ) {
    const turnMinted = uuidV7Millis(str(payload.turn_id));
    const threadMinted = uuidV7Millis(threadId);
    return turnMinted !== undefined && threadMinted !== undefined && turnMinted >= threadMinted;
  }
  return false;
}

/** Millisecond timestamp embedded in a UUIDv7, or undefined for other ids. */
export function uuidV7Millis(id: string | undefined): number | undefined {
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/i.test(id)) {
    return undefined;
  }
  return parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

interface SessionSourceDescription {
  label?: string;
  parentThreadId?: string;
  agentNickname?: string;
  agentRole?: string;
}

/**
 * Describe a serialized `SessionSource`:
 * `"cli"`, `"vscode"`, `{"custom":"atlas"}`, `{"subagent":"review"}`,
 * `{"subagent":{"thread_spawn":{"parent_thread_id":…,"agent_nickname":…}}}`.
 */
function describeSessionSource(source: unknown): SessionSourceDescription {
  if (typeof source === 'string') {
    return { label: source };
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return {};
  }
  const [key, value] = Object.entries(source as Record<string, unknown>)[0] ?? [];
  if (!key) {
    return {};
  }
  if (key === 'custom' && typeof value === 'string') {
    return { label: value };
  }
  if (key === 'subagent') {
    if (typeof value === 'string') {
      return { label: `subagent:${value}` };
    }
    if (value && typeof value === 'object') {
      const [kind, details] = Object.entries(value as Record<string, unknown>)[0] ?? [];
      const spawn =
        details && typeof details === 'object' ? (details as Record<string, unknown>) : {};
      return {
        label: kind ? `subagent:${kind}` : 'subagent',
        parentThreadId: str(spawn.parent_thread_id),
        agentNickname: str(spawn.agent_nickname),
        agentRole: str(spawn.agent_role) ?? str(spawn.agent_type),
      };
    }
    return { label: 'subagent' };
  }
  return { label: key };
}

// =============================================================================
// Project grouping
// =============================================================================

const UNKNOWN_PROJECT_KEY = '(unknown)';

/**
 * Stable grouping key for a working directory. Windows paths compare
 * case-insensitively and with either separator.
 */
export function projectKeyForCwd(cwd: string | undefined): string {
  if (!cwd?.trim()) {
    return UNKNOWN_PROJECT_KEY;
  }
  const key = cwd.trim();
  if (/^[a-zA-Z]:[\\/]/.test(key) || key.startsWith('\\\\')) {
    return trimTrailingSeparators(key.replace(/\//g, '\\').toLowerCase());
  }
  return trimTrailingSeparators(key);
}

/**
 * Display name for a working directory (its last path segment).
 */
export function projectNameForCwd(cwd: string | undefined): string {
  if (!cwd?.trim()) {
    return 'Unknown project';
  }
  const segments = cwd
    .trim()
    .split(/[\\/]+/)
    .filter(Boolean);
  return segments[segments.length - 1] ?? cwd;
}

// =============================================================================
// User message classification
// =============================================================================

/**
 * Harness-injected blocks that Codex records as `user` role messages but the
 * user never typed (environment context, AGENTS.md instructions, …).
 */
export function isInjectedContext(text: string): boolean {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('# AGENTS.md instructions for ')) {
    return true;
  }
  // `<tag>` or `<tag attr="…">` opening a block that closes with `</tag>`.
  const open = /^<([a-zA-Z_][\w-]*)[\s>]/.exec(trimmed);
  if (!open) {
    return false;
  }
  return trimmed.trimEnd().endsWith(`</${open[1]}>`);
}

/**
 * Collapse whitespace and cut a preview to `maxLength` characters.
 */
export function toPreview(text: string, maxLength = 200): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > maxLength ? `${collapsed.slice(0, maxLength - 1)}…` : collapsed;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
