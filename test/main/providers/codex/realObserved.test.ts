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
import { CodexSessionService } from '../../../../src/main/providers/codex/CodexSessionService';

import type { CodexRolloutRecord } from '../../../../src/main/providers/codex/types';
import type { AgentSessionDetail, Execution, TimelineEntry } from '@shared/types';

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

/**
 * Write a complete transcript back as a rollout under `sessionsDir` (the
 * transcript's records are contiguous, so line numbers are unchanged).
 * Returns the session id.
 */
function writeRollout(sessionsDir: string, transcript: string, sessionId: string): string {
  const filePath = path.join(sessionsDir, ...sessionId.split('/'));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const lines = readTranscript(transcript)
    .filter((entry) => typeof entry.type === 'string')
    .map(({ line: _line, bytes: _bytes, ...record }) => JSON.stringify(record));
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
  return sessionId;
}

async function sessionDetail(sessionsDir: string, sessionId: string): Promise<AgentSessionDetail> {
  const service = new CodexSessionService({ sessionsDir, watch: false });
  const detail = await service.getSessionDetail(sessionId);
  if (!detail || 'unchanged' in detail) throw new Error(`no detail for ${sessionId}`);
  return detail;
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

  it("keeps Codex's classification on nested and unattributed commands", () => {
    // Nested under its cell, or top-level when no single cell was running.
    expect(childIds('call_XVTNeYnfQiqE7096yB40xIkM')).toContain(
      'exec-581175f1-6654-4eef-8807-4f020205afd0'
    );
    const nestedRead = list
      .flatMap((exec) => exec.children ?? [])
      .find((exec) => exec.id === 'exec-581175f1-6654-4eef-8807-4f020205afd0');
    expect(nestedRead?.commandActions).toEqual([{ type: 'read' }]);
    expect(findExecution(list, 'exec-2d4ed089-bcd1-4e41-b960-86b56a7551b3').commandActions).toEqual(
      [{ type: 'unknown' }]
    );
    // `unknown` is kept on the execution but not counted as a classification.
    expect(session.stats.commandActions).toEqual({ read: 1 });
  });
});

describe('real-observed fixtures: forked subagent rollout', () => {
  const records = loadRecords('subagent-thread-spawn.jsonl');
  const session = normalizeCodexRollout(records, { active: false });

  it("ends the inherited prefix at the first record of the subagent's own history", () => {
    expect(session.metadata).toMatchObject({
      threadId: '01a0a8c9-2bb8-7920-a65b-c88be2bc900f',
      parentThreadId: '01a09d90-2086-7f92-9e12-670bc277cf90',
      historyStartOrdinal: 171,
    });
    // The declared boundary (171) equals the record count, as in 10 of the 22
    // real subagent rollouts. The prefix therefore ends at the first
    // `thread_settings_applied` for this thread (line 162, ordinal 161); the
    // subagent's own turn (task_started at line 163, minted after the thread
    // id) is kept: the inter-agent task message and the abort that ended it.
    expect(session.timeline).toEqual([
      expect.objectContaining({
        kind: 'inherited_context',
        lineNumber: 2,
        lastLineNumber: 161,
        recordCount: 160,
        parentThreadId: '01a09d90-2086-7f92-9e12-670bc277cf90',
      }),
      expect.objectContaining({ kind: 'agent_message', lineNumber: 168 }),
      expect.objectContaining({ kind: 'turn_event', lineNumber: 171 }),
    ]);
    expect(session.executions).toEqual([]);
    expect(session.inheritedRecordCount).toBe(160);
    expect(session.model).toBe('<model-2>');
    expect(session.tokenUsage).toBeDefined();
    expect(session.turnInProgress).toBe(false);
  });

  it('titles the subagent with its task name, never with an inherited prompt', () => {
    // The task arrives as an inter-agent message (line 168) right after
    // inter_agent_communication_metadata with trigger_turn (line 167). Its
    // readable text is only the task header: 90 characters, upstream's
    // NEW_TASK header for author "/root" and a 32-character recipient, the
    // length of this thread's own agent_path. The task itself is encrypted.
    // The fixture aliases the task name; the user messages are the parent's.
    expect(session.title).toBe('<task-1>');
    expect(session.titleSource).toBe('agent_task');
    const task = session.timeline.find((entry) => entry.kind === 'agent_message');
    expect(task).toMatchObject({
      author: '/root',
      recipient: '/root/<task-1>',
      encrypted: true,
    });
  });

  describe('session list and detail', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-real-observed-'));
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('agree on title, model and inherited count, all taken from own history', async () => {
      const id = writeRollout(
        dir,
        'subagent-thread-spawn.jsonl',
        '2026/09/16/rollout-2026-09-16T01-55-51-01a0a8c9-2bb8-7920-a65b-c88be2bc900f.jsonl'
      );
      const list = await new CodexScanner(dir).scan();
      expect(list.sessions).toHaveLength(1);
      // Every user message in this file belongs to the parent; the subagent's
      // own turn_context (line 166) supplies the model.
      const expected = {
        parentThreadId: '01a09d90-2086-7f92-9e12-670bc277cf90',
        agentNickname: '<agent-1>',
        inheritedRecordCount: 160,
        model: '<model-2>',
        title: '<task-1>',
        titleSource: 'agent_task',
      };
      expect(list.sessions[0]).toMatchObject(expected);
      expect((await sessionDetail(dir, id)).session).toMatchObject(expected);
    });
  });
});

