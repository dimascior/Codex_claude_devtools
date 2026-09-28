import * as path from 'path';
import { describe, expect, it } from 'vitest';

import { normalizeCodexRollout } from '../../../../src/main/providers/codex/CodexExecutionNormalizer';
import { readRolloutRecords } from '../../../../src/main/providers/codex/CodexRolloutParser';

import type { Execution, ExecutionEntry, TimelineEntry } from '../../../../src/main/domain';

const FIXTURES = path.resolve(__dirname, '../../../fixtures/codex');

async function normalizeFixture(name: string, active = false) {
  const { records } = await readRolloutRecords(path.join(FIXTURES, name));
  return normalizeCodexRollout(records, { active });
}

function executions(timeline: TimelineEntry[]): Execution[] {
  return timeline
    .filter((entry): entry is ExecutionEntry => entry.kind === 'execution')
    .map((entry) => entry.execution);
}

function byId(list: Execution[], id: string): Execution {
  const found = list.find((exec) => exec.id === id);
  if (!found) {
    throw new Error(`execution ${id} not found`);
  }
  return found;
}

describe('normalizeCodexRollout — function-call and local_shell generations', () => {
  it('reads session metadata, model, title and token usage', async () => {
    const session = await normalizeFixture('function-calls.jsonl');
    expect(session.metadata).toMatchObject({
      threadId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
      cwd: 'C:\\Users\\dev\\src\\sample-app',
      originator: 'codex_cli_rs',
      cliVersion: '0.121.0',
      source: 'cli',
      gitBranch: 'main',
      gitCommit: 'a1b2c3d',
    });
    expect(session.model).toBe('example-model-a');
    expect(session.title).toBe('Run the tests and show me what changed');
    expect(session.tokenUsage?.total.totalTokens).toBe(24900);
    expect(session.tokenUsage?.contextWindow).toBe(272000);
    expect(session.turnInProgress).toBe(false);
  });

  it('orders the timeline chronologically without duplicate messages', async () => {
    const { timeline } = await normalizeFixture('function-calls.jsonl');
    expect(timeline.map((entry) => entry.kind)).toEqual([
      'user_message',
      'reasoning',
      'execution',
      'execution',
      'execution',
      'execution',
      'execution',
      'execution',
      'agent_message',
    ]);
    const lines = timeline.map((entry) => entry.lineNumber);
    expect([...lines].sort((a, b) => a - b)).toEqual(lines);

    // Injected <environment_context> is never shown as a user message.
    const users = timeline.filter((entry) => entry.kind === 'user_message');
    expect(users).toHaveLength(1);
  });

  it('keeps reasoning summaries and flags encrypted reasoning without decoding it', async () => {
    const { timeline } = await normalizeFixture('function-calls.jsonl');
    const reasoning = timeline.find((entry) => entry.kind === 'reasoning');
    expect(reasoning).toMatchObject({
      kind: 'reasoning',
      summary: ["**Checking repository state**\n\nI'll look at git status first."],
      encrypted: true,
    });
    expect(JSON.stringify(reasoning)).not.toContain('gAAAAA');
  });

  it('normalizes a legacy shell call with its PowerShell script, cwd, exit code and wall time', async () => {
    const list = executions((await normalizeFixture('function-calls.jsonl')).timeline);
    expect(byId(list, 'call_shell_1')).toMatchObject({
      kind: 'command',
      generation: 'function_call',
      source: 'function_call',
      name: 'shell',
      command: 'git status --short',
      shell: 'powershell',
      argv: ['powershell.exe', '-NoProfile', '-Command', 'git status --short'],
      cwd: 'C:\\Users\\dev\\src\\sample-app',
      exitCode: 0,
      status: 'completed',
      durationMs: 400,
      durationSource: 'reported',
      output: ' M src/lib.rs\n?? notes.md\n',
      timestamp: '2026-09-23T22:41:03.000Z',
      completedAt: '2026-09-23T22:41:03.400Z',
      lineNumber: 10,
      outputLineNumber: 11,
      turnId: 'turn-1',
    });
  });

  it('follows a unified exec session from exec_command to the write_stdin that saw it exit', async () => {
    const list = executions((await normalizeFixture('function-calls.jsonl')).timeline);
    const origin = byId(list, 'call_exec_2');
    expect(origin).toMatchObject({
      command: 'cargo test --workspace',
      cwd: 'C:\\Users\\dev\\src\\sample-app\\crates',
      processId: '3',
      exitCode: 101,
      status: 'failed',
      completedAt: '2026-09-23T22:41:27.250Z',
    });
    expect(byId(list, 'call_stdin_3')).toMatchObject({
      kind: 'command_input',
      parentId: 'call_exec_2',
      processId: '3',
      exitCode: 101,
      status: 'failed',
      durationMs: 12250,
    });
  });

  it('normalizes local_shell_call with structured JSON output', async () => {
    const list = executions((await normalizeFixture('function-calls.jsonl')).timeline);
    expect(byId(list, 'call_local_4')).toMatchObject({
      kind: 'command',
      generation: 'local_shell',
      source: 'local_shell_call',
      name: 'local_shell',
      command: 'git diff --stat',
      shell: 'bash',
      cwd: 'C:\\Users\\dev\\src\\sample-app',
      exitCode: 0,
      status: 'completed',
      durationMs: 300,
      output: ' src/lib.rs | 4 ++--\n 1 file changed\n',
    });
  });

  it('recognizes patches and declined commands', async () => {
    const list = executions((await normalizeFixture('function-calls.jsonl')).timeline);
    expect(byId(list, 'call_patch_5')).toMatchObject({
      kind: 'patch',
      source: 'custom_tool_call',
      fileWrites: [{ path: 'src/lib.rs', change: 'update' }],
      exitCode: 0,
      status: 'completed',
    });
    expect(byId(list, 'call_rm_6')).toMatchObject({
      kind: 'command',
      command: 'Remove-Item -Recurse target',
      status: 'declined',
      statusDetail: 'exec command rejected by user',
    });
  });

  it('computes execution stats', async () => {
    const { stats } = await normalizeFixture('function-calls.jsonl');
    expect(stats).toMatchObject({
      total: 6,
      commands: 4,
      nested: 0,
      failed: 2,
      declined: 1,
      running: 0,
    });
    expect(stats.byKind).toEqual({ command: 4, command_input: 1, patch: 1 });
  });
});

