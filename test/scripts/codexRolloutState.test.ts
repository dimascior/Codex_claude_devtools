/**
 * Runtime-state section of the rollout survey (scripts/codex-rollout-state.ts).
 *
 * Synthetic rollouts pin each measurement; the sanitized real-derived fixtures
 * (tests/fixtures/codex/real-observed) check it against real record shapes;
 * one end-to-end run goes through the whole survey.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

import { parseRolloutLine } from '../../src/main/providers/codex/CodexRolloutParser';
import { compareVersions, RolloutStateSurvey, safeValue } from '../../scripts/codex-rollout-state';
import { runSurvey } from '../../scripts/codex-rollout-survey';

import type { CodexRolloutRecord } from '../../src/main/providers/codex/types';

const REAL_OBSERVED = path.join(__dirname, '../../tests/fixtures/codex/real-observed');

const PARENT = '01a00000-0000-7000-8000-000000000001';
const CHILD = '01a00000-0000-7000-8000-000000000002';
const ORPHAN = '01a00000-0000-7000-8000-000000000003';
const UNKNOWN_PARENT = '01a00000-0000-7000-8000-00000000000f';
const T1 = '01a00000-0000-7000-8000-0000000000a1';
const T2 = '01a00000-0000-7000-8000-0000000000a2';
const T3 = '01a00000-0000-7000-8000-0000000000a3';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Builds records with increasing line numbers and timestamps. */
function rollout(): {
  add: (type: string, payload: Record<string, unknown>, second?: number) => void;
  records: CodexRolloutRecord[];
} {
  const records: CodexRolloutRecord[] = [];
  return {
    records,
    add: (type, payload, second) => {
      const line = records.length + 1;
      records.push({
        lineNumber: line,
        ordinal: line - 1,
        timestamp: new Date(Date.UTC(2026, 8, 1, 10, 0, second ?? line)).toISOString(),
        type,
        payload,
      });
    },
  };
}

function aliases(): (name: string) => string {
  const map = new Map<string, string>();
  return (name) => {
    let alias = map.get(name);
    if (alias === undefined) {
      alias = `<model-${map.size + 1}>`;
      map.set(name, alias);
    }
    return alias;
  };
}

function render(survey: RolloutStateSurvey): string {
  return survey.render({ modelAlias: aliases() }).join('\n');
}

/** Body rows of the Markdown table under the first heading starting with `heading`. */
function rowsOf(markdown: string, heading: string): string[][] {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`#### ${heading}`));
  if (start < 0) throw new Error(`no table "${heading}"`);
  const rows: string[][] = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith('|')) break;
    rows.push(line.slice(2, -2).split(' | '));
  }
  return rows.slice(2);
}

/** The row whose leading cells are `prefix`, or undefined. */
function rowOf(markdown: string, heading: string, ...prefix: string[]): string[] | undefined {
  return rowsOf(markdown, heading).find((row) => prefix.every((cell, i) => row[i] === cell));
}

function loadRecords(file: string): CodexRolloutRecord[] {
  const records: CodexRolloutRecord[] = [];
  for (const raw of fs.readFileSync(path.join(REAL_OBSERVED, file), 'utf8').split('\n')) {
    if (!raw.trim()) continue;
    const entry = JSON.parse(raw) as Record<string, unknown>;
    if (typeof entry.type !== 'string' || typeof entry.line !== 'number') continue;
    // Transcript lines carry the real line number and size next to the record.
    const record = Object.fromEntries(
      Object.entries(entry).filter(([key]) => key !== 'line' && key !== 'bytes')
    );
    const parsed = parseRolloutLine(JSON.stringify(record), entry.line);
    if (parsed) records.push(parsed);
  }
  return records;
}

// =============================================================================
// Synthetic rollouts
// =============================================================================

