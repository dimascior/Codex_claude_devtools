/**
 * Evidence linking rules that need record content the sanitized real fixtures
 * do not carry (output headers, script sources, command text).
 *
 * These records are synthetic, built in the shapes observed in real rollouts
 * (docs/codex-real-validation): nested items carry `exec-<uuid>` ids and a
 * `turn_id`, exec calls carry their turn id in the passthrough metadata, and
 * no `executed_tool_calls` or `cell_id` passthrough is present.
 */

import { describe, expect, it } from 'vitest';

import { normalizeCodexRollout } from '../../../../src/main/providers/codex/CodexExecutionNormalizer';
import {
  classifyOutcomeText,
  parseToolOutput,
} from '../../../../src/main/providers/codex/execOutput';

import type { CodexRolloutRecord } from '../../../../src/main/providers/codex/types';
import type { Execution, TimelineEntry } from '@shared/types';

const TURN = '01a0e10c-ff5d-7041-9ea4-020b24daee93';

let line = 0;

function record(
  type: string,
  payload: Record<string, unknown>,
  second: number
): CodexRolloutRecord {
  line++;
  return {
    lineNumber: line,
    ordinal: line - 1,
    timestamp: new Date(Date.UTC(2026, 8, 27, 4, 0, second)).toISOString(),
    type,
    payload,
  };
}

function execCall(callId: string, input: string, second: number): CodexRolloutRecord {
  return record(
    'response_item',
    {
      type: 'custom_tool_call',
      status: 'completed',
      call_id: callId,
      name: 'exec',
      input,
      internal_chat_message_metadata_passthrough: { turn_id: TURN },
    },
    second
  );
}

function execOutput(
  callId: string,
  text: string,
  second: number,
  extra: Record<string, unknown> = {}
): CodexRolloutRecord {
  return record(
    'response_item',
    {
      type: 'custom_tool_call_output',
      call_id: callId,
      output: [{ type: 'input_text', text }],
      internal_chat_message_metadata_passthrough: { turn_id: TURN },
      ...extra,
    },
    second
  );
}

function commandItem(
  id: string,
  command: string,
  exitCode: number,
  second: number
): CodexRolloutRecord {
  return record(
    'event_msg',
    {
      type: 'item_completed',
      thread_id: 'thread',
      turn_id: TURN,
      item: {
        type: 'CommandExecution',
        id,
        command: ['pwsh.exe', '-Command', command],
        cwd: 'C:\\work',
        source: 'unified_exec_startup',
        status: exitCode === 0 ? 'completed' : 'failed',
        exit_code: exitCode,
        duration: { secs: 1, nanos: 0 },
        aggregated_output: 'out',
      },
      completed_at_ms: Date.UTC(2026, 8, 27, 4, 0, second),
    },
    second
  );
}

function start(): CodexRolloutRecord[] {
  line = 0;
  return [
    record('session_meta', { id: 'thread', cwd: 'C:\\work', cli_version: '0.158.0' }, 0),
    record('event_msg', { type: 'task_started', turn_id: TURN }, 0),
  ];
}

function executions(timeline: TimelineEntry[]): Execution[] {
  return timeline.flatMap((entry) => (entry.kind === 'execution' ? [entry.execution] : []));
}

function byId(list: Execution[], id: string): Execution {
  const found = list.find((exec) => exec.id === id);
  if (!found) throw new Error(`execution ${id} not found`);
  return found;
}

describe('outcome text written by the Codex harness', () => {
  it('classifies PreToolUse hook blocks as declined', () => {
    expect(
      classifyOutcomeText(
        'Command blocked by PreToolUse hook: REJECTED: rule 12. Command: git push'
      )
    ).toBe('declined');
    expect(classifyOutcomeText('Tool call blocked by PreToolUse hook: nope. Tool: web')).toBe(
      'declined'
    );
  });

  it('classifies unified exec failures reported through write_stdin as failed', () => {
    expect(classifyOutcomeText('write_stdin failed: Unified exec process failed: gone')).toBe(
      'failed'
    );
    expect(classifyOutcomeText('Unknown process id 1234')).toBe('failed');
  });

  it('reads the wall time of an interrupted tool call', () => {
    const parsed = parseToolOutput('Wall time: 1.5 seconds\naborted by user');
    expect(parsed).toMatchObject({ recognized: true, wallTimeMs: 1500, body: 'aborted by user' });
    expect(classifyOutcomeText(parsed.body)).toBe('interrupted');
  });

  it('shows a hook-blocked shell command as declined, without an exit code', () => {
    const records = [
      ...start(),
      record(
        'response_item',
        {
          type: 'function_call',
          name: 'shell_command',
          arguments: JSON.stringify({ command: 'git push', workdir: 'C:\\work' }),
          call_id: 'call_block',
        },
        1
      ),
      record(
        'response_item',
        {
          type: 'function_call_output',
          call_id: 'call_block',
          output: 'Command blocked by PreToolUse hook: REJECTED: rule 12. Command: git push',
        },
        2
      ),
    ];
    const exec = byId(
      executions(normalizeCodexRollout(records, { active: false }).timeline),
      'call_block'
    );
    expect(exec).toMatchObject({ kind: 'command', status: 'declined' });
    expect(exec.exitCode).toBeUndefined();
    expect(exec.statusDetail).toContain('blocked by PreToolUse hook');
  });
});

