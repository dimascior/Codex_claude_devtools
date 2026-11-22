/**
 * IPC Handlers for Codex sessions.
 *
 * Handlers:
 * - codex:listSessions: List rollouts under $CODEX_HOME/sessions
 * - codex:getSessionDetail: Normalized execution timeline for one rollout
 * - codex:getSessionRelations: Spawned-child and spawned-by relations of one rollout
 *
 * Change notifications (`codex:session-change`) are pushed from main/index.ts.
 * Codex data is always read from the local machine, regardless of the active
 * Claude context (local or SSH).
 */

import { createLogger } from '@shared/utils/logger';
import { type IpcMain, type IpcMainInvokeEvent } from 'electron';

import type {
  AgentSessionDetailResponse,
  AgentSessionList,
  AgentSessionRelations,
} from '../domain';
import type { CodexSessionService } from '../providers';

// Channel constants (mirrored from preload/constants/ipcChannels.ts to respect
// module boundaries — main process cannot import from preload).
const CODEX_LIST_SESSIONS = 'codex:listSessions';
const CODEX_GET_SESSION_DETAIL = 'codex:getSessionDetail';
const CODEX_GET_SESSION_RELATIONS = 'codex:getSessionRelations';

const logger = createLogger('IPC:codex');

let service: CodexSessionService | null = null;

export function initializeCodexHandlers(codexSessionService: CodexSessionService): void {
  service = codexSessionService;
}

export function registerCodexHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(CODEX_LIST_SESSIONS, handleListSessions);
  ipcMain.handle(CODEX_GET_SESSION_DETAIL, handleGetSessionDetail);
  ipcMain.handle(CODEX_GET_SESSION_RELATIONS, handleGetSessionRelations);
  logger.info('Codex handlers registered');
}

export function removeCodexHandlers(ipcMain: IpcMain): void {
  ipcMain.removeHandler(CODEX_LIST_SESSIONS);
  ipcMain.removeHandler(CODEX_GET_SESSION_DETAIL);
  ipcMain.removeHandler(CODEX_GET_SESSION_RELATIONS);
}

async function handleListSessions(_event: IpcMainInvokeEvent): Promise<AgentSessionList | null> {
  if (!service) {
    return null;
  }
  try {
    return await service.listSessions();
  } catch (error) {
    logger.error('Error in codex:listSessions:', error);
    return null;
  }
}

async function handleGetSessionDetail(
  _event: IpcMainInvokeEvent,
  sessionId: unknown,
  knownFingerprint?: unknown
): Promise<AgentSessionDetailResponse | null> {
  if (!service || typeof sessionId !== 'string') {
    return null;
  }
  try {
    return await service.getSessionDetail(
      sessionId,
      typeof knownFingerprint === 'string' ? knownFingerprint : undefined
    );
  } catch (error) {
    logger.error(`Error in codex:getSessionDetail for ${sessionId}:`, error);
    return null;
  }
}

async function handleGetSessionRelations(
  _event: IpcMainInvokeEvent,
  sessionId: unknown
): Promise<AgentSessionRelations | null> {
  if (!service || typeof sessionId !== 'string') {
    return null;
  }
  try {
    return await service.getSessionRelations(sessionId);
  } catch (error) {
    logger.error(`Error in codex:getSessionRelations for ${sessionId}:`, error);
    return null;
  }
}
