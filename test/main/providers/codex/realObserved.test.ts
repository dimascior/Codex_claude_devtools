/**
 * Regression tests on sanitized records from real Codex rollouts
 * (tests/fixtures/codex/real-observed, see docs/codex-real-validation).
 *
 * The fixtures are sanitized transcripts: strings outside a structural
 * allowlist are replaced by `<string:N>`, so commands, script sources and
 * outputs are unavailable. What they preserve (record order, line numbers,
 * ordinals, ids, turn ids, statuses, timings) is exactly what the parser may
 * rely on to link records, so these tests pin down that linkage.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, describe, expect, it } from 'vitest';

import { parseCodexEvent } from '../../../../src/main/providers/codex/CodexEventParser';
import { normalizeCodexRollout } from '../../../../src/main/providers/codex/CodexExecutionNormalizer';
import { parseRolloutLine } from '../../../../src/main/providers/codex/CodexRolloutParser';
import { CodexScanner } from '../../../../src/main/providers/codex/CodexScanner';

import type { CodexRolloutRecord } from '../../../../src/main/providers/codex/types';
import type { Execution, TimelineEntry } from '@shared/types';

const REAL_OBSERVED = path.resolve(__dirname, '../../../../tests/fixtures/codex/real-observed');

interface TranscriptLine {
  line?: number;
  bytes?: number;
  type?: unknown;
  [key: string]: unknown;
}

function readTranscript(file: string): TranscriptLine[] {
  return fs
    .readFileSync(path.join(REAL_OBSERVED, file), 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as TranscriptLine);
}

/**
 * Rollout records from a transcript, keeping the real line numbers. Transcript
 * headers/footers and the collector's `_evidence_*` separators are not records.
 */
function loadRecords(file: string): CodexRolloutRecord[] {
  const records: CodexRolloutRecord[] = [];
  for (const entry of readTranscript(file)) {
    if (typeof entry.type !== 'string' || typeof entry.line !== 'number') continue;
    const { line, bytes: _bytes, ...record } = entry;
    const parsed = parseRolloutLine(JSON.stringify(record), line);
    if (parsed) records.push(parsed);
  }
  return records;
}

function executionsOf(timeline: TimelineEntry[]): Execution[] {
  return timeline.flatMap((entry) => (entry.kind === 'execution' ? [entry.execution] : []));
}

function findExecution(list: Execution[], id: string): Execution {
  const found = list.find((exec) => exec.id === id);
  if (!found) throw new Error(`execution ${id} not found`);
  return found;
}

describe('real-observed fixtures: transcript loading', () => {
  it('keeps real line numbers and ordinals and skips synthetic separators', () => {
    const records = loadRecords('current-code-mode-correlation-windows.jsonl');
    expect(records).toHaveLength(148);
    expect(records[0]).toMatchObject({ lineNumber: 12, ordinal: 11, type: 'response_item' });
    expect(records.every((record) => record.ordinal === record.lineNumber - 1)).toBe(true);
  });

  it('confirms the premise: no executed_tool_calls or cell_id passthrough in the live rollout', () => {
    const text = fs.readFileSync(
      path.join(REAL_OBSERVED, 'current-code-mode-correlation-windows.jsonl'),
      'utf8'
    );
    expect(text).not.toContain('executed_tool_calls');
    expect(text).not.toContain('"cell_id"');
  });
});

