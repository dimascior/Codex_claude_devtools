import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { CodexScanner } from '../../../../src/main/providers/codex/CodexScanner';
import { CodexSessionService } from '../../../../src/main/providers/codex/CodexSessionService';

import type { AgentSessionDetail } from '../../../../src/main/domain';

const FIXTURES = path.resolve(__dirname, '../../../fixtures/codex');

const FUNCTION_CALLS_ID =
  '2026/09/23/rollout-2026-09-23T22-40-58-0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b.jsonl';
const CODE_MODE_ID =
  '2026/09/24/rollout-2026-09-24T09-00-00-0199b000-0000-7000-8000-000000000001.jsonl';
const PAGINATED_ID =
  '2026/09/25/rollout-2026-09-25T10-00-00-0199c000-0000-7000-8000-000000000002.jsonl';

describe('Codex scanning and session details', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  function setupSessions(files: Record<string, { fixture: string; ageMs: number }>): string {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-home-'));
    tempDirs.push(home);
    const sessionsDir = path.join(home, 'sessions');
    const now = Date.now();
    for (const [sessionId, { fixture, ageMs }] of Object.entries(files)) {
      const filePath = path.join(sessionsDir, ...sessionId.split('/'));
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.copyFileSync(path.join(FIXTURES, fixture), filePath);
      const time = new Date(now - ageMs);
      fs.utimesSync(filePath, time, time);
    }
    // Files that must be ignored.
    fs.mkdirSync(path.join(sessionsDir, '2026', '09', '25'), { recursive: true });
    fs.writeFileSync(path.join(sessionsDir, '2026', '09', '25', 'notes.txt'), 'ignore me');
    return sessionsDir;
  }

  it('lists rollouts by recency, grouped by working directory, and picks the live one', async () => {
    const sessionsDir = setupSessions({
      [FUNCTION_CALLS_ID]: { fixture: 'function-calls.jsonl', ageMs: 3 * 60 * 60 * 1000 },
      [CODE_MODE_ID]: { fixture: 'code-mode.jsonl', ageMs: 60 * 60 * 1000 },
      [PAGINATED_ID]: { fixture: 'paginated.jsonl', ageMs: 30 * 1000 },
    });
    const list = await new CodexScanner(sessionsDir).scan();

    expect(list.rootExists).toBe(true);
    expect(list.totalFiles).toBe(3);
    expect(list.sessions.map((session) => session.id)).toEqual([
      PAGINATED_ID,
      CODE_MODE_ID,
      FUNCTION_CALLS_ID,
    ]);
    expect(list.liveSessionId).toBe(PAGINATED_ID);
    expect(list.latestSessionId).toBe(PAGINATED_ID);

    const live = list.sessions[0];
    expect(live).toMatchObject({
      provider: 'codex',
      isLive: true,
      turnInProgress: false,
      cwd: '/work/app',
      projectName: 'app',
      source: 'vscode',
      originator: 'codex_vscode',
      model: 'example-model-b',
      title: 'lint it',
    });

    const windows = list.sessions[2];
    expect(windows).toMatchObject({
      isLive: false,
      projectName: 'sample-app',
      title: 'Run the tests and show me what changed',
      gitBranch: 'main',
      threadId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
    });

    // Two different directories named "sample-app" are disambiguated by their parent.
    expect(list.projects.map((project) => [project.name, project.sessionIds.length])).toEqual([
      ['app', 1],
      ['src/sample-app', 1],
      ['src\\sample-app', 1],
    ]);
  });

  it('prefers a live session whose turn is still running', async () => {
    const running =
      '2026/09/26/rollout-2026-09-26T08-00-00-0199d000-0000-7000-8000-000000000003.jsonl';
    const sessionsDir = setupSessions({
      [PAGINATED_ID]: { fixture: 'paginated.jsonl', ageMs: 5 * 1000 },
      [running]: { fixture: 'code-mode.jsonl', ageMs: 60 * 1000 },
    });
    // Drop the final task_complete so the turn is still in progress.
    const runningPath = path.join(sessionsDir, ...running.split('/'));
    const lines = fs.readFileSync(runningPath, 'utf8').trimEnd().split('\n');
    fs.writeFileSync(runningPath, `${lines.slice(0, -1).join('\n')}\n`);
    const time = new Date(Date.now() - 60 * 1000);
    fs.utimesSync(runningPath, time, time);

    const list = await new CodexScanner(sessionsDir).scan();
    expect(list.sessions.find((session) => session.id === running)?.turnInProgress).toBe(true);
    expect(list.liveSessionId).toBe(running);
    expect(list.latestSessionId).toBe(PAGINATED_ID);
  });

  it('reports a missing sessions directory', async () => {
    const list = await new CodexScanner(path.join(os.tmpdir(), 'does-not-exist-codex')).scan();
    expect(list).toMatchObject({ rootExists: false, sessions: [], liveSessionId: null });
  });

  it('builds details, short-circuits unchanged fingerprints and rejects invalid ids', async () => {
    const sessionsDir = setupSessions({
      [FUNCTION_CALLS_ID]: { fixture: 'function-calls.jsonl', ageMs: 3 * 60 * 60 * 1000 },
    });
    const service = new CodexSessionService({ sessionsDir, watch: false });

    const detail = (await service.getSessionDetail(FUNCTION_CALLS_ID)) as AgentSessionDetail;
    expect(detail.session).toMatchObject({
      id: FUNCTION_CALLS_ID,
      isLive: false,
      title: 'Run the tests and show me what changed',
    });
    expect(detail.stats.total).toBe(6);
    expect(detail.fingerprint).toMatch(/-idle$/);

    expect(await service.getSessionDetail(FUNCTION_CALLS_ID, detail.fingerprint)).toEqual({
      unchanged: true,
      fingerprint: detail.fingerprint,
    });

    expect(await service.getSessionDetail('../../etc/passwd')).toBeNull();
    expect(await service.getSessionDetail('2026/09/23/rollout-missing.jsonl')).toBeNull();
    service.dispose();
  });

  it('re-parses a growing live rollout incrementally', async () => {
    const sessionsDir = setupSessions({
      [FUNCTION_CALLS_ID]: { fixture: 'function-calls.jsonl', ageMs: 0 },
    });
    const filePath = path.join(sessionsDir, ...FUNCTION_CALLS_ID.split('/'));
    const allLines = fs.readFileSync(filePath, 'utf8').trimEnd().split('\n');
    // Start with the rollout cut off while `cargo test` is still running.
    fs.writeFileSync(filePath, `${allLines.slice(0, 13).join('\n')}\n`);

    const service = new CodexSessionService({ sessionsDir, watch: false });
    const first = (await service.getSessionDetail(FUNCTION_CALLS_ID)) as AgentSessionDetail;
    expect(first.session.isLive).toBe(true);
    expect(first.session.turnInProgress).toBe(true);
    const running = first.timeline.find(
      (entry) => entry.kind === 'execution' && entry.execution.id === 'call_exec_2'
    );
    expect(running).toMatchObject({ execution: { status: 'running', processId: '3' } });

    // Codex appends the rest of the turn.
    fs.appendFileSync(filePath, `${allLines.slice(13).join('\n')}\n`);
    const second = (await service.getSessionDetail(
      FUNCTION_CALLS_ID,
      first.fingerprint
    )) as AgentSessionDetail;
    expect(second.fingerprint).not.toBe(first.fingerprint);
    expect(second.session.turnInProgress).toBe(false);
    expect(second.stats.total).toBe(6);
    const finished = second.timeline.find(
      (entry) => entry.kind === 'execution' && entry.execution.id === 'call_exec_2'
    );
    expect(finished).toMatchObject({ execution: { status: 'failed', exitCode: 101 } });
    expect(second.timeline[second.timeline.length - 1].lineNumber).toBe(22);
    service.dispose();
  });

  it('does not guess a subagent inherited count or title the head read could not reach', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-home-'));
    tempDirs.push(home);
    const sessionsDir = path.join(home, 'sessions');
    const thread = '01a0b000-0000-7000-8000-000000000001';
    const sessionId = `2026/09/26/rollout-2026-09-26T10-00-00-${thread}.jsonl`;
    const parentTurn = '01a0a000-0000-7000-8000-000000000002';
    const ownTurn = '01a0b000-0001-7000-8000-000000000003';
    // A copied parent history longer than the 400-line head read.
    const prefix = 450;
    const records: Record<string, unknown>[] = [
      {
        ordinal: 0,
        type: 'session_meta',
        payload: {
          id: thread,
          cwd: '/work',
          source: { subagent: { thread_spawn: { parent_thread_id: parentTurn } } },
          subagent_history_start_ordinal: prefix + 1,
        },
      },
      ...Array.from({ length: prefix }, (_, index) => ({
        ordinal: index + 1,
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: `parent request ${index}` }],
          internal_chat_message_metadata_passthrough: { turn_id: parentTurn },
        },
      })),
      {
        ordinal: prefix + 1,
        type: 'event_msg',
        payload: { type: 'task_started', turn_id: ownTurn },
      },
      {
        ordinal: prefix + 2,
        type: 'turn_context',
        payload: { turn_id: ownTurn, model: 'gpt-test', cwd: '/work' },
      },
      {
        ordinal: prefix + 3,
        type: 'inter_agent_communication_metadata',
        payload: { trigger_turn: true },
      },
      {
        ordinal: prefix + 4,
        type: 'response_item',
        payload: {
          type: 'agent_message',
          author: '/root',
          recipient: '/root/long_prefix_task',
          content: [
            {
              type: 'input_text',
              text: 'Message Type: NEW_TASK\nTask name: /root/long_prefix_task',
            },
            { type: 'encrypted_content', encrypted_content: 'gAAAA' },
          ],
        },
      },
    ];
    const filePath = path.join(sessionsDir, ...sessionId.split('/'));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
      filePath,
      `${records.map((record) => JSON.stringify({ timestamp: '2026-09-26T10:00:00.000Z', ...record })).join('\n')}\n`
    );

    const list = await new CodexScanner(sessionsDir).scan();
    // The head read ends inside the copied history: no count, and the parent's
    // requests are never used as the title.
    expect(list.sessions[0].inheritedRecordCount).toBeUndefined();
    expect(list.sessions[0].title).toBeUndefined();

    const service = new CodexSessionService({ sessionsDir, watch: false });
    const detail = (await service.getSessionDetail(sessionId)) as AgentSessionDetail;
    expect(detail.session).toMatchObject({
      inheritedRecordCount: prefix,
      title: 'long_prefix_task',
      titleSource: 'agent_task',
      model: 'gpt-test',
    });
    service.dispose();
  });
});

