/**
 * Codex rollout survey.
 *
 * Checks the Codex provider against real rollouts without exposing their
 * contents. It runs the scanner, reader and normalizer the app uses over the
 * Codex sessions directory (read-only) and writes a Markdown report of counts,
 * record/item/event types, field names, tool names, version strings, parser
 * anomalies (as rollout file + line locations) and timings.
 *
 * The report never contains message text, commands, outputs, code, file paths
 * or working directories: strings are reduced to type names, schema field
 * names, enum values and the words the Codex harness writes in output
 * headers. Model names are replaced by `<model-N>` aliases (numbered per
 * report, most frequent first; sanitized transcripts keep their own). It does
 * contain tool names (including MCP tools), model provider ids and rollout
 * file names: review it before sharing.
 *
 * Usage (from the repository root):
 *   pnpm exec tsx scripts/codex-rollout-survey.ts [--max-files N | --all] [--sessions DIR] [--out FILE]
 *   pnpm exec tsx scripts/codex-rollout-survey.ts --from-transcripts DIR [--out FILE]
 *
 *   --max-files N           survey the N most recently written rollouts (default 200)
 *   --all                   survey every rollout
 *   --sessions DIR          sessions directory (default: $CODEX_HOME/sessions, else ~/.codex/sessions)
 *   --from-transcripts DIR  survey sanitized transcripts (scripts/codex-rollout-transcript.ts
 *                           output, e.g. tests/fixtures/codex/real-observed) instead of rollouts;
 *                           real line numbers are kept
 *   --out FILE              report path (default: codex-survey.md in the OS temp directory)
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { performance } from 'perf_hooks';
import * as readline from 'readline';
import * as zlib from 'zlib';

import { parseCodeCell } from '../src/main/providers/codex/codeCell';
import { getCodexSessionsPath } from '../src/main/providers/codex/codexPaths';
import { normalizeCodexRollout } from '../src/main/providers/codex/CodexExecutionNormalizer';
import {
  isZstdSupported,
  parseRolloutLine,
  readRolloutRecords,
} from '../src/main/providers/codex/CodexRolloutParser';
import { CodexScanner, type RolloutFile } from '../src/main/providers/codex/CodexScanner';
import { outputBodyToText, parseToolOutput } from '../src/main/providers/codex/execOutput';

import type { AgentSessionList, Execution, TimelineEntry } from '../src/main/domain';
import type { CodexRolloutRecord } from '../src/main/providers/codex/types';
import type { Readable } from 'stream';

const DEFAULT_MAX_FILES = 200;
const MAX_EXAMPLES = 3;
const MAX_ROWS = 40;
const MB = 1024 * 1024;

// Types the normalizer renders. Mirrors the switch statements in
// CodexRolloutParser, CodexExecutionNormalizer and CodexEventParser.
const KNOWN_RECORD_TYPES = new Set([
  'session_meta',
  'response_item',
  'event_msg',
  'turn_context',
  'compacted',
  'token_usage_record',
  'world_state',
  'retained_context',
  'security_risk_score',
  'inter_agent_communication',
  'inter_agent_communication_metadata',
  'realtime_item',
]);
const RENDERED_ITEM_TYPES = new Set([
  'message',
  'agent_message',
  'reasoning',
  'function_call',
  'function_call_output',
  'local_shell_call',
  'custom_tool_call',
  'custom_tool_call_output',
  'tool_search_call',
  'tool_search_output',
  'web_search_call',
  'image_generation_call',
  'compaction',
  'compaction_summary',
  'context_compaction',
]);
const RENDERED_EVENT_TYPES = new Set([
  'user_message',
  'agent_message',
  'agent_reasoning',
  'agent_reasoning_raw_content',
  'token_count',
  'task_started',
  'turn_started',
  'task_complete',
  'turn_complete',
  'turn_aborted',
  'context_compacted',
  'exec_command_end',
  'patch_apply_end',
  'mcp_tool_call_end',
  'item_completed',
]);
const RENDERED_TURN_ITEM_TYPES = new Set([
  'UserMessage',
  'AgentMessage',
  'Reasoning',
  'CommandExecution',
  'FileChange',
  'McpToolCall',
  'WebSearch',
  'Extension',
]);
const RENDERED_RECORD_TYPES = new Set([
  'session_meta',
  'response_item',
  'event_msg',
  'turn_context',
  'compacted',
]);
/** Types recognized and deliberately not rendered (docs/codex-real-validation/parser-findings.md). */
const NOT_RENDERED_BY_DESIGN = new Set([
  'token_usage_record',
  'world_state',
  'inter_agent_communication_metadata',
  'thread_settings_applied',
  'ContextCompaction',
  'SubAgentActivity',
  'CollabAgentToolCall',
]);

/**
 * Messages the Codex harness writes instead of a status header
 * (codex-rs core/src: hook_runtime.rs, tools/parallel.rs, unified_exec).
 * Only the form is reported, never the rest of the text.
 */
const KNOWN_MESSAGE_FORMS: [RegExp, string][] = [
  [/^Command blocked by PreToolUse hook:/, 'Command blocked by PreToolUse hook: …'],
  [/^Tool call blocked by PreToolUse hook:/, 'Tool call blocked by PreToolUse hook: …'],
  [/^Wall time:? [\d.]+ seconds?\r?\naborted by user/, 'Wall time: … / aborted by user'],
  [/^aborted by user after /, 'aborted by user after …'],
  [/^write_stdin failed:/, 'write_stdin failed: …'],
  [/^execution error:/, 'execution error: …'],
  [/^apply_patch verification failed/, 'apply_patch verification failed …'],
  [/rejected by user/, '… rejected by user'],
];

/** Tools whose outputs carry an exec header (exit code, process or cell state). */
const EXEC_TOOLS = new Set([
  'exec_command',
  'write_stdin',
  'shell',
  'shell_command',
  'container.exec',
  'local_shell',
  'unified_exec',
  'exec',
  'wait',
  'apply_patch',
]);

/**
 * Words the Codex harness writes in output headers. Unrecognized headers are
 * reported with only these words kept; every other word becomes `…`.
 */
const HEADER_VOCABULARY = new Set(
  (
    'process script exit exited running completed complete failed terminated finished with code ' +
    'session id cell chunk wall time original token tokens count total output lines line status ' +
    'execution command timed out killed signal error duration seconds ms stdout stderr truncated ' +
    'of in and approx approximately yielded yield pid elapsed result success succeeded aborted ' +
    'interrupted denied rejected declined sandbox timeout warning note'
  ).split(' ')
);

const OUTPUT_FIELDS = [
  'exitCode',
  'wallTimeMs',
  'processId',
  'chunkId',
  'totalOutputLines',
  'originalTokenCount',
  'scriptStatus',
  'cellId',
] as const;

