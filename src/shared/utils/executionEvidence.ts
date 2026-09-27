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
