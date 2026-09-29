/**
 * Real-derived evidence: regression tests built from sanitized Codex rollout
 * records proving the subagent spawn chain and FileChange structure.
 *
 * Fixtures in tests/fixtures/codex/real-observed/ were extracted from the
 * 61-rollout corpus (2026-09-28) via codex-rollout-transcript.ts --select
 * relations / --select file-changes, sanitizer v3.
 *
 * - Subagent family (simple): parent spawns two children via the explicit id
 *   chain (spawn_agent call_id = SubAgentActivity started id =
 *   child session_meta.id). CLI 0.153.0, codex_vscode.
 *
 * - Subagent continuation: a continuation file (ordinals from 816,
 *   history_base) spawns a child via the same chain. CLI 0.153.4.
 *
 * - FileChange operations: add, update, delete observed in real records.
 *   No `move` type was found in the corpus.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, describe, expect, it } from 'vitest';

import { normalizeCodexRollout } from '../../../../src/main/providers/codex/CodexExecutionNormalizer';
import {
  parseRolloutLine,
  readRolloutRecords,
} from '../../../../src/main/providers/codex/CodexRolloutParser';
import {
  readSpawnObservations,
  SpawnObservationCollector,
} from '../../../../src/main/providers/codex/CodexSpawnObservations';

import type { CodexRolloutRecord } from '../../../../src/main/providers/codex/types';
import type { Execution } from '@shared/types';

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

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-real-derived-'));
afterAll(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

let fileCounter = 0;

function realRollout(file: string): string {
  const lines = readTranscript(file)
    .filter((entry) => typeof entry.type === 'string' && typeof entry.line === 'number')
    .map((entry) =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(entry).filter(([key]) => key !== 'line' && key !== 'bytes')
        )
      )
    );
  const filePath = path.join(tempRoot, `rollout-${++fileCounter}.jsonl`);
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
  return filePath;
}

async function observeFiltered(filePath: string): Promise<{
  threadId?: string;
  declaredParentThreadId?: string;
  spawns: Array<{
    spawnCallId: string;
    spawnNamespace?: string;
    spawnLineNumber: number;
    started: Array<{
      activityId: string;
      childThreadId: string;
      activityLineNumber: number;
    }>;
  }>;
}> {
  const collector = new SpawnObservationCollector();
  await readSpawnObservations(filePath, collector);
  return collector.observations();
}

async function observeAll(filePath: string) {
  const collector = new SpawnObservationCollector();
  const { records } = await readRolloutRecords(filePath);
  for (const record of records) collector.accept(record);
  return collector.observations();
}

// ============================================================================
// Subagent family: simple parent → two children
// ============================================================================

describe('real-derived evidence: simple subagent family spawn chain', () => {
  const PARENT_THREAD = '01a09d90-2086-7f92-9e12-670bc277cf90';
  const CHILD_1_THREAD = '01a09d91-804f-75a2-8d3c-b484e6b28af0';
  const CHILD_2_THREAD = '01a0a8c9-2bb8-7920-a65b-c88be2bc900f';
  const SPAWN_1_CALL_ID = 'call_pjt5dLaAgloHC64L2BXIR3Gz';
  const SPAWN_2_CALL_ID = 'call_b8YzkyC1w2w0mqCarYyub6JQ';

  describe('parent spawn observations', () => {
    it('finds two spawn_agent calls, each with one started activity naming a distinct child', async () => {
      const filePath = realRollout('subagent-family-simple-parent.jsonl');
      const observed = await observeFiltered(filePath);

      expect(observed.threadId).toBe(PARENT_THREAD);
      expect(observed.declaredParentThreadId).toBeUndefined();
      expect(observed.spawns).toHaveLength(2);

      const [spawn1, spawn2] = observed.spawns;
      expect(spawn1.spawnCallId).toBe(SPAWN_1_CALL_ID);
      expect(spawn1.spawnNamespace).toBe('collaboration');
      expect(spawn1.started).toHaveLength(1);
      expect(spawn1.started[0].activityId).toBe(SPAWN_1_CALL_ID);
      expect(spawn1.started[0].childThreadId).toBe(CHILD_1_THREAD);

      expect(spawn2.spawnCallId).toBe(SPAWN_2_CALL_ID);
      expect(spawn2.spawnNamespace).toBe('collaboration');
      expect(spawn2.started).toHaveLength(1);
      expect(spawn2.started[0].activityId).toBe(SPAWN_2_CALL_ID);
      expect(spawn2.started[0].childThreadId).toBe(CHILD_2_THREAD);
    });

    it('gives the same observations with and without the line pre-filter', async () => {
      const filePath = realRollout('subagent-family-simple-parent.jsonl');
      expect(await observeFiltered(filePath)).toEqual(await observeAll(filePath));
    });
  });

  describe('child metadata chain', () => {
    it('child session_meta.id equals the parent SubAgentActivity agent_thread_id', () => {
      const childLines = readTranscript('subagent-family-simple-child.jsonl');
      const childMeta = childLines.find(
        (entry) => entry.type === 'session_meta' && typeof entry.line === 'number'
      );
      expect(childMeta).toBeDefined();

      const payload = childMeta!.payload as Record<string, unknown>;
      expect(payload.id).toBe(CHILD_1_THREAD);
      expect(payload.parent_thread_id).toBe(PARENT_THREAD);
      expect(payload.forked_from_id).toBe(PARENT_THREAD);
      expect(payload.subagent_history_start_ordinal).toBe(55);
    });

    it('child declares source.subagent with thread_spawn naming the parent', () => {
      const childLines = readTranscript('subagent-family-simple-child.jsonl');
      const childMeta = childLines.find(
        (entry) => entry.type === 'session_meta' && typeof entry.line === 'number'
      );
      const payload = childMeta!.payload as Record<string, unknown>;
      const source = payload.source as { subagent: { thread_spawn: Record<string, unknown> } };
      expect(source.subagent.thread_spawn.parent_thread_id).toBe(PARENT_THREAD);
      expect(source.subagent.thread_spawn.depth).toBe(1);
    });
  });

  describe('explicit id chain invariant', () => {
    it('spawn_agent.call_id = SubAgentActivity.id = child thread id link', async () => {
      const filePath = realRollout('subagent-family-simple-parent.jsonl');
      const observed = await observeFiltered(filePath);
      const childLines = readTranscript('subagent-family-simple-child.jsonl');
      const childMeta = childLines.find(
        (entry) => entry.type === 'session_meta' && typeof entry.line === 'number'
      );
      const childId = (childMeta!.payload as Record<string, unknown>).id;

      const spawn = observed.spawns[0];
      expect(spawn.spawnCallId).toBe(SPAWN_1_CALL_ID);
      expect(spawn.started[0].activityId).toBe(spawn.spawnCallId);
      expect(spawn.started[0].childThreadId).toBe(childId);
    });
  });
});

// ============================================================================
// Subagent continuation: spawn from a continuation file
// ============================================================================

describe('real-derived evidence: continuation file spawning a child', () => {
  const PARENT_THREAD = '01a07967-8252-7b21-8524-3164700549b1';
  const CHILD_THREAD = '01a0898c-b375-7942-a0a7-41830e54bfca';
  const SPAWN_CALL_ID = 'call_Cfh4vIx7kXCyUaqKDIz9UfaL';

  describe('continuation parent', () => {
    it('has history_base declaring continuation from the same thread', () => {
      const lines = readTranscript('subagent-continuation-parent.jsonl');
      const meta = lines.find(
        (entry) => entry.type === 'session_meta' && typeof entry.line === 'number'
      );
      expect(meta).toBeDefined();
      const payload = meta!.payload as Record<string, unknown>;
      expect(payload.id).toBe(PARENT_THREAD);
      const historyBase = payload.history_base as Record<string, unknown>;
      expect(historyBase.thread_id).toBe(PARENT_THREAD);
      expect(historyBase.end_ordinal_exclusive).toBe(816);
      expect(historyBase.end_byte_offset).toBe(2564684);
    });

    it('records ordinals starting from the continuation offset', () => {
      const records = loadRecords('subagent-continuation-parent.jsonl');
      expect(records[0].ordinal).toBe(816);
    });

    it('finds the spawn_agent call and started activity for the child', async () => {
      const filePath = realRollout('subagent-continuation-parent.jsonl');
      const observed = await observeFiltered(filePath);

      expect(observed.threadId).toBe(PARENT_THREAD);
      expect(observed.spawns).toHaveLength(1);

      const spawn = observed.spawns[0];
      expect(spawn.spawnCallId).toBe(SPAWN_CALL_ID);
      expect(spawn.spawnNamespace).toBe('collaboration');
      expect(spawn.started).toHaveLength(1);
      expect(spawn.started[0].activityId).toBe(SPAWN_CALL_ID);
      expect(spawn.started[0].childThreadId).toBe(CHILD_THREAD);
    });
  });

  describe('continuation child', () => {
    it('declares parent_thread_id matching the continuation parent thread', () => {
      const lines = readTranscript('subagent-continuation-child.jsonl');
      const childMeta = lines.find(
        (entry) =>
          entry.type === 'session_meta' &&
          typeof entry.line === 'number' &&
          (entry.payload as Record<string, unknown>).id === CHILD_THREAD
      );
      expect(childMeta).toBeDefined();
      const payload = childMeta!.payload as Record<string, unknown>;
      expect(payload.parent_thread_id).toBe(PARENT_THREAD);
      expect(payload.subagent_history_start_ordinal).toBe(11);
    });

    it('carries a second session_meta from the parent (continuation), part of inherited history', () => {
      const lines = readTranscript('subagent-continuation-child.jsonl');
      const metas = lines.filter(
        (entry) => entry.type === 'session_meta' && typeof entry.line === 'number'
      );
      expect(metas).toHaveLength(2);

      const parentCopy = metas.find(
        (meta) => (meta.payload as Record<string, unknown>).id === PARENT_THREAD
      );
      expect(parentCopy).toBeDefined();
      const payload = parentCopy!.payload as Record<string, unknown>;
      expect(payload.history_base).toBeDefined();
    });
  });

  describe('explicit id chain across continuation', () => {
    it('the full chain holds: call_id → activity.id → child thread id', async () => {
      const filePath = realRollout('subagent-continuation-parent.jsonl');
      const observed = await observeFiltered(filePath);
      const childLines = readTranscript('subagent-continuation-child.jsonl');
      const childMeta = childLines.find(
        (entry) =>
          entry.type === 'session_meta' &&
          typeof entry.line === 'number' &&
          (entry.payload as Record<string, unknown>).id === CHILD_THREAD
      );

      const spawn = observed.spawns[0];
      expect(spawn.spawnCallId).toBe(SPAWN_CALL_ID);
      expect(spawn.started[0].activityId).toBe(spawn.spawnCallId);
      expect(spawn.started[0].childThreadId).toBe(
        (childMeta!.payload as Record<string, unknown>).id
      );
    });
  });
});

// ============================================================================
// FileChange operations: add, update, delete from real records
// ============================================================================

describe('real-derived evidence: FileChange operations', () => {
  const records = loadRecords('file-changes-operations.jsonl');
  const session = normalizeCodexRollout(records, { active: false });
  const executions = session.timeline.flatMap((entry) =>
    entry.kind === 'execution' ? [entry.execution] : []
  );

  function findExec(id: string): Execution {
    const found = executions.find((exec) => exec.id === id);
    if (!found) throw new Error(`execution ${id} not found`);
    return found;
  }

  it('parses three FileChange items as patch executions', () => {
    const patches = executions.filter((exec) => exec.kind === 'patch');
    expect(patches).toHaveLength(3);
    expect(patches.map((exec) => exec.id)).toEqual([
      'exec-346ded12-c538-4cf5-b204-7f912e225e30',
      'exec-645ede5b-0919-42ad-b9df-725f11495e7a',
      'exec-00c98b54-ddd2-4556-90b3-d18a510a239b',
    ]);
  });

  // The record's change text is sanitized to `<string:N>` (N = its length); it is
  // kept as the file's recorded change all the same.
  it('records a FileChange add with the correct path, change type and content', () => {
    const exec = findExec('exec-346ded12-c538-4cf5-b204-7f912e225e30');
    expect(exec).toMatchObject({
      kind: 'patch',
      status: 'completed',
      lineNumber: 28,
    });
    expect(exec.fileWrites).toEqual([
      { path: '<path-1>', change: 'add', diff: { field: 'content', text: '<string:1108>' } },
    ]);
  });

  it('records a FileChange update with the correct path, change type and unified diff', () => {
    const exec = findExec('exec-645ede5b-0919-42ad-b9df-725f11495e7a');
    expect(exec).toMatchObject({
      kind: 'patch',
      status: 'completed',
      lineNumber: 36,
    });
    expect(exec.fileWrites).toEqual([
      {
        path: '<path-1>',
        change: 'update',
        diff: { field: 'unified_diff', text: '<string:343>' },
      },
    ]);
  });

  it('records a FileChange delete with the correct path, change type and content', () => {
    const exec = findExec('exec-00c98b54-ddd2-4556-90b3-d18a510a239b');
    expect(exec).toMatchObject({
      kind: 'patch',
      status: 'completed',
      lineNumber: 908,
    });
    expect(exec.fileWrites).toEqual([
      { path: '<path-14>', change: 'delete', diff: { field: 'content', text: '<string:1609>' } },
    ]);
  });

  it('does not contain a move operation (absent from the 61-rollout corpus)', () => {
    for (const exec of executions) {
      for (const write of exec.fileWrites ?? []) {
        expect(write.change).not.toBe('move');
        expect(write.movedTo).toBeUndefined();
      }
    }
  });

  it('counts distinct final paths of completed patches in session stats', () => {
    expect(session.stats.filesWritten).toBe(2);
  });

  it('preserves sanitized path aliases in fileWrites', () => {
    const allPaths = executions.flatMap((exec) => (exec.fileWrites ?? []).map((w) => w.path));
    expect(allPaths).toEqual(['<path-1>', '<path-1>', '<path-14>']);
    for (const p of allPaths) {
      expect(p).toMatch(/^<path-\d+>$/);
    }
  });

  it('records evidence from item_completed/FileChange for each execution', () => {
    for (const exec of executions.filter((e) => e.kind === 'patch')) {
      expect(exec.evidence.observed).toMatchObject({
        kind: 'item',
        recordType: 'item_completed/FileChange',
      });
    }
  });
});
