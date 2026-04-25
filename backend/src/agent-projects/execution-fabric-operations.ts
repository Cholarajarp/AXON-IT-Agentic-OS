import { nanoid } from 'nanoid';
import { artifactService } from '../artifacts/index.js';
import { modelFinOps } from '../model-finops/index.js';
import { trustLedger } from '../trust-ledger/index.js';
import {
  buildAdapterManifest,
  buildExecutionFabricGates,
  chooseExecutionProvider,
  defaultExecutionBudget,
  estimateDeploymentCost,
  estimateProviderRuntimeCost,
  executionFabricLaunchInstructions,
  executionFabricRollbackPlan,
  executionFabricStages,
  executionFabricTaskTypes,
  requiredExecutionSecrets,
  roundMoney,
  secretAvailable,
  slug,
  submitDeployment,
  submitGitHubPullRequest,
  submitProviderRun,
} from './execution-fabric-runtime.js';
import {
  addFabricJobEvent,
  buildOperationEventTail,
  clearOperationLease,
  createOperationControl,
  ensureFabricJobOperationalFields,
  leaseOperation,
  setFabricJobStage,
  touchOperationControl,
} from './operation-control.js';
import {
  executions,
  executionFabricJobs,
  executionFabricPlans,
  persistExecutionFabricJobs,
  persistExecutionFabricPlans,
  projects,
  runs,
  workspacePlans,
} from './state.js';
import type {
  AgentProject,
  AgentProjectCommandRun,
  AgentProjectCommandRunInput,
  AgentProjectExecution,
  AgentProjectExecutionFabricJob,
  AgentProjectExecutionFabricJobInput,
  AgentProjectExecutionFabricPlan,
  AgentProjectExecutionFabricPlanInput,
  AgentProjectLaunchInput,
  AgentProjectOperationEventTail,
  AgentProjectPullRequestPackage,
  AgentProjectPullRequestPackageInput,
  AgentProjectWorkspacePlan,
} from './types.js';

export interface ExecutionFabricRuntime {
  listExecutions(runId?: string): AgentProjectExecution[];
  listWorkspacePlans(runId?: string): AgentProjectWorkspacePlan[];
  prepareWorkspacePlan(runId: string): AgentProjectWorkspacePlan;
  launchRun(input: AgentProjectLaunchInput): Promise<AgentProjectExecution>;
  runExecutionCommand(input: AgentProjectCommandRunInput): Promise<AgentProjectCommandRun>;
  createPullRequestPackage(input: AgentProjectPullRequestPackageInput): AgentProjectPullRequestPackage;
}