/** Settings that change within the rollout, around thread_settings_applied records. */
function settingsRollout(): CodexRolloutRecord[] {
  const r = rollout();
  const settings = (model: string, effort: string): Record<string, unknown> => ({
    model,
    reasoning_effort: effort,
    reasoning_summary: 'auto',
    approval_policy: 'on-request',
    cwd: '/work/app',
  });
  const turnContext = (turn: string, model: string, effort: string): Record<string, unknown> => ({
    turn_id: turn,
    model,
    effort,
    summary: 'auto',
    approval_policy: 'on-request',
    cwd: '/work/app',
    sandbox_policy: { type: 'workspace-write', network_access: false },
  });
  r.add('session_meta', {
    id: T1,
    cli_version: '0.150.0',
    originator: 'codex_cli_rs',
    source: 'cli',
  });
  r.add('event_msg', {
    type: 'thread_settings_applied',
    thread_id: T1,
    thread_settings: settings('m-a', 'xhigh'),
  });
  r.add('event_msg', { type: 'task_started', turn_id: 'turn-1' });
  r.add('turn_context', turnContext('turn-1', 'm-a', 'high'));
  r.add('response_item', {
    type: 'function_call',
    name: 'exec_command',
    call_id: 'c1',
    arguments: '{}',
  });
  r.add('event_msg', { type: 'task_complete', turn_id: 'turn-1' });
  r.add('event_msg', { type: 'task_started', turn_id: 'turn-2' });
  r.add('response_item', {
    type: 'function_call',
    name: 'exec_command',
    call_id: 'c2',
    arguments: '{}',
  });
  r.add('turn_context', turnContext('turn-2', 'm-a', 'xhigh'));
  r.add('event_msg', { type: 'task_complete', turn_id: 'turn-2' });
  r.add('event_msg', {
    type: 'thread_settings_applied',
    thread_id: T2,
    thread_settings: settings('m-z', 'low'),
  });
  r.add('event_msg', {
    type: 'thread_settings_applied',
    thread_id: T1,
    thread_settings: settings('m-b', 'xhigh'),
  });
  r.add('event_msg', {
    type: 'thread_settings_applied',
    thread_id: T1,
    thread_settings: settings('m-b', 'xhigh'),
  });
  r.add('event_msg', { type: 'task_started', turn_id: 'turn-3' });
  r.add('turn_context', turnContext('turn-3', 'm-b', 'xhigh'));
  r.add('turn_context', turnContext('turn-3', 'm-b', 'low'));
  r.add('event_msg', { type: 'task_complete', turn_id: 'turn-3' });
  return r.records;
}

function tokenRollout(): CodexRolloutRecord[] {
  const r = rollout();
  const counts = (input: number, output: number): Record<string, number> => ({
    input_tokens: input,
    output_tokens: output,
    total_tokens: input + output,
  });
  const token = (
    turn: string,
    response: string,
    usage: Record<string, number>,
    turnUsage: Record<string, number>,
    threadUsage: Record<string, number>
  ): Record<string, unknown> => ({
    thread_id: T2,
    turn_id: turn,
    response_id: response,
    usage,
    turn_token_usage: turnUsage,
    thread_token_usage: threadUsage,
  });
  r.add('session_meta', { id: T2, cli_version: '0.151.0' });
  r.add('event_msg', { type: 'task_started', turn_id: 'turn-a' });
  r.add(
    'token_usage_record',
    token('turn-a', 'r1', counts(100, 10), counts(100, 10), counts(100, 10))
  );
  r.add(
    'token_usage_record',
    token('turn-a', 'r2', counts(50, 5), counts(150, 15), counts(150, 15))
  );
  r.add('event_msg', { type: 'task_complete', turn_id: 'turn-a' });
  r.add('event_msg', { type: 'task_started', turn_id: 'turn-b' });
  const third = token('turn-b', 'r3', counts(30, 3), counts(30, 3), counts(180, 18));
  r.add('token_usage_record', third);
  r.add('compacted', { message: 'summary', latest_token_usage_record: third });
  r.add('token_usage_record', token('turn-b', 'r4', counts(20, 2), counts(50, 5), counts(200, 20)));
  r.add('token_usage_record', token('turn-b', 'r5', counts(1, 1), counts(999, 1), counts(10, 1)));
  r.add('event_msg', {
    type: 'token_count',
    info: {
      total_token_usage: counts(1, 1),
      last_token_usage: counts(1, 1),
      model_context_window: 1000,
    },
  });
  return r.records;
}

function lifecycleRollout(): CodexRolloutRecord[] {
  const r = rollout();
  r.add('session_meta', { id: T3, cli_version: '0.140.0' });
  r.add('event_msg', {
    type: 'task_started',
    turn_id: 'x1',
    started_at: 1,
    model_context_window: 1000,
    collaboration_mode_kind: 'default',
  });
  r.add('event_msg', {
    type: 'task_complete',
    turn_id: 'x1',
    duration_ms: 10,
    time_to_first_token_ms: 3,
    last_agent_message: 'canary last message',
    error: { message: 'canary error text', codex_error_info: 'context_window_exceeded' },
  });
  r.add('event_msg', { type: 'task_started', turn_id: 'x2' });
  r.add('event_msg', {
    type: 'turn_aborted',
    turn_id: 'x2',
    reason: 'interrupted',
    duration_ms: 4,
  });
  r.add('event_msg', { type: 'task_started', turn_id: 'x3' });
  r.add('event_msg', { type: 'task_complete' });
  return r.records;
}

/**
 * A parent that spawns a child, the child (with a copy of the parent's history
 * before its own), and a child whose parent is not among the rollouts.
 */
