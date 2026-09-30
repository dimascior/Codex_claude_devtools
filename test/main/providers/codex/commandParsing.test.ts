import * as path from 'path';
import { describe, expect, it } from 'vitest';

import { parseCodeCell, renderScriptValue } from '../../../../src/main/providers/codex/codeCell';
import {
  isRolloutFileName,
  parseRolloutFileName,
  resolveSessionFilePath,
  toSessionId,
} from '../../../../src/main/providers/codex/codexPaths';
import {
  extractPatchWrites,
  resolveWorkdir,
} from '../../../../src/main/providers/codex/CodexExecutionParser';
import {
  isInjectedContext,
  projectKeyForCwd,
} from '../../../../src/main/providers/codex/CodexMetadataParser';
import { describeArgv } from '../../../../src/main/providers/codex/shellCommand';

describe('describeArgv', () => {
  it('unwraps POSIX shell scripts', () => {
    expect(describeArgv(['bash', '-lc', 'git status'])).toEqual({
      command: 'git status',
      shell: 'bash',
    });
    expect(describeArgv(['/bin/zsh', '--login', '-c', 'ls -la'])).toEqual({
      command: 'ls -la',
      shell: 'zsh',
    });
  });

  it('unwraps PowerShell and cmd invocations', () => {
    expect(
      describeArgv([
        'powershell.exe',
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        'Get-ChildItem',
      ])
    ).toEqual({ command: 'Get-ChildItem', shell: 'powershell' });
    const encoded = Buffer.from('git status', 'utf16le').toString('base64');
    expect(describeArgv(['pwsh', '-EncodedCommand', encoded])).toEqual({
      command: 'git status',
      shell: 'pwsh',
    });
    expect(describeArgv(['cmd.exe', '/c', 'dir', '/b'])).toEqual({
      command: 'dir /b',
      shell: 'cmd',
    });
  });

  it('quotes plain argv', () => {
    expect(describeArgv(['rg', '-n', 'fn main', "it's"]).command).toBe(
      "rg -n 'fn main' 'it'\\''s'"
    );
    expect(describeArgv(['bash', 'script.sh'])).toEqual({ command: 'bash script.sh' });
  });
});

describe('parseCodeCell', () => {
  it('extracts nested tool calls with literal arguments', () => {
    const cell = parseCodeCell(
      [
        '// @exec: {"yield_time_ms": 1000}',
        '/* tools.fake({}) in a comment is ignored */',
        'const s = "tools.also_fake()";',
        'const a = await tools.exec_command({ cmd: "git status --short", workdir: `crates` });',
        "const b = await tools['mcp__docs__search']({ query: 'rollout', limit: 5, deep: true });",
        'await tools?.update_plan({ plan: [{ step: "x", status: "done" }] });',
      ].join('\n')
    );
    expect(cell.pragma).toEqual({ yield_time_ms: 1000 });
    expect(cell.calls).toEqual([
      {
        name: 'exec_command',
        args: { cmd: 'git status --short', workdir: 'crates' },
        dynamic: false,
        line: 3,
      },
      {
        name: 'mcp__docs__search',
        args: { query: 'rollout', limit: 5, deep: true },
        dynamic: false,
        line: 4,
      },
      {
        name: 'update_plan',
        args: { plan: [{ step: 'x', status: 'done' }] },
        dynamic: false,
        line: 5,
      },
    ]);
  });

  it('marks runtime-only argument parts as expressions', () => {
    const { calls } = parseCodeCell(
      'for (const c of cmds) { await tools.exec_command({ cmd, workdir: base + "/x", n: -1.5e3 }); }\n' +
        'await tools.exec_command({ cmd: `echo ${name}` });'
    );
    expect(calls[0]).toMatchObject({
      dynamic: true,
      args: { cmd: { $expr: 'cmd' }, workdir: { $expr: 'base + "/x"' }, n: -1500 },
    });
    expect(calls[1].args).toEqual({ cmd: { $expr: '`echo ${name}`' } });
    expect(renderScriptValue({ $expr: 'cmd' })).toBe('‹cmd›');
  });

  it('survives malformed scripts', () => {
    expect(parseCodeCell('await tools.exec_command({ cmd: "x" ]').calls).toHaveLength(1);
    expect(parseCodeCell('tools\nfoo(1); tools.').calls).toEqual([]);
    expect(parseCodeCell('await tools.x({ a: [1, 2 }').calls).toHaveLength(1);
  });
});

