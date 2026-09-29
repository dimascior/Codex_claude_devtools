/**
 * Codex rollout structural transcript (sanitizer).
 *
 * Reads one rollout (read-only) and writes a sanitized JSONL transcript that
 * preserves the real record ordering, line numbers, timestamps, record and
 * payload types, provider IDs, statuses, built-in tool names and content-item
 * types, but never message text, commands, arguments, outputs, code, paths or
 * URLs:
 *
 * - every string not covered below is replaced by "<string:N>" (N = length);
 * - strings under structural keys survive only in the shape their key allows
 *   (provider ids, ISO timestamps, versions, single tokens without spaces,
 *   separators or URLs); anything else becomes "<string:N>" as well;
 * - names that people or models choose (agent paths and task names, agent
 *   nicknames and roles, tool names and namespaces that Codex does not define,
 *   ids that are not provider-generated), model identifiers and model provider
 *   ids that Codex does not define are replaced by deterministic aliases such
 *   as "<task-1>", "<agent-1>", "mcp__<server-1>" or "<model-1>". Within one
 *   transcript the same value always gets the same alias, so equality
 *   survives; the alias says nothing else about the value;
 * - file-change maps (`changes` of `FileChange` items and `patch_apply_end`
 *   events) keep their structure: each file path becomes "<path-N>" (keys and
 *   `move_path`, one alias table per transcript), the change `type` is kept
 *   and file contents and diffs are replaced;
 * - `agent_thread_id` (the thread a SubAgentActivity names) is kept when it is
 *   a provider id, like the other thread ids, so subagent relations can be
 *   joined across transcripts.
 *
 * `--resanitize` applies the current rules to an existing transcript (for
 * example a committed fixture) without the raw rollout: placeholders and
 * aliases already present are kept, `line`/`bytes` and synthetic separator
 * records are preserved, and values the older rules let through are replaced.
 *
 * This script is tooling. It produced the fixtures under
 * tests/fixtures/codex/real-observed but is not itself empirical evidence of
 * Codex behaviour; see docs/codex-real-validation/README.md.
 *
 * `--select relations|file-changes` keeps only the records one kind of
 * evidence needs (see `SELECTIONS`), so it can be cut from rollouts too large
 * to commit whole; kept records carry their real line numbers.
 *
 * Usage (from the repository root):
 *   pnpm exec tsx scripts/codex-rollout-transcript.ts --file ROLLOUT.jsonl --out FILE [--select NAME]
 *   pnpm exec tsx scripts/codex-rollout-transcript.ts --resanitize TRANSCRIPT.jsonl [--out FILE]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';

/** Version of the rules below; written into transcript headers. */
export const SANITIZER_VERSION = 3;

// Keys whose string values are structural (type names, enum values, IDs,
// versions, timestamps). Their values are still shape-checked.
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
  'agent_thread_id',
  'originator',
  'cli_version',
  'source',
  'execution',
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

/** Keys holding provider-generated identifiers. */
const ID_KEYS = new Set([
  'id',
  'call_id',
  'item_id',
  'turn_id',
  'cell_id',
  'thread_id',
  'session_id',
  'forked_from_id',
  'parent_thread_id',
  'agent_thread_id',
]);

/** File-change maps: file path → `{type, move_path?, content | unified_diff}`. */
const FILE_CHANGES_KEY = 'changes';

const TIMESTAMP_KEYS = new Set([
  'timestamp',
  'created_at',
  'updated_at',
  'started_at',
  'finished_at',
]);

