/**
 * The HTTP server is local-only by default: it binds to loopback and answers
 * only loopback Host names (or hosts allowed explicitly), before any route.
 */

import * as http from 'http';
import * as net from 'net';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { HttpServer } from '../../../../src/main/services/infrastructure/HttpServer';

// The server runs without Electron in standalone mode; stub it as that build does.
vi.mock('electron', () => {
  const proxy = new Proxy({}, { get: () => () => undefined });
  return {
    app: proxy,
    BrowserWindow: class {},
    Notification: class {
      show(): void {}
    },
    clipboard: proxy,
    shell: proxy,
    default: proxy,
  };
});
vi.mock('electron-updater', () => ({ default: { autoUpdater: {} } }));

import type { HttpServices } from '../../../../src/main/http';
import type { AgentSessionList } from '../../../../src/main/domain';

const CODEX_LIST: AgentSessionList = {
  provider: 'codex',
  rootDir: '/sessions',
  rootExists: true,
  sessions: [],
  projects: [],
  totalFiles: 0,
  liveSessionId: null,
  latestSessionId: null,
  compressedSupported: true,
  scannedAt: 1,
};

function stubServices(calls: string[]): HttpServices {
  return {
    projectScanner: {
      scan: async () => {
        calls.push('projects');
        return [{ id: '-work-app', name: 'app' }];
      },
    },
    codexSessionService: {
      listSessions: async () => {
        calls.push('codex');
        return CODEX_LIST;
      },
    },
  } as unknown as HttpServices;
}

function request(
  port: number,
  path: string,
  hostHeader: string,
  address = '127.0.0.1'
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: address, port, path, method: 'GET', headers: { host: hostHeader } },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

/** Startup notice when no renderer build exists (as in CI's test job): the server serves the API only. */
const API_ONLY_NOTICE = 'Renderer output directory not found';

/** Warnings the server logged, apart from the API-only notice; clears them for the global console check. */
function takeWarnings(): string[] {
  const spy = vi.mocked(console.warn);
  const messages = spy.mock.calls
    .map((args) => args.map(String).join(' '))
    .filter((message) => !message.includes(API_ONLY_NOTICE));
  spy.mockClear();
  return messages;
}

async function ipv6LoopbackAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(0, '::1', () => server.close(() => resolve(true)));
  });
}

describe('HttpServer local exposure', () => {
  const servers: HttpServer[] = [];
  let ipv6 = false;

  beforeAll(async () => {
    ipv6 = await ipv6LoopbackAvailable();
  });

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.stop()));
    // Every warning a test expects is asserted by that test.
    expect(takeWarnings()).toEqual([]);
  });

  async function startServer(
    calls: string[],
    host?: string,
    allowedHosts?: string[]
  ): Promise<{ server: HttpServer; port: number }> {
    const server = new HttpServer();
    servers.push(server);
    const port = await server.start(stubServices(calls), async () => {}, 0, host, {
      allowedHosts,
    });
    return { server, port };
  }

  it('binds to the IPv4 loopback address by default, not to all interfaces', async () => {
    const { server, port } = await startServer([]);
    expect(port).toBeGreaterThan(0);
    expect(server.getAddress()).toMatchObject({ address: '127.0.0.1', family: 'IPv4', port });
  });

  it('serves the Codex and Claude API routes to loopback Host names', async () => {
    const calls: string[] = [];
    const { port } = await startServer(calls);
    for (const host of [`localhost:${port}`, `127.0.0.1:${port}`, 'LOCALHOST']) {
      const codex = await request(port, '/api/codex/sessions', host);
      expect(codex.status).toBe(200);
      expect(JSON.parse(codex.body)).toEqual(CODEX_LIST);
      const projects = await request(port, '/api/projects', host);
      expect(projects.status).toBe(200);
      expect(JSON.parse(projects.body)).toEqual([{ id: '-work-app', name: 'app' }]);
    }
    expect(calls).toEqual(['codex', 'projects', 'codex', 'projects', 'codex', 'projects']);
  });

  it('rejects unexpected Host headers before any route runs', async () => {
    const calls: string[] = [];
    const { port } = await startServer(calls);
    for (const host of [
      'evil.example',
      `evil.example:${port}`,
      `0.0.0.0:${port}`,
      `127.0.0.1.evil.example:${port}`,
      '[::1',
    ]) {
      for (const path of ['/api/codex/sessions', '/api/projects', '/api/events', '/']) {
        const response = await request(port, path, host);
        expect(response.status).toBe(403);
        expect(JSON.parse(response.body)).toEqual({ error: 'Host not allowed' });
      }
    }
    expect(calls).toEqual([]);
    // Each rejected Host is logged once, not once per request.
    expect(takeWarnings()).toHaveLength(5);
  });

  it('answers another host name only when it is allowed explicitly', async () => {
    const { port: defaultPort } = await startServer([]);
    expect((await request(defaultPort, '/api/projects', 'devbox.lan')).status).toBe(403);

    const { port } = await startServer([], undefined, ['devbox.lan']);
    expect((await request(port, '/api/projects', `devbox.lan:${port}`)).status).toBe(200);
    expect((await request(port, '/api/projects', 'evil.example')).status).toBe(403);
    expect(takeWarnings()).toEqual([
      expect.stringContaining('Rejected requests for Host "devbox.lan"'),
      expect.stringContaining('Rejected requests for Host "evil.example"'),
    ]);
  });

  it('serves over the IPv6 loopback address when bound to it', async (context) => {
    if (!ipv6) {
      context.skip();
    }
    const { server, port } = await startServer([], '::1');
    expect(server.getAddress()).toMatchObject({ address: '::1', family: 'IPv6', port });
    const response = await request(port, '/api/codex/sessions', `[::1]:${port}`, '::1');
    expect(response.status).toBe(200);
    expect((await request(port, '/api/codex/sessions', 'evil.example', '::1')).status).toBe(403);
    expect(takeWarnings()).toHaveLength(1);
  });
});
