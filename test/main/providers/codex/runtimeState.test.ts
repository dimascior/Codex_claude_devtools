/**
 * Runtime state of Codex rollouts: the effective settings of each turn (its
 * first `turn_context`), the thread settings Codex recorded
 * (`thread_settings_applied`) and the settings-change timeline entries built
 * from them, on synthetic rollouts and on sanitized real records.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

import {
  type NormalizedCodexSession,
  normalizeCodexRollout,
} from '../../../../src/main/providers/codex/CodexExecutionNormalizer';
import { parseRolloutLine } from '../../../../src/main/providers/codex/CodexRolloutParser';

import type { CodexRolloutRecord } from '../../../../src/main/providers/codex/types';
import type { Execution, SettingsChangeEntry } from '@shared/types';

const REAL_OBSERVED = path.resolve(__dirname, '../../../../tests/fixtures/codex/real-observed');
const THREAD = '019ef000-0000-7000-8000-000000000001';

/** A turn context as current Codex versions write it. */
const TURN: Record<string, unknown> = {
  cwd: 'C:\\Work\\App',
  workspace_roots: ['C:\\Work\\App', 'C:\\Work\\Lib'],
  approval_policy: 'on-request',
  approvals_reviewer: 'user',
  sandbox_policy: { type: 'workspace-write', network_access: false },
  file_system_sandbox_policy: { kind: 'restricted', entries: [] },
  permission_profile: { type: 'managed' },
  active_permission_profile: { id: ':workspace' },
  model: 'm-a',
  personality: 'pragmatic',
  collaboration_mode: { mode: 'default', settings: { model: 'm-a', reasoning_effort: 'high' } },
  realtime_active: false,
  effort: 'high',
  summary: 'auto',
};

/** Thread settings as `thread_settings_applied` records them. */
const THREAD_SETTINGS: Record<string, unknown> = {
  model: 'm-a',
  service_tier: 'priority',
  approval_policy: 'on-request',
  approvals_reviewer: 'user',
  permission_profile: { type: 'managed' },
  active_permission_profile: { id: ':workspace' },
  cwd: 'C:\\Work\\App',
  reasoning_effort: 'high',
  reasoning_summary: 'detailed',
  personality: 'pragmatic',
  collaboration_mode: { mode: 'default' },
};

class Rollout {
  readonly records: CodexRolloutRecord[] = [];

  constructor() {
    this.add('session_meta', { id: THREAD, cwd: 'C:\\Work\\App', cli_version: '0.158.0' });
  }

  /** Appends a record; returns its line number. */
  add(type: string, payload: Record<string, unknown>): number {
    const lineNumber = this.records.length + 1;
    this.records.push({
      lineNumber,
      ordinal: lineNumber - 1,
      timestamp: new Date(Date.UTC(2026, 8, 28, 9, 0, lineNumber)).toISOString(),
      type,
      payload,
    });
    return lineNumber;
  }

  settings(changes: Record<string, unknown> = {}, threadId: string = THREAD): number {
    return this.add('event_msg', {
      type: 'thread_settings_applied',
      thread_id: threadId,
      thread_settings: { ...THREAD_SETTINGS, ...changes },
    });
  }

  start(turnId: string): number {
    return this.add('event_msg', { type: 'task_started', turn_id: turnId });
  }

  context(turnId: string | undefined, changes: Record<string, unknown> = {}): number {
    return this.add('turn_context', {
      ...(turnId !== undefined ? { turn_id: turnId } : {}),
      ...TURN,
      ...changes,
    });
  }

  call(callId: string): number {
    const line = this.add('response_item', {
      type: 'function_call',
      name: 'exec_command',
      call_id: callId,
      arguments: JSON.stringify({ cmd: 'git status' }),
    });
    this.add('response_item', {
      type: 'function_call_output',
      call_id: callId,
      output: 'Process exited with code 0\nOutput:\nclean',
    });
    return line;
  }

  compact(): number {
    return this.add('compacted', { message: '' });
  }

  complete(turnId: string): number {
    return this.add('event_msg', { type: 'task_complete', turn_id: turnId });
  }

