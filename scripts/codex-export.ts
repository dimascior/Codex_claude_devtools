/**
 * Codex session export.
 *
 * Prints one Codex rollout as the viewer's normalized session (timeline,
 * executions with their inputs, outputs and recorded file writes, stats,
 * runtime state) as JSON, for tools that need Codex activity without depending
 * on the rollout's raw JSONL format. It runs the same reader and normalizer as
 * the app, so the provider's tests catch rollout format changes for them too.
 *
 * The output carries the session's content (messages, commands, outputs, file
 * text): treat it like the rollout itself. Encrypted payloads are stripped by
 * the reader, as in the app.
 *
 * Usage (from the repository root):
 *   pnpm exec tsx scripts/codex-export.ts <rollout.jsonl[.zst]> [--until-line N] [--out FILE]
 *
 *   --until-line N  export the session as it was before rollout line N
 *                   (e.g. the line of a compaction record)
 *   --out FILE      write the JSON to FILE instead of stdout
 */

import * as fs from 'fs';

import { normalizeCodexRollout } from '../src/main/providers/codex/CodexExecutionNormalizer';
import { readRolloutRecords } from '../src/main/providers/codex/CodexRolloutParser';

const EXPORT_SCHEMA = 'codex-export.v1';

interface ExportArgs {
  file: string;
  untilLine?: number;
  out?: string;
}

function usage(message: string): never {
  process.stderr.write(
    `${message}\nUsage: pnpm exec tsx scripts/codex-export.ts <rollout.jsonl[.zst]> [--until-line N] [--out FILE]\n`
  );
  process.exit(2);
}

function parseArgs(argv: string[]): ExportArgs {
  let file: string | undefined;
  let untilLine: number | undefined;
  let out: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--until-line') {
      untilLine = Number(argv[++i]);
      if (!Number.isInteger(untilLine) || untilLine < 2)
        usage('--until-line needs a line number of 2 or more');
    } else if (arg === '--out') {
      out = argv[++i];
      if (!out) usage('--out needs a file path');
    } else if (arg.startsWith('--')) {
      usage(`Unknown option ${arg}`);
    } else if (file === undefined) {
      file = arg;
    } else {
      usage(`Unexpected argument ${arg}`);
    }
  }
  if (!file) usage('Missing rollout path');
  if (!fs.existsSync(file)) usage(`No such file: ${file}`);
  return { file, untilLine, out };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { records, malformedLines } = await readRolloutRecords(
    args.file,
    args.untilLine === undefined ? {} : { maxLines: args.untilLine - 1 }
  );
  const session = normalizeCodexRollout(records, { active: false });
  const json = JSON.stringify({
    schema: EXPORT_SCHEMA,
    file: args.file,
    untilLine: args.untilLine ?? null,
    records: records.length,
    malformedLines,
    session,
  });
  if (args.out) {
    fs.writeFileSync(args.out, json);
  } else {
    process.stdout.write(json);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