/** Agent paths (`/root/<task>/…`): each segment below the root is a task name. */
export const AGENT_PATH_KEYS = new Set(['author', 'recipient', 'sender', 'agent_path']);
/** Names chosen for a task when an agent is spawned (the last agent path segment). */
export const TASK_NAME_KEYS = new Set(['task_name']);
/** Display names of agents. */
export const AGENT_NAME_KEYS = new Set(['agent_nickname', 'nickname', 'agent_name']);
/** Agent roles, which configuration can define freely. */
export const AGENT_ROLE_KEYS = new Set(['agent_role', 'agent_type']);
/** Model identifiers, including unreleased or custom model names. */
export const MODEL_KEYS = new Set(['model', 'from_model', 'to_model']);
/** Model provider ids Codex defines itself; ids configured by users are aliased. */
export const BUILTIN_MODEL_PROVIDERS = new Set([
  'openai',
  'amazon-bedrock',
  'amazon-bedrock-runtime',
  'ollama',
  'ollama-chat',
  'lmstudio',
]);

/** Name of the root agent in upstream agent paths (`AgentPath::ROOT` is "/root"). */
const ROOT_AGENT_SEGMENT = 'root';

/** Tool names Codex defines itself. Other tool names are aliased. */
export const BUILTIN_TOOL_NAMES = new Set([
  'shell',
  'container.exec',
  'local_shell',
  'shell_command',
  'exec_command',
  'write_stdin',
  'unified_exec',
  'apply_patch',
  'update_plan',
  'view_image',
  'web_search',
  'tool_search',
  'image_generation',
  'exec',
  'wait',
  'spawn_agent',
  'send_message',
  'followup_task',
  'interrupt_agent',
  'wait_agent',
  'close_agent',
  'resume_agent',
  'list_agents',
  'request_user_input',
  'request_user_input_async',
  'list_mcp_resources',
  'list_mcp_resource_templates',
  'read_mcp_resource',
]);

/**
 * Tool namespaces Codex provides (built-in tools, bundled MCP servers and the
 * app connectors seen in real rollouts). Tool names inside them are kept;
 * other namespaces are aliased (`mcp__<server-1>`, `<namespace-1>`).
 */
export const BUILTIN_NAMESPACES = new Set([
  'clock',
  'collaboration',
  'web',
  'mcp__node_repl',
  'mcp__cua_repl',
  'mcp__codex_apps',
  'mcp__codex_apps__github',
]);

// parsed_cmd entries describe the shell command; only their `type` is structural.
const PARSED_CMD_KEY = 'parsed_cmd';

export const MAX_ARRAY_ITEMS = 12;

/** A single token: no whitespace, path separators, URLs or quotes. */
const TOKEN = /^[A-Za-z0-9_][A-Za-z0-9._:+-]{0,79}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?$/;
const VERSION = /^\d{1,4}(\.\d{1,6}){1,3}([-+][0-9A-Za-z.-]{1,40})?$/;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
/** `call_…`, `ws_…`, `rs_…`, `msg_…`: a short prefix and a long opaque token. */
const PREFIXED_OPAQUE_ID = /^[A-Za-z][A-Za-z0-9]{0,15}[_-][A-Za-z0-9_-]{16,}$/;
/** Counters Codex uses as ids: `7`, `item-17`. */
const SEQUENTIAL_ID = /^([a-z]{1,16}[-_])?\d{1,20}$/;
/** Built-in ids Codex writes with a leading colon (e.g. permission profiles). */
const BUILTIN_COLON_ID = /^:[a-z][a-z0-9-]{0,63}$/;
const OBJECT_KEY = /^[A-Za-z0-9_$@-][A-Za-z0-9_.$@-]{0,63}$/;

const PLACEHOLDER =
  /^(<(string|array|object):\d+>|<object>|<\.\.\.\d+ more>|<(number|boolean|undefined|bigint|symbol|function)>)$/;
const TRUNCATION_MARKER = /^<\.\.\.\d+ more>$/;
const ALIAS_KINDS = [
  'agent',
  'task',
  'role',
  'tool',
  'server',
  'namespace',
  'id',
  'key',
  'model',
  'provider',
  'path',
] as const;
type AliasKind = (typeof ALIAS_KINDS)[number];
const ALIAS = /^<(agent|task|role|tool|server|namespace|id|key|model|provider|path)-(\d+)>$/;

