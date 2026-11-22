/**
 * Provider-neutral session timeline.
 *
 * A timeline is the chronological sequence of what happened in a session:
 * user requests, agent messages, reasoning, executions, and turn-level events.
 */

import type { Execution } from './Execution';
import type { RuntimeSettingsChange, SettingsChangeSource } from './RuntimeState';

interface TimelineEntryBase {
  /** Stable id, unique within the session */
  id: string;
  /** ISO timestamp of the record, when the provider recorded one */
  timestamp?: string;
  /** 1-based line of the source record in the session file */
  lineNumber: number;
  /** Provider turn id, when known */
  turnId?: string;
}

export interface UserMessageEntry extends TimelineEntryBase {
  kind: 'user_message';
  text: string;
  imageCount?: number;
}

export interface AgentMessageEntry extends TimelineEntryBase {
  kind: 'agent_message';
  text: string;
  /** Mid-turn narration vs. the turn's final answer, when the provider records it */
  phase?: 'commentary' | 'final_answer';
  /** Sender for inter-agent messages */
  author?: string;
  /** Recipient for inter-agent messages */
  recipient?: string;
  /**
   * Whether part of the message was stored encrypted (inter-agent task payloads);
   * `text` holds only the readable part, and the encrypted part is never decoded
   */
  encrypted?: boolean;
}

/**
 * Model reasoning. Providers may persist only a readable summary and keep the
 * underlying reasoning encrypted; the encrypted part is surfaced as
 * unavailable and never decoded.
 */
export interface ReasoningEntry extends TimelineEntryBase {
  kind: 'reasoning';
  /** Readable summary sections (may be empty) */
  summary: string[];
  /** Raw reasoning text, only when the provider persisted it in the clear */
  content?: string[];
  /** Whether encrypted reasoning content was present */
  encrypted: boolean;
}

export interface ExecutionEntry extends TimelineEntryBase {
  kind: 'execution';
  execution: Execution;
}

/**
 * Turn-level events worth showing inline (interruptions and failed turns).
 */
export interface TurnEventEntry extends TimelineEntryBase {
  kind: 'turn_event';
  event: 'aborted' | 'failed';
  /** Abort reason or error message */
  reason?: string;
  durationMs?: number;
}

export interface CompactionEntry extends TimelineEntryBase {
  kind: 'compaction';
  /** Readable compaction summary, when persisted */
  summary?: string;
  /** Whether the compacted history was stored encrypted */
  encrypted: boolean;
}

/**
 * Records a subagent inherited from its parent thread when it was spawned.
 * They are the parent's history, not the subagent's own activity, so they are
 * summarized by this one entry instead of being rendered.
 */
export interface InheritedContextEntry extends TimelineEntryBase {
  kind: 'inherited_context';
  /** Number of inherited records */
  recordCount: number;
  /** Thread the history was copied from */
  parentThreadId?: string;
  /** 1-based line of the last inherited record */
  lastLineNumber: number;
}

/**
 * Runtime settings that changed. `lineNumber` is the source record: the thread
 * settings record for a recorded transition, the later turn's turn context for
 * an observed one. Only settings whose value changed are listed.
 *
 * - `thread_settings_applied` (recorded by the provider): takes effect from the
 *   first turn when recorded before any turn state (`first_turn`), otherwise
 *   from the next turn state (`next_turn`); the turn already running keeps its
 *   settings. `turnId` is set when the record came inside a turn.
 * - `turn_context_diff` (derived by the viewer): the effective settings of turn
 *   `turnId` differ from the previous turn's (`this_turn`). No provider event
 *   records the change.
 */
export interface SettingsChangeEntry extends TimelineEntryBase {
  kind: 'settings_change';
  source: SettingsChangeSource;
  appliesTo: 'first_turn' | 'next_turn' | 'this_turn';
  changes: RuntimeSettingsChange[];
  /** `turn_context_diff` only: line of the previous turn's turn context it was compared with */
  previousLineNumber?: number;
}

export type TimelineEntry =
  | UserMessageEntry
  | AgentMessageEntry
  | ReasoningEntry
  | ExecutionEntry
  | TurnEventEntry
  | CompactionEntry
  | InheritedContextEntry
  | SettingsChangeEntry;
