/**
 * Runtime settings in the Codex view: the header's current runtime (latest
 * effective turn state), settings-change entries (recorded vs derived), and the
 * effective runtime section of execution details (resolved through turnId,
 * separate from provenance).
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  type NormalizedCodexSession,
  normalizeCodexRollout,
} from '../../../src/main/providers/codex/CodexExecutionNormalizer';
import { CodexExecutionDetails } from '../../../src/renderer/components/codex/CodexExecutionDetails';
import { TurnRuntimeContext } from '../../../src/renderer/components/codex/codexRuntimeContext';
import {
  currentRuntime,
  executionRuntimeRows,
  turnStatesById,
} from '../../../src/renderer/components/codex/codexRuntimeFormatting';
import { CodexSessionHeader } from '../../../src/renderer/components/codex/CodexSessionHeader';
import { CodexSettingsChangeItem } from '../../../src/renderer/components/codex/CodexSettingsChangeItem';

import type { AgentSessionDetail, Execution, SettingsChangeEntry } from '../../../src/main/domain';
import type { CodexRolloutRecord } from '../../../src/main/providers/codex/types';

const THREAD = '019ef000-0000-7000-8000-000000000002';

const TURN: Record<string, unknown> = {
  cwd: '/work/app',
  approval_policy: 'on-request',
  sandbox_policy: { type: 'workspace-write' },
  permission_profile: { type: 'managed' },
  model: 'm-a',
  collaboration_mode: { mode: 'default' },
  personality: 'pragmatic',
  effort: 'high',
  summary: 'auto',
};

const THREAD_SETTINGS: Record<string, unknown> = {
  model: 'm-a',
  service_tier: 'priority',
  approval_policy: 'on-request',
  permission_profile: { type: 'managed' },
  reasoning_effort: 'high',
  reasoning_summary: 'detailed',
};

class Rollout {
  readonly records: CodexRolloutRecord[] = [];

  constructor() {
    this.add('session_meta', { id: THREAD, cwd: '/work/app', cli_version: '0.158.0' });
  }

  add(type: string, payload: Record<string, unknown>): number {
    const lineNumber = this.records.length + 1;
    this.records.push({
      lineNumber,
      ordinal: lineNumber - 1,
      timestamp: new Date(Date.UTC(2026, 8, 28, 10, 0, lineNumber)).toISOString(),
      type,
      payload,
    });
    return lineNumber;
  }

  settings(changes: Record<string, unknown> = {}): number {
    return this.add('event_msg', {
      type: 'thread_settings_applied',
      thread_id: THREAD,
      thread_settings: { ...THREAD_SETTINGS, ...changes },
    });
  }

  /** A turn with one command; returns the turn context's line. */
  turn(turnId: string, changes: Record<string, unknown> = {}, withContext = true): number {
    this.add('event_msg', { type: 'task_started', turn_id: turnId });
    const line = withContext
      ? this.add('turn_context', { turn_id: turnId, ...TURN, ...changes })
      : 0;
    this.add('response_item', {
      type: 'function_call',
      name: 'exec_command',
      call_id: `call-${turnId}`,
      arguments: JSON.stringify({ cmd: 'git status' }),
    });
    this.add('response_item', {
      type: 'function_call_output',
      call_id: `call-${turnId}`,
      output: 'Process exited with code 0\nOutput:\nclean',
    });
    this.add('event_msg', { type: 'task_complete', turn_id: turnId });
    return line;
  }

  normalize(): NormalizedCodexSession {
    return normalizeCodexRollout(this.records, { active: false });
  }
}

function detailOf(session: NormalizedCodexSession): AgentSessionDetail {
  return {
    session: {
      id: '2026/09/28/rollout-x.jsonl',
      provider: 'codex',
      filePath: '/codex/sessions/2026/09/28/rollout-x.jsonl',
      projectKey: 'app',
      projectName: 'app',
      updatedAt: Date.now(),
      sizeBytes: 1,
      compressed: false,
      isLive: false,
      model: session.model,
    },
    timeline: session.timeline,
    stats: session.stats,
    runtime: session.runtime,
    warnings: session.warnings,
    fingerprint: 'f',
  };
}

function header(detail: AgentSessionDetail): string {
  return renderToStaticMarkup(
    createElement(CodexSessionHeader, {
      detail,
      filter: 'all',
      onFilterChange: () => undefined,
      onOpenRelated: () => undefined,
    })
  );
}

function changesOf(session: NormalizedCodexSession): SettingsChangeEntry[] {
  return session.timeline.filter(
    (entry): entry is SettingsChangeEntry => entry.kind === 'settings_change'
  );
}