const ANOMALY_NOTES: Record<string, string> = {
  'output without a matching call':
    'An output whose call_id never appeared as a call in the same rollout.',
  'call without a result': 'A call in a finished turn that never got an output.',
  'process never seen exiting':
    'A unified exec process that was still running when the rollout ended (no poll saw it exit).',
  'code cell never finished': 'A yielded code cell with no final wait result.',
  'command completed without an exit code':
    'A command output without a recognized header; the exit code is unknown.',
  'wait not linked to a cell': 'A code-mode wait whose cell could not be found.',
  'stdin write without a process id': 'A write_stdin call without a session id.',
  'finished without a duration': 'A finished execution with no reported or observed duration.',
  'recorded item not linked to a call or cell':
    'An item record (item_completed, *_end) whose id matches no call and that no single running code cell could claim.',
  'no timestamp': 'An execution without any timestamp.',
  'reader line count differs from a plain line split':
    'The app reader and a plain line split saw a different number of lines.',
};

// =============================================================================
// Tallies
// =============================================================================

interface Where {
  file: string;
  /** 1-based rollout line, or 0 for the whole file */
  line: number;
}

interface Tally {
  count: number;
  files: number;
  lastFile?: string;
  examples: string[];
}

class Tallies {
  private readonly map = new Map<string, Tally>();

  add(key: string, where?: Where): void {
    let tally = this.map.get(key);
    if (!tally) {
      tally = { count: 0, files: 0, examples: [] };
      this.map.set(key, tally);
    }
    tally.count++;
    if (where && tally.lastFile !== where.file) {
      tally.files++;
      tally.lastFile = where.file;
      if (tally.examples.length < MAX_EXAMPLES) {
        tally.examples.push(where.line > 0 ? `${where.file}:${where.line}` : where.file);
      }
    }
  }

  get size(): number {
    return this.map.size;
  }

  rows(): [string, Tally][] {
    return [...this.map.entries()].sort(
      (a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0])
    );
  }
}

interface Timing {
  file: string;
  bytes: number;
  lines: number;
  readMs: number;
  normalizeMs: number;
}

class Survey {
  private readonly sections = new Map<string, Tallies>();
  readonly timings: Timing[] = [];
  peakHeapBytes = 0;

  t(section: string): Tallies {
    let tallies = this.sections.get(section);
    if (!tallies) {
      tallies = new Tallies();
      this.sections.set(section, tallies);
    }
    return tallies;
  }
}

// =============================================================================
// Helpers
// =============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Sorted field names of an object (names only, never values). Keys that do not
 * look like schema identifiers (file names, free text used as map keys) are
 * only counted.
 */
function keySet(value: Record<string, unknown>): string {
  const keys = Object.keys(value);
  const names = keys.filter((key) => /^[A-Za-z_$][\w$]{0,63}$/.test(key)).sort();
  const shown = names.slice(0, 30);
  const more = keys.length - shown.length;
  const suffix = more > 0 ? `${shown.length > 0 ? ', ' : ''}+${more} more` : '';
  return `{${shown.join(', ')}${suffix}}`;
}

/** A model name, or the alias a sanitized transcript already carries. */
function modelValue(value: unknown): string {
  return typeof value === 'string' && /^<model-\d+>$/.test(value) ? value : enumValue(value);
}

/** Value of an enum-like field; anything that looks like free text is hidden. */
function enumValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '(none)';
  }
  if (typeof value === 'string') {
    const pathLike =
      value.startsWith('/') ||
      value.startsWith('~') ||
      /^[A-Za-z]:\//.test(value) ||
      value.split('/').length > 3;
    return value.length <= 40 && /^[\w.:/-]+$/.test(value) && !pathLike ? value : '(text)';
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  if (isRecord(value)) {
    const identifier = (key: string | undefined): string =>
      key !== undefined && /^[A-Za-z_$][\w$]{0,63}$/.test(key) ? key : '…';
    const [first] = Object.keys(value);
    if (first === undefined) {
      return '{}';
    }
    const inner = value[first];
    return isRecord(inner) && Object.keys(inner).length > 0
      ? `${identifier(first)}.${identifier(Object.keys(inner)[0])}`
      : identifier(first);
  }
  return typeof value;
}

/** A type name, annotated when the viewer does not render it. */
function typeLabel(type: string, rendered: boolean): string {
  if (rendered) return type;
  return NOT_RENDERED_BY_DESIGN.has(type)
    ? `${type} (not rendered, by design)`
    : `${type} (not rendered)`;
}

function knownMessageForm(text: string): string {
  const head = text.trimStart().slice(0, 400);
  for (const [pattern, form] of KNOWN_MESSAGE_FORMS) {
    if (pattern.test(head)) return form;
  }
  return '(none of the known forms)';
}

