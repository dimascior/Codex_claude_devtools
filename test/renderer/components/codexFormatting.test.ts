import { describe, expect, it } from 'vitest';

import {
  classifiedActions,
  commandActionCounts,
  commandActionLabel,
  commandActionTarget,
  describeFileWrite,
  durationSourceLabel,
  evidenceBadge,
  executionLabel,
  executionSummary,
  fileWritesSummary,
  formatRelativeTime,
  shortCallId,
  statusLabel,
} from '../../../src/renderer/components/codex/codexFormatting';

import type { Execution } from '../../../src/main/domain';

function exec(overrides: Partial<Execution>): Execution {
  return {
    id: 'call_abcdef123456',
    provider: 'codex',
    kind: 'command',
    source: 'function_call',
    name: 'exec_command',
    status: 'completed',
    timestamp: '2026-09-27T10:00:00.000Z',
    lineNumber: 1,
    evidence: {},
    ...overrides,
  };
}

describe('codexFormatting', () => {
  it('labels statuses with exit codes when known', () => {
    expect(statusLabel(exec({ exitCode: 0 }))).toBe('exit 0');
    expect(statusLabel(exec({ status: 'failed', exitCode: 101 }))).toBe('exit 101');
    expect(statusLabel(exec({ status: 'unknown' }))).toBe('not recorded');
    expect(
      statusLabel(
        exec({
          status: 'unknown',
          evidence: {
            result: { kind: 'output', recordType: 'custom_tool_call_output', lineNumber: 2 },
          },
        })
      )
    ).toBe('outcome unknown');
    expect(statusLabel(exec({ status: 'declined' }))).toBe('declined');
  });

  it('summarizes code cells by their nested commands', () => {
    const cell = exec({
      kind: 'code_cell',
      name: 'exec',
      children: [
        exec({ id: 'c:1', command: 'git status' }),
        exec({ id: 'c:2', command: 'cargo test' }),
      ],
    });
    expect(executionSummary(cell)).toBe('git status · cargo test');
    expect(
      executionSummary(exec({ kind: 'tool', name: 'view_image', args: { path: '/a.png' } }))
    ).toBe('/a.png');
  });

  it('labels a patch call site found only in a script by its tool, not as a file write', () => {
    const script = { code: { line: 2, dynamic: true } };
    const callSite = exec({
      id: 'cell:1',
      kind: 'patch',
      name: 'apply_patch',
      command: 'apply_patch',
      status: 'unknown',
      evidence: script,
    });
    expect(executionLabel(callSite)).toBe('apply_patch');
    expect(executionSummary(callSite)).toBeUndefined();
    const recorded = exec({
      id: 'exec-1',
      kind: 'patch',
      name: 'apply_patch',
      command: 'apply_patch',
      fileWrites: [{ path: 'src/a.ts', change: 'update' }],
      evidence: {
        observed: { kind: 'item', recordType: 'item_completed/FileChange', lineNumber: 5 },
        result: { kind: 'item', recordType: 'item_completed/FileChange', lineNumber: 5 },
      },
    });
    expect(executionLabel(recorded)).toBe('file write');
    expect(executionSummary(recorded)).toBe('src/a.ts');
    // A cell's summary lists what stays in its tree; recorded writes are entries of their own.
    const cell = exec({
      kind: 'code_cell',
      name: 'exec',
      children: [callSite, recorded, exec({ id: 'cell:2', command: 'npm test' })],
    });
    expect(executionSummary(cell)).toBe('apply_patch · npm test');
  });

  it('formats relative times and short ids', () => {
    const now = Date.parse('2026-09-27T12:00:00Z');
    expect(formatRelativeTime(now - 10_000, now)).toBe('just now');
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5m ago');
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(shortCallId('call_abcdef123456:2')).toBe('ef123456');
  });

  it('labels each evidence class and never presents a script call site as recorded', () => {
    const item = {
      kind: 'item' as const,
      recordType: 'item_completed/FileChange',
      lineNumber: 100,
    };
    const scriptOnly = exec({ status: 'unknown', evidence: { code: { line: 3, dynamic: true } } });
    expect(evidenceBadge(scriptOnly)?.label).toBe('script only');

    const recorded = exec({
      parentId: 'call_cell',
      evidence: { observed: item, result: item, cellLink: { method: 'turn_window' } },
    });
    expect(evidenceBadge(recorded)?.label).toBe('recorded');

    // A top-level item linked to the call recorded after it has no cell.
    const adopted = exec({
      kind: 'web_search',
      evidence: {
        observed: { kind: 'call', recordType: 'web_search_call', lineNumber: 101 },
        result: { kind: 'item', recordType: 'item_completed/WebSearch', lineNumber: 100 },
        cellLink: { method: 'explicit_id', detail: 'linked by web_search_call.id' },
      },
    });
    expect(evidenceBadge(adopted)).toBeUndefined();

    const linked = exec({
      evidence: {
        code: { line: 1, dynamic: false },
        observed: item,
        result: item,
        cellLink: { method: 'turn_window' },
        callSiteLink: { method: 'content', detail: 'Identical command text' },
      },
    });
    expect(evidenceBadge(linked)?.label).toBe('script + record');

    const unlinked = exec({
      evidence: {
        observed: item,
        result: item,
        cellLink: { method: 'unresolved', detail: '2 cells of its turn were running' },
      },
    });
    expect(evidenceBadge(unlinked)).toMatchObject({ label: 'unlinked record' });
    expect(evidenceBadge(unlinked)?.title).toContain('2 cells of its turn were running');

    // Direct calls with their own records need no badge.
    const direct = exec({
      evidence: {
        observed: { kind: 'call', recordType: 'function_call', lineNumber: 1 },
        result: { kind: 'output', recordType: 'function_call_output', lineNumber: 2 },
      },
    });
    expect(evidenceBadge(direct)).toBeUndefined();
  });

  it('names where a duration came from', () => {
    expect(durationSourceLabel('reported')).toBe('reported by Codex');
    expect(durationSourceLabel('provider_timestamps')).toBe('from Codex start and end times');
    expect(durationSourceLabel('record_timestamps')).toBe('between rollout records');
  });
});

