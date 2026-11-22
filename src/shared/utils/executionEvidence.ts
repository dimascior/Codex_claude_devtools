/**
 * Helpers for reading execution evidence (see `ExecutionEvidence` in the domain model).
 */

import type { Execution } from '@shared/types';

/**
 * Whether an execution is known only from static analysis of a code-mode
 * script: it has a call site and no provider record at all.
 */
export function isStaticOnly(exec: Pick<Execution, 'evidence'>): boolean {
  return exec.evidence.code !== undefined && !exec.evidence.observed && !exec.evidence.result;
}

/**
 * Whether the provider recorded a result for this execution.
 */
export function hasRecordedResult(exec: Pick<Execution, 'evidence'>): boolean {
  return exec.evidence.result !== undefined;
}

/**
 * Whether Codex recorded this execution's file writes as applied: the
 * file-change record linked to it completed (whatever the execution's kind),
 * or, without such a record, the patch execution itself completed. Nothing is
 * inferred from command text: a command has file writes only when Codex
 * recorded a file change for it.
 */
export function hasAppliedFileWrites(
  exec: Pick<Execution, 'kind' | 'status' | 'fileWrites' | 'fileChangeStatus'>
): boolean {
  if (!exec.fileWrites || exec.fileWrites.length === 0) {
    return false;
  }
  if (exec.fileChangeStatus !== undefined) {
    return exec.fileChangeStatus === 'completed';
  }
  return exec.kind === 'patch' && exec.status === 'completed';
}
