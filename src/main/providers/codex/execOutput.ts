/**
 * Codex tool output parsing.
 *
 * Codex does not persist exec results as structured data in rollouts; exit
 * codes and timings only survive inside the text returned to the model. That
 * text uses one of several header formats depending on the tool generation:
 *
 * Structured shell (legacy `shell` tool):
 *   {"output":"…","metadata":{"exit_code":0,"duration_seconds":0.5}}
 *
 * Freeform shell (`shell`, `shell_command`, `local_shell`):
 *   Exit code: 0
 *   Wall time: 0.5 seconds
 *   [Total output lines: 120]
 *   Output:
 *   …
 *
 * Unified exec (`exec_command`, `write_stdin`):
 *   Chunk ID: 5f1c2a
 *   Wall time: 0.5012 seconds
 *   Process exited with code 0            (or: Process running with session ID 3)
 *   Original token count: 42
 *   Output:
 *   …
 *
 * Code mode (`exec` cells and `wait`):
 *   Script completed                      (failed / terminated / running with cell ID …)
 *   Wall time 1.2 seconds
 *   Output:
 *   …
 */

import { STRIPPED_MARKER } from './CodexRolloutParser';

export type ScriptStatus = 'completed' | 'failed' | 'terminated' | 'running';

export interface ParsedToolOutput {
  /** Output after the recognised header (or the whole text) */
  body: string;
  /** Whether a structured header was recognised */
  recognized: boolean;
  exitCode?: number;
  wallTimeMs?: number;
  /** Unified exec session that is still running */
  processId?: string;
  chunkId?: string;
  totalOutputLines?: number;
  originalTokenCount?: number;
  /** Code-mode script state */
  scriptStatus?: ScriptStatus;
  /** Code-mode cell id (yielded cells) */
  cellId?: string;
}

/** Only this many leading lines are inspected for a header. */
const MAX_HEADER_LINES = 10;

/**
 * Flatten a function/custom tool output body to text.
 * Bodies are a plain string, an array of content items, or (older rollouts)
 * an object `{ content, success }`.
 */
export function outputBodyToText(output: unknown): { text: string; imageCount: number } {
  if (typeof output === 'string') {
    return { text: output, imageCount: 0 };
  }
  if (Array.isArray(output)) {
    let text = '';
    let imageCount = 0;
    for (const item of output) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const { type, text: itemText } = item as { type?: unknown; text?: unknown };
      if (
        (type === 'input_text' || type === 'output_text' || type === 'text') &&
        typeof itemText === 'string'
      ) {
        if (text && !text.endsWith('\n')) {
          text += '\n';
        }
        text += itemText;
      } else if (type === 'input_image' || type === 'image') {
        imageCount++;
      } else if (type === 'encrypted_content') {
        if (text && !text.endsWith('\n')) {
          text += '\n';
        }
        text += `[encrypted content ${STRIPPED_MARKER}]`;
      }
    }
    return { text, imageCount };
  }
  if (output && typeof output === 'object') {
    const { content } = output as { content?: unknown };
    if (typeof content === 'string') {
      return { text: content, imageCount: 0 };
    }
    if (Array.isArray(content)) {
      return outputBodyToText(content);
    }
  }
  return { text: '', imageCount: 0 };
}

/**
 * Parse a tool output text, recognising the known status headers.
 */
export function parseToolOutput(text: string): ParsedToolOutput {
  const structured = parseStructuredShellOutput(text);
  if (structured) {
    return structured;
  }

  // A header is one or more recognised lines terminated by an `Output:` line.
  const lines = text.split('\n');
  let fields: HeaderFields = {};
  for (let i = 0; i < Math.min(lines.length, MAX_HEADER_LINES); i++) {
    const line = lines[i].replace(/\r$/, '');
    if (line === 'Output:') {
      if (i === 0) {
        break;
      }
      return { ...fields, body: lines.slice(i + 1).join('\n'), recognized: true };
    }
    const parsed = parseHeaderLine(line);
    if (!parsed) {
      break;
    }
    fields = { ...fields, ...parsed };
  }
  return { body: text, recognized: false };
}

type HeaderFields = Omit<ParsedToolOutput, 'body' | 'recognized'>;

