/**
 * Parent ↔ subagent navigation in the Codex view: the child-session link of
 * a spawn card, the "Spawned by" line of a subagent's header, the relation
 * evidence, and the timeline bringing the spawn call into view. Relations come
 * from the main-process resolver run on the SYNTHETIC rollout family
 * (test/fixtures/codex/subagentFamily.ts); navigation goes through the store.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeCodexRollout } from '../../../src/main/providers/codex/CodexExecutionNormalizer';
import { parseRolloutLine } from '../../../src/main/providers/codex/CodexRolloutParser';
import { CodexSessionService } from '../../../src/main/providers/codex/CodexSessionService';
import { CodexChildSessionLink } from '../../../src/renderer/components/codex/CodexChildSessionLink';
import { CodexExecutionCard } from '../../../src/renderer/components/codex/CodexExecutionCard';
import { CodexParentSessionLink } from '../../../src/renderer/components/codex/CodexParentSessionLink';
import { CodexRelationDetails } from '../../../src/renderer/components/codex/CodexRelationDetails';
import {
  relatedSessionName,
  relationDetailRows,
  relationStatusLabel,
} from '../../../src/renderer/components/codex/codexRelationFormatting';
import { CodexRelationsContext } from '../../../src/renderer/components/codex/codexRelationsContext';
import { CodexTimeline } from '../../../src/renderer/components/codex/CodexTimeline';
import {
  CALLS,
  rolloutLines,
  rootRollout,
  SESSION_IDS,
  subagentFamily,
  THREADS,
  writeRollouts,
} from '../../fixtures/codex/subagentFamily';

import type { ReactElement } from 'react';
import type {
  AgentSessionDetail,
  AgentSessionRelation,
  AgentSessionRelations,
  Execution,
} from '../../../src/main/domain';
import type { CodexRolloutRecord } from '../../../src/main/providers/codex/types';

// Tell React that state updates are wrapped in act().
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const codexMock = vi.hoisted(() => ({
  listSessions: vi.fn(),
  getSessionDetail: vi.fn(),
  getSessionRelations: vi.fn(),
  onSessionChange: vi.fn(),
}));

vi.mock('@renderer/api', () => ({
  api: { codex: codexMock },
  isElectronMode: () => true,
}));

// =============================================================================
// Relations resolved by the main process on the synthetic family
// =============================================================================

const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-relations-ui-'));
writeRollouts(sessionsDir, subagentFamily());
afterAll(() => fs.rmSync(sessionsDir, { recursive: true, force: true }));
const service = new CodexSessionService({ sessionsDir, watch: false });

async function relationsOf(sessionId: string): Promise<AgentSessionRelations> {
  const relations = await service.getSessionRelations(sessionId);
  if (!relations) throw new Error(`no relations for ${sessionId}`);
  return relations;
}

function rootExecutions(): { detail: AgentSessionDetail; spawn: Execution } {
  const records = rolloutLines(rootRollout())
    .map((line, index) => parseRolloutLine(line, index + 1))
    .filter((record): record is CodexRolloutRecord => Boolean(record));
  const normalized = normalizeCodexRollout(records, { active: false });
  const spawn = normalized.executions.find((exec) => exec.id === CALLS.spawnChild);
  if (!spawn) throw new Error('spawn execution missing');
  return {
    spawn,
    detail: {
      session: {
        id: SESSION_IDS.root,
        provider: 'codex',
        threadId: THREADS.root,
        filePath: `/codex/sessions/${SESSION_IDS.root}`,
        projectKey: '/work/synthetic-app',
        projectName: 'synthetic-app',
        updatedAt: 1,
        sizeBytes: 1,
        compressed: false,
        isLive: false,
      },
      timeline: normalized.timeline,
      stats: normalized.stats,
      runtime: normalized.runtime,
      warnings: [],
      fingerprint: 'f',
    },
  };
}

// =============================================================================
// DOM helpers
// =============================================================================

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.resetAllMocks();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function render(element: ReactElement): Promise<void> {
  await act(async () => {
    root.render(element);
    await Promise.resolve();
  });
}

function buttons(): HTMLButtonElement[] {
  return Array.from(host.querySelectorAll('button'));
}

function buttonNamed(label: string): HTMLButtonElement {
  const found = buttons().find((button) => button.textContent?.includes(label));
  if (!found) throw new Error(`no "${label}" button in ${host.innerHTML}`);
  return found;
}

async function click(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
}

async function storeWithDetails() {
  const { createTestStore } = await import('../store/storeTestUtils');
  codexMock.getSessionDetail.mockImplementation((id: string) =>
    Promise.resolve({
      ...rootExecutions().detail,
      session: { ...rootExecutions().detail.session, id },
    })
  );
  codexMock.getSessionRelations.mockImplementation((id: string) => service.getSessionRelations(id));
  return createTestStore();
}

// =============================================================================
// Tests
// =============================================================================

describe('Codex navigation: parent spawn → child session', () => {
  it('"Open child" selects the exact viewer session id of the spawned child', async () => {
    const [child] = (await relationsOf(SESSION_IDS.root)).children;
    expect(child.status).toBe('resolved');
    const store = await storeWithDetails();

    await render(
      createElement(CodexChildSessionLink, {
        relation: child,
        onOpen: store.getState().openCodexRelatedSession,
      })
    );
    expect(host.textContent).toContain('Child session');
    expect(host.textContent).toContain('Noether');
    expect(host.textContent).toContain('task reviewer');

    await click(buttonNamed('Open child'));
    expect(store.getState().codexSelectedSessionId).toBe(SESSION_IDS.child);
    expect(store.getState().codexFocusExecutionId).toBeNull();
    expect(codexMock.getSessionDetail).toHaveBeenCalledWith(SESSION_IDS.child, undefined);
  });

  it('missing, ambiguous and unresolved relations offer no target', async () => {
    const children = (await relationsOf(SESSION_IDS.root)).children;
    const missing = children.find((relation) => relation.status === 'missing_session');
    const unresolved = children.find((relation) => relation.status === 'unresolved');
    const ambiguous: AgentSessionRelation = {
      ...children[0],
      status: 'ambiguous',
      relatedSessionId: undefined,
      related: undefined,
      candidateSessionIds: [SESSION_IDS.child, 'other.jsonl'],
    };
    const onOpen = vi.fn();
    for (const [relation, text] of [
      [missing, 'Child session not available yet'],
      [unresolved, 'Child relation unresolved'],
      [ambiguous, 'Child relation ambiguous'],
    ] as const) {
      if (!relation) throw new Error('fixture relation missing');
      await render(createElement(CodexChildSessionLink, { relation, onOpen }));
      expect(host.textContent).toContain(text);
      expect(buttons()).toHaveLength(0);
    }
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('a spawn card shows the link outside its header button; the card never navigates', async () => {
    const [child] = (await relationsOf(SESSION_IDS.root)).children;
    const { spawn } = rootExecutions();
    const openRelated = vi.fn();
    await render(
      createElement(
        CodexRelationsContext.Provider,
        { value: { childrenByExecutionId: new Map([[spawn.id, child]]), openRelated } },
        createElement(CodexExecutionCard, { execution: spawn })
      )
    );
    const header = host.querySelector('button[aria-expanded]');
    expect(header?.textContent).not.toContain('Open child');
    await click(header as HTMLButtonElement);
    expect(openRelated).not.toHaveBeenCalled();
    // Expanded details carry the relation evidence.
    expect(host.textContent).toContain('Explicit provider ID chain');

    await click(buttonNamed('Open child'));
    expect(openRelated).toHaveBeenCalledWith(child);
  });

  it('a previously missing child becomes navigable when refreshed relations resolve it', async () => {
    const children = (await relationsOf(SESSION_IDS.root)).children;
    const missing = children.find((relation) => relation.status === 'missing_session');
    if (!missing) throw new Error('fixture relation missing');
    const onOpen = vi.fn();
    await render(createElement(CodexChildSessionLink, { relation: missing, onOpen }));
    expect(buttons()).toHaveLength(0);

    // What the resolver reports once the child's rollout has appeared.
    await render(
      createElement(CodexChildSessionLink, {
        relation: {
          ...missing,
          status: 'resolved',
          reason: undefined,
          relatedSessionId: SESSION_IDS.missing,
          related: { agentNickname: 'Turing' },
        },
        onOpen,
      })
    );
    await click(buttonNamed('Open child'));
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ relatedSessionId: SESSION_IDS.missing })
    );
  });
});

describe('Codex navigation: child session → parent spawn', () => {
  it('"Open parent" selects the exact parent viewer session id and focuses the spawn call', async () => {
    const { parent } = await relationsOf(SESSION_IDS.child);
    if (!parent) throw new Error('parent relation missing');
    const store = await storeWithDetails();

    await render(
      createElement(CodexParentSessionLink, {
        relation: parent,
        onOpen: store.getState().openCodexRelatedSession,
      })
    );
    expect(host.textContent).toContain('Spawned by');
    expect(host.textContent).toContain('Review the synthetic app with a helper agent.');

    await click(buttonNamed('Open parent'));
    const state = store.getState();
    expect(state.codexSelectedSessionId).toBe(SESSION_IDS.root);
    expect(state.codexFocusExecutionId).toBe(CALLS.spawnChild);
    expect(state.codexFollowLive).toBe(false);
  });

  it('a continued parent thread opens the rollout that holds the spawn', async () => {
    const { parent } = await relationsOf(SESSION_IDS.lateChild);
    const store = await storeWithDetails();
    await render(
      createElement(CodexParentSessionLink, {
        relation: parent!,
        onOpen: store.getState().openCodexRelatedSession,
      })
    );
    await click(buttonNamed('Open parent'));
    expect(store.getState().codexSelectedSessionId).toBe(SESSION_IDS.rootContinuation);
    expect(store.getState().codexFocusExecutionId).toBe(CALLS.spawnLateChild);
  });

  it('an unresolved parent relation shows its status and evidence, with no target', async () => {
    const relation: AgentSessionRelation = {
      kind: 'spawned_by',
      status: 'unresolved',
      reason: 'None of the 1 rollout(s) of the declared parent thread records a spawn',
      evidence: {
        method: 'explicit_id_chain',
        childThreadId: THREADS.child,
        declaredParentThreadId: THREADS.root,
      },
    };
    const onOpen = vi.fn();
    await render(createElement(CodexParentSessionLink, { relation, onOpen }));
    expect(host.textContent).toContain('Parent relation unresolved');
    expect(buttons().map((button) => button.textContent)).toEqual(['Evidence']);
    await click(buttonNamed('Evidence'));
    expect(host.textContent).toContain('Declared parent');
    expect(host.textContent).toContain('not evidence on its own');
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe('Codex timeline: focusing the spawn call', () => {
  it('scrolls to the spawn execution, highlights it and clears the request', async () => {
    const { detail } = rootExecutions();
    const children = (await relationsOf(SESSION_IDS.root)).children;
    const scrollIntoView = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const onFocusHandled = vi.fn();
    try {
      await render(
        createElement(CodexTimeline, {
          detail,
          filter: 'all',
          followLive: false,
          childRelations: children,
          onOpenRelated: vi.fn(),
          focusExecutionId: CALLS.spawnChild,
          onFocusHandled,
        })
      );
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
    const target = host.querySelector<HTMLElement>(`[data-execution-id="${CALLS.spawnChild}"]`);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(target);
    expect(target?.style.boxShadow).toContain('--highlight-ring');
    expect(onFocusHandled).toHaveBeenCalledTimes(1);
    // Every spawn card shows its relation; only the resolved one can be opened.
    expect(host.textContent).toContain('Child session not available yet');
    expect(host.textContent).toContain('Child relation unresolved');
    expect(buttons().filter((button) => button.textContent?.includes('Open child'))).toHaveLength(
      1
    );
  });

  it('says so when the requested execution is not in the timeline, and keeps the request', async () => {
    const { detail } = rootExecutions();
    const onFocusHandled = vi.fn();
    await render(
      createElement(CodexTimeline, {
        detail,
        filter: 'all',
        followLive: false,
        childRelations: [],
        onOpenRelated: vi.fn(),
        focusExecutionId: 'call_notInThisFile',
        onFocusHandled,
      })
    );
    expect(host.textContent).toContain(
      'The spawn call call_notInThisFile is not shown in this timeline.'
    );
    expect(onFocusHandled).not.toHaveBeenCalled();
  });
});

describe('Codex relation evidence', () => {
  it('shows the explicit provider ID chain and its source lines', async () => {
    const [child] = (await relationsOf(SESSION_IDS.root)).children;
    const html = renderToStaticMarkup(createElement(CodexRelationDetails, { relation: child }));
    const rows = Object.fromEntries(
      relationDetailRows(child).map((row) => [row.label, [row.value, row.note].join(' | ')])
    );
    expect(html).toContain('Explicit provider ID chain');
    expect(rows).toEqual({
      Relationship: 'Spawned child | ',
      Status: 'Resolved to one rollout | ',
      'Link method': 'Explicit provider ID chain | ',
      'Spawn call': `${CALLS.spawnChild} | function_call collaboration.spawn_agent · this rollout, line ${child.evidence.callLineNumber}`,
      'Started record': `same provider id | item_completed/SubAgentActivity (started) · this rollout, line ${child.evidence.activityLineNumber}`,
      'Child thread': `${THREADS.child} | the child rollout's session_meta.id`,
      'Parent thread': `${THREADS.root} | this rollout's session_meta.id`,
      'Child declares parent': `${THREADS.root} | agrees with this rollout's thread`,
      'Child rollout': `${SESSION_IDS.child} | `,
    });
    expect(html).not.toMatch(/matched by tim|nearest/i);
  });

  it('lists ambiguous candidates without choosing one', () => {
    const relation: AgentSessionRelation = {
      kind: 'spawned_child',
      status: 'ambiguous',
      executionId: CALLS.spawnChild,
      relatedThreadId: THREADS.child,
      candidateSessionIds: ['a.jsonl', 'b.jsonl'],
      reason: '2 rollouts belong to this thread',
      evidence: { method: 'explicit_id_chain', callId: CALLS.spawnChild },
    };
    const rows = relationDetailRows(relation);
    expect(rows.find((row) => row.label === 'Candidate rollouts')).toEqual({
      label: 'Candidate rollouts',
      value: 'a.jsonl\nb.jsonl',
      mono: true,
      note: 'none is chosen',
    });
    expect(rows.some((row) => row.label === 'Child rollout')).toBe(false);
    expect(relationStatusLabel(relation)).toBe('Child relation ambiguous');
  });

  it('names related sessions by nickname and title, else neutrally, never by task text', () => {
    const base: AgentSessionRelation = {
      kind: 'spawned_child',
      status: 'resolved',
      relatedSessionId: 'x.jsonl',
      evidence: { method: 'explicit_id_chain' },
    };
    expect(relatedSessionName(base)).toEqual({ name: 'Child session' });
    expect(
      relatedSessionName({ ...base, related: { title: 'reviewer', titleSource: 'agent_task' } })
    ).toEqual({ name: 'task reviewer' });
    expect(
      relatedSessionName({
        ...base,
        related: { agentNickname: 'Noether', title: 'reviewer', titleSource: 'agent_task' },
      })
    ).toEqual({ name: 'Noether', detail: 'task reviewer' });
    expect(relatedSessionName({ ...base, kind: 'spawned_by' })).toEqual({ name: 'Parent session' });
  });
});
