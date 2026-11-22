/**
 * Runtime-state section of the Codex rollout survey (scripts/codex-rollout-survey.ts).
 *
 * Structural evidence for designing runtime-settings support, gathered before
 * any of it is implemented:
 *
 * - A. which settings fields each Codex version persists in `turn_context`,
 *   `thread_settings_applied`, `session_meta` and `world_state`: types, enum
 *   values where safe, distinct values;
 * - B. how often each setting actually changes within a session, by version;
 * - C. how `thread_settings_applied` relates to the `turn_context` records
 *   around it (order, agreement, whether disagreements persist);
 * - D. what `token_usage_record` carries and how its usage objects relate;
 * - E. which turn lifecycle fields are persisted;
 * - F. which identifiers can join a subagent rollout to its parent, by method.
 *
 * It reports what the records show and decides no precedence or meaning. It
 * never emits message text, commands, outputs, paths, working directories,
 * repository URLs, agent names, task text or ids: values are printed only for
 * an explicit allowlist of enum-like settings, and only when they look like an
 * enum value; model names go through the report's `<model-N>` aliases.
 * Records a forked subagent copied from its parent are left out (they are the
 * parent's history), by the same rule the normalizer uses.
 */

import { createHash } from 'crypto';

import {
  type CodexSessionMetadata,
  InheritedHistoryTracker,
  parseSessionMeta,
} from '../src/main/providers/codex/CodexMetadataParser';
import { outputBodyToText } from '../src/main/providers/codex/execOutput';

import type { CodexRolloutRecord } from '../src/main/providers/codex/types';

// =============================================================================
// Vocabulary
// =============================================================================

const MAX_EXAMPLES = 3;
const MAX_DEPTH = 4;
const NONE = '(none)';

type Family = 'turn_context' | 'thread_settings_applied' | 'session_meta' | 'world_state';

const FAMILIES: readonly Family[] = [
  'turn_context',
  'thread_settings_applied',
  'session_meta',
  'world_state',
];

const FAMILY_TITLES: Record<Family, string> = {
  turn_context: '`turn_context` (payload)',
  thread_settings_applied: '`event_msg` `thread_settings_applied` (payload `thread_settings`)',
  session_meta: '`session_meta` (payload)',
  world_state: '`world_state` (payload; records with `full: false` carry only changed keys)',
};

/** Free text, instructions, tool lists and copied history: only their type is recorded. */
const OPAQUE_KEYS = new Set([
  'instructions',
  'base_instructions',
  'user_instructions',
  'developer_instructions',
  'dynamic_tools',
  'tools',
  'replacement_history',
  'message',
]);

/** `world_state` subtrees that hold settings; the rest is instruction and environment text. */
const WORLD_STATE_SUBTREES = new Set([
  'state',
  'state.collaboration_mode',
  'state.multi_agent_mode',
  'state.personality',
  'state.realtime',
]);

/** Keys (last path segment) whose values are enum-like and may be shown. */
const ENUM_KEYS = new Set([
  'approval_policy',
  'approvals_reviewer',
  'cli_version',
  'codex_error_info',
  'collaboration_mode_kind',
  'effort',
  'history_mode',
  'kind',
  'mode',
  'model_provider',
  'model_provider_id',
  'multi_agent_mode',
  'multi_agent_version',
  'originator',
  'personality',
  'reason',
  'reasoning_effort',
  'reasoning_summary',
  'service_tier',
  'source',
  'status',
  'summary',
  'thread_source',
  'tool',
  'type',
]);

/** Numbers that are settings rather than counts, sizes or timestamps. */
const NUMBER_KEYS = new Set(['depth', 'window_number', 'model_context_window']);

/** Lists shown by length only. */
const COUNT_KEYS = new Set([
  'workspace_roots',
  'runtime_workspace_roots',
  'disabled_plugin_ids',
  'writable_roots',
]);

/** Settings compared as a whole even though their values are never shown. */
const SETTING_KEYS = new Set([
  'cwd',
  'sandbox_policy',
  'file_system_sandbox_policy',
  'permission_profile',
  'active_permission_profile',
  'collaboration_mode',
  'settings',
  'realtime_active',
  'realtime',
]);

const ENUM_VALUE = /^[A-Za-z0-9][\w.:+-]{0,39}$/;
const IDENTIFIER = /^[A-Za-z_$][\w$]{0,63}$/;
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
/** Values the transcript sanitizer substitutes for free text. */
const PLACEHOLDER = /"<(?:string:\d+|object)>"/;
const MODEL_TAG = 'model\u0000';

/**
 * Fields compared between `thread_settings_applied` and `turn_context`. Some
 * names differ between the two records; the pairs are candidates under test,
 * not settled equivalents.
 */
export const SETTINGS_PAIRS: readonly (readonly [thread: string, turn: string])[] = [
  ['model', 'model'],
  ['reasoning_effort', 'effort'],
  ['reasoning_summary', 'summary'],
  ['approval_policy', 'approval_policy'],
  ['approvals_reviewer', 'approvals_reviewer'],
  ['sandbox_policy', 'sandbox_policy'],
  ['permission_profile', 'permission_profile'],
  ['active_permission_profile', 'active_permission_profile'],
  ['collaboration_mode', 'collaboration_mode'],
  ['personality', 'personality'],
  ['service_tier', 'service_tier'],
  ['cwd', 'cwd'],
  ['disabled_plugin_ids', 'disabled_plugin_ids'],
];

/** The same setting persisted twice within one record. */
const INTERNAL_PAIRS: readonly (readonly [Family, string, string])[] = [
  ['turn_context', 'effort', 'collaboration_mode.settings.reasoning_effort'],
  ['turn_context', 'model', 'collaboration_mode.settings.model'],
  ['thread_settings_applied', 'reasoning_effort', 'collaboration_mode.settings.reasoning_effort'],
  ['thread_settings_applied', 'model', 'collaboration_mode.settings.model'],
];

const TOKEN_OBJECTS = ['usage', 'turn_token_usage', 'thread_token_usage'] as const;
const TOKEN_IDS = ['response_id', 'turn_id', 'thread_id', 'session_id', 'root_turn_id'] as const;

const TURN_STARTS = new Set(['task_started', 'turn_started']);
const TURN_COMPLETIONS = new Set(['task_complete', 'turn_complete']);
const TURN_ABORTED = 'turn_aborted';
const LIFECYCLE_FIELDS = [
  'turn_id',
  'started_at',
  'completed_at',
  'duration_ms',
  'time_to_first_token_ms',
  'error',
  'reason',
  'last_agent_message',
  'model_context_window',
  'collaboration_mode_kind',
] as const;

const TOOL_CALL_ITEMS = new Set([
  'function_call',
  'custom_tool_call',
  'local_shell_call',
  'web_search_call',
  'tool_search_call',
  'image_generation_call',
]);
const COLLABORATION_TOOLS = new Set([
  'spawn_agent',
  'send_message',
  'send_input',
  'wait_agent',
  'followup_task',
  'list_agents',
  'interrupt_agent',
  'close_agent',
  'resume_agent',
]);