function entryHtml(entry: SettingsChangeEntry): string {
  return renderToStaticMarkup(createElement(CodexSettingsChangeItem, { entry }));
}

function executionsOf(session: NormalizedCodexSession): Execution[] {
  return session.timeline.flatMap((entry) => (entry.kind === 'execution' ? [entry.execution] : []));
}

function detailsHtml(execution: Execution, session?: NormalizedCodexSession): string {
  const details = createElement(CodexExecutionDetails, { execution });
  return renderToStaticMarkup(
    session
      ? createElement(
          TurnRuntimeContext.Provider,
          { value: turnStatesById(session.runtime) },
          details
        )
      : details
  );
}

/** Text of the `<dt>` labels of a rendered settings change. */
function labels(html: string): string[] {
  return [...html.matchAll(/<dt[^>]*>([^<]*)<\/dt>/g)].map((match) => match[1]);
}

describe('header: current runtime', () => {
  const r = new Rollout();
  r.settings();
  r.turn('t1', { model: 'm-a', effort: 'high', approval_policy: 'never' });
  r.settings({ model: 'm-b', reasoning_effort: 'low' });
  const latest = r.turn('t2', {
    model: 'm-b',
    effort: 'low',
    approval_policy: 'on-request',
    sandbox_policy: { type: 'read-only' },
    permission_profile: { type: 'disabled' },
  });
  const session = r.normalize();

  it('takes the header values from the latest effective turn state', () => {
    const current = currentRuntime(session.runtime);
    expect(current?.primary.map((row) => [row.label, row.value])).toEqual([
      ['Model', 'm-b'],
      ['Effort', 'low'],
      ['Approval', 'on-request'],
      ['Sandbox', 'read-only'],
      ['Profile', 'disabled'],
    ]);
    expect(current?.source).toBe(`turn_context · rollout line ${latest}`);
    expect(session.model).toBe('m-b');
  });

  it('renders them in the header, without a second model tag and without the first model', () => {
    const html = header(detailOf(session));
    expect(html).toContain('aria-label="Runtime settings"');
    expect(html).toContain('>m-b<');
    expect(html).toContain('>read-only<');
    expect(html).not.toContain('>m-a<');
    expect(html).not.toContain('title="Model"');
  });

  it('keeps the other settings behind the details toggle, thread-only ones under thread settings', () => {
    const current = currentRuntime(session.runtime);
    expect(current?.details.map((group) => group.title)).toEqual([
      'Latest turn',
      'Thread settings',
    ]);
    const [turnGroup, threadGroup] = current?.details ?? [];
    expect(turnGroup.rows.map((row) => row.label)).toEqual([
      'Collaboration mode',
      'Personality',
      'Turn summary mode',
      'Working dir',
    ]);
    expect(threadGroup.source).toMatch(/^thread_settings_applied · rollout line \d+$/);
    expect(threadGroup.rows.map((row) => [row.label, row.value])).toEqual([
      ['Service tier', 'priority'],
      ['Reasoning summary setting', 'detailed'],
    ]);
    // Collapsed by default: the header line stays short.
    expect(header(detailOf(session))).not.toContain('Service tier');
  });

  it('renders a session with no runtime records as before: model tag, no runtime line', () => {
    const plain = new Rollout();
    plain.turn('t1', {}, false);
    const normalized = plain.normalize();
    const detail = {
      ...detailOf(normalized),
      session: { ...detailOf(normalized).session, model: 'm-x' },
    };
    expect(currentRuntime(normalized.runtime)).toBeUndefined();
    const html = header(detail);
    expect(html).not.toContain('Runtime settings');
    expect(html).toContain('title="Model"');
    expect(html).toContain('m-x');
    // A detail from an older main process has no runtime at all.
    expect(header({ ...detail, runtime: undefined })).toContain('m-x');
  });
});

