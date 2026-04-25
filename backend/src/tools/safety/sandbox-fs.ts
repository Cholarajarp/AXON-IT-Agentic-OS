/**
 * Sandbox filesystem helpers.
 *
 * Every tool execution gets its own working directory under
 *   <SANDBOX_ROOT>/<tenantId>/<workflowId>/<taskId>
 *
 * This gives us:
 *   - Tenant isolation — one tenant cannot read another's working files.
 *   - Per-task isolation — no cross-contamination between parallel tasks.
 *   - Easy cleanup — the whole task directory can be deleted after use.
 *
 * All paths are resolved and re-checked with startsWith() to defeat traversal.
 */

import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const DEFAULT_SANDBOX_ROOT = process.env.AXON_SANDBOX_ROOT || '/tmp/axon';

export interface SandboxPaths {
  root: string;
  tenantDir: string;
  workflowDir: string;
  taskDir: string;
}

export function sandboxPaths(tenantId: string, workflowId: string, taskId: string): SandboxPaths {
  const safeTenant = sanitizeSegment(tenantId);
  const safeWorkflow = sanitizeSegment(workflowId);
  const safeTask = sanitizeSegment(taskId);

  const root = resolve(DEFAULT_SANDBOX_ROOT);
  const tenantDir = resolve(root, safeTenant);
  const workflowDir = resolve(tenantDir, safeWorkflow);
  const taskDir = resolve(workflowDir, safeTask);

  if (!tenantDir.startsWith(root) || !workflowDir.startsWith(tenantDir) || !taskDir.startsWith(workflowDir)) {
    throw new Error('Sandbox path escape detected');
  }
  return { root, tenantDir, workflowDir, taskDir };
}

export async function ensureSandbox(paths: SandboxPaths): Promise<void> {
  await mkdir(paths.taskDir, { recursive: true });
}

export async function cleanupSandbox(paths: SandboxPaths): Promise<void> {
  try {
    await rm(paths.taskDir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}

/**
 * Resolves a user-supplied path against the sandbox and refuses escapes.
 */
export function safeJoin(base: string, userPath: string): string {
  const resolved = resolve(base, userPath);
  if (!resolved.startsWith(resolve(base))) {
    throw new Error(`Path escape: ${userPath}`);
  }
  return resolved;
}

function sanitizeSegment(segment: string): string {
  // Keep alphanumerics, dashes, underscores, dots. Replace everything else.
  const cleaned = segment.replace(/[^A-Za-z0-9._-]/g, '_');
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw new Error(`Invalid sandbox segment: ${segment}`);
  }
  return cleaned.slice(0, 128);
}

/**
 * Env whitelist — do NOT inherit `process.env` wholesale into child processes.
 * Only these variables are forwarded. This is what prevents code.execute
 * from printing your ANTHROPIC_API_KEY into agent logs.
 */
export const SAFE_ENV_KEYS = new Set([
  'PATH',
  'HOME',
  'LANG',
  'LC_ALL',
  'TZ',
  'NODE_ENV',
  'TMPDIR',
  'TEMP',
  'TMP',
]);

export function buildSafeEnv(extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of SAFE_ENV_KEYS) {
    const v = process.env[key];
    if (typeof v === 'string') env[key] = v;
  }
  // User-supplied extra vars are allowed but keyed so they can't override PATH
  // to a writable directory. Prefix required.
  for (const [k, v] of Object.entries(extra)) {
    if (k.startsWith('AXON_') || k.startsWith('TASK_')) {
      env[k] = v;
    }
  }
  return env;
}
