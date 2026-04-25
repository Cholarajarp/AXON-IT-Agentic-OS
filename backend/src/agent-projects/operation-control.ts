import { nanoid } from 'nanoid';
import type {
  AgentProjectDeliveryJob,
  AgentProjectDeliveryJobEvent,
  AgentProjectExecutionFabricJob,
  AgentProjectExecutionFabricStage,
  AgentProjectOperationControl,
  AgentProjectOperationEventTail,
} from './types.js';

export function deliveryJobStages(includeBrowserEvidence: boolean): AgentProjectDeliveryJob['stages'] {
  return [
    {
      id: 'workspace',
      title: 'Prepare isolated workspace',
      ownerAgent: 'WorkspaceIsolationAgent',
      status: 'pending',
      evidence: [],
      nextAction: 'Create worktree plan and file ownership claims.',
    },
    {
      id: 'execution',
      title: 'Launch governed execution envelope',
      ownerAgent: 'AutonomyRuntimeAgent',
      status: 'pending',
      evidence: [],
      nextAction: 'Attach blackboard, gates, sandbox posture, and artifact manifest.',
    },
    {
      id: 'commands',
      title: 'Run approved validation commands',
      ownerAgent: 'WorkspaceCommandAgent',
      status: 'pending',
      evidence: [],
      nextAction: 'Run only low-risk or explicitly approved commands.',
    },
    {
      id: 'browser-evidence',
      title: 'Capture preview and browser proof',
      ownerAgent: 'BrowserQAAgent',
      status: includeBrowserEvidence ? 'pending' : 'skipped',
      evidence: includeBrowserEvidence ? [] : ['not requested for this job'],
      nextAction: includeBrowserEvidence ? 'Attach screenshot, trace, accessibility, and console evidence.' : undefined,
    },
    {
      id: 'delivery-pack',
      title: 'Package customer delivery evidence',
      ownerAgent: 'DeliveryPackAgent',
      status: 'pending',
      evidence: [],
      nextAction: 'Create release/customer handoff pack.',
    },
  ];
}

const deliveryStageProgress: Record<string, number> = {
  queued: 0,
  workspace: 18,
  execution: 36,
  commands: 58,
  'browser-evidence': 78,
  'delivery-pack': 96,
  cancelled: 0,
};

const executionFabricStageProgress: Record<string, number> = {
  queued: 0,
  preflight: 14,
  secrets: 28,
  approval: 34,
  manifest: 44,
  'provider-run': 66,
  'pull-request': 78,
  deploy: 90,
  evidence: 98,
};

export function createOperationControl(deadlineMinutes: number, maxAttempts = 3): AgentProjectOperationControl {
  const now = Date.now();
  return {
    progress: 0,
    cancelRequested: false,
    deadlineAt: new Date(now + deadlineMinutes * 60_000).toISOString(),
    attempts: 0,
    maxAttempts,
  };
}

export function ensureDeliveryJobOperationalFields(job: AgentProjectDeliveryJob): AgentProjectDeliveryJob {
  job.events ??= [];
  job.control ??= createOperationControl(45);
  normalizeOperationControl(job.control, deriveDeliveryJobProgress(job));
  ensureEventIds(job.events, job.control);
  return job;
}

export function ensureFabricJobOperationalFields(job: AgentProjectExecutionFabricJob): AgentProjectExecutionFabricJob {
  job.events ??= [];
  job.control ??= createOperationControl(job.dryRun ? 15 : 90);
  normalizeOperationControl(job.control, deriveFabricJobProgress(job));
  ensureEventIds(job.events, job.control);
  return job;
}

function normalizeOperationControl(control: AgentProjectOperationControl, fallbackProgress: number) {
  control.progress = clampProgress(Number.isFinite(control.progress) ? control.progress : fallbackProgress);
  control.cancelRequested = Boolean(control.cancelRequested);
  control.attempts = Number.isFinite(control.attempts) ? control.attempts : 0;
  control.maxAttempts = Number.isFinite(control.maxAttempts) && control.maxAttempts > 0 ? control.maxAttempts : 3;
}

function ensureEventIds(events: AgentProjectDeliveryJobEvent[], control: AgentProjectOperationControl) {
  for (const event of events) {
    event.id ??= `evt_${nanoid(10)}`;
  }
  control.lastEventId ??= events[0]?.id;
}

export function buildOperationEventTail(
  subjectId: string,
  subjectType: AgentProjectOperationEventTail['subjectType'],
  control: AgentProjectOperationControl,
  events: AgentProjectDeliveryJobEvent[],
  afterId?: string,
  limit = 50
): AgentProjectOperationEventTail {
  const boundedLimit = Math.min(Math.max(limit, 1), 200);
  const newestFirst = [...events];
  const startIndex = afterId ? newestFirst.findIndex((event) => event.id === afterId) : -1;
  const tail = newestFirst.slice(startIndex >= 0 ? startIndex + 1 : 0, startIndex >= 0 ? startIndex + 1 + boundedLimit : boundedLimit);
  return {
    subjectId,
    subjectType,
    control,
    events: tail,
    nextAfterId: tail[tail.length - 1]?.id,
  };
}

export function leaseOperation(control: AgentProjectOperationControl, owner: string, minutes: number) {
  const now = new Date();
  control.leaseOwner = owner;
  control.leaseToken = `lease_${nanoid(12)}`;
  control.heartbeatAt = now.toISOString();
  control.leaseExpiresAt = new Date(now.getTime() + minutes * 60_000).toISOString();
}

