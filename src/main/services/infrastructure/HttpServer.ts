/**
 * HttpServer - Fastify-based HTTP server for serving the renderer UI and API routes.
 *
 * Local-only by default (see `@main/http/hostPolicy`): binds to 127.0.0.1
 * unless another address is passed explicitly, and rejects requests whose Host
 * header is not a loopback name or an explicitly allowed host.
 * Dynamically allocates a port starting from 3456.
 * In production, serves static files from the renderer output directory.
 * In development, Vite dev server handles static files.
 */

import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { type HttpServices, registerHttpRoutes } from '@main/http';
import { broadcastEvent } from '@main/http/events';
import {
  createHostAllowlist,
  DEFAULT_BIND_HOST,
  isAllowedHostHeader,
  isLoopbackHost,
} from '@main/http/hostPolicy';
import { createLogger } from '@shared/utils/logger';
import Fastify, { type FastifyInstance } from 'fastify';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import type { AddressInfo } from 'net';

const logger = createLogger('Service:HttpServer');

/** Distinct rejected Host values logged before logging stops. */
const MAX_REPORTED_HOSTS = 20;

/**
 * Resolves the renderer output directory from multiple candidate paths.
 * Returns the first path that exists on disk.
 */
function resolveRendererPath(): string | null {
  // __dirname exists in CJS (Electron production) but not ESM (standalone via tsx).
  const dir = typeof __dirname === 'string' ? __dirname : undefined;

  const candidates = [
    // Electron production (asarUnpack): app.asar.unpacked/out/renderer (real filesystem)
    ...(dir ? [join(dir, '../../out/renderer').replace('app.asar', 'app.asar.unpacked')] : []),
    // Electron production (asar fallback): app.asar/out/renderer
    ...(dir ? [join(dir, '../../out/renderer')] : []),
    // Standalone: dist-standalone/index.cjs → ../out/renderer
    ...(dir ? [join(dir, '../out/renderer')] : []),
    // Fallback: relative to cwd (dev mode, standalone via tsx)
    join(process.cwd(), 'out/renderer'),
  ];

  // Allow explicit override via env
  if (process.env.RENDERER_PATH) {
    candidates.unshift(process.env.RENDERER_PATH);
  }

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export interface HttpServerOptions {
  /**
   * Host names to answer besides the loopback names. Needed only when the
   * server is bound to another interface on purpose.
   */
  allowedHosts?: readonly string[];
}

export class HttpServer {
  private app: FastifyInstance | null = null;
  private port: number = 3456;
  private running: boolean = false;

  /**
   * Start the HTTP server.
   * @param services - Service instances to pass to route handlers
   * @param sshModeSwitchCallback - Callback for SSH mode switching
   * @param preferredPort - Port to try first (default 3456)
   * @param host - Address to bind to (default loopback, '127.0.0.1')
   * @param options - Host names to answer besides the loopback names
   */
  async start(
    services: HttpServices,
    sshModeSwitchCallback: (mode: 'local' | 'ssh') => Promise<void>,
    preferredPort: number = 3456,
    host: string = DEFAULT_BIND_HOST,
    options: HttpServerOptions = {}
  ): Promise<number> {
    this.app = Fastify({ logger: false });

    // Answer only requests addressed to this machine's loopback names or to a
    // host allowed explicitly, before CORS, static files or any API route.
    const allowlist = createHostAllowlist(options.allowedHosts);
    const reportedHosts = new Set<string>();
    this.app.addHook('onRequest', async (request, reply) => {
      const hostHeader = request.headers.host;
      if (!isAllowedHostHeader(hostHeader, allowlist)) {
        // Log each rejected Host once (bounded), not every request.
        const reported = String(hostHeader ?? '').slice(0, 100);
        if (!reportedHosts.has(reported) && reportedHosts.size < MAX_REPORTED_HOSTS) {
          reportedHosts.add(reported);
          logger.warn(
            `Rejected requests for Host ${JSON.stringify(reported)}; allowed: loopback names${
              options.allowedHosts?.length ? ` and ${options.allowedHosts.join(', ')}` : ''
            }`
          );
        }
        return reply.code(403).send({ error: 'Host not allowed' });
      }
    });
    if (!isLoopbackHost(host)) {
      logger.warn(
        `Binding to ${host}: session data is reachable from other machines without authentication`
      );
    }

    // Register CORS
    const corsOrigin = process.env.CORS_ORIGIN;
    if (corsOrigin === '*') {
      // Standalone/Docker mode: allow all origins (Docker network isolation replaces CORS)
      await this.app.register(cors, { origin: true, credentials: true });
    } else if (corsOrigin) {
      // Custom origin(s) from env
      const origins = corsOrigin.split(',').map((o) => o.trim());
      await this.app.register(cors, { origin: origins, credentials: true });
    } else {
      // Default: allow all localhost origins
      // eslint-disable-next-line security/detect-unsafe-regex -- anchored, no backtracking risk
      const localhostPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;
      await this.app.register(cors, {
        origin: (origin, cb) => {
          if (!origin) {
            cb(null, true);
            return;
          }
          if (localhostPattern.test(origin)) {
            cb(null, true);
            return;
          }
          cb(new Error('Not allowed by CORS'), false);
        },
        credentials: true,
      });
    }

    // Register static file serving and SPA fallback when renderer output exists.
    // In dev mode this requires a prior `pnpm build`; in production/standalone it's always present.
    const rendererPath = resolveRendererPath();
    if (rendererPath) {
      logger.info(`Serving static files from: ${rendererPath}`);

      // Cache index.html for SPA fallback
      const indexHtml = readFileSync(join(rendererPath, 'index.html'), 'utf-8');

      await this.app.register(fastifyStatic, {
        root: rendererPath,
        prefix: '/',
        wildcard: false,
      });

      // Register all API routes BEFORE the not-found handler
      registerHttpRoutes(this.app, services, sshModeSwitchCallback);

      // SPA fallback: serve index.html for all non-API routes
      this.app.setNotFoundHandler(async (request, reply) => {
        if (request.url.startsWith('/api/')) {
          return reply.status(404).send({ error: 'Not found' });
        }
        return reply.type('text/html').send(indexHtml);
      });
    } else {
      logger.warn('Renderer output directory not found (run `pnpm build` first), serving API only');
      registerHttpRoutes(this.app, services, sshModeSwitchCallback);
    }

    // Try ports starting from preferredPort
    for (let attempt = 0; attempt <= 10; attempt++) {
      const tryPort = preferredPort + attempt;
      try {
        await this.app.listen({ host, port: tryPort });
        // Port 0 asks the OS for a free port; report the one actually bound.
        const address = this.app.server.address() as AddressInfo | null;
        this.port = address?.port ?? tryPort;
        this.running = true;
        logger.info(`HTTP server started on http://${host}:${this.port}`);
        return this.port;
      } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'EADDRINUSE') {
          logger.info(`Port ${tryPort} in use, trying next...`);
          continue;
        }
        throw err;
      }
    }

    throw new Error(`Could not find available port (tried ${preferredPort}-${preferredPort + 10})`);
  }

  /**
   * Stop the HTTP server gracefully.
   */
  async stop(): Promise<void> {
    if (this.app && this.running) {
      await this.app.close();
      this.running = false;
      this.app = null;
      logger.info('HTTP server stopped');
    }
  }

  /**
   * Broadcast an event to all connected SSE clients.
   */
  broadcast(channel: string, data: unknown): void {
    broadcastEvent(channel, data);
  }

  /**
   * Get the current port the server is running on.
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Address the server is bound to, or null when it is not running.
   */
  getAddress(): AddressInfo | null {
    const address = this.running ? this.app?.server.address() : null;
    return address && typeof address === 'object' ? address : null;
  }

  /**
   * Check if the server is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }
}