function subagentRollouts(): {
  parent: CodexRolloutRecord[];
  child: CodexRolloutRecord[];
  orphan: CodexRolloutRecord[];
} {
  const parent = rollout();
  parent.add(
    'session_meta',
    { id: PARENT, session_id: PARENT, cli_version: '0.153.0', source: 'vscode' },
    0
  );
  parent.add('event_msg', { type: 'task_started', turn_id: 'p-turn' }, 1);
  parent.add(
    'response_item',
    {
      type: 'function_call',
      namespace: 'collaboration',
      name: 'spawn_agent',
      call_id: 'call_spawn',
      arguments: '{"task":"canary task text"}',
    },
    10
  );
  parent.add(
    'response_item',
    { type: 'function_call_output', call_id: 'call_spawn', output: `{"agent_id":"${CHILD}"}` },
    11
  );
  parent.add(
    'event_msg',
    {
      type: 'item_completed',
      thread_id: PARENT,
      turn_id: 'p-turn',
      item: {
        type: 'SubAgentActivity',
        id: 'call_spawn',
        kind: 'started',
        agent_thread_id: CHILD,
        agent_path: '/root/canary-task',
      },
    },
    12
  );
  parent.add(
    'event_msg',
    {
      type: 'item_completed',
      thread_id: PARENT,
      turn_id: 'p-turn',
      item: {
        type: 'SubAgentActivity',
        id: `subagent-completed-${CHILD}`,
        kind: 'completed',
        agent_thread_id: CHILD,
        agent_path: '/root/canary-task',
      },
    },
    30
  );
  parent.add(
    'event_msg',
    {
      type: 'item_completed',
      thread_id: PARENT,
      turn_id: 'p-turn',
      item: {
        type: 'CollabAgentToolCall',
        id: 'collab-1',
        tool: 'send_message',
        status: 'completed',
        sender_thread_id: PARENT,
        receiver_thread_ids: [CHILD],
      },
    },
    31
  );

  const child = rollout();
  child.add(
    'session_meta',
    {
      id: CHILD,
      session_id: PARENT,
      parent_thread_id: PARENT,
      forked_from_id: PARENT,
      cli_version: '0.153.0',
      agent_path: '/root/canary-task',
      agent_nickname: 'CanaryNick',
      subagent_history_start_ordinal: 3,
      timestamp: new Date(Date.UTC(2026, 8, 1, 10, 0, 12)).toISOString(),
      source: {
        subagent: {
          thread_spawn: { parent_thread_id: PARENT, depth: 1, agent_path: '/root/canary-task' },
        },
      },
    },
    12
  );
  // The parent's history, copied into the child: not the child's own records.
  child.add(
    'event_msg',
    {
      type: 'item_completed',
      thread_id: PARENT,
      turn_id: 'p-turn',
      item: {
        type: 'SubAgentActivity',
        id: 'call_spawn',
        kind: 'started',
        agent_thread_id: CHILD,
        agent_path: '/root/canary-task',
      },
    },
    12
  );
  child.add('turn_context', { turn_id: 'p-turn', model: 'm-parent', effort: 'low' }, 12);
  child.add(
    'event_msg',
    {
      type: 'thread_settings_applied',
      thread_id: CHILD,
      thread_settings: { model: 'm-child', reasoning_effort: 'high' },
    },
    13
  );
  child.add('event_msg', { type: 'task_started', turn_id: 'c-turn' }, 13);
  child.add('turn_context', { turn_id: 'c-turn', model: 'm-child', effort: 'high' }, 13);

  const orphan = rollout();
  orphan.add(
    'session_meta',
    { id: ORPHAN, parent_thread_id: UNKNOWN_PARENT, cli_version: '0.153.0' },
    0
  );
  return { parent: parent.records, child: child.records, orphan: orphan.records };
}

// =============================================================================
// Tests
// =============================================================================

describe('compareVersions', () => {
  it('orders Codex versions numerically, pre-releases before releases, unknown last', () => {
    const versions = [
      '0.153.0',
      '(none)',
      '0.42.0',
      '0.153.0-alpha.10',
      '0.153.0-alpha.2',
      'custom',
      '0.9.1',
    ];
    expect([...versions].sort(compareVersions)).toEqual([
      '0.9.1',
      '0.42.0',
      '0.153.0-alpha.2',
      '0.153.0-alpha.10',
      '0.153.0',
      'custom',
      '(none)',
    ]);
  });
});

