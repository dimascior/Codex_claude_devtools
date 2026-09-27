/**
 * Codex rollout structural transcript (sanitizer).
 *
 * Reads one rollout (read-only) and writes a sanitized JSONL transcript that
 * preserves the real record ordering, line numbers, timestamps, record and
 * payload types, IDs, statuses, tool names and content-item types, but never
 * message text, commands, arguments, outputs, code, paths or URLs: every
 * string not in the allowlist below is replaced by "<string:N>" (N = length).
 *
 * This script is tooling. It produced the fixtures under
 * tests/fixtures/codex/real-observed but is not itself empirical evidence of
 * Codex behaviour; see docs/codex-real-validation/README.md.
 *
 * Usage (from the repository root):
 *   pnpm exec tsx scripts/codex-rollout-transcript.ts --file ROLLOUT.jsonl --out FILE
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';

// Keys whose string values are structural (type names, enum values, IDs).
export const KEEP_STRING_KEYS = new Set([
  'type',
  'role',
  'status',
  'phase',
  'id',
  'call_id',
  'item_id',
  'turn_id',
  'cell_id',
  'thread_id',
  'session_id',
  'forked_from_id',
  'parent_thread_id',
  'name',
  'namespace',
  'model',
  'model_provider',
  'originator',
  'cli_version',
  'source',
  'execution',
  'agent_role',
  'agent_type',
  'agent_nickname',
  'author',
  'recipient',
  'approval_policy',
  'sandbox_policy',
  'reasoning_effort',
  'reasoning_summary',
  'effort',
  'summary_mode',
  'mode',
  'kind',
  'timestamp',
  'created_at',
  'updated_at',
  'started_at',
  'finished_at',
  'format',
  'network_access',
  'reason',
  'tool_calls_complete',
  'memory_mode',
  'collaboration_mode',
]);

// Keys whose values are removed entirely (only their size is reported).
export const OMIT_KEYS = new Set([
  'text',
  'arguments',
  'input',
  'output',
  'command',
  'cwd',
  'working_directory',
  'summary',
  'content',
  'encrypted_content',
  'query',
  'url',
  'pattern',
  'revised_prompt',
  'result',
  'aggregated_output',
  'formatted_output',
  'repository_url',
  'branch',
  'commit_hash',
  'agent_path',
  'instructions',
  'base_instructions',
  'user_instructions',
  'developer_instructions',
  'stdout',
  'stderr',
  'diff',
  'changes',
  'files',
  'path',
  'file_path',
  'image_url',
  'data',
  'message',
  'delta',
  'title',
  'last_agent_message',
  'cmd',
]);

// parsed_cmd entries describe the shell command; only their `type` is structural.
const PARSED_CMD_KEY = 'parsed_cmd';

export const MAX_ARRAY_ITEMS = 12;

export function sizeOf(value: unknown): string {
  if (typeof value === 'string') return `<string:${value.length}>`;
  if (Array.isArray(value)) return `<array:${value.length}>`;
  if (value && typeof value === 'object') return `<object:${Object.keys(value).length}>`;
  return `<${typeof value}>`;
}

export function sanitize(value: unknown, key: string | null): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (key !== null && KEEP_STRING_KEYS.has(key)) return value;
    return `<string:${value.length}>`;
  }
  if (Array.isArray(value)) {
    if (key === PARSED_CMD_KEY) {
      return value.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? { type: (item as Record<string, unknown>).type }
          : sizeOf(item),
      );
    }
    // Preserve content-item types for `content` arrays, but nothing else.
    if (key === 'content') {
      return value.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? sanitize(item, null)
          : sizeOf(item),
      );
    }
    const head = value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitize(item, key));
    if (value.length > MAX_ARRAY_ITEMS) head.push(`<...${value.length - MAX_ARRAY_ITEMS} more>`);
    return head;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (OMIT_KEYS.has(k)) {
        if (k === 'content' && Array.isArray(v)) {
          out[k] = sanitize(v, k);
        } else {
          out[k] = sizeOf(v);
        }
        continue;
      }
      out[k] = sanitize(v, k);
    }
    return out;
  }
  return sizeOf(value);
}

/** Sanitize one raw rollout line into a transcript record. */
export function sanitizeLine(raw: string, lineNumber: number): Record<string, unknown> {
  if (raw.trim() === '') return { line: lineNumber, empty: true };
  let record: unknown;
  try {
    record = JSON.parse(raw);
  } catch {
    return { line: lineNumber, parse_error: true, bytes: raw.length };
  }
  const sanitized = sanitize(record, null);
  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) {
    return { line: lineNumber, bytes: raw.length, non_object: sizeOf(record) };
  }
  return { line: lineNumber, bytes: raw.length, ...(sanitized as Record<string, unknown>) };
}

function parseArgs(argv: string[]): { file: string; out: string } {
  let file = '';
  let out = '';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file') file = argv[++i] ?? '';
    else if (argv[i] === '--out') out = argv[++i] ?? '';
  }
  if (!file) throw new Error('--file ROLLOUT.jsonl is required');
  if (!out) {
    out = path.join('real-data', `${path.basename(file, '.jsonl')}.structural.jsonl`);
  }
  return { file, out };
}

async function main(): Promise<void> {
  const { file, out } = parseArgs(process.argv.slice(2));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const writer = fs.createWriteStream(out, { encoding: 'utf8' });

  const header = {
    transcript: 'codex-rollout-structural',
    generated: new Date().toISOString(),
    rollout_file: path.basename(file),
    rollout_bytes: fs.statSync(file).size,
    note: 'Free-text strings replaced by <string:N>; ordering, types and IDs preserved.',
  };
  writer.write(JSON.stringify(header) + '\n');

  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let lineNumber = 0;
  let failed = 0;
  for await (const raw of rl) {
    lineNumber++;
    const record = sanitizeLine(raw, lineNumber);
    if (record.parse_error) failed++;
    writer.write(JSON.stringify(record) + '\n');
  }

  writer.write(
    JSON.stringify({ transcript_end: true, lines: lineNumber, parse_failed: failed }) + '\n',
  );
  await new Promise<void>((resolve, reject) => {
    writer.end(() => resolve());
    writer.on('error', reject);
  });
  console.error(`Transcript written to ${path.resolve(out)} (${lineNumber} lines, ${failed} parse failures)`);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
