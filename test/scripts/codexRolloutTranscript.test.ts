import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

import {
  isSanitizedToken,
  KEEP_STRING_KEYS,
  MAX_ARRAY_ITEMS,
  OMIT_KEYS,
  resanitizeTranscript,
  sanitize,
  sanitizeLine,
  TranscriptSanitizer,
} from '../../scripts/codex-rollout-transcript';

const REAL_OBSERVED = path.resolve(__dirname, '../../tests/fixtures/codex/real-observed');

// Fabricated sentinel values (not real data) that must never appear in sanitizer output.
const FAKE_PATH = 'C:\\Users\\someone\\Projects\\private-repo\\src\\index.ts';
const FAKE_CMD = 'rm -rf /var/lib/private && cat ~/.ssh/id_ed25519';
const FAKE_OUTPUT = 'Traceback (most recent call last): confidential stack';
const FAKE_URL = 'https://internal.example.test/private?token=abc123';
const FAKE_TEXT = 'Please refactor the billing module for Acme Corp';
// Identifier-shaped names people or models choose: they pass any token check.
const FAKE_TASK = 'acme_billing_migration';
const FAKE_NICKNAME = 'AcmeReviewer';
const FAKE_ROLE = 'acme_auditor';
const FAKE_SERVER = 'acme_crm';
const FAKE_TOOL = 'lookup_acme_customer';
// Fictional model and provider names; real model names never appear in tests.
const FAKE_MODEL = 'acme-internal-model-7';
const OTHER_MODEL = 'acme-model-preview';
const FAKE_PROVIDER = 'acme_gateway';

const SENTINELS = [FAKE_PATH, FAKE_CMD, FAKE_OUTPUT, FAKE_URL, FAKE_TEXT];

// Well-formed provider ids (fabricated).
const CALL_ID = 'call_0123456789abcdefABCDEF';
const ITEM_ID = 'exec-00000000-0000-4000-8000-000000000001';
const TURN_ID = '01a00000-0000-7000-8000-000000000001';

function json(value: unknown): string {
  return JSON.stringify(value);
}

