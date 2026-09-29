/**
 * Wording for session relations: a spawn execution and the subagent session
 * it started. Names, status lines and the evidence rows of the relation
 * details, built from `AgentSessionRelation` only; relations are resolved in
 * the main process (`CodexSessionRelations`), never here.
 */

import type { AgentSessionRelation, AgentSessionRelationStatus } from '@shared/types';

export interface RelationRow {
  label: string;
  value: string;
  /** Ids and record types are shown in monospace */
  mono?: boolean;
  /** An id worth copying (to search the rollout for it) */
  copyable?: boolean;
  /** Short explanation shown after the value */
  note?: string;
}

/** What the only link method means (tooltip of the method tag). */
export const RELATION_METHOD_EXPLANATION =
  'The spawn_agent call and a SubAgentActivity "started" record carry the same provider id, and that record names the child thread: the child rollout\'s session_meta.id. Timing, agent names or paths, working directories, session_id and declared parent ids alone are never used.';

const STATUS_LABELS: Record<AgentSessionRelationStatus, string> = {
  resolved: 'Resolved to one rollout',
  missing_session: 'No rollout of the thread is present',
  ambiguous: 'Ambiguous: several candidates, none chosen',
  unresolved: 'Unresolved',
};

/** One line for a relation, e.g. "Child session not available yet". */
export function relationStatusLabel(relation: AgentSessionRelation): string {
  const child = relation.kind === 'spawned_child';
  switch (relation.status) {
    case 'resolved':
      return child ? 'Child session' : 'Parent session';
    case 'missing_session':
      return child ? 'Child session not available yet' : 'Parent session not available';
    case 'ambiguous':
      return child ? 'Child relation ambiguous' : 'Parent relation ambiguous';
    case 'unresolved':
      return child ? 'Child relation unresolved' : 'Parent relation unresolved';
  }
}

/**
 * How the related session names itself: its agent nickname, then its title (a
 * subagent's task name or a first request), else a neutral fallback. Task
 * text is stored encrypted and is never shown.
 */
export function relatedSessionName(relation: AgentSessionRelation): {
  name: string;
  detail?: string;
} {
  const fallback = relation.kind === 'spawned_child' ? 'Child session' : 'Parent session';
  const related = relation.related;
  if (!related) {
    return { name: fallback };
  }
  let title = related.title;
  if (title && related.titleSource === 'agent_task') {
    title = `task ${title}`;
  }
  if (related.agentNickname) {
    return { name: related.agentNickname, detail: title };
  }
  return { name: title ?? fallback };
}

/** The records a relation rests on, for the relation details. */
export function relationDetailRows(relation: AgentSessionRelation): RelationRow[] {
  const { evidence } = relation;
  const child = relation.kind === 'spawned_child';
  const where = child ? 'this rollout' : 'parent rollout';
  const rows: RelationRow[] = [
    { label: 'Relationship', value: child ? 'Spawned child' : 'Spawned by' },
    { label: 'Status', value: STATUS_LABELS[relation.status], note: relation.reason },
    { label: 'Link method', value: 'Explicit provider ID chain' },
  ];
  if (evidence.callId) {
    rows.push({
      label: 'Spawn call',
      value: evidence.callId,
      mono: true,
      copyable: true,
      note: describeRecord(evidence.callRecordType, evidence.callLineNumber, where),
    });
  }
  if (evidence.activityLineNumber !== undefined) {
    rows.push({
      label: 'Started record',
      value: 'same provider id',
      note: describeRecord(evidence.activityRecordType, evidence.activityLineNumber, where),
    });
  }
  if (evidence.childThreadId) {
    rows.push({
      label: 'Child thread',
      value: evidence.childThreadId,
      mono: true,
      copyable: true,
      note: child ? "the child rollout's session_meta.id" : "this rollout's session_meta.id",
    });
  }
  if (evidence.parentThreadId) {
    rows.push({
      label: 'Parent thread',
      value: evidence.parentThreadId,
      mono: true,
      note: child ? "this rollout's session_meta.id" : undefined,
    });
  }
  if (evidence.declaredParentThreadId) {
    rows.push({
      label: child ? 'Child declares parent' : 'Declared parent',
      value: evidence.declaredParentThreadId,
      mono: true,
      note: declaredParentNote(relation),
    });
  }
  if (relation.relatedSessionId) {
    rows.push({
      label: child ? 'Child rollout' : 'Parent rollout',
      value: relation.relatedSessionId,
      mono: true,
      copyable: true,
    });
  }
  if (relation.candidateSessionIds && relation.candidateSessionIds.length > 0) {
    rows.push({
      label: 'Candidate rollouts',
      value: relation.candidateSessionIds.join('\n'),
      mono: true,
      note: 'none is chosen',
    });
  }
  if (relation.candidateThreadIds && relation.candidateThreadIds.length > 0) {
    rows.push({
      label: 'Named threads',
      value: relation.candidateThreadIds.join('\n'),
      mono: true,
      note: 'none is chosen',
    });
  }
  return rows;
}

function describeRecord(
  recordType: string | undefined,
  lineNumber: number | undefined,
  where: string
): string | undefined {
  const line = lineNumber === undefined ? undefined : `${where}, line ${lineNumber}`;
  return [recordType, line].filter(Boolean).join(' · ') || undefined;
}

function declaredParentNote(relation: AgentSessionRelation): string {
  const { declaredParentThreadId, parentThreadId } = relation.evidence;
  if (relation.kind === 'spawned_by') {
    return 'narrows which rollouts are searched; not evidence on its own';
  }
  if (parentThreadId === undefined) {
    return "from the child's session_meta";
  }
  return declaredParentThreadId === parentThreadId
    ? "agrees with this rollout's thread"
    : "differs from this rollout's thread";
}