describe('normalizeCodexRollout — code mode', () => {
  it('keeps a code cell as one call with its recorded nested commands', async () => {
    const list = executions((await normalizeFixture('code-mode.jsonl')).timeline);
    const cell = byId(list, 'call_cell_1');
    expect(cell).toMatchObject({
      kind: 'code_cell',
      source: 'custom_tool_call',
      name: 'exec',
      status: 'completed',
      statusDetail: 'Script completed',
      durationMs: 38200,
      cellId: 'cell-7',
      args: { yield_time_ms: 30000 },
      childrenComplete: true,
    });
    // The inventory (executed_tool_calls) replaced the script's call sites.
    expect(cell.children?.every((child) => child.evidence.observed?.kind === 'inventory')).toBe(
      true
    );
    expect(cell.output).toContain('test result: ok. 42 passed');
    expect(cell.children?.map((child) => child.command)).toEqual([
      'git status --short',
      'git diff',
      'cargo test --workspace',
    ]);
    expect(cell.children?.[2]).toMatchObject({
      id: 'call_cell_1:3',
      parentId: 'call_cell_1',
      kind: 'command',
      generation: 'code_mode',
      name: 'exec_command',
      cwd: '/home/dev/src/sample-app/crates',
      status: 'unknown',
      evidence: { observed: { kind: 'inventory', recordType: 'executed_tool_calls' } },
    });
    expect(cell.children?.[2].evidence.result).toBeUndefined();
  });

  it('falls back to script analysis and resolves a yielded cell through wait', async () => {
    const list = executions((await normalizeFixture('code-mode.jsonl')).timeline);
    const cell = byId(list, 'call_cell_2');
    expect(cell).toMatchObject({
      cellId: 'cell-8',
      status: 'failed',
      completedAt: '2026-09-24T09:01:20.000Z',
    });
    expect(cell.children?.map((child) => [child.name, child.command])).toEqual([
      ['exec_command', '‹cmd›'],
      ['apply_patch', 'apply_patch'],
    ]);
    // Script call sites are code evidence only: no provider record, no status.
    for (const child of cell.children ?? []) {
      expect(child.evidence.code).toBeDefined();
      expect(child.evidence.observed).toBeUndefined();
      expect(child.evidence.result).toBeUndefined();
      expect(child.status).toBe('unknown');
    }
    expect(cell.children?.[1].fileWrites).toEqual([{ path: 'notes.md', change: 'add' }]);

    expect(byId(list, 'call_wait_3')).toMatchObject({
      kind: 'code_wait',
      parentId: 'call_cell_2',
      cellId: 'cell-8',
      status: 'completed',
      statusDetail: 'Script failed',
    });
  });

  it('shows encrypted-only reasoning as unavailable', async () => {
    const { timeline, stats } = await normalizeFixture('code-mode.jsonl');
    expect(timeline.find((entry) => entry.kind === 'reasoning')).toMatchObject({
      summary: [],
      encrypted: true,
    });
    // cell 1 lists 3 commands in its recorded inventory; cell 2's script call
    // sites (1 command, 1 patch) have no provider record and are not counted.
    expect(stats).toMatchObject({ total: 3, nested: 5, commands: 3, scriptOnly: 2 });
  });
});