  /** A whole turn with one command; returns the turn context's line. */
  turn(turnId: string, changes: Record<string, unknown> = {}): number {
    this.start(turnId);
    const line = this.context(turnId, changes);
    this.call(`call-${turnId}`);
    this.complete(turnId);
    return line;
  }

  normalize(): NormalizedCodexSession {
    return normalizeCodexRollout(this.records, { active: false });
  }
}

function changesOf(session: NormalizedCodexSession): SettingsChangeEntry[] {
  return session.timeline.filter(
    (entry): entry is SettingsChangeEntry => entry.kind === 'settings_change'
  );
}

function executionsOf(session: NormalizedCodexSession): Execution[] {
  return session.timeline.flatMap((entry) => (entry.kind === 'execution' ? [entry.execution] : []));
}

function loadRecords(file: string): CodexRolloutRecord[] {
  const records: CodexRolloutRecord[] = [];
  for (const raw of fs.readFileSync(path.join(REAL_OBSERVED, file), 'utf8').split('\n')) {
    if (!raw.trim()) continue;
    const entry = JSON.parse(raw) as Record<string, unknown>;
    if (typeof entry.type !== 'string' || typeof entry.line !== 'number') continue;
    const { line, bytes: _bytes, ...record } = entry;
    const parsed = parseRolloutLine(JSON.stringify(record), line as number);
    if (parsed) records.push(parsed);
  }
  return records;
}

describe('effective turn state', () => {
  it('takes the first turn_context of a turn as its effective state, with every known field', () => {
    const r = new Rollout();
    r.start('t1');
    const first = r.context('t1');
    r.call('c1');
    r.compact();
    r.context('t1');
    r.complete('t1');
    const session = r.normalize();

    expect(session.runtime.turns).toEqual([
      {
        turnId: 't1',
        lineNumber: first,
        timestamp: r.records[first - 1].timestamp,
        settings: {
          model: 'm-a',
          reasoningEffort: 'high',
          approvalPolicy: 'on-request',
          approvalsReviewer: 'user',
          sandboxPolicy: 'workspace-write',
          fileSystemSandboxPolicy: 'restricted',
          permissionProfile: 'managed',
          activePermissionProfile: ':workspace',
          collaborationMode: 'default',
          personality: 'pragmatic',
          turnSummary: 'auto',
          cwd: 'C:\\Work\\App',
          workspaceRootCount: 2,
          realtimeActive: false,
        },
      },
    ]);
    // Only a count of the roots is kept.
    expect(JSON.stringify(session.runtime)).not.toContain('C:\\\\Work\\\\Lib');
  });

  it('reads the older sandbox form ({ mode }) and keeps absent fields absent', () => {
    const r = new Rollout();
    r.start('t1');
    r.add('turn_context', {
      turn_id: 't1',
      model: 'm-a',
      effort: 'medium',
      approval_policy: 'never',
      sandbox_policy: { mode: 'danger-full-access' },
    });
    expect(r.normalize().runtime.turns[0].settings).toEqual({
      model: 'm-a',
      reasoningEffort: 'medium',
      approvalPolicy: 'never',
      sandboxPolicy: 'danger-full-access',
    });
  });

  it('adds no state and no change for an identical turn_context written again in the same turn', () => {
    const r = new Rollout();
    r.start('t1');
    r.context('t1');
    r.call('c1');
    r.compact();
    r.context('t1');
    // Legacy records name no turn: attributed to the open turn.
    r.compact();
    r.context(undefined);
    r.complete('t1');
    const session = r.normalize();
    expect(session.runtime.turns).toHaveLength(1);
    expect(changesOf(session)).toEqual([]);
    expect(session.warnings).toEqual([]);
  });

  it('keeps the first state and warns, without values, when a later same-turn turn_context differs', () => {
    const r = new Rollout();
    r.start('t1');
    const first = r.context('t1', { cwd: 'C:\\Private\\One' });
    r.compact();
    const later = r.context('t1', { cwd: 'D:\\Private\\Two', effort: 'low' });
    r.complete('t1');
    r.turn('t2', { cwd: 'C:\\Private\\One' });
    const session = r.normalize();

    expect(session.runtime.turns.map((turn) => turn.lineNumber)).toEqual([
      first,
      expect.any(Number),
    ]);
    expect(session.runtime.turns[0].settings).toMatchObject({
      reasoningEffort: 'high',
      cwd: 'C:\\Private\\One',
    });
    expect(session.warnings).toEqual([
      `turn_context at line ${later} differs from the first turn_context of its turn (line ${first}) in effort, cwd; the first is kept as the turn's effective settings`,
    ]);
    expect(session.warnings.join(' ')).not.toMatch(/Private|low|high/);
    // No transition is invented inside the turn, and the next turn is compared with the first state.
    expect(changesOf(session)).toEqual([]);
  });

  it('resolves an execution to its turn state through turnId, without copying the state', () => {
    const r = new Rollout();
    r.turn('t1', { effort: 'low' });
    r.turn('t2', { effort: 'xhigh' });
    const session = r.normalize();
    const byTurn = new Map(session.runtime.turns.map((turn) => [turn.turnId, turn]));
    const [first, second] = executionsOf(session);
    expect(byTurn.get(first.turnId)?.settings.reasoningEffort).toBe('low');
    expect(byTurn.get(second.turnId)?.settings.reasoningEffort).toBe('xhigh');
    expect(Object.keys(first)).not.toContain('settings');
    expect(JSON.stringify(first)).not.toContain('reasoningEffort');
  });

  it('reports the model of the latest effective turn state as the session model', () => {
    const r = new Rollout();
    r.turn('t1', { model: 'm-a' });
    r.start('t2');
    r.context('t2', { model: 'm-b' });
    // A differing re-emission does not replace the turn's state.
    r.context('t2', { model: 'm-c' });
    r.complete('t2');
    expect(r.normalize().model).toBe('m-b');
  });
});

