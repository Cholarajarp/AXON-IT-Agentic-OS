import { nanoid } from 'nanoid';
import { trustLedger } from '../../trust-ledger/index.js';
import type { BrowserQaReport } from '../../browser-qa/types.js';
import {
  deliveryJobs,
  persistDeliveryJobs,
  projects,
  runs,
} from '../state.js';
import {
  addJobEvent,
  buildOperationEventTail,
  clearOperationLease,
  createOperationControl,
  deliveryJobStages,
  ensureDeliveryJobOperationalFields,
  isCancelledDeliveryJob,
  isStoppedDeliveryJob,
  leaseOperation,
  setJobStage,
  touchOperationControl,
} from '../operation-control.js';
import type {
  AgentProjectBrowserEvidenceInput,
  AgentProjectCommandRun,
  AgentProjectCommandRunInput,
  AgentProjectDeliveryJob,
  AgentProjectDeliveryJobInput,
  AgentProjectDeliveryPack,
  AgentProjectExecution,
  AgentProjectLaunchInput,
  AgentProjectOperationEventTail,
  AgentProjectWorkspacePlan,
} from '../types.js';

export interface DeliveryJobRuntime {
  prepareWorkspacePlan(runId: string): AgentProjectWorkspacePlan;
  launchRun(input: AgentProjectLaunchInput): Promise<AgentProjectExecution>;
  runExecutionCommand(input: AgentProjectCommandRunInput): Promise<AgentProjectCommandRun>;
  createBrowserEvidence(input: AgentProjectBrowserEvidenceInput): Promise<{ report: BrowserQaReport }>;
  createDeliveryPack(executionId: string): AgentProjectDeliveryPack;
}

