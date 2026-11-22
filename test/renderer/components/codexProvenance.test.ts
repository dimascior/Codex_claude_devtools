/**
 * Provenance section of the Codex execution details: the viewer's id, the
 * provider records (type, provider id, rollout line), the script call site and
 * the correlation methods, shown exactly as the evidence records them.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { normalizeCodexRollout } from '../../../src/main/providers/codex/CodexExecutionNormalizer';
import { parseRolloutLine } from '../../../src/main/providers/codex/CodexRolloutParser';
import { CodexExecutionDetails } from '../../../src/renderer/components/codex/CodexExecutionDetails';
import {
  buildProvenance,
  CORRELATION_EXPLANATIONS,
  provenanceClass,
} from '../../../src/renderer/components/codex/codexProvenanceModel';

import type { Execution, RecordEvidence } from '../../../src/main/domain';
import type { CodexRolloutRecord } from '../../../src/main/providers/codex/types';

const REAL_OBSERVED = path.join(__dirname, '../../../tests/fixtures/codex/real-observed');
const TURN = '01a0e10c-ff5d-7041-9ea4-020b24daee93';
const MERGED_ITEM = 'exec-00000000-0000-4000-8000-000000000001';
const LOOSE_ITEM = 'exec-00000000-0000-4000-8000-000000000002';

let line = 0;

function record(type: string, payload: Record<string, unknown>): CodexRolloutRecord {
  line++;
  return {
    lineNumber: line,
    ordinal: line - 1,
    timestamp: new Date(Date.UTC(2026, 8, 28, 9, 0, line)).toISOString(),
    type,
    payload,
  };
}

function commandItem(id: string, command: string): CodexRolloutRecord {
  return record('event_msg', {
    type: 'item_completed',
    thread_id: 'thread',
    turn_id: TURN,
    item: {
      type: 'CommandExecution',
      id,
      command: ['bash', '-lc', command],
      cwd: '/work/app',
      status: 'completed',
      exit_code: 0,
      aggregated_output: 'ok',
    },
  });
}

function flatten(list: readonly Execution[]): Execution[] {
  return list.flatMap((exec) => [exec, ...flatten(exec.children ?? [])]);
}

/**
 * A direct command, a direct patch, a code cell with one call site matched to
 * a recorded command and one found only in the script, and an item recorded
 * while no cell was running. Lines: call 3, item 4, output 5; patch 6/7; cell
 * 8, nested item 9, cell output 10; loose item 11.
 */
function synthetic(): Execution[] {
  line = 0;
  const records = [
    record('session_meta', { id: 'thread', cwd: '/work/app', cli_version: '0.158.0' }),
    record('event_msg', { type: 'task_started', turn_id: TURN }),
    record('response_item', {
      type: 'function_call',
      name: 'exec_command',
      call_id: 'call_direct',
      arguments: JSON.stringify({ cmd: 'git status' }),
    }),
    commandItem('call_direct', 'git status'),
    record('response_item', {
      type: 'function_call_output',
      call_id: 'call_direct',
      output: 'Process exited with code 0\nOutput:\nclean',
    }),
    record('response_item', {
      type: 'custom_tool_call',
      status: 'completed',
      call_id: 'call_patch',
      name: 'apply_patch',
      input: '*** Begin Patch\n*** Add File: notes.md\n+hi\n*** End Patch',
    }),
    record('response_item', {
      type: 'custom_tool_call_output',
      call_id: 'call_patch',
      output: 'Exit code: 0\nWall time: 0.1 seconds\nOutput:\nSuccess.',
    }),
    record('response_item', {
      type: 'custom_tool_call',
      status: 'completed',
      call_id: 'call_cell',
      name: 'exec',
      input:
        "await tools.exec_command({ cmd: 'cat README.md' });\nawait tools.exec_command({ cmd: 'ls src' });",
    }),
    commandItem(MERGED_ITEM, 'cat README.md'),
    record('response_item', {
      type: 'custom_tool_call_output',
      call_id: 'call_cell',
      output: [{ type: 'input_text', text: 'Script completed\nWall time: 1.0 seconds\nOutput:\n' }],
    }),
    record('event_msg', {
      type: 'item_completed',
      thread_id: 'thread',
      turn_id: TURN,
      item: {
        type: 'FileChange',
        id: LOOSE_ITEM,
        status: 'completed',
        changes: { 'a.ts': { type: 'update', unified_diff: '@@' } },
      },
    }),
  ];
  return flatten(normalizeCodexRollout(records, { active: false }).executions);
}