describe('safeValue', () => {
  it('shows enum values, booleans, counts and built-in profile ids, and nothing else', () => {
    expect(safeValue('approval_policy', 'on-request')).toBe('on-request');
    expect(safeValue('sandbox_policy.type', 'workspace-write')).toBe('workspace-write');
    expect(safeValue('sandbox_policy.network_access', false)).toBe('false');
    expect(safeValue('workspace_roots', ['/a', '/b'])).toBe('2 entries');
    expect(safeValue('active_permission_profile.id', ':workspace')).toBe(':workspace');
    expect(safeValue('active_permission_profile.id', 'my-profile')).toBe('(custom id)');
    expect(safeValue('personality', 'a sentence with spaces')).toBe('(text)');
    expect(safeValue('approvals_reviewer', '/root/reviewer')).toBe('(text)');
    expect(safeValue('source', { subagent: { thread_spawn: { depth: 1 } } })).toBe(
      '{subagent.thread_spawn}'
    );
    // Data under a single key is not a tagged enum.
    expect(safeValue('multi_agent_mode', { usage_hint_hash: 'abc' })).toBeUndefined();
    for (const [pathName, value] of [
      ['cwd', '/work/app'],
      ['timezone', 'Europe/Paris'],
      ['current_date', '2026-09-01'],
      ['turn_id', 'turn-1'],
      ['git.branch', 'main'],
      ['comp_hash', 'abc123'],
      ['subagent_history_start_ordinal', 12],
    ] as const) {
      expect(safeValue(pathName, value)).toBeUndefined();
    }
  });
});

describe('A/B: settings fields and their changes', () => {
  const survey = new RolloutStateSurvey();
  survey.addSession('s1.jsonl', settingsRollout());
  const report = render(survey);

  it('counts records, distinct values, repeats and changes per field', () => {
    // effort: high, xhigh, xhigh, low → one repeat, two changes.
    expect(rowOf(report, 'Fields of `turn_context`', '`effort`')).toEqual([
      '`effort`',
      'string',
      '4',
      '1',
      '0.150.0',
      '3',
      '1',
      '2',
      '1',
    ]);
    // Another thread's settings are left out: three own records (m-a, m-b, m-b).
    expect(rowOf(report, 'Fields of `event_msg` `thread_settings_applied`', '`model`')).toEqual([
      '`model`',
      'string',
      '3',
      '1',
      '0.150.0',
      '2',
      '1',
      '1',
      '1',
    ]);
    expect(
      rowOf(
        report,
        'Settings records not counted above',
        'thread_settings_applied for another thread (not counted)'
      )
    ).toEqual(['thread_settings_applied for another thread (not counted)', '1', '1']);
  });

  it('shows enum values and their changes, models by alias only', () => {
    expect(
      rowOf(report, 'Values of enum-like settings', 'turn_context', '`effort`', 'xhigh')?.[3]
    ).toBe('2');
    expect(
      rowOf(
        report,
        'Values of enum-like settings',
        'turn_context',
        '`sandbox_policy.type`',
        'workspace-write'
      )?.[3]
    ).toBe('4');
    expect(
      rowOf(
        report,
        'Value changes of enum-like settings',
        'turn_context',
        '`effort`',
        'high → xhigh'
      )?.[3]
    ).toBe('1');
    expect(
      rowOf(
        report,
        'Value changes of enum-like settings',
        'turn_context',
        '`effort`',
        'xhigh → low'
      )?.[3]
    ).toBe('1');
    const modelChange = rowOf(
      report,
      'Value changes of enum-like settings',
      'turn_context',
      '`model`'
    );
    expect(modelChange?.[2]).toMatch(/^<model-\d> → <model-\d>$/);
    expect(report).not.toContain('m-a');
  });

  it('reports each setting per CLI version', () => {
    expect(
      rowOf(report, 'Settings fields per CLI version', 'turn_context', '`effort`', '0.150.0')
    ).toEqual(['turn_context', '`effort`', '0.150.0', '4', '1', '3', '1', '2', '1']);
  });
});