function expectNoSentinels(out: unknown): void {
  const text = json(out);
  for (const s of SENTINELS) expect(text).not.toContain(s);
  // Fragments (e.g. a lone drive letter or hostname) must not survive either.
  expect(text).not.toMatch(/[A-Za-z]:\\/);
  expect(text).not.toMatch(/https?:\/\//);
  expect(text).not.toContain('Acme');
  expect(text).not.toContain('acme');
  expect(text).not.toContain('.ssh');
}

describe('codex-rollout-transcript sanitizer', () => {
  it('replaces strings under unknown keys with <string:N>', () => {
    const out = sanitize({ foo: FAKE_TEXT }, null) as Record<string, unknown>;
    expect(out.foo).toBe(`<string:${FAKE_TEXT.length}>`);
    expectNoSentinels(out);
  });

  it('keeps structural string keys when their values have the expected shape', () => {
    const out = sanitize(
      {
        type: 'response_item',
        role: 'user',
        status: 'completed',
        call_id: CALL_ID,
        turn_id: TURN_ID,
        name: 'exec',
        cli_version: '0.147.0-alpha.6.6',
        timestamp: '2026-01-01T00:00:00.000Z',
        random_key: 'must vanish',
      },
      null
    ) as Record<string, unknown>;
    expect(out).toMatchObject({
      type: 'response_item',
      role: 'user',
      status: 'completed',
      call_id: CALL_ID,
      turn_id: TURN_ID,
      name: 'exec',
      cli_version: '0.147.0-alpha.6.6',
      timestamp: '2026-01-01T00:00:00.000Z',
      random_key: '<string:11>',
    });
  });

  it('never lets free text, paths or URLs through a structural key', () => {
    const out = sanitize(
      {
        type: FAKE_PATH,
        status: FAKE_TEXT,
        reason: FAKE_OUTPUT,
        approval_policy: FAKE_URL,
        source: FAKE_CMD,
        kind: 'two words',
        cli_version: FAKE_TEXT,
        timestamp: 'yesterday at noon',
        originator: '/usr/local/bin/codex',
      },
      null
    ) as Record<string, unknown>;
    for (const value of Object.values(out)) expect(value).toMatch(/^<string:\d+>$/);
    expectNoSentinels(out);
  });

  it('aliases ids that are not provider-generated and keeps those that are', () => {
    const out = sanitize(
      {
        call_id: CALL_ID,
        id: ITEM_ID,
        turn_id: TURN_ID,
        item_id: 'item-17',
        cell_id: '7',
        thread_id: 'acme-private-repo',
        session_id: FAKE_PATH,
        permission_profile: { id: ':danger-full-access' },
      },
      null
    ) as Record<string, unknown>;
    expect(out).toMatchObject({
      call_id: CALL_ID,
      id: ITEM_ID,
      turn_id: TURN_ID,
      item_id: 'item-17',
      cell_id: '7',
      thread_id: '<id-1>',
      session_id: '<id-2>',
      permission_profile: { id: ':danger-full-access' },
    });
    expectNoSentinels(out);
  });

  it('never keeps a string whose key is in OMIT_KEYS, even if it is also allowlisted', () => {
    for (const key of OMIT_KEYS) {
      const out = sanitize({ [key]: FAKE_TEXT }, null) as Record<string, unknown>;
      expect(json(out)).not.toContain(FAKE_TEXT);
    }
    // Sanity: the two sets do not overlap.
    for (const key of KEEP_STRING_KEYS) expect(OMIT_KEYS.has(key)).toBe(false);
  });

  it('omits commands, cwd, outputs, stdout/stderr, paths and URLs wherever they appear', () => {
    const item = {
      type: 'CommandExecution',
      id: ITEM_ID,
      command: ['pwsh', '-c', FAKE_CMD],
      cwd: FAKE_PATH,
      stdout: FAKE_OUTPUT,
      stderr: FAKE_OUTPUT,
      aggregated_output: FAKE_OUTPUT,
      formatted_output: FAKE_OUTPUT,
      exit_code: 0,
      status: 'completed',
      nested: { deeper: { url: FAKE_URL, path: FAKE_PATH, cmd: FAKE_CMD } },
    };
    const out = sanitize(item, null) as Record<string, unknown>;
    expect(out.command).toBe('<array:3>');
    expect(out.cwd).toBe(`<string:${FAKE_PATH.length}>`);
    expect(out.stdout).toBe(`<string:${FAKE_OUTPUT.length}>`);
    expect(out.exit_code).toBe(0);
    expect(out.status).toBe('completed');
    expect(out.id).toBe(ITEM_ID);
    expectNoSentinels(out);
  });

  it('reduces parsed_cmd entries to their type only (no name, path or cmd)', () => {
    const out = sanitize(
      {
        parsed_cmd: [
          { type: 'read', cmd: FAKE_CMD, name: 'FAKE_FILE.md', path: FAKE_PATH },
          { type: 'unknown', cmd: FAKE_CMD },
          'stray string',
        ],
      },
      null
    ) as { parsed_cmd: unknown[] };
    expect(out.parsed_cmd).toEqual([{ type: 'read' }, { type: 'unknown' }, '<string:12>']);
    expect(json(out)).not.toContain('FAKE_FILE');
    expectNoSentinels(out);
  });

  it('keeps content-item types but drops their text', () => {
    const out = sanitize(
      {
        content: [
          { type: 'input_text', text: FAKE_TEXT },
          { type: 'output_text', text: FAKE_OUTPUT, annotations: [{ url: FAKE_URL }] },
          FAKE_TEXT,
        ],
      },
      null
    ) as { content: Record<string, unknown>[] };
    expect(out.content[0].type).toBe('input_text');
    expect(out.content[0].text).toBe(`<string:${FAKE_TEXT.length}>`);
    expect(out.content[1].type).toBe('output_text');
    expect(out.content[2]).toBe(`<string:${FAKE_TEXT.length}>`);
    expectNoSentinels(out);
  });

  it('does not let the `name` allowlist leak file names through nested tool metadata', () => {
    const out = sanitize(
      {
        type: 'function_call',
        name: 'shell_command',
        arguments: json({ command: FAKE_CMD, workdir: FAKE_PATH }),
        metadata: { files: [{ name: 'private.txt', path: FAKE_PATH }] },
      },
      null
    ) as Record<string, unknown>;
    expect(out.name).toBe('shell_command');
    expect(out.arguments).toMatch(/^<string:\d+>$/);
    // `files` is an omitted key: only its size is kept.
    expect((out.metadata as Record<string, unknown>).files).toBe('<array:1>');
    expectNoSentinels(out);
  });

  it('truncates long arrays and preserves numbers, booleans and null', () => {
    const arr = Array.from({ length: MAX_ARRAY_ITEMS + 5 }, (_, i) => ({
      n: i,
      ok: true,
      t: FAKE_TEXT,
    }));
    const out = sanitize({ items: arr, count: 17, flag: false, none: null }, null) as Record<
      string,
      unknown
    >;
    const items = out.items as unknown[];
    expect(items).toHaveLength(MAX_ARRAY_ITEMS + 1);
    expect(items[MAX_ARRAY_ITEMS]).toBe('<...5 more>');
    expect(out.count).toBe(17);
    expect(out.flag).toBe(false);
    expect(out.none).toBeNull();
    expectNoSentinels(out);
  });

  it('sanitizes a realistic envelope line and records line/bytes', () => {
    const raw = json({
      timestamp: '2026-01-01T00:00:00.000Z',
      ordinal: 4,
      type: 'response_item',
      payload: {
        type: 'custom_tool_call',
        id: 'ctc_0123456789abcdef0123',
        call_id: CALL_ID,
        name: 'exec',
        status: 'completed',
        input: `tools.shell({ command: "${FAKE_CMD}" })`,
        internal_chat_message_metadata_passthrough: { turn_id: TURN_ID, create_time: 1.5 },
      },
    });
    const out = sanitizeLine(raw, 42);
    expect(out.line).toBe(42);
    expect(out.bytes).toBe(raw.length);
    expect(out.timestamp).toBe('2026-01-01T00:00:00.000Z');
    const payload = out.payload as Record<string, unknown>;
    expect(payload.call_id).toBe(CALL_ID);
    expect(payload.name).toBe('exec');
    expect(payload.input).toMatch(/^<string:\d+>$/);
    expectNoSentinels(out);
  });

  it('handles blank and malformed lines without throwing or echoing content', () => {
    expect(sanitizeLine('   ', 1)).toEqual({ line: 1, empty: true });
    const bad = sanitizeLine(`{not json ${FAKE_TEXT}`, 2);
    expect(bad.parse_error).toBe(true);
    expectNoSentinels(bad);
  });

  it('aliases object keys that look like paths or sentences', () => {
    const out = sanitize(
      { agents_md: { [FAKE_PATH]: { enabled: true }, 'two words': 1, ok_key: 2 } },
      null
    ) as { agents_md: Record<string, unknown> };
    expect(Object.keys(out.agents_md)).toEqual(['<key-1>', '<key-2>', 'ok_key']);
    expectNoSentinels(out);
  });
});

describe('codex-rollout-transcript sanitizer: agent and task names', () => {
  function sanitizeRecords(records: unknown[]): Record<string, unknown>[] {
    const sanitizer = new TranscriptSanitizer();
    return records.map((record, index) => sanitizer.line(json(record), index + 1));
  }

  const records = [
    {
      type: 'session_meta',
      payload: {
        id: TURN_ID,
        agent_nickname: FAKE_NICKNAME,
        agent_path: `/root/${FAKE_TASK}`,
        source: {
          subagent: {
            thread_spawn: {
              agent_path: `/root/${FAKE_TASK}`,
              agent_nickname: FAKE_NICKNAME,
              agent_role: FAKE_ROLE,
            },
          },
        },
      },
    },
    { type: 'inter_agent_communication_metadata', payload: { trigger_turn: true } },
    {
      type: 'response_item',
      payload: {
        type: 'agent_message',
        author: '/root',
        recipient: `/root/${FAKE_TASK}`,
        content: [{ type: 'input_text', text: `Task name: /root/${FAKE_TASK}` }],
      },
    },
    {
      type: 'response_item',
      payload: {
        type: 'agent_message',
        author: `/root/${FAKE_TASK}/helper_for_acme`,
        recipient: `/root/${FAKE_TASK}`,
        task_name: FAKE_TASK,
      },
    },
  ];

  it('keeps the root agent path and aliases every task segment below it', () => {
    const [meta, , task, reply] = sanitizeRecords(records).map(
      (record) => record.payload as Record<string, unknown>
    );
    expect(task.author).toBe('/root');
    expect(task.recipient).toBe('/root/<task-1>');
    expect(meta.agent_path).toBe('/root/<task-1>');
    expect(reply.author).toBe('/root/<task-1>/<task-2>');
    expect(reply.task_name).toBe('<task-1>');
    expectNoSentinels([meta, task, reply]);
  });

  it('gives the same nickname or role the same alias wherever it appears', () => {
    const [meta] = sanitizeRecords(records).map(
      (record) => record.payload as Record<string, unknown>
    );
    const spawn = (meta.source as { subagent: { thread_spawn: Record<string, unknown> } }).subagent
      .thread_spawn;
    expect(meta.agent_nickname).toBe('<agent-1>');
    expect(spawn.agent_nickname).toBe('<agent-1>');
    expect(spawn.agent_path).toBe('/root/<task-1>');
    expect(spawn.agent_role).toBe('<role-1>');
  });

  it('is deterministic: the same rollout always yields the same transcript', () => {
    expect(json(sanitizeRecords(records))).toBe(json(sanitizeRecords(records)));
  });

  it('keeps Codex tool names and namespaces and aliases the ones users configure', () => {
    const sanitizer = new TranscriptSanitizer();
    const calls = [
      { type: 'function_call', name: 'exec_command', call_id: CALL_ID },
      { type: 'function_call', name: 'sleep', namespace: 'clock' },
      { type: 'function_call', name: 'js', namespace: 'mcp__node_repl' },
      { type: 'function_call', name: FAKE_TOOL, namespace: `mcp__${FAKE_SERVER}` },
      { type: 'function_call', name: `mcp__${FAKE_SERVER}__${FAKE_TOOL}` },
      { type: 'function_call', name: 'deploy_acme' },
    ].map((call) => sanitizer.value(call, null) as Record<string, unknown>);
    expect(calls.map((call) => [call.name, call.namespace])).toEqual([
      ['exec_command', undefined],
      ['sleep', 'clock'],
      ['js', 'mcp__node_repl'],
      ['<tool-1>', 'mcp__<server-1>'],
      ['mcp__<server-1>__<tool-1>', undefined],
      ['<tool-2>', undefined],
    ]);
    expectNoSentinels(calls);
  });
});

describe('codex-rollout-transcript sanitizer: model identifiers', () => {
  function payloads(records: unknown[]): Record<string, unknown>[] {
    const sanitizer = new TranscriptSanitizer();
    return records.map(
      (record, index) => sanitizer.line(json(record), index + 1).payload as Record<string, unknown>
    );
  }

  it('gives equal model names equal aliases and distinct model names distinct aliases', () => {
    const out = payloads([
      { type: 'turn_context', payload: { turn_id: TURN_ID, model: FAKE_MODEL } },
      {
        type: 'event_msg',
        payload: { type: 'model_reroute', from_model: FAKE_MODEL, to_model: OTHER_MODEL },
      },
      {
        type: 'event_msg',
        payload: {
          type: 'thread_settings_applied',
          settings: { model: OTHER_MODEL, collaboration_mode: { settings: { model: FAKE_MODEL } } },
        },
      },
      // Not even token-shaped: still only an alias.
      { type: 'turn_context', payload: { model: FAKE_URL } },
    ]);
    expect(out[0].model).toBe('<model-1>');
    expect(out[1]).toMatchObject({ from_model: '<model-1>', to_model: '<model-2>' });
    expect(out[2]).toMatchObject({
      settings: { model: '<model-2>', collaboration_mode: { settings: { model: '<model-1>' } } },
    });
    expect(out[3].model).toBe('<model-3>');
    expectNoSentinels(out);
  });

  it('keeps model providers Codex defines and aliases the ones users configure', () => {
    const out = payloads([
      { type: 'session_meta', payload: { model_provider: 'openai' } },
      { type: 'session_meta', payload: { model_provider: FAKE_PROVIDER } },
      { type: 'session_meta', payload: { model_provider: FAKE_PROVIDER } },
    ]);
    expect(out.map((payload) => payload.model_provider)).toEqual([
      'openai',
      '<provider-1>',
      '<provider-1>',
    ]);
    expectNoSentinels(out);
  });

  it('aliases model names left by older rules when re-sanitizing, without renumbering', () => {
    const lines = [
      json({ line: 1, type: 'turn_context', payload: { model: '<model-1>' } }),
      json({ line: 2, type: 'turn_context', payload: { model: FAKE_MODEL } }),
      json({ line: 3, type: 'turn_context', payload: { model: FAKE_MODEL } }),
    ];
    const once = resanitizeTranscript(lines);
    expect(once.map((line) => (JSON.parse(line) as { payload: unknown }).payload)).toEqual([
      { model: '<model-1>' },
      { model: '<model-2>' },
      { model: '<model-2>' },
    ]);
    expect(resanitizeTranscript(once)).toEqual(once);
    expectNoSentinels(once);
  });
});

describe('codex-rollout-transcript sanitizer: re-sanitizing a transcript', () => {
  const header = {
    transcript: 'codex-rollout-structural',
    generated: '2026-09-27T00:00:00.000Z',
    rollout_file: 'rollout-2026-09-27T00-00-00-01a00000-0000-7000-8000-000000000001.jsonl',
  };

  it('applies the current rules while keeping line, bytes, placeholders and separators', () => {
    const lines = [
      json(header),
      json({ _evidence_window: 1, source_rollout: 'rollout-x.jsonl', focus: 'window focus' }),
      json({
        line: 7,
        bytes: 999,
        type: 'response_item',
        payload: {
          type: 'agent_message',
          recipient: `/root/${FAKE_TASK}`,
          content: [{ type: 'input_text', text: '<string:91>' }],
          list: [...Array.from({ length: MAX_ARRAY_ITEMS }, () => '<string:3>'), '<...6 more>'],
          agent_path: '<string:33>',
        },
      }),
      json({ line: 8, empty: true }),
      json({ transcript_end: true, lines: 8, parse_failed: 0 }),
    ];
    const out = resanitizeTranscript(lines).map(
      (line) => JSON.parse(line) as Record<string, unknown>
    );
    expect(out[0]).toMatchObject({ ...header, sanitizer_version: 2 });
    expect(out[1]).toEqual(JSON.parse(lines[1]));
    expect(out[2]).toMatchObject({
      line: 7,
      bytes: 999,
      payload: {
        recipient: '/root/<task-1>',
        content: [{ type: 'input_text', text: '<string:91>' }],
        agent_path: '<string:33>',
      },
    });
    expect((out[2].payload as { list: string[] }).list.at(-1)).toBe('<...6 more>');
    expect(out.slice(3)).toEqual([JSON.parse(lines[3]), JSON.parse(lines[4])]);
    expectNoSentinels(out);
  });

  it('is idempotent and never reuses an alias already present', () => {
    const lines = [
      json({ line: 1, type: 'response_item', payload: { recipient: '/root/<task-1>' } }),
      json({ line: 2, type: 'response_item', payload: { recipient: `/root/${FAKE_TASK}` } }),
    ];
    const once = resanitizeTranscript(lines);
    expect(once.map((line) => (JSON.parse(line) as { payload: unknown }).payload)).toEqual([
      { recipient: '/root/<task-1>' },
      { recipient: '/root/<task-2>' },
    ]);
    expect(resanitizeTranscript(once)).toEqual(once);
  });

  it('recognizes its own output tokens', () => {
    for (const token of [
      '<string:4>',
      '<array:2>',
      '<object:1>',
      '<object>',
      '<...3 more>',
      '<task-12>',
      '<model-2>',
      '<provider-1>',
    ]) {
      expect(isSanitizedToken(token)).toBe(true);
    }
    expect(isSanitizedToken('<script>')).toBe(false);
  });
});

describe('real-observed fixtures honour the sanitizer contract', () => {
  const files = fs.existsSync(REAL_OBSERVED)
    ? fs.readdirSync(REAL_OBSERVED).filter((f) => f.endsWith('.jsonl'))
    : [];

  it('has committed fixtures to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const text = fs.existsSync(path.join(REAL_OBSERVED, file))
      ? fs.readFileSync(path.join(REAL_OBSERVED, file), 'utf8')
      : '';
    const lines = text.split('\n').filter((l) => l.trim() !== '');

    it(`${file}: is unchanged by the current sanitizer`, () => {
      // Every value in the fixture already satisfies the current rules: nothing
      // the sanitizer would replace or alias survives in committed evidence.
      expect(resanitizeTranscript(lines)).toEqual(lines);
    });

    it(`${file}: contains no paths, URLs, addresses or shell-looking strings`, () => {
      expect(text).not.toMatch(/[A-Za-z]:\\\\/);
      expect(text).not.toMatch(/\\\\\\\\[A-Za-z0-9]/);
      expect(text).not.toMatch(/https?:\/\//);
      expect(text).not.toMatch(/\/(home|Users|mnt|var|tmp)\//);
      expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
      expect(text).not.toMatch(/"(cwd|command|stdout|stderr|input|output|arguments|text)":"(?!<)/);
    });

    it(`${file}: agent, task and model names appear only as aliases`, () => {
      const offenders: string[] = [];
      const walk = (value: unknown, key: string | null, lineNo: number): void => {
        if (typeof value === 'string') {
          const agentKey =
            key !== null &&
            /^(author|recipient|sender|agent_path|task_name|agent_nickname|nickname|agent_name|agent_role|agent_type|model|from_model|to_model)$/.test(
              key
            );
          const aliasOnly = value
            .split('/')
            .every(
              (part, i) => part === '' || (i === 1 && part === 'root') || isSanitizedToken(part)
            );
          if (agentKey && !aliasOnly) offenders.push(`${file}:${lineNo} ${key}`);
          return;
        }
        if (Array.isArray(value)) {
          value.forEach((v) => walk(v, key, lineNo));
          return;
        }
        if (value && typeof value === 'object') {
          for (const [k, v] of Object.entries(value as Record<string, unknown>)) walk(v, k, lineNo);
        }
      };
      lines.forEach((l, i) => walk(JSON.parse(l), null, i + 1));
      expect(offenders).toEqual([]);
    });
  }
});