/** Whether a string is output of this sanitizer (size placeholder or alias). */
export function isSanitizedToken(value: string): boolean {
  return PLACEHOLDER.test(value) || ALIAS.test(value);
}

export function sizeOf(value: unknown): string {
  if (typeof value === 'string') return `<string:${value.length}>`;
  if (Array.isArray(value)) return `<array:${value.length}>`;
  if (value && typeof value === 'object') return `<object:${Object.keys(value).length}>`;
  return `<${typeof value}>`;
}

function isProviderId(value: string): boolean {
  return (
    UUID.test(value) ||
    PREFIXED_OPAQUE_ID.test(value) ||
    SEQUENTIAL_ID.test(value) ||
    BUILTIN_COLON_ID.test(value)
  );
}

/**
 * Sanitizes the records of one transcript. Aliases are assigned in order of
 * first appearance and are stable for the lifetime of the instance.
 */
export class TranscriptSanitizer {
  private readonly aliases = new Map<AliasKind, Map<string, string>>();
  private readonly used = new Map<AliasKind, Set<number>>();

  /**
   * @param reserved alias tokens already present in the input (re-sanitizing),
   *   which new aliases must not reuse
   */
  constructor(reserved: Iterable<string> = []) {
    for (const kind of ALIAS_KINDS) {
      this.aliases.set(kind, new Map());
      this.used.set(kind, new Set());
    }
    for (const token of reserved) {
      const match = ALIAS.exec(token);
      if (match) this.used.get(match[1] as AliasKind)?.add(Number(match[2]));
    }
  }