describe('recorded thread settings (thread_settings_applied)', () => {
  it('shows a change recorded before the first turn as applying to the first turn', () => {
    const r = new Rollout();
    r.settings();
    const changed = r.settings({ model: 'm-b' });
    r.turn('t1', { model: 'm-b' });
    const session = r.normalize();

    expect(changesOf(session)).toEqual([
      {
        kind: 'settings_change',
        id: `s-${changed}`,
        timestamp: r.records[changed - 1].timestamp,
        lineNumber: changed,
        turnId: undefined,
        source: 'thread_settings_applied',
        appliesTo: 'first_turn',
        changes: [{ field: 'model', previous: 'm-a', next: 'm-b' }],
      },
    ]);
    expect(session.runtime.turns[0].settings.model).toBe('m-b');
    expect(session.runtime.recordedSettingsFrom).toBe(2);
  });

  it('shows the first record as the baseline: no entry', () => {
    const r = new Rollout();
    r.settings();
    r.turn('t1');
    const session = r.normalize();
    expect(changesOf(session)).toEqual([]);
    expect(session.runtime.thread).toMatchObject({ lineNumber: 2 });
  });

  it('applies a change recorded between turns from the next turn', () => {
    const r = new Rollout();
    r.settings();
    r.turn('t1', { effort: 'high' });
    const changed = r.settings({ reasoning_effort: 'xhigh' });
    const next = r.turn('t2', { effort: 'xhigh' });
    const session = r.normalize();

    expect(changesOf(session)).toEqual([
      expect.objectContaining({
        lineNumber: changed,
        turnId: undefined,
        source: 'thread_settings_applied',
        appliesTo: 'next_turn',
        changes: [{ field: 'reasoningEffort', previous: 'high', next: 'xhigh' }],
      }),
    ]);
    expect(session.runtime.turns.find((turn) => turn.lineNumber === next)?.settings).toMatchObject({
      reasoningEffort: 'xhigh',
    });
  });

  describe('a change recorded mid-turn', () => {
    const r = new Rollout();
    r.settings();
    r.start('t1');
    r.context('t1', { effort: 'high' });
    r.call('before');
    const changed = r.settings({ reasoning_effort: 'low' });
    r.call('after');
    r.complete('t1');
    r.turn('t2', { effort: 'low' });
    const session = r.normalize();
    const [t1, t2] = session.runtime.turns;

    it('does not change the running turn: its state and its later executions keep the old value', () => {
      expect(t1.settings.reasoningEffort).toBe('high');
      const after = executionsOf(session).find((exec) => exec.id === 'after');
      expect(after?.turnId).toBe('t1');
      expect(session.runtime.turns.find((turn) => turn.turnId === after?.turnId)).toBe(t1);
      expect(changesOf(session)).toEqual([
        expect.objectContaining({
          lineNumber: changed,
          turnId: 't1',
          source: 'thread_settings_applied',
          appliesTo: 'next_turn',
          changes: [{ field: 'reasoningEffort', previous: 'high', next: 'low' }],
        }),
      ]);
    });

    it('is carried by the next turn context, with no second (derived) entry', () => {
      expect(t2.settings.reasoningEffort).toBe('low');
      expect(changesOf(session).filter((entry) => entry.source === 'turn_context_diff')).toEqual(
        []
      );
    });
  });

  it('renders nothing for identical repeated records, keeping the latest as the thread state', () => {
    const r = new Rollout();
    r.settings();
    r.turn('t1');
    r.settings();
    r.start('t2');
    r.context('t2');
    r.settings();
    r.complete('t2');
    const last = r.settings();
    const session = r.normalize();
    expect(changesOf(session)).toEqual([]);
    expect(session.runtime.thread?.lineNumber).toBe(last);
  });

  it('lists only the changed settings: model, effort, approval, permission profile', () => {
    const r = new Rollout();
    r.settings();
    r.turn('t1');
    r.settings({
      model: 'm-b',
      reasoning_effort: 'xhigh',
      approval_policy: 'never',
      permission_profile: { type: 'disabled' },
      active_permission_profile: { id: ':danger-full-access' },
    });
    r.turn('t2', {
      model: 'm-b',
      effort: 'xhigh',
      approval_policy: 'never',
      permission_profile: { type: 'disabled' },
    });
    expect(changesOf(r.normalize())[0].changes).toEqual([
      { field: 'model', previous: 'm-a', next: 'm-b' },
      { field: 'reasoningEffort', previous: 'high', next: 'xhigh' },
      { field: 'approvalPolicy', previous: 'on-request', next: 'never' },
      { field: 'permissionProfile', previous: 'managed', next: 'disabled' },
      { field: 'activePermissionProfile', previous: ':workspace', next: ':danger-full-access' },
    ]);
  });

  it('ignores settings recorded for another thread', () => {
    const r = new Rollout();
    r.settings();
    r.settings({ model: 'm-z' }, '019ef000-0000-7000-8000-00000000ffff');
    r.turn('t1');
    const session = r.normalize();
    expect(changesOf(session)).toEqual([]);
    expect(session.runtime.thread?.settings.model).toBe('m-a');
  });

  it('keeps the service tier thread-level: never in a turn state', () => {
    const r = new Rollout();
    r.settings();
    r.turn('t1');
    const changed = r.settings({ service_tier: 'flex' });
    r.turn('t2');
    const session = r.normalize();
    expect(changesOf(session)).toEqual([
      expect.objectContaining({
        lineNumber: changed,
        changes: [{ field: 'serviceTier', previous: 'priority', next: 'flex' }],
      }),
    ]);
    expect(session.runtime.thread?.settings.serviceTier).toBe('flex');
    expect(session.runtime.turns.map((turn) => turn.settings.serviceTier)).toEqual([
      undefined,
      undefined,
    ]);
  });
});

