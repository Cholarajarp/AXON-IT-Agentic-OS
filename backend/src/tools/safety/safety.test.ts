import { describe, expect, it, beforeEach } from 'vitest';
import { parseSafeCommand, isProgramAllowed } from './command-parser.js';
import { validateUrl, isPrivateIp } from './url-guard.js';

describe('parseSafeCommand', () => {
  it('tokenizes a simple command', () => {
    const r = parseSafeCommand('ls -la /tmp');
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.program).toBe('ls');
    expect(r.args).toEqual(['-la', '/tmp']);
  });

  it('handles double-quoted args', () => {
    const r = parseSafeCommand('git commit -m "hello world"');
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.args).toEqual(['commit', '-m', 'hello world']);
  });

  it('rejects shell pipe operator', () => {
    const r = parseSafeCommand('cat /etc/passwd | grep root');
    expect('error' in r).toBe(true);
  });

  it('rejects command substitution', () => {
    const r = parseSafeCommand('echo $(whoami)');
    expect('error' in r).toBe(true);
  });

  it('rejects command chaining with &&', () => {
    const r = parseSafeCommand('ls && rm -rf /');
    expect('error' in r).toBe(true);
  });

  it('rejects redirect operators', () => {
    const r = parseSafeCommand('cat secret > /tmp/leak');
    expect('error' in r).toBe(true);
  });

  it('rejects backticks', () => {
    const r = parseSafeCommand('echo `whoami`');
    expect('error' in r).toBe(true);
  });

  it('rejects semicolons', () => {
    const r = parseSafeCommand('ls; rm /etc/passwd');
    expect('error' in r).toBe(true);
  });

  it('rejects unbalanced quotes', () => {
    const r = parseSafeCommand('echo "unterminated');
    expect('error' in r).toBe(true);
  });
});

describe('isProgramAllowed', () => {
  it('allows listed programs by basename', () => {
    expect(isProgramAllowed('ls')).toBe(true);
    expect(isProgramAllowed('/bin/ls')).toBe(true);
    expect(isProgramAllowed('/usr/local/bin/node')).toBe(true);
  });

  it('rejects programs not on the allowlist', () => {
    expect(isProgramAllowed('nc')).toBe(false);
    expect(isProgramAllowed('/tmp/malware')).toBe(false);
    expect(isProgramAllowed('sudo')).toBe(false);
  });
});

describe('isPrivateIp', () => {
  it('identifies RFC 1918 IPv4 ranges', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('172.31.255.254')).toBe(true);
    expect(isPrivateIp('192.168.1.1')).toBe(true);
  });

  it('identifies loopback and link-local', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('169.254.169.254')).toBe(true); // AWS IMDS
  });

  it('identifies IPv6 loopback and ULA', () => {
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('fc00::1')).toBe(true);
    expect(isPrivateIp('fe80::1')).toBe(true);
  });

  it('returns false for public IPs', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
  });
});

describe('validateUrl (SSRF guard)', () => {
  beforeEach(() => {
    // no global state to reset
  });

  it('rejects file:// scheme', async () => {
    const r = await validateUrl('file:///etc/passwd');
    expect(r.allowed).toBe(false);
  });

  it('rejects gopher:// scheme', async () => {
    const r = await validateUrl('gopher://evil.com/1/');
    expect(r.allowed).toBe(false);
  });

  it('rejects cloud metadata endpoints', async () => {
    const r = await validateUrl('http://169.254.169.254/latest/meta-data/');
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/metadata/i);
  });

  it('rejects metadata.google.internal', async () => {
    const r = await validateUrl('http://metadata.google.internal/computeMetadata/v1/');
    expect(r.allowed).toBe(false);
  });

  it('rejects loopback by literal IP', async () => {
    const r = await validateUrl('http://127.0.0.1:5432/');
    expect(r.allowed).toBe(false);
  });

  it('rejects private IPv4 by literal IP', async () => {
    const r = await validateUrl('http://10.0.0.5/admin');
    expect(r.allowed).toBe(false);
  });

  it('respects explicit allowlist for public hosts', async () => {
    const r = await validateUrl('https://api.example.com/v1/things', {
      allowedHosts: ['example.com'],
    });
    // Test may fail if DNS is unavailable; in that case we accept either outcome
    // but if it resolves, the allowlist should match.
    if (r.reason?.startsWith('DNS lookup failed')) return;
    expect(r.allowed).toBe(true);
  });

  it('rejects hosts not on the allowlist when allowlist is set', async () => {
    const r = await validateUrl('https://notallowed.com/', {
      allowedHosts: ['example.com'],
    });
    expect(r.allowed).toBe(false);
  });
});
