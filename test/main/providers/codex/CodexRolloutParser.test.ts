import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
import { afterEach, describe, expect, it } from 'vitest';

import {
  isZstdSupported,
  parseRolloutLine,
  readRolloutRecords,
  readRolloutTail,
  STRIPPED_MARKER,
} from '../../../../src/main/providers/codex/CodexRolloutParser';

const FIXTURES = path.resolve(__dirname, '../../../fixtures/codex');

describe('CodexRolloutParser', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  function tempFile(name: string, content: string | Buffer): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-rollout-'));
    tempDirs.push(dir);
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  it('parses envelope records with line numbers and timestamps', async () => {
    const { records, malformedLines, nextLineNumber } = await readRolloutRecords(
      path.join(FIXTURES, 'function-calls.jsonl')
    );
    expect(records).toHaveLength(25);
    expect(malformedLines).toBe(0);
    expect(nextLineNumber).toBe(26);
    expect(records[0]).toMatchObject({
      lineNumber: 1,
      timestamp: '2026-09-23T22:40:58.001Z',
      type: 'session_meta',
    });
    // Large, never-rendered fields are dropped.
    expect(records[0].payload.base_instructions).toBeUndefined();
    expect(records[7].payload.encrypted_content).toBe(STRIPPED_MARKER);
  });

  it('normalizes legacy bare lines and skips state lines', async () => {
    const { records } = await readRolloutRecords(path.join(FIXTURES, 'legacy-bare.jsonl'));
    expect(records.map((record) => [record.lineNumber, record.type])).toEqual([
      [1, 'session_meta'],
      [3, 'response_item'],
      [4, 'response_item'],
      [5, 'response_item'],
      [6, 'response_item'],
      [7, 'response_item'],
    ]);
  });

  it('strips inline image data but keeps its presence', () => {
    const record = parseRolloutLine(
      JSON.stringify({
        timestamp: 't',
        type: 'response_item',
        payload: {
          type: 'function_call_output',
          call_id: 'c',
          output: [{ type: 'input_image', image_url: 'data:image/png;base64,AAAA' }],
        },
      }),
      1
    );
    expect(record?.payload.output).toEqual([{ type: 'input_image', image_url: STRIPPED_MARKER }]);
  });

  it('counts malformed lines without failing', async () => {
    const filePath = tempFile(
      'rollout.jsonl',
      '{"timestamp":"t","type":"event_msg","payload":{"type":"task_started"}}\nnot json\n\n[1,2]\n'
    );
    const result = await readRolloutRecords(filePath);
    expect(result.records).toHaveLength(1);
    expect(result.malformedLines).toBe(2);
    expect(result.nextLineNumber).toBe(5);
  });

  it('resumes from a byte offset and leaves an unterminated line for the next read', async () => {
    const first = '{"timestamp":"a","type":"event_msg","payload":{"type":"task_started"}}\n';
    const partial = '{"timestamp":"b","type":"event_msg","payload":{"type":"token_';
    const filePath = tempFile('rollout.jsonl', first + partial);

    const initial = await readRolloutRecords(filePath);
    expect(initial.records).toHaveLength(1);
    expect(initial.tail).toBeUndefined();
    expect(initial.nextOffset).toBe(Buffer.byteLength(first));

    // The writer finishes the line and appends another one (with multibyte text).
    fs.appendFileSync(
      filePath,
      'count"}}\n{"timestamp":"c","type":"event_msg","payload":{"type":"user_message","message":"héllo ✓"}}\n'
    );
    const next = await readRolloutRecords(filePath, {
      fromOffset: initial.nextOffset,
      startLineNumber: initial.nextLineNumber,
    });
    expect(next.records.map((record) => [record.lineNumber, record.payload.type])).toEqual([
      [2, 'token_count'],
      [3, 'user_message'],
    ]);
    expect(next.records[1].payload.message).toBe('héllo ✓');
    expect(next.nextOffset).toBe(fs.statSync(filePath).size);
  });

  it('returns a complete but unterminated final line as a provisional tail', async () => {
    const filePath = tempFile(
      'rollout.jsonl',
      '{"timestamp":"a","type":"event_msg","payload":{"type":"task_started"}}\n{"timestamp":"b","type":"event_msg","payload":{"type":"task_complete"}}'
    );
    const result = await readRolloutRecords(filePath);
    expect(result.records).toHaveLength(1);
    expect(result.tail).toMatchObject({ lineNumber: 2, payload: { type: 'task_complete' } });
    expect(result.nextLineNumber).toBe(2);
  });

  it('stops early when asked', async () => {
    const result = await readRolloutRecords(path.join(FIXTURES, 'function-calls.jsonl'), {
      stopWhen: (record) => record.type === 'turn_context',
    });
    expect(result.stoppedEarly).toBe(true);
    expect(result.records).toHaveLength(2);
  });

  it('reads the tail of a rollout', async () => {
    const records = await readRolloutTail(path.join(FIXTURES, 'function-calls.jsonl'), 600);
    expect(records.length).toBeGreaterThan(0);
    expect(records[records.length - 1].payload.type).toBe('task_complete');
  });

  it.runIf(isZstdSupported())('reads zstd-compressed rollouts', async () => {
    const plain = fs.readFileSync(path.join(FIXTURES, 'code-mode.jsonl'));
    const compress = (zlib as unknown as { zstdCompressSync: (input: Buffer) => Buffer })
      .zstdCompressSync;
    const filePath = tempFile('rollout-2026-09-24T09-00-00-abc.jsonl.zst', compress(plain));
    const { records } = await readRolloutRecords(filePath);
    expect(records).toHaveLength(13);
    expect(records[5].payload.name).toBe('exec');
  });
});
