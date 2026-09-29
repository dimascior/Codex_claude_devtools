/**
 * What Codex itself records about commands (`parsed_cmd`) and file changes
 * (`changes`), carried onto executions as `commandActions` and `fileWrites`.
 *
 * Records are synthetic, in the shapes Codex persists: `CommandExecution` and
 * `FileChange` items inside `item_completed`, and the legacy
 * `exec_command_end` / `patch_apply_end` events.
 */

import { describe, expect, it } from 'vitest';

import { normalizeCodexRollout } from '../../../../src/main/providers/codex/CodexExecutionNormalizer';

import type { CodexRolloutRecord } from '../../../../src/main/providers/codex/types';
import type { Execution } from '@shared/types';

const TURN = '01a0e10c-ff5d-7041-9ea4-020b24daee93';

let line = 0;

function record(type: string, payload: Record<string, unknown>): CodexRolloutRecord {
  line++;
  return {
    lineNumber: line,
    ordinal: line - 1,
    timestamp: new Date(Date.UTC(2026, 8, 27, 4, 0, line)).toISOString(),
    type,
    payload,
  };
}

function start(): CodexRolloutRecord[] {
  line = 0;
  return [
    record('session_meta', { id: 'thread', cwd: '/work/app', cli_version: '0.158.0' }),
    record('event_msg', { type: 'task_started', turn_id: TURN }),
  ];
}

function completedItem(item: Record<string, unknown>): CodexRolloutRecord {
  return record('event_msg', { type: 'item_completed', thread_id: 'thread', turn_id: TURN, item });
}

function commandItem(id: string, command: string, parsedCmd?: unknown): CodexRolloutRecord {
  return completedItem({
    type: 'CommandExecution',
    id,
    command: ['bash', '-lc', command],
    cwd: '/work/app',
    source: 'unified_exec_startup',
    status: 'completed',
    exit_code: 0,
    aggregated_output: 'out',
    ...(parsedCmd === undefined ? {} : { parsed_cmd: parsedCmd }),
  });
}

function normalize(records: CodexRolloutRecord[]): ReturnType<typeof normalizeCodexRollout> {
  return normalizeCodexRollout(records, { active: false });
}

function byId(list: readonly Execution[], id: string): Execution {
  const found = list.find((exec) => exec.id === id);
  if (!found) throw new Error(`execution ${id} not found`);
  return found;
}