function fixture(file: string): Execution[] {
  const records: CodexRolloutRecord[] = [];
  for (const raw of fs.readFileSync(path.join(REAL_OBSERVED, file), 'utf8').split('\n')) {
    if (!raw.trim()) continue;
    const entry = JSON.parse(raw) as Record<string, unknown>;
    if (typeof entry.type !== 'string' || typeof entry.line !== 'number') continue;
    // Transcript lines carry the real line number and size next to the record.
    const rest = Object.fromEntries(
      Object.entries(entry).filter(([key]) => key !== 'line' && key !== 'bytes')
    );
    const parsed = parseRolloutLine(JSON.stringify(rest), entry.line);
    if (parsed) records.push(parsed);
  }
  return flatten(normalizeCodexRollout(records, { active: false }).executions);
}

function find(list: readonly Execution[], id: string): Execution {
  const found = list.find((exec) => exec.id === id);
  if (!found) throw new Error(`execution ${id} not found`);
  return found;
}

/** Provenance rows as "Group / Label" → value. */
function rows(exec: Execution): Record<string, string> {
  const out: Record<string, string> = {};
  for (const group of buildProvenance(exec)) {
    for (const row of group.rows) out[`${group.title} / ${row.label}`] = row.value;
  }
  return out;
}

function row(exec: Execution, key: string): { note?: string; detail?: string; value: string } {
  const [title, label] = key.split(' / ');
  const found = buildProvenance(exec)
    .find((group) => group.title === title)
    ?.rows.find((candidate) => candidate.label === label);
  if (!found) throw new Error(`no row ${key}`);
  return found;
}

/** The record a provenance group describes. */
function recordOf(exec: Execution, title: string): RecordEvidence | undefined {
  if (title === 'Observed record') return exec.evidence.observed;
  if (title === 'Result record') return exec.evidence.result;
  return undefined;
}

function html(exec: Execution): string {
  return renderToStaticMarkup(createElement(CodexExecutionDetails, { execution: exec }));
}

const executions = synthetic();
const merged = find(executions, 'call_cell:1');
const scriptOnly = find(executions, 'call_cell:2');
const direct = find(executions, 'call_direct');
const patch = find(executions, 'call_patch');
const cell = find(executions, 'call_cell');
const loose = find(executions, LOOSE_ITEM);