describe('C: thread_settings_applied and turn_context', () => {
  const survey = new RolloutStateSurvey();
  survey.addSession('s1.jsonl', settingsRollout());
  const report = render(survey);
  const cell = (heading: string, ...prefix: string[]): string | undefined =>
    rowOf(report, heading, ...prefix)?.[prefix.length];

  it('records where thread_settings_applied appears and for which thread', () => {
    expect(
      cell('Where thread_settings_applied appears', 'before the first turn of the rollout')
    ).toBe('1');
    expect(cell('Where thread_settings_applied appears', 'between turns')).toBe('3');
    expect(cell('thread_settings_applied thread_id', "the rollout's own thread")).toBe('3');
    expect(cell('thread_settings_applied thread_id', 'another thread')).toBe('1');
    // Another thread's settings are not compared (nor counted as superseded).
    expect(rowsOf(report, 'thread_settings_applied not compared with a turn_context')).toEqual([
      [
        'followed by an identical thread_settings_applied before any turn_context',
        '1',
        '1',
        '0.150.0',
        '`s1.jsonl:13`',
      ],
    ]);
  });

  it('reports disagreements that persist until the next thread_settings_applied or the end', () => {
    const r = rollout();
    const turn = (id: string, effort: string): Record<string, unknown> => ({
      turn_id: id,
      effort,
    });
    const settings = (effort: string): Record<string, unknown> => ({
      type: 'thread_settings_applied',
      thread_id: T1,
      thread_settings: { reasoning_effort: effort },
    });
    r.add('session_meta', { id: T1, cli_version: '0.150.0' });
    r.add('event_msg', settings('high'));
    r.add('turn_context', turn('a', 'low'));
    r.add('turn_context', turn('b', 'low'));
    r.add('event_msg', settings('medium'));
    r.add('turn_context', turn('c', 'low'));
    const persisting = new RolloutStateSurvey();
    persisting.addSession('p.jsonl', r.records);
    expect(
      rowsOf(render(persisting), 'Disagreements with the next turn_context').map((cells) =>
        cells.slice(0, 3)
      )
    ).toEqual([
      [
        'reasoning_effort ↔ effort',
        'no later turn_context agreed before the next thread_settings_applied',
        '1',
      ],
      ['reasoning_effort ↔ effort', 'no later turn_context agreed before the rollout ended', '1'],
    ]);
  });

  it('compares each thread_settings_applied with the next turn_context, field pair by field pair', () => {
    const heading = 'Next turn_context after a thread_settings_applied, by field pair';
    expect(cell(heading, 'reasoning_effort ↔ effort', 'disagree')).toBe('1');
    expect(cell(heading, 'reasoning_effort ↔ effort', 'agree')).toBe('1');
    expect(cell(heading, 'model ↔ model', 'agree')).toBe('2');
    expect(cell(heading, 'sandbox_policy ↔ sandbox_policy', 'only in turn_context')).toBe('2');
    expect(
      cell(
        'Next turn_context after a thread_settings_applied, by CLI version',
        'at least one field disagrees',
        '0.150.0'
      )
    ).toBe('1');
    expect(
      cell(
        'Next turn_context after a thread_settings_applied, by CLI version',
        'every compared field agrees',
        '0.150.0'
      )
    ).toBe('1');
  });

  it('follows a disagreement until a later turn_context agrees', () => {
    expect(
      cell(
        'Disagreements with the next turn_context',
        'reasoning_effort ↔ effort',
        'a later turn_context agreed (1 turn_context later)'
      )
    ).toBe('1');
    expect(
      cell(
        'Later turn_context records under the same thread_settings_applied',
        'reasoning_effort ↔ effort',
        'disagree'
      )
    ).toBe('1');
  });

  it('separates turn_context changes announced by thread_settings_applied from the others', () => {
    const heading = 'turn_context value changes relative to the previous turn_context';
    expect(
      cell(heading, 'effort', 'no thread_settings_applied since the previous turn_context')
    ).toBe('2');
    expect(
      cell(heading, 'model', 'a thread_settings_applied came after the previous turn_context')
    ).toBe('1');
  });

  it('places turn_context within its turn', () => {
    expect(cell('turn_context turn_id', 'turn_id of the open turn')).toBe('4');
    expect(cell('turn_context position within its turn', "before its turn's first tool call")).toBe(
      '3'
    );
    expect(cell('turn_context position within its turn', 'after a tool call of its turn')).toBe(
      '1'
    );
    expect(cell('turn_context records per started turn', 'one turn_context')).toBe('2');
    expect(cell('turn_context records per started turn', 'two or more turn_contexts')).toBe('1');
  });

  it('never reports placeholder values from sanitized transcripts as agreement', () => {
    const r = rollout();
    r.add('session_meta', { id: T1, cli_version: '0.150.0' });
    r.add('event_msg', {
      type: 'thread_settings_applied',
      thread_id: T1,
      thread_settings: { reasoning_summary: 'none', cwd: '<string:9>' },
    });
    r.add('turn_context', { summary: '<string:4>', cwd: '<string:9>' });
    const sanitized = new RolloutStateSurvey();
    sanitized.addSession('s.jsonl', r.records);
    const text = render(sanitized);
    const heading = 'Next turn_context after a thread_settings_applied, by field pair';
    expect(rowOf(text, heading, 'reasoning_summary ↔ summary')?.[1]).toBe(
      'not comparable (sanitized placeholder)'
    );
    expect(rowOf(text, heading, 'cwd ↔ cwd')?.[1]).toBe('not comparable (sanitized placeholder)');
  });
});