export function listExecutionFabricPlans(runId?: string): AgentProjectExecutionFabricPlan[] {
  return Array.from(executionFabricPlans.values())
    .filter((plan) => !runId || plan.runId === runId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getExecutionFabricPlan(id: string): AgentProjectExecutionFabricPlan | undefined {
  return executionFabricPlans.get(id);
}

export function listExecutionFabricJobs(planId?: string): AgentProjectExecutionFabricJob[] {
  return Array.from(executionFabricJobs.values())
    .map((job) => ensureFabricJobOperationalFields(job))
    .filter((job) => !planId || job.planId === planId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getExecutionFabricJob(id: string): AgentProjectExecutionFabricJob | undefined {
  const job = executionFabricJobs.get(id);
  return job ? ensureFabricJobOperationalFields(job) : undefined;
}

export function tailExecutionFabricJobEvents(
  jobId: string,
  afterId?: string,
  limit?: number,
): AgentProjectOperationEventTail | undefined {
  const job = getExecutionFabricJob(jobId);
  if (!job) return undefined;
  return buildOperationEventTail(job.id, 'execution-fabric-job', job.control, job.events, afterId, limit);
}

export function heartbeatExecutionFabricJob(
  jobId: string,
  input: { leaseOwner?: string; progress?: number; stageId?: string; message?: string },
): AgentProjectExecutionFabricJob {
  const job = getExecutionFabricJob(jobId);
  if (!job) throw new Error('Execution fabric job not found');
  touchOperationControl(job.control, input.leaseOwner, input.progress);
  addFabricJobEvent(
    job,
    'info',
    input.message ?? `Heartbeat from ${input.leaseOwner ?? 'operator'}.`,
    [`status=${job.status}`, `leaseOwner=${job.control.leaseOwner ?? 'unassigned'}`],
    input.stageId ?? 'heartbeat',
    input.progress,
  );
  persistExecutionFabricJobs();
  return job;
}

export function createExecutionFabricPlan(
  input: AgentProjectExecutionFabricPlanInput,
  runtime: ExecutionFabricRuntime,
): AgentProjectExecutionFabricPlan {
  const run = runs.get(input.runId);
  if (!run) throw new Error('Agent project run not found');
  const project = projects.get(run.projectId);
  if (!project) throw new Error('Agent project not found');
  const execution = input.executionId ? executions.get(input.executionId) : runtime.listExecutions(run.id)[0];
  if (input.executionId && !execution) throw new Error('Agent project execution not found');
  const workspacePlan = execution
    ? workspacePlans.get(execution.workspacePlanId) ?? runtime.prepareWorkspacePlan(run.id)
    : runtime.listWorkspacePlans(run.id)[0] ?? runtime.prepareWorkspacePlan(run.id);
  const provider = input.provider ?? chooseExecutionProvider(input.targetEnvironment ?? 'preview', run);
  const targetEnvironment = input.targetEnvironment ?? 'preview';
  const deploymentProvider = input.deploymentProvider ?? (input.requireDeployment ? 'vercel' : 'none');
  const requirePullRequest = input.requirePullRequest ?? targetEnvironment !== 'preview';
  const requireDeployment = input.requireDeployment ?? deploymentProvider !== 'none';
  const maxCostUsd = roundMoney(input.maxCostUsd ?? defaultExecutionBudget(targetEnvironment, provider, requireDeployment));
  const taskTypes = executionFabricTaskTypes(run, requireDeployment);
  const finopsReport = modelFinOps.createReport({
    tenantId: project.tenantId,
    mission: `Execution fabric for ${project.name}: ${run.normalizedPrompt}`,
    taskTypes,
    taskBudgetUsd: maxCostUsd,
    monthlyBudgetUsd: Math.max(maxCostUsd * 40, 100),
    expectedRunsPerMonth: targetEnvironment === 'production' ? 20 : 120,
    risk: targetEnvironment === 'production' || project.securityPreset === 'full-machine' ? 'high' : 'medium',
    sensitivityLevel: targetEnvironment === 'production' ? 'confidential' : 'internal',
    repeatedContext: true,
  });
  const estimatedCostUsd = roundMoney(
    finopsReport.optimized.estimatedRunCostUsd +
      estimateProviderRuntimeCost(provider, targetEnvironment) +
      estimateDeploymentCost(deploymentProvider, targetEnvironment),
  );
  const secretsRequired = requiredExecutionSecrets(provider, deploymentProvider, requirePullRequest, requireDeployment);
  const adapterManifest = buildAdapterManifest({
    project,
    run,
    workspacePlan,
    provider,
    deploymentProvider,
    targetEnvironment,
    allowNetwork: input.allowNetwork ?? requireDeployment,
    requirePullRequest,
    requireDeployment,
  });
  const gates = buildExecutionFabricGates({
    project,
    run,
    execution,
    provider,
    deploymentProvider,
    targetEnvironment,
    estimatedCostUsd,
    maxCostUsd,
    secretsRequired,
    requirePullRequest,
    requireDeployment,
    allowNetwork: input.allowNetwork ?? requireDeployment,
  });
  const status: AgentProjectExecutionFabricPlan['status'] = gates.some((item) => item.status === 'block')
    ? 'blocked'
    : gates.some((item) => item.status === 'warn') || requirePullRequest || requireDeployment || targetEnvironment === 'production'
      ? 'needs-approval'
      : 'ready';
  const planContent = {
    projectId: project.id,
    runId: run.id,
    executionId: execution?.id,
    provider,
    deploymentProvider,
    targetEnvironment,
    status,
    estimatedCostUsd,
    maxCostUsd,
    costPolicy: {
      hardStopUsd: roundMoney(maxCostUsd),
      warnAtUsd: roundMoney(maxCostUsd * 0.8),
      modelFinOpsReportId: finopsReport.id,
      savingsStrategy: [
        'reuse runtime profile, repo map, API specs, database schema, and release policies as cached context',
        'route triage and customer reporting through low-cost models before premium critic passes',
        'escalate to premium or sovereign models only on failed validation, security/database risk, or production gates',
      ],
    },
    secretsRequired,
    adapterManifest,
    gates,
    stages: executionFabricStages(provider, deploymentProvider, requirePullRequest, requireDeployment, gates),
    rollbackPlan: executionFabricRollbackPlan(targetEnvironment, deploymentProvider),
    launchInstructions: executionFabricLaunchInstructions(provider, deploymentProvider, status),
  };
  const artifact = artifactService.put({
    tenantId: project.tenantId,
    kind: 'release-pack',
    name: `${slug(project.name)}-execution-fabric-plan`,
    content: planContent,
    metadata: { source: 'Agent Projects', projectId: project.id, runId: run.id, executionId: execution?.id },
  });
  const plan: AgentProjectExecutionFabricPlan = {
    id: `xfp_${nanoid(10)}`,
    tenantId: project.tenantId,
    createdAt: new Date().toISOString(),
    ...planContent,
    artifactId: artifact.id,
  };
  executionFabricPlans.set(plan.id, plan);
  persistExecutionFabricPlans();
  trustLedger.append({
    tenantId: project.tenantId,
    kind: 'release-manifest',
    actor: 'ExecutionFabricAgent',
    actorType: 'agent',
    subject: `Execution fabric plan ${plan.id}`,
    summary: `Prepared ${provider} execution and ${deploymentProvider} deployment fabric for ${targetEnvironment}; status=${status}, estimatedCost=$${estimatedCostUsd}.`,
    risk: status === 'blocked' ? 'high' : targetEnvironment === 'production' ? 'critical' : 'medium',
    source: 'Agent Projects',
    artifacts: [artifact.uri],
    metadata: { projectId: project.id, runId: run.id, executionFabricPlanId: plan.id, finopsReportId: finopsReport.id },
    controls: ['provider-adapter-contract', 'secret-readiness-gates', 'budget-hard-stop', 'rollback-instructions'],
  });
  return plan;
}

export async function runExecutionFabricJob(
  input: AgentProjectExecutionFabricJobInput,
  runtime: ExecutionFabricRuntime,
): Promise<AgentProjectExecutionFabricJob> {
  const plan = executionFabricPlans.get(input.planId);
  if (!plan) throw new Error('Execution fabric plan not found');
  const run = runs.get(plan.runId);
  if (!run) throw new Error('Agent project run not found');
  const project = projects.get(plan.projectId);
  if (!project) throw new Error('Agent project not found');
  const job = queueExecutionFabricJob(plan, input);

  const blockedGate = plan.gates.find((gateItem) => gateItem.status === 'block');
  if (blockedGate) {
    job.status = 'blocked';
    job.error = blockedGate.nextAction;
    setFabricJobStage(job, 'preflight', 'block', blockedGate.evidence, blockedGate.nextAction);
    return finishExecutionFabricJob(job, plan, project, 'Execution fabric preflight is blocked.');
  }

  const missingSecrets = plan.secretsRequired
    .filter((secret) => secret.required)
    .filter((secret) => !secretAvailable(secret.name, input.providedSecrets));
  if (missingSecrets.length > 0 && !job.dryRun) {
    job.status = 'blocked';
    job.error = `Missing required secret(s): ${missingSecrets.map((secret) => secret.name).join(', ')}`;
    setFabricJobStage(job, 'secrets', 'block', missingSecrets.map((secret) => `${secret.name}: ${secret.purpose}`), 'Add secrets through Settings or provider environment before live execution.');
    return finishExecutionFabricJob(job, plan, project, job.error);
  }

  if (needsApproval(plan, job, input)) {
    job.status = 'blocked';
    job.error = 'Execution fabric plan requires explicit approval.';
    setFabricJobStage(job, 'approval', 'block', ['approval=false'], 'Review cost, secrets, PR, deploy, and rollback gates, then rerun with approval.');
    return finishExecutionFabricJob(job, plan, project, job.error);
  }

  startExecutionFabricJob(job, plan, missingSecrets);

  try {
    await runProviderStage(job, plan, run.id, runtime);
    if (isFailedOrBlocked(job)) return finishExecutionFabricJob(job, plan, project, job.error ?? 'Provider stage did not pass.');

    await runPullRequestStage(job, plan, run.id, runtime);
    if (isFailedOrBlocked(job)) return finishExecutionFabricJob(job, plan, project, job.error ?? 'Pull request stage did not pass.');

    await runDeploymentStage(job, plan);
    if (isFailedOrBlocked(job)) return finishExecutionFabricJob(job, plan, project, job.error ?? 'Deployment stage did not pass.');

    setFabricJobStage(job, 'evidence', 'pass', job.evidence);
    job.status = 'completed';
    job.costSpentUsd = job.costSpentUsd || roundMoney(plan.estimatedCostUsd * 0.05);
    return finishExecutionFabricJob(job, plan, project, 'Execution fabric job completed.');
  } catch (error) {
    job.status = 'failed';
    job.error = (error as Error).message;
    setFabricJobStage(job, 'provider-run', 'failed', [job.error], 'Fix provider runtime failure and retry.');
    return finishExecutionFabricJob(job, plan, project, job.error);
  }
}

function isFailedOrBlocked(job: AgentProjectExecutionFabricJob) {
  return job.status === 'failed' || job.status === 'blocked';
}

function queueExecutionFabricJob(
  plan: AgentProjectExecutionFabricPlan,
  input: AgentProjectExecutionFabricJobInput,
): AgentProjectExecutionFabricJob {
  const now = new Date().toISOString();
  const job: AgentProjectExecutionFabricJob = {
    id: `xfj_${nanoid(10)}`,
    planId: plan.id,
    projectId: plan.projectId,
    runId: plan.runId,
    tenantId: plan.tenantId,
    status: 'queued',
    dryRun: input.dryRun ?? true,
    executionId: plan.executionId,
    costSpentUsd: 0,
    control: createOperationControl((input.dryRun ?? true) ? 15 : 90),
    stages: plan.stages.map((stage) => ({ ...stage, status: 'pending' })),
    events: [{
      id: `evt_${nanoid(10)}`,
      at: now,
      level: 'info',
      message: 'Execution fabric job queued.',
      stageId: 'queued',
      progress: 0,
      evidence: [`fabric plan ${plan.id}`, `provider ${plan.provider}`],
    }],
    evidence: [`fabric plan ${plan.id}`, `provider ${plan.provider}`, `deployment ${plan.deploymentProvider}`],
    createdAt: now,
    updatedAt: now,
  };
  job.control.lastEventId = job.events[0]?.id;
  executionFabricJobs.set(job.id, job);
  persistExecutionFabricJobs();
  return job;
}

function needsApproval(
  plan: AgentProjectExecutionFabricPlan,
  job: AgentProjectExecutionFabricJob,
  input: AgentProjectExecutionFabricJobInput,
) {
  return !job.dryRun && (plan.status === 'needs-approval' || plan.targetEnvironment === 'production') && !input.approved;
}

function startExecutionFabricJob(
  job: AgentProjectExecutionFabricJob,
  plan: AgentProjectExecutionFabricPlan,
  missingSecrets: AgentProjectExecutionFabricPlan['secretsRequired'],
) {
  job.status = 'running';
  job.control.attempts += 1;
  leaseOperation(job.control, 'ExecutionFabricAgent', job.dryRun ? 15 : 45);
  addFabricJobEvent(job, 'info', 'Execution fabric job started.', [`attempt=${job.control.attempts}`], 'preflight', 5);
  setFabricJobStage(job, 'preflight', 'pass', plan.gates.map((gateItem) => `${gateItem.status}: ${gateItem.title}`));
  setFabricJobStage(job, 'secrets', missingSecrets.length ? 'warn' : 'pass', missingSecrets.length ? missingSecrets.map((secret) => `${secret.name} missing for dry-run`) : ['required secrets available or not needed']);
  setFabricJobStage(job, 'manifest', 'pass', [
    `${plan.adapterManifest.kind} manifest generated`,
    ...plan.adapterManifest.files.map((file) => file.path),
  ]);
}

async function runProviderStage(
  job: AgentProjectExecutionFabricJob,
  plan: AgentProjectExecutionFabricPlan,
  runId: string,
  runtime: ExecutionFabricRuntime,
) {
  if (job.dryRun) {
    job.evidence.push('dry-run completed without provider mutation');
    if (plan.adapterManifest.unsupportedReason) job.evidence.push(plan.adapterManifest.unsupportedReason);
    setFabricJobStage(job, 'provider-run', 'skipped', ['dry-run=true'], 'Approve and provide required secrets for a live provider submission.');
    return;
  }
  if (plan.provider === 'local-process') {
    await runLocalProviderStage(job, plan, runId, runtime);
    return;
  }
  const providerResult = await submitProviderRun(plan);
  job.providerRunId = providerResult.externalId;
  job.providerRunUrl = providerResult.url;
  job.costSpentUsd = roundMoney(Math.min(plan.estimatedCostUsd, plan.maxCostUsd) * 0.35);
  job.evidence.push(...providerResult.evidence);
  setFabricJobStage(
    job,
    'provider-run',
    providerResult.status === 'submitted' ? 'pass' : providerResult.status === 'failed' ? 'failed' : 'block',
    providerResult.evidence,
    providerResult.error,
  );
  if (providerResult.status !== 'submitted') {
    job.status = providerResult.status === 'failed' ? 'failed' : 'blocked';
    job.error = providerResult.error ?? `${plan.provider} live submission did not complete.`;
  }
}

async function runLocalProviderStage(
  job: AgentProjectExecutionFabricJob,
  plan: AgentProjectExecutionFabricPlan,
  runId: string,
  runtime: ExecutionFabricRuntime,
) {
  const execution = job.executionId
    ? executions.get(job.executionId)
    : await runtime.launchRun({ runId, autonomyLevel: 'supervised', createSandbox: true });
  if (!execution) throw new Error('Execution envelope could not be prepared');
  job.executionId = execution.id;
  const commandRun = await runtime.runExecutionCommand({
    executionId: execution.id,
    commandIndex: 0,
    approved: true,
    timeoutMs: 60_000,
  });
  job.providerRunId = commandRun.id;
  job.costSpentUsd = roundMoney(Math.min(plan.estimatedCostUsd, plan.maxCostUsd) * 0.2);
  job.evidence.push(`local command ${commandRun.id} ${commandRun.status}`);
  setFabricJobStage(job, 'provider-run', commandRun.status === 'passed' ? 'pass' : 'failed', commandRun.evidence, commandRun.status === 'passed' ? undefined : 'Fix command failure before deploy.');
  if (commandRun.status !== 'passed') {
    job.status = 'failed';
    job.error = `${commandRun.label} ${commandRun.status}`;
  }
}

async function runPullRequestStage(
  job: AgentProjectExecutionFabricJob,
  plan: AgentProjectExecutionFabricPlan,
  runId: string,
  runtime: ExecutionFabricRuntime,
) {
  if (!plan.stages.some((stage) => stage.id === 'pull-request')) return;
  const prPackage = runtime.createPullRequestPackage({ runId, executionId: job.executionId });
  job.evidence.push(`PR package ${prPackage.id}`);
  if (job.dryRun) {
    setFabricJobStage(job, 'pull-request', 'skipped', [`branch ${prPackage.branchName}`, `artifact ${prPackage.artifactId}`], 'Live PR creation requires approval and GitHub credentials.');
    return;
  }
  const prResult = await submitGitHubPullRequest(prPackage);
  if (prResult.url) job.providerRunUrl = prResult.url;
  job.evidence.push(...prResult.evidence);
  setFabricJobStage(
    job,
    'pull-request',
    prResult.status === 'submitted' ? 'pass' : prResult.status === 'failed' ? 'failed' : 'block',
    prResult.evidence,
    prResult.error,
  );
  if (prResult.status !== 'submitted') {
    job.status = prResult.status === 'failed' ? 'failed' : 'blocked';
    job.error = prResult.error ?? 'GitHub PR creation did not complete.';
  }
}

async function runDeploymentStage(
  job: AgentProjectExecutionFabricJob,
  plan: AgentProjectExecutionFabricPlan,
) {
  if (!plan.stages.some((stage) => stage.id === 'deploy')) return;
  if (job.dryRun || plan.deploymentProvider === 'none') {
    setFabricJobStage(job, 'deploy', 'skipped', [`deployment=${plan.deploymentProvider}`], 'Run live deployment with provider credentials after release gates pass.');
    return;
  }
  const deployResult = await submitDeployment(plan);
  job.deploymentUrl = deployResult.url;
  job.costSpentUsd = roundMoney(job.costSpentUsd + Math.min(2.5, plan.estimatedCostUsd * 0.15));
  job.evidence.push(...deployResult.evidence);
  setFabricJobStage(
    job,
    'deploy',
    deployResult.status === 'submitted' ? 'pass' : deployResult.status === 'failed' ? 'failed' : 'block',
    deployResult.evidence,
    deployResult.error,
  );
  if (deployResult.status !== 'submitted') {
    job.status = deployResult.status === 'failed' ? 'failed' : 'blocked';
    job.error = deployResult.error ?? `${plan.deploymentProvider} deployment did not complete.`;
  }
}

function finishExecutionFabricJob(
  job: AgentProjectExecutionFabricJob,
  plan: AgentProjectExecutionFabricPlan,
  project: AgentProject,
  summary: string,
): AgentProjectExecutionFabricJob {
  ensureFabricJobOperationalFields(job);
  clearOperationLease(job.control);
  job.updatedAt = new Date().toISOString();
  addFabricJobEvent(
    job,
    job.status === 'completed' ? 'info' : job.status === 'failed' ? 'error' : 'warn',
    summary,
    [`status=${job.status}`, `costSpentUsd=${job.costSpentUsd}`],
    'evidence',
    job.status === 'completed' ? 100 : undefined,
  );
  const artifact = artifactService.put({
    tenantId: job.tenantId,
    kind: 'release-pack',
    name: `${slug(project.name)}-execution-fabric-job-${job.status}`,
    content: {
      job,
      planId: plan.id,
      evidence: job.evidence,
      stages: job.stages,
      error: job.error,
    },
    metadata: { source: 'Agent Projects', projectId: project.id, runId: job.runId, jobId: job.id },
  });
  job.artifactId = artifact.id;
  executionFabricJobs.set(job.id, job);
  persistExecutionFabricJobs();
  trustLedger.append({
    tenantId: project.tenantId,
    kind: job.status === 'completed' ? 'release-manifest' : 'policy-decision',
    actor: 'ExecutionFabricAgent',
    actorType: 'agent',
    subject: `Execution fabric job ${job.id}`,
    summary,
    risk: job.status === 'completed' ? 'medium' : job.status === 'failed' ? 'high' : 'medium',
    source: 'Agent Projects',
    artifacts: [artifact.uri],
    metadata: {
      projectId: project.id,
      runId: job.runId,
      planId: plan.id,
      jobId: job.id,
      providerRunId: job.providerRunId,
      deploymentUrl: job.deploymentUrl,
    },
    controls: ['durable-execution-fabric-job', 'provider-stage-evidence', 'cost-spend-recording', 'operator-heartbeat'],
  });
  return job;
}
