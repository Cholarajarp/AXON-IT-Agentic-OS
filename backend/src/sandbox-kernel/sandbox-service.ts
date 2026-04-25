import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type {
  SandboxCommandRisk,
  SandboxExecution,
  SandboxExecutionInput,
  SandboxSession,
  SandboxSessionInput,
  SandboxSnapshot,
} from './types.js';

const sessions = new Map<string, SandboxSession>();
const maxOutputChars = 24_000;

export class SandboxKernelService {
  listSessions(): SandboxSession[] {
    expireOldSessions();
    return Array.from(sessions.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getSession(id: string): SandboxSession | undefined {
    expireOldSessions();
    return sessions.get(id);
  }

  async createSession(input: SandboxSessionInput): Promise<SandboxSession> {
    const workspacePath = resolveWorkspaceRoot(input.workspacePath);
    const id = `sbx_${nanoid(10)}`;
    const ttlMinutes = input.ttlMinutes ?? 60;
    const sandboxPath = path.join(workspacePath, '.axon', 'sandboxes', id);
    await mkdir(sandboxPath, { recursive: true });
    await writeFile(
      path.join(sandboxPath, 'README.sandbox.md'),
      `# ${input.name ?? 'AXON sandbox'}\n\nGoal: ${input.goal}\n\nThis directory is an isolated execution workspace for command, test, and browser evidence.\n`,
      'utf8',
    );

    const createdAt = new Date().toISOString();
    const session: SandboxSession = {
      id,
      tenantId: input.tenantId ?? 'tenant_default',
      name: input.name?.trim() || inferName(input.goal),
      goal: input.goal.trim(),
      provider: input.provider ?? 'local-process',
      status: 'ready',
      workspacePath,
      sandboxPath,
      networkPolicy: input.networkPolicy ?? 'offline',
      resourceLimits: {
        cpu: input.cpuLimit ?? '1',
        memoryMb: input.memoryMb ?? 1024,
        ttlMinutes,
      },
      executions: [],
      snapshots: [],
      evidence: ['sandbox session created', `network policy ${input.networkPolicy ?? 'offline'}`, `ttl ${ttlMinutes} minutes`],
      createdAt,
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000).toISOString(),
      updatedAt: createdAt,
    };

    sessions.set(session.id, session);
    return session;
  }

  async execute(sessionId: string, input: SandboxExecutionInput): Promise<SandboxExecution | undefined> {
    const session = this.getSession(sessionId);
    if (!session || session.status === 'destroyed' || session.status === 'expired') return undefined;

    const command = input.command.trim();
    const risk = classifyCommand(command);
    if (!input.allowMutation && ['high', 'critical'].includes(risk)) {
      const blocked = buildExecution(command, risk, 'blocked', undefined, '', 'Command requires approval because it can mutate files, install packages, deploy, or delete data.', Date.now());
      session.executions.unshift(blocked);
      session.status = 'blocked';
      session.updatedAt = blocked.finishedAt;
      session.evidence.unshift(`blocked command ${blocked.id} ${risk}`);
      return blocked;
    }

    session.status = 'running';
    session.updatedAt = new Date().toISOString();
    const started = Date.now();
    const cwd = resolveWorkingDirectory(session.sandboxPath, input.workingDirectory);
    const execution = await runCommand(command, cwd, input.timeoutMs ?? 15_000, risk, started);
    session.executions.unshift(execution);
    session.status = execution.status === 'passed' ? 'ready' : 'blocked';
    session.updatedAt = execution.finishedAt;
    session.evidence.unshift(`command ${execution.id} ${execution.status} exit=${execution.exitCode ?? 'n/a'}`);
    return execution;
  }

  async snapshot(sessionId: string, label = 'manual snapshot'): Promise<SandboxSnapshot | undefined> {
    const session = this.getSession(sessionId);
    if (!session || session.status === 'destroyed') return undefined;

    const files = await collectFiles(session.sandboxPath, 150);
    const hash = createHash('sha256');
    let totalBytes = 0;
    for (const file of files) {
      totalBytes += file.bytes;
      hash.update(`${file.path}:${file.bytes}:${file.contentHash}\n`);
    }

    const snapshot: SandboxSnapshot = {
      id: `snap_${nanoid(10)}`,
      label,
      fileCount: files.length,
      totalBytes,
      manifestHash: hash.digest('hex'),
      createdAt: new Date().toISOString(),
    };
    session.snapshots.unshift(snapshot);
    session.updatedAt = snapshot.createdAt;
    session.evidence.unshift(`snapshot ${snapshot.id} ${snapshot.fileCount} file(s)`);
    return snapshot;
  }

  async destroy(sessionId: string): Promise<SandboxSession | undefined> {
    const session = sessions.get(sessionId);
    if (!session) return undefined;
    await rm(session.sandboxPath, { recursive: true, force: true }).catch(() => undefined);
    session.status = 'destroyed';
    session.updatedAt = new Date().toISOString();
    session.evidence.unshift('sandbox destroyed');
    return session;
  }
}

function runCommand(command: string, cwd: string, timeoutMs: number, risk: SandboxCommandRisk, started: number): Promise<SandboxExecution> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let finished = false;
    const child = spawn(command, {
      cwd,
      shell: true,
      windowsHide: true,
      env: {
        ...process.env,
        AXON_SANDBOX: '1',
      },
    });

    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill();
      resolve(buildExecution(command, risk, 'timed-out', undefined, stdout, stderr || `Timed out after ${timeoutMs}ms`, started));
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout = trimOutput(stdout + chunk.toString());
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = trimOutput(stderr + chunk.toString());
    });
    child.on('error', (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve(buildExecution(command, risk, 'failed', undefined, stdout, stderr || error.message, started));
    });
    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve(buildExecution(command, risk, code === 0 ? 'passed' : 'failed', code ?? undefined, stdout, stderr, started));
    });
  });
}