function parseJsonObject(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'string') {
    return isRecord(value) ? value : undefined;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Header shape of an output that the parser did not recognize: field labels
 * and harness words only, never values or free text.
 */
function headerSkeleton(text: string): string {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{')) {
    const json = parseJsonObject(trimmed);
    if (json) {
      const nested = Object.entries(json)
        .filter(([key, value]) => isRecord(value) && /^[A-Za-z_$][\w$]{0,63}$/.test(key))
        .map(([key, value]) => ` ${key} ${keySet(value as Record<string, unknown>)}`)
        .join('');
      return `JSON ${keySet(json)}${nested}`;
    }
  }
  const parts: string[] = [];
  for (const raw of text.split('\n', 6)) {
    const line = raw.trim();
    let part = '(blank)';
    if (line) {
      part = line
        .split(/\s+/)
        .slice(0, 6)
        .map((word) => {
          const bare = word.replace(/[:.,;]+$/, '');
          let kept = '…';
          if (/\d/.test(bare)) {
            kept = '#';
          } else if (HEADER_VOCABULARY.has(bare.toLowerCase())) {
            kept = bare;
          }
          return word.endsWith(':') ? `${kept}:` : kept;
        })
        .join(' ')
        .replace(/(?:… )+…/g, '…');
    }
    parts.push(part);
  }
  return parts.join(' / ');
}

function cwdShape(cwd: string | undefined): string {
  if (!cwd) return '(missing)';
  if (cwd.startsWith('\\\\?\\')) return 'Windows verbatim path (`\\\\?\\` prefix)';
  if (cwd.startsWith('\\\\')) return 'Windows UNC path';
  if (/^[A-Za-z]:[\\/]/.test(cwd)) {
    if (cwd.includes('/') && cwd.includes('\\')) return 'Windows drive path, mixed separators';
    return cwd.includes('/') ? 'Windows drive path, forward slashes' : 'Windows drive path';
  }
  if (cwd.startsWith('file:')) return 'file:// URI';
  if (/^\/mnt\/[a-z]\//.test(cwd)) return 'WSL mount (/mnt/<drive>/…)';
  if (cwd.startsWith('/')) return 'POSIX path';
  return 'other';
}

function sizeBucket(count: number): string {
  if (count === 1) return 'projects with 1 session';
  if (count <= 5) return 'projects with 2-5 sessions';
  if (count <= 20) return 'projects with 6-20 sessions';
  return 'projects with 21+ sessions';
}

function describeError(error: unknown): string {
  if (isRecord(error) && typeof error.code === 'string') {
    return `read error ${error.code}`;
  }
  if (error instanceof Error && /zst/i.test(error.message)) {
    return 'compressed rollout could not be read';
  }
  return error instanceof Error ? `${error.name} while parsing` : 'unknown error';
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * MB) return `${(bytes / (1024 * MB)).toFixed(2)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
}

function gitCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

// =============================================================================
// Raw line survey (shapes)
// =============================================================================

interface FileContext {
  file: string;
  /** call_id → tool label, for classifying outputs */
  callTools: Map<string, string>;
}

function openRolloutStream(file: RolloutFile): Readable {
  const raw = fs.createReadStream(file.filePath);
  if (!file.compressed) {
    return raw;
  }
  const factory = (zlib as { createZstdDecompress?: () => NodeJS.ReadWriteStream & Readable })
    .createZstdDecompress;
  if (!factory) {
    throw new Error('zstd decompression is unavailable');
  }
  const decompress = factory();
  raw.on('error', (error) => decompress.destroy(error));
  return raw.pipe(decompress);
}

async function surveyRawLines(file: RolloutFile, survey: Survey): Promise<{ counted: number }> {
  const context: FileContext = { file: file.sessionId, callTools: new Map() };
  const input = openRolloutStream(file);
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let streamError: unknown;
  input.on('error', (error) => {
    streamError = error;
    lines.close();
  });

  let lineNumber = 0;
  let counted = 0;
  for await (const line of lines) {
    lineNumber++;
    if (surveyLine(line, { file: file.sessionId, line: lineNumber }, context, survey)) {
      counted++;
    }
  }
  if (streamError) {
    throw streamError;
  }
  return { counted };
}

/**
 * Survey one line. Returns whether the app reader counts it (as a record or
 * as a malformed line), for the line count cross-check.
 */
function surveyLine(line: string, where: Where, context: FileContext, survey: Survey): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    survey.t('lines').add('invalid JSON', where);
    return true;
  }
  if (!isRecord(value)) {
    survey.t('lines').add('JSON value that is not an object', where);
    return true;
  }

  const isEnvelope = typeof value.type === 'string' && 'payload' in value;
  if (isEnvelope) {
    survey.t('formats').add('envelope {timestamp, type, payload, …}', where);
    survey.t('envelopeKeys').add(keySet(value), where);
  } else if (value.record_type === 'state') {
    survey.t('formats').add('legacy state line', where);
  } else if (typeof value.type === 'string') {
    survey.t('formats').add('legacy bare response item', where);
  } else {
    survey.t('formats').add('legacy session meta (or unknown)', where);
  }

  const record = parseRolloutLine(trimmed, where.line);
  if (record === undefined) {
    survey.t('lines').add('skipped by the reader (legacy state line)', where);
    return false;
  }
  if (record === null) {
    survey.t('lines').add(`not recognized, fields ${keySet(value)}`, where);
    return true;
  }
  if (isEnvelope && value.type !== record.type) {
    survey.t('lines').add(`unknown envelope type ${enumValue(value.type)} (ignored)`, where);
    survey.t('recordTypes').add(`${enumValue(value.type)} (unknown)`, where);
    return true;
  }

  survey
    .t('recordTypes')
    .add(
      KNOWN_RECORD_TYPES.has(record.type)
        ? typeLabel(record.type, RENDERED_RECORD_TYPES.has(record.type))
        : `${record.type} (unknown)`,
      where
    );
  if (record.metadata) {
    survey.t('metadataKeys').add(keySet(record.metadata), where);
  }

  const payload = record.payload;
  switch (record.type) {
    case 'session_meta':
      surveySessionMeta(payload, where, survey);
      break;
    case 'turn_context':
      survey.t('turnContext').add(`fields ${keySet(payload)}`, where);
      survey.t('turnContext').add(`model ${modelValue(payload.model)}`, where);
      break;
    case 'response_item':
      surveyItem(payload, where, context, survey);
      break;
    case 'event_msg':
      surveyEvent(payload, where, survey);
      break;
    case 'compacted':
      survey.t('compacted').add(`fields ${keySet(payload)}`, where);
      break;
    default:
      break;
  }
  return true;
}

function surveySessionMeta(meta: Record<string, unknown>, where: Where, survey: Survey): void {
  const t = survey.t('sessionMeta');
  t.add(`fields ${keySet(meta)}`, where);
  t.add(`cli_version ${enumValue(meta.cli_version)}`, where);
  t.add(`originator ${enumValue(meta.originator)}`, where);
  t.add(`source ${enumValue(meta.source)}`, where);
  t.add(`model_provider ${enumValue(meta.model_provider)}`, where);
  t.add(`cwd ${cwdShape(str(meta.cwd))}`, where);
  if (isRecord(meta.git)) {
    t.add(`git ${keySet(meta.git)}`, where);
  }
}

function surveyItem(
  item: Record<string, unknown>,
  where: Where,
  context: FileContext,
  survey: Survey
): void {
  const type = typeof item.type === 'string' ? enumValue(item.type) : '(no type)';
  survey.t('itemTypes').add(RENDERED_ITEM_TYPES.has(type) ? type : `${type} (not rendered)`, where);
  survey.t('itemKeys').add(`${type} ${keySet(item)}`, where);
  surveyPassthrough(item, type, where, survey);

  const callId = str(item.call_id);
  const name = typeof item.name === 'string' ? enumValue(item.name) : '(no name)';
  const namespace = typeof item.namespace === 'string' ? enumValue(item.namespace) : undefined;
  const label = namespace ? `${namespace}.${name}` : name;

  switch (type) {
    case 'message': {
      const role = enumValue(item.role);
      const phase = item.phase === undefined ? '' : ` · phase ${enumValue(item.phase)}`;
      survey.t('messages').add(`${role}${phase}`, where);
      if (Array.isArray(item.content)) {
        for (const part of item.content) {
          if (isRecord(part)) {
            survey.t('messages').add(`${role} content ${enumValue(part.type)}`, where);
          }
        }
      }
      break;
    }
    case 'reasoning': {
      const summary = Array.isArray(item.summary) && item.summary.length > 0;
      const content = Array.isArray(item.content) && item.content.length > 0;
      const encrypted = typeof item.encrypted_content === 'string';
      survey
        .t('reasoningItems')
        .add(
          `summary ${summary ? 'yes' : 'no'} · content ${content ? 'yes' : 'no'} · encrypted ${encrypted ? 'yes' : 'no'}`,
          where
        );
      break;
    }
    case 'function_call': {
      survey.t('tools').add(`function_call ${label}`, where);
      const args = parseJsonObject(item.arguments);
      survey
        .t('toolArgs')
        .add(`${label} ${args ? keySet(args) : '(arguments not a JSON object)'}`, where);
      if (callId) context.callTools.set(callId, label);
      break;
    }
    case 'custom_tool_call': {
      survey.t('tools').add(`custom_tool_call ${label}`, where);
      survey.t('statusValues').add(`custom_tool_call status ${enumValue(item.status)}`, where);
      if (name === 'exec') {
        surveyCodeCell(typeof item.input === 'string' ? item.input : '', where, survey);
      }
      if (callId) context.callTools.set(callId, label);
      break;
    }
    case 'local_shell_call': {
      const action = isRecord(item.action) ? item.action : {};
      survey.t('tools').add(`local_shell_call action ${enumValue(action.type)}`, where);
      survey.t('toolArgs').add(`local_shell_call action ${keySet(action)}`, where);
      survey.t('statusValues').add(`local_shell_call status ${enumValue(item.status)}`, where);
      if (callId) context.callTools.set(callId, 'local_shell');
      break;
    }
    case 'web_search_call': {
      const action = isRecord(item.action) ? item.action : {};
      survey.t('tools').add(`web_search_call action ${enumValue(action.type)}`, where);
      survey.t('statusValues').add(`web_search_call status ${enumValue(item.status)}`, where);
      break;
    }
    case 'tool_search_call':
      survey.t('tools').add(`tool_search_call execution ${enumValue(item.execution)}`, where);
      break;
    case 'image_generation_call':
      survey.t('tools').add('image_generation_call', where);
      break;
    case 'function_call_output':
    case 'custom_tool_call_output':
      surveyOutput(item, type, where, context, survey);
      break;
    default:
      break;
  }
}

function surveyPassthrough(
  item: Record<string, unknown>,
  type: string,
  where: Where,
  survey: Survey
): void {
  const passthrough = item.internal_chat_message_metadata_passthrough;
  if (!isRecord(passthrough)) {
    return;
  }
  const t = survey.t('passthrough');
  t.add(`${type} ${keySet(passthrough)}`, where);
  if (typeof passthrough.tool_calls_complete === 'boolean') {
    t.add(`${type} tool_calls_complete ${passthrough.tool_calls_complete}`, where);
  }
  const calls = passthrough.executed_tool_calls;
  if (!Array.isArray(calls)) {
    return;
  }
  t.add(`${type} executed_tool_calls ${calls.length === 0 ? 'empty' : 'non-empty'}`, where);
  for (const call of calls) {
    if (!isRecord(call)) continue;
    survey.t('executedToolCalls').add(`${enumValue(call.name)} ${keySet(call)}`, where);
    if (isRecord(call.arguments) && '_codex_executed_tool_call_truncated' in call.arguments) {
      survey.t('executedToolCalls').add('(arguments truncated by Codex)', where);
    }
  }
}

function surveyCodeCell(input: string, where: Where, survey: Survey): void {
  const cell = parseCodeCell(input);
  const t = survey.t('codeCells');
  t.add('exec cells', where);
  if (cell.pragma) {
    t.add('with // @exec pragma', where);
    for (const key of Object.keys(cell.pragma)) {
      t.add(`pragma field ${enumValue(key)}`, where);
    }
  }
  if (cell.calls.length === 0) {
    t.add('no tools.* calls found by static analysis', where);
  }
  for (const call of cell.calls) {
    survey
      .t('scriptCalls')
      .add(`tools.${enumValue(call.name)}${call.dynamic ? ' (dynamic arguments)' : ''}`, where);
  }
}

function surveyOutput(
  item: Record<string, unknown>,
  type: string,
  where: Where,
  context: FileContext,
  survey: Survey
): void {
  const output = item.output;
  let shape: string;
  if (typeof output === 'string') {
    shape = 'text';
  } else if (Array.isArray(output)) {
    shape = 'content items';
  } else if (isRecord(output)) {
    shape = `object ${keySet(output)}`;
  } else {
    shape = output === undefined ? '(missing)' : typeof output;
  }
  survey.t('outputShapes').add(`${type} ${shape}`, where);

  const tool = context.callTools.get(str(item.call_id) ?? '') ?? '(call not seen)';
  if (!EXEC_TOOLS.has(tool) && tool !== '(call not seen)') {
    return;
  }
  const { text } = outputBodyToText(output);
  const parsed = parseToolOutput(text);
  const fields = OUTPUT_FIELDS.filter((field) => parsed[field] !== undefined);
  const header = parsed.recognized ? fields.join(' + ') || '(header without fields)' : 'no header';
  survey.t('outputHeaders').add(`${tool} → ${header}`, where);
  if (!parsed.recognized) {
    survey.t('unrecognizedHeaders').add(`${tool} → ${headerSkeleton(text)}`, where);
  }
  if (!parsed.recognized || parsed.body.startsWith('aborted by user')) {
    survey.t('knownMessages').add(`${tool} → ${knownMessageForm(text)}`, where);
  }
}

function surveyEvent(event: Record<string, unknown>, where: Where, survey: Survey): void {
  const type = typeof event.type === 'string' ? enumValue(event.type) : '(no type)';
  const rendered = RENDERED_EVENT_TYPES.has(type);
  survey.t('eventTypes').add(typeLabel(type, rendered), where);
  if (rendered && type !== 'item_completed') {
    survey.t('eventKeys').add(`${type} ${keySet(event)}`, where);
  }
  if (type === 'exec_command_end') {
    survey.t('commandResults').add(`exec_command_end · source ${enumValue(event.source)}`, where);
  }
  if (type === 'item_completed' && isRecord(event.item)) {
    const item = event.item;
    const itemType = typeof item.type === 'string' ? enumValue(item.type) : '(no type)';
    survey.t('turnItems').add(typeLabel(itemType, RENDERED_TURN_ITEM_TYPES.has(itemType)), where);
    survey.t('turnItemKeys').add(`${itemType} ${keySet(item)}`, where);
    if (itemType === 'CommandExecution') {
      survey
        .t('commandResults')
        .add(
          `CommandExecution · source ${enumValue(item.source)} · status ${enumValue(item.status)}`,
          where
        );
    }
  }
}

// =============================================================================
// Parser survey (what the app renders)
// =============================================================================

async function surveyNormalized(
  file: RolloutFile,
  live: boolean,
  survey: Survey
): Promise<{ counted: number }> {
  const started = performance.now();
  const read = await readRolloutRecords(file.filePath);
  const records = read.tail ? [...read.records, read.tail] : read.records;
  const readDone = performance.now();
  const session = normalizeCodexRollout(records, { active: live });
  const done = performance.now();
  survey.timings.push({
    file: file.sessionId,
    bytes: file.size,
    lines: records.length,
    readMs: readDone - started,
    normalizeMs: done - readDone,
  });

  const whole: Where = { file: file.sessionId, line: 0 };
  const flags = survey.t('sessions');
  flags.add('sessions surveyed', whole);
  if (live) flags.add('live (written in the last 10 minutes)', whole);
  if (session.turnInProgress) flags.add('turn in progress', whole);
  if (!session.metadata.cwd) flags.add('no cwd', whole);
  if (!session.title) flags.add('no title (no user request or subagent task name found)', whole);
  if (session.titleSource === 'agent_task') flags.add('titled by subagent task name', whole);
  if (!session.model) flags.add('no model (no turn_context)', whole);
  if (!session.tokenUsage) flags.add('no token usage', whole);
  if (session.metadata.parentThreadId) flags.add('subagent or forked session', whole);
  if (read.malformedLines > 0) flags.add('has lines the reader could not parse', whole);
  if (session.executions.length === 0) flags.add('no executions', whole);

  for (const entry of session.timeline) {
    surveyEntry(entry, { file: file.sessionId, line: entry.lineNumber }, survey);
  }
  const context: ExecutionSurveyContext = {
    file: file.sessionId,
    cliVersion: enumValue(session.metadata.cliVersion),
    turnClosures: turnClosures(records),
    lastLine: records.length > 0 ? records[records.length - 1].lineNumber : 0,
  };
  for (const exec of session.executions) {
    surveyExecution(exec, undefined, context, survey);
  }
  return { counted: read.records.length + read.malformedLines + (read.tail ? 1 : 0) };
}

interface ExecutionSurveyContext {
  file: string;
  cliVersion: string;
  /** turn id → how the turn ended */
  turnClosures: Map<string, 'completed' | 'aborted'>;
  lastLine: number;
}

function turnClosures(
  records: readonly CodexRolloutRecord[]
): Map<string, 'completed' | 'aborted'> {
  const closures = new Map<string, 'completed' | 'aborted'>();
  for (const record of records) {
    if (record.type !== 'event_msg') continue;
    const turnId = str(record.payload.turn_id);
    if (!turnId) continue;
    const type = record.payload.type;
    if (type === 'task_complete' || type === 'turn_complete') closures.set(turnId, 'completed');
    if (type === 'turn_aborted') closures.set(turnId, 'aborted');
  }
  return closures;
}

/**
 * Structural family of a call that never got a result.
 */
function missingResultFamily(exec: Execution, context: ExecutionSurveyContext): string {
  if (exec.outputCount) return 'output recorded without a final status';
  if (!exec.turnId) return 'no turn id on the call';
  const closure = context.turnClosures.get(exec.turnId);
  if (closure === 'completed') return 'turn completed without the output (persistence gap)';
  if (closure === 'aborted') return 'turn aborted (should read interrupted)';
  return 'turn never closed: rollout ended mid-turn';
}

/** Evidence class of a nested execution, or of an unlinked item record. */
function evidenceClass(exec: Execution): string {
  const { code, observed, result, cellLink, callSiteLink } = exec.evidence;
  if (code && !observed && !result) return 'script call site only (static analysis)';
  if (observed?.kind === 'inventory' && !result)
    return 'listed as attempted (inventory), no result';
  if (callSiteLink?.method === 'content') return 'script call site + recorded item (content link)';
  if (cellLink?.method === 'turn_window') return 'recorded item attributed by turn and order';
  if (cellLink?.method === 'explicit_id') return 'call + recorded item linked by id';
  if (cellLink?.method === 'unresolved') {
    const what =
      observed?.kind === 'item' ? 'recorded item' : `${observed?.kind ?? 'unknown'} record`;
    return `${what}, not linked: ${cellLink.detail ?? ''}`;
  }
  return 'other';
}

function surveyEntry(entry: TimelineEntry, where: Where, survey: Survey): void {
  const t = survey.t('timeline');
  switch (entry.kind) {
    case 'user_message':
      t.add(entry.imageCount ? 'user message with images' : 'user message', where);
      break;
    case 'agent_message': {
      const interAgent = entry.author || entry.recipient ? ' · inter-agent' : '';
      t.add(`agent message · ${entry.phase ?? 'no phase'}${interAgent}`, where);
      break;
    }
    case 'reasoning': {
      const parts = [entry.summary.length > 0 ? 'summary' : 'no summary'];
      if (entry.content) parts.push('raw content');
      if (entry.encrypted) parts.push('encrypted');
      t.add(`reasoning · ${parts.join(' · ')}`, where);
      break;
    }
    case 'turn_event':
      t.add(`turn ${entry.event}`, where);
      break;
    case 'compaction':
      t.add(
        `compaction${entry.summary ? ' · summary' : ''}${entry.encrypted ? ' · encrypted' : ''}`,
        where
      );
      break;
    case 'inherited_context':
      t.add('inherited context (subagent)', where);
      survey.t('sessions').add('subagent with inherited parent history', where);
      break;
    case 'execution':
      break;
  }
}

function surveyExecution(
  exec: Execution,
  parent: Execution | undefined,
  context: ExecutionSurveyContext,
  survey: Survey
): void {
  const where: Where = { file: context.file, line: exec.lineNumber };
  const tallies = survey.t('anomalies');
  const anomalies = {
    add: (name: string, at: Where): void => {
      tallies.add(name, at);
      survey.t('anomalyKinds').add(`${name} · ${exec.kind}`, at);
      survey.t('anomalyVersions').add(`${name} · cli ${context.cliVersion}`, at);
    },
  };
  const detail = exec.statusDetail ?? '';
  const finished = exec.status === 'completed' || exec.status === 'failed';

  survey.t('executions').add(`${parent ? 'nested ' : ''}${exec.kind} → ${exec.status}`, where);
  if (!parent) {
    survey
      .t('generations')
      .add(`${exec.generation ?? '(none)'} · recorded as ${enumValue(exec.source)}`, where);
  }

  if (detail === 'Call record not found in this rollout') {
    anomalies.add('output without a matching call', where);
  }
  if (exec.status === 'unknown' && detail === 'No result was recorded') {
    anomalies.add('call without a result', where);
    survey.t('missingResults').add(missingResultFamily(exec, context), where);
  }
  if (
    !parent &&
    exec.evidence.observed?.kind === 'item' &&
    exec.evidence.cellLink?.method === 'unresolved'
  ) {
    anomalies.add('recorded item not linked to a call or cell', where);
  }
  if (parent || exec.evidence.cellLink) {
    survey
      .t('evidence')
      .add(`${parent ? 'nested' : 'top-level'} ${exec.kind}: ${evidenceClass(exec)}`, where);
  }
  if (detail.startsWith('Process was still running when the log ended')) {
    anomalies.add('process never seen exiting', where);
  }
  if (exec.kind === 'code_cell' && detail.endsWith('was still running when the log ended')) {
    anomalies.add('code cell never finished', where);
  }
  if (
    !parent &&
    exec.kind === 'command' &&
    exec.status === 'completed' &&
    exec.exitCode === undefined
  ) {
    anomalies.add('command completed without an exit code', where);
  }
  if (exec.kind === 'code_wait' && !exec.parentId) {
    anomalies.add('wait not linked to a cell', where);
  }
  if (exec.kind === 'command_input' && !exec.processId) {
    anomalies.add('stdin write without a process id', where);
  }
  if (!parent && finished && exec.durationMs === undefined) {
    anomalies.add('finished without a duration', where);
  }
  if (!exec.timestamp) {
    anomalies.add('no timestamp', where);
  }

  if (exec.kind === 'code_cell') {
    const children = exec.children ?? [];
    const recorded = children.filter((child) => child.evidence.result).length;
    const scriptOnly = children.filter(
      (child) => child.evidence.code && !child.evidence.observed && !child.evidence.result
    ).length;
    const shape =
      children.length === 0
        ? 'no nested operations'
        : [recorded > 0 ? 'recorded' : '', scriptOnly > 0 ? 'script-only' : '']
            .filter(Boolean)
            .join(' + ') || 'other';
    survey.t('codeCellResults').add(`cells with ${shape}`, where);
    for (const child of children) {
      const exit = child.exitCode === undefined ? '' : ' · exit code';
      survey.t('codeCellResults').add(`child ${child.kind} → ${child.status}${exit}`, where);
    }
  }
  for (const child of exec.children ?? []) {
    surveyExecution(child, exec, context, survey);
  }
}

function surveyList(list: AgentSessionList, survey: Survey): void {
  const t = survey.t('list');
  for (const session of list.sessions) {
    const where: Where = { file: session.id, line: 0 };
    t.add('listed', where);
    if (session.isLive) t.add('live', where);
    if (session.turnInProgress) t.add('turn in progress', where);
    if (session.error)
      t.add(session.compressed ? 'error (compressed)' : 'error reading head', where);
    if (!session.cwd) t.add('no cwd', where);
    if (!session.title) t.add('no title', where);
    if (session.titleSource === 'agent_task') t.add('titled by subagent task name', where);
    if (!session.model) t.add('no model', where);
    if (session.parentThreadId) t.add('subagent or forked', where);
    if (session.compressed) t.add('compressed', where);
    survey.t('cwdShapes').add(cwdShape(session.cwd), where);
    survey
      .t('originators')
      .add(`${enumValue(session.originator)} · source ${enumValue(session.source)}`, where);
  }
  for (const project of list.projects) {
    survey.t('projects').add(sizeBucket(project.sessionIds.length));
    if (/[\\/]/.test(project.name)) {
      survey.t('projects').add('name disambiguated with its parent directory');
    }
  }
}

async function surveyFile(file: RolloutFile, live: boolean, survey: Survey): Promise<void> {
  const whole: Where = { file: file.sessionId, line: 0 };
  if (file.compressed && !isZstdSupported()) {
    survey.t('errors').add('compressed rollout skipped (no zstd in this Node)', whole);
    return;
  }
  try {
    const parsed = await surveyNormalized(file, live, survey);
    const raw = await surveyRawLines(file, survey);
    if (!live && parsed.counted !== raw.counted) {
      survey.t('anomalies').add('reader line count differs from a plain line split', whole);
    }
  } catch (error) {
    survey.t('errors').add(describeError(error), whole);
  }
  survey.peakHeapBytes = Math.max(survey.peakHeapBytes, process.memoryUsage().heapUsed);
}

// =============================================================================
// Report
// =============================================================================

interface ReportInput {
  sessionsDirOrigin: string;
  list: AgentSessionList;
  scanMs: number;
  files: RolloutFile[];
  selected: RolloutFile[];
  survey: Survey;
}

function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function factsTable(rows: [string, string][]): string[] {
  return ['| | |', '|---|---|', ...rows.map(([key, value]) => `| ${key} | ${cell(value)} |`), ''];
}

/**
 * Row labels `model <name>` → `model <model-N>`, numbered in the order the rows
 * appear (most frequent first). Unreleased or custom model names never reach
 * the report.
 */
function modelAliases(): (key: string) => string {
  const aliases = new Map<string, string>();
  return (key) => {
    const name = /^model (.+)$/.exec(key)?.[1];
    if (name === undefined || name.startsWith('(') || /^<model-\d+>$/.test(name)) return key;
    let alias = aliases.get(name);
    if (alias === undefined) {
      alias = `<model-${aliases.size + 1}>`;
      aliases.set(name, alias);
    }
    return `model ${alias}`;
  };
}

function tallyTable(
  tallies: Tallies,
  heading: string,
  options: {
    examples?: 'all' | 'flagged';
    notes?: Record<string, string>;
    label?: (key: string) => string;
  } = {}
): string[] {
  if (tallies.size === 0) {
    return [];
  }
  const withExamples = options.examples !== undefined;
  const rows = tallies.rows();
  const withFiles = rows.some(([, tally]) => tally.files > 0);
  const header = ['Value', 'Count'];
  const align = ['---', '---:'];
  if (withFiles) {
    header.push('Sessions');
    align.push('---:');
  }
  if (withExamples) {
    header.push('Examples');
    align.push('---');
  }
  const lines = [`#### ${heading}`, '', `| ${header.join(' | ')} |`, `|${align.join('|')}|`];
  for (const [key, tally] of rows.slice(0, MAX_ROWS)) {
    const note = options.notes?.[key];
    const shown = options.label ? options.label(key) : key;
    const label = note ? `${shown} — ${note}` : shown;
    let row = `| ${cell(label)} | ${tally.count} |${withFiles ? ` ${tally.files} |` : ''}`;
    if (withExamples) {
      const flagged = options.examples === 'all' || /\((unknown|not rendered)\)/.test(key);
      row += ` ${flagged ? cell(tally.examples.map((example) => `\`${example}\``).join('<br>')) : ''} |`;
    }
    lines.push(row);
  }
  if (rows.length > MAX_ROWS) {
    lines.push('', `…and ${rows.length - MAX_ROWS} more values.`);
  }
  lines.push('');
  return lines;
}

function renderReport(input: ReportInput): string {
  const { list, files, selected, survey } = input;
  const out: string[] = [];
  const t = (section: string): Tallies => survey.t(section);

  out.push('# Codex rollout survey', '');
  out.push(
    `Generated ${new Date().toISOString()} · commit ${gitCommit()} · Node ${process.version} on ${process.platform}/${process.arch} · zstd ${isZstdSupported() ? 'available' : 'not available in this Node (the app’s Electron runtime may still have it)'}`,
    ''
  );
  out.push(
    '> No message text, commands, outputs, code, file paths or working directories. Model names are replaced by `<model-N>` aliases. Tool names, model provider ids and rollout file names are included: review before sharing.',
    ''
  );

  // Files
  const sizes = files.map((file) => file.size).sort((a, b) => a - b);
  const dates = files
    .map((file) => /^(\d{4})\/(\d{2})\/(\d{2})\//.exec(file.sessionId))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => `${match[1]}-${match[2]}-${match[3]}`)
    .sort();
  const compressed = files.filter((file) => file.compressed).length;
  out.push('## Rollout files', '');
  out.push(
    ...factsTable([
      ['Sessions directory', input.sessionsDirOrigin],
      [
        'Rollout files',
        `${files.length} (${files.length - compressed} .jsonl, ${compressed} .jsonl.zst)`,
      ],
      ['Outside YYYY/MM/DD folders', String(files.length - dates.length)],
      ['Date range', dates.length > 0 ? `${dates[0]} → ${dates[dates.length - 1]}` : '—'],
      [
        'Size',
        `total ${formatBytes(sizes.reduce((sum, size) => sum + size, 0))} · p50 ${formatBytes(percentile(sizes, 50))} · p90 ${formatBytes(percentile(sizes, 90))} · max ${formatBytes(sizes[sizes.length - 1] ?? 0)}`,
      ],
      [
        'Files over 50 MB / 200 MB',
        `${sizes.filter((size) => size > 50 * MB).length} / ${sizes.filter((size) => size > 200 * MB).length}`,
      ],
      [
        'Surveyed',
        `${selected.length} most recently written${selected.length < files.length ? ' (use --all for every file)' : ''}`,
      ],
    ])
  );

  // Session list
  const liveIsNewest = list.liveSessionId !== null && list.liveSessionId === list.latestSessionId;
  const distinctCwds = new Set(list.sessions.map((session) => session.cwd).filter(Boolean)).size;
  out.push('## Session list (what the app shows)', '');
  out.push(
    ...factsTable([
      [
        'Listed',
        `${list.sessions.length} of ${list.totalFiles} (the app lists the 500 most recent)`,
      ],
      ['Scan time', formatMs(input.scanMs)],
      [
        'Live session selected',
        list.liveSessionId
          ? `yes${liveIsNewest ? ' (the newest file)' : ' (not the newest file)'}`
          : 'no (nothing written in the last 10 minutes)',
      ],
      [
        'Projects',
        `${list.projects.length} groups from ${distinctCwds} distinct working directories`,
      ],
    ])
  );
  out.push(...tallyTable(t('list'), 'Listed sessions'));
  out.push(...tallyTable(t('projects'), 'Project groups'));
  out.push(...tallyTable(t('cwdShapes'), 'Working directory formats'));
  out.push(...tallyTable(t('originators'), 'Originator and source'));

  // Timings
  const totals = survey.timings.map((timing) => timing.readMs + timing.normalizeMs);
  const sortedTotals = [...totals].sort((a, b) => a - b);
  const slowest = [...survey.timings]
    .sort((a, b) => b.readMs + b.normalizeMs - (a.readMs + a.normalizeMs))
    .slice(0, 3);
  const bytes = survey.timings.reduce((sum, timing) => sum + timing.bytes, 0);
  const totalMs = totals.reduce((sum, ms) => sum + ms, 0);
  out.push('## Opening a session (read + normalize)', '');
  out.push(
    ...factsTable([
      ['Sessions timed', String(survey.timings.length)],
      [
        'Open time',
        `p50 ${formatMs(percentile(sortedTotals, 50))} · p90 ${formatMs(percentile(sortedTotals, 90))} · max ${formatMs(sortedTotals[sortedTotals.length - 1] ?? 0)}`,
      ],
      ['Throughput', totalMs > 0 ? `${(bytes / MB / (totalMs / 1000)).toFixed(1)} MB/s` : '—'],
      ['Peak heap', formatBytes(survey.peakHeapBytes)],
      ...slowest.map((timing, index): [string, string] => [
        `Slowest #${index + 1}`,
        `${formatMs(timing.readMs + timing.normalizeMs)} (read ${formatMs(timing.readMs)}, normalize ${formatMs(timing.normalizeMs)}) · ${formatBytes(timing.bytes)} · ${timing.lines} lines · \`${timing.file}\``,
      ]),
    ])
  );

  out.push('## Parser anomalies', '');
  if (t('anomalies').size === 0 && t('errors').size === 0) {
    out.push('None.', '');
  }
  out.push(...tallyTable(t('anomalies'), 'Anomalies', { examples: 'all', notes: ANOMALY_NOTES }));
  out.push(...tallyTable(t('anomalyKinds'), 'Anomalies by execution kind'));
  out.push(
    ...tallyTable(t('anomalyVersions'), 'Anomalies by CLI version (session_meta.cli_version)')
  );
  out.push(
    ...tallyTable(t('missingResults'), 'Calls without a result, by structural family', {
      examples: 'all',
    })
  );
  out.push(...tallyTable(t('errors'), 'Files that could not be surveyed', { examples: 'all' }));
  out.push(
    ...tallyTable(t('lines'), 'Lines the reader skipped or did not recognize', { examples: 'all' })
  );

  out.push('## What the app renders', '');
  out.push(...tallyTable(t('executions'), 'Executions (kind → status)'));
  out.push(...tallyTable(t('generations'), 'Call generations'));
  out.push(...tallyTable(t('codeCellResults'), 'Code cells and their nested calls'));
  out.push(
    ...tallyTable(t('evidence'), 'Evidence behind nested and unlinked executions', {
      examples: 'flagged',
    })
  );
  out.push(...tallyTable(t('timeline'), 'Other timeline entries'));
  out.push(...tallyTable(t('sessions'), 'Surveyed sessions'));

  out.push('## Rollout format', '');
  out.push(...tallyTable(t('formats'), 'Line formats'));
  out.push(...tallyTable(t('recordTypes'), 'Record types', { examples: 'flagged' }));
  out.push(...tallyTable(t('envelopeKeys'), 'Envelope fields'));
  out.push(...tallyTable(t('metadataKeys'), 'Envelope metadata fields'));
  out.push(
    ...tallyTable(t('sessionMeta'), 'session_meta (instructions and tool lists are not read)')
  );
  out.push(...tallyTable(t('turnContext'), 'turn_context', { label: modelAliases() }));
  out.push(...tallyTable(t('compacted'), 'compacted (history fields are not read)'));

  out.push('## Response items', '');
  out.push(...tallyTable(t('itemTypes'), 'Item types', { examples: 'flagged' }));
  out.push(...tallyTable(t('itemKeys'), 'Item fields'));
  out.push(...tallyTable(t('messages'), 'Messages'));
  out.push(...tallyTable(t('reasoningItems'), 'Reasoning items'));

  out.push('## Tools', '');
  out.push(...tallyTable(t('tools'), 'Tool calls'));
  out.push(...tallyTable(t('toolArgs'), 'Tool argument fields'));
  out.push(...tallyTable(t('statusValues'), 'Status values'));
  out.push(...tallyTable(t('codeCells'), 'Code-mode exec cells'));
  out.push(...tallyTable(t('scriptCalls'), 'tools.* calls in exec cells (static analysis)'));
  out.push(...tallyTable(t('passthrough'), 'Harness passthrough metadata'));
  out.push(...tallyTable(t('executedToolCalls'), 'Recorded nested calls (executed_tool_calls)'));

  out.push('## Tool outputs', '');
  out.push(...tallyTable(t('outputShapes'), 'Output body shapes'));
  out.push(...tallyTable(t('outputHeaders'), 'Exec output headers (fields the parser extracted)'));
  out.push(
    ...tallyTable(t('unrecognizedHeaders'), 'Unrecognized exec output headers (labels only)', {
      examples: 'all',
    })
  );

  out.push(
    ...tallyTable(
      t('knownMessages'),
      'Harness messages in outputs without a status header (form only)',
      { examples: 'all' }
    )
  );

  out.push('## Events', '');
  out.push(...tallyTable(t('eventTypes'), 'event_msg types', { examples: 'flagged' }));
  out.push(...tallyTable(t('eventKeys'), 'Rendered event fields'));
  out.push(...tallyTable(t('turnItems'), 'item_completed item types', { examples: 'flagged' }));
  out.push(...tallyTable(t('turnItemKeys'), 'item_completed item fields'));
  out.push(...tallyTable(t('commandResults'), 'Command result events'));

  return out.join('\n');
}

