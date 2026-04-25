import type { ToolHandler } from '../registry.js';
import type { ToolExecutionRequest, ToolExecutionResult, SandboxConfig } from '../types.js';
import { validateUrl } from '../safety/url-guard.js';

/**
 * HTTP tool with SSRF guard.
 *
 * Previous version only checked `sandbox.allowedHosts` if non-empty, meaning
 * any unset sandbox permitted requests to 169.254.169.254 (cloud IMDS),
 * localhost:5432 (Postgres), file:///, gopher://, etc.
 *
 * This version validates every URL through url-guard, which:
 *   - rejects non-http(s) schemes
 *   - blocks cloud metadata hostnames
 *   - resolves DNS and rejects private/loopback/link-local IPs
 *   - enforces allowlist/blocklist when provided
 */

export const httpTool: ToolHandler = {
  definition: {
    name: 'http.request',
    category: 'http',
    description: 'Make outbound HTTP(S) requests with SSRF guarding. Cloud metadata, loopback, and private IPs are rejected by default.',
    parameters: [
      { name: 'url', type: 'string', required: true, description: 'Absolute http(s) URL' },
      { name: 'method', type: 'string', required: false, description: 'GET | POST | PUT | PATCH | DELETE', default: 'GET' },
      { name: 'headers', type: 'object', required: false, description: 'Request headers' },
      { name: 'body', type: 'object', required: false, description: 'Body for POST/PUT/PATCH' },
      { name: 'timeout', type: 'number', required: false, description: 'Request timeout in ms', default: 10000 },
    ],
    requiresApproval: false,
    riskLevel: 'medium',
    timeout: 30000,
  },

  async execute(request: ToolExecutionRequest, sandbox: SandboxConfig): Promise<ToolExecutionResult> {
    const { url, method = 'GET', headers = {}, body, timeout = 10000 } = request.parameters as {
      url: string; method?: string; headers?: Record<string, string>; body?: unknown; timeout?: number;
    };

    if (!url || typeof url !== 'string') {
      return { success: false, output: 'URL parameter is required', durationMs: 0 };
    }

    const guard = await validateUrl(url, {
      allowedHosts: sandbox.allowedHosts,
      allowPrivateNetworks: false,
    });

    if (!guard.allowed) {
      return {
        success: false,
        output: `URL rejected by SSRF guard: ${guard.reason}`,
        durationMs: 0,
        sideEffects: ['blocked_unsafe_url'],
      };
    }

    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.min(timeout, sandbox.maxExecutionTime));

    try {
      // Block hop-by-hop and auth-leaking headers that agents should never forge.
      const sanitizedHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      for (const [k, v] of Object.entries(headers)) {
        const key = k.toLowerCase();
        if (['host', 'content-length', 'cookie'].includes(key)) continue;
        sanitizedHeaders[k] = String(v);
      }

      const fetchOptions: RequestInit = {
        method: method.toUpperCase(),
        headers: sanitizedHeaders,
        signal: controller.signal,
        redirect: 'manual', // prevent redirect-based SSRF
      };

      if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);

      // Defeat redirect-based SSRF: if we got a redirect, reject unless target is also safe.
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location) {
          const redirectGuard = await validateUrl(new URL(location, url).toString(), {
            allowedHosts: sandbox.allowedHosts,
            allowPrivateNetworks: false,
          });
          if (!redirectGuard.allowed) {
            return {
              success: false,
              output: `Redirect target rejected by SSRF guard: ${redirectGuard.reason}`,
              durationMs: Date.now() - start,
              sideEffects: ['blocked_redirect'],
            };
          }
        }
      }

      const responseText = await response.text();
      let responseBody: unknown;
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = responseText;
      }

      return {
        success: response.ok,
        output: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
          resolvedIp: guard.resolvedIp,
        },
        durationMs: Date.now() - start,
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        output: error.name === 'AbortError' ? 'Request timed out' : error.message,
        durationMs: Date.now() - start,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  },
};
