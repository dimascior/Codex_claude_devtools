/**
 * Codex home / sessions directory resolution and session id validation.
 *
 * Codex stores its state in `$CODEX_HOME` (default `~/.codex`, i.e.
 * `%USERPROFILE%\.codex` on Windows). Rollouts live under `sessions/`,
 * partitioned by date: `sessions/YYYY/MM/DD/rollout-*.jsonl`.
 *
 * Session ids exposed to the renderer are rollout paths relative to the
 * sessions directory, always with forward slashes. They are validated before
 * being resolved so a crafted id can never escape the sessions directory.
 */

import * as os from 'os';
import * as path from 'path';

const CODEX_SESSIONS_SUBDIR = 'sessions';

const PLAIN_ROLLOUT_SUFFIX = '.jsonl';
const COMPRESSED_ROLLOUT_SUFFIX = '.jsonl.zst';
const ROLLOUT_PREFIX = 'rollout-';

/** Maximum nesting below the sessions dir (YYYY/MM/DD/file). */
const MAX_SESSION_ID_SEGMENTS = 4;

/**
 * Resolve the Codex home directory: `$CODEX_HOME` → `~/.codex`.
 */
function getCodexHomePath(): string {
  const fromEnv = process.env.CODEX_HOME?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  return path.join(os.homedir(), '.codex');
}

/**
 * Resolve the rollout sessions directory.
 */
export function getCodexSessionsPath(codexHome: string = getCodexHomePath()): string {
  return path.join(codexHome, CODEX_SESSIONS_SUBDIR);
}

/**
 * Whether a file name looks like a Codex rollout (plain or compressed).
 */
export function isRolloutFileName(fileName: string): boolean {
  return (
    fileName.startsWith(ROLLOUT_PREFIX) &&
    (fileName.endsWith(PLAIN_ROLLOUT_SUFFIX) || fileName.endsWith(COMPRESSED_ROLLOUT_SUFFIX))
  );
}

/**
 * Whether a rollout file is zstd-compressed.
 */
export function isCompressedRollout(fileName: string): boolean {
  return fileName.endsWith(COMPRESSED_ROLLOUT_SUFFIX);
}

/**
 * Remove trailing path separators (linear time, unlike a `[\\/]+$` regex).
 * A lone root separator is kept.
 */
export function trimTrailingSeparators(value: string): string {
  let end = value.length;
  while (end > 1 && (value[end - 1] === '/' || value[end - 1] === '\\')) {
    end--;
  }
  return value.slice(0, end);
}

/**
 * Convert an absolute rollout path to a session id (relative, forward slashes).
 */
export function toSessionId(sessionsDir: string, filePath: string): string {
  return path.relative(sessionsDir, filePath).split(path.sep).join('/');
}

/**
 * Validate a session id and resolve it to an absolute path inside `sessionsDir`.
 * Returns null for anything that is not a plain relative rollout path.
 */
export function resolveSessionFilePath(sessionsDir: string, sessionId: unknown): string | null {
  if (typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.length > 512) {
    return null;
  }
  if (sessionId.includes('\0') || sessionId.includes('\\')) {
    return null;
  }
  const segments = sessionId.split('/');
  if (segments.length > MAX_SESSION_ID_SEGMENTS) {
    return null;
  }
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return null;
  }
  const fileName = segments[segments.length - 1];
  if (!isRolloutFileName(fileName)) {
    return null;
  }
  if (path.isAbsolute(sessionId) || /^[a-zA-Z]:/.test(sessionId)) {
    return null;
  }

  const root = path.resolve(sessionsDir);
  const resolved = path.resolve(root, ...segments);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return resolved;
}

/**
 * Parse the timestamp and thread id encoded in a rollout file name:
 * `rollout-2025-09-23T22-41-03-<thread-id>[_<rollout-id>].jsonl[.zst]`.
 *
 * Codex renders the file name timestamp in local time, so it is interpreted in
 * the local time zone (line timestamps inside the file are UTC).
 */
export function parseRolloutFileName(
  fileName: string
): { startedAt: string; threadId: string } | null {
  // Same shape Codex itself parses: rollout-<19-char timestamp>-<thread>[_<rollout>].jsonl
  let core = fileName.endsWith(COMPRESSED_ROLLOUT_SUFFIX)
    ? fileName.slice(0, -'.zst'.length)
    : fileName;
  if (!core.startsWith(ROLLOUT_PREFIX) || !core.endsWith(PLAIN_ROLLOUT_SUFFIX)) {
    return null;
  }
  core = core.slice(ROLLOUT_PREFIX.length, -PLAIN_ROLLOUT_SUFFIX.length);
  const timestamp = core.slice(0, 19);
  const threadId = core.slice(20).split('_')[0];
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})$/.exec(timestamp);
  if (!parts || core[19] !== '-' || !/^[0-9a-fA-F-]{8,64}$/.test(threadId)) {
    return null;
  }
  const [, year, month, day, hours, minutes, seconds] = parts;
  const local = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds)
  );
  if (Number.isNaN(local.getTime())) {
    return null;
  }
  return { startedAt: local.toISOString(), threadId };
}