describe('Codex command classification (parsed_cmd)', () => {
  it('keeps every action Codex recorded, with its fields', () => {
    const records = [
      ...start(),
      commandItem('exec-1', 'sed -n 1,40p src/a.ts | rg -n foo src && ls docs; make', [
        { type: 'read', cmd: 'sed -n 1,40p src/a.ts', name: 'a.ts', path: 'src/a.ts' },
        { type: 'search', cmd: 'rg -n foo src', query: 'foo', path: 'src' },
        { type: 'list_files', cmd: 'ls docs', path: 'docs' },
        { type: 'unknown', cmd: 'make' },
      ]),
    ];
    const exec = byId(normalize(records).executions, 'exec-1');
    expect(exec.commandActions).toEqual([
      { type: 'read', command: 'sed -n 1,40p src/a.ts', name: 'a.ts', path: 'src/a.ts' },
      { type: 'search', command: 'rg -n foo src', query: 'foo', path: 'src' },
      { type: 'list_files', command: 'ls docs', path: 'docs' },
      { type: 'unknown', command: 'make' },
    ]);
  });

  it('never derives actions from the command text', () => {
    const records = [...start(), commandItem('exec-2', 'cat README.md')];
    expect(byId(normalize(records).executions, 'exec-2').commandActions).toBeUndefined();
  });

  it('keeps action types Codex adds later as recorded, and skips malformed entries', () => {
    const records = [
      ...start(),
      commandItem('exec-3', 'tee out.txt', [
        { type: 'write', cmd: 'tee out.txt', path: 'out.txt' },
        { cmd: 'no type' },
        'not an object',
      ]),
    ];
    expect(byId(normalize(records).executions, 'exec-3').commandActions).toEqual([
      { type: 'write', command: 'tee out.txt', path: 'out.txt' },
    ]);
  });

  it('adds actions from a legacy exec_command_end to the call with the same id', () => {
    const records = [
      ...start(),
      record('response_item', {
        type: 'function_call',
        name: 'shell',
        call_id: 'call_read',
        arguments: JSON.stringify({ command: ['bash', '-lc', 'cat notes.md'] }),
      }),
      record('event_msg', {
        type: 'exec_command_end',
        call_id: 'call_read',
        turn_id: TURN,
        command: ['bash', '-lc', 'cat notes.md'],
        parsed_cmd: [{ type: 'read', cmd: 'cat notes.md', name: 'notes.md', path: 'notes.md' }],
        exit_code: 0,
        aggregated_output: 'hello',
      }),
    ];
    const exec = byId(normalize(records).executions, 'call_read');
    expect(exec.commandActions).toEqual([
      { type: 'read', command: 'cat notes.md', name: 'notes.md', path: 'notes.md' },
    ]);
    expect(exec.evidence.result?.recordType).toBe('exec_command_end');
  });

  it('keeps the actions when the recorded command is merged into its script call site', () => {
    const records = [
      ...start(),
      record('response_item', {
        type: 'custom_tool_call',
        status: 'completed',
        call_id: 'call_cell',
        name: 'exec',
        input: "const readme = await tools.exec_command({ cmd: 'cat README.md' });",
      }),
      commandItem('exec-6', 'cat README.md', [
        { type: 'read', cmd: 'cat README.md', name: 'README.md', path: 'README.md' },
      ]),
      record('response_item', {
        type: 'custom_tool_call_output',
        call_id: 'call_cell',
        output: [
          { type: 'input_text', text: 'Script completed\nWall time: 1.0 seconds\nOutput:\n' },
        ],
      }),
    ];
    const session = normalize(records);
    const [child] = byId(session.executions, 'call_cell').children ?? [];
    expect(child.evidence.callSiteLink?.method).toBe('content');
    expect(child.commandActions).toEqual([
      { type: 'read', command: 'cat README.md', name: 'README.md', path: 'README.md' },
    ]);
    expect(session.stats.commandActions).toEqual({ read: 1 });
  });

  it('counts classified actions in the session stats, unknown ones excluded', () => {
    const records = [
      ...start(),
      commandItem('exec-4', 'cat a && cat b', [
        { type: 'read', cmd: 'cat a', name: 'a', path: 'a' },
        { type: 'read', cmd: 'cat b', name: 'b', path: 'b' },
      ]),
      commandItem('exec-5', 'rg x; make', [
        { type: 'search', cmd: 'rg x', query: 'x' },
        { type: 'unknown', cmd: 'make' },
      ]),
    ];
    expect(normalize(records).stats.commandActions).toEqual({ read: 2, search: 1 });
  });
});