describe('fields kept apart', () => {
  it('keeps turn_context.summary and reasoning_summary as different settings', () => {
    const r = new Rollout();
    r.settings({ reasoning_summary: 'detailed' });
    r.turn('t1', { summary: 'auto' });
    r.settings({ reasoning_summary: 'none' });
    r.turn('t2', { summary: 'auto' });
    const session = r.normalize();

    expect(session.runtime.turns.map((turn) => turn.settings.turnSummary)).toEqual([
      'auto',
      'auto',
    ]);
    expect(session.runtime.turns.map((turn) => turn.settings.reasoningSummary)).toEqual([
      undefined,
      undefined,
    ]);
    expect(session.runtime.thread?.settings).toMatchObject({ reasoningSummary: 'none' });
    expect(session.runtime.thread?.settings.turnSummary).toBeUndefined();
    expect(changesOf(session).map((entry) => entry.changes)).toEqual([
      [{ field: 'reasoningSummary', previous: 'detailed', next: 'none' }],
    ]);
  });

  it('reports a turn summary mode change as turnSummary, never as the reasoning summary setting', () => {
    const r = new Rollout();
    r.turn('t1', { summary: 'auto' });
    r.turn('t2', { summary: 'concise' });
    expect(changesOf(r.normalize()).map((entry) => entry.changes)).toEqual([
      [{ field: 'turnSummary', previous: 'auto', next: 'concise' }],
    ]);
  });

  it('ignores a case-only cwd difference on Windows paths and keeps the provider spelling', () => {
    const recorded = new Rollout();
    recorded.settings({ cwd: 'C:\\Work\\App' });
    recorded.turn('t1', { cwd: 'C:\\Work\\App' });
    recorded.settings({ cwd: 'c:\\work\\app\\' });
    recorded.turn('t2', { cwd: 'c:/work/app' });
    const withSettings = recorded.normalize();
    expect(changesOf(withSettings)).toEqual([]);
    expect(withSettings.runtime.thread?.settings.cwd).toBe('c:\\work\\app\\');

    const observed = new Rollout();
    observed.turn('t1', { cwd: 'C:\\Work\\App' });
    observed.turn('t2', { cwd: 'c:/work/app' });
    const withoutSettings = observed.normalize();
    expect(changesOf(withoutSettings)).toEqual([]);
    expect(withoutSettings.runtime.turns.map((turn) => turn.settings.cwd)).toEqual([
      'C:\\Work\\App',
      'c:/work/app',
    ]);
  });

  it('treats a case difference in a POSIX path as a change', () => {
    const r = new Rollout();
    r.turn('t1', { cwd: '/work/App' });
    r.turn('t2', { cwd: '/work/app' });
    expect(changesOf(r.normalize()).map((entry) => entry.changes)).toEqual([
      [{ field: 'cwd', previous: '/work/App', next: '/work/app' }],
    ]);
  });
});

