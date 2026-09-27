/**
 * CodexRolloutParser - Streams a Codex rollout file into normalized records.
 *
 * Responsibilities:
 * - Read plain `.jsonl` and zstd-compressed `.jsonl.zst` rollouts
 * - Support incremental reads from a byte offset (rollouts are append-only)
 * - Normalize both the envelope format and the pre-envelope legacy format
 * - Strip heavy, never-rendered data (inline images, encrypted blobs,
 *   base instructions) so cached records stay small
 *
 * Only newline-terminated lines are consumed; an unterminated trailing line
 * (a write in progress) is returned separately as `tail` and re-read next time.
 */

import * as fs from 'fs';
import * as zlib from 'zlib';

import { isCompressedRollout } from './codexPaths';

import type { CodexRolloutRecord } from './types';
import type { Readable } from 'stream';

/** Record types used by the envelope format. */
const ENVELOPE_TYPES = new Set([
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

/** Marker substituted for stripped binary/encrypted data. */
export const STRIPPED_MARKER = '[omitted]';

/** Lines larger than this are skipped rather than parsed (defensive bound). */
const MAX_LINE_BYTES = 64 * 1024 * 1024;

/** Large session_meta fields that are never rendered. */
const SESSION_META_OMITTED_KEYS = new Set(['base_instructions', 'instructions', 'dynamic_tools']);
/** Large compacted fields (the replacement history is a full model context). */
const COMPACTED_OMITTED_KEYS = new Set([
  'replacement_history',
  'replacement_history_metadata',
  'guardian_history',
  'retained_context',
]);

export interface ReadRolloutOptions {
  /** Byte offset to start reading from (plain rollouts only) */
  fromOffset?: number;
  /** Line number of the first line at `fromOffset` (1-based) */
  startLineNumber?: number;
  /** Stop after this many complete lines */
  maxLines?: number;
  /** Stop once a record satisfies this predicate (it is included) */
  stopWhen?: (record: CodexRolloutRecord) => boolean;
}

export interface ReadRolloutResult {
  /** Records from complete (newline-terminated) lines */
  records: CodexRolloutRecord[];
  /** Record parsed from an unterminated trailing line, if it was valid JSON */
  tail?: CodexRolloutRecord;
  /** Byte offset just after the last complete line (plain rollouts) */
  nextOffset: number;
  /** Line number the next complete line will have */
  nextLineNumber: number;
  /** Whether reading stopped early (maxLines / stopWhen) */
  stoppedEarly: boolean;
  /** Lines that could not be parsed */
  malformedLines: number;
}

/**
 * Whether this runtime can read `.jsonl.zst` rollouts.
 */
export function isZstdSupported(): boolean {
  return typeof (zlib as { createZstdDecompress?: unknown }).createZstdDecompress === 'function';
}

/**
 * Read and normalize rollout records.
 */
export async function readRolloutRecords(
  filePath: string,
  options: ReadRolloutOptions = {}
): Promise<ReadRolloutResult> {
  const compressed = isCompressedRollout(filePath);
  if (compressed && !isZstdSupported()) {
    throw new Error('Compressed rollouts (.jsonl.zst) are not supported by this runtime');
  }

  const startOffset = compressed ? 0 : Math.max(0, options.fromOffset ?? 0);
  let lineNumber = options.startLineNumber ?? 1;
  const records: CodexRolloutRecord[] = [];
  let malformedLines = 0;
  let stoppedEarly = false;

  const raw = fs.createReadStream(filePath, { start: startOffset, highWaterMark: 256 * 1024 });
  let stream: Readable = raw;
  if (compressed) {
    const decompress = createZstdDecompressStream();
    // pipe() does not forward errors; without this a read error would stall the loop.
    raw.on('error', (error) => decompress.destroy(error));
    stream = raw.pipe(decompress);
  }

  const handleLine = (lineBuffer: Buffer): boolean => {
    const record = parseRolloutLine(lineBuffer.toString('utf8'), lineNumber);
    lineNumber++;
    if (record === undefined) {
      return false;
    }
    if (record === null) {
      malformedLines++;
      return false;
    }
    records.push(record);
    if (
      options.maxLines !== undefined &&
      lineNumber - (options.startLineNumber ?? 1) >= options.maxLines
    ) {
      return true;
    }
    return options.stopWhen?.(record) ?? false;
  };

  const splitter = new LineSplitter((line) => {
    if (line === null) {
      // Oversized line: skipped, but it still occupies a line number.
      malformedLines++;
      lineNumber++;
      return false;
    }
    return handleLine(line);
  });

  try {
    for await (const chunk of stream) {
      if (splitter.push(chunk as Buffer)) {
        stoppedEarly = true;
        break;
      }
    }
  } finally {
    raw.destroy();
    if (stream !== raw) {
      stream.destroy();
    }
  }

  let tail: CodexRolloutRecord | undefined;
  const remainder = stoppedEarly ? null : splitter.remainder();
  if (remainder) {
    tail = parseRolloutLine(remainder.toString('utf8'), lineNumber) ?? undefined;
  }

  return {
    records,
    tail,
    nextOffset: startOffset + splitter.consumedBytes,
    nextLineNumber: lineNumber,
    stoppedEarly,
    malformedLines,
  };
}

/**
 * Splits a byte stream into newline-terminated lines, tracking the bytes the
 * complete lines consumed so reads can resume at an exact offset. Splitting
 * on the 0x0A byte is safe for UTF-8 (it never occurs inside a multibyte
 * sequence).
 */
class LineSplitter {
  /** Bytes consumed by complete lines (including their newline) */
  consumedBytes = 0;
  private pending: Buffer[] = [];
  /** Size of the current partial line, even when its bytes were dropped */
  private pendingBytes = 0;
  private oversized = false;

  /**
   * @param onLine receives each complete line (null for an oversized line) and
   *   returns true to stop
   */
  constructor(private readonly onLine: (line: Buffer | null) => boolean) {}

  /** Feed a chunk. Returns true when `onLine` asked to stop. */
  push(buffer: Buffer): boolean {
    let segmentStart = 0;
    let newlineIndex = buffer.indexOf(0x0a);
    while (newlineIndex !== -1) {
      const piece = buffer.subarray(segmentStart, newlineIndex);
      const lineLength = this.pendingBytes + piece.length;
      this.consumedBytes += lineLength + 1;
      let line: Buffer | null = null;
      if (!this.oversized && lineLength <= MAX_LINE_BYTES) {
        line = this.pending.length > 0 ? Buffer.concat([...this.pending, piece]) : piece;
      }
      this.pending = [];
      this.pendingBytes = 0;
      this.oversized = false;
      if (this.onLine(line)) {
        return true;
      }
      segmentStart = newlineIndex + 1;
      newlineIndex = buffer.indexOf(0x0a, segmentStart);
    }

    if (segmentStart < buffer.length) {
      const rest = buffer.subarray(segmentStart);
      this.pendingBytes += rest.length;
      if (this.pendingBytes > MAX_LINE_BYTES) {
        this.oversized = true;
        this.pending = [];
      } else if (!this.oversized) {
        // Copy: the stream may reuse the chunk's memory.
        this.pending.push(Buffer.from(rest));
      }
    }
    return false;
  }

  /** The unterminated trailing line, if any. */
  remainder(): Buffer | null {
    return this.pendingBytes > 0 && !this.oversized ? Buffer.concat(this.pending) : null;
  }
}

/**
 * Read up to `maxBytes` from the end of a plain rollout and parse the complete
 * lines found there. Used for cheap "is a turn still running?" checks.
 */
export async function readRolloutTail(
  filePath: string,
  maxBytes: number
): Promise<CodexRolloutRecord[]> {
  if (isCompressedRollout(filePath)) {
    return [];
  }
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const { size } = await handle.stat();
    const start = Math.max(0, size - maxBytes);
    const length = size - start;
    if (length <= 0) {
      return [];
    }
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, start);
    let text = buffer.toString('utf8');
    if (start > 0) {
      // Drop the (probably partial) first line.
      const firstNewline = text.indexOf('\n');
      text = firstNewline === -1 ? '' : text.slice(firstNewline + 1);
    }
    const records: CodexRolloutRecord[] = [];
    for (const line of text.split('\n')) {
      const record = parseRolloutLine(line, 0);
      if (record) {
        records.push(record);
      }
    }
    return records;
  } finally {
    await handle.close();
  }
}