describe('file writes', () => {
  it('records the change Codex applied to each file', () => {
    const records = [
      ...start(),
      completedItem({
        type: 'FileChange',
        id: 'exec-patch',
        status: 'completed',
        changes: {
          'src/new.ts': { type: 'add', content: 'x' },
          'src/old.ts': { type: 'update', unified_diff: '@@', move_path: 'src/renamed.ts' },
          'src/gone.ts': { type: 'delete', content: 'y' },
          'src/odd.ts': 'not an object',
        },
      }),
    ];
    const exec = byId(normalize(records).executions, 'exec-patch');
    expect(exec.kind).toBe('patch');
    expect(exec.fileWrites).toEqual([
      { path: 'src/new.ts', change: 'add' },
      { path: 'src/old.ts', change: 'update', movedTo: 'src/renamed.ts' },
      { path: 'src/gone.ts', change: 'delete' },
      { path: 'src/odd.ts' },
    ]);
  });

  it('reads the change from the patch headers of an apply_patch call', () => {
    const patch = [
      '*** Begin Patch',
      '*** Add File: docs/new.md',
      '+hello',
      '*** Update File: src/a.ts',
      '*** Move to: src/b.ts',
      '@@',
      '*** Delete File: tmp.txt',
      '*** End Patch',
    ].join('\n');
    const records = [
      ...start(),
      record('response_item', {
        type: 'custom_tool_call',
        status: 'completed',
        call_id: 'call_patch',
        name: 'apply_patch',
        input: patch,
      }),
      record('event_msg', {
        type: 'patch_apply_end',
        call_id: 'call_patch',
        turn_id: TURN,
        success: true,
        stdout: 'Success.',
        changes: { '/work/app/docs/new.md': { type: 'add', content: 'hello' } },
      }),
    ];
    const exec = byId(normalize(records).executions, 'call_patch');
    expect(exec.status).toBe('completed');
    // The call's own headers are kept; the record confirms the outcome.
    expect(exec.fileWrites).toEqual([
      { path: 'docs/new.md', change: 'add' },
      { path: 'src/a.ts', change: 'update', movedTo: 'src/b.ts' },
      { path: 'tmp.txt', change: 'delete' },
    ]);
  });

  it('counts distinct files of completed patches, by their final path', () => {
    const records = [
      ...start(),
      completedItem({
        type: 'FileChange',
        id: 'exec-w1',
        status: 'completed',
        changes: {
          'a.ts': { type: 'update', unified_diff: '@@' },
          'b.ts': { type: 'update', unified_diff: '@@', move_path: 'c.ts' },
        },
      }),
      completedItem({
        type: 'FileChange',
        id: 'exec-w2',
        status: 'completed',
        changes: { 'a.ts': { type: 'update', unified_diff: '@@' } },
      }),
      completedItem({
        type: 'FileChange',
        id: 'exec-w3',
        status: 'failed',
        changes: { 'never.ts': { type: 'add', content: '' } },
      }),
    ];
    // a.ts once, b.ts counted as c.ts, the failed patch not at all.
    expect(normalize(records).stats.filesWritten).toBe(2);
  });
});