describe('file writes and Codex command tags', () => {
  const patch = (fileWrites: Execution['fileWrites']): Execution =>
    exec({ kind: 'patch', name: 'apply_patch', command: 'apply_patch', fileWrites });

  it('labels patches as file writes and summarizes the files', () => {
    const written = patch([
      { path: 'src/new.ts', change: 'add' },
      { path: 'src/a.ts', change: 'update' },
    ]);
    expect(executionLabel(written)).toBe('file write');
    expect(executionSummary(written)).toBe('src/new.ts (added), src/a.ts');
    // Nothing known about the files: the recorded tool name stays.
    expect(executionSummary(patch([]))).toBe('apply_patch');
  });

  it('describes each change and shortens long lists', () => {
    expect(describeFileWrite({ path: 'a.ts', change: 'delete' })).toBe('a.ts (deleted)');
    expect(describeFileWrite({ path: 'a.ts', change: 'update', movedTo: 'b.ts' })).toBe(
      'a.ts → b.ts'
    );
    expect(describeFileWrite({ path: 'a.ts' })).toBe('a.ts');
    expect(
      fileWritesSummary([{ path: 'a' }, { path: 'b' }, { path: 'c' }, { path: 'd', change: 'add' }])
    ).toBe('4 files: a, b, c, …');
    expect(fileWritesSummary([])).toBeUndefined();
  });

  it('labels Codex command actions with what they are about', () => {
    expect(commandActionLabel({ type: 'list_files' })).toBe('list');
    expect(commandActionLabel({ type: 'unknown' })).toBe('unclassified');
    expect(commandActionLabel({ type: 'write' })).toBe('write');
    expect(commandActionTarget({ type: 'read', name: 'a.ts', path: '/w/src/a.ts' })).toBe('a.ts');
    expect(commandActionTarget({ type: 'read', path: '/w/src/a.ts' })).toBe('/w/src/a.ts');
    expect(commandActionTarget({ type: 'search', query: 'foo', path: 'src' })).toBe('"foo" in src');
    expect(commandActionTarget({ type: 'search', path: 'src' })).toBe('src');
    expect(commandActionTarget({ type: 'list_files', path: 'docs' })).toBe('docs');
    expect(commandActionTarget({ type: 'unknown', command: 'make' })).toBeUndefined();
  });

  it('tags only the actions Codex could classify', () => {
    const command = exec({
      commandActions: [
        { type: 'read', name: 'a.ts' },
        { type: 'unknown', command: 'make' },
      ],
    });
    expect(classifiedActions(command)).toEqual([{ type: 'read', name: 'a.ts' }]);
    expect(classifiedActions(exec({}))).toEqual([]);
  });

  it('summarizes the session counts', () => {
    expect(commandActionCounts({ read: 3, search: 1, list_files: 2 })).toBe(
      '3 reads · 1 search · 2 listings'
    );
    expect(commandActionCounts({ read: 1, write: 2 })).toBe('1 read · 2 write');
    expect(commandActionCounts({})).toBeUndefined();
  });
});