describe('D: token usage records', () => {
  const survey = new RolloutStateSurvey();
  survey.addSession('t.jsonl', tokenRollout());
  const report = render(survey);
  const heading = 'Relations between usage objects';
  const cell = (relation: string, outcome: string): string | undefined =>
    rowOf(report, heading, relation, outcome)?.[2];

  it('checks how usage, turn and thread totals relate', () => {
    expect(cell('first record of the rollout: thread_token_usage = usage', 'holds')).toBe('1');
    expect(cell('first record of a turn: turn_token_usage = usage', 'holds')).toBe('2');
    expect(
      cell('later record of a turn: turn_token_usage = previous turn_token_usage + usage', 'holds')
    ).toBe('2');
    expect(
      cell('later record of a turn: turn_token_usage = previous turn_token_usage + usage', 'fails')
    ).toBe('1');
    expect(cell('thread_token_usage = previous thread_token_usage + usage', 'holds')).toBe('3');
    expect(cell('thread_token_usage = previous thread_token_usage + usage', 'fails')).toBe('1');
    expect(cell('thread_token_usage.total_tokens never decreases', 'fails')).toBe('1');
    expect(
      rowOf(
        report,
        heading,
        'thread_token_usage = previous thread_token_usage + usage',
        'fails'
      )?.[5]
    ).toBe('`t.jsonl:10`');
  });

  it('reports coverage and shapes', () => {
    expect(rowOf(report, 'token_usage_record by CLI version', '0.151.0')).toEqual([
      '0.151.0',
      '1',
      '5',
      '5 / 5 / 5',
    ]);
    expect(
      rowOf(report, 'Token sources per session', 'token_usage_record and token_count')?.[1]
    ).toBe('1');
    expect(
      rowOf(
        report,
        'Field shapes',
        'payload {response_id, thread_id, thread_token_usage, turn_id, turn_token_usage, usage}'
      )?.[1]
    ).toBe('5');
    expect(
      rowOf(report, 'Field presence in token_usage_record', 'context window field', 'absent')?.[2]
    ).toBe('5');
  });

  it('relates compacted.latest_token_usage_record to the records around it, without deriving sizes', () => {
    const compaction = 'compacted.latest_token_usage_record';
    expect(
      rowOf(report, compaction, 'preceding', 'identical to the preceding token_usage_record')?.[2]
    ).toBe('1');
    expect(
      rowOf(
        report,
        compaction,
        'next usage.input_tokens',
        "lower than latest_token_usage_record's"
      )?.[2]
    ).toBe('1');
    expect(
      rowOf(
        report,
        compaction,
        'next thread_token_usage',
        'latest_token_usage_record thread_token_usage + usage'
      )?.[2]
    ).toBe('1');
  });
});

describe('E: turn lifecycle', () => {
  const survey = new RolloutStateSurvey();
  survey.addSession('l.jsonl', lifecycleRollout());
  const report = render(survey);

  it('counts the fields each lifecycle event carries, by version', () => {
    const header = rowsOf(report, 'Lifecycle events').length;
    expect(header).toBe(3);
    const complete = rowOf(report, 'Lifecycle events', 'task_complete', '0.140.0');
    // Records, sessions, then turn_id, started_at, completed_at, duration_ms, ttft, error, reason, last_agent_message, …
    expect(complete?.slice(2, 12)).toEqual(['2', '1', '1', '0', '0', '1', '1', '1', '0', '1']);
  });

  it('shows enum values and error shapes, never messages', () => {
    const values = 'Lifecycle values';
    expect(rowOf(report, values, 'task_started', 'collaboration_mode_kind default')?.[2]).toBe('1');
    expect(rowOf(report, values, 'turn_aborted', 'reason interrupted')?.[2]).toBe('1');
    expect(
      rowOf(
        report,
        values,
        'task_complete',
        'error {codex_error_info, message} · codex_error_info context_window_exceeded'
      )?.[2]
    ).toBe('1');
    expect(report).not.toContain('canary');
  });

  it('pairs turns by turn_id', () => {
    expect(
      rowOf(report, 'Turn pairing by turn_id', 'started and ended (complete or aborted)')?.[1]
    ).toBe('2');
    expect(
      rowOf(report, 'Turn pairing by turn_id', 'last turn of the rollout, not ended')?.[1]
    ).toBe('1');
    expect(
      rowOf(report, 'Turn pairing by turn_id', 'task_complete without turn_id (not paired)')?.[1]
    ).toBe('1');
  });
});

