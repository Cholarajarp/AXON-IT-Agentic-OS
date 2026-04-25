import { spawn } from 'node:child_process';
import path from 'node:path';
import type {
  AgentProject,
  AgentProjectAutonomyLevel,
  AgentProjectCommandRun,
  AgentProjectExecutionGate,
  AgentProjectRun,
  AgentProjectWorkspaceCommand,
  AgentProjectWorkspacePlan,
} from '../types.js';

const maxCommandOutputChars = 24_000;

export function buildWorkspaceCommands(
  project: AgentProject,
  run: AgentProjectRun,
  worktreePath: string,
  branchName: string,
): AgentProjectWorkspaceCommand[] {
  const commands: AgentProjectWorkspaceCommand[] = [
    command('Inspect repository status', 'git status --short', 'low', false),
  ];
  if (project.worktreeMode === 'new-worktree') {
    commands.push(command('Create isolated worktree', `git worktree add ${worktreePath} -b ${branchName}`, 'medium', true));
  }
  commands.push(
    command('Typecheck full stack', 'npm run typecheck', 'low', false),
    command('Run unit and route tests', 'npm test -- --run', 'low', false),
    command('Build production frontend', 'npm run build', 'low', false),
    command('Build backend package', 'cd backend && npm run build', 'low', false),
  );
  if (run.browserPlan) {
    commands.push(command('Run browser evidence lane', 'npm run test:e2e', 'medium', true));
  }
  if (/deploy|kubernetes|release|production/i.test(run.normalizedPrompt)) {
    commands.push(command('Prepare release command gate', 'cd backend && npm run typecheck', 'medium', true));
  }
  return commands;
}

export function buildExecutionGates(
  project: AgentProject,
  run: AgentProjectRun,
  workspacePlan: AgentProjectWorkspacePlan,
  autonomyLevel: AgentProjectAutonomyLevel,
  requireHumanApproval: boolean,
): AgentProjectExecutionGate[] {
  const gates: AgentProjectExecutionGate[] = [
    gate('project-readiness', 'Project readiness allows execution', project.readiness.status === 'blocked' ? 'block' : project.readiness.status === 'needs-review' ? 'warn' : 'pass', [
      `score=${project.readiness.score}`,
      ...project.readiness.blockers,
      ...project.readiness.warnings,
    ], 'Fix readiness blockers or explicitly accept warnings.'),
    gate('workspace-isolation', 'Workspace isolation or file claims are prepared', project.worktreeMode === 'new-worktree' ? 'pass' : 'warn', [
      `mode=${workspacePlan.mode}`,
      `claims=${workspacePlan.fileClaims.length}`,
    ], 'Use a new worktree for parallel or long-running agent work.'),
    gate('artifact-review', 'Artifact review gate is enabled', project.reviewPolicy === 'request-review' ? 'pass' : 'warn', [
      `reviewPolicy=${project.reviewPolicy}`,
      `artifacts=${run.artifacts.length}`,
    ], 'Require plan, diff, browser, database, and release artifacts before broad execution.'),
    gate('budget', 'Subagent budget is bounded', run.subagents.reduce((total, agent) => total + agent.budgetUsd, 0) <= 2 ? 'pass' : 'warn', [
      `plannedBudgetUsd=${run.subagents.reduce((total, agent) => total + agent.budgetUsd, 0).toFixed(2)}`,
    ], 'Reduce unnecessary subagents or require FinOps approval.'),
  ];

  if (run.browserPlan) {
    gates.push(gate('browser-evidence', 'Browser evidence lane is declared', 'warn', run.browserPlan.evidence, 'Attach real Playwright/DevTools screenshots, traces, and video before release.'));
  }
  if (requireHumanApproval || autonomyLevel === 'manual' || autonomyLevel === 'production-autopilot') {
    gates.push(gate('human-approval', 'Human approval before mutation or production autonomy', 'block', [
      `autonomy=${autonomyLevel}`,
      `requireHumanApproval=${requireHumanApproval}`,
    ], 'Approve the execution envelope after reviewing workspace plan and gates.'));
  }
  if (project.securityPreset === 'unrestricted') {
    gates.push(gate('unrestricted-permissions', 'Unrestricted permissions are blocked for enterprise delivery', 'block', [
      'securityPreset=unrestricted',
    ], 'Use default, restricted, or full-machine with explicit per-command approval.'));
  }
  return gates;
}

