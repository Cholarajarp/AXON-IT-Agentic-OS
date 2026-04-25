import { execFile } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ToolHandler } from '../registry.js';
import type { ToolExecutionRequest, ToolExecutionResult, SandboxConfig } from '../types.js';
import { buildSafeEnv, safeJoin } from '../safety/sandbox-fs.js';

/**
 * Code execution tool — argv-only, env-whitelisted, sandboxed.
 *
 * Previous version:
 *   - Built a command string with interpolated filename + args (injection).
 *   - Used exec() which invoked a shell (metacharacter attacks).
 *   - Forwarded ALL of process.env, leaking ANTHROPIC_API_KEY, DATABASE_URL, etc.
 *
 * This version:
 *   - Uses execFile with a fixed program per language.
 *   - Arguments go through a strict pattern (no shell metachars).
 *   - env is limited to the SAFE_ENV_KEYS whitelist (no API keys leak).
 *   - Filename is sanitized and resolved into the sandbox.
 */

const SAFE_ARG_PATTERN = /^[A-Za-z0-9._\-/=:,@]{1,512}$/;
const SAFE_FILENAME_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export const codeTool: ToolHandler = {
  definition: {
    name: 'code.execute',
    category: 'code',
    description: 'Write and run a single source file in a language runtime with a whitelisted environment.',
    parameters: [
      { name: 'language', type: 'string', required: true, description: 'typescript | javascript | python | bash' },
      { name: 'code', type: 'string', required: true, description: 'Source code to execute' },
      { name: 'filename', type: 'string', required: false, description: 'Sandbox-relative filename (alphanumerics only)' },
      { name: 'args', type: 'array', required: false, description: 'CLI args (no shell metacharacters)' },
    ],
    requiresApproval: true,
    riskLevel: 'high',
    timeout: 60000,
  },

  async execute(request: ToolExecutionRequest, sandbox: SandboxConfig): Promise<ToolExecutionResult> {
    const { language, code, filename, args = [] } = request.parameters as {
      language: string; code: string; filename?: string; args?: string[];
    };

    if (!code || typeof code !== 'string') {
      return { success: false, output: 'Code parameter is required', durationMs: 0 };
    }
    if (code.length > 256 * 1024) {
      return { success: false, output: 'Code exceeds 256KB limit', durationMs: 0 };
    }

    const argList = Array.isArray(args) ? args.map(String) : [];
    for (const a of argList) {
      if (!SAFE_ARG_PATTERN.test(a)) {
        return { success: false, output: `Argument contains unsafe characters: ${a}`, durationMs: 0 };
      }
    }

    const runners: Record<string, { program: string; buildArgs: (file: string) => string[]; ext: string }> = {
      typescript: { program: 'npx', buildArgs: (f) => ['tsx', f, ...argList], ext: '.ts' },
      javascript: { program: 'node', buildArgs: (f) => [f, ...argList], ext: '.js' },
      python:     { program: 'python3', buildArgs: (f) => [f, ...argList], ext: '.py' },
      bash:       { program: 'bash', buildArgs: (f) => [f, ...argList], ext: '.sh' },
    };

    const runner = runners[language.toLowerCase()];
    if (!runner) {
      return { success: false, output: `Unsupported language: ${language}. Available: ${Object.keys(runners).join(', ')}`, durationMs: 0 };
    }

    const workDir = sandbox.workingDirectory || process.cwd();
    await mkdir(workDir, { recursive: true });

    const fname = filename ?? `script_${Date.now()}${runner.ext}`;
    if (!SAFE_FILENAME_PATTERN.test(fname)) {
      return { success: false, output: 'Unsafe filename', durationMs: 0 };
    }

    let filePath: string;
    try {
      filePath = safeJoin(workDir, fname);
    } catch (err) {
      return { success: false, output: (err as Error).message, durationMs: 0 };
    }

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, code, 'utf-8');

    const start = Date.now();

    return new Promise((resolve) => {
      execFile(runner.program, runner.buildArgs(filePath), {
        cwd: workDir,
        timeout: Math.min(sandbox.maxExecutionTime ?? 60000, 60000),
        maxBuffer: 2 * 1024 * 1024,
        env: buildSafeEnv(sandbox.environmentVariables ?? {}),
        windowsHide: true,
      }, (error, stdout, stderr) => {
        resolve({
          success: !error,
          output: {
            language,
            file: filePath,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: error && 'code' in error && typeof error.code === 'number' ? error.code : 0,
          },
          stdout: stdout || undefined,
          stderr: stderr || undefined,
          exitCode: error && 'code' in error && typeof error.code === 'number' ? error.code : 0,
          durationMs: Date.now() - start,
          artifacts: [{ type: 'file', name: fname, content: code, mimeType: 'text/plain' }],
          sideEffects: ['code_executed'],
        });
      });
    });
  },
};