/**
 * Parse one rollout line.
 * Returns undefined for blank or ignorable lines, null for malformed lines.
 */
export function parseRolloutLine(
  line: string,
  lineNumber: number
): CodexRolloutRecord | null | undefined {
  const trimmed = line.trim();
  if (!trimmed) {
    return undefined;
  }
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!isRecord(value)) {
    return null;
  }
  return normalizeRolloutValue(value, lineNumber);
}

/**
 * Normalize a parsed rollout line (envelope or legacy) into a record.
 */
function normalizeRolloutValue(
  value: Record<string, unknown>,
  lineNumber: number
): CodexRolloutRecord | null | undefined {
  const timestamp = typeof value.timestamp === 'string' ? value.timestamp : undefined;
  const type = typeof value.type === 'string' ? value.type : undefined;

  // Envelope format: {"timestamp","type","payload"[,"metadata"][,"ordinal"]}
  if (type && ENVELOPE_TYPES.has(type) && 'payload' in value) {
    const payload = isRecord(value.payload) ? value.payload : {};
    const record: CodexRolloutRecord = {
      lineNumber,
      timestamp,
      type,
      payload: sanitizePayload(type, payload),
    };
    if (typeof value.ordinal === 'number' && Number.isInteger(value.ordinal)) {
      record.ordinal = value.ordinal;
    }
    if (isRecord(value.metadata)) {
      record.metadata = value.metadata;
    }
    return record;
  }

  // Legacy rollout state lines carry nothing renderable.
  if (value.record_type === 'state') {
    return undefined;
  }

  // Legacy session metadata line: bare SessionMeta object.
  if (!type && typeof value.id === 'string' && ('timestamp' in value || 'instructions' in value)) {
    return {
      lineNumber,
      timestamp,
      type: 'session_meta',
      payload: sanitizePayload('session_meta', value),
    };
  }

  // Legacy response item: bare ResponseItem object.
  if (type) {
    return {
      lineNumber,
      timestamp,
      type: 'response_item',
      payload: sanitizePayload('response_item', value),
    };
  }

  return null;
}