export function touchOperationControl(control: AgentProjectOperationControl, owner?: string, progress?: number) {
  control.heartbeatAt = new Date().toISOString();
  if (owner) control.leaseOwner = owner;
  if (progress !== undefined) control.progress = Math.max(control.progress, clampProgress(progress));
}

export function clearOperationLease(control: AgentProjectOperationControl) {
  control.heartbeatAt = new Date().toISOString();
  control.leaseExpiresAt = control.heartbeatAt;
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function progressForStage(stageId: string, status: string, lookup: Record<string, number>) {
  const target = lookup[stageId] ?? 0;
  if (status === 'running') return Math.max(1, target - 8);
  if (['pass', 'warn', 'skipped', 'block', 'blocked', 'failed'].includes(status)) return target;
  return undefined;
}

function deriveDeliveryJobProgress(job: AgentProjectDeliveryJob) {
  if (job.status === 'completed') return 100;
  return job.stages.reduce((progress, stage) => {
    const stageProgress = progressForStage(stage.id, stage.status, deliveryStageProgress);
    return stageProgress === undefined ? progress : Math.max(progress, stageProgress);
  }, job.status === 'queued' ? 0 : 5);
}

function deriveFabricJobProgress(job: AgentProjectExecutionFabricJob) {
  if (job.status === 'completed') return 100;
  return job.stages.reduce((progress, stage) => {
    const stageProgress = progressForStage(stage.id, stage.status, executionFabricStageProgress);
    return stageProgress === undefined ? progress : Math.max(progress, stageProgress);
  }, job.status === 'queued' ? 0 : 5);
}

function addOperationEvent(
  subject: { events: AgentProjectDeliveryJobEvent[]; updatedAt: string; control: AgentProjectOperationControl },
  level: AgentProjectDeliveryJobEvent['level'],
  message: string,
  evidence?: string[],
  stageId?: string,
  progress?: number,
  at = new Date().toISOString()
) {
  if (progress !== undefined) subject.control.progress = Math.max(subject.control.progress, clampProgress(progress));
  subject.control.heartbeatAt = at;
  const event: AgentProjectDeliveryJobEvent = {
    id: `evt_${nanoid(10)}`,
    at,
    level,
    message,
    stageId,
    progress: subject.control.progress,
    evidence,
  };
  subject.events.unshift(event);
  subject.control.lastEventId = event.id;
  subject.updatedAt = at;
}

export function addJobEvent(
  job: AgentProjectDeliveryJob,
  level: AgentProjectDeliveryJob['events'][number]['level'],
  message: string,
  evidence?: string[],
  stageId?: string,
  progress?: number
) {
  ensureDeliveryJobOperationalFields(job);
  addOperationEvent(job, level, message, evidence, stageId, progress);
}

export function setJobStage(
  job: AgentProjectDeliveryJob,
  stageId: string,
  status: AgentProjectDeliveryJob['stages'][number]['status'],
  evidence: string[],
  nextAction?: string
) {
  ensureDeliveryJobOperationalFields(job);
  const stage = job.stages.find((item) => item.id === stageId);
  if (!stage) return;
  const now = new Date().toISOString();
  stage.status = status;
  stage.evidence = evidence;
  stage.nextAction = nextAction ?? stage.nextAction;
  if (status === 'running' && !stage.startedAt) stage.startedAt = now;
  if (status !== 'running' && status !== 'pending') stage.finishedAt = now;
  const progress = progressForStage(stageId, status, deliveryStageProgress);
  if (progress !== undefined) job.control.progress = Math.max(job.control.progress, progress);
  job.updatedAt = now;
  addOperationEvent(
    job,
    status === 'failed' ? 'error' : ['block', 'warn'].includes(status) ? 'warn' : 'info',
    `${stage.title} ${status}.`,
    evidence,
    stageId,
    progress,
    now
  );
}

export function isStoppedDeliveryJob(job: AgentProjectDeliveryJob): boolean {
  return ['blocked', 'failed', 'cancelled'].includes(job.status);
}

export function isCancelledDeliveryJob(job: AgentProjectDeliveryJob): boolean {
  return job.status === 'cancelled' || Boolean(job.control?.cancelRequested);
}

export function setFabricJobStage(
  job: AgentProjectExecutionFabricJob,
  stageId: string,
  status: AgentProjectExecutionFabricStage['status'],
  evidence: string[],
  nextAction?: string
) {
  ensureFabricJobOperationalFields(job);
  const stage = job.stages.find((item) => item.id === stageId);
  if (!stage) return;
  const now = new Date().toISOString();
  stage.status = status;
  stage.evidence = evidence;
  if (nextAction) stage.action = `${stage.action} Next: ${nextAction}`;
  const progress = progressForStage(stageId, status, executionFabricStageProgress);
  if (progress !== undefined) job.control.progress = Math.max(job.control.progress, progress);
  job.updatedAt = now;
  addFabricJobEvent(
    job,
    status === 'failed' ? 'error' : ['block', 'blocked', 'warn'].includes(status) ? 'warn' : 'info',
    `${stage.title} ${status}.`,
    evidence,
    stageId,
    progress,
    now
  );
}

export function addFabricJobEvent(
  job: AgentProjectExecutionFabricJob,
  level: AgentProjectDeliveryJobEvent['level'],
  message: string,
  evidence?: string[],
  stageId?: string,
  progress?: number,
  at = new Date().toISOString()
) {
  ensureFabricJobOperationalFields(job);
  addOperationEvent(job, level, message, evidence, stageId, progress, at);
}