describe('real-observed fixtures: code-mode correlation windows', () => {
  const records = loadRecords('current-code-mode-correlation-windows.jsonl');
  const session = normalizeCodexRollout(records, { active: false });
  const list = executionsOf(session.timeline);
  const childIds = (callId: string): string[] =>
    (findExecution(list, callId).children ?? []).map((child) => child.id);

  it('attributes exec- items to the only running cell of their turn, in record order', () => {
    expect(childIds('call_vpypg3dyBeQJuuXwcCcHbQY9')).toEqual([]);
    expect(childIds('call_1KEARIThuOXZr2mVVGLZW0UD')).toEqual([
      'exec-661aa5ec-1d56-45c4-863e-940791acb701',
    ]);
    expect(childIds('call_WnvspaQEzs3XmPCqUZTHEKom')).toEqual([
      'exec-64704b9d-4af4-4b84-97cb-0d2f06aaacad',
    ]);
    expect(childIds('call_eRSLUt67Hh8iuroYVmauKQSF')).toEqual([
      'exec-bbd227e2-aaba-4cc9-9d53-a83c71115239',
    ]);
    expect(childIds('call_u3aSeN4KC9Z70EVAi3n5pqnv')).toEqual([
      'exec-51344d0d-4548-4133-b412-abf70a603e89',
    ]);
    // Window 6: five McpToolCall items; which script call each one is cannot be told.
    expect(childIds('call_73BC1Dy25M496VZY32hyqLtJ')).toEqual([
      'exec-d514af07-1aa0-4811-bee7-e32bf4257b93',
      'exec-b1dc6df8-4bd2-42a4-bd74-7d5df26c2c16',
      'exec-8010465f-a6f8-419a-9760-28b1566ded8e',
      'exec-6543d369-591c-4e6a-8654-04315de488ac',
      'exec-6777816f-ccb0-45a7-bc00-f9edeb94f76e',
    ]);
    expect(childIds('call_XVTNeYnfQiqE7096yB40xIkM')).toEqual([
      'exec-581175f1-6654-4eef-8807-4f020205afd0',
    ]);
    expect(childIds('call_qxOzN8BCPY7xa2RbjHLvRFIa')).toEqual([
      'exec-06126881-aa8b-4309-b8cd-0e61675f186f',
    ]);
    expect(childIds('call_3Wkq2jzxxLg2DQr3EBz01qF8')).toEqual([
      'exec-bb999e6b-7bd3-4fb1-b5e0-d01e6a6b03ec',
      'exec-2d75d9d0-972d-402b-8f7f-24d0206ba7bf',
    ]);
  });

  it('marks every attached item as recorded evidence linked by turn and order, never by id', () => {
    const cells = list.filter((exec) => exec.kind === 'code_cell');
    const children = cells.flatMap((cell) => cell.children ?? []);
    // Windows 2, 3, 4, 5 and 7: one item each; Window 6: five; Window 8: one + two.
    expect(children).toHaveLength(13);
    for (const cell of cells) {
      for (const child of cell.children ?? []) {
        expect(child.turnId).toBe(cell.turnId);
        expect(child.evidence).toMatchObject({
          observed: { kind: 'item', recordId: child.id },
          result: { kind: 'item' },
          cellLink: { method: 'turn_window' },
        });
        // Sanitized sources give no call sites, so nothing is linked by content.
        expect(child.evidence.code).toBeUndefined();
        expect(child.evidence.callSiteLink).toBeUndefined();
      }
    }
  });

  it('keeps the Window 8 command that straddles two cells unattributed', () => {
    const straddling = findExecution(list, 'exec-2d4ed089-bcd1-4e41-b960-86b56a7551b3');
    expect(straddling.parentId).toBeUndefined();
    expect(straddling).toMatchObject({
      kind: 'command',
      lineNumber: 66906,
      exitCode: 0,
      status: 'completed',
      durationMs: 14839,
      durationSource: 'reported',
      timestamp: '2026-09-27T04:35:54.340Z',
      completedAt: '2026-09-27T04:36:09.180Z',
      evidence: {
        observed: { kind: 'item', recordType: 'item_completed/CommandExecution' },
        cellLink: { method: 'unresolved' },
      },
    });
    expect(session.stats.unattributed).toBe(1);
  });

  it('links js and sleep calls to their items by explicit id', () => {
    expect(findExecution(list, 'call_PICM3TMuuzYTRWwJCTl7h7tr')).toMatchObject({
      kind: 'mcp',
      name: 'js',
      namespace: 'mcp__cua_repl',
      status: 'completed',
      durationMs: 1625,
      durationSource: 'reported',
      evidence: {
        observed: { kind: 'call', recordType: 'function_call' },
        result: { kind: 'item', lineNumber: 26, recordId: 'call_PICM3TMuuzYTRWwJCTl7h7tr' },
      },
    });
    // The Extension item's durationMs (3000) is the requested sleep; the
    // measured duration comes from the provider's own start and end times.
    expect(findExecution(list, 'call_ooHM4fQk1A9fZc4KCXBztkUe')).toMatchObject({
      name: 'sleep',
      namespace: 'clock',
      status: 'completed',
      durationMs: 3012,
      durationSource: 'provider_timestamps',
      evidence: { result: { kind: 'item', lineNumber: 2888 } },
    });
  });

  it('keeps provider-reported and computed durations apart, and leaves missing ones missing', () => {
    const child = (id: string): Execution =>
      list.flatMap((exec) => exec.children ?? []).find((c) => c.id === id)!;
    expect(child('exec-581175f1-6654-4eef-8807-4f020205afd0')).toMatchObject({
      exitCode: 0,
      durationMs: 0,
      durationSource: 'reported',
    });
    expect(child('exec-06126881-aa8b-4309-b8cd-0e61675f186f')).toMatchObject({
      kind: 'patch',
      durationMs: 1,
      durationSource: 'provider_timestamps',
    });
    const webSearch = child('exec-bbd227e2-aaba-4cc9-9d53-a83c71115239');
    expect(webSearch).toMatchObject({ kind: 'web_search', status: 'completed' });
    expect(webSearch.durationMs).toBeUndefined();
    expect(webSearch.durationSource).toBeUndefined();
  });

  it('never reports "No result was recorded" for a cell whose output was recorded', () => {
    const cells = list.filter((exec) => exec.kind === 'code_cell');
    expect(cells).toHaveLength(9);
    for (const cell of cells) {
      // Sanitized outputs have no status header: the outcome is unknown, but
      // the output record is there.
      expect(cell).toMatchObject({
        status: 'unknown',
        statusDetail: 'Output recorded without a script status header',
        evidence: { result: { kind: 'output', recordType: 'custom_tool_call_output' } },
      });
    }
  });

  it('marks outputs whose call lies outside the excerpt as unlinked with an unknown outcome', () => {
    const orphans = list.filter(
      (exec) => exec.statusDetail === 'Call record not found in this rollout'
    );
    expect(orphans.map((exec) => exec.lineNumber)).toEqual([13188, 20791]);
    for (const orphan of orphans) {
      expect(orphan.status).toBe('unknown');
    }
  });
});