describe('execution provenance: identities', () => {
  it('shows the provider item id apart from the domain id of a matched call site', () => {
    expect(rows(merged)).toMatchObject({
      'Execution / Domain ID': 'call_cell:1',
      'Execution / Parent': 'call_cell',
      'Observed record / Record type': 'item_completed/CommandExecution',
      'Observed record / Provider item ID': MERGED_ITEM,
      'Observed record / Rollout line': '9',
      'Result record / Record': 'the observed record',
    });
    // The domain id is not presented as a provider id.
    expect(row(merged, 'Execution / Domain ID').note).toBeUndefined();
    expect(Object.values(rows(merged)).filter((value) => value === 'call_cell:1')).toHaveLength(1);
  });

  it('shows the result record with its own type, provider id and rollout line', () => {
    expect(rows(direct)).toMatchObject({
      'Execution / Domain ID': 'call_direct',
      'Observed record / Record type': 'function_call',
      'Observed record / Provider call ID': 'call_direct',
      'Observed record / Rollout line': '3',
      'Result record / Record type': 'item_completed/CommandExecution',
      'Result record / Provider item ID': 'call_direct',
      'Result record / Rollout line': '4',
    });
    expect(row(direct, 'Execution / Domain ID').note).toBe('same as the provider ID below');
    expect(rows(patch)).toMatchObject({
      'Observed record / Record type': 'custom_tool_call',
      'Observed record / Rollout line': '6',
      'Result record / Record type': 'custom_tool_call_output',
      'Result record / Provider call ID': 'call_patch',
      'Result record / Rollout line': '7',
    });
    expect(rows(cell)).toMatchObject({
      'Observed record / Record type': 'custom_tool_call',
      'Observed record / Rollout line': '8',
      'Result record / Record type': 'custom_tool_call_output',
      'Result record / Rollout line': '10',
    });
  });

  it('gives a script-only operation no provider identity at all', () => {
    const shown = rows(scriptOnly);
    expect(shown).toMatchObject({
      'Execution / Domain ID': 'call_cell:2',
      'Provider records / Records': 'none: Codex recorded nothing for this operation',
      'Script call site / Cell': 'call_cell',
      'Script call site / Script line': '2',
      'Script call site / Dynamic arguments': 'no',
    });
    expect(
      Object.keys(shown).filter((key) => /Provider (item|call) ID|Record type/.test(key))
    ).toEqual([]);
    expect(provenanceClass(scriptOnly).label).toBe('Script-derived only');
    const markup = html(scriptOnly);
    expect(markup).not.toContain('Provider item ID');
    expect(markup).not.toContain('Provider call ID');
    expect(markup).toContain('Script-derived only');
  });
});

describe('execution provenance: correlation methods', () => {
  it('shows content and turn_window for a call site matched to a recorded command', () => {
    expect(rows(merged)).toMatchObject({
      'Script call site / Cell': 'call_cell',
      'Script call site / Script line': '1',
      'Correlation / Cell attribution': 'turn_window',
      'Correlation / Call-site match': 'content',
    });
    expect(row(merged, 'Correlation / Cell attribution').note).toBe(
      CORRELATION_EXPLANATIONS.turn_window
    );
    expect(row(merged, 'Correlation / Call-site match').note).toBe(
      CORRELATION_EXPLANATIONS.content
    );
    expect(provenanceClass(merged).label).toBe('Recorded + script-correlated');
  });

  it('keeps an unattributed item unresolved, with the reason the parser gave', () => {
    const attribution = row(loose, 'Correlation / Attribution');
    expect(attribution.value).toBe('unresolved');
    expect(attribution.note).toBe('No defensible relationship could be established.');
    expect(attribution.detail).toBe(loose.evidence.cellLink?.detail);
    expect(rows(loose)).toMatchObject({
      'Execution / Domain ID': LOOSE_ITEM,
      'Observed record / Record type': 'item_completed/FileChange',
      'Observed record / Provider item ID': LOOSE_ITEM,
      'Observed record / Rollout line': '11',
    });
  });

  it('adds no correlation where the records only share their id', () => {
    for (const exec of [direct, patch, cell]) {
      expect(buildProvenance(exec).map((group) => group.title)).not.toContain('Correlation');
      expect(provenanceClass(exec).label).toBe('Recorded by Codex');
    }
  });
});