/** Recognised header lines and the fields they set. */
const HEADER_PATTERNS: readonly [RegExp, (match: RegExpExecArray) => HeaderFields | null][] = [
  [/^Exit code: (-?\d+)$/, (m) => ({ exitCode: Number(m[1]) })],
  [/^Process exited with code (-?\d+)$/, (m) => ({ exitCode: Number(m[1]) })],
  [
    // `Wall time: 0.5 seconds`, `Wall time 1.2 seconds (code-mode …)`
    /^Wall time:? ([\d.]+) seconds?\b/,
    (m) => {
      const seconds = Number(m[1]);
      return Number.isFinite(seconds) ? { wallTimeMs: Math.round(seconds * 1000) } : null;
    },
  ],
  [/^Process running with session ID (\S+)$/, (m) => ({ processId: m[1] })],
  [/^Chunk ID: (\S+)$/, (m) => ({ chunkId: m[1] })],
  [/^Original token count: (\d+)$/, (m) => ({ originalTokenCount: Number(m[1]) })],
  [/^Total output lines: (\d+)$/, (m) => ({ totalOutputLines: Number(m[1]) })],
  [/^Script (completed|failed|terminated)$/, (m) => ({ scriptStatus: m[1] as ScriptStatus })],
  [/^Script running with cell ID (\S+)$/, (m) => ({ scriptStatus: 'running', cellId: m[1] })],
];

/**
 * Parse one header line. Returns null when it is not a recognised header line.
 */
function parseHeaderLine(line: string): HeaderFields | null {
  for (const [pattern, fields] of HEADER_PATTERNS) {
    const match = pattern.exec(line);
    if (match) {
      return fields(match);
    }
  }
  return null;
}

function parseStructuredShellOutput(text: string): ParsedToolOutput | null {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith('{') || !trimmed.includes('"metadata"')) {
    return null;
  }
  try {
    const value = JSON.parse(trimmed) as {
      output?: unknown;
      metadata?: { exit_code?: unknown; duration_seconds?: unknown };
    };
    if (typeof value.output !== 'string' || !value.metadata || typeof value.metadata !== 'object') {
      return null;
    }
    const result: ParsedToolOutput = { body: value.output, recognized: true };
    if (typeof value.metadata.exit_code === 'number') {
      result.exitCode = value.metadata.exit_code;
    }
    if (typeof value.metadata.duration_seconds === 'number') {
      result.wallTimeMs = Math.round(value.metadata.duration_seconds * 1000);
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * Classify an unstructured output that signals a non-success outcome.
 */
export function classifyOutcomeText(
  text: string
): 'declined' | 'interrupted' | 'failed' | undefined {
  const head = text.trimStart().slice(0, 400);
  if (!head) {
    return undefined;
  }
  if (
    /rejected by (?:the )?user|declined by (?:the )?user|user (?:declined|rejected|denied)|approval (?:was )?denied|was not approved/i.test(
      head
    )
  ) {
    return 'declined';
  }
  if (/^aborted\b/i.test(head) || /^(?:the )?(?:turn|task|command) was interrupted/i.test(head)) {
    return 'interrupted';
  }
  if (
    /^(?:error|failed|failure)\b/i.test(head) ||
    /^execution error\b/i.test(head) ||
    /^failed to parse function arguments/i.test(head) ||
    /^unsupported call\b/i.test(head) ||
    /^unknown tool\b/i.test(head) ||
    /\bcommand timed out\b/i.test(head) ||
    /^apply_patch verification failed/i.test(head)
  ) {
    return 'failed';
  }
  return undefined;
}

/**
 * Convert a serde `Duration` (`{secs, nanos}`), or milliseconds, to ms.
 */
export function durationToMs(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (value && typeof value === 'object') {
    const { secs, nanos } = value as { secs?: unknown; nanos?: unknown };
    if (typeof secs === 'number') {
      return Math.round(secs * 1000 + (typeof nanos === 'number' ? nanos / 1e6 : 0));
    }
  }
  if (typeof value === 'string') {
    const match = /^([\d.]+) ?(ms|s)?$/.exec(value.trim());
    const amount = match ? Number(match[1]) : NaN;
    if (match && Number.isFinite(amount)) {
      return Math.round(match[2] === 'ms' ? amount : amount * 1000);
    }
  }
  return undefined;
}
