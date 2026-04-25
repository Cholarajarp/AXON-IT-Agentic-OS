import { nanoid } from 'nanoid';
import { agentBlackboard } from '../agent-blackboard/index.js';
import { artifactService } from '../artifacts/index.js';
import { browserQa } from '../browser-qa/index.js';
import { sandboxKernel } from '../sandbox-kernel/index.js';
import { trustLedger } from '../trust-ledger/index.js';
import { slug } from './execution-fabric-runtime.js';
import { buildFileClaims, nextActionsForRun } from './run-planning.js';
import { executions, projects, runs, workspacePlans } from './state.js';
import {
  buildExecutionGates,
  buildValidationEvidence,
  buildWorkspaceCommands,
  classifyWorkspaceCommand,
  gate,
  resolveWorkspaceCwd,
  runWorkspaceCommand,
} from './workspace-execution.js';
import type {
  AgentProjectBrowserEvidenceInput,
  AgentProjectCommandRun,
  AgentProjectCommandRunInput,
  AgentProjectExecution,
  AgentProjectLaunchInput,
  AgentProjectWorkspacePlan,
} from './types.js';

export function listWorkspacePlans(runId?: string): AgentProjectWorkspacePlan[] {
  return Array.from(workspacePlans.values())
    .filter((plan) => !runId || plan.runId === runId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function prepareWorkspacePlan(runId: string): AgentProjectWorkspacePlan {
  const run = runs.get(runId);
  if (!run) throw new Error('Agent project run not found');
  const project = projects.get(run.projectId);
  if (!project) throw new Error('Agent project not found');

  const basePath = project.folders.find((folder) => folder.type === 'git-checkout')?.path ?? project.folders[0]?.path ?? '.';
  const branchName = `axon/${slug(project.name)}/${run.id.slice(-6)}`;
  const worktreePath = project.worktreeMode === 'new-worktree' ? `.axon/worktrees/${run.id}` : basePath;
  const fileClaims = buildFileClaims(project, run);
  const commands = buildWorkspaceCommands(project, run, worktreePath, branchName);

  const plan: AgentProjectWorkspacePlan = {
    id: `wsp_${nanoid(10)}`,
    projectId: project.id,
    runId: run.id,
    mode: project.worktreeMode,
    basePath,
    worktreePath,
    branchName,
    commands,
    fileClaims,
    guardrails: [
      'Do not write outside declared project folders.',
      'Create or verify a clean worktree before mutating source files.',
      'Claim files on the blackboard before editing shared modules.',
      'Run typecheck, lint, tests, build, and release gates before marking complete.',
      'Attach command output and artifact hashes to Trust Ledger.',
    ],
    createdAt: new Date().toISOString(),
  };

  workspacePlans.set(plan.id, plan);
  trustLedger.append({
    tenantId: project.tenantId,
    kind: 'policy-decision',
    actor: 'WorkspaceIsolationAgent',
    actorType: 'agent',
    subject: `Workspace plan ${plan.id}`,
    summary: `Prepared ${project.worktreeMode} workspace plan for run ${run.id} with ${fileClaims.length} file claim(s).`,
    risk: project.worktreeMode === 'local' ? 'medium' : 'low',
    source: 'Agent Projects',
    metadata: { projectId: project.id, runId: run.id, workspacePlanId: plan.id, worktreePath },
    controls: ['least-privilege-project-folders', 'file-ownership-claims', 'worktree-isolation'],
  });
  return plan;
}

export function listExecutions(runId?: string): AgentProjectExecution[] {
  return Array.from(executions.values())
    .filter((execution) => !runId || execution.runId === runId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function launchRun(input: AgentProjectLaunchInput): Promise<AgentProjectExecution> {
  const run = runs.get(input.runId);
  if (!run) throw new Error('Agent project run not found');
  const project = projects.get(run.projectId);
  if (!project) throw new Error('Agent project not found');
  if (run.status === 'blocked' || project.readiness.status === 'blocked') {
    throw new Error('Run is blocked by project readiness gates');
  }

  const autonomyLevel = input.autonomyLevel ?? 'supervised';
  const workspacePlan = prepareWorkspacePlan(run.id);
  const board = agentBlackboard.createBoard({
    tenantId: project.tenantId,
    missionId: run.id,
    title: `${project.name} execution board`,
    goal: run.normalizedPrompt,
    ownerAgent: 'DeliveryManagerAgent',
  });

  for (const task of run.taskGroups) {
    agentBlackboard.addEntry(board.id, {
      kind: task.reviewRequired ? 'next-action' : 'decision',
      title: `${task.ownerAgent}: ${task.title}`,
      detail: task.objective,
      agent: task.ownerAgent,
      severity: task.reviewRequired ? 'medium' : 'low',
      evidence: task.artifacts,
    });
  }
  for (const claim of workspacePlan.fileClaims.slice(0, 12)) {
    agentBlackboard.claimFile(board.id, {
      filePath: claim.path,
      agent: claim.ownerAgent,
      reason: claim.reason,
    });
  }

  const sandbox = input.createSandbox
    ? await sandboxKernel.createSession({
        tenantId: project.tenantId,
        name: `${project.name} ${run.command} sandbox`,
        goal: run.normalizedPrompt,
        workspacePath: input.workspacePath,
        provider: 'local-process',
        networkPolicy: run.browserPlan ? 'allowlisted' : 'offline',
        ttlMinutes: 90,
      })
    : undefined;

  const gates = buildExecutionGates(project, run, workspacePlan, autonomyLevel, Boolean(input.requireHumanApproval));
  const status: AgentProjectExecution['status'] = gates.some((gateItem) => gateItem.status === 'block')
    ? 'blocked'
    : autonomyLevel === 'manual'
      ? 'prepared'
      : 'running';

  const artifact = artifactService.put({
    tenantId: project.tenantId,
    kind: 'generic',
    name: `${slug(project.name)}-execution-envelope`,
    content: {
      projectId: project.id,
      runId: run.id,
      autonomyLevel,
      status,
      workspacePlan,
      sandboxSessionId: sandbox?.id,
      blackboardId: board.id,
      gates,
    },
    metadata: { source: 'Agent Projects', projectId: project.id, runId: run.id },
  });

  const now = new Date().toISOString();
  const execution: AgentProjectExecution = {
    id: `apx_${nanoid(10)}`,
    projectId: project.id,
    runId: run.id,
    tenantId: project.tenantId,
    status,
    autonomyLevel,
    sandboxSessionId: sandbox?.id,
    blackboardId: board.id,
    workspacePlanId: workspacePlan.id,
    artifactId: artifact.id,
    gates,
    commandRuns: [],
    evidence: [
      `workspace plan ${workspacePlan.id}`,
      `blackboard ${board.id}`,
      `execution artifact ${artifact.sha256}`,
      ...(sandbox ? [`sandbox session ${sandbox.id}`] : ['sandbox creation skipped by request']),
    ],
    createdAt: now,
    updatedAt: now,
  };

  executions.set(execution.id, execution);
  run.status = status === 'blocked' ? 'review-required' : 'executing';
  run.nextActions = nextActionsForRun({ status: run.status, command: run.command, project });

  trustLedger.append({
    tenantId: project.tenantId,
    kind: 'command-evidence',
    actor: 'AutonomyRuntimeAgent',
    actorType: 'agent',
    subject: `Execution ${execution.id}`,
    summary: `Launched ${autonomyLevel} execution envelope for run ${run.id}; status=${status}.`,
    risk: status === 'blocked' ? 'high' : autonomyLevel === 'production-autopilot' ? 'critical' : 'medium',
    source: 'Agent Projects',
    artifacts: [artifact.uri],
    metadata: { projectId: project.id, runId: run.id, executionId: execution.id, sandboxSessionId: sandbox?.id, blackboardId: board.id },
    controls: ['project-permission-gates', 'blackboard-file-claims', 'artifact-review', 'trust-ledger-evidence'],
  });

  return execution;
}

export async function runExecutionCommand(input: AgentProjectCommandRunInput): Promise<AgentProjectCommandRun> {
  const execution = executions.get(input.executionId);
  if (!execution) throw new Error('Agent project execution not found');
  const workspacePlan = workspacePlans.get(execution.workspacePlanId);
  if (!workspacePlan) throw new Error('Workspace plan not found');
  const project = projects.get(execution.projectId);
  if (!project) throw new Error('Agent project not found');

  const plannedCommand = typeof input.commandIndex === 'number' ? workspacePlan.commands[input.commandIndex] : undefined;
  if (typeof input.commandIndex === 'number' && !plannedCommand) throw new Error('Workspace command not found');

  const label = plannedCommand?.label ?? 'Operator command';
  const commandText = (plannedCommand?.command ?? input.command ?? '').trim();
  if (!commandText) throw new Error('Command is required');

  const risk = plannedCommand?.risk ?? classifyWorkspaceCommand(commandText);
  const requiresApproval = plannedCommand?.requiresApproval || ['medium', 'high', 'critical'].includes(risk);
  const approved = Boolean(input.approved);
  const started = Date.now();

  let result: Omit<AgentProjectCommandRun, 'id' | 'executionId' | 'projectId' | 'runId' | 'label' | 'command' | 'risk' | 'approved' | 'artifactId' | 'evidence'>;
  if (requiresApproval && !approved) {
    result = {
      status: 'blocked',
      stdout: '',
      stderr: 'Command requires approval before execution.',
      durationMs: Math.max(1, Date.now() - started),
      startedAt: new Date(started).toISOString(),
      finishedAt: new Date().toISOString(),
    };
  } else {
    result = await runWorkspaceCommand(commandText, resolveWorkspaceCwd(workspacePlan.basePath), input.timeoutMs ?? 60_000);
  }

  const artifact = artifactService.put({
    tenantId: execution.tenantId,
    kind: 'generic',
    name: `${slug(project.name)}-command-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'run'}`,
    content: {
      executionId: execution.id,
      workspacePlanId: workspacePlan.id,
      label,
      command: commandText,
      risk,
      approved,
      ...result,
    },
    metadata: { source: 'Agent Projects', executionId: execution.id, projectId: project.id, runId: execution.runId },
  });

  const commandRun: AgentProjectCommandRun = {
    id: `cmd_${nanoid(10)}`,
    executionId: execution.id,
    projectId: project.id,
    runId: execution.runId,
    label,
    command: commandText,
    risk,
    approved,
    artifactId: artifact.id,
    evidence: [
      `command ${result.status}`,
      `risk ${risk}`,
      `artifact ${artifact.sha256}`,
      result.exitCode === undefined ? 'exit code unavailable' : `exit code ${result.exitCode}`,
    ],
    ...result,
  };

  execution.commandRuns.unshift(commandRun);
  execution.evidence.unshift(`command ${commandRun.id} ${commandRun.status}`);
  execution.updatedAt = commandRun.finishedAt;
  if (commandRun.status === 'failed' || commandRun.status === 'timed-out') execution.status = 'blocked';
  if (commandRun.status === 'blocked') execution.gates.unshift(gate('command-approval', `Command approval required: ${label}`, 'block', commandRun.evidence, 'Approve the command after reviewing risk and scope.'));

  trustLedger.append({
    tenantId: execution.tenantId,
    kind: 'command-evidence',
    actor: 'WorkspaceCommandAgent',
    actorType: 'agent',
    subject: `Command ${commandRun.id}`,
    summary: `${label} ${commandRun.status} for execution ${execution.id}.`,
    risk: commandRun.status === 'blocked' || risk === 'critical' ? 'high' : risk === 'high' ? 'medium' : 'low',
    source: 'Agent Projects',
    artifacts: [artifact.uri],
    metadata: { projectId: project.id, runId: execution.runId, executionId: execution.id, commandRunId: commandRun.id, status: commandRun.status },
    controls: ['workspace-command-approval', 'command-output-artifact', 'least-privilege-execution'],
  });

  return commandRun;
}

export async function createBrowserEvidence(input: AgentProjectBrowserEvidenceInput) {
  const execution = executions.get(input.executionId);
  if (!execution) throw new Error('Agent project execution not found');
  const run = runs.get(execution.runId);
  if (!run) throw new Error('Agent project run not found');
  const project = projects.get(execution.projectId);
  if (!project) throw new Error('Agent project not found');

  const report = await browserQa.createReport({
    tenantId: execution.tenantId,
    name: `${project.name} project browser evidence`,
    releaseGoal: run.normalizedPrompt,
    targetUrl: input.targetUrl,
    htmlSnapshot: input.htmlSnapshot,
    validationEvidence: buildValidationEvidence(execution.commandRuns),
    journeys: [
      { name: 'Agent project preview loads', path: '/', assertions: ['title', 'main'], critical: true },
      { name: 'Primary action is visible', path: '/', assertions: ['button'], critical: true },
    ],
    deviceProfiles: ['desktop', 'mobile'],
  });

  const artifact = artifactService.put({
    tenantId: execution.tenantId,
    kind: 'browser-trace',
    name: `${slug(project.name)}-browser-evidence`,
    content: { report },
    metadata: { source: 'Agent Projects', executionId: execution.id, browserQaReportId: report.id },
  });

  execution.browserQaReportId = report.id;
  execution.evidence.unshift(`browser QA ${report.id} ${report.status} score=${report.score}`);
  execution.evidence.unshift(`browser artifact ${artifact.sha256}`);
  execution.updatedAt = new Date().toISOString();
  const browserGate = execution.gates.find((item) => item.id === 'browser-evidence');
  if (browserGate) {
    browserGate.status = report.status === 'blocked' ? 'block' : report.status === 'release-ready' ? 'pass' : 'warn';
    browserGate.evidence = report.releaseEvidence;
    browserGate.nextAction = report.nextActions[0] ?? 'Attach Browser QA evidence to Release Command.';
  } else {
    execution.gates.push(gate(
      'browser-evidence',
      'Browser evidence report is attached',
      report.status === 'blocked' ? 'block' : report.status === 'release-ready' ? 'pass' : 'warn',
      report.releaseEvidence,
      report.nextActions[0] ?? 'Attach Browser QA evidence to Release Command.',
    ));
  }

  trustLedger.append({
    tenantId: execution.tenantId,
    kind: 'browser-artifact',
    actor: 'BrowserQAAgent',
    actorType: 'agent',
    subject: `Browser QA ${report.id}`,
    summary: `Browser evidence generated for execution ${execution.id}; status=${report.status}, score=${report.score}.`,
    risk: report.status === 'blocked' ? 'high' : report.status === 'needs-review' ? 'medium' : 'low',
    source: 'Agent Projects',
    artifacts: [artifact.uri],
    metadata: { projectId: project.id, runId: run.id, executionId: execution.id, browserQaReportId: report.id },
    controls: ['browser-evidence-required', 'accessibility-check', 'release-proof'],
  });

  return { report, execution, artifact };
}
