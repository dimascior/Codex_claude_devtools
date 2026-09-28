/**
 * The repository layout must resolve the same on case-sensitive (Linux CI) and
 * case-insensitive (Windows, default macOS) filesystems.
 *
 * Two entries of one directory whose names, or module names (the file name
 * without its script extension, or a directory standing for its index), differ
 * only by letter case collide there: `import './CodexProvenance'` resolved to
 * the helper `codexProvenance.ts` instead of the component
 * `CodexProvenance.tsx` on Windows, while Linux passed.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = path.join(__dirname, '..');
const SCANNED = ['src', 'test', 'tests', 'scripts', 'docs'];
const MODULE_EXTENSION = /\.[cm]?[jt]sx?$/;

interface Entry {
  name: string;
  directory: boolean;
}

/**
 * Spellings in one directory that differ only by case, as full names or as
 * module names. Same-case module names (`a.ts` next to `a.tsx`) resolve the
 * same way everywhere and are not reported.
 */
function caseCollisions(entries: readonly Entry[]): string[][] {
  const spellings = new Map<string, Set<string>>();
  const add = (key: string, spelling: string): void => {
    const set = spellings.get(key) ?? new Set<string>();
    set.add(spelling);
    spellings.set(key, set);
  };
  for (const entry of entries) {
    add(`name:${entry.name.toLowerCase()}`, entry.name);
    const moduleName = entry.directory ? entry.name : entry.name.replace(MODULE_EXTENSION, '');
    if (entry.directory || moduleName !== entry.name) {
      add(`module:${moduleName.toLowerCase()}`, moduleName);
    }
  }
  return [...spellings.values()].filter((set) => set.size > 1).map((set) => [...set].sort());
}

function scan(dir: string, found: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const collisions = caseCollisions(
    entries.map((entry) => ({ name: entry.name, directory: entry.isDirectory() }))
  );
  const relative = path.relative(ROOT, dir).replace(/\\/g, '/');
  for (const names of collisions) found.push(`${relative}: ${names.join(' / ')}`);
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      scan(path.join(dir, entry.name), found);
    }
  }
}

describe('module layout on case-insensitive filesystems', () => {
  it('reports names that differ only by case, and nothing else', () => {
    expect(
      caseCollisions([
        { name: 'codexProvenance.ts', directory: false },
        { name: 'CodexProvenance.tsx', directory: false },
      ])
    ).toEqual([['CodexProvenance', 'codexProvenance']]);
    expect(
      caseCollisions([
        { name: 'Notes.md', directory: false },
        { name: 'notes.md', directory: false },
      ])
    ).toEqual([['Notes.md', 'notes.md']]);
    expect(
      caseCollisions([
        { name: 'utils.ts', directory: false },
        { name: 'Utils', directory: true },
      ])
    ).toEqual([['Utils', 'utils']]);
    expect(
      caseCollisions([
        { name: 'view.ts', directory: false },
        { name: 'view.tsx', directory: false },
        { name: 'view', directory: true },
        { name: 'codexProvenanceModel.ts', directory: false },
        { name: 'CodexProvenance.tsx', directory: false },
      ])
    ).toEqual([]);
  });

  it('has no directory entries that collide when case is ignored', () => {
    const found: string[] = [];
    for (const dir of SCANNED) {
      const full = path.join(ROOT, dir);
      if (fs.existsSync(full)) scan(full, found);
    }
    expect(found).toEqual([]);
  });
});