describe('real-observed fixtures: subagent with a correct declared boundary', () => {
  const records = loadRecords('subagent-declared-boundary.jsonl');
  const session = normalizeCodexRollout(records, { active: false });

  it('ends the inherited prefix exactly at subagent_history_start_ordinal', () => {
    // Two session_meta records: the subagent's own (ordinal 0) and a copy of
    // the parent's (ordinal 1). The boundary (16) is the thread_settings_applied
    // event for the subagent's thread; its first own turn starts at ordinal 17.
    expect(session.metadata).toMatchObject({
      threadId: '01a08b56-a905-7712-bb7e-f2747c374a39',
      parentThreadId: '01a07967-8252-7b21-8524-3164700549b1',
      historyStartOrdinal: 16,
    });
    expect(session.timeline[0]).toEqual(
      expect.objectContaining({
        kind: 'inherited_context',
        lineNumber: 2,
        lastLineNumber: 16,
        recordCount: 15,
      })
    );
    const own = session.timeline.slice(1);
    expect(own.length).toBeGreaterThan(0);
    for (const entry of own) {
      expect(entry.lineNumber).toBeGreaterThanOrEqual(17);
    }
    expect(session.model).toBe('<model-1>');
    expect(session.inheritedRecordCount).toBe(15);
  });

  it('titles the subagent with its task name, not the parent prompts it inherited', () => {
    // Lines 10 and 15 are the parent's user messages, inside the prefix. The
    // task message (line 23, after trigger_turn metadata on line 22) has 91
    // readable characters: upstream's NEW_TASK header for a 33-character
    // recipient, the length of this thread's own agent_path.
    expect(session.title).toBe('<task-1>');
    expect(session.titleSource).toBe('agent_task');
  });

  describe('session list and detail', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-real-observed-'));
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('agree on title, model and inherited count', async () => {
      const id = writeRollout(
        dir,
        'subagent-declared-boundary.jsonl',
        '2026/09/10/rollout-2026-09-10T08-41-47-01a08b56-a905-7712-bb7e-f2747c374a39.jsonl'
      );
      const expected = {
        inheritedRecordCount: 15,
        model: '<model-1>',
        title: '<task-1>',
        titleSource: 'agent_task',
      };
      const list = await new CodexScanner(dir).scan();
      expect(list.sessions[0]).toMatchObject(expected);
      expect((await sessionDetail(dir, id)).session).toMatchObject(expected);
    });
  });
});