describe('normalizeCodexRollout — paginated rollouts', () => {
  it('attributes exec- items to the only running cell and links them to call sites by command', async () => {
    const { timeline } = await normalizeFixture('paginated.jsonl');
    const cell = byId(executions(timeline), 'call_cell_9');
    expect(cell.children?.map((child) => [child.command, child.exitCode, child.status])).toEqual([
      ['npm run lint', 0, 'completed'],
      ['npm test', 1, 'failed'],
    ]);
    expect(cell.children?.[0]).toMatchObject({
      durationMs: 2500,
      durationSource: 'reported',
      evidence: {
        observed: { kind: 'item', recordType: 'item_completed/CommandExecution', lineNumber: 7 },
        result: { kind: 'item', lineNumber: 7 },
        cellLink: { method: 'turn_window' },
        callSiteLink: { method: 'content' },
      },
    });
  });

  it('adds user shell commands and turn aborts, using item_completed user messages', async () => {
    const { timeline } = await normalizeFixture('paginated.jsonl');
    const users = timeline.filter((entry) => entry.kind === 'user_message');
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ text: 'lint it' });

    expect(byId(executions(timeline), 'user-shell-1')).toMatchObject({
      source: 'user_shell',
      command: 'ls',
      shell: 'zsh',
      exitCode: 0,
      status: 'completed',
      durationMs: 20,
    });
    expect(timeline[timeline.length - 1]).toMatchObject({
      kind: 'turn_event',
      event: 'aborted',
      reason: 'interrupted',
    });
  });
});

describe('normalizeCodexRollout — legacy pre-envelope rollouts', () => {
  it('reads bare session metadata and response items', async () => {
    const session = await normalizeFixture('legacy-bare.jsonl');
    expect(session.metadata).toMatchObject({
      threadId: '0198aaaa-bbbb-7ccc-8ddd-eeeeffff0000',
      gitBranch: 'dev',
    });
    expect(session.timeline.map((entry) => entry.kind)).toEqual([
      'user_message',
      'execution',
      'agent_message',
    ]);
    expect(session.title).toBe('list files');
    expect(executions(session.timeline)[0]).toMatchObject({
      command: 'ls -la',
      exitCode: 0,
      durationMs: 100,
      timestamp: '2025-08-01T12:00:00.000Z',
    });
  });
});

describe('normalizeCodexRollout — in-progress sessions', () => {
  it('keeps the current turn running while active and resolves it otherwise', async () => {
    const { records } = await readRolloutRecords(path.join(FIXTURES, 'function-calls.jsonl'));
    // Cut the rollout right after exec_command started (before any output).
    const truncated = records.filter((record) => record.lineNumber <= 12);

    const active = normalizeCodexRollout(truncated, { active: true });
    expect(active.turnInProgress).toBe(true);
    expect(byId(executions(active.timeline), 'call_exec_2').status).toBe('running');

    const idle = normalizeCodexRollout(truncated, { active: false });
    expect(idle.turnInProgress).toBe(false);
    expect(byId(executions(idle.timeline), 'call_exec_2')).toMatchObject({
      status: 'unknown',
      statusDetail: 'No result was recorded',
    });
  });

  it('marks calls interrupted by an aborted turn', () => {
    const records = [
      {
        lineNumber: 1,
        type: 'event_msg',
        payload: { type: 'task_started', turn_id: 'x' },
      },
      {
        lineNumber: 2,
        timestamp: '2026-01-01T00:00:00.000Z',
        type: 'response_item',
        payload: {
          type: 'function_call',
          name: 'exec_command',
          arguments: '{"cmd":"sleep 100"}',
          call_id: 'call_sleep',
        },
      },
      {
        lineNumber: 3,
        type: 'event_msg',
        payload: { type: 'turn_aborted', turn_id: 'x', reason: 'interrupted' },
      },
    ];
    const { timeline } = normalizeCodexRollout(records, { active: true });
    expect(byId(executions(timeline), 'call_sleep')).toMatchObject({
      status: 'interrupted',
      statusDetail: 'Turn aborted before a result was recorded',
    });
  });
});

describe('normalizeCodexRollout — inter-agent messages', () => {
  it('keeps agent replies recorded only as item events next to an inter-agent task', () => {
    const records = [
      {
        lineNumber: 1,
        ordinal: 0,
        type: 'session_meta',
        payload: { id: 't', source: { subagent: { thread_spawn: { parent_thread_id: 'p' } } } },
      },
      {
        lineNumber: 2,
        ordinal: 1,
        type: 'inter_agent_communication_metadata',
        payload: { trigger_turn: true },
      },
      {
        lineNumber: 3,
        ordinal: 2,
        type: 'response_item',
        payload: {
          type: 'agent_message',
          author: '/root',
          recipient: '/root/check_logs',
          content: [
            { type: 'input_text', text: 'Message Type: NEW_TASK' },
            { type: 'encrypted_content', encrypted_content: 'gAAAA' },
          ],
        },
      },
      {
        lineNumber: 4,
        ordinal: 3,
        type: 'event_msg',
        payload: {
          type: 'item_completed',
          item: { type: 'AgentMessage', id: 'msg_1', content: [{ type: 'Text', text: 'Done.' }] },
        },
      },
    ];
    const session = normalizeCodexRollout(records, { active: false });
    expect(session.title).toBe('check_logs');
    expect(session.titleSource).toBe('agent_task');
    expect(
      session.timeline.map((entry) =>
        entry.kind === 'agent_message' ? [entry.text, entry.encrypted ?? false] : entry.kind
      )
    ).toEqual([
      ['Message Type: NEW_TASK', true],
      ['Done.', false],
    ]);
  });
});