describe('real-observed fixtures: forked subagent rollout', () => {
  const records = loadRecords('subagent-thread-spawn.jsonl');
  const session = normalizeCodexRollout(records, { active: false });

  it('treats records before subagent_history_start_ordinal as inherited parent history', () => {
    expect(session.metadata).toMatchObject({
      threadId: '01a0a8c9-2bb8-7920-a65b-c88be2bc900f',
      parentThreadId: '01a09d90-2086-7f92-9e12-670bc277cf90',
      historyStartOrdinal: 171,
    });
    expect(session.timeline).toEqual([
      expect.objectContaining({
        kind: 'inherited_context',
        lineNumber: 2,
        lastLineNumber: 171,
        recordCount: 170,
        parentThreadId: '01a09d90-2086-7f92-9e12-670bc277cf90',
      }),
    ]);
    expect(session.executions).toEqual([]);
    expect(session.title).toBeUndefined();
    expect(session.tokenUsage).toBeUndefined();
    expect(session.turnInProgress).toBe(false);
  });

  describe('session list', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-real-observed-'));
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('takes the title and model from own history only and reports the inherited count', async () => {
      const dayDir = path.join(dir, '2026', '09', '16');
      fs.mkdirSync(dayDir, { recursive: true });
      const lines = readTranscript('subagent-thread-spawn.jsonl')
        .filter((entry) => typeof entry.type === 'string')
        .map(({ line: _line, bytes: _bytes, ...record }) => JSON.stringify(record));
      fs.writeFileSync(
        path.join(dayDir, 'rollout-2026-09-16T01-55-51-01a0a8c9-2bb8-7920-a65b-c88be2bc900f.jsonl'),
        `${lines.join('\n')}\n`
      );
      const list = await new CodexScanner(dir).scan();
      expect(list.sessions).toHaveLength(1);
      expect(list.sessions[0]).toMatchObject({
        parentThreadId: '01a09d90-2086-7f92-9e12-670bc277cf90',
        agentNickname: '<agent-1>',
        inheritedRecordCount: 170,
      });
      // Every user message and turn_context in this file belongs to the parent.
      expect(list.sessions[0].title).toBeUndefined();
      expect(list.sessions[0].model).toBeUndefined();
    });
  });
});

