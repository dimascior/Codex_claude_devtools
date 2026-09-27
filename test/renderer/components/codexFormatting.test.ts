import { describe, expect, it } from 'vitest';

import {
  describeEvidence,
  durationSourceLabel,
  evidenceBadge,
  executionSummary,
  filterTimeline,
  formatRelativeTime,
  shortCallId,
  statusLabel,
} from '../../../src/renderer/components/codex/codexFormatting';

import type { Execution, TimelineEntry } from '../../../src/main/domain';

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

function entry(id: string, execution: Execution): TimelineEntry {
  return { kind: 'execution', id, lineNumber: execution.lineNumber, execution };
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

  it('filters the timeline to executions and problems', () => {
    const ok = exec({ id: 'ok', lineNumber: 2 });
    const failedChild = exec({
      id: 'cell',
      kind: 'code_cell',
      lineNumber: 3,
      children: [exec({ id: 'cell:1', status: 'failed' })],
    });
    const declined = exec({ id: 'no', status: 'declined', lineNumber: 4 });
    const timeline: TimelineEntry[] = [
      { kind: 'user_message', id: 'u', lineNumber: 1, text: 'hi' },
      entry('x-ok', ok),
      entry('x-cell', failedChild),
      entry('x-no', declined),
      { kind: 'turn_event', id: 't', lineNumber: 5, event: 'aborted', reason: 'interrupted' },
    ];
    expect(filterTimeline(timeline, 'all')).toHaveLength(5);
    expect(filterTimeline(timeline, 'executions').map((e) => e.id)).toEqual([
      'x-ok',
      'x-cell',
      'x-no',
    ]);
    expect(filterTimeline(timeline, 'problems').map((e) => e.id)).toEqual(['x-cell', 'x-no', 't']);
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
    expect(describeEvidence(scriptOnly)).toEqual([
      'Script call site at line 3 of the cell (arguments only known at runtime)',
      'Result: none recorded',
    ]);

    const recorded = exec({
      evidence: { observed: item, result: item, cellLink: { method: 'turn_window' } },
    });
    expect(evidenceBadge(recorded)?.label).toBe('recorded');
    expect(describeEvidence(recorded)).toEqual([
      'Observed: item_completed/FileChange, rollout line 100',
      'Cell link: same turn, only running cell (record order)',
    ]);

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