export function listDeliveryJobs(runId?: string): AgentProjectDeliveryJob[] {
  return Array.from(deliveryJobs.values())
    .map((job) => ensureDeliveryJobOperationalFields(job))
    .filter((job) => !runId || job.runId === runId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getDeliveryJob(id: string): AgentProjectDeliveryJob | undefined {
  const job = deliveryJobs.get(id);
  return job ? ensureDeliveryJobOperationalFields(job) : undefined;
}

export function tailDeliveryJobEvents(
  jobId: string,
  afterId?: string,
  limit?: number,
): AgentProjectOperationEventTail | undefined {
  const job = getDeliveryJob(jobId);
  if (!job) return undefined;
  return buildOperationEventTail(job.id, 'delivery-job', job.control, job.events, afterId, limit);
}

export function heartbeatDeliveryJob(
  jobId: string,
  input: { leaseOwner?: string; progress?: number; stageId?: string; message?: string },
): AgentProjectDeliveryJob {
  const job = getDeliveryJob(jobId);
  if (!job) throw new Error('Agent project delivery job not found');
  touchOperationControl(job.control, input.leaseOwner, input.progress);
  addJobEvent(
    job,
    'info',
    input.message ?? `Heartbeat from ${input.leaseOwner ?? 'operator'}.`,
    [`status=${job.status}`, `leaseOwner=${job.control.leaseOwner ?? 'unassigned'}`],
    input.stageId ?? 'heartbeat',
    input.progress,
  );
  persistDeliveryJobs();
  return job;
}

export function queueDeliveryJob(input: AgentProjectDeliveryJobInput): AgentProjectDeliveryJob {
  const run = runs.get(input.runId);
  if (!run) throw new Error('Agent project run not found');
  const project = projects.get(run.projectId);
  if (!project) throw new Error('Agent project not found');
  const now = new Date().toISOString();
  const autonomyLevel = input.autonomyLevel ?? 'supervised';
  const requireHumanApproval = input.requireHumanApproval ?? (autonomyLevel === 'manual' || autonomyLevel === 'production-autopilot');
  const job: AgentProjectDeliveryJob = {
    id: `job_${nanoid(10)}`,
    projectId: project.id,
    runId: run.id,
    tenantId: project.tenantId,
    status: 'queued',
    autonomyLevel,
    createSandbox: Boolean(input.createSandbox),
    requireHumanApproval,
    executeApprovedCommands: Boolean(input.executeApprovedCommands),
    approvedCommandIndexes: input.approvedCommandIndexes ?? [],
    requireBrowserEvidence: input.requireBrowserEvidence ?? run.browserPlan !== undefined,
    previewUrl: input.previewUrl,
    control: createOperationControl(45),
    stages: deliveryJobStages(run.browserPlan !== undefined || Boolean(input.previewUrl)),
    events: [{
      id: `evt_${nanoid(10)}`,
      at: now,
      level: 'info',
      message: 'Delivery job queued.',
      stageId: 'queued',
      progress: 0,
      evidence: [`run ${run.id}`, `autonomy ${autonomyLevel}`],
    }],
    createdAt: now,
    updatedAt: now,
  };
  job.control.lastEventId = job.events[0]?.id;
  deliveryJobs.set(job.id, job);
  persistDeliveryJobs();
  trustLedger.append({
    tenantId: project.tenantId,
    kind: 'command-evidence',
    actor: 'DeliveryJobAgent',
    actorType: 'agent',
    subject: `Delivery job ${job.id}`,
    summary: `Queued delivery job for run ${run.id} with autonomy=${job.autonomyLevel}.`,
    risk: job.requireHumanApproval || job.autonomyLevel === 'production-autopilot' ? 'high' : 'medium',
    source: 'Agent Projects',
    metadata: { projectId: project.id, runId: run.id, jobId: job.id },
    controls: ['durable-delivery-job', 'stage-gated-execution', 'operator-cancellable'],
  });
  return job;
}

export async function runDeliveryJob(
  jobId: string,
  runtime: DeliveryJobRuntime,
): Promise<AgentProjectDeliveryJob> {
  const job = getDeliveryJob(jobId);
  if (!job) throw new Error('Agent project delivery job not found');
  if (job.status === 'cancelled' || job.status === 'completed') return job;

  job.status = 'running';
  job.error = undefined;
  job.control.attempts += 1;
  leaseOperation(job.control, 'DeliveryJobAgent', 20);
  addJobEvent(job, 'info', 'Delivery job started.', [`attempt=${job.control.attempts}`], 'execution', 5);

  try {
    setJobStage(job, 'workspace', 'running', ['preparing workspace isolation plan']);
    const workspacePlan = runtime.prepareWorkspacePlan(job.runId);
    setJobStage(job, 'workspace', 'pass', [
      `workspace plan ${workspacePlan.id}`,
      `worktree ${workspacePlan.worktreePath}`,
      `commands ${workspacePlan.commands.length}`,
    ]);

    setJobStage(job, 'execution', 'running', ['launching execution envelope']);
    const execution = await runtime.launchRun({
      runId: job.runId,
      autonomyLevel: job.autonomyLevel,
      createSandbox: job.createSandbox,
      requireHumanApproval: job.requireHumanApproval,
    });
    job.executionId = execution.id;
    setJobStage(
      job,
      'execution',
      execution.status === 'blocked' ? 'block' : 'pass',
      [`execution ${execution.id}`, `status ${execution.status}`, ...execution.evidence],
      execution.status === 'blocked' ? 'Review blocked execution gates before continuing.' : undefined,
    );
    if (execution.status === 'blocked') {
      job.status = 'blocked';
      addJobEvent(job, 'warn', 'Execution envelope is blocked by gates.', execution.gates.map((gate) => `${gate.status}: ${gate.title}`), 'execution');
      persistDeliveryJobs();
      return job;
    }

    await runDeliveryJobCommands(job, workspacePlan, runtime);
    if (isStoppedDeliveryJob(job)) {
      persistDeliveryJobs();
      return job;
    }

    await runDeliveryJobBrowserEvidence(job, runtime);
    if (isStoppedDeliveryJob(job)) {
      persistDeliveryJobs();
      return job;
    }

    setJobStage(job, 'delivery-pack', 'running', ['creating release and customer handoff pack']);
    const pack = runtime.createDeliveryPack(job.executionId);
    job.deliveryPackId = pack.id;
    setJobStage(
      job,
      'delivery-pack',
      pack.status === 'blocked' ? 'block' : pack.status === 'needs-review' ? 'warn' : 'pass',
      [`delivery pack ${pack.id}`, `status ${pack.status}`, ...pack.releaseChecklist],
      pack.status === 'blocked' ? 'Resolve blocking release evidence before customer delivery.' : undefined,
    );
    job.status = pack.status === 'blocked' ? 'blocked' : 'completed';
    if (job.status === 'completed') job.control.progress = 100;
    clearOperationLease(job.control);
    addJobEvent(job, job.status === 'completed' ? 'info' : 'warn', `Delivery job ${job.status}.`, [`deliveryPackId=${pack.id}`], 'delivery-pack', job.status === 'completed' ? 100 : undefined);
    persistDeliveryJobs();
    return job;
  } catch (error) {
    job.status = 'failed';
    job.error = (error as Error).message;
    clearOperationLease(job.control);
    addJobEvent(job, 'error', job.error, undefined, 'execution');
    persistDeliveryJobs();
    return job;
  }
}

export function cancelDeliveryJob(jobId: string): AgentProjectDeliveryJob {
  const job = getDeliveryJob(jobId);
  if (!job) throw new Error('Agent project delivery job not found');
  if (job.status !== 'completed') {
    job.status = 'cancelled';
    job.control.cancelRequested = true;
    job.control.cancellationReason = 'Operator cancelled this job.';
    clearOperationLease(job.control);
    addJobEvent(job, 'warn', 'Delivery job cancelled by operator.', ['operator cancellation token set'], 'cancelled');
    for (const stage of job.stages) {
      if (stage.status === 'pending' || stage.status === 'running') {
        stage.status = 'skipped';
        stage.finishedAt = new Date().toISOString();
        stage.nextAction = 'Operator cancelled this job.';
      }
    }
    persistDeliveryJobs();
  }
  return job;
}

export function retryDeliveryJob(jobId: string): AgentProjectDeliveryJob {
  const job = getDeliveryJob(jobId);
  if (!job) throw new Error('Agent project delivery job not found');
  if (job.status === 'running') throw new Error('Cannot retry a running delivery job');
  const attempts = job.control.attempts;
  const maxAttempts = job.control.maxAttempts;
  job.status = 'queued';
  job.error = undefined;
  job.executionId = undefined;
  job.deliveryPackId = undefined;
  job.control = createOperationControl(45, maxAttempts);
  job.control.attempts = attempts;
  job.stages = deliveryJobStages(job.requireBrowserEvidence);
  addJobEvent(job, 'info', 'Delivery job reset for retry.', [`attempts=${attempts}`], 'queued', 0);
  persistDeliveryJobs();
  return job;
}

async function runDeliveryJobCommands(
  job: AgentProjectDeliveryJob,
  workspacePlan: AgentProjectWorkspacePlan,
  runtime: DeliveryJobRuntime,
): Promise<void> {
  if (!job.executeApprovedCommands) {
    setJobStage(job, 'commands', 'skipped', ['operator chose planning/proof mode without command execution'], 'Enable approved command execution after reviewing the workspace plan.');
    addJobEvent(job, 'info', 'Command execution skipped by job policy.');
    return;
  }

  if (job.status === 'cancelled') return;
  const executionId = job.executionId;
  if (!executionId) throw new Error('Delivery job has no execution envelope');
  const approvedIndexes = new Set(job.approvedCommandIndexes);
  const runnableIndexes = workspacePlan.commands
    .map((commandItem, index) => ({ commandItem, index }))
    .filter(({ commandItem, index }) => !commandItem.requiresApproval || approvedIndexes.has(index))
    .map(({ index }) => index);

  if (!runnableIndexes.length) {
    setJobStage(job, 'commands', 'block', ['no command indexes were approved'], 'Approve at least one safe command or continue manually from the execution envelope.');
    job.status = 'blocked';
    addJobEvent(job, 'warn', 'No commands were approved for execution.');
    return;
  }

  setJobStage(job, 'commands', 'running', [`running ${runnableIndexes.length} approved command(s)`]);
  const evidence: string[] = [];
  for (const index of runnableIndexes) {
    if (isCancelledDeliveryJob(job)) return;
    const result = await runtime.runExecutionCommand({
      executionId,
      commandIndex: index,
      approved: true,
      timeoutMs: 120_000,
    });
    evidence.push(`${result.status}: ${result.label} (${result.artifactId})`);
    if (result.status === 'blocked') {
      setJobStage(job, 'commands', 'block', evidence, 'Review command approval gate.');
      job.status = 'blocked';
      return;
    }
    if (result.status === 'failed' || result.status === 'timed-out') {
      setJobStage(job, 'commands', 'failed', evidence, 'Fix command failure and retry the delivery job.');
      job.status = 'failed';
      job.error = `${result.label} ${result.status}`;
      return;
    }
  }
  setJobStage(job, 'commands', 'pass', evidence);
}

async function runDeliveryJobBrowserEvidence(
  job: AgentProjectDeliveryJob,
  runtime: DeliveryJobRuntime,
): Promise<void> {
  if (!job.requireBrowserEvidence && !job.previewUrl) {
    setJobStage(job, 'browser-evidence', 'skipped', ['browser evidence not required for this job']);
    return;
  }

  if (job.status === 'cancelled') return;
  if (!job.executionId) throw new Error('Delivery job has no execution envelope');
  setJobStage(job, 'browser-evidence', 'running', ['creating browser QA evidence']);
  const result = await runtime.createBrowserEvidence({
    executionId: job.executionId,
    targetUrl: job.previewUrl,
    htmlSnapshot: job.previewUrl
      ? undefined
      : '<!doctype html><html lang="en"><head><title>AXON Preview</title></head><body><main><h1>AXON preview evidence</h1><button type="button">Primary action</button></main></body></html>',
  });
  const status = result.report.status === 'blocked' ? 'block' : result.report.status === 'release-ready' ? 'pass' : 'warn';
  setJobStage(
    job,
    'browser-evidence',
    status,
    [`browser report ${result.report.id}`, `score ${result.report.score}`, ...result.report.releaseEvidence],
    status === 'block' ? 'Fix blocked browser QA before release.' : undefined,
  );
  if (status === 'block') job.status = 'blocked';
}
