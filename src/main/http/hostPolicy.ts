/**
 * Which addresses the HTTP server binds to and which Host names it answers.
 *
 * The server exposes private session data (prompts, commands, outputs), so it
 * is local-only unless configured otherwise:
 * - it binds to the IPv4 loopback address unless a bind address is given
 *   explicitly (standalone `HOST`);
 * - it answers only requests whose Host header names the loopback interface
 *   (`localhost`, `127.0.0.0/8`, `[::1]`) or a host the user allowed explicitly
 *   (standalone `ALLOWED_HOSTS`). A web page that points its own domain at
 *   127.0.0.1 (DNS rebinding) or reaches the port through `0.0.0.0` is
 *   rejected before any route runs.
 *
 * There is no authentication: binding to another interface makes the data
 * readable by anyone who can reach that interface and name an allowed host.
 */

/** Bind address used when none is configured. */
export const DEFAULT_BIND_HOST = '127.0.0.1';

const LOOPBACK_NAMES = ['localhost', '::1'];

/** Whether a host name is an IPv4 address in 127.0.0.0/8. */
function isIpv4Loopback(name: string): boolean {
  const octets = name.split('.');
  return (
    octets.length === 4 &&
    octets[0] === '127' &&
    octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)
  );
}

/**
 * Host name of a Host header value: lowercased, without port, brackets or a
 * trailing dot. Undefined when the value is missing or not a valid Host.
 */
export function hostNameOf(header: string | undefined): string | undefined {
  const value = header?.trim().toLowerCase();
  if (!value) {
    return undefined;
  }
  let name: string;
  let port = '';
  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    if (end === -1) {
      return undefined;
    }
    name = value.slice(1, end);
    port = value.slice(end + 1);
    if (port !== '' && !port.startsWith(':')) {
      return undefined;
    }
    port = port.slice(1);
  } else {
    const parts = value.split(':');
    // An unbracketed IPv6 address is not a valid Host header.
    if (parts.length > 2) {
      return undefined;
    }
    name = parts[0];
    port = parts[1] ?? '';
  }
  if (port !== '' && !/^\d{1,5}$/.test(port)) {
    return undefined;
  }
  name = name.endsWith('.') ? name.slice(0, -1) : name;
  return /^[a-z0-9.:-]+$/.test(name) ? name : undefined;
}

/** Host name of a bind address or configured host (`::1`, `[::1]:80`, `host`, `host:80`). */
function nameOfAddress(value: string): string | undefined {
  const bareIpv6 = !value.startsWith('[') && value.split(':').length > 2;
  return hostNameOf(bareIpv6 ? `[${value}]` : value);
}

/** Whether a bind address or host name designates the loopback interface. */
export function isLoopbackHost(host: string): boolean {
  const name = nameOfAddress(host);
  return name !== undefined && (LOOPBACK_NAMES.includes(name) || isIpv4Loopback(name));
}

/**
 * Host names requests may use: the loopback names plus explicitly allowed ones.
 */
export function createHostAllowlist(allowedHosts: readonly string[] = []): ReadonlySet<string> {
  const names = new Set(LOOPBACK_NAMES);
  for (const host of allowedHosts) {
    const name = nameOfAddress(host);
    if (name) {
      names.add(name);
    }
  }
  return names;
}

/** Whether a request's Host header is one the server answers. */
export function isAllowedHostHeader(
  header: string | undefined,
  allowlist: ReadonlySet<string>
): boolean {
  const name = hostNameOf(header);
  return name !== undefined && (allowlist.has(name) || isIpv4Loopback(name));
}

export interface StandaloneNetworkConfig {
  /** Address to bind to */
  host: string;
  /** Host names allowed in addition to the loopback names */
  allowedHosts: string[];
}

/**
 * Network settings for standalone mode from its environment:
 * `HOST` (bind address, loopback when unset) and `ALLOWED_HOSTS`
 * (comma-separated host names to answer besides the loopback names).
 */
export function resolveStandaloneNetworkConfig(
  env: Record<string, string | undefined>
): StandaloneNetworkConfig {
  return {
    host: env.HOST?.trim() || DEFAULT_BIND_HOST,
    allowedHosts: (env.ALLOWED_HOSTS ?? '')
      .split(',')
      .map((host) => host.trim())
      .filter(Boolean),
  };
}