  /** Sanitize any value found under `key`. */
  value(value: unknown, key: string | null): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'string') return this.string(value, key, undefined);
    if (Array.isArray(value)) return this.array(value, key);
    if (typeof value === 'object') return this.object(value as Record<string, unknown>);
    return sizeOf(value);
  }

  /** Sanitize one raw rollout line into a transcript record. */
  line(raw: string, lineNumber: number): Record<string, unknown> {
    if (raw.trim() === '') return { line: lineNumber, empty: true };
    let record: unknown;
    try {
      record = JSON.parse(raw);
    } catch {
      return { line: lineNumber, parse_error: true, bytes: raw.length };
    }
    const sanitized = this.value(record, null);
    if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) {
      return { line: lineNumber, bytes: raw.length, non_object: sizeOf(record) };
    }
    return { line: lineNumber, bytes: raw.length, ...(sanitized as Record<string, unknown>) };
  }

  private string(
    value: string,
    key: string | null,
    siblings: Record<string, unknown> | undefined
  ): string {
    if (isSanitizedToken(value)) return value;
    if (key === null) return sizeOf(value);
    if (AGENT_PATH_KEYS.has(key)) return this.agentPath(value);
    if (TASK_NAME_KEYS.has(key)) return this.alias('task', value);
    if (AGENT_NAME_KEYS.has(key)) return this.alias('agent', value);
    if (AGENT_ROLE_KEYS.has(key)) return this.alias('role', value);
    if (MODEL_KEYS.has(key)) return this.alias('model', value);
    if (key === 'model_provider') {
      return BUILTIN_MODEL_PROVIDERS.has(value) ? value : this.alias('provider', value);
    }
    if (key === 'namespace') return this.namespace(value);
    if (key === 'name') return this.toolName(value, siblings);
    if (!KEEP_STRING_KEYS.has(key)) return sizeOf(value);
    if (ID_KEYS.has(key)) return isProviderId(value) ? value : this.alias('id', value);
    if (TIMESTAMP_KEYS.has(key)) return ISO_TIMESTAMP.test(value) ? value : sizeOf(value);
    if (key === 'cli_version') return VERSION.test(value) ? value : sizeOf(value);
    return TOKEN.test(value) ? value : sizeOf(value);
  }

  private array(value: unknown[], key: string | null): unknown[] {
    if (key === PARSED_CMD_KEY) {
      return value.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? { type: this.value((item as Record<string, unknown>).type, 'type') }
          : this.value(item, null)
      );
    }
    // Preserve content-item types for `content` arrays, but nothing else.
    if (key === 'content') {
      return value.map((item) => this.value(item, null));
    }
    // An array this sanitizer already truncated keeps its marker.
    const last = value[value.length - 1];
    const marked = typeof last === 'string' && TRUNCATION_MARKER.test(last);
    const items = marked ? value.slice(0, -1) : value;
    const head = items.slice(0, MAX_ARRAY_ITEMS).map((item) => this.value(item, key));
    if (marked) head.push(last);
    else if (items.length > MAX_ARRAY_ITEMS)
      head.push(`<...${items.length - MAX_ARRAY_ITEMS} more>`);
    return head;
  }

  private object(value: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [rawKey, v] of Object.entries(value)) {
      const k =
        OBJECT_KEY.test(rawKey) || isSanitizedToken(rawKey) ? rawKey : this.alias('key', rawKey);
      if (k === FILE_CHANGES_KEY && isPlainObject(v)) {
        out[k] = this.fileChanges(v);
        continue;
      }
      if (OMIT_KEYS.has(k)) {
        if (k === 'content' && Array.isArray(v)) {
          out[k] = this.array(v, k);
        } else {
          out[k] = typeof v === 'string' && isSanitizedToken(v) ? v : sizeOf(v);
        }
        continue;
      }
      out[k] = typeof v === 'string' ? this.string(v, k, value) : this.value(v, k);
    }
    return out;
  }

  /**
   * A file-change map: every file path becomes `<path-N>`, each change keeps
   * its `type` and an aliased `move_path`; contents, diffs and anything else
   * are replaced by their size.
   */
  private fileChanges(changes: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [filePath, change] of Object.entries(changes)) {
      const key = this.pathAlias(filePath);
      if (!isPlainObject(change)) {
        out[key] = typeof change === 'string' && isSanitizedToken(change) ? change : sizeOf(change);
        continue;
      }
      const sanitized: Record<string, unknown> = {};
      for (const [field, value] of Object.entries(change)) {
        if (field === 'type' && typeof value === 'string') {
          sanitized[field] = this.string(value, 'type', change);
        } else if (field === 'move_path' && typeof value === 'string') {
          sanitized[field] = this.pathAlias(value);
        } else if (field === 'move_path' && value === null) {
          sanitized[field] = null;
        } else {
          sanitized[field] =
            typeof value === 'string' && isSanitizedToken(value) ? value : sizeOf(value);
        }
      }
      out[key] = sanitized;
    }
    return out;
  }

  private pathAlias(value: string): string {
    return isSanitizedToken(value) ? value : this.alias('path', value);
  }

  /** `/root/a/b` → `/root/<task-1>/<task-2>`; other values → `<agent-N>`. */
  private agentPath(value: string): string {
    if (!value.startsWith('/')) {
      return isProviderId(value) ? value : this.alias('agent', value);
    }
    const segments = value.split('/').slice(1);
    return `/${segments
      .map((segment, index) =>
        (index === 0 && segment === ROOT_AGENT_SEGMENT) || isSanitizedToken(segment)
          ? segment
          : this.alias('task', segment)
      )
      .join('/')}`;
  }

  private namespace(value: string): string {
    if (BUILTIN_NAMESPACES.has(value)) return value;
    if (value.startsWith('mcp__')) {
      const server = value.slice('mcp__'.length);
      return `mcp__${isSanitizedToken(server) ? server : this.alias('server', server)}`;
    }
    return this.alias('namespace', value);
  }

  private toolName(value: string, siblings: Record<string, unknown> | undefined): string {
    const namespace = siblings?.namespace;
    if (
      BUILTIN_TOOL_NAMES.has(value) ||
      (typeof namespace === 'string' && BUILTIN_NAMESPACES.has(namespace) && TOKEN.test(value))
    ) {
      return value;
    }
    // Older producers join the MCP server into the name: mcp__<server>__<tool>.
    const mcp = /^mcp__(.+?)__(.+)$/.exec(value);
    if (mcp) {
      const namespaceKept = BUILTIN_NAMESPACES.has(`mcp__${mcp[1]}`);
      const server = namespaceKept ? mcp[1] : this.alias('server', mcp[1]);
      const tool = namespaceKept && TOKEN.test(mcp[2]) ? mcp[2] : this.alias('tool', mcp[2]);
      return `mcp__${server}__${tool}`;
    }
    return this.alias('tool', value);
  }

  private alias(kind: AliasKind, value: string): string {
    if (ALIAS.test(value)) return value;
    const table = this.aliases.get(kind)!;
    const known = table.get(value);
    if (known) return known;
    const used = this.used.get(kind)!;
    let n = 1;
    while (used.has(n)) n++;
    used.add(n);
    const alias = `<${kind}-${n}>`;
    table.set(value, alias);
    return alias;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Sanitize a single value with fresh aliases (convenience for one-off use). */
export function sanitize(value: unknown, key: string | null): unknown {
  return new TranscriptSanitizer().value(value, key);
}

/** Sanitize one raw rollout line; pass one sanitizer per rollout to keep aliases stable. */
export function sanitizeLine(
  raw: string,
  lineNumber: number,
  sanitizer: TranscriptSanitizer = new TranscriptSanitizer()
): Record<string, unknown> {
  return sanitizer.line(raw, lineNumber);
}

/** Alias tokens present anywhere in a JSON value. */
function collectAliases(value: unknown, into: Set<string>): void {
  if (typeof value === 'string') {
    for (const part of value.split('/')) if (ALIAS.test(part)) into.add(part);
    const mcp = /^mcp__(<[a-z]+-\d+>)(?:__(<[a-z]+-\d+>))?/.exec(value);
    if (mcp) for (const token of mcp.slice(1)) if (token) into.add(token);
  } else if (Array.isArray(value)) {
    for (const item of value) collectAliases(item, into);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (ALIAS.test(k)) into.add(k);
      collectAliases(v, into);
    }
  }
}

