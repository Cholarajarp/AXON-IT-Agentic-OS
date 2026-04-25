import { execFile } from 'node:child_process';
import type { ToolHandler } from '../registry.js';
import type { ToolExecutionRequest, ToolExecutionResult, SandboxConfig } from '../types.js';
import { parseSafeCommand, isProgramAllowed } from '../safety/command-parser.js';
import { buildSafeEnv } from '../safety/sandbox-fs.js';

/**
 * Shell tool — argv execution only.
 *
 * Previous version used `exec(commandString)`, which invokes /bin/sh and is
 * trivially injectable via `;`, `&&`, `|`, `$(...)`, backticks, and redirects.
 *
 * This version:
 *   - Accepts either a raw command string OR a structured { program, args } pair.
 *   - Parses the string with a strict tokenizer that rejects shell metacharacters.
 *   - Uses execFile (no shell interpreter).
 *   - Enforces a program allowlist (ls, cat, git, node, npm, python, etc.).
 *   - Forwards only a whitelisted env (no ANTHROPIC_API_KEY leaking to child).
 */

export const shellTool: ToolHandler = {
  definition: {
    name: 'shell.exec',
    category: 'shell',
    description: 'Execute an allowlisted program with arguments. No shell interpreter; no metacharacters.',
    parameters: [
      { name: 'command', type: 'string', required: false, description: 'Raw command string (will be tokenized; no shell operators)' },
      { name: 'program', type: 'string', required: false, description: 'Structured program name (preferred)' },
      { name: 'args', type: 'array', required: false, description: 'Structured arguments for program' },
      { name: 'cwd', type: 'string', required: false, description: 'Working directory (must stay inside sandbox)' },
      { name: 'env', type: 'object', required: false, description: 'Extra env vars (AXON_* / TASK_* prefixes only)' },
    ],
    requiresApproval: true,
    riskLevel: 'high',
    timeout: 30000,
  },

  async execute(request: ToolExecutionRequest, sandbox: SandboxConfig): Promise<ToolExecutionResult> {
    const { command, program, args, cwd, env } = request.parameters as {
      command?: string;
      program?: string;
      args?: string[];
      cwd?: string;
      env?: Record<string, string>;
    };

    // Resolve the program + argv from whichever form the caller used.
    let resolvedProgram: string;
    let resolvedArgs: string[];

    if (program && typeof program === 'string') {
      resolvedProgram = program;
      resolvedArgs = Array.isArray(args) ? args.map(String) : [];
    } else if (command && typeof command === 'string') {
      const parsed = parseSafeCommand(command);
      if ('error' in parsed) {
        return { success: false, output: parsed.error, durationMs: 0, sideEffects: ['rejected_unsafe_command'] };
      }
      resolvedProgram = parsed.program;
      resolvedArgs = parsed.args;
    } else {
      return { success: false, output: 'Either `program` or `command` is required', durationMs: 0 };
    }

    if (!isProgramAllowed(resolvedProgram)) {
      return {
        success: false,
        output: `Program not in allowlist: ${resolvedProgram}`,
        durationMs: 0,
        sideEffects: ['blocked_unlisted_program'],
      };
    }

    const workDir = cwd && sandbox.workingDirectory && cwd.startsWith(sandbox.workingDirectory)
      ? cwd
      : sandbox.workingDirectory || process.cwd();

    const start = Date.now();
    const timeout = Math.min(sandbox.maxExecutionTime ?? 30000, 30000);

    return new Promise((resolve) => {
      execFile(resolvedProgram, resolvedArgs, {
        cwd: workDir,
        env: buildSafeEnv(env ?? {}),
        timeout,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      }, (error, stdout, stderr) => {
        resolve({
          success: !error,
          output: stdout || stderr || (error?.message ?? 'No output'),
          stdout: stdout || undefined,
          stderr: stderr || undefined,
          exitCode: error && 'code' in error && typeof error.code === 'number' ? error.code : 0,
          durationMs: Date.now() - start,
          sideEffects: ['shell_command_executed'],
        });
      });
    });
  },
};
