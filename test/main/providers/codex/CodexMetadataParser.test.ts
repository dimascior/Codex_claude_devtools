import { describe, expect, it } from 'vitest';

import {
  InheritedHistoryTracker,
  SubagentTaskNameFinder,
  uuidV7Millis,
} from '../../../../src/main/providers/codex/CodexMetadataParser';

import type { CodexRolloutRecord } from '../../../../src/main/providers/codex/types';

type RecordShape = Pick<CodexRolloutRecord, 'type' | 'payload'>;

/** Thread id of tests/fixtures/codex/real-observed/subagent-declared-boundary.jsonl */
const THREAD = '01a08b56-a905-7712-bb7e-f2747c374a39';
/** The subagent's own first turn in that rollout (minted after the thread) */
const OWN_TURN = '01a08b56-ab0c-7452-b51f-92bd03fd6569';

describe('uuidV7Millis', () => {
  it('reads the millisecond timestamp of a canonical UUIDv7', () => {
    expect(uuidV7Millis(THREAD)).toBe(0x01a08b56a905);
    expect(uuidV7Millis(THREAD.toUpperCase())).toBe(0x01a08b56a905);
  });

  it('refuses other versions, other variants and malformed ids', () => {
    for (const id of [
      undefined,
      '',
      '0199a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b', // version 4
      '01a08b56-a905-7712-7b7e-f2747c374a39', // variant 0xxx
      '01a08b56-a905-7712-bb7e', // truncated
      `${THREAD}-extra`,
      `exec-${THREAD}`,
      THREAD.replace(/-/g, ''),
      '01a08b57-0000-7000-zzzz-000000000000',
    ]) {
      expect(uuidV7Millis(id)).toBeUndefined();
    }
  });
});

describe('InheritedHistoryTracker', () => {
  const metadata = { historyStartOrdinal: 10, threadId: THREAD };
  const taskStarted = (ordinal: number, turnId: string) => ({
    ordinal,
    type: 'event_msg',
    payload: { type: 'task_started', turn_id: turnId },
  });

  it('does not let a malformed turn id end the inherited prefix', () => {
    const tracker = new InheritedHistoryTracker();
    // A v7-looking prefix alone used to be read as a timestamp after the thread's.
    expect(tracker.isInherited(taskStarted(1, '01a08b57-0000-7000-zzzz'), metadata)).toBe(true);
    expect(tracker.isInherited(taskStarted(2, OWN_TURN), metadata)).toBe(false);
    // Once the own history has started, nothing below the boundary is inherited again.
    expect(tracker.isInherited({ ordinal: 3, type: 'response_item', payload: {} }, metadata)).toBe(
      false
    );
  });

  it('falls back to the declared boundary when the thread id is not a UUIDv7', () => {
    const tracker = new InheritedHistoryTracker();
    const legacy = { historyStartOrdinal: 3, threadId: '0199a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b' };
    expect(tracker.isInherited(taskStarted(1, OWN_TURN), legacy)).toBe(true);
    expect(tracker.isInherited(taskStarted(3, OWN_TURN), legacy)).toBe(false);
  });
});

describe('SubagentTaskNameFinder', () => {
  const subagent = { source: 'subagent:thread_spawn' };
  const trigger = (triggerTurn: boolean): RecordShape => ({
    type: 'inter_agent_communication_metadata',
    payload: { trigger_turn: triggerTurn },
  });
  const message = (recipient: unknown): RecordShape => ({
    type: 'response_item',
    payload: { type: 'agent_message', author: '/root', recipient },
  });

  function taskName(records: RecordShape[], metadata = subagent): string | undefined {
    const finder = new SubagentTaskNameFinder();
    for (const record of records) finder.accept(record, metadata);
    return finder.taskName;
  }

  it('takes the last segment of the recipient of the message that started a turn', () => {
    expect(taskName([trigger(true), message('/root/review_changes')])).toBe('review_changes');
    expect(taskName([trigger(true), message('/root/lead/review_step')])).toBe('review_step');
  });

  it('keeps the first task name', () => {
    expect(
      taskName([trigger(true), message('/root/first'), trigger(true), message('/root/second')])
    ).toBe('first');
  });

  it('ignores messages that did not start a turn or were not persisted right after it', () => {
    expect(taskName([message('/root/task')])).toBeUndefined();
    expect(taskName([trigger(false), message('/root/task')])).toBeUndefined();
    expect(
      taskName([trigger(true), { type: 'event_msg', payload: {} }, message('/root/task')])
    ).toBeUndefined();
  });

  it('ignores root recipients, malformed paths and sessions that are not subagents', () => {
    expect(taskName([trigger(true), message('/root')])).toBeUndefined();
    expect(taskName([trigger(true), message('root/task')])).toBeUndefined();
    expect(taskName([trigger(true), message(42)])).toBeUndefined();
    expect(taskName([trigger(true), message('/root/task')], { source: 'vscode' })).toBeUndefined();
  });
});