describe('hosted web search items persisted before their call', () => {
  function webSearchCall(id: string, second: number): CodexRolloutRecord {
    return record(
      'response_item',
      {
        type: 'web_search_call',
        id,
        status: 'completed',
        action: { type: 'search', query: 'q' },
        internal_chat_message_metadata_passthrough: { turn_id: TURN },
      },
      second
    );
  }

  it('adopts the call only onto a WebSearch item with the same id', () => {
    const records = [
      ...start(),
      record(
        'event_msg',
        {
          type: 'item_completed',
          turn_id: TURN,
          item: { type: 'WebSearch', id: 'ws_1', query: 'q', action: { type: 'search' } },
          completed_at_ms: Date.UTC(2026, 8, 27, 4, 0, 1),
        },
        1
      ),
      webSearchCall('ws_1', 2),
      // A different item type carrying the id of the next call is not merged into it.
      commandItem('ws_2', 'ls', 0, 3),
      webSearchCall('ws_2', 4),
    ];
    const list = executions(normalizeCodexRollout(records, { active: false }).timeline);

    const adopted = list.filter((exec) => exec.id === 'ws_1');
    expect(adopted).toHaveLength(1);
    expect(adopted[0]).toMatchObject({
      kind: 'web_search',
      status: 'completed',
      args: { type: 'search', query: 'q' },
      evidence: {
        observed: { kind: 'call', recordType: 'web_search_call', lineNumber: 4 },
        result: { kind: 'item', recordType: 'item_completed/WebSearch', lineNumber: 3 },
        cellLink: { method: 'explicit_id' },
      },
    });

    expect(
      list.filter((exec) => exec.id.startsWith('ws_2')).map((exec) => [exec.id, exec.kind])
    ).toEqual([
      ['ws_2', 'command'],
      ['ws_2#2', 'web_search'],
    ]);
  });

  it("keeps the item's action when the adopted call records none", () => {
    const records = [
      ...start(),
      record(
        'event_msg',
        {
          type: 'item_completed',
          turn_id: TURN,
          item: { type: 'WebSearch', id: 'ws_1', query: 'q', action: { type: 'open_page' } },
        },
        1
      ),
      record('response_item', { type: 'web_search_call', id: 'ws_1', status: 'completed' }, 2),
    ];
    const [adopted] = executions(normalizeCodexRollout(records, { active: false }).timeline);
    expect(adopted).toMatchObject({
      id: 'ws_1',
      args: { action: 'open_page' },
      evidence: { cellLink: { method: 'explicit_id' } },
    });
  });
});