describe('codexPaths', () => {
  const root = path.resolve('/tmp/codex-home/sessions');

  it('resolves valid session ids inside the sessions directory', () => {
    const id = '2026/09/23/rollout-2026-09-23T22-40-58-0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b.jsonl';
    const resolved = resolveSessionFilePath(root, id);
    expect(resolved).toBe(path.join(root, '2026', '09', '23', id.split('/')[3]));
    expect(toSessionId(root, resolved!)).toBe(id);
  });

  it('rejects traversal, absolute paths and non-rollout files', () => {
    for (const id of [
      '../secrets/rollout-x.jsonl',
      '2026/../../rollout-x.jsonl',
      '/etc/rollout-x.jsonl',
      'C:/rollout-x.jsonl',
      '2026\\09\\rollout-x.jsonl',
      '2026/09/23/notes.txt',
      '1/2/3/4/rollout-x.jsonl',
      '',
      42,
    ]) {
      expect(resolveSessionFilePath(root, id)).toBeNull();
    }
  });

  it('recognizes rollout file names', () => {
    expect(isRolloutFileName('rollout-2026-09-23T22-40-58-abc.jsonl')).toBe(true);
    expect(isRolloutFileName('rollout-2026-09-23T22-40-58-abc.jsonl.zst')).toBe(true);
    expect(isRolloutFileName('history.jsonl')).toBe(false);
    const parsed = parseRolloutFileName(
      'rollout-2026-09-23T22-40-58-0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b_0199aaaa-0000-7000-8000-000000000000.jsonl'
    );
    expect(parsed?.threadId).toBe('0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b');
    expect(new Date(parsed!.startedAt).getHours()).toBe(22);
    expect(parseRolloutFileName('rollout-garbage.jsonl')).toBeNull();
  });
});

describe('path and patch helpers', () => {
  it('resolves workdirs against the turn cwd using its separator style', () => {
    expect(resolveWorkdir('C:\\src\\app', 'crates')).toBe('C:\\src\\app\\crates');
    expect(resolveWorkdir('/src/app/', './web')).toBe('/src/app/web');
    expect(resolveWorkdir('/src/app', '/tmp')).toBe('/tmp');
    expect(resolveWorkdir(undefined, 'rel')).toBe('rel');
  });

  it('groups working directories case-insensitively on Windows', () => {
    expect(projectKeyForCwd('C:/Users/Dev/src/')).toBe(projectKeyForCwd('c:\\users\\dev\\src'));
    expect(projectKeyForCwd('/home/a/')).toBe('/home/a');
  });

  it('lists the files a patch writes, with the change each header names', () => {
    expect(
      extractPatchWrites(
        '*** Begin Patch\n*** Add File: a.md\n+x\n*** Update File: src/b.rs\n*** Move to: src/c.rs\n*** Delete File: d.txt\n*** End Patch'
      )
    ).toEqual([
      { path: 'a.md', change: 'add' },
      { path: 'src/b.rs', change: 'update', movedTo: 'src/c.rs' },
      { path: 'd.txt', change: 'delete' },
    ]);
    // A move follows its own update header, even when that file is listed twice.
    expect(
      extractPatchWrites(
        '*** Update File: a.ts\n*** Update File: b.ts\n*** Update File: a.ts\n*** Move to: c.ts'
      )
    ).toEqual([
      { path: 'a.ts', change: 'update', movedTo: 'c.ts' },
      { path: 'b.ts', change: 'update' },
    ]);
  });

  it('detects injected context blocks', () => {
    expect(isInjectedContext('<environment_context>\n<cwd>/x</cwd>\n</environment_context>')).toBe(
      true
    );
    expect(isInjectedContext('<user_instructions type="agents">be terse</user_instructions>')).toBe(
      true
    );
    expect(isInjectedContext('# AGENTS.md instructions for /repo\n\n...')).toBe(true);
    expect(isInjectedContext('<b>bold</b> is how you write it?')).toBe(false);
    expect(isInjectedContext('Run the tests')).toBe(false);
  });
});