// =============================================================================
// Helpers
// =============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Code-unit order, independent of the machine's locale. */
function compareText(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/**
 * Codex version order: 0.9.0 < 0.42.0 < 0.153.0-alpha.1 < 0.153.0; anything
 * that is not a version sorts last, `(none)` after it.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (version: string): { core: number[]; pre?: string[] } | undefined => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?$/.exec(version);
    return match
      ? { core: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4]?.split('.') }
      : undefined;
  };
  if (a === b) return 0;
  if (a === NONE || b === NONE) return a === NONE ? 1 : -1;
  const va = parse(a);
  const vb = parse(b);
  if (!va || !vb) return va ? -1 : vb ? 1 : compareText(a, b);
  for (let i = 0; i < 3; i++) {
    if (va.core[i] !== vb.core[i]) return va.core[i] - vb.core[i];
  }
  if (!va.pre || !vb.pre) return va.pre ? -1 : vb.pre ? 1 : 0;
  for (let i = 0; i < Math.min(va.pre.length, vb.pre.length); i++) {
    const [x, y] = [va.pre[i], vb.pre[i]];
    const [nx, ny] = [/^\d+$/.test(x) ? Number(x) : NaN, /^\d+$/.test(y) ? Number(y) : NaN];
    const order =
      !Number.isNaN(nx) && !Number.isNaN(ny)
        ? nx - ny
        : Number.isNaN(nx) !== Number.isNaN(ny)
          ? Number.isNaN(nx)
            ? 1
            : -1
          : compareText(x, y);
    if (order !== 0) return order;
  }
  return va.pre.length - vb.pre.length;
}

/** Tab-separated keys, column by column; columns holding versions compare as versions. */
function compareKeys(a: string, b: string): number {
  const [partsA, partsB] = [a.split('\t'), b.split('\t')];
  const isVersion = (part: string): boolean => part === NONE || /^\d+\.\d+\.\d+/.test(part);
  for (let i = 0; i < Math.min(partsA.length, partsB.length); i++) {
    const [x, y] = [partsA[i], partsB[i]];
    const order = isVersion(x) && isVersion(y) ? compareVersions(x, y) : compareText(x, y);
    if (order !== 0) return order;
  }
  return partsA.length - partsB.length;
}

/** JSON with sorted keys, so equal values compare equal. Kept in memory only. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (isRecord(value)) {
    const keys = Object.keys(value).sort(compareText);
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function digest(value: unknown): string {
  return createHash('sha1').update(canonical(value)).digest('hex');
}

/** Field names of an object (never values); other keys are only counted. */
function keyNames(value: Record<string, unknown>): string {
  const keys = Object.keys(value);
  const names = keys.filter((key) => IDENTIFIER.test(key)).sort(compareText);
  const other = keys.length - names.length;
  const suffix = other > 0 ? `${names.length > 0 ? ', ' : ''}+${other} other keys` : '';
  return `{${names.join(', ')}${suffix}}`;
}

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/** Value at a dotted path. */
function at(root: Record<string, unknown>, path: string): unknown {
  let current: unknown = root;
  for (const key of path.split('.')) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

/**
 * An enum-like value as it may be shown: the value itself when it looks like
 * an enum value, the tag path of a tagged enum object (`{"subagent":
 * {"thread_spawn": {…}}}` → `{subagent.thread_spawn}`), else `(text)`.
 */
function enumText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return ENUM_VALUE.test(value) ? value : '(text)';
  }
  // A tagged variant carries an object: {"subagent": {…}}. {"key": "text"} is data, not a tag.
  const [only] = isRecord(value) ? Object.values(value) : [];
  if (isRecord(value) && Object.keys(value).length === 1 && isRecord(only)) {
    const tags: string[] = [];
    let current: unknown = value;
    while (isRecord(current) && Object.keys(current).length === 1 && tags.length < 2) {
      const [tag] = Object.keys(current);
      if (!IDENTIFIER.test(tag)) break;
      tags.push(tag);
      current = current[tag];
    }
    return tags.length > 0 ? `{${tags.join('.')}}` : undefined;
  }
  return undefined;
}

/**
 * How a settings value may appear in the report, or undefined when only its
 * type may be shown.
 */
export function safeValue(path: string, value: unknown): string | undefined {
  const key = path.slice(path.lastIndexOf('.') + 1);
  if (typeof value === 'boolean') {
    return String(value);
  }
  if (key === 'model') {
    return typeof value === 'string' ? `${MODEL_TAG}${value}` : undefined;
  }
  if (path === 'active_permission_profile.id' || path.endsWith('.active_permission_profile.id')) {
    if (typeof value !== 'string') return undefined;
    // Built-in profiles start with ':'; other ids are names the user chose.
    return value.startsWith(':') && ENUM_VALUE.test(value.slice(1)) ? value : '(custom id)';
  }
  if (COUNT_KEYS.has(key)) {
    return Array.isArray(value)
      ? `${value.length} ${value.length === 1 ? 'entry' : 'entries'}`
      : undefined;
  }
  if (NUMBER_KEYS.has(key)) {
    return num(value) === undefined ? undefined : String(value);
  }
  return ENUM_KEYS.has(key) ? enumText(value) : undefined;
}

/** Whether a field is a setting (tracked per version), not an id, date or text. */
function isSetting(path: string): boolean {
  const key = path.slice(path.lastIndexOf('.') + 1);
  return (
    key === 'model' ||
    key === 'full' ||
    ENUM_KEYS.has(key) ||
    NUMBER_KEYS.has(key) ||
    COUNT_KEYS.has(key) ||
    SETTING_KEYS.has(key) ||
    path.endsWith('active_permission_profile.id')
  );
}

function familyOf(record: CodexRolloutRecord): Family | undefined {
  switch (record.type) {
    case 'turn_context':
    case 'session_meta':
    case 'world_state':
      return record.type;
    case 'event_msg':
      return record.payload.type === 'thread_settings_applied'
        ? 'thread_settings_applied'
        : undefined;
    default:
      return undefined;
  }
}

function settingsRoot(
  family: Family,
  record: CodexRolloutRecord
): Record<string, unknown> | undefined {
  if (family !== 'thread_settings_applied') {
    return record.payload;
  }
  const settings = record.payload.thread_settings;
  return isRecord(settings) ? settings : undefined;
}

interface Field {
  path: string;
  value: unknown;
}

/** Fields of a settings object with their dotted paths (identifier keys only). */
function fieldsOf(family: Family, root: Record<string, unknown>): Field[] {
  const fields: Field[] = [];
  const walk = (value: Record<string, unknown>, prefix: string, depth: number): void => {
    let other = 0;
    for (const [key, child] of Object.entries(value)) {
      if (!IDENTIFIER.test(key)) {
        other++;
        continue;
      }
      const path = prefix ? `${prefix}.${key}` : key;
      fields.push({ path, value: child });
      const descend =
        family === 'world_state' ? WORLD_STATE_SUBTREES.has(path) : !OPAQUE_KEYS.has(key);
      if (isRecord(child) && depth < MAX_DEPTH && descend) {
        walk(child, path, depth + 1);
      }
    }
    if (other > 0) {
      fields.push({ path: `${prefix ? `${prefix}.` : ''}(other keys)`, value: other });
    }
  };
  walk(root, '', 1);
  return fields;
}

type Comparison =
  | 'agree'
  | 'disagree'
  | 'first only'
  | 'second only'
  | 'neither'
  | 'not comparable (sanitized placeholder)';

function compareValues(first: unknown, second: unknown): Comparison {
  if (first === undefined && second === undefined) return 'neither';
  if (second === undefined) return 'first only';
  if (first === undefined) return 'second only';
  const [a, b] = [canonical(first), canonical(second)];
  if (PLACEHOLDER.test(a) || PLACEHOLDER.test(b)) return 'not comparable (sanitized placeholder)';
  return a === b ? 'agree' : 'disagree';
}

function comparisonLabel(comparison: Comparison, first: string, second: string): string {
  switch (comparison) {
    case 'first only':
      return `only in ${first}`;
    case 'second only':
      return `only in ${second}`;
    case 'neither':
      return 'in neither';
    default:
      return comparison;
  }
}

function epochMs(timestamp: string | undefined): number | undefined {
  if (!timestamp) return undefined;
  const ms = Date.parse(timestamp);
  return Number.isNaN(ms) ? undefined : ms;
}

// =============================================================================
// Tallies
// =============================================================================

interface Where {
  file: string;
  version: string;
  line?: number;
}

interface Row {
  count: number;
  sessions: Set<string>;
  versions: Set<string>;
  examples: string[];
}

/** Keeps the smallest few locations, so the report does not depend on file order. */
function addExample(examples: string[], example: string): void {
  if (examples.includes(example)) return;
  examples.push(example);
  examples.sort(compareText);
  if (examples.length > MAX_EXAMPLES) examples.length = MAX_EXAMPLES;
}

class Tally {
  private readonly rows = new Map<string, Row>();

  add(key: string, where: Where, amount = 1): void {
    let row = this.rows.get(key);
    if (!row) {
      row = { count: 0, sessions: new Set(), versions: new Set(), examples: [] };
      this.rows.set(key, row);
    }
    row.count += amount;
    row.sessions.add(where.file);
    row.versions.add(where.version);
    if (where.line !== undefined) addExample(row.examples, `${where.file}:${where.line}`);
  }

  get(key: string): Row | undefined {
    return this.rows.get(key);
  }

  count(key: string): number {
    return this.rows.get(key)?.count ?? 0;
  }

  /** Rows by key; keys may hold tab-separated columns, version columns sort as versions. */
  entries(): [string, Row][] {
    return [...this.rows.entries()].sort((a, b) => compareKeys(a[0], b[0]));
  }

  get size(): number {
    return this.rows.size;
  }
}

interface ChangeStats {
  records: number;
  sessions: Set<string>;
  digests: Set<string>;
  repeats: number;
  changes: number;
  changedSessions: Set<string>;
}

function changeStats(): ChangeStats {
  return {
    records: 0,
    sessions: new Set(),
    digests: new Set(),
    repeats: 0,
    changes: 0,
    changedSessions: new Set(),
  };
}

interface FieldStats extends ChangeStats {
  /** type → versions it was seen in */
  types: Map<string, Set<string>>;
  versions: Set<string>;
  values: Tally;
  byVersion: Map<string, ChangeStats>;
}

interface LifecycleStats {
  records: number;
  sessions: Set<string>;
  fields: Map<string, number>;
}

interface CollaborationCall {
  tool: string;
  ms?: number;
  line: number;
  outputIds: Set<string>;
}

interface SubagentSession {
  file: string;
  version: string;
  threadId?: string;
  sessionIdField?: string;
  parentThreadId?: string;
  forkedFromId?: string;
  spawnParentThreadId?: string;
  spawnSource: boolean;
  agentPath?: string;
  threadSource?: string;
  startedMs?: number;
  calls: Map<string, CollaborationCall>;
  activities: {
    id?: string;
    kind: string;
    agentThreadId?: string;
    agentPath?: string;
    line: number;
  }[];
  collabItems: { sender?: string; receivers: string[]; line: number }[];
}