describe('real-observed fixtures: item_completed schema coverage', () => {
  const records = loadRecords('current-item-completed-by-type.jsonl');

  it('parses every execution-relevant item type instead of dropping it', () => {
    const byType = new Map<string, string>();
    for (const record of records) {
      const itemType = String((record.payload.item as { type?: unknown }).type);
      const event = parseCodexEvent(record.payload);
      byType.set(
        itemType,
        event.kind === 'recorded_item' ? `recorded_item:${event.item.type}` : event.kind
      );
    }
    expect(Object.fromEntries(byType)).toEqual({
      UserMessage: 'user_message',
      Reasoning: 'reasoning_item',
      AgentMessage: 'agent_message',
      McpToolCall: 'recorded_item:mcp',
      FileChange: 'recorded_item:file_change',
      // Duplicates the `compacted` record; deliberately not rendered.
      ContextCompaction: 'ignored',
      Extension: 'recorded_item:extension',
      WebSearch: 'recorded_item:web_search',
      CommandExecution: 'recorded_item:command',
    });
  });

  it('keeps items without a call or running cell as unlinked recorded executions', () => {
    const session = normalizeCodexRollout(records, { active: false });
    const list = executionsOf(session.timeline);
    expect(list.map((exec) => [exec.id, exec.kind, exec.status])).toEqual([
      ['call_PICM3TMuuzYTRWwJCTl7h7tr', 'mcp', 'completed'],
      ['call_5loZOssepZRzXPTAQuyNw27i', 'mcp', 'failed'],
      ['exec-661aa5ec-1d56-45c4-863e-940791acb701', 'patch', 'completed'],
      ['exec-0aba182b-630a-4a82-87af-d810c018763a', 'patch', 'completed'],
      ['call_ooHM4fQk1A9fZc4KCXBztkUe', 'tool', 'completed'],
      ['call_gCu8sZLjGohWhpKUn8qBosAp', 'tool', 'completed'],
      ['exec-bbd227e2-aaba-4cc9-9d53-a83c71115239', 'web_search', 'completed'],
      ['exec-84902cf8-cc57-488d-a91c-b4060287c53e', 'web_search', 'completed'],
      ['exec-581175f1-6654-4eef-8807-4f020205afd0', 'command', 'completed'],
      ['exec-fb90f6fa-85d7-4a29-940d-8936ad7e9a5e', 'command', 'completed'],
    ]);
    for (const exec of list) {
      expect(exec.evidence.cellLink?.method).toBe('unresolved');
    }
    expect(findExecution(list, 'exec-661aa5ec-1d56-45c4-863e-940791acb701')).toMatchObject({
      generation: 'code_mode',
      evidence: {
        cellLink: {
          detail:
            'Dispatched from a code cell, but no cell of its turn was running when it was recorded',
        },
      },
    });
    expect(findExecution(list, 'call_PICM3TMuuzYTRWwJCTl7h7tr').evidence.cellLink?.detail).toBe(
      'No call record with this id in the rollout'
    );
    expect(session.stats.unattributed).toBe(10);
  });
});

describe('real-observed fixtures: thread settings and custom tool pairs', () => {
  it('recognizes thread_settings_applied without rendering it', () => {
    const records = loadRecords('thread-settings-applied.jsonl');
    for (const record of records) {
      expect(parseCodexEvent(record.payload)).toEqual({
        kind: 'ignored',
        type: 'thread_settings_applied',
      });
    }
    expect(normalizeCodexRollout(records, { active: false }).timeline).toEqual([]);
  });

  it('pairs exec calls with their outputs by call id', () => {
    const records = [
      ...loadRecords('current-custom-tool-calls.jsonl'),
      ...loadRecords('current-custom-tool-outputs.jsonl'),
    ].sort((a, b) => a.lineNumber - b.lineNumber);
    const list = executionsOf(normalizeCodexRollout(records, { active: false }).timeline);
    expect(list.map((exec) => [exec.id, exec.lineNumber, exec.outputLineNumber])).toEqual([
      ['call_vpypg3dyBeQJuuXwcCcHbQY9', 15, 17],
      ['call_myISVl1XGgUxmXmU1ZfzZg7t', 56, 58],
      ['call_3o5KBmNgIq5kdU4sLaLc64mt', 77, 79],
      ['call_Xl0bD8GFHLkJsbICNw9cAPXG', 91, 93],
      ['call_1KEARIThuOXZr2mVVGLZW0UD', 98, 101],
    ]);
    for (const exec of list) {
      expect(exec).toMatchObject({
        kind: 'code_cell',
        turnId: expect.stringMatching(/^01a0ce/),
        evidence: {
          observed: { kind: 'call', recordType: 'custom_tool_call' },
          result: { kind: 'output', recordType: 'custom_tool_call_output' },
        },
      });
    }
  });
});