describe('sessions without recorded thread settings', () => {
  const r = new Rollout();
  const first = r.turn('t1', { effort: 'high', approval_policy: 'never' });
  const second = r.turn('t2', { effort: 'xhigh', approval_policy: 'never' });
  r.turn('t3', { effort: 'xhigh', approval_policy: 'never' });
  const fourth = r.turn('t4', { effort: 'xhigh', approval_policy: 'on-request' });
  const session = r.normalize();

  it('derives changes by comparing consecutive effective turn states', () => {
    expect(changesOf(session)).toEqual([
      {
        kind: 'settings_change',
        id: `s-${second}`,
        timestamp: r.records[second - 1].timestamp,
        lineNumber: second,
        turnId: 't2',
        source: 'turn_context_diff',
        appliesTo: 'this_turn',
        changes: [{ field: 'reasoningEffort', previous: 'high', next: 'xhigh' }],
        previousLineNumber: first,
      },
      expect.objectContaining({
        lineNumber: fourth,
        turnId: 't4',
        changes: [{ field: 'approvalPolicy', previous: 'never', next: 'on-request' }],
      }),
    ]);
  });

  it('labels every derived change turn_context_diff, never as a recorded event', () => {
    expect(changesOf(session).map((entry) => [entry.source, entry.appliesTo])).toEqual([
      ['turn_context_diff', 'this_turn'],
      ['turn_context_diff', 'this_turn'],
    ]);
    expect(session.runtime.thread).toBeUndefined();
    expect(session.runtime.recordedSettingsFrom).toBeUndefined();
  });

  it('does not compare a setting only one of the two states records', () => {
    const partial = new Rollout();
    partial.turn('t1', { active_permission_profile: undefined });
    partial.turn('t2', { active_permission_profile: { id: ':read-only' } });
    expect(changesOf(partial.normalize())).toEqual([]);
  });
});

