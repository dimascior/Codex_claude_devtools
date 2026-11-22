import { describe, expect, it } from 'vitest';

import {
  createHostAllowlist,
  DEFAULT_BIND_HOST,
  hostNameOf,
  isAllowedHostHeader,
  isLoopbackHost,
  resolveStandaloneNetworkConfig,
} from '../../../src/main/http/hostPolicy';

describe('HTTP host policy', () => {
  it('reads host names from Host header values', () => {
    expect(hostNameOf('localhost:3456')).toBe('localhost');
    expect(hostNameOf('LOCALHOST')).toBe('localhost');
    expect(hostNameOf('127.0.0.1:3456')).toBe('127.0.0.1');
    expect(hostNameOf('[::1]:3456')).toBe('::1');
    expect(hostNameOf('[::1]')).toBe('::1');
    expect(hostNameOf('localhost.:80')).toBe('localhost');
    for (const invalid of [
      undefined,
      '',
      '::1',
      '[::1',
      '[::1]x',
      'localhost:port',
      'a b',
      'user@host',
    ]) {
      expect(hostNameOf(invalid)).toBeUndefined();
    }
  });

  it('answers loopback Host names by default and rejects everything else', () => {
    const allowlist = createHostAllowlist();
    for (const host of [
      'localhost:3456',
      '127.0.0.1:3456',
      '127.1.2.3',
      '[::1]:3456',
      'Localhost',
    ]) {
      expect(isAllowedHostHeader(host, allowlist)).toBe(true);
    }
    for (const host of [
      undefined,
      '',
      'evil.example',
      'evil.example:3456',
      '0.0.0.0:3456',
      '[::]:3456',
      '127.0.0.1.evil.example',
      'localhost.evil.example',
      '192.168.1.20:3456',
      '127.0.0.256',
    ]) {
      expect(isAllowedHostHeader(host, allowlist)).toBe(false);
    }
  });

  it('answers other hosts only when they are allowed explicitly', () => {
    const allowlist = createHostAllowlist([
      'devbox.lan',
      '192.168.1.20',
      'fd00::5',
      'Other.Example:8080',
    ]);
    for (const host of [
      'devbox.lan:3456',
      '192.168.1.20:3456',
      '[fd00::5]:3456',
      'other.example',
    ]) {
      expect(isAllowedHostHeader(host, allowlist)).toBe(true);
    }
    expect(isAllowedHostHeader('evil.example', allowlist)).toBe(false);
  });

  it('recognizes loopback bind addresses', () => {
    for (const host of ['127.0.0.1', 'localhost', '::1', '[::1]', '127.0.0.2']) {
      expect(isLoopbackHost(host)).toBe(true);
    }
    for (const host of ['0.0.0.0', '::', '192.168.1.20', 'devbox.lan']) {
      expect(isLoopbackHost(host)).toBe(false);
    }
  });

  it('binds standalone mode to loopback unless an address is configured', () => {
    expect(DEFAULT_BIND_HOST).toBe('127.0.0.1');
    expect(resolveStandaloneNetworkConfig({})).toEqual({ host: '127.0.0.1', allowedHosts: [] });
    expect(resolveStandaloneNetworkConfig({ HOST: '  ' })).toEqual({
      host: '127.0.0.1',
      allowedHosts: [],
    });
    expect(
      resolveStandaloneNetworkConfig({
        HOST: '0.0.0.0',
        ALLOWED_HOSTS: 'devbox.lan, 192.168.1.20,',
      })
    ).toEqual({ host: '0.0.0.0', allowedHosts: ['devbox.lan', '192.168.1.20'] });
  });
});
