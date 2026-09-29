/**
 * The selected session's spawned-child relations, by spawn execution id, and
 * how to open a related session, for the execution cards of the Codex
 * timeline. Relations are resolved in the main process; cards only show them.
 */

import { createContext } from 'react';

import type { AgentSessionRelation } from '@shared/types';

interface CodexRelationsContextValue {
  /** Spawned-child relations by the id of the spawn execution */
  childrenByExecutionId: ReadonlyMap<string, AgentSessionRelation>;
  /** Open the session of a resolved relation */
  openRelated: (relation: AgentSessionRelation) => void;
}

export const CodexRelationsContext = createContext<CodexRelationsContextValue>({
  childrenByExecutionId: new Map(),
  openRelated: () => undefined,
});