function isTranscriptRecord(value: Record<string, unknown>): boolean {
  return typeof value.line === 'number' && typeof value.type === 'string';
}

/**
 * Apply the current rules to the lines of an existing transcript. Transcript
 * records (with `line` and `type`) are re-sanitized; headers, footers, empty or
 * unparsable-line markers and synthetic `_evidence_*` separators are kept.
 */
export function resanitizeTranscript(lines: readonly string[]): string[] {
  const parsed = lines.map((line) => (line.trim() === '' ? null : (JSON.parse(line) as unknown)));
  const reserved = new Set<string>();
  for (const value of parsed) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (isTranscriptRecord(value as Record<string, unknown>)) collectAliases(value, reserved);
    }
  }
  const sanitizer = new TranscriptSanitizer(reserved);
  return parsed.flatMap((value) => {
    if (value === null) return [];
    if (typeof value !== 'object' || Array.isArray(value)) return [JSON.stringify(value)];
    const record = value as Record<string, unknown>;
    // Transcript headers and the headers of assembled evidence packages.
    if (('transcript' in record || '_evidence_package' in record) && !isTranscriptRecord(record)) {
      return [JSON.stringify({ ...record, sanitizer_version: SANITIZER_VERSION })];
    }
    if (!isTranscriptRecord(record)) return [JSON.stringify(record)];
    const { line, bytes, ...rest } = record;
    const sanitized = sanitizer.value(rest, null) as Record<string, unknown>;
    return [JSON.stringify({ line, ...(bytes !== undefined ? { bytes } : {}), ...sanitized })];
  });
}

// =============================================================================
// Record selections
// =============================================================================

/** What a rollout record looks like before sanitizing (only structure is read). */
interface RawRecord {
  type?: unknown;
  payload?: Record<string, unknown>;
}

