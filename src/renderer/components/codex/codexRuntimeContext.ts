/**
 * Effective runtime state of each turn, by turn id, for the execution details
 * of the Codex timeline. An execution is related to its turn's state through
 * `Execution.turnId`; the state is not copied into executions.
 */

import { createContext } from 'react';

import type { TurnRuntimeState } from '@shared/types';

export const TurnRuntimeContext = createContext<ReadonlyMap<string, TurnRuntimeState>>(new Map());