describe('sessions with no runtime records', () => {
  it('has an empty runtime state, no settings entries and no warnings', () => {
    const r = new Rollout();
    r.start('t1');
    r.add('event_msg', { type: 'user_message', message: 'hello' });
    r.call('c1');
    r.complete('t1');
    const session = r.normalize();
    expect(session.runtime).toEqual({
      turns: [],
      thread: undefined,
      recordedSettingsFrom: undefined,
    });
    expect(changesOf(session)).toEqual([]);
    expect(session.warnings).toEqual([]);
    expect(executionsOf(session)).toHaveLength(1);
  });
});

describe('real-observed: thread settings changes (sanitized rollout windows)', () => {
  const session = normalizeCodexRollout(loadRecords('thread-settings-changes.jsonl'), {
    active: false,
  });
  const turnAt = (line: number) => session.runtime.turns.find((turn) => turn.lineNumber === line);

  it('takes one effective state per turn; the post-compaction repeat (4111) is not a state', () => {
    expect(session.runtime.turns.map((turn) => [turn.lineNumber, turn.turnId?.slice(-6)])).toEqual([
      [975, 'ffcc7a'],
      [1007, '469a70'],
      [1034, '241d4a'],
      [3120, '648e90'],
      [3208, '460bcc'],
      [4100, '78fd29'],
    ]);
    expect(session.warnings).toEqual([]);
    expect(session.timeline.filter((entry) => entry.kind === 'compaction')).toHaveLength(2);
  });

  it('shows the changes at the first recorded thread settings as observed, later ones as recorded', () => {
    expect(
      changesOf(session).map((entry) => [
        entry.lineNumber,
        entry.source,
        entry.appliesTo,
        entry.turnId?.slice(-6),
        entry.changes.map((change) => `${change.field}: ${change.previous} → ${change.next}`),
      ])
    ).toEqual([
      [
        1007,
        'turn_context_diff',
        'this_turn',
        '469a70',
        [
          'approvalPolicy: never → on-request',
          'sandboxPolicy: danger-full-access → workspace-write',
          'permissionProfile: disabled → managed',
          'workspaceRootCount: 1 → 3',
        ],
      ],
      [
        1010,
        'thread_settings_applied',
        'next_turn',
        '469a70',
        ['model: <model-1> → <model-2>', 'reasoningEffort: xhigh → low'],
      ],
      [1011, 'thread_settings_applied', 'next_turn', '469a70', ['reasoningEffort: low → xhigh']],
      [3205, 'thread_settings_applied', 'next_turn', undefined, ['reasoningEffort: xhigh → ultra']],
    ]);
    // The first thread settings record (1000) is the baseline; 1026, 3118, 3206, 4098 repeat it.
    expect(session.runtime.recordedSettingsFrom).toBe(1000);
    expect(session.runtime.thread?.lineNumber).toBe(4098);
  });

  it('keeps the interrupted turn on its own settings through the mid-turn changes', () => {
    expect(turnAt(1007)?.settings).toMatchObject({ model: '<model-1>', reasoningEffort: 'xhigh' });
    const executions = executionsOf(session).filter((exec) => exec.lineNumber > 1011);
    expect(executions.filter((exec) => exec.lineNumber < 1025).map((exec) => exec.turnId)).toEqual([
      turnAt(1007)?.turnId,
      turnAt(1007)?.turnId,
    ]);
    // The next turn carries the recorded model; the effort change was reverted before it.
    expect(turnAt(1034)?.settings).toMatchObject({ model: '<model-2>', reasoningEffort: 'xhigh' });
    expect(turnAt(3208)?.settings.reasoningEffort).toBe('ultra');
  });

  it('keeps the turn summary mode and the thread-level settings apart', () => {
    expect(turnAt(1007)?.settings).toMatchObject({ turnSummary: '<string:4>' });
    for (const turn of session.runtime.turns) {
      expect(turn.settings.reasoningSummary).toBeUndefined();
      expect(turn.settings.serviceTier).toBeUndefined();
    }
    expect(session.runtime.thread?.settings).toMatchObject({
      reasoningSummary: 'detailed',
      serviceTier: '<string:7>',
      activePermissionProfile: ':workspace',
    });
  });
});