/** Ids gathered in a first pass over the rollout, for selections that need them. */
interface SelectionIds {
  /** Ids of `FileChange` items and `patch_apply_end` events */
  fileChanges: Set<string>;
}

interface Selection {
  description: string;
  /** Whether a record belongs to the selection; `kept` holds call ids kept so far */
  keep: (record: RawRecord, ids: SelectionIds, kept: Set<string>) => boolean;
}

const TURN_EVENTS = new Set(['task_started', 'task_complete', 'turn_aborted']);
const CALL_TYPES = new Set(['function_call', 'custom_tool_call', 'local_shell_call']);
const OUTPUT_TYPES = new Set(['function_call_output', 'custom_tool_call_output']);

function payloadOf(record: RawRecord): Record<string, unknown> {
  return record.payload && typeof record.payload === 'object' ? record.payload : {};
}

function completedItemType(record: RawRecord): unknown {
  const payload = payloadOf(record);
  if (record.type !== 'event_msg' || payload.type !== 'item_completed') return undefined;
  const item = payload.item;
  return item && typeof item === 'object' ? (item as Record<string, unknown>).type : undefined;
}

/**
 * Evidence selections. Line 1 (session metadata) is always kept, and so are
 * the turn and settings records the viewer needs to place the others.
 */
export const SELECTIONS: Record<string, Selection> = {
  relations: {
    description:
      'Subagent relations: session_meta, turn and thread-settings records, collaboration calls (spawn_agent, send_message, …), SubAgentActivity items and inter-agent messages.',
    keep: (record) => {
      const payload = payloadOf(record);
      switch (record.type) {
        case 'session_meta':
        case 'turn_context':
        case 'inter_agent_communication_metadata':
          return true;
        case 'event_msg':
          return (
            TURN_EVENTS.has(String(payload.type)) ||
            payload.type === 'thread_settings_applied' ||
            completedItemType(record) === 'SubAgentActivity'
          );
        case 'response_item':
          return (
            (payload.type === 'function_call' && payload.namespace === 'collaboration') ||
            payload.type === 'agent_message'
          );
        default:
          return false;
      }
    },
  },
  'file-changes': {
    description:
      "File changes: session_meta and turn records, FileChange items, patch_apply_end events, the calls sharing their ids or named apply_patch, and those calls' outputs.",
    keep: (record, ids, kept) => {
      const payload = payloadOf(record);
      switch (record.type) {
        case 'session_meta':
        case 'turn_context':
          return true;
        case 'event_msg':
          return (
            TURN_EVENTS.has(String(payload.type)) ||
            payload.type === 'patch_apply_end' ||
            completedItemType(record) === 'FileChange'
          );
        case 'response_item': {
          const callId = typeof payload.call_id === 'string' ? payload.call_id : undefined;
          if (CALL_TYPES.has(String(payload.type))) {
            const keep =
              payload.name === 'apply_patch' ||
              (callId !== undefined && ids.fileChanges.has(callId));
            if (keep && callId !== undefined) kept.add(callId);
            return keep;
          }
          return OUTPUT_TYPES.has(String(payload.type)) && callId !== undefined && kept.has(callId);
        }
        default:
          return false;
      }
    },
  },
};

function parseRaw(line: string): RawRecord | undefined {
  try {
    const value = JSON.parse(line) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as RawRecord)
      : undefined;
  } catch {
    return undefined;
  }
}

async function* rolloutLines(file: string): AsyncGenerator<string> {
  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) yield line;
}

/**
 * The 1-based line numbers of a rollout that belong to a selection. Reads the
 * rollout twice: once for the ids file-change records carry, once to decide.
 */