// =============================================================================
// Main
// =============================================================================

interface Options {
  maxFiles: number;
  all: boolean;
  sessionsDir?: string;
  transcriptsDir?: string;
  outPath?: string;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { maxFiles: DEFAULT_MAX_FILES, all: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = (): string => {
      const next = argv[++i];
      if (next === undefined) {
        throw new Error(`${arg} needs a value`);
      }
      return next;
    };
    switch (arg) {
      case '--all':
        options.all = true;
        break;
      case '--max-files': {
        const count = Number.parseInt(value(), 10);
        if (!Number.isFinite(count) || count < 1) {
          throw new Error('--max-files must be a positive number');
        }
        options.maxFiles = count;
        break;
      }
      case '--sessions':
        options.sessionsDir = path.resolve(value());
        break;
      case '--from-transcripts':
        options.transcriptsDir = path.resolve(value());
        break;
      case '--out':
        options.outPath = path.resolve(value());
        break;
      case '--help':
      case '-h':
        console.log(
          'Usage: pnpm exec tsx scripts/codex-rollout-survey.ts [--max-files N | --all] [--sessions DIR | --from-transcripts DIR] [--out FILE]'
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option ${arg} (see --help)`);
    }
  }
  return options;
}

/**
 * Rebuild rollouts from sanitized transcripts (one JSON record per line with
 * its real `line` number) into a temporary sessions directory. Blank lines
 * keep every record on its real line, so report locations match the source.
 */
function sessionsFromTranscripts(transcriptsDir: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-survey-transcripts-'));
  const sessionsDir = path.join(root, 'sessions');
  const files = fs.readdirSync(transcriptsDir).filter((name) => name.endsWith('.jsonl'));
  for (const [index, name] of files.entries()) {
    const lines: string[] = [];
    let rolloutFile: string | undefined;
    let firstTimestamp: string | undefined;
    let lastTimestamp: string | undefined;
    for (const raw of fs.readFileSync(path.join(transcriptsDir, name), 'utf8').split('\n')) {
      if (!raw.trim()) continue;
      const entry = JSON.parse(raw) as Record<string, unknown>;
      if (typeof entry.rollout_file === 'string') rolloutFile = entry.rollout_file;
      if (typeof entry.type !== 'string' || typeof entry.line !== 'number') continue;
      const { line, bytes: _bytes, ...record } = entry;
      if (typeof record.timestamp === 'string') {
        firstTimestamp ??= record.timestamp;
        lastTimestamp = record.timestamp;
      }
      while (lines.length < line - 1) lines.push('');
      lines[line - 1] = JSON.stringify(record);
    }
    const stamp = (firstTimestamp ?? '2000-01-01T00:00:00.000Z').slice(0, 19);
    const fileName =
      rolloutFile && /^rollout-.+\.jsonl$/.test(rolloutFile)
        ? rolloutFile
        : `rollout-${stamp.replace(/:/g, '-')}-00000000-0000-4000-8000-${String(index).padStart(12, '0')}.jsonl`;
    const dayDir = path.join(sessionsDir, stamp.slice(0, 4), stamp.slice(5, 7), stamp.slice(8, 10));
    fs.mkdirSync(dayDir, { recursive: true });
    const target = path.join(dayDir, fileName);
    fs.writeFileSync(target, `${lines.join('\n')}\n`);
    // A transcript is a record of the past: date the file by its last record
    // so it is not mistaken for a live rollout.
    const modified = new Date(lastTimestamp ?? 0);
    fs.utimesSync(target, modified, modified);
  }
  return sessionsDir;
}

function describeSessionsDir(sessionsDir: string, explicit: boolean): string {
  if (explicit) {
    return 'custom location (--sessions)';
  }
  if (sessionsDir === path.join(os.homedir(), '.codex', 'sessions')) {
    return '~/.codex/sessions (default)';
  }
  return 'custom location (CODEX_HOME)';
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const sessionsDir = options.transcriptsDir
    ? sessionsFromTranscripts(options.transcriptsDir)
    : (options.sessionsDir ?? getCodexSessionsPath());
  const survey = new Survey();
  const scanner = new CodexScanner(sessionsDir);

  const scanStarted = performance.now();
  const list = await scanner.scan();
  const scanMs = performance.now() - scanStarted;
  if (!list.rootExists) {
    console.error(
      `No Codex sessions directory at ${sessionsDir}. Set CODEX_HOME or pass --sessions <dir>.`
    );
    process.exitCode = 1;
    return;
  }
  surveyList(list, survey);

  const files = (await scanner.listFiles()).sort((a, b) => b.mtimeMs - a.mtimeMs);
  const selected = options.all ? files : files.slice(0, options.maxFiles);
  for (const [index, file] of selected.entries()) {
    process.stderr.write(`\rSurveying rollout ${index + 1}/${selected.length}`);
    await surveyFile(file, scanner.isLive(file.mtimeMs), survey);
  }
  process.stderr.write('\n');

  const report = renderReport({
    sessionsDirOrigin: options.transcriptsDir
      ? 'rebuilt from sanitized transcripts (--from-transcripts); strings are placeholders'
      : describeSessionsDir(sessionsDir, options.sessionsDir !== undefined),
    list,
    scanMs,
    files,
    selected,
    survey,
  });
  const outPath = options.outPath ?? path.join(os.tmpdir(), 'codex-survey.md');
  fs.writeFileSync(outPath, report, 'utf8');
  console.log(`Report written to ${outPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
