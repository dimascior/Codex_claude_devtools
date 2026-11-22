/**
 * Timeline rows: every file write Codex recorded is an entry of its own,
 * placed by the line of its record, with its changes visible without
 * expanding anything; code cells keep their other nested operations.
 * Records are synthetic, in the shapes Codex persists.
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { normalizeCodexRollout } from '../../../src/main/providers/codex/CodexExecutionNormalizer';
import { CodexExecutionCard } from '../../../src/renderer/components/codex/CodexExecutionCard';
import { CodexFileWriteCard } from '../../../src/renderer/components/codex/CodexFileWriteCard';
import {
  buildTimelineRows,
  type CodexFileWriteRow,
  type CodexTimelineRow,
  filterTimelineRows,
} from '../../../src/renderer/components/codex/codexTimelineRows';

import type { Execution, TimelineEntry } from '../../../src/main/domain';
import type { CodexRolloutRecord } from '../../../src/main/providers/codex/types';

const TURN = '01a0f200-0000-7000-8000-0000000000cc';
const NESTED_WRITE = 'exec-00000000-0000-4000-8000-0000000000a1';
const NESTED_COMMAND = 'exec-00000000-0000-4000-8000-0000000000a2';
const LOOSE_WRITE = 'exec-00000000-0000-4000-8000-0000000000a3';
const DIFF = '@@ -1,2 +1,2 @@\n-const a = 1;\n+const a = 2;\n const b = 3;\n';

let line = 0;

function record(type: string, payload: Record<string, unknown>): CodexRolloutRecord {
  line++;
  return {
    lineNumber: line,
    ordinal: line - 1,
    timestamp: new Date(Date.UTC(2026, 8, 30, 9, 0, line)).toISOString(),
    type,
    payload,
  };
}

function item(payload: Record<string, unknown>): CodexRolloutRecord {
  return record('event_msg', {
    type: 'item_completed',
    thread_id: 'thread',
    turn_id: TURN,
    item: payload,
  });
}

/**
 * Lines: 3 request; 4 exec cell (apply_patch + npm test); 5 FileChange while
 * it runs; 6 CommandExecution (npm test); 7 cell output; 8 agent message;
 * 9 FileChange with no cell running; 10 shell call running a patch; 11 its
 * FileChange (same id); 12 its output (exit 1).
 */
function session(nestedWriteStatus = 'completed'): TimelineEntry[] {
  line = 0;
  const records = [
    record('session_meta', { id: 'thread', cwd: '/work/app', cli_version: '0.158.0' }),
    record('event_msg', { type: 'task_started', turn_id: TURN }),
    record('event_msg', { type: 'user_message', message: 'Bump a and run the tests.' }),
    record('response_item', {
      type: 'custom_tool_call',
      status: 'completed',
      call_id: 'call_cell',
      name: 'exec',
      input: "await tools.apply_patch(patch);\nawait tools.exec_command({ cmd: 'npm test' });",
    }),
    item({
      type: 'FileChange',
      id: NESTED_WRITE,
      status: nestedWriteStatus,
      changes: { 'src/a.ts': { type: 'update', unified_diff: DIFF } },
    }),
    item({
      type: 'CommandExecution',
      id: NESTED_COMMAND,
      command: ['bash', '-lc', 'npm test'],
      cwd: '/work/app',
      status: 'completed',
      exit_code: 0,
      aggregated_output: 'ok',
    }),
    record('response_item', {
      type: 'custom_tool_call_output',
      call_id: 'call_cell',
      output: [{ type: 'input_text', text: 'Script completed\nWall time: 1.0 seconds\nOutput:\n' }],
    }),
    record('event_msg', { type: 'agent_message', message: 'Done.' }),
    item({
      type: 'FileChange',
      id: LOOSE_WRITE,
      status: 'completed',
      changes: { 'docs/notes.md': { type: 'add', content: '# Notes\n' } },
    }),
    record('response_item', {
      type: 'function_call',
      name: 'exec_command',
      arguments: JSON.stringify({ cmd: "apply_patch <<'EOF'\n...\nEOF && npm test" }),
      call_id: 'call_cmd',
    }),
    item({
      type: 'FileChange',
      id: 'call_cmd',
      status: 'completed',
      changes: { 'src/b.ts': { type: 'delete', content: 'old\n' } },
    }),
    record('response_item', {
      type: 'function_call_output',
      call_id: 'call_cmd',
      output: 'Process exited with code 1\nOutput:\n',
    }),
  ];
  return normalizeCodexRollout(records, { active: false }).timeline;
}