describe('attributing exec- items to code cells', () => {
  it('links a recorded command to the unique script call site with the same command', () => {
    const records = [
      ...start(),
      execCall(
        'call_a',
        "await tools.exec_command({ cmd: 'git status' });\nawait tools.exec_command({ cmd: 'git diff' });",
        1
      ),
      commandItem('exec-00000000-0000-4000-8000-000000000001', 'git status', 0, 2),
      execOutput('call_a', 'Script completed\nWall time: 2.0 seconds\nOutput:\nok', 3),
    ];
    const cell = byId(
      executions(normalizeCodexRollout(records, { active: false }).timeline),
      'call_a'
    );
    expect(cell.children?.map((child) => [child.command, child.status])).toEqual([
      ['git status', 'completed'],
      ['git diff', 'unknown'],
    ]);
    expect(cell.children?.[0].evidence).toMatchObject({
      code: { line: 1 },
      observed: { kind: 'item', recordId: 'exec-00000000-0000-4000-8000-000000000001' },
      cellLink: { method: 'turn_window' },
      callSiteLink: { method: 'content' },
    });
    // The other call site stays code evidence only.
    expect(cell.children?.[1].evidence).toEqual({ code: { line: 2, dynamic: false } });
  });

  it('does not link by content when the command text is not unique', () => {
    const records = [
      ...start(),
      execCall(
        'call_a',
        "await tools.exec_command({ cmd: 'npm test' });\nawait tools.exec_command({ cmd: 'npm test' });",
        1
      ),
      commandItem('exec-00000000-0000-4000-8000-000000000001', 'npm test', 1, 2),
      execOutput('call_a', 'Script failed\nWall time: 2.0 seconds\nOutput:\n', 3),
    ];
    const cell = byId(
      executions(normalizeCodexRollout(records, { active: false }).timeline),
      'call_a'
    );
    expect(cell.children?.map((child) => [child.source, child.status])).toEqual([
      ['cell_script', 'unknown'],
      ['cell_script', 'unknown'],
      ['item_completed/CommandExecution', 'failed'],
    ]);
    expect(cell.children?.[2].evidence.callSiteLink).toBeUndefined();
  });

  it('keeps a yielded cell open until a wait reports it finished', () => {
    const records = [
      ...start(),
      execCall('call_a', "await tools.exec_command({ cmd: 'cargo build' });", 1),
      execOutput('call_a', 'Script running with cell ID 7\nWall time: 10.0 seconds\nOutput:\n', 2),
      commandItem('exec-00000000-0000-4000-8000-000000000001', 'cargo build', 0, 3),
      record(
        'response_item',
        {
          type: 'function_call',
          name: 'wait',
          arguments: JSON.stringify({ cell_id: '7', yield_time_ms: 1000 }),
          call_id: 'call_wait',
        },
        4
      ),
      record(
        'response_item',
        {
          type: 'function_call_output',
          call_id: 'call_wait',
          output: 'Script completed\nWall time: 1.0 seconds\nOutput:\n',
        },
        5
      ),
      commandItem('exec-00000000-0000-4000-8000-000000000002', 'late', 0, 6),
    ];
    const list = executions(normalizeCodexRollout(records, { active: false }).timeline);
    const cell = byId(list, 'call_a');
    expect(cell).toMatchObject({ status: 'completed', cellId: '7' });
    expect(cell.children?.[0]).toMatchObject({ command: 'cargo build', exitCode: 0 });
    // After the wait closed the cell, a later item is not attributed to it.
    expect(byId(list, 'exec-00000000-0000-4000-8000-000000000002').evidence.cellLink).toMatchObject(
      { method: 'unresolved' }
    );
  });

  it('keeps a cell open across notify() outputs', () => {
    const records = [
      ...start(),
      execCall('call_a', 'notify("step 1");', 1),
      execOutput('call_a', 'step 1', 2, { name: 'exec' }),
      commandItem('exec-00000000-0000-4000-8000-000000000001', 'ls', 0, 3),
      execOutput('call_a', 'Script completed\nWall time: 2.0 seconds\nOutput:\n', 4),
    ];
    const cell = byId(
      executions(normalizeCodexRollout(records, { active: false }).timeline),
      'call_a'
    );
    expect(cell.status).toBe('completed');
    expect(cell.children?.map((child) => child.id)).toEqual([
      'exec-00000000-0000-4000-8000-000000000001',
    ]);
  });

  it('refuses to choose between two running cells of the same turn', () => {
    const records = [
      ...start(),
      execCall('call_a', 'await work();', 1),
      execOutput('call_a', 'Script running with cell ID 1\nWall time: 10.0 seconds\nOutput:\n', 2),
      execCall('call_b', 'await work();', 3),
      commandItem('exec-00000000-0000-4000-8000-000000000001', 'ls', 0, 4),
      execOutput('call_b', 'Script completed\nWall time: 1.0 seconds\nOutput:\n', 5),
    ];
    const list = executions(normalizeCodexRollout(records, { active: false }).timeline);
    expect(byId(list, 'call_a').children).toBeUndefined();
    expect(byId(list, 'call_b').children).toBeUndefined();
    expect(byId(list, 'exec-00000000-0000-4000-8000-000000000001').evidence.cellLink).toEqual({
      method: 'unresolved',
      detail: 'Dispatched from a code cell, but 2 cells of its turn were running',
    });
  });

  it('does not attribute items recorded in another turn', () => {
    const records = [
      ...start(),
      execCall('call_a', 'await work();', 1),
      record(
        'event_msg',
        {
          type: 'item_completed',
          turn_id: 'another-turn',
          item: {
            type: 'FileChange',
            id: 'exec-00000000-0000-4000-8000-000000000009',
            changes: {},
          },
          completed_at_ms: Date.UTC(2026, 8, 27, 4, 0, 2),
        },
        2
      ),
    ];
    const list = executions(normalizeCodexRollout(records, { active: true }).timeline);
    expect(byId(list, 'call_a').children).toBeUndefined();
    expect(byId(list, 'exec-00000000-0000-4000-8000-000000000009')).toMatchObject({
      kind: 'patch',
      evidence: { cellLink: { method: 'unresolved' } },
    });
  });
});