describe('F: subagent relationships', () => {
  const { parent, child, orphan } = subagentRollouts();
  const survey = new RolloutStateSurvey();
  survey.addSession('parent.jsonl', parent);
  survey.addSession('child.jsonl', child);
  survey.addSession('orphan.jsonl', orphan);
  const report = render(survey);
  const method = (name: string): string[] | undefined => rowOf(report, 'Join methods', name);

  it('joins by every exact id the records share, and checks them against the declared parent', () => {
    // Records, matched, not surveyed, several, agrees, contradicts, status.
    expect(
      method('child session_meta.parent_thread_id → parent session_meta.id')?.slice(2)
    ).toEqual(['2', '1', '1', '0', '0', '0', 'joins']);
    expect(method('child session_meta.forked_from_id → parent session_meta.id')?.slice(2)).toEqual([
      '1',
      '1',
      '0',
      '0',
      '1',
      '0',
      'joins',
    ]);
    expect(
      method('child source.subagent.thread_spawn.parent_thread_id → parent session_meta.id')?.slice(
        2,
        7
      )
    ).toEqual(['1', '1', '0', '0', '1']);
    expect(
      method('child session_meta.session_id (≠ own id) → surveyed session_meta.id')?.slice(2, 7)
    ).toEqual(['1', '1', '0', '0', '1']);
    // Two SubAgentActivity items in the parent; the child's copy of them is not counted.
    expect(
      method('parent SubAgentActivity.agent_thread_id → child session_meta.id')?.slice(2, 7)
    ).toEqual(['2', '2', '0', '0', '2']);
    expect(
      method('parent collaboration call output contains → child session_meta.id')?.slice(2, 7)
    ).toEqual(['1', '1', '0', '0', '1']);
    expect(
      method('parent CollabAgentToolCall.receiver_thread_ids → child session_meta.id')?.slice(2, 7)
    ).toEqual(['1', '1', '0', '0', '1']);
    expect(
      method(
        'parent SubAgentActivity.agent_path = child session_meta.agent_path (among children declaring this parent)'
      )?.[1]
    ).toBe('deterministic structural relationship');
  });

  it('lists which methods reach each child’s declared parent', () => {
    expect(rowsOf(report, 'Children with a surveyed parent')).toEqual([
      [
        'CollabAgentToolCall + SubAgentActivity.agent_thread_id + collaboration call output + forked_from_id + parent_thread_id + thread_spawn.parent_thread_id',
        '1',
        '1',
        '0.153.0',
      ],
    ]);
  });

  it('describes SubAgentActivity ids by form, not by value', () => {
    const forms = 'SubAgentActivity kinds and id forms';
    expect(
      rowOf(report, forms, 'started', 'equals the call_id of collaboration.spawn_agent')?.[2]
    ).toBe('1');
    expect(rowOf(report, forms, 'completed', 'embeds its own agent_thread_id')?.[2]).toBe('1');
  });

  it('keeps time order apart from identity', () => {
    const temporal = 'Temporal association only';
    expect(rowOf(report, temporal, 'Children measured')?.[1]).toBe('1');
    expect(rowOf(report, temporal, 'Gap in seconds (min / median / max)')?.[1]).toBe(
      '2.0 / 2.0 / 2.0'
    );
  });

  it('leaves the copied parent history out of the child’s settings', () => {
    expect(rowOf(report, 'Records by CLI version', '0.153.0')).toEqual([
      '0.153.0',
      '3',
      '1',
      '1',
      '3',
      '0',
      '2',
    ]);
    expect(report).not.toContain('m-parent');
  });
});

describe('privacy', () => {
  it('never emits text, paths, ids, agent names or model names', () => {
    const r = rollout();
    r.add('session_meta', {
      id: T1,
      cli_version: '0.150.0',
      cwd: 'C:\\Users\\canary-user\\project',
      agent_nickname: 'CanaryNick',
      agent_path: '/root/canary-task',
      git: {
        branch: 'canary-branch',
        repository_url: 'https://example.com/canary/repo',
        commit_hash: 'deadbeefcanary',
      },
      instructions: 'canary instructions',
    });
    r.add('event_msg', {
      type: 'thread_settings_applied',
      thread_id: T1,
      thread_settings: {
        model: 'canary-model-x',
        personality: 'canary personality with spaces',
        service_tier: 'canary tier',
        approvals_reviewer: '/root/canary-reviewer',
        active_permission_profile: { id: 'canary-profile' },
        cwd: '/home/canary/work',
        collaboration_mode: {
          mode: 'default',
          settings: { developer_instructions: 'canary developer instructions' },
        },
      },
    });
    r.add('event_msg', { type: 'task_started', turn_id: 'canary-turn' });
    r.add('turn_context', {
      turn_id: 'canary-turn',
      model: 'canary-model-x',
      cwd: '/home/canary/work',
      workspace_roots: ['/home/canary/root'],
      timezone: 'Canary/Zone',
      current_date: '2099-12-31',
      comp_hash: 'canaryhash',
    });
    r.add('response_item', {
      type: 'function_call',
      name: 'exec_command',
      call_id: 'call_canary',
      arguments: '{"cmd":"canary-command"}',
    });
    r.add('response_item', {
      type: 'function_call_output',
      call_id: 'call_canary',
      output: 'canary-output',
    });
    r.add('world_state', {
      full: true,
      state: {
        model: 'canary-model-x',
        environments: { canary_env: { cwd: '/canary' } },
        agents_md: { 'C:/canary/AGENTS.md': {} },
      },
    });
    const survey = new RolloutStateSurvey();
    survey.addSession('p.jsonl', r.records);
    const text = render(survey);
    for (const secret of [
      'canary',
      'Canary',
      '2099',
      'example.com',
      'deadbeef',
      'AGENTS.md',
      '\u0000',
    ]) {
      expect(text).not.toContain(secret);
    }
    expect(text).not.toMatch(UUID);
    expect(text).toContain('(custom id)');
  });
});