/** `exec:<id>` for executions, `<source>:<id>@<line>` for file writes, `<kind>@<line>` otherwise. */
function keys(rows: readonly CodexTimelineRow[]): string[] {
  return rows.map((row) => {
    if (row.kind === 'file_write') {
      return `${row.source}:${row.execution.id}@${row.lineNumber}`;
    }
    return row.entry.kind === 'execution'
      ? `exec:${row.entry.execution.id}`
      : `${row.entry.kind}@${row.lineNumber}`;
  });
}

function position(order: readonly string[], key: string): number {
  const index = order.indexOf(key);
  if (index < 0) throw new Error(`${key} is not among ${order.join(', ')}`);
  return index;
}

function writeRow(rows: readonly CodexTimelineRow[], id: string): CodexFileWriteRow {
  const found = rows.find(
    (row): row is CodexFileWriteRow => row.kind === 'file_write' && row.execution.id === id
  );
  if (!found) throw new Error(`no file-write row for ${id}`);
  return found;
}

function cellOf(timeline: readonly TimelineEntry[]): Execution {
  const entry = timeline.find(
    (candidate) => candidate.kind === 'execution' && candidate.execution.id === 'call_cell'
  );
  if (entry?.kind !== 'execution') throw new Error('cell not found');
  return entry.execution;
}

describe('timeline rows: file writes as entries of their own', () => {
  it('places each recorded write by the line of its record, apart from its cell', () => {
    const rows = buildTimelineRows(session());
    const order = keys(rows);
    const at = (key: string): number => position(order, key);
    // The write recorded while the cell ran follows the cell and precedes later entries.
    expect(at('exec:call_cell')).toBeLessThan(at(`patch:${NESTED_WRITE}@5`));
    expect(at(`patch:${NESTED_WRITE}@5`)).toBeLessThan(at('agent_message@8'));
    expect(at('agent_message@8')).toBeLessThan(at(`patch:${LOOSE_WRITE}@9`));
    // A file change recorded for a shell call is a row of its own, after the call.
    expect(at(`patch:${LOOSE_WRITE}@9`)).toBeLessThan(at('exec:call_cmd'));
    expect(at('exec:call_cmd')).toBeLessThan(at('file_change:call_cmd@11'));
    expect(writeRow(rows, NESTED_WRITE).cell?.id).toBe('call_cell');
    expect(writeRow(rows, LOOSE_WRITE).cell).toBeUndefined();
  });

  it('shows a write entry in place, once', () => {
    const rows = buildTimelineRows(session());
    const loose = rows.filter(
      (row) =>
        (row.kind === 'file_write' && row.execution.id === LOOSE_WRITE) ||
        (row.kind === 'entry' &&
          row.entry.kind === 'execution' &&
          row.entry.execution.id === LOOSE_WRITE)
    );
    expect(loose).toHaveLength(1);
    expect(loose[0]).toMatchObject({ kind: 'file_write', source: 'patch', lineNumber: 9 });
  });

  it('keeps the recorded write under its cell in the domain; only the rows differ', () => {
    const timeline = session();
    const children = cellOf(timeline).children ?? [];
    expect(children.map((child) => child.id)).toContain(NESTED_WRITE);
  });

  it('never places a write before the entry it came from', () => {
    const write: Execution = {
      id: 'w',
      provider: 'codex',
      kind: 'patch',
      source: 'item_completed/FileChange',
      name: 'apply_patch',
      status: 'completed',
      timestamp: '',
      lineNumber: 3,
      evidence: {
        observed: { kind: 'item', recordType: 'item_completed/FileChange', lineNumber: 3 },
        result: { kind: 'item', recordType: 'item_completed/FileChange', lineNumber: 3 },
      },
    };
    const cell: Execution = {
      ...write,
      id: 'c',
      kind: 'code_cell',
      name: 'exec',
      lineNumber: 7,
      children: [write],
      evidence: {},
    };
    const timeline: TimelineEntry[] = [
      { kind: 'agent_message', id: 'm', lineNumber: 5, text: 'x' },
      { kind: 'execution', id: 'c', lineNumber: 7, execution: cell },
      { kind: 'agent_message', id: 'n', lineNumber: 9, text: 'y' },
    ];
    expect(keys(buildTimelineRows(timeline))).toEqual([
      'agent_message@5',
      'exec:c',
      'patch:w@3',
      'agent_message@9',
    ]);
  });
});