// =============================================================================
// Survey
// =============================================================================

export interface StateRenderOptions {
  /** Report alias for a model name (`<model-N>`). */
  modelAlias: (name: string) => string;
}

/**
 * Collects runtime-state evidence per rollout (`addSession`) and renders it as
 * one report section (`render`).
 */
export class RolloutStateSurvey {
  private readonly versionSessions = new Map<string, Set<string>>();
  private readonly familyRecords = new Tally();
  private readonly inheritedRecords = new Tally();
  private readonly fields = new Map<string, FieldStats>();
  private readonly valueChanges = new Tally();
  private readonly missingSettings = new Tally();

  private readonly pairing = new Tally();
  private readonly tsaPosition = new Tally();
  private readonly tsaThread = new Tally();
  private readonly superseded = new Tally();
  private readonly nextTurnContext = new Tally();
  private readonly nextByVersion = new Tally();
  private readonly persistence = new Tally();
  private readonly laterTurnContexts = new Tally();
  private readonly turnContextTurns = new Tally();
  private readonly turnContextPosition = new Tally();
  private readonly turnCoverage = new Tally();
  private readonly turnContextChanges = new Tally();
  private readonly internal = new Tally();
  private readonly unpairedFields = new Tally();

  private readonly tokenShapes = new Tally();
  private readonly tokenPresence = new Tally();
  private readonly tokenRelations = new Tally();
  private readonly tokenSessions = new Tally();
  private readonly tokenCounts = new Map<string, number[]>();
  private readonly compaction = new Tally();

  private readonly lifecycle = new Map<string, LifecycleStats>();
  private readonly lifecycleValues = new Tally();
  private readonly turnPairing = new Tally();

  private readonly subagents: SubagentSession[] = [];

  /** Survey one rollout's records (in file order). */
  addSession(file: string, records: readonly CodexRolloutRecord[]): void {
    const tracker = new InheritedHistoryTracker();
    let metadata: CodexSessionMetadata = {};
    let meta: Record<string, unknown> | undefined;
    const own: CodexRolloutRecord[] = [];
    let inherited = 0;
    for (const record of records) {
      if (tracker.isInherited(record, metadata)) {
        inherited++;
        continue;
      }
      if (record.type === 'session_meta' && meta === undefined) {
        meta = record.payload;
        metadata = parseSessionMeta(record.payload);
      }
      own.push(record);
    }

    const cliVersion = metadata.cliVersion;
    const version = cliVersion && ENUM_VALUE.test(cliVersion) ? cliVersion : NONE;
    const where: Where = { file, version };
    let sessions = this.versionSessions.get(version);
    if (!sessions) {
      sessions = new Set();
      this.versionSessions.set(version, sessions);
    }
    sessions.add(file);
    if (inherited > 0) this.inheritedRecords.add(version, where, inherited);

    this.collectSettings(where, own, metadata.threadId);
    this.collectRelationship(where, own, metadata.threadId);
    this.collectTokens(where, own);
    this.collectLifecycle(where, own);
    this.collectSubagent(where, own, meta);
  }

  // ---------------------------------------------------------------------------
  // A/B. Settings fields and their changes
  // ---------------------------------------------------------------------------

  private field(family: Family, path: string): FieldStats {
    const key = `${family}\t${path}`;
    let stats = this.fields.get(key);
    if (!stats) {
      stats = {
        ...changeStats(),
        types: new Map(),
        versions: new Set(),
        values: new Tally(),
        byVersion: new Map(),
      };
      this.fields.set(key, stats);
    }
    return stats;
  }