describe('determinism', () => {
  it('renders the same section whatever order the rollouts are surveyed in', () => {
    const inputs: [string, CodexRolloutRecord[]][] = [
      ['s1.jsonl', settingsRollout()],
      ['t.jsonl', tokenRollout()],
      ['l.jsonl', lifecycleRollout()],
      ['parent.jsonl', subagentRollouts().parent],
      ['child.jsonl', subagentRollouts().child],
    ];
    const forward = new RolloutStateSurvey();
    for (const [file, records] of inputs) forward.addSession(file, records);
    const backward = new RolloutStateSurvey();
    for (const [file, records] of [...inputs].reverse()) backward.addSession(file, records);
    expect(render(backward)).toBe(render(forward));
  });
});

describe('real-observed fixtures', () => {
  const survey = new RolloutStateSurvey();
  for (const file of [
    'subagent-thread-spawn.jsonl',
    'subagent-declared-boundary.jsonl',
    'thread-settings-applied.jsonl',
    'current-code-mode-correlation-windows.jsonl',
  ]) {
    survey.addSession(file, loadRecords(file));
  }
  const report = render(survey);

  it('keeps only the rollouts’ own history', () => {
    // Session, turn_context, thread_settings_applied, session_meta, world_state, copied records.
    expect(rowOf(report, 'Records by CLI version', '0.153.0')).toEqual([
      '0.153.0',
      '1',
      '1',
      '1',
      '1',
      '1',
      '160',
    ]);
    expect(rowOf(report, 'Records by CLI version', '0.153.4')).toEqual([
      '0.153.4',
      '1',
      '1',
      '1',
      '1',
      '1',
      '15',
    ]);
    // The parent's SubAgentActivity items copied into the child are not the child's.
    expect(rowsOf(report, 'SubAgentActivity kinds and id forms')).toEqual([]);
  });

  it('finds thread_settings_applied ahead of the first own turn, agreeing with its turn_context', () => {
    const heading = 'Next turn_context after a thread_settings_applied, by field pair';
    expect(
      rowOf(
        report,
        'Where thread_settings_applied appears',
        'before the first turn of the rollout'
      )?.[1]
    ).toBe('7');
    expect(
      rowOf(report, 'thread_settings_applied thread_id', "the rollout's own thread")?.[1]
    ).toBe('2');
    expect(rowOf(report, heading, 'reasoning_effort ↔ effort', 'agree')?.[2]).toBe('2');
    expect(rowOf(report, heading, 'model ↔ model', 'agree')?.[2]).toBe('2');
    // The sanitizer blanks summary values in turn_context: no claim either way.
    expect(
      rowOf(
        report,
        heading,
        'reasoning_summary ↔ summary',
        'not comparable (sanitized placeholder)'
      )?.[2]
    ).toBe('2');
    expect(
      rowOf(report, heading, 'service_tier ↔ service_tier', 'only in thread_settings_applied')?.[2]
    ).toBe('2');
  });

  it('reads the persisted token usage objects', () => {
    expect(
      rowOf(
        report,
        'Relations between usage objects',
        'later record of a turn: turn_token_usage = previous turn_token_usage + usage',
        'holds'
      )?.[2]
    ).toBe('5');
    expect(
      rowOf(
        report,
        'Relations between usage objects',
        'first record of the rollout: thread_token_usage = usage',
        'holds'
      )?.[2]
    ).toBe('2');
  });

  it('reads abort reasons and lifecycle fields', () => {
    expect(rowOf(report, 'Lifecycle values', 'turn_aborted', 'reason interrupted')?.[2]).toBe('1');
    expect(rowOf(report, 'Lifecycle events', 'task_started', '0.153.0')?.slice(2, 4)).toEqual([
      '1',
      '1',
    ]);
  });
});

describe('the whole survey', () => {
  it('appends the section to the report, deterministically, and cleans up after itself', async () => {
    const before = fs
      .readdirSync(os.tmpdir())
      .filter((name) => name.startsWith('codex-survey-transcripts-'));
    const options = { maxFiles: 200, all: true, transcriptsDir: REAL_OBSERVED, quiet: true };
    const first = await runSurvey(options);
    const second = await runSurvey(options);
    const section = (report: string | undefined): string => {
      const start = report?.indexOf('## Runtime state and relationships') ?? -1;
      expect(start).toBeGreaterThan(0);
      return report!.slice(start);
    };
    expect(first).toContain('## Events');
    expect(section(first)).toBe(section(second));
    expect(section(first)).not.toContain('<string:');
    const after = fs
      .readdirSync(os.tmpdir())
      .filter((name) => name.startsWith('codex-survey-transcripts-'));
    expect(after).toEqual(before);
  });
});