describe('files written: recorded evidence only, whatever the execution kind', () => {
  function execCommand(callId: string, cmd: string): CodexRolloutRecord {
    return record('response_item', {
      type: 'function_call',
      name: 'exec_command',
      arguments: JSON.stringify({ cmd }),
      call_id: callId,
    });
  }

  function output(callId: string, exitCode: number): CodexRolloutRecord {
    return record('response_item', {
      type: 'function_call_output',
      call_id: callId,
      output: `Process exited with code ${exitCode}\nOutput:\n`,
    });
  }

  it('counts a completed patch execution with its recorded writes', () => {
    const records = [
      ...start(),
      completedItem({
        type: 'FileChange',
        id: 'exec-p',
        status: 'completed',
        changes: { 'src/a.ts': { type: 'update', unified_diff: '@@' } },
      }),
    ];
    const session = normalize(records);
    expect(byId(session.executions, 'exec-p')).toMatchObject({
      kind: 'patch',
      status: 'completed',
      fileChangeStatus: 'completed',
    });
    expect(session.stats.filesWritten).toBe(1);
  });

  it('counts the file change Codex recorded for a command, which stays a command', () => {
    const records = [
      ...start(),
      execCommand('call_cmd', "apply_patch <<'EOF'\n...\nEOF && npm test"),
      // The harness recorded the patch the command ran under the command's id.
      completedItem({
        type: 'FileChange',
        id: 'call_cmd',
        status: 'completed',
        changes: {
          'src/a.ts': { type: 'update', unified_diff: '@@' },
          'src/b.ts': { type: 'delete', content: 'x' },
        },
      }),
      // The command itself failed after the patch was applied.
      output('call_cmd', 1),
    ];
    const session = normalize(records);
    const exec = byId(session.executions, 'call_cmd');
    expect(exec).toMatchObject({
      kind: 'command',
      status: 'failed',
      exitCode: 1,
      fileChangeStatus: 'completed',
      fileWrites: [
        { path: 'src/a.ts', change: 'update' },
        { path: 'src/b.ts', change: 'delete' },
      ],
    });
    // The record evidences the writes, not the command's own outcome.
    expect(exec.evidence.fileChange).toMatchObject({
      kind: 'item',
      recordType: 'item_completed/FileChange',
      recordId: 'call_cmd',
    });
    expect(exec.evidence.result).toMatchObject({ kind: 'output' });
    expect(session.stats.filesWritten).toBe(2);
  });

  it('counts a legacy patch_apply_end recorded for a shell call', () => {
    const records = [
      ...start(),
      record('response_item', {
        type: 'function_call',
        name: 'shell',
        arguments: JSON.stringify({ command: ['bash', '-lc', 'apply_patch <<EOF\n...\nEOF'] }),
        call_id: 'call_shell',
      }),
      record('event_msg', {
        type: 'patch_apply_end',
        call_id: 'call_shell',
        turn_id: TURN,
        success: true,
        changes: { 'docs/x.md': { type: 'add', content: 'x' } },
      }),
    ];
    const session = normalize(records);
    expect(byId(session.executions, 'call_shell')).toMatchObject({
      kind: 'command',
      fileChangeStatus: 'completed',
    });
    expect(session.stats.filesWritten).toBe(1);
  });

  it('does not count a recorded file change that failed or was declined', () => {
    const records = [
      ...start(),
      execCommand('call_bad', 'apply_patch <<EOF ... EOF'),
      completedItem({
        type: 'FileChange',
        id: 'call_bad',
        status: 'failed',
        changes: { 'src/a.ts': { type: 'update', unified_diff: '@@' } },
      }),
      output('call_bad', 0),
      completedItem({
        type: 'FileChange',
        id: 'exec-declined',
        status: 'declined',
        changes: { 'src/b.ts': { type: 'add', content: '' } },
      }),
    ];
    const session = normalize(records);
    expect(byId(session.executions, 'call_bad').fileChangeStatus).toBe('failed');
    expect(byId(session.executions, 'exec-declined').fileChangeStatus).toBe('declined');
    expect(session.stats.filesWritten).toBe(0);
  });

  it('never infers a write from command text', () => {
    const records = [
      ...start(),
      execCommand('call_echo', 'echo foo > bar.txt && sed -i s/a/b/ c.txt && mv d e && rm f'),
      output('call_echo', 0),
    ];
    const session = normalize(records);
    const exec = byId(session.executions, 'call_echo');
    expect(exec.status).toBe('completed');
    expect(exec.fileWrites).toBeUndefined();
    expect(exec.fileChangeStatus).toBeUndefined();
    expect(session.stats.filesWritten).toBe(0);
  });

  it('does not count a patch found only in a cell script', () => {
    const patch = '*** Begin Patch\n*** Add File: x.ts\n+1\n*** End Patch';
    const records = [
      ...start(),
      record('response_item', {
        type: 'custom_tool_call',
        status: 'completed',
        call_id: 'call_cell',
        name: 'exec',
        input: `await tools.apply_patch(${JSON.stringify(patch)});`,
      }),
    ];
    const session = normalize(records);
    const [child] = byId(session.executions, 'call_cell').children ?? [];
    expect(child).toMatchObject({ kind: 'patch', status: 'unknown' });
    expect(child.fileWrites).toEqual([{ path: 'x.ts', change: 'add' }]);
    expect(session.stats.filesWritten).toBe(0);
  });
});
