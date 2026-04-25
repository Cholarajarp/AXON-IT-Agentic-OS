/**
 * URL safety for the HTTP tool.
 *
 * Agents reach external systems through this guard. It must refuse:
 *   - non-http(s) schemes (file://, gopher://, data:, ftp://)
 *   - cloud metadata endpoints (169.254.169.254, metadata.google.internal, etc.)
 *   - RFC 1918 / loopback / link-local addresses unless explicitly allowed
 *   - DNS rebinding attempts (we resolve and re-check the actual IP)
 *
 * This is the single layer between an injected URL in an agent plan and your
 * cloud IAM credentials walking out the door.
 */

import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';

export interface URLGuardOptions {
  allowPrivateNetworks?: boolean;
  allowedHosts?: string[]; // suffix match
  blockedHosts?: string[];
}

export interface URLGuardResult {
  allowed: boolean;
  reason?: string;
  resolvedIp?: string;
  parsedUrl?: URL;
}

const BLOCKED_METADATA_HOSTS = [
  '169.254.169.254',       // AWS / Azure / GCP / Oracle IMDS
  'metadata.google.internal',
  'metadata.azure.com',
  'metadata.packet.net',
  'metadata.digitalocean.com',
  'fd00:ec2::254',
  '100.100.100.200',       // Alibaba
];

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

/**
 * Checks if an IP is private, loopback, or link-local per RFC 1918 / 3927 / 4193.
 */
export function isPrivateIp(ip: string): boolean {
  if (!isIP(ip)) return false;

  // IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
    const [a, b] = parts as [number, number, number, number];
    if (a === 10) return true;                                  // 10.0.0.0/8
    if (a === 127) return true;                                 // loopback
    if (a === 172 && b >= 16 && b <= 31) return true;           // 172.16.0.0/12
    if (a === 192 && b === 168) return true;                    // 192.168.0.0/16
    if (a === 169 && b === 254) return true;                    // link-local
    if (a === 100 && b >= 64 && b <= 127) return true;          // CGN 100.64.0.0/10
    if (a === 0) return true;                                   // 0.0.0.0/8
    return false;
  }

  // IPv6 — coarse checks
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;                              // loopback
  if (lower.startsWith('fe80:')) return true;                   // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
  if (lower.startsWith('::ffff:')) {
    const mapped = lower.slice('::ffff:'.length);
    return isPrivateIp(mapped);
  }
  return false;
}

export async function validateUrl(rawUrl: string, options: URLGuardOptions = {}): Promise<URLGuardResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: 'URL is malformed' };
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return { allowed: false, reason: `Scheme not allowed: ${parsed.protocol}`, parsedUrl: parsed };
  }

  const hostname = parsed.hostname.toLowerCase();

  for (const blocked of BLOCKED_METADATA_HOSTS) {
    if (hostname === blocked || hostname.endsWith(`.${blocked}`)) {
      return { allowed: false, reason: `Blocked cloud metadata host: ${hostname}`, parsedUrl: parsed };
    }
  }

  if (options.blockedHosts) {
    for (const b of options.blockedHosts) {
      if (hostname === b || hostname.endsWith(`.${b}`)) {
        return { allowed: false, reason: `Host in blocklist: ${hostname}`, parsedUrl: parsed };
      }
    }
  }

  if (options.allowedHosts && options.allowedHosts.length > 0) {
    const ok = options.allowedHosts.some((a) => hostname === a || hostname.endsWith(`.${a}`));
    if (!ok) {
      return { allowed: false, reason: `Host not in allowlist: ${hostname}`, parsedUrl: parsed };
    }
  }

  // Resolve to an IP and re-check. This defeats DNS rebinding: an attacker's
  // host could resolve to 1.2.3.4 at fetch time but 127.0.0.1 at the second
  // resolution — we pin to the first lookup and reject if private.
  let resolvedIp: string | undefined;
  if (isIP(hostname)) {
    resolvedIp = hostname;
  } else {
    try {
      const records = await dns.lookup(hostname, { all: false });
      resolvedIp = records.address;
    } catch (err) {
      return { allowed: false, reason: `DNS lookup failed: ${(err as Error).message}`, parsedUrl: parsed };
    }
  }

  if (resolvedIp && isPrivateIp(resolvedIp) && !options.allowPrivateNetworks) {
    return {
      allowed: false,
      reason: `Resolved IP ${resolvedIp} is private/loopback/link-local`,
      resolvedIp,
      parsedUrl: parsed,
    };
  }

  return { allowed: true, resolvedIp, parsedUrl: parsed };
}
