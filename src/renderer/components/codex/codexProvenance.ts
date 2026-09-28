/**
 * Provenance of an execution: its identity in the viewer, the provider
 * records behind it, the script call site it came from, and how they were
 * related. Built only from `Execution` fields and `evidence`; nothing here
 * adds a relation the parser did not record.
 */

import { isStaticOnly } from '@shared/utils/executionEvidence';

import type { CorrelationMethod, EvidenceLink, Execution, RecordEvidence } from '@shared/types';

export interface ProvenanceRow {
  label: string;
  value: string;
  /** Ids and record types are shown in monospace */
  mono?: boolean;
  /** An id worth copying (to search the rollout for it) */
  copyable?: boolean;
  /** Short explanation shown after the value */
  note?: string;
  /** Case-specific detail shown under the value */
  detail?: string;
}

export interface ProvenanceGroup {
  title: string;
  /** What the group describes (tooltip) */
  description: string;
  rows: ProvenanceRow[];
}

export interface ProvenanceClass {
  label: string;
  title: string;
}

/** What each correlation method means. */
export const CORRELATION_EXPLANATIONS: Record<CorrelationMethod, string> = {
  explicit_id: 'Provider records share an identifier.',
  turn_window: 'Recorded during the only running code cell in this turn; no shared id exists.',
  content: 'Uniquely matched by identical normalized command text.',
  unresolved: 'No defensible relationship could be established.',
};

/**
 * What an execution rests on: provider records, a script call site, or both.
 * A script call site alone never counts as something that ran.
 */
export function provenanceClass(exec: Execution): ProvenanceClass {
  const { code, observed, result } = exec.evidence;
  if (isStaticOnly(exec)) {
    return {
      label: 'Script-derived only',
      title:
        'Found in the cell script by static analysis. Codex recorded nothing for it, so it may not have run.',
    };
  }
  if (!observed && !result) {
    return {
      label: 'No provider record',
      title: 'No provider record is attached to this execution.',
    };
  }
  if (code) {
    return {
      label: 'Recorded + script-correlated',
      title: 'Codex recorded this operation, and it was matched to a call site in the cell script.',
    };
  }
  if (!observed) {
    return {
      label: 'Recorded result only',
      title: 'Codex recorded a result for this operation, but not the call that produced it.',
    };
  }
  if (observed.kind === 'inventory' && !result) {
    return {
      label: 'Listed by Codex, no result',
      title: 'Codex listed this call as attempted; no result was recorded.',
    };
  }
  return {
    label: 'Recorded by Codex',
    title: result
      ? 'Codex recorded this operation and its result.'
      : 'Codex recorded this operation; no result was recorded.',
  };
}

function sameRecord(a: RecordEvidence, b: RecordEvidence): boolean {
  return a.lineNumber === b.lineNumber && a.recordType === b.recordType;
}

/** An item record carries an item id; call, output and inventory records carry a call id. */
function providerIdLabel(record: RecordEvidence): string {
  switch (record.kind) {
    case 'item':
      return 'Provider item ID';
    case 'inventory':
      return 'Inventory call ID';
    default:
      return 'Provider call ID';
  }
}

function recordRows(record: RecordEvidence): ProvenanceRow[] {
  const rows: ProvenanceRow[] = [{ label: 'Record type', value: record.recordType, mono: true }];
  if (record.recordId) {
    rows.push({
      label: providerIdLabel(record),
      value: record.recordId,
      mono: true,
      copyable: true,
    });
  }
  rows.push({ label: 'Rollout line', value: String(record.lineNumber) });
  return rows;
}

function linkRow(label: string, link: EvidenceLink): ProvenanceRow {
  return {
    label,
    value: link.method,
    mono: true,
    note: CORRELATION_EXPLANATIONS[link.method],
    detail: link.detail,
  };
}

/**
 * Provenance groups for an execution, showing only what exists.
 */
export function buildProvenance(exec: Execution): ProvenanceGroup[] {
  const { code, observed, result, cellLink, callSiteLink } = exec.evidence;
  const groups: ProvenanceGroup[] = [];

  const providerIds = [observed?.recordId, result?.recordId];
  const execution: ProvenanceRow[] = [
    {
      label: 'Domain ID',
      value: exec.id,
      mono: true,
      copyable: true,
      note: providerIds.includes(exec.id) ? 'same as the provider ID below' : undefined,
    },
  ];
  if (exec.parentId) {
    execution.push({ label: 'Parent', value: exec.parentId, mono: true, copyable: true });
  }
  if (exec.turnId) {
    execution.push({ label: 'Turn', value: exec.turnId, mono: true, copyable: true });
  }
  if (exec.cellId) {
    execution.push({ label: 'Runtime cell ID', value: exec.cellId, mono: true });
  }
  groups.push({
    title: 'Execution',
    description: 'How the viewer identifies this execution and where it sits.',
    rows: execution,
  });

  if (observed) {
    groups.push({
      title: 'Observed record',
      description: 'The provider record showing the operation was attempted.',
      rows: recordRows(observed),
    });
  }
  if (result) {
    groups.push({
      title: 'Result record',
      description: "The provider record carrying the operation's result.",
      rows:
        observed && sameRecord(observed, result)
          ? [{ label: 'Record', value: 'the observed record' }]
          : recordRows(result),
    });
  } else if (observed) {
    groups.push({
      title: 'Result record',
      description: "The provider record carrying the operation's result.",
      rows: [{ label: 'Record', value: 'none recorded' }],
    });
  } else {
    groups.push({
      title: 'Provider records',
      description: 'Records Codex wrote for this operation.',
      rows: [{ label: 'Records', value: 'none: Codex recorded nothing for this operation' }],
    });
  }

  if (code) {
    const rows: ProvenanceRow[] = [];
    if (exec.parentId) rows.push({ label: 'Cell', value: exec.parentId, mono: true });
    rows.push({ label: 'Script line', value: String(code.line) });
    rows.push({
      label: 'Dynamic arguments',
      value: code.dynamic ? 'yes, known only at runtime' : 'no',
    });
    groups.push({
      title: 'Script call site',
      description: 'Where the cell script calls this operation (static analysis).',
      rows,
    });
  }

  const links: ProvenanceRow[] = [];
  if (cellLink) {
    // A nested record was attributed to its cell; a top-level one to a call, or to nothing.
    links.push(linkRow(exec.parentId ? 'Cell attribution' : 'Attribution', cellLink));
  }
  if (callSiteLink) links.push(linkRow('Call-site match', callSiteLink));
  if (links.length > 0) {
    groups.push({
      title: 'Correlation',
      description: 'How the records above were related to each other.',
      rows: links,
    });
  }
  return groups;
}