  private collectSettings(
    where: Where,
    own: readonly CodexRolloutRecord[],
    threadId: string | undefined
  ): void {
    const last = new Map<string, { digest: string; value?: string }>();
    for (const record of own) {
      const family = familyOf(record);
      if (!family) continue;
      const here: Where = { ...where, line: record.lineNumber };
      const recordThread = str(record.payload.thread_id);
      if (
        family === 'thread_settings_applied' &&
        threadId &&
        recordThread &&
        recordThread !== threadId
      ) {
        // Another thread's settings; they would read as changes of this one.
        this.missingSettings.add('thread_settings_applied for another thread (not counted)', here);
        continue;
      }
      this.familyRecords.add(`${family}\t${where.version}`, here);
      const root = settingsRoot(family, record);
      if (!root) {
        this.missingSettings.add(`${family} without a settings object`, here);
        continue;
      }
      for (const { path, value } of fieldsOf(family, root)) {
        const stats = this.field(family, path);
        let byVersion = stats.byVersion.get(where.version);
        if (!byVersion) {
          byVersion = changeStats();
          stats.byVersion.set(where.version, byVersion);
        }
        const type = typeOf(value);
        const typeVersions = stats.types.get(type) ?? new Set<string>();
        typeVersions.add(where.version);
        stats.types.set(type, typeVersions);
        stats.versions.add(where.version);

        const hash = digest(value);
        const shown = path.endsWith('(other keys)') ? undefined : safeValue(path, value);
        for (const target of [stats, byVersion]) {
          target.records++;
          target.sessions.add(where.file);
          target.digests.add(hash);
        }
        if (shown !== undefined) stats.values.add(shown, here);

        const key = `${family}\t${path}`;
        const previous = last.get(key);
        if (previous) {
          const changed = previous.digest !== hash;
          for (const target of [stats, byVersion]) {
            if (changed) {
              target.changes++;
              target.changedSessions.add(where.file);
            } else {
              target.repeats++;
            }
          }
          if (changed && shown !== undefined && previous.value !== undefined) {
            this.valueChanges.add(`${family}\t${path}\t${previous.value}\t${shown}`, here);
          }
        }
        last.set(key, { digest: hash, value: shown });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // C. thread_settings_applied and turn_context
  // ---------------------------------------------------------------------------

  private collectRelationship(
    where: Where,
    own: readonly CodexRolloutRecord[],
    threadId: string | undefined
  ): void {
    let turnOpen = false;
    let anyTurn = false;
    let turnContextInTurn = false;
    let toolCallsInTurn = 0;
    let currentTurn: string | undefined;
    const startedTurns: string[] = [];
    const turnContextsByTurn = new Map<string, number>();
    let latest: { settings: Record<string, unknown>; compared: boolean; line: number } | undefined;
    let settingsSinceTurnContext = false;
    let previousTurnContext: Record<string, unknown> | undefined;
    let open: { pair: string; turnField: string; value: unknown; after: number }[] = [];
    let tsaCount = 0;
    let turnContextCount = 0;

    const closeOpen = (outcome: string, line: number): void => {
      for (const disagreement of open) {
        this.persistence.add(`${disagreement.pair}\t${outcome}`, { ...where, line });
      }
      open = [];
    };

    for (const record of own) {
      const here: Where = { ...where, line: record.lineNumber };
      const { payload } = record;
      const eventType = record.type === 'event_msg' ? str(payload.type) : undefined;

      if (eventType && TURN_STARTS.has(eventType)) {
        turnOpen = true;
        anyTurn = true;
        turnContextInTurn = false;
        toolCallsInTurn = 0;
        currentTurn = str(payload.turn_id);
        if (currentTurn) startedTurns.push(currentTurn);
        continue;
      }
      if (eventType && (TURN_COMPLETIONS.has(eventType) || eventType === TURN_ABORTED)) {
        turnOpen = false;
        continue;
      }
      if (record.type === 'response_item' && TOOL_CALL_ITEMS.has(str(payload.type) ?? '')) {
        if (turnOpen) toolCallsInTurn++;
        continue;
      }

      if (eventType === 'thread_settings_applied') {
        tsaCount++;
        const settings = isRecord(payload.thread_settings) ? payload.thread_settings : undefined;
        let position = 'between turns';
        if (!anyTurn) position = 'before the first turn of the rollout';
        else if (turnOpen) {
          position = turnContextInTurn
            ? 'inside a turn, after its turn_context'
            : 'inside a turn, before its turn_context';
        }
        this.tsaPosition.add(position, here);
        const recordThread = str(payload.thread_id);
        let thread = 'thread_id missing';
        if (recordThread && !threadId) thread = 'rollout thread id unknown (no session_meta)';
        else if (recordThread) {
          thread = recordThread === threadId ? "the rollout's own thread" : 'another thread';
        }
        this.tsaThread.add(thread, here);
        // Settings addressed to another thread say nothing about this rollout's turns.
        if (!settings || thread === 'another thread') continue;
        if (latest && !latest.compared) {
          this.superseded.add(
            same(latest.settings, settings)
              ? 'followed by an identical thread_settings_applied before any turn_context'
              : 'followed by a different thread_settings_applied before any turn_context',
            here
          );
        }
        closeOpen(
          'no later turn_context agreed before the next thread_settings_applied',
          record.lineNumber
        );
        latest = { settings, compared: false, line: record.lineNumber };
        settingsSinceTurnContext = true;
        this.collectInternal('thread_settings_applied', settings, here);
        continue;
      }

      if (record.type !== 'turn_context') continue;
      turnContextCount++;
      const turnContext = payload;
      const turnId = str(turnContext.turn_id);
      let turnRelation = 'no turn_id';
      if (turnId) {
        if (turnOpen && turnId === currentTurn) turnRelation = 'turn_id of the open turn';
        else if (turnOpen) turnRelation = 'turn_id differs from the open turn';
        else turnRelation = 'outside any started turn';
        turnContextsByTurn.set(turnId, (turnContextsByTurn.get(turnId) ?? 0) + 1);
      } else if (!anyTurn) {
        turnRelation = 'no turn_id (no turn events in the rollout so far)';
      }
      this.turnContextTurns.add(turnRelation, here);
      let position = 'outside a started turn';
      if (turnOpen) {
        position =
          toolCallsInTurn === 0
            ? "before its turn's first tool call"
            : `after ${toolCallsInTurn === 1 ? 'a tool call' : 'tool calls'} of its turn`;
      }
      this.turnContextPosition.add(position, here);
      turnContextInTurn = true;
      this.collectInternal('turn_context', turnContext, here);

      if (latest) {
        if (!latest.compared) {
          latest.compared = true;
          let disagreements = 0;
          let compared = 0;
          for (const [threadField, turnField] of SETTINGS_PAIRS) {
            const pair = `${threadField} ↔ ${turnField}`;
            const threadValue = latest.settings[threadField];
            const turnValue = turnContext[turnField];
            const comparison = compareValues(threadValue, turnValue);
            this.nextTurnContext.add(
              `${pair}\t${comparisonLabel(comparison, 'thread_settings_applied', 'turn_context')}`,
              comparison === 'disagree' ? here : where
            );
            if (comparison === 'agree' || comparison === 'disagree') compared++;
            if (comparison === 'disagree') {
              disagreements++;
              open.push({ pair, turnField, value: threadValue, after: 0 });
            }
          }
          let outcome = 'no comparable field';
          if (compared > 0) {
            outcome =
              disagreements === 0 ? 'every compared field agrees' : 'at least one field disagrees';
          }
          this.nextByVersion.add(`${outcome}\t${where.version}`, disagreements > 0 ? here : where);
          for (const key of Object.keys(latest.settings)) {
            if (
              IDENTIFIER.test(key) &&
              !SETTINGS_PAIRS.some(([threadField]) => threadField === key)
            ) {
              this.unpairedFields.add(`thread_settings_applied\t${key}`, where);
            }
          }
          for (const key of Object.keys(turnContext)) {
            if (
              IDENTIFIER.test(key) &&
              !SETTINGS_PAIRS.some(([, turnField]) => turnField === key)
            ) {
              this.unpairedFields.add(`turn_context\t${key}`, where);
            }
          }
        } else {
          for (const [threadField, turnField] of SETTINGS_PAIRS) {
            const comparison = compareValues(latest.settings[threadField], turnContext[turnField]);
            if (comparison === 'agree' || comparison === 'disagree') {
              this.laterTurnContexts.add(
                `${threadField} ↔ ${turnField}\t${comparison}`,
                comparison === 'disagree' ? here : where
              );
            }
          }
          const stillOpen: typeof open = [];
          for (const disagreement of open) {
            disagreement.after++;
            if (
              compareValues(disagreement.value, turnContext[disagreement.turnField]) === 'agree'
            ) {
              const after =
                disagreement.after === 1 ? '1 turn_context' : `${disagreement.after} turn_contexts`;
              this.persistence.add(
                `${disagreement.pair}\ta later turn_context agreed (${after} later)`,
                here
              );
            } else {
              stillOpen.push(disagreement);
            }
          }
          open = stillOpen;
        }
      }

      if (previousTurnContext) {
        for (const [, turnField] of SETTINGS_PAIRS) {
          const comparison = compareValues(previousTurnContext[turnField], turnContext[turnField]);
          if (comparison === 'disagree') {
            this.turnContextChanges.add(
              `${turnField}\t${
                settingsSinceTurnContext
                  ? 'a thread_settings_applied came after the previous turn_context'
                  : 'no thread_settings_applied since the previous turn_context'
              }`,
              here
            );
          }
        }
      }
      previousTurnContext = turnContext;
      settingsSinceTurnContext = false;
    }

    const end = own.length > 0 ? own[own.length - 1].lineNumber : 0;
    closeOpen('no later turn_context agreed before the rollout ended', end);
    if (latest && !latest.compared) {
      this.superseded.add('no turn_context after it', { ...where, line: latest.line });
    }
    for (const turn of startedTurns) {
      const count = turnContextsByTurn.get(turn) ?? 0;
      this.turnCoverage.add(
        count === 0
          ? 'no turn_context'
          : count === 1
            ? 'one turn_context'
            : 'two or more turn_contexts',
        where
      );
    }
    let pairing = 'neither record';
    if (tsaCount > 0 && turnContextCount > 0)
      pairing = 'both thread_settings_applied and turn_context';
    else if (tsaCount > 0) pairing = 'thread_settings_applied only';
    else if (turnContextCount > 0) pairing = 'turn_context only';
    this.pairing.add(pairing, where);
  }

  private collectInternal(family: Family, root: Record<string, unknown>, here: Where): void {
    for (const [pairFamily, first, second] of INTERNAL_PAIRS) {
      if (pairFamily !== family) continue;
      const comparison = compareValues(at(root, first), at(root, second));
      this.internal.add(
        `${family}\t${first} vs ${second}\t${comparisonLabel(comparison, first, second)}`,
        comparison === 'disagree' ? here : { file: here.file, version: here.version }
      );
    }
  }

  // ---------------------------------------------------------------------------
  // D. Token usage
  // ---------------------------------------------------------------------------

  private collectTokens(where: Where, own: readonly CodexRolloutRecord[]): void {
    let previous: Record<string, unknown> | undefined;
    let records = 0;
    let tokenCount = false;
    let pending: { latest: Record<string, unknown>; line: number } | undefined;

    for (const record of own) {
      const here: Where = { ...where, line: record.lineNumber };
      const { payload } = record;
      if (record.type === 'event_msg' && payload.type === 'token_count') {
        tokenCount = true;
        if (isRecord(payload.info))
          this.tokenShapes.add(`token_count info ${keyNames(payload.info)}`, where);
        continue;
      }
      if (record.type === 'compacted') {
        const latest = payload.latest_token_usage_record;
        let shape = 'latest_token_usage_record absent';
        if (latest === null) shape = 'latest_token_usage_record null';
        else if (isRecord(latest)) shape = `latest_token_usage_record ${keyNames(latest)}`;
        else if (latest !== undefined) shape = `latest_token_usage_record ${typeOf(latest)}`;
        this.compaction.add(`shape\t${shape}`, here);
        if (isRecord(latest)) {
          let relation = 'no earlier token_usage_record in the rollout';
          if (previous) {
            if (same(latest, previous)) relation = 'identical to the preceding token_usage_record';
            else if (
              str(latest.response_id) &&
              str(latest.response_id) === str(previous.response_id)
            ) {
              relation =
                'same response_id as the preceding token_usage_record, other values differ';
            } else relation = 'differs from the preceding token_usage_record';
          }
          this.compaction.add(`preceding\t${relation}`, here);
          pending = { latest, line: record.lineNumber };
        }
        continue;
      }
      if (record.type !== 'token_usage_record') continue;

      records++;
      this.tokenShapes.add(`payload ${keyNames(payload)}`, where);
      for (const name of TOKEN_OBJECTS) {
        const value = payload[name];
        if (isRecord(value)) this.tokenShapes.add(`${name} ${keyNames(value)}`, where);
        this.tokenPresence.add(`${name}\t${isRecord(value) ? 'present' : 'absent'}`, where);
      }
      for (const name of TOKEN_IDS) {
        this.tokenPresence.add(`${name}\t${str(payload[name]) ? 'present' : 'absent'}`, where);
      }
      const windowKeys = Object.keys(payload).filter((key) => key.includes('context_window'));
      this.tokenPresence.add(
        `context window field\t${windowKeys.length > 0 ? `present (${windowKeys.sort(compareText).join(', ')})` : 'absent'}`,
        where
      );

      const usage = payload.usage;
      const sameTurn =
        previous !== undefined &&
        str(payload.turn_id) !== undefined &&
        str(payload.turn_id) === str(previous.turn_id);
      if (previous && sameTurn) {
        this.tokenRelation(
          'later record of a turn: turn_token_usage = previous turn_token_usage + usage',
          sumHolds(payload.turn_token_usage, previous.turn_token_usage, usage),
          here
        );
      } else {
        this.tokenRelation(
          'first record of a turn: turn_token_usage = usage',
          equalCounts(payload.turn_token_usage, usage),
          here
        );
      }
      if (previous) {
        const sameThread =
          str(payload.thread_id) !== undefined &&
          str(payload.thread_id) === str(previous.thread_id);
        if (sameThread) {
          this.tokenRelation(
            'thread_token_usage = previous thread_token_usage + usage',
            sumHolds(payload.thread_token_usage, previous.thread_token_usage, usage),
            here
          );
          this.tokenRelation(
            'thread_token_usage.total_tokens never decreases',
            compareTotal(payload.thread_token_usage, previous.thread_token_usage, (a, b) => a >= b),
            here
          );
        }
      } else {
        this.tokenRelation(
          'first record of the rollout: thread_token_usage = usage',
          equalCounts(payload.thread_token_usage, usage),
          here
        );
      }
      if (pending) {
        const inputNow = num(isRecord(usage) ? usage.input_tokens : undefined);
        const latestUsage = pending.latest.usage;
        const inputBefore = num(isRecord(latestUsage) ? latestUsage.input_tokens : undefined);
        let input = 'input_tokens missing on either side';
        if (inputNow !== undefined && inputBefore !== undefined) {
          input =
            inputNow < inputBefore
              ? "lower than latest_token_usage_record's"
              : inputNow === inputBefore
                ? "equal to latest_token_usage_record's"
                : "higher than latest_token_usage_record's";
        }
        this.compaction.add(`next usage.input_tokens\t${input}`, here);
        const continues = sumHolds(
          payload.thread_token_usage,
          pending.latest.thread_token_usage,
          usage
        );
        this.compaction.add(
          `next thread_token_usage\t${
            continues === undefined
              ? 'not comparable'
              : continues
                ? 'latest_token_usage_record thread_token_usage + usage'
                : 'not latest_token_usage_record thread_token_usage + usage'
          }`,
          here
        );
        pending = undefined;
      }
      previous = payload;
    }

    let coverage = 'neither';
    if (records > 0 && tokenCount) coverage = 'token_usage_record and token_count';
    else if (records > 0) coverage = 'token_usage_record only';
    else if (tokenCount) coverage = 'token_count only';
    this.tokenSessions.add(coverage, where);
    if (records > 0) {
      const counts = this.tokenCounts.get(where.version) ?? [];
      counts.push(records);
      this.tokenCounts.set(where.version, counts);
    }
  }

  private tokenRelation(relation: string, holds: boolean | undefined, here: Where): void {
    const outcome = holds === undefined ? 'not comparable' : holds ? 'holds' : 'fails';
    this.tokenRelations.add(
      `${relation}\t${outcome}`,
      outcome === 'fails' ? here : { file: here.file, version: here.version }
    );
  }

  // ---------------------------------------------------------------------------
  // E. Turn lifecycle
  // ---------------------------------------------------------------------------

  private collectLifecycle(where: Where, own: readonly CodexRolloutRecord[]): void {
    const started: string[] = [];
    const ended = new Set<string>();
    for (const record of own) {
      if (record.type !== 'event_msg') continue;
      const { payload } = record;
      const type = str(payload.type) ?? '';
      if (!TURN_STARTS.has(type) && !TURN_COMPLETIONS.has(type) && type !== TURN_ABORTED) continue;
      const here: Where = { ...where, line: record.lineNumber };
      const key = `${type}\t${where.version}`;
      let stats = this.lifecycle.get(key);
      if (!stats) {
        stats = { records: 0, sessions: new Set(), fields: new Map() };
        this.lifecycle.set(key, stats);
      }
      stats.records++;
      stats.sessions.add(where.file);
      for (const field of LIFECYCLE_FIELDS) {
        if (payload[field] !== undefined && payload[field] !== null) {
          stats.fields.set(field, (stats.fields.get(field) ?? 0) + 1);
        }
      }
      const turnId = str(payload.turn_id);
      if (!turnId) {
        this.turnPairing.add(`${type} without turn_id (not paired)`, where);
      }
      if (TURN_STARTS.has(type)) {
        if (turnId) started.push(turnId);
        if (payload.collaboration_mode_kind !== undefined) {
          this.lifecycleValues.add(
            `${type}\tcollaboration_mode_kind ${enumText(payload.collaboration_mode_kind) ?? typeOf(payload.collaboration_mode_kind)}`,
            where
          );
        }
        continue;
      }
      if (turnId) ended.add(turnId);
      if (type === TURN_ABORTED) {
        this.lifecycleValues.add(
          `${type}\treason ${enumText(payload.reason) ?? typeOf(payload.reason)}`,
          where
        );
      }
      const error = payload.error;
      if (error !== undefined && error !== null) {
        let shape = `error ${typeOf(error)}`;
        if (isRecord(error)) {
          shape = `error ${keyNames(error)}`;
          if (error.codex_error_info !== undefined) {
            shape += ` · codex_error_info ${enumText(error.codex_error_info) ?? typeOf(error.codex_error_info)}`;
          }
        } else if (typeof error === 'string') {
          shape = 'error (text)';
        }
        this.lifecycleValues.add(`${type}\t${shape}`, here);
      }
    }
    const unmatched = new Set(ended);
    for (const [index, turn] of started.entries()) {
      if (unmatched.delete(turn)) {
        this.turnPairing.add('started and ended (complete or aborted)', where);
      } else {
        this.turnPairing.add(
          index === started.length - 1
            ? 'last turn of the rollout, not ended'
            : 'started, not ended, before a later turn started',
          where
        );
      }
    }
    if (unmatched.size > 0) {
      this.turnPairing.add('ended without a start in this rollout', where, unmatched.size);
    }
  }

  // ---------------------------------------------------------------------------
  // F. Subagent relationships (joined at render time)
  // ---------------------------------------------------------------------------

  private collectSubagent(
    where: Where,
    own: readonly CodexRolloutRecord[],
    meta: Record<string, unknown> | undefined
  ): void {
    const source = meta && isRecord(meta.source) ? meta.source : undefined;
    const subagent = source && isRecord(source.subagent) ? source.subagent : undefined;
    const spawn = subagent && isRecord(subagent.thread_spawn) ? subagent.thread_spawn : undefined;
    const session: SubagentSession = {
      file: where.file,
      version: where.version,
      threadId: str(meta?.id),
      sessionIdField: str(meta?.session_id),
      parentThreadId: str(meta?.parent_thread_id),
      forkedFromId: str(meta?.forked_from_id),
      spawnParentThreadId: str(spawn?.parent_thread_id),
      spawnSource: spawn !== undefined,
      agentPath: str(meta?.agent_path) ?? str(spawn?.agent_path),
      threadSource: meta?.thread_source === undefined ? undefined : enumText(meta.thread_source),
      startedMs: epochMs(str(meta?.timestamp)),
      calls: new Map(),
      activities: [],
      collabItems: [],
    };
    for (const record of own) {
      const { payload } = record;
      if (record.type === 'response_item' && payload.type === 'function_call') {
        const name = str(payload.name) ?? '';
        const namespace = str(payload.namespace);
        const callId = str(payload.call_id);
        if (callId && (namespace === 'collaboration' || COLLABORATION_TOOLS.has(name))) {
          const tool = `${namespace ? `${namespace}.` : ''}${name}`;
          session.calls.set(callId, {
            tool: ENUM_VALUE.test(tool) ? tool : '(unnamed)',
            ms: epochMs(record.timestamp),
            line: record.lineNumber,
            outputIds: new Set(),
          });
        }
      } else if (record.type === 'response_item' && payload.type === 'function_call_output') {
        const call = session.calls.get(str(payload.call_id) ?? '');
        if (call) {
          const { text } = outputBodyToText(payload.output);
          for (const id of text.match(UUID_PATTERN) ?? []) call.outputIds.add(id.toLowerCase());
        }
      } else if (
        record.type === 'event_msg' &&
        payload.type === 'item_completed' &&
        isRecord(payload.item)
      ) {
        const item = payload.item;
        if (item.type === 'SubAgentActivity') {
          session.activities.push({
            id: str(item.id),
            kind: enumText(item.kind) ?? NONE,
            agentThreadId: str(item.agent_thread_id)?.toLowerCase(),
            agentPath: str(item.agent_path),
            line: record.lineNumber,
          });
        } else if (item.type === 'CollabAgentToolCall') {
          const receivers = Array.isArray(item.receiver_thread_ids) ? item.receiver_thread_ids : [];
          session.collabItems.push({
            sender: str(item.sender_thread_id)?.toLowerCase(),
            receivers: receivers.flatMap((id) => (str(id) ? [String(id).toLowerCase()] : [])),
            line: record.lineNumber,
          });
        }
      }
    }
    this.subagents.push(session);
  }

  // ===========================================================================
  // Report
  // ===========================================================================

  render(options: StateRenderOptions): string[] {
    const shown = (value: string): string =>
      value.startsWith(MODEL_TAG) ? options.modelAlias(value.slice(MODEL_TAG.length)) : value;
    const out: string[] = [];
    out.push('## Runtime state and relationships', '');
    out.push(
      '> Evidence for runtime-settings design. Values are shown only for enum-like settings fields; model names use the report aliases; ids, paths, dates, text and agent names are never shown. Records a forked subagent copied from its parent are excluded. Relations are reported as observed; none implies precedence. On sanitized transcripts (`--from-transcripts`) free-text values are placeholders, so comparisons involving them are reported as not comparable.',
      ''
    );
    out.push(...this.renderOverview());
    out.push(...this.renderSettings(shown));
    out.push(...this.renderRelationship());
    out.push(...this.renderTokens());
    out.push(...this.renderLifecycle());
    out.push(...this.renderSubagents());
    return out;
  }

  private versions(): string[] {
    return [...this.versionSessions.keys()].sort(compareVersions);
  }

  private renderOverview(): string[] {
    const rows = this.versions().map((version) => [
      version,
      String(this.versionSessions.get(version)?.size ?? 0),
      ...FAMILIES.map((family) => String(this.familyRecords.count(`${family}\t${version}`))),
      String(this.inheritedRecords.count(version)),
    ]);
    return table(
      'Records by CLI version (session_meta.cli_version of each rollout, own history only)',
      ['CLI version', 'Sessions', ...FAMILIES, 'Copied parent records (excluded)'],
      rows
    );
  }

  private renderSettings(shown: (value: string) => string): string[] {
    const out: string[] = ['### A. Settings fields by record family', ''];
    out.push(
      'Types, the CLI versions a field appears in, distinct values, and changes within a rollout (a repeat is a record that carries the same value as the previous record of its family in that rollout). Paths are relative to the record family shown in each heading.',
      ''
    );
    for (const family of FAMILIES) {
      const rows = [...this.fields.entries()]
        .filter(([key]) => key.startsWith(`${family}\t`))
        .sort((a, b) => compareText(a[0], b[0]))
        .map(([key, stats]) => {
          const path = key.slice(family.length + 1);
          const types = [...stats.types.entries()].sort((a, b) => compareText(a[0], b[0]));
          const typeCell =
            types.length === 1
              ? types[0][0]
              : types.map(([type, versions]) => `${type} [${versionList(versions)}]`).join(' · ');
          return [
            `\`${path}\``,
            typeCell,
            String(stats.records),
            String(stats.sessions.size),
            versionList(stats.versions),
            String(stats.digests.size),
            String(stats.repeats),
            String(stats.changes),
            String(stats.changedSessions.size),
          ];
        });
      out.push(
        ...table(
          `Fields of ${FAMILY_TITLES[family]}`,
          [
            'Field',
            'Type',
            'Records',
            'Sessions',
            'CLI versions',
            'Distinct values',
            'Repeats',
            'Changes',
            'Sessions with changes',
          ],
          rows
        )
      );
    }
    out.push(
      ...table(
        'Settings records not counted above',
        ['Record', 'Count', 'Sessions'],
        rowsOf(this.missingSettings)
      )
    );

    const valueRows: string[][] = [];
    for (const [key, stats] of [...this.fields.entries()].sort((a, b) => compareText(a[0], b[0]))) {
      const [family, path] = key.split('\t');
      for (const [value, row] of stats.values.entries()) {
        valueRows.push([
          family,
          `\`${path}\``,
          shown(value),
          String(row.count),
          String(row.sessions.size),
          versionList(row.versions),
        ]);
      }
    }
    out.push(
      ...table(
        'Values of enum-like settings (allowlisted fields only; `(text)` = a value that does not look like an enum)',
        ['Record', 'Field', 'Value', 'Records', 'Sessions', 'CLI versions'],
        valueRows
      )
    );

    out.push('### B. Setting changes within a rollout, by CLI version', '');
    const changeRows: string[][] = [];
    for (const [key, stats] of [...this.fields.entries()].sort((a, b) => compareText(a[0], b[0]))) {
      const [family, path] = key.split('\t');
      if (!isSetting(path)) continue;
      for (const version of [...stats.byVersion.keys()].sort(compareVersions)) {
        const byVersion = stats.byVersion.get(version);
        if (!byVersion) continue;
        changeRows.push([
          family,
          `\`${path}\``,
          version,
          String(byVersion.records),
          String(byVersion.sessions.size),
          String(byVersion.digests.size),
          String(byVersion.repeats),
          String(byVersion.changes),
          String(byVersion.changedSessions.size),
        ]);
      }
    }
    out.push(
      ...table(
        'Settings fields per CLI version (repeats = same value as the previous record; changes = a different value)',
        [
          'Record',
          'Field',
          'CLI version',
          'Records',
          'Sessions',
          'Distinct values',
          'Repeats',
          'Changes',
          'Sessions with changes',
        ],
        changeRows
      )
    );
    const transitionRows = this.valueChanges.entries().map(([key, row]) => {
      const [family, path, from, to] = key.split('\t');
      return [
        family,
        `\`${path}\``,
        `${shown(from)} → ${shown(to)}`,
        String(row.count),
        String(row.sessions.size),
        versionList(row.versions),
        examplesCell(row),
      ];
    });
    out.push(
      ...table(
        'Value changes of enum-like settings',
        ['Record', 'Field', 'Change', 'Count', 'Sessions', 'CLI versions', 'Examples'],
        transitionRows
      )
    );
    return out;
  }

  private renderRelationship(): string[] {
    const out: string[] = ['### C. `thread_settings_applied` and `turn_context`', ''];
    out.push(
      'Each `thread_settings_applied` is compared with the first `turn_context` after it; later `turn_context` records up to the next `thread_settings_applied` are counted separately. The field pairs below are the candidate equivalents under test (names differ for some):',
      ''
    );
    out.push(
      ...table(
        'Compared field pairs',
        ['thread_settings_applied (thread_settings)', 'turn_context'],
        SETTINGS_PAIRS.map(([thread, turn]) => [`\`${thread}\``, `\`${turn}\``])
      )
    );
    out.push(
      ...table(
        'Sessions by record presence',
        ['Records', 'Sessions', 'CLI versions'],
        sessionRows(this.pairing)
      )
    );
    out.push(
      ...table(
        'Where thread_settings_applied appears',
        ['Position', 'Count', 'Sessions', 'CLI versions'],
        rowsWithVersions(this.tsaPosition)
      )
    );
    out.push(
      ...table(
        'thread_settings_applied thread_id',
        ['Thread', 'Count', 'Sessions', 'CLI versions'],
        rowsWithVersions(this.tsaThread)
      )
    );
    out.push(
      ...table(
        'thread_settings_applied not compared with a turn_context',
        ['What followed', 'Count', 'Sessions', 'CLI versions', 'Examples'],
        rowsWithVersions(this.superseded, true)
      )
    );
    out.push(
      ...table(
        'Next turn_context after a thread_settings_applied, by field pair',
        ['Field pair', 'Outcome', 'Count', 'Sessions', 'CLI versions', 'Examples'],
        splitRows(this.nextTurnContext, true)
      )
    );
    out.push(
      ...table(
        'Next turn_context after a thread_settings_applied, by CLI version',
        ['Outcome', 'CLI version', 'Count', 'Sessions', 'Examples'],
        splitRows(this.nextByVersion, true, false)
      )
    );
    out.push(
      ...table(
        'Disagreements with the next turn_context: do they persist?',
        ['Field pair', 'What happened next', 'Count', 'Sessions', 'CLI versions', 'Examples'],
        splitRows(this.persistence, true)
      )
    );
    out.push(
      ...table(
        'Later turn_context records under the same thread_settings_applied',
        ['Field pair', 'Outcome', 'Count', 'Sessions', 'CLI versions', 'Examples'],
        splitRows(this.laterTurnContexts, true)
      )
    );
    out.push(
      ...table(
        'turn_context value changes relative to the previous turn_context',
        [
          'turn_context field',
          'Since the previous turn_context',
          'Count',
          'Sessions',
          'CLI versions',
          'Examples',
        ],
        splitRows(this.turnContextChanges, true)
      )
    );
    out.push(
      ...table(
        'Fields without a compared counterpart (present at a comparison)',
        ['Record', 'Field', 'Count', 'Sessions', 'CLI versions'],
        splitRows(this.unpairedFields, false)
      )
    );
    out.push(
      ...table(
        'The same setting twice within one record',
        ['Record', 'Fields', 'Outcome', 'Count', 'Sessions', 'CLI versions', 'Examples'],
        splitRows(this.internal, true)
      )
    );
    out.push(
      ...table(
        'turn_context turn_id',
        ['Relation to turn events', 'Count', 'Sessions', 'CLI versions'],
        rowsWithVersions(this.turnContextTurns)
      )
    );
    out.push(
      ...table(
        'turn_context position within its turn',
        ['Position', 'Count', 'Sessions', 'CLI versions'],
        rowsWithVersions(this.turnContextPosition)
      )
    );
    out.push(
      ...table(
        'turn_context records per started turn',
        ['Per turn', 'Turns', 'Sessions', 'CLI versions'],
        rowsWithVersions(this.turnCoverage)
      )
    );
    return out;
  }

  private renderTokens(): string[] {
    const out: string[] = ['### D. Token usage records', ''];
    const coverage = this.versions().flatMap((version) => {
      const counts = (this.tokenCounts.get(version) ?? []).sort((a, b) => a - b);
      if (counts.length === 0) return [];
      return [
        [
          version,
          String(counts.length),
          String(counts.reduce((sum, count) => sum + count, 0)),
          `${counts[0]} / ${counts[Math.floor((counts.length - 1) / 2)]} / ${counts[counts.length - 1]}`,
        ],
      ];
    });
    out.push(
      ...table(
        'token_usage_record by CLI version',
        ['CLI version', 'Sessions', 'Records', 'Per session (min / median / max)'],
        coverage
      )
    );
    out.push(
      ...table(
        'Token sources per session',
        ['Sources', 'Sessions', 'CLI versions'],
        sessionRows(this.tokenSessions)
      )
    );
    out.push(
      ...table(
        'Field shapes',
        ['Object', 'Count', 'Sessions', 'CLI versions'],
        rowsWithVersions(this.tokenShapes)
      )
    );
    out.push(
      ...table(
        'Field presence in token_usage_record',
        ['Field', 'Presence', 'Count', 'Sessions', 'CLI versions'],
        splitRows(this.tokenPresence, false)
      )
    );
    out.push(
      ...table(
        'Relations between usage objects (checked on every numeric field)',
        ['Relation', 'Outcome', 'Records', 'Sessions', 'CLI versions', 'Examples'],
        splitRows(this.tokenRelations, true)
      )
    );
    out.push(
      ...table(
        'compacted.latest_token_usage_record (observed relations only; no compaction sizes are derived)',
        ['Aspect', 'Observation', 'Count', 'Sessions', 'CLI versions', 'Examples'],
        splitRows(this.compaction, true)
      )
    );
    return out;
  }

  private renderLifecycle(): string[] {
    const out: string[] = ['### E. Turn lifecycle', ''];
    const rows = [...this.lifecycle.entries()]
      .sort((a, b) => {
        const [typeA, versionA] = a[0].split('\t');
        const [typeB, versionB] = b[0].split('\t');
        return compareText(typeA, typeB) || compareVersions(versionA, versionB);
      })
      .map(([key, stats]) => {
        const [type, version] = key.split('\t');
        return [
          type,
          version,
          String(stats.records),
          String(stats.sessions.size),
          ...LIFECYCLE_FIELDS.map((field) => String(stats.fields.get(field) ?? 0)),
        ];
      });
    out.push(
      ...table(
        'Lifecycle events and the fields they carry (records with each field)',
        [
          'Event',
          'CLI version',
          'Records',
          'Sessions',
          ...LIFECYCLE_FIELDS.map((field) => `\`${field}\``),
        ],
        rows
      )
    );
    out.push(
      ...table(
        'Lifecycle values (enum-like fields; error shapes without messages)',
        ['Event', 'Value', 'Count', 'Sessions', 'CLI versions', 'Examples'],
        splitRows(this.lifecycleValues, true)
      )
    );
    out.push(
      ...table(
        'Turn pairing by turn_id',
        ['Turn', 'Count', 'Sessions', 'CLI versions'],
        rowsWithVersions(this.turnPairing)
      )
    );
    return out;
  }

  private renderSubagents(): string[] {
    const out: string[] = ['### F. Subagent relationships', ''];
    out.push(
      'Joins are attempted only among the surveyed rollouts; a child whose parent rollout was not surveyed cannot be matched. Kinds: exact shared ID (both records carry the same identifier), deterministic structural relationship (equal values that are names, not ids), temporal association only (time order; never an identity). A method with no match in this corpus is unresolved here.',
      ''
    );
    const byThread = new Map<string, SubagentSession[]>();
    for (const session of this.subagents) {
      if (!session.threadId) continue;
      const id = session.threadId.toLowerCase();
      byThread.set(id, [...(byThread.get(id) ?? []), session]);
    }
    const sessions = new Tally();
    for (const session of this.subagents) {
      const where: Where = { file: session.file, version: session.version };
      sessions.add(
        session.parentThreadId
          ? 'child (session_meta.parent_thread_id)'
          : 'root (no parent_thread_id)',
        where
      );
      if (session.forkedFromId) sessions.add('with forked_from_id', where);
      if (session.spawnSource) sessions.add('with source.subagent.thread_spawn', where);
      if (session.threadSource) sessions.add(`thread_source ${session.threadSource}`, where);
      if (session.sessionIdField && session.threadId) {
        sessions.add(
          session.sessionIdField.toLowerCase() === session.threadId.toLowerCase()
            ? 'session_meta.session_id = own id'
            : 'session_meta.session_id ≠ own id',
          where
        );
      }
      if (session.threadId && (byThread.get(session.threadId.toLowerCase())?.length ?? 0) > 1) {
        sessions.add('thread id shared with another surveyed rollout', where);
      }
      if (session.parentThreadId) {
        sessions.add(
          byThread.has(session.parentThreadId.toLowerCase())
            ? 'child whose parent rollout was surveyed'
            : 'child whose parent rollout was not surveyed',
          where
        );
      }
    }
    out.push(
      ...table('Sessions by kind', ['Kind', 'Sessions', 'CLI versions'], sessionRows(sessions))
    );

    const methods: {
      name: string;
      kind: string;
      records: number;
      matched: number;
      missing: number;
      ambiguous: number;
      consistent: number;
      contradicts: number;
    }[] = [];
    const method = (name: string, kind: string): (typeof methods)[number] => {
      const entry = {
        name,
        kind,
        records: 0,
        matched: 0,
        missing: 0,
        ambiguous: 0,
        consistent: 0,
        contradicts: 0,
      };
      methods.push(entry);
      return entry;
    };
    const resolve = (
      entry: (typeof methods)[number],
      id: string | undefined,
      consistent?: (target: SubagentSession) => boolean | undefined
    ): SubagentSession | undefined => {
      if (!id) return undefined;
      entry.records++;
      const targets = byThread.get(id.toLowerCase()) ?? [];
      if (targets.length === 0) {
        entry.missing++;
        return undefined;
      }
      if (targets.length > 1) {
        entry.ambiguous++;
        return undefined;
      }
      entry.matched++;
      const check = consistent?.(targets[0]);
      if (check === true) entry.consistent++;
      if (check === false) entry.contradicts++;
      return targets[0];
    };
    const confirmedBy = new Map<SubagentSession, Set<string>>();
    const confirm = (child: SubagentSession, name: string): void => {
      const set = confirmedBy.get(child) ?? new Set<string>();
      set.add(name);
      confirmedBy.set(child, set);
    };

    const parentId = method(
      'child session_meta.parent_thread_id → parent session_meta.id',
      'exact shared ID'
    );
    const forked = method(
      'child session_meta.forked_from_id → parent session_meta.id',
      'exact shared ID'
    );
    const spawnParent = method(
      'child source.subagent.thread_spawn.parent_thread_id → parent session_meta.id',
      'exact shared ID'
    );
    const sessionId = method(
      'child session_meta.session_id (≠ own id) → surveyed session_meta.id',
      'exact shared ID'
    );
    for (const child of this.subagents) {
      const declared = child.parentThreadId?.toLowerCase();
      const agrees = (target: SubagentSession): boolean | undefined =>
        declared === undefined ? undefined : target.threadId?.toLowerCase() === declared;
      if (resolve(parentId, child.parentThreadId)) confirm(child, 'parent_thread_id');
      const forkedParent = resolve(forked, child.forkedFromId, agrees);
      if (forkedParent && agrees(forkedParent)) confirm(child, 'forked_from_id');
      const spawnedBy = resolve(spawnParent, child.spawnParentThreadId, agrees);
      if (spawnedBy && agrees(spawnedBy)) confirm(child, 'thread_spawn.parent_thread_id');
      if (
        child.sessionIdField &&
        child.sessionIdField.toLowerCase() !== child.threadId?.toLowerCase()
      ) {
        resolve(sessionId, child.sessionIdField, agrees);
      }
    }

    const activity = method(
      'parent SubAgentActivity.agent_thread_id → child session_meta.id',
      'exact shared ID'
    );
    const output = method(
      'parent collaboration call output contains → child session_meta.id',
      'exact shared ID'
    );
    const collab = method(
      'parent CollabAgentToolCall.receiver_thread_ids → child session_meta.id',
      'exact shared ID'
    );
    const pathMethod = method(
      'parent SubAgentActivity.agent_path = child session_meta.agent_path (among children declaring this parent)',
      'deterministic structural relationship'
    );
    const activityIds = new Tally();
    const callTools = new Tally();
    for (const parent of this.subagents) {
      const own = parent.threadId?.toLowerCase();
      const isChildOf = (target: SubagentSession): boolean | undefined =>
        own === undefined || target.parentThreadId === undefined
          ? undefined
          : target.parentThreadId.toLowerCase() === own;
      const where: Where = { file: parent.file, version: parent.version };
      const children = own
        ? this.subagents.filter((session) => session.parentThreadId?.toLowerCase() === own)
        : [];
      for (const entry of parent.activities) {
        const child = resolve(activity, entry.agentThreadId, isChildOf);
        if (child && isChildOf(child)) confirm(child, 'SubAgentActivity.agent_thread_id');
        const call = entry.id ? parent.calls.get(entry.id) : undefined;
        let idForm = 'no id';
        if (entry.id) {
          if (call) idForm = `equals the call_id of ${call.tool}`;
          else if (/^call_/.test(entry.id))
            idForm = 'call_… id with no collaboration call in this rollout';
          else {
            const embedded = entry.id.match(UUID_PATTERN)?.[0]?.toLowerCase();
            idForm = embedded
              ? embedded === entry.agentThreadId
                ? 'embeds its own agent_thread_id'
                : byThread.has(embedded)
                  ? 'embeds another surveyed thread id'
                  : 'embeds a UUID that is not a surveyed thread id'
              : 'other form';
          }
        }
        activityIds.add(`${entry.kind}\t${idForm}`, { ...where, line: entry.line });
        if (entry.agentPath) {
          pathMethod.records++;
          const matches = children.filter((candidate) => candidate.agentPath === entry.agentPath);
          if (matches.length === 0) pathMethod.missing++;
          else if (matches.length > 1) pathMethod.ambiguous++;
          else {
            pathMethod.matched++;
            const byId = entry.agentThreadId
              ? matches[0].threadId?.toLowerCase() === entry.agentThreadId
              : undefined;
            if (byId === true) pathMethod.consistent++;
            if (byId === false) pathMethod.contradicts++;
          }
        }
      }
      for (const call of [...parent.calls.values()].sort((a, b) => a.line - b.line)) {
        callTools.add(
          `${call.tool}\t${call.outputIds.size > 0 ? 'output contains a UUID' : 'no UUID in output (or no output)'}`,
          where
        );
        for (const id of call.outputIds) {
          if (id === own) continue;
          const child = resolve(output, id, isChildOf);
          if (child && isChildOf(child)) confirm(child, 'collaboration call output');
        }
      }
      for (const item of parent.collabItems) {
        for (const id of item.receivers) {
          const child = resolve(collab, id, isChildOf);
          if (child && isChildOf(child)) confirm(child, 'CollabAgentToolCall');
        }
      }
    }

    const gaps: number[] = [];
    let noSpawn = 0;
    for (const child of this.subagents) {
      const parents = child.parentThreadId
        ? byThread.get(child.parentThreadId.toLowerCase())
        : undefined;
      if (parents?.length !== 1 || child.startedMs === undefined) continue;
      const start = child.startedMs;
      const spawns = [...parents[0].calls.values()].filter(
        (call) => /spawn_agent$/.test(call.tool) && call.ms !== undefined && call.ms <= start
      );
      if (spawns.length === 0) {
        noSpawn++;
        continue;
      }
      gaps.push(Math.min(...spawns.map((call) => start - (call.ms ?? start))) / 1000);
    }
    gaps.sort((a, b) => a - b);

    out.push(
      ...table(
        'Join methods',
        [
          'Method',
          'Kind',
          'Records with the key',
          'Matched one surveyed rollout',
          'Not among the surveyed rollouts',
          'Matched several',
          'Agrees with the declared parent',
          'Contradicts it',
          'Status here',
        ],
        methods.map((entry) => [
          entry.name,
          entry.kind,
          String(entry.records),
          String(entry.matched),
          String(entry.missing),
          String(entry.ambiguous),
          String(entry.consistent),
          String(entry.contradicts),
          entry.records === 0 ? 'no records' : entry.matched === 0 ? 'unresolved' : 'joins',
        ])
      )
    );
    const combos = new Tally();
    for (const child of this.subagents) {
      if (!child.parentThreadId || !byThread.has(child.parentThreadId.toLowerCase())) continue;
      const names = [...(confirmedBy.get(child) ?? [])].sort(compareText);
      combos.add(names.length > 0 ? names.join(' + ') : '(none)', {
        file: child.file,
        version: child.version,
      });
    }
    out.push(
      ...table(
        'Children with a surveyed parent: methods that reach the declared parent',
        ['Methods', 'Children', 'Sessions', 'CLI versions'],
        rowsWithVersions(combos)
      )
    );
    out.push(
      ...table(
        'SubAgentActivity kinds and id forms (parent side)',
        ['Kind', 'Id form', 'Count', 'Sessions', 'CLI versions', 'Examples'],
        splitRows(activityIds, true)
      )
    );
    out.push(
      ...table(
        'Collaboration calls (own history)',
        ['Tool', 'Output', 'Count', 'Sessions', 'CLI versions'],
        splitRows(callTools, false)
      )
    );
    out.push(
      ...table(
        'Temporal association only (not an identity): child start after the nearest preceding spawn_agent call in its declared parent',
        ['Measure', 'Value'],
        [
          ['Children measured', String(gaps.length)],
          ['Children with no earlier spawn_agent call in the parent', String(noSpawn)],
          [
            'Gap in seconds (min / median / max)',
            gaps.length === 0
              ? '—'
              : `${gaps[0].toFixed(1)} / ${gaps[Math.floor((gaps.length - 1) / 2)].toFixed(1)} / ${gaps[gaps.length - 1].toFixed(1)}`,
          ],
        ]
      )
    );
    return out;
  }
}

// =============================================================================
// Rendering helpers
// =============================================================================

function same(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}

/** turn_token_usage / thread_token_usage equal to usage on every numeric field. */
function equalCounts(total: unknown, usage: unknown): boolean | undefined {
  if (!isRecord(total) || !isRecord(usage)) return undefined;
  const keys = Object.keys(usage).filter((key) => num(usage[key]) !== undefined);
  if (keys.length === 0) return undefined;
  return keys.every((key) => num(total[key]) === num(usage[key]));
}

/** total = previous + usage on every numeric field of usage. */
function sumHolds(total: unknown, previous: unknown, usage: unknown): boolean | undefined {
  if (!isRecord(total) || !isRecord(previous) || !isRecord(usage)) return undefined;
  const keys = Object.keys(usage).filter((key) => num(usage[key]) !== undefined);
  if (keys.length === 0) return undefined;
  return keys.every((key) => {
    const [t, p, u] = [num(total[key]), num(previous[key]), num(usage[key])];
    return t !== undefined && p !== undefined && u !== undefined && t === p + u;
  });
}

function compareTotal(
  current: unknown,
  previous: unknown,
  holds: (current: number, previous: number) => boolean
): boolean | undefined {
  const now = isRecord(current) ? num(current.total_tokens) : undefined;
  const before = isRecord(previous) ? num(previous.total_tokens) : undefined;
  return now === undefined || before === undefined ? undefined : holds(now, before);
}

function versionList(versions: Iterable<string>): string {
  return [...versions].sort(compareVersions).join(', ');
}

function examplesCell(row: Row): string {
  return row.examples.map((example) => `\`${example}\``).join('<br>');
}

function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/**
 * A Markdown table; columns holding only numbers are right-aligned. A table
 * without rows says so, so an empty result is visible in the report.
 */
function table(heading: string, header: string[], rows: string[][]): string[] {
  const lines = [`#### ${heading}`, ''];
  if (rows.length === 0) {
    return [...lines, 'None found.', ''];
  }
  const numeric = /^(?:-?\d+(?:\.\d+)?|—|[\d.]+ \/ [\d.]+ \/ [\d.]+)$/;
  const align = header.map((_, index) =>
    rows.every((row) => numeric.test(row[index] ?? '')) ? '---:' : '---'
  );
  lines.push(`| ${header.map(cell).join(' | ')} |`, `|${align.join('|')}|`);
  for (const row of rows) {
    lines.push(`| ${row.map(cell).join(' | ')} |`);
  }
  lines.push('');
  return lines;
}

function rowsOf(tally: Tally): string[][] {
  return tally.entries().map(([key, row]) => [key, String(row.count), String(row.sessions.size)]);
}

/** Rows of a tally counted once per session (its count is the session count). */
function sessionRows(tally: Tally): string[][] {
  return tally.entries().map(([key, row]) => [key, String(row.count), versionList(row.versions)]);
}

function rowsWithVersions(tally: Tally, examples = false): string[][] {
  return tally
    .entries()
    .map(([key, row]) => [
      key,
      String(row.count),
      String(row.sessions.size),
      versionList(row.versions),
      ...(examples ? [examplesCell(row)] : []),
    ]);
}

/** Rows whose tally keys hold tab-separated leading columns. */
function splitRows(tally: Tally, examples: boolean, versions = true): string[][] {
  return tally
    .entries()
    .map(([key, row]) => [
      ...key.split('\t'),
      String(row.count),
      String(row.sessions.size),
      ...(versions ? [versionList(row.versions)] : []),
      ...(examples ? [examplesCell(row)] : []),
    ]);
}
