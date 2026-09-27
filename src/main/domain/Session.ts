/**
 * Provider-neutral session model used by the execution timeline views.
 */

import type { AgentProvider, ExecutionStats } from './Execution';
import type { TimelineEntry } from './Message';

/**
 * Where a session title came from.
 * - `user_message`: the first request the user typed
 * - `agent_task`: a subagent's task name, from the inter-agent message that
 *   assigned the task (the task text itself is stored encrypted)
 */
export type SessionTitleSource = 'user_message' | 'agent_task';

/**
 * Lightweight description of one session file.
 */
export interface AgentSessionSummary {
  /** Stable id: the session file path relative to the provider's sessions root */
  id: string;
  provider: AgentProvider;
  /** Provider session/thread id */
  threadId?: string;
  /** Absolute path of the session file */
  filePath: string;
  /** Working directory the session was started in */
  cwd?: string;
  /** Grouping key derived from `cwd` */
  projectKey: string;
  /** Display name derived from `cwd` */
  projectName: string;
  /** First user request (or a subagent's task name, see `titleSource`), for previews */
  title?: string;
  /** Where `title` came from */
  titleSource?: SessionTitleSource;
  /** ISO timestamp when the session started */
  startedAt?: string;
  /** Last write to the session file (Unix ms) */
  updatedAt: number;
  sizeBytes: number;
  /** Whether the file is stored compressed */
  compressed: boolean;
  /** Whether the file was written to recently */
  isLive: boolean;
  /** Whether the last recorded turn has started but not finished (only computed for live sessions) */
  turnInProgress?: boolean;
  /** Client that created the session (e.g. `codex_cli_rs`, `codex_vscode`) */
  originator?: string;
  cliVersion?: string;
  /** Session source (e.g. `cli`, `vscode`, `exec`, `subagent`) */
  source?: string;
  model?: string;
  modelProvider?: string;
  gitBranch?: string;
  gitCommit?: string;
  repositoryUrl?: string;
  /** Parent session for sub-agents and forks */
  parentThreadId?: string;
  agentNickname?: string;
  agentRole?: string;
  /**
   * Number of records copied from the parent thread when this subagent was
   * spawned (they precede the subagent's own history in the file). Undefined
   * when not known, e.g. when a listing's head read ended inside that history.
   */
  inheritedRecordCount?: number;
  /** Why metadata could not be read, if it could not */
  error?: string;
}

/**
 * Sessions sharing a working directory.
 */
export interface AgentProjectGroup {
  key: string;
  name: string;
  cwd?: string;
  sessionIds: string[];
  /** Most recent activity across the group's sessions (Unix ms) */
  lastActivity: number;
}

export interface AgentSessionList {
  provider: AgentProvider;
  /** Directory that was scanned */
  rootDir: string;
  rootExists: boolean;
  /** Sessions, most recently active first (capped at `limit`) */
  sessions: AgentSessionSummary[];
  projects: AgentProjectGroup[];
  /** Total session files found, including ones beyond the listing cap */
  totalFiles: number;
  /** The most recently written session, if it was written recently */
  liveSessionId: string | null;
  /** The most recently written session */
  latestSessionId: string | null;
  /** Whether compressed (`.zst`) session files can be read by this runtime */
  compressedSupported: boolean;
  scannedAt: number;
}

export interface AgentTokenUsageTotals {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
}

export interface AgentTokenUsage {
  total: AgentTokenUsageTotals;
  lastTurn?: AgentTokenUsageTotals;
  contextWindow?: number;
}

export interface AgentSessionDetail {
  session: AgentSessionSummary;
  timeline: TimelineEntry[];
  stats: ExecutionStats;
  tokenUsage?: AgentTokenUsage;
  /** Non-fatal problems encountered while reading the file */
  warnings: string[];
  /** Opaque file-state fingerprint for no-op refresh short-circuiting */
  fingerprint: string;
}

/** Returned instead of a detail when the caller's fingerprint is current. */
export interface AgentSessionDetailUnchanged {
  unchanged: true;
  fingerprint: string;
}

export type AgentSessionDetailResponse = AgentSessionDetail | AgentSessionDetailUnchanged;

export interface AgentSessionChangeEvent {
  provider: AgentProvider;
  type: 'add' | 'change' | 'unlink';
  sessionId: string;
}