describe('real-observed fixtures: hosted web search', () => {
  const records = loadRecords('hosted-web-search-windows.jsonl');
  const session = normalizeCodexRollout(records, { active: false });
  const list = executionsOf(session.timeline);

  it('links a WebSearch item to the web_search_call recorded one record after it', () => {
    // cli 0.142.5: item.id == web_search_call.id (15/15 in the real rollout).
    const linked = list.filter((exec) => exec.evidence.cellLink?.method === 'explicit_id');
    expect(linked).toHaveLength(10);
    for (const exec of linked) {
      expect(exec.kind).toBe('web_search');
      expect(exec.evidence.observed?.recordId).toBe(exec.evidence.result?.recordId);
      expect(exec.evidence.observed?.recordType).toBe('web_search_call');
      expect(exec.evidence.result?.recordType).toBe('item_completed/WebSearch');
      expect(exec.evidence.observed?.lineNumber).toBe(exec.evidence.result!.lineNumber + 1);
      expect(exec.status).toBe('completed');
    }
    // The pair at lines 155/156 is one execution, not two.
    expect(list.filter((exec) => exec.lineNumber === 155 || exec.lineNumber === 156)).toHaveLength(
      1
    );
  });

  it('keeps calls without an id and their items apart', () => {
    // cli 0.137.0-alpha.4: web_search_call has no id, so no identifier links it
    // to the WebSearch item recorded one record earlier.
    const older = list.filter((exec) => exec.lineNumber >= 146 && exec.lineNumber <= 153);
    const calls = older.filter((exec) => exec.evidence.observed?.recordType === 'web_search_call');
    const items = older.filter(
      (exec) => exec.evidence.result?.recordType === 'item_completed/WebSearch'
    );
    expect(calls).toHaveLength(3);
    expect(items).toHaveLength(3);
    for (const call of calls) expect(call.evidence.observed?.recordId).toBeUndefined();
    for (const item of items) expect(item.evidence.cellLink?.method).toBe('unresolved');
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

  it("keeps Codex's own classification of recorded commands, and adds none", () => {
    // The sanitizer keeps only the type of each parsed_cmd entry.
    const session = normalizeCodexRollout(records, { active: false });
    const list = executionsOf(session.timeline);
    expect(
      list.flatMap((exec) => (exec.commandActions ? [[exec.id, exec.commandActions]] : []))
    ).toEqual([
      ['exec-581175f1-6654-4eef-8807-4f020205afd0', [{ type: 'read' }]],
      ['exec-fb90f6fa-85d7-4a29-940d-8936ad7e9a5e', [{ type: 'read' }]],
    ]);
    expect(session.stats.commandActions).toEqual({ read: 2 });
  });
});

describe('real-observed fixtures: thread settings and custom tool pairs', () => {
  it('parses thread_settings_applied; identical records render nothing', () => {
    const records = loadRecords('thread-settings-applied.jsonl');
    for (const record of records) {
      expect(parseCodexEvent(record.payload)).toEqual({
        kind: 'thread_settings',
        threadId: '01a0cefe-b6c1-7b21-aa52-cdb658c6d54b',
        settings: record.payload.thread_settings,
      });
    }
    const session = normalizeCodexRollout(records, { active: false });
    // Five identical records: the first is the baseline, the others are repeats.
    expect(session.timeline).toEqual([]);
    expect(session.runtime.turns).toEqual([]);
    expect(session.runtime.thread).toMatchObject({
      lineNumber: 2550,
      settings: {
        model: '<model-1>',
        reasoningEffort: 'xhigh',
        reasoningSummary: 'detailed',
        approvalPolicy: 'never',
        permissionProfile: 'disabled',
        activePermissionProfile: ':danger-full-access',
        collaborationMode: 'default',
      },
    });
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