describe('Codex incremental parsing', () => {
  const REAL_OBSERVED = path.resolve(__dirname, '../../../../tests/fixtures/codex/real-observed');
  const SESSION_ID =
    '2026/09/27/rollout-2026-09-27T10-00-00-01a0c000-0000-7000-8000-000000000001.jsonl';
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  /** Rollout bytes: a synthetic fixture, or the records of a real-derived transcript. */
  function rolloutBytes(source: string): Buffer {
    if (!source.startsWith('real:')) {
      return fs.readFileSync(path.join(FIXTURES, source));
    }
    const lines = fs
      .readFileSync(path.join(REAL_OBSERVED, source.slice('real:'.length)), 'utf8')
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((entry) => typeof entry.type === 'string' && typeof entry.line === 'number')
      .map(({ line: _line, bytes: _bytes, ...record }) => JSON.stringify(record));
    return Buffer.from(`${lines.join('\n')}\n`, 'utf8');
  }

  /**
   * Byte offsets, in order: at a line boundary, inside a line (an unparsable
   * tail), just before a newline (a complete record whose newline is not written
   * yet), and at the end.
   */
  function cutPoints(bytes: Buffer): number[] {
    const newlines: number[] = [];
    for (let i = 0; i < bytes.length; i++) if (bytes[i] === 0x0a) newlines.push(i + 1);
    const atLine = (fraction: number): number =>
      newlines[Math.max(0, Math.floor(newlines.length * fraction) - 1)];
    const inLine = atLine(0.4) + 7;
    const beforeNewline = atLine(0.6) - 1;
    return [...new Set([atLine(0.25), inLine, beforeNewline, atLine(0.8), bytes.length])]
      .filter((cut) => cut > 0 && cut <= bytes.length)
      .sort((a, b) => a - b);
  }

  it.each([
    'function-calls.jsonl',
    'code-mode.jsonl',
    'paginated.jsonl',
    'real:subagent-thread-spawn.jsonl',
    'real:current-code-mode-correlation-windows.jsonl',
    'real:hosted-web-search-windows.jsonl',
  ])('matches a full parse after every append: %s', async (source) => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-incremental-'));
    tempDirs.push(home);
    const sessionsDir = path.join(home, 'sessions');
    const filePath = path.join(sessionsDir, ...SESSION_ID.split('/'));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '');

    const bytes = rolloutBytes(source);
    const incremental = new CodexSessionService({ sessionsDir, watch: false });
    let written = 0;
    for (const cut of cutPoints(bytes)) {
      fs.appendFileSync(filePath, bytes.subarray(written, cut));
      written = cut;
      const fresh = new CodexSessionService({ sessionsDir, watch: false });
      const expected = await fresh.getSessionDetail(SESSION_ID);
      const actual = await incremental.getSessionDetail(SESSION_ID);
      fresh.dispose();
      expect(actual).toEqual(expected);
      expect(actual).not.toBeNull();
    }
    incremental.dispose();
  });
});
