import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

import {
  KEEP_STRING_KEYS,
  MAX_ARRAY_ITEMS,
  OMIT_KEYS,
  sanitize,
  sanitizeLine,
} from '../../scripts/codex-rollout-transcript';

const REAL_OBSERVED = path.resolve(__dirname, '../../tests/fixtures/codex/real-observed');

// Fabricated sentinel values (not real data) that must never appear in sanitizer output.
const FAKE_PATH = 'C:\\Users\\someone\\Projects\\private-repo\\src\\index.ts';
const FAKE_CMD = 'rm -rf /var/lib/private && cat ~/.ssh/id_ed25519';
const FAKE_OUTPUT = 'Traceback (most recent call last): confidential stack';
const FAKE_URL = 'https://internal.example.test/private?token=abc123';
const FAKE_TEXT = 'Please refactor the billing module for Acme Corp';

const SENTINELS = [FAKE_PATH, FAKE_CMD, FAKE_OUTPUT, FAKE_URL, FAKE_TEXT];

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
  expect(text).not.toContain('.ssh');
}

describe('codex-rollout-transcript sanitizer', () => {
  it('replaces strings under unknown keys with <string:N>', () => {
    const out = sanitize({ foo: FAKE_TEXT }, null) as Record<string, unknown>;
    expect(out.foo).toBe(`<string:${FAKE_TEXT.length}>`);
    expectNoSentinels(out);
  });

  it('keeps only allowlisted structural string keys', () => {
    const out = sanitize(
      {
        type: 'response_item',
        role: 'user',
        status: 'completed',
        call_id: 'call_abc',
        name: 'exec',
        model: 'gpt-x',
        random_key: 'must vanish',
      },
      null,
    ) as Record<string, unknown>;
    expect(out.type).toBe('response_item');
    expect(out.role).toBe('user');
    expect(out.status).toBe('completed');
    expect(out.call_id).toBe('call_abc');
    expect(out.name).toBe('exec');
    expect(out.model).toBe('gpt-x');
    expect(out.random_key).toBe('<string:11>');
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
      id: 'exec-1',
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
    expect(out.id).toBe('exec-1');
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
      null,
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
      null,
    ) as { content: Array<Record<string, unknown>> };
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
      null,
    ) as Record<string, unknown>;
    expect(out.name).toBe('shell_command');
    expect(out.arguments).toMatch(/^<string:\d+>$/);
    // `files` is an omitted key: only its size is kept.
    expect((out.metadata as Record<string, unknown>).files).toBe('<array:1>');
    expectNoSentinels(out);
  });

  it('truncates long arrays and preserves numbers, booleans and null', () => {
    const arr = Array.from({ length: MAX_ARRAY_ITEMS + 5 }, (_, i) => ({ n: i, ok: true, t: FAKE_TEXT }));
    const out = sanitize({ items: arr, count: 17, flag: false, none: null }, null) as Record<string, unknown>;
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
        id: 'ctc_1',
        call_id: 'call_1',
        name: 'exec',
        status: 'completed',
        input: `tools.shell({ command: "${FAKE_CMD}" })`,
        internal_chat_message_metadata_passthrough: { turn_id: 'turn_1', create_time: 1.5 },
      },
    });
    const out = sanitizeLine(raw, 42);
    expect(out.line).toBe(42);
    expect(out.bytes).toBe(raw.length);
    expect(out.timestamp).toBe('2026-01-01T00:00:00.000Z');
    const payload = out.payload as Record<string, unknown>;
    expect(payload.call_id).toBe('call_1');
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
});

describe('real-observed fixtures honour the sanitizer contract', () => {
  const files = fs.existsSync(REAL_OBSERVED)
    ? fs.readdirSync(REAL_OBSERVED).filter((f) => f.endsWith('.jsonl'))
    : [];

  it('has committed fixtures to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file}: only allowlisted keys carry free-form strings`, () => {
      const lines = fs
        .readFileSync(path.join(REAL_OBSERVED, file), 'utf8')
        .split('\n')
        .filter((l) => l.trim() !== '');
      const offenders: string[] = [];
      const walk = (value: unknown, key: string | null, lineNo: number): void => {
        if (typeof value === 'string') {
          const placeholder = /^<(string|array|object|\.\.\.\d+ more|[a-z]+):?\d*>$/.test(value);
          if (placeholder) return;
          if (key !== null && KEEP_STRING_KEYS.has(key)) return;
          // Synthetic separator / header records are allowed descriptive text.
          if (key !== null && /^(_|source_|focus$|note$|rollout_file$|transcript$|generated$)/.test(key)) return;
          offenders.push(`${file}:${lineNo} ${key ?? '<root>'}=${value.slice(0, 40)}`);
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

    it(`${file}: contains no drive paths, URLs or shell-looking strings`, () => {
      const text = fs.readFileSync(path.join(REAL_OBSERVED, file), 'utf8');
      expect(text).not.toMatch(/[A-Za-z]:\\\\/);
      expect(text).not.toMatch(/https?:\/\//);
      expect(text).not.toMatch(/"(cwd|command|stdout|stderr|input|output|arguments|text)":"(?!<)/);
    });
  }
});