describe('execution provenance: real-observed records', () => {
  const windows = fixture('current-code-mode-correlation-windows.jsonl');
  const search = fixture('hosted-web-search-windows.jsonl');

  it('shows turn_window for an item attributed to the only running cell', () => {
    const child = find(windows, 'exec-581175f1-6654-4eef-8807-4f020205afd0');
    expect(rows(child)).toMatchObject({
      'Execution / Domain ID': 'exec-581175f1-6654-4eef-8807-4f020205afd0',
      'Execution / Parent': 'call_XVTNeYnfQiqE7096yB40xIkM',
      'Observed record / Provider item ID': 'exec-581175f1-6654-4eef-8807-4f020205afd0',
      'Observed record / Rollout line': '64502',
      'Correlation / Cell attribution': 'turn_window',
    });
  });

  it('shows explicit_id for a hosted search item linked to its call', () => {
    const linked = search.find((exec) => exec.evidence.cellLink?.method === 'explicit_id');
    expect(linked).toBeDefined();
    const attribution = row(linked!, 'Correlation / Attribution');
    expect(attribution.value).toBe('explicit_id');
    expect(attribution.note).toBe('Provider records share an identifier.');
    expect(rows(linked!)).toMatchObject({
      'Observed record / Record type': 'web_search_call',
      'Result record / Record type': 'item_completed/WebSearch',
      'Result record / Provider item ID': linked!.evidence.result?.recordId,
    });
  });

  it('shows an MCP call and its item by their shared id, without inventing a link', () => {
    const mcp = find(windows, 'call_PICM3TMuuzYTRWwJCTl7h7tr');
    expect(rows(mcp)).toMatchObject({
      'Observed record / Record type': 'function_call',
      'Observed record / Provider call ID': 'call_PICM3TMuuzYTRWwJCTl7h7tr',
      'Result record / Record type': 'item_completed/McpToolCall',
      'Result record / Provider item ID': 'call_PICM3TMuuzYTRWwJCTl7h7tr',
      'Result record / Rollout line': '26',
    });
    expect(buildProvenance(mcp).map((group) => group.title)).not.toContain('Correlation');
  });

  it('keeps real unresolved items unresolved', () => {
    const unresolved = find(windows, 'exec-2d4ed089-bcd1-4e41-b960-86b56a7551b3');
    expect(rows(unresolved)['Correlation / Attribution']).toBe('unresolved');
  });
});

describe('execution provenance: labels', () => {
  const all = [
    ...executions,
    ...fixture('current-code-mode-correlation-windows.jsonl'),
    ...fixture('hosted-web-search-windows.jsonl'),
  ];

  it('labels an id "Provider item ID" only on item records, and never uses the old labels', () => {
    for (const exec of all) {
      for (const group of buildProvenance(exec)) {
        const record = recordOf(exec, group.title);
        for (const shown of group.rows) {
          if (shown.label === 'Provider item ID') expect(record?.kind).toBe('item');
          if (shown.label === 'Provider call ID') expect(record?.kind).not.toBe('item');
        }
      }
      const markup = html(exec);
      expect(markup).not.toContain('Item id');
      expect(markup).not.toContain('Call id');
    }
  });

  it('renders the provenance section in the details, with every method as recorded', () => {
    const markup = html(merged);
    expect(markup).toContain('aria-label="Provenance"');
    expect(markup).toContain('Recorded + script-correlated');
    expect(markup).toContain(MERGED_ITEM);
    expect(markup).toContain('turn_window');
    expect(markup).toContain('content');
  });
});