describe('timeline: settings changes', () => {
  const r = new Rollout();
  r.settings();
  r.turn('t1');
  const recordedLine = r.settings({
    model: 'm-b',
    reasoning_effort: 'xhigh',
    approval_policy: 'never',
    permission_profile: { type: 'disabled' },
  });
  r.turn('t2', {
    model: 'm-b',
    effort: 'xhigh',
    approval_policy: 'never',
    permission_profile: { type: 'disabled' },
  });
  const [recorded] = changesOf(r.normalize());

  const observedRollout = new Rollout();
  const previousLine = observedRollout.turn('t1', { effort: 'low' });
  const observedLine = observedRollout.turn('t2', {
    effort: 'xhigh',
    sandbox_policy: { type: 'danger-full-access' },
  });
  const [observed] = changesOf(observedRollout.normalize());

  it('shows a recorded change as a Codex settings event applying from the next turn', () => {
    const html = entryHtml(recorded);
    expect(html).toContain('Settings changed');
    expect(html).toContain('Applies from the next turn');
    expect(html).toContain(`Recorded by Codex · rollout line ${recordedLine}`);
    expect(html).toContain('border:1px solid');
    expect(html).toContain('data-source="thread_settings_applied"');
  });

  it('renders model, effort, approval and permission profile changes as previous → next', () => {
    const html = entryHtml(recorded);
    expect(labels(html)).toEqual([
      'Model',
      'Reasoning effort',
      'Approval policy',
      'Permission profile',
    ]);
    for (const [before, after] of [
      ['m-a', 'm-b'],
      ['high', 'xhigh'],
      ['on-request', 'never'],
      ['managed', 'disabled'],
    ]) {
      expect(html).toMatch(new RegExp(`>${before}</span><span[^>]*> → </span>${after}<`));
    }
  });

  it('renders a sandbox change and lists no unchanged setting', () => {
    const html = entryHtml(observed);
    expect(labels(html)).toEqual(['Reasoning effort', 'Sandbox']);
    expect(html).toMatch(/>workspace-write<\/span><span[^>]*> → <\/span>danger-full-access</);
    expect(html).not.toContain('Model');
    expect(html).not.toContain('Approval policy');
  });

  it('shows a derived change as observed, dashed, and never as a recorded Codex event', () => {
    expect(observed.source).toBe('turn_context_diff');
    const html = entryHtml(observed);
    expect(html).toContain('Runtime state changed');
    expect(html).toContain('Observed at this turn');
    expect(html).toContain(
      `Derived from effective turn contexts · rollout lines ${previousLine}, ${observedLine}`
    );
    expect(html).toContain('border:1px dashed');
    expect(html).toContain('data-source="turn_context_diff"');
    expect(html).not.toContain('Recorded by Codex');
    expect(html).not.toContain('Settings changed');
    expect(html).not.toContain('thread_settings_applied');
  });
});

describe('execution details: effective runtime', () => {
  const r = new Rollout();
  r.settings();
  const first = r.turn('t1', { effort: 'low' });
  r.settings({ reasoning_effort: 'xhigh', service_tier: 'flex' });
  const second = r.turn('t2', { effort: 'xhigh' });
  const session = r.normalize();
  const [inFirst, inSecond] = executionsOf(session);

  it("resolves each execution's turn state through turnId", () => {
    expect(inFirst.turnId).toBe('t1');
    const html = detailsHtml(inFirst, session);
    expect(html).toContain('aria-label="Effective runtime"');
    expect(html).toContain(`turn_context · rollout line ${first}`);
    expect(html).toMatch(/Reasoning effort<\/dt><dd[^>]*>low</);
    const later = detailsHtml(inSecond, session);
    expect(later).toContain(`turn_context · rollout line ${second}`);
    expect(later).toMatch(/Reasoning effort<\/dt><dd[^>]*>xhigh</);
  });

  it('shows only per-turn settings: no service tier, no reasoning summary setting', () => {
    const state = turnStatesById(session.runtime).get('t2');
    expect(state).toBeDefined();
    const shown = executionRuntimeRows(state!).map((row) => row.field);
    expect(shown).not.toContain('serviceTier');
    expect(shown).not.toContain('reasoningSummary');
    expect(shown).toContain('turnSummary');
    expect(detailsHtml(inSecond, session)).not.toContain('Service tier');
  });

  it('keeps the runtime section apart from, and after, the provenance section', () => {
    const html = detailsHtml(inFirst, session);
    const provenance = html.indexOf('aria-label="Provenance"');
    const runtime = html.indexOf('aria-label="Effective runtime"');
    expect(provenance).toBeGreaterThan(-1);
    expect(html.indexOf('</section>', provenance)).toBeLessThan(runtime);
  });

  it('renders no runtime section when the turn has no recorded state', () => {
    expect(detailsHtml(inFirst)).not.toContain('Effective runtime');
    const plain = new Rollout();
    plain.turn('t1', {}, false);
    const normalized = plain.normalize();
    const [exec] = executionsOf(normalized);
    const html = detailsHtml(exec, normalized);
    expect(html).toContain('aria-label="Provenance"');
    expect(html).not.toContain('Effective runtime');
  });
});