export function buildValidationEvidence(commandRuns: AgentProjectCommandRun[]) {
  const known = commandRuns
    .filter((item) => /typecheck|test|build|e2e/i.test(`${item.label} ${item.command}`))
    .slice(0, 8)
    .map((item) => ({
      kind: inferValidationKind(item.command),
      status: item.status === 'passed' ? 'pass' as const : item.status === 'blocked' ? 'planned' as const : 'fail' as const,
      command: item.command,
      summary: `${item.label} ${item.status}`,
    }));
  return known.length ? known : [{
    kind: 'e2e' as const,
    status: 'planned' as const,
    command: 'npm run test:e2e',
    summary: 'Browser evidence requested before live e2e command execution.',
  }];
}

export function classifyWorkspaceCommand(commandText: string): AgentProjectWorkspaceCommand['risk'] {
  const lower = commandText.toLowerCase();
  if (/\b(rm\s+-rf|remove-item\b.*-recurse|del\s+\/s|format\b|git\s+reset\s+--hard|drop\s+database|drop\s+table|terraform\s+destroy)\b/.test(lower)) return 'critical';
  if (/\b(npm\s+install|pnpm\s+install|yarn\s+add|pip\s+install|poetry\s+add|git\s+push|kubectl\s+apply|helm\s+upgrade|terraform\s+apply|deploy)\b/.test(lower)) return 'high';
  if (/[>|]{1,2}\s*[^|]|set-content|out-file|new-item|mkdir|copy-item|move-item|git\s+commit|git\s+worktree\s+add/.test(lower)) return 'medium';
  return 'low';
}

export function resolveWorkspaceCwd(basePath: string) {
  const cwd = process.cwd();
  const root = path.basename(cwd) === 'backend' ? path.resolve(cwd, '..') : cwd;
  const resolved = path.resolve(root, basePath);
  if (!resolved.startsWith(root)) throw new Error('Workspace command path must stay inside AXON root');
  return resolved;
}

export function runWorkspaceCommand(
  commandText: string,
  cwd: string,
  timeoutMs: number,
): Promise<Omit<AgentProjectCommandRun, 'id' | 'executionId' | 'projectId' | 'runId' | 'label' | 'command' | 'risk' | 'approved' | 'artifactId' | 'evidence'>> {
  return new Promise((resolve) => {
    const started = Date.now();
    let stdout = '';
    let stderr = '';
    let finished = false;
    const child = spawn(commandText, {
      cwd,
      shell: true,
      windowsHide: true,
      env: {
        ...process.env,
        AXON_AGENT_PROJECT_COMMAND: '1',
      },
    });

    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill();
      resolve({
        status: 'timed-out',
        stdout,
        stderr: stderr || `Timed out after ${timeoutMs}ms`,
        durationMs: Math.max(1, Date.now() - started),
        startedAt: new Date(started).toISOString(),
        finishedAt: new Date().toISOString(),
      });
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout = trimCommandOutput(stdout + chunk.toString());
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = trimCommandOutput(stderr + chunk.toString());
    });
    child.on('error', (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve({
        status: 'failed',
        stdout,
        stderr: stderr || error.message,
        durationMs: Math.max(1, Date.now() - started),
        startedAt: new Date(started).toISOString(),
        finishedAt: new Date().toISOString(),
      });
    });
    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve({
        status: code === 0 ? 'passed' : 'failed',
        exitCode: code ?? undefined,
        stdout,
        stderr,
        durationMs: Math.max(1, Date.now() - started),
        startedAt: new Date(started).toISOString(),
        finishedAt: new Date().toISOString(),
      });
    });
  });
}

export function trimCommandOutput(value: string) {
  return value.length > maxCommandOutputChars ? value.slice(value.length - maxCommandOutputChars) : value;
}

export function gate(
  id: string,
  title: string,
  status: AgentProjectExecutionGate['status'],
  evidence: string[],
  nextAction: string,
): AgentProjectExecutionGate {
  return { id, title, status, evidence, nextAction };
}

function command(label: string, value: string, risk: AgentProjectWorkspaceCommand['risk'], requiresApproval: boolean): AgentProjectWorkspaceCommand {
  return { label, command: value, risk, requiresApproval };
}

function inferValidationKind(commandText: string) {
  const lower = commandText.toLowerCase();
  if (lower.includes('typecheck') || lower.includes('tsc')) return 'typecheck' as const;
  if (lower.includes('test:e2e') || lower.includes('playwright')) return 'e2e' as const;
  if (lower.includes('test')) return 'unit' as const;
  if (lower.includes('build')) return 'build' as const;
  if (lower.includes('audit') || lower.includes('security')) return 'security' as const;
  return 'integration' as const;
}