describe('timeline rows: filters', () => {
  it('lists file writes with executions', () => {
    const rows = filterTimelineRows(buildTimelineRows(session()), 'executions');
    expect(rows.filter((row) => row.kind === 'file_write')).toHaveLength(3);
    expect(rows.every((row) => row.kind === 'file_write' || row.entry.kind === 'execution')).toBe(
      true
    );
  });

  it('shows a failed write as the problem, not the cell it was recorded under', () => {
    const problems = keys(filterTimelineRows(buildTimelineRows(session('failed')), 'problems'));
    expect(problems).toContain(`patch:${NESTED_WRITE}@5`);
    expect(problems).not.toContain('exec:call_cell');
    // The shell call failed (exit 1); its file change completed.
    expect(problems).toContain('exec:call_cmd');
    expect(problems).not.toContain('file_change:call_cmd@11');
    // Without the failure, neither the cell nor the write is a problem.
    const fine = keys(filterTimelineRows(buildTimelineRows(session()), 'problems'));
    expect(fine).not.toContain('exec:call_cell');
    expect(fine).not.toContain(`patch:${NESTED_WRITE}@5`);
  });

  it('keeps a cell whose remaining nested operation failed', () => {
    const failing: Execution = {
      id: 'c',
      provider: 'codex',
      kind: 'code_cell',
      source: 'custom_tool_call',
      name: 'exec',
      status: 'completed',
      timestamp: '',
      lineNumber: 2,
      evidence: {},
      children: [
        {
          id: 'c:1',
          provider: 'codex',
          kind: 'command',
          source: 'cell_script',
          name: 'exec_command',
          status: 'failed',
          timestamp: '',
          lineNumber: 2,
          evidence: {},
        },
      ],
    };
    const rows = buildTimelineRows([
      { kind: 'execution', id: 'c', lineNumber: 2, execution: failing },
    ]);
    expect(keys(filterTimelineRows(rows, 'problems'))).toEqual(['exec:c']);
  });
});

describe('file-write card and cell tree', () => {
  it("shows a write's changes without expanding it, and the cell it was recorded under", () => {
    const html = renderToStaticMarkup(
      createElement(CodexFileWriteCard, {
        row: writeRow(buildTimelineRows(session()), NESTED_WRITE),
      })
    );
    expect(html).toContain('file write');
    expect(html).toContain('src/a.ts');
    expect(html).toContain('+const a = 2;');
    expect(html).toContain('-const a = 1;');
    expect(html).toContain('recorded while exec cell');
    expect(html).toContain('attributed by turn and record order, no shared id');
  });

  it('previews long changes and offers the rest', () => {
    const long = [
      '@@ -1,30 +1,30 @@',
      ...Array.from({ length: 29 }, (_, n) => `+line ${n + 1}`),
    ].join('\n');
    const row = writeRow(buildTimelineRows(session()), NESTED_WRITE);
    const [write] = row.execution.fileWrites ?? [];
    const html = renderToStaticMarkup(
      createElement(CodexFileWriteCard, {
        row: {
          ...row,
          execution: {
            ...row.execution,
            fileWrites: [{ ...write, diff: { field: 'unified_diff', text: long } }],
          },
        },
      })
    );
    expect(html).toContain('+line 19');
    expect(html).not.toContain('+line 20');
    expect(html).toContain('Show all 30 lines');
  });

  it("shows a command's file change with the change's own outcome", () => {
    const row = writeRow(buildTimelineRows(session()), 'call_cmd');
    expect(row.source).toBe('file_change');
    const html = renderToStaticMarkup(createElement(CodexFileWriteCard, { row }));
    expect(html).toContain('recorded for exec_command');
    expect(html).toContain('item_completed/FileChange, line 11');
    expect(html).toContain('src/b.ts (deleted)');
    expect(html).toContain('old');
    // The command exited 1; the file change completed.
    expect(html).toContain('done');
    expect(html).not.toContain('exit 1');
    // Its details are the command's own card.
    expect(html).not.toContain('aria-expanded');
  });

  it('keeps the other nested operations in the cell and counts the separate write', () => {
    const html = renderToStaticMarkup(
      createElement(CodexExecutionCard, { execution: cellOf(session()) })
    );
    expect(html).toContain('npm test');
    expect(html).toContain('1 file write recorded while this cell ran is a separate entry');
    expect(html).not.toContain('src/a.ts');
    // The script's own apply_patch call site stays, named by its tool, not as a write.
    expect(html).toContain('>apply_patch<');
    expect(html).not.toContain('>file write<');
  });
});
