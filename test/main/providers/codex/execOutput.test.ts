import { describe, expect, it } from 'vitest';

import {
  classifyOutcomeText,
  durationToMs,
  outputBodyToText,
  parseToolOutput,
} from '../../../../src/main/providers/codex/execOutput';

describe('parseToolOutput', () => {
  it('parses structured JSON shell output', () => {
    expect(
      parseToolOutput('{"output":"hello\\n","metadata":{"exit_code":2,"duration_seconds":1.25}}')
    ).toEqual({ body: 'hello\n', recognized: true, exitCode: 2, wallTimeMs: 1250 });
  });

  it('parses freeform shell output', () => {
    expect(
      parseToolOutput(
        'Exit code: 1\nWall time: 0.5 seconds\nTotal output lines: 300\nOutput:\nboom'
      )
    ).toEqual({
      body: 'boom',
      recognized: true,
      exitCode: 1,
      wallTimeMs: 500,
      totalOutputLines: 300,
    });
  });

  it('parses unified exec output for finished and running processes', () => {
    expect(
      parseToolOutput(
        'Chunk ID: ab12\nWall time: 0.5012 seconds\nProcess exited with code 0\nOriginal token count: 9\nOutput:\nok'
      )
    ).toMatchObject({ exitCode: 0, wallTimeMs: 501, chunkId: 'ab12', body: 'ok' });

    const running = parseToolOutput(
      'Wall time: 10.0000 seconds\nProcess running with session ID 42\nOutput:\n'
    );
    expect(running).toMatchObject({ processId: '42', body: '', recognized: true });
    expect(running.exitCode).toBeUndefined();
  });

  it('parses code-mode headers including host timing details', () => {
    expect(
      parseToolOutput(
        'Script failed\nWall time 1.234 seconds (code-mode 1.000 seconds; overhead 0.234 seconds)\nOutput:\nScript error:\nx'
      )
    ).toMatchObject({ scriptStatus: 'failed', wallTimeMs: 1234, body: 'Script error:\nx' });
    expect(
      parseToolOutput('Script running with cell ID c-9\nWall time 10.0 seconds\nOutput:\n')
    ).toMatchObject({ scriptStatus: 'running', cellId: 'c-9' });
  });

  it('leaves unrecognised text untouched', () => {
    expect(parseToolOutput('Output:\nnot a header')).toEqual({
      body: 'Output:\nnot a header',
      recognized: false,
    });
    expect(parseToolOutput('Exit code: 0\nsomething else\nOutput:\nx')).toEqual({
      body: 'Exit code: 0\nsomething else\nOutput:\nx',
      recognized: false,
    });
  });
});

describe('outputBodyToText', () => {
  it('flattens content items and counts images', () => {
    expect(
      outputBodyToText([
        { type: 'input_text', text: 'Script completed\nWall time 1.0 seconds\nOutput:\n' },
        { type: 'input_text', text: 'hello' },
        { type: 'input_image', image_url: '[omitted]' },
        { type: 'input_text', text: 'world' },
      ])
    ).toEqual({
      text: 'Script completed\nWall time 1.0 seconds\nOutput:\nhello\nworld',
      imageCount: 1,
    });
  });

  it('accepts plain strings and the legacy {content} object', () => {
    expect(outputBodyToText('x')).toEqual({ text: 'x', imageCount: 0 });
    expect(outputBodyToText({ content: 'y', success: false })).toEqual({
      text: 'y',
      imageCount: 0,
    });
  });
});

describe('classifyOutcomeText', () => {
  it('recognizes declined, interrupted and failed outcomes', () => {
    expect(classifyOutcomeText('exec command rejected by user')).toBe('declined');
    expect(classifyOutcomeText('aborted')).toBe('interrupted');
    expect(classifyOutcomeText('failed to parse function arguments: missing field')).toBe('failed');
    expect(classifyOutcomeText('Plan updated')).toBeUndefined();
  });
});

describe('durationToMs', () => {
  it('converts serde durations, numbers and strings', () => {
    expect(durationToMs({ secs: 1, nanos: 500_000_000 })).toBe(1500);
    expect(durationToMs(42)).toBe(42);
    expect(durationToMs('2.5s')).toBe(2500);
    expect(durationToMs('750ms')).toBe(750);
    expect(durationToMs('soon')).toBeUndefined();
  });
});