// =============================================================================
// Sanitization
// =============================================================================

/**
 * Remove large data that is never rendered: inline image data, encrypted
 * blobs, base instructions, compaction replacement history.
 * Presence is preserved so the UI can still say "encrypted" or "1 image".
 */
function sanitizePayload(type: string, payload: Record<string, unknown>): Record<string, unknown> {
  switch (type) {
    case 'session_meta':
      return omitKeys(payload, SESSION_META_OMITTED_KEYS);
    case 'compacted':
      return omitKeys(payload, COMPACTED_OMITTED_KEYS);
    case 'response_item':
      return sanitizeResponseItem(payload);
    case 'event_msg':
      return sanitizeEvent(payload);
    default:
      return payload;
  }
}

function sanitizeResponseItem(item: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...item };
  if (typeof next.encrypted_content === 'string') {
    next.encrypted_content = STRIPPED_MARKER;
  }
  if (Array.isArray(next.encrypted_function_args)) {
    next.encrypted_function_args = [STRIPPED_MARKER];
  }
  if (next.type === 'image_generation_call' && typeof next.result === 'string') {
    next.result = STRIPPED_MARKER;
  }
  if (Array.isArray(next.content)) {
    next.content = next.content.map(sanitizeContentItem);
  }
  if (Array.isArray(next.output)) {
    next.output = next.output.map(sanitizeContentItem);
  }
  return next;
}

function sanitizeContentItem(item: unknown): unknown {
  if (!isRecord(item)) {
    return item;
  }
  const next: Record<string, unknown> = { ...item };
  if (typeof next.image_url === 'string') {
    next.image_url = STRIPPED_MARKER;
  }
  if (typeof next.audio_url === 'string') {
    next.audio_url = STRIPPED_MARKER;
  }
  if (typeof next.encrypted_content === 'string') {
    next.encrypted_content = STRIPPED_MARKER;
  }
  return next;
}

function sanitizeEvent(event: Record<string, unknown>): Record<string, unknown> {
  if (event.type === 'user_message' && Array.isArray(event.images)) {
    return { ...event, images: event.images.map(() => STRIPPED_MARKER) };
  }
  if (event.type === 'item_completed' && isRecord(event.item)) {
    const item = event.item;
    let next = item;
    if (item.type === 'ImageGeneration' && typeof item.result === 'string') {
      next = { ...next, result: STRIPPED_MARKER };
    }
    if (Array.isArray(item.content)) {
      // UserMessage inputs may embed images as data URLs.
      next = { ...next, content: item.content.map(sanitizeContentItem) };
    }
    return next === item ? event : { ...event, item: next };
  }
  return event;
}

// =============================================================================
// Helpers
// =============================================================================

function createZstdDecompressStream(): NodeJS.ReadWriteStream & Readable {
  const factory = (zlib as { createZstdDecompress?: () => NodeJS.ReadWriteStream & Readable })
    .createZstdDecompress;
  if (!factory) {
    throw new Error('zstd decompression is unavailable');
  }
  return factory();
}

function omitKeys(
  payload: Record<string, unknown>,
  keys: ReadonlySet<string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!keys.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