describe('execution details: files written', () => {
  function commandWithFileChange(status: string): Execution {
    line = 0;
    const records = [
      record('session_meta', { id: 'thread', cwd: '/work/app' }),
      record('event_msg', { type: 'task_started', turn_id: TURN }),
      record('response_item', {
        type: 'function_call',
        name: 'exec_command',
        arguments: JSON.stringify({ cmd: 'apply_patch <<EOF ... EOF' }),
        call_id: 'call_cmd',
      }),
      record('event_msg', {
        type: 'item_completed',
        thread_id: 'thread',
        turn_id: TURN,
        item: {
          type: 'FileChange',
          id: 'call_cmd',
          status,
          changes: { 'src/a.ts': { type: 'update', unified_diff: '@@' } },
        },
      }),
      record('response_item', {
        type: 'function_call_output',
        call_id: 'call_cmd',
        output: 'Process exited with code 0\nOutput:\n',
      }),
    ];
    return find(normalizeCodexRollout(records, { active: false }).executions, 'call_cmd');
  }

  it('shows the files Codex recorded for a command, and the record behind them', () => {
    const exec = commandWithFileChange('completed');
    const text = html(exec);
    expect(text).toContain('Files written');
    expect(text).toContain('Codex recorded a file change for this execution');
    expect(rows(exec)).toMatchObject({
      'File change record / Record type': 'item_completed/FileChange',
      'File change record / Rollout line': '4',
      'Result record / Record type': 'function_call_output',
    });
  });

  it('does not call the files of a failed file change written', () => {
    const text = html(commandWithFileChange('failed'));
    expect(text).toContain('Patch files');
    expect(text).toContain('Not recorded as written (failed)');
    expect(text).not.toContain('Files written');
  });
});

describe('execution details: recorded changes', () => {
  const DIFF = '@@ -1,2 +1,2 @@\n-const a = 1;\n+const a = 2;\n const b = 3;';

  function recordedPatch(status: string, changes: Record<string, unknown>): Execution {
    line = 0;
    const records = [
      record('session_meta', { id: 'thread', cwd: '/work/app' }),
      record('event_msg', { type: 'task_started', turn_id: TURN }),
      record('event_msg', {
        type: 'item_completed',
        thread_id: 'thread',
        turn_id: TURN,
        item: { type: 'FileChange', id: LOOSE_ITEM, status, changes },
      }),
    ];
    return find(normalizeCodexRollout(records, { active: false }).executions, LOOSE_ITEM);
  }

  it("shows each file's change as the file-change record carries it", () => {
    const text = html(
      recordedPatch('completed', {
        'src/a.ts': { type: 'update', unified_diff: DIFF },
        'docs/new.md': { type: 'add', content: '# New' },
      })
    );
    expect(text).toContain('Recorded changes');
    expect(text).toContain('as Codex recorded them: item_completed/FileChange, line 3');
    expect(text).toContain('unified diff');
    expect(text).toContain('+const a = 2;');
    expect(text).toContain('-const a = 1;');
    expect(text).toContain('docs/new.md (added)');
    expect(text).toContain('file content');
    expect(text).toContain('# New');
    expect(text).not.toContain('Not recorded as written');
  });

  it('says when the change was not written, and how much was not loaded', () => {
    const exec = recordedPatch('failed', { 'src/a.ts': { type: 'update', unified_diff: DIFF } });
    const [write] = exec.fileWrites ?? [];
    const cut: Execution = {
      ...exec,
      fileWrites: [{ ...write, diff: { field: 'unified_diff', text: DIFF, omittedChars: 1234 } }],
    };
    const text = html(cut);
    // The recorded changes carry the outcome themselves, not only the facts grid.
    const section = text.slice(text.indexOf('aria-label="Recorded changes"'));
    expect(section).toContain('Recorded changes');
    expect(section).toContain('Not recorded as written (failed)');
    expect(section).toContain('… 1,234 characters more recorded, not loaded (size limit)');
  });

  it('shows nothing when the record carries no change text', () => {
    const text = html(recordedPatch('completed', { 'src/a.ts': { type: 'update' } }));
    expect(text).toContain('Files written');
    expect(text).not.toContain('Recorded changes');
  });

  it('shows the patch of a call with patch text of its own, not recorded changes', () => {
    expect(patch.input).toBeDefined();
    const withDiff: Execution = {
      ...patch,
      fileWrites: [
        { path: 'src/a.ts', change: 'update', diff: { field: 'unified_diff', text: DIFF } },
      ],
    };
    const text = html(withDiff);
    expect(text).not.toContain('Recorded changes');
    expect(text).not.toContain('+const a = 2;');
  });
});