export async function selectedLines(file: string, name: string): Promise<Set<number>> {
  const selection = SELECTIONS[name];
  if (!selection) {
    throw new Error(`Unknown selection "${name}" (known: ${Object.keys(SELECTIONS).join(', ')})`);
  }
  const ids: SelectionIds = { fileChanges: new Set() };
  for await (const line of rolloutLines(file)) {
    const record = parseRaw(line);
    if (!record) continue;
    const payload = payloadOf(record);
    if (record.type === 'event_msg' && payload.type === 'patch_apply_end') {
      if (typeof payload.call_id === 'string') ids.fileChanges.add(payload.call_id);
    } else if (completedItemType(record) === 'FileChange') {
      const id = (payload.item as Record<string, unknown>).id;
      if (typeof id === 'string') ids.fileChanges.add(id);
    }
  }
  const lines = new Set<number>();
  const kept = new Set<string>();
  let lineNumber = 0;
  for await (const line of rolloutLines(file)) {
    lineNumber++;
    const record = parseRaw(line);
    if (lineNumber === 1 || (record && selection.keep(record, ids, kept))) {
      lines.add(lineNumber);
    }
  }
  return lines;
}

function parseArgs(argv: string[]): {
  file: string;
  out: string;
  resanitize: boolean;
  select?: string;
} {
  let file = '';
  let out = '';
  let resanitize = false;
  let select: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file') file = argv[++i] ?? '';
    else if (argv[i] === '--resanitize') {
      resanitize = true;
      file = argv[++i] ?? '';
    } else if (argv[i] === '--out') out = argv[++i] ?? '';
    else if (argv[i] === '--select') select = argv[++i] ?? '';
  }
  if (!file) throw new Error('--file ROLLOUT.jsonl or --resanitize TRANSCRIPT.jsonl is required');
  if (select !== undefined && !SELECTIONS[select]) {
    throw new Error(`--select must be one of: ${Object.keys(SELECTIONS).join(', ')}`);
  }
  if (!out) {
    out = resanitize
      ? file
      : path.join('real-data', `${path.basename(file, '.jsonl')}.structural.jsonl`);
  }
  return { file, out, resanitize, select };
}

async function main(): Promise<void> {
  const { file, out, resanitize, select } = parseArgs(process.argv.slice(2));
  fs.mkdirSync(path.dirname(out), { recursive: true });

  if (resanitize) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    const result = resanitizeTranscript(lines);
    fs.writeFileSync(out, `${result.join('\n')}\n`);
    console.error(
      `Re-sanitized ${path.resolve(file)} -> ${path.resolve(out)} (${result.length} lines)`
    );
    return;
  }

  const keep = select ? await selectedLines(file, select) : undefined;
  const writer = fs.createWriteStream(out, { encoding: 'utf8' });
  const header = {
    transcript: 'codex-rollout-structural',
    generated: new Date().toISOString(),
    rollout_file: path.basename(file),
    rollout_bytes: fs.statSync(file).size,
    note: 'Free-text strings replaced by <string:N>; chosen names, file paths and model identifiers by deterministic aliases; ordering, types and provider IDs preserved.',
    ...(select ? { selection: select, selection_note: SELECTIONS[select].description } : {}),
    sanitizer_version: SANITIZER_VERSION,
  };
  writer.write(JSON.stringify(header) + '\n');

  const sanitizer = new TranscriptSanitizer();
  let lineNumber = 0;
  let failed = 0;
  let written = 0;
  for await (const raw of rolloutLines(file)) {
    lineNumber++;
    if (keep && !keep.has(lineNumber)) continue;
    const record = sanitizer.line(raw, lineNumber);
    if (record.parse_error) failed++;
    writer.write(JSON.stringify(record) + '\n');
    written++;
  }

  writer.write(
    JSON.stringify({
      transcript_end: true,
      lines: lineNumber,
      ...(keep ? { kept: written } : {}),
      parse_failed: failed,
    }) + '\n'
  );
  await new Promise<void>((resolve, reject) => {
    writer.end(() => resolve());
    writer.on('error', reject);
  });
  console.error(
    `Transcript written to ${path.resolve(out)} (${lineNumber} lines, ${failed} parse failures)`
  );
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
