/**
 * HTTP route handlers for Codex sessions (mirrors ipc/codex.ts).
 *
 * Routes:
 * - GET /api/codex/sessions - List rollouts under $CODEX_HOME/sessions
 * - GET /api/codex/session?id=&fingerprint= - Normalized execution timeline
 * - GET /api/codex/relations?id= - Spawned-child and spawned-by relations
 *
 * Change notifications are broadcast over SSE as `codex:session-change`.
 */

import { createLogger } from '@shared/utils/logger';

import type { HttpServices } from './index';
import type { FastifyInstance } from 'fastify';

const logger = createLogger('HTTP:codex');

export function registerCodexRoutes(app: FastifyInstance, services: HttpServices): void {
  app.get('/api/codex/sessions', async () => {
    try {
      return await services.codexSessionService.listSessions();
    } catch (error) {
      logger.error('Error in GET /api/codex/sessions:', error);
      return null;
    }
  });

  app.get<{ Querystring: { id?: string; fingerprint?: string } }>(
    '/api/codex/session',
    async (request) => {
      const { id, fingerprint } = request.query;
      if (typeof id !== 'string' || !id) {
        return null;
      }
      try {
        return await services.codexSessionService.getSessionDetail(
          id,
          typeof fingerprint === 'string' && fingerprint ? fingerprint : undefined
        );
      } catch (error) {
        logger.error(`Error in GET /api/codex/session for ${id}:`, error);
        return null;
      }
    }
  );

  app.get<{ Querystring: { id?: string } }>('/api/codex/relations', async (request) => {
    const { id } = request.query;
    if (typeof id !== 'string' || !id) {
      return null;
    }
    try {
      return await services.codexSessionService.getSessionRelations(id);
    } catch (error) {
      logger.error(`Error in GET /api/codex/relations for ${id}:`, error);
      return null;
    }
  });
}