function buildExecution(
  command: string,
  risk: SandboxCommandRisk,
  status: SandboxExecution['status'],
  exitCode: number | undefined,
  stdout: string,
  stderr: string,
  started: number,
): SandboxExecution {
  const finished = Date.now();
  return {
    id: `exec_${nanoid(10)}`,
    command,
    risk,
    status,
    exitCode,
    stdout,
    stderr,
    startedAt: new Date(started).toISOString(),
    finishedAt: new Date(finished).toISOString(),
    durationMs: Math.max(1, finished - started),
    evidence: [
      `command risk ${risk}`,
      `status ${status}`,
      exitCode === undefined ? 'exit code unavailable' : `exit code ${exitCode}`,
    ],
  };
}

function classifyCommand(command: string): SandboxCommandRisk {
  const lower = command.toLowerCase();
  if (/\b(rm\s+-rf|remove-item\b.*-recurse|del\s+\/s|format\b|git\s+reset\s+--hard|drop\s+database|drop\s+table|terraform\s+destroy)\b/.test(lower)) return 'critical';
  if (/\b(npm\s+install|pnpm\s+install|yarn\s+add|pip\s+install|poetry\s+add|git\s+push|kubectl\s+apply|helm\s+upgrade|terraform\s+apply|deploy)\b/.test(lower)) return 'high';
  if (/[>|]{1,2}\s*[^|]|set-content|out-file|new-item|mkdir|copy-item|move-item|git\s+commit/.test(lower)) return 'medium';
  return 'low';
}

function resolveWorkspaceRoot(workspacePath?: string) {
  const cwd = process.cwd();
  const defaultRoot = path.basename(cwd) === 'backend' ? path.resolve(cwd, '..') : cwd;
  if (!workspacePath) return defaultRoot;
  const resolved = path.resolve(workspacePath);
  if (!resolved.startsWith(defaultRoot)) throw new Error('workspacePath must stay inside the AXON workspace');
  return resolved;
}

function resolveWorkingDirectory(sandboxPath: string, workingDirectory?: string) {
  if (!workingDirectory) return sandboxPath;
  const resolved = path.resolve(sandboxPath, workingDirectory);
  if (!resolved.startsWith(sandboxPath)) throw new Error('workingDirectory must stay inside the sandbox');
  return resolved;
}

async function collectFiles(root: string, maxFiles: number) {
  const files: Array<{ path: string; bytes: number; contentHash: string }> = [];
  const visit = async (directory: string) => {
    if (files.length >= maxFiles) return;
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile()) {
        const info = await stat(fullPath);
        if (info.size > 256_000) continue;
        const content = await readFile(fullPath);
        files.push({
          path: path.relative(root, fullPath).replace(/\\/g, '/'),
          bytes: info.size,
          contentHash: createHash('sha256').update(content).digest('hex'),
        });
      }
    }
  };
  await visit(root);
  return files;
}

function expireOldSessions() {
  const now = Date.now();
  for (const session of sessions.values()) {
    if (!['destroyed', 'expired'].includes(session.status) && Date.parse(session.expiresAt) < now) {
      session.status = 'expired';
      session.updatedAt = new Date().toISOString();
    }
  }
}

function trimOutput(value: string) {
  return value.length > maxOutputChars ? value.slice(value.length - maxOutputChars) : value;
}

function inferName(goal: string) {
  const clean = goal.replace(/\s+/g, ' ').trim();
  return clean.length > 54 ? `${clean.slice(0, 51)}...` : clean || 'AXON sandbox';
}

export const sandboxKernel = new SandboxKernelService();
