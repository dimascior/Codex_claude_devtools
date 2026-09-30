/**
 * Provider-neutral relations between agent sessions: a parent session's spawn
 * execution and the subagent session it started.
 *
 * Sessions stay independent. A relation points from one session file to
 * another and never merges their timelines. Session ids name files (the
 * viewer's ids); thread ids name provider threads, and one thread can span
 * several files, so a relation is `resolved` only when its records identify
 * exactly one file.
 */

import type { SessionTitleSource } from './Session';

/**
 * Direction of a relation, seen from the session it belongs to.
 * - `spawned_child`: an execution of this session started the related session
 * - `spawned_by`: an execution of the related session started this session
 */
export type AgentSessionRelationKind = 'spawned_child' | 'spawned_by';

/**
 * - `resolved`: the records identify exactly one related session file
 * - `missing_session`: the records name a thread, but no session file of that
 *   thread is present (not written yet, deleted, or stored elsewhere)
 * - `ambiguous`: several session files or threads match; none is chosen
 * - `unresolved`: the records that would prove the relation are missing or
 *   could not be read
 */
export type AgentSessionRelationStatus =
  | 'resolved'
  | 'missing_session'
  | 'ambiguous'
  | 'unresolved';

/**
 * How a relation is established. `explicit_id_chain`: the spawn call and a
 * provider record of the started thread carry the same id, and that record
 * names the thread that is the related file's own thread id. It is the only
 * method: timing, agent names or paths, working directories and declared
 * parent ids never relate two sessions on their own.
 */
export type AgentSessionRelationMethod = 'explicit_id_chain';

/**
 * The provider records a relation rests on. Record lines are 1-based lines of
 * the parent session file, which holds both the spawn call and the record of
 * the started thread.
 */
export interface AgentSessionRelationEvidence {
  method: AgentSessionRelationMethod;
  /** Provider call id of the spawn call */
  callId?: string;
  /** Provider record type of the spawn call */
  callRecordType?: string;
  callLineNumber?: number;
  /** Provider record that carries the call id and names the started thread */
  activityRecordType?: string;
  activityLineNumber?: number;
  /** Thread the activity record names: the child file's own thread id */
  childThreadId?: string;
  /** The parent file's own thread id */
  parentThreadId?: string;
  /**
   * Parent thread the child declares in its own metadata. Used only to narrow
   * which files may hold the spawn; never evidence of the relation itself.
   */
  declaredParentThreadId?: string;
}

/** How the related session describes itself, from its own metadata. */
export interface AgentSessionRelationTarget {
  title?: string;
  titleSource?: SessionTitleSource;
  agentNickname?: string;
  agentRole?: string;
}

export interface AgentSessionRelation {
  kind: AgentSessionRelationKind;
  status: AgentSessionRelationStatus;
  /** Why the relation is not resolved (safe structural description) */
  reason?: string;
  /** The spawn execution in the parent session (its execution id, the spawn call id) */
  executionId?: string;
  /** Viewer id of the related session file (resolved only) */
  relatedSessionId?: string;
  /** Provider thread id of the related session, when the records name exactly one */
  relatedThreadId?: string;
  /** The related session's own title and agent names (resolved only) */
  related?: AgentSessionRelationTarget;
  /** Session files that match equally (ambiguous only); none is chosen */
  candidateSessionIds?: string[];
  /** Threads named by conflicting records (ambiguous only) */
  candidateThreadIds?: string[];
  evidence: AgentSessionRelationEvidence;
}

/** Relations of one session file to the sessions it spawned and was spawned by. */
export interface AgentSessionRelations {
  /** Viewer id of the session the relations belong to */
  sessionId: string;
  /** Its own provider thread id */
  threadId?: string;
  /** How this session was started; present when it declares a parent thread */
  parent?: AgentSessionRelation;
  /** One relation per spawn call in this session's own history, in record order */
  children: AgentSessionRelation[];
}
