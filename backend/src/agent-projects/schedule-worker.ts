import { nanoid } from 'nanoid';
import { trustLedger } from '../trust-ledger/index.js';
import { estimateNextRun } from './project-lifecycle.js';
import { projects, schedules, setWorkerTimer, workerStatus, workerTimer } from './state.js';
import type {
  AgentProjectDispatchInput,
  AgentProjectDispatchReport,
  AgentProjectExecution,
  AgentProjectLaunchInput,
  AgentProjectRun,
  AgentProjectRunInput,
  AgentProjectWorkerStatus,
} from './types.js';

export interface ScheduleRuntime {
  createRun(input: AgentProjectRunInput): AgentProjectRun;
  launchRun(input: AgentProjectLaunchInput): Promise<AgentProjectExecution>;
}

export async function dispatchDueSchedules(
  input: AgentProjectDispatchInput = {},
  runtime: ScheduleRuntime,
): Promise<AgentProjectDispatchReport> {
  const nowIso = input.now ? new Date(input.now).toISOString() : new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const due = Array.from(schedules.values())
    .filter((schedule) => schedule.enabled && Date.parse(schedule.nextRunAt) <= nowMs)
    .sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt))
    .slice(0, input.limit ?? 10);

  const createdRunIds: string[] = [];
  const launchedExecutionIds: string[] = [];
  const skipped: AgentProjectDispatchReport['skipped'] = [];

  for (const schedule of due) {
    const project = projects.get(schedule.projectId);
    if (!project) {
      skipped.push({ scheduleId: schedule.id, reason: 'Project missing' });
      continue;
    }
    try {
      const run = runtime.createRun({
        projectId: schedule.projectId,
        prompt: schedule.instruction,
        mode: 'planning',
        requestedCommand: schedule.command,
      });
      createdRunIds.push(run.id);
      schedule.lastRunAt = nowIso;
      schedule.runCount += 1;
      if (/^\d{4}-\d{2}-\d{2}T/.test(schedule.schedule)) {
        schedule.enabled = false;
      } else {
        schedule.nextRunAt = estimateNextRun(schedule.schedule, nowMs + 1000);
      }

      if (input.launch) {
        const execution = await runtime.launchRun({
          runId: run.id,
          autonomyLevel: input.autonomyLevel ?? 'supervised',
          createSandbox: input.createSandbox ?? false,
        });
        launchedExecutionIds.push(execution.id);
      }
    } catch (error) {
      skipped.push({ scheduleId: schedule.id, reason: (error as Error).message });
    }
  }

  const report: AgentProjectDispatchReport = {
    id: `disp_${nanoid(10)}`,
    generatedAt: new Date().toISOString(),
    now: nowIso,
    dueCount: due.length,
    createdRunIds,
    launchedExecutionIds,
    skipped,
    nextWakeAt: nextScheduleWake(),
    evidence: [
      `due schedules ${due.length}`,
      `created runs ${createdRunIds.length}`,
      `launched executions ${launchedExecutionIds.length}`,
      `skipped ${skipped.length}`,
    ],
  };

  trustLedger.append({
    tenantId: 'tenant_default',
    kind: 'command-evidence',
    actor: 'ScheduleDispatchAgent',
    actorType: 'agent',
    subject: `Schedule dispatch ${report.id}`,
    summary: `Dispatched ${createdRunIds.length}/${due.length} due schedule(s) at ${nowIso}.`,
    risk: input.launch ? 'medium' : 'low',
    source: 'Agent Projects',
    metadata: { report },
    controls: ['bounded-schedule-dispatch', 'project-scoped-autonomy', 'ledgered-wakeups'],
  });

  return report;
}

export async function tickWorker(
  input: AgentProjectDispatchInput = {},
  runtime: ScheduleRuntime,
): Promise<AgentProjectDispatchReport> {
  const report = await dispatchDueSchedules({
    launch: true,
    createSandbox: false,
    autonomyLevel: 'supervised',
    limit: 10,
    ...input,
  }, runtime);
  workerStatus.tickCount += 1;
  workerStatus.lastTickAt = report.generatedAt;
  workerStatus.nextWakeAt = report.nextWakeAt;
  workerStatus.lastDispatchReport = report;
  return report;
}

export function startWorker(
  input: { intervalMs?: number } = {},
  runtime: ScheduleRuntime,
): AgentProjectWorkerStatus {
  const intervalMs = Math.max(5_000, Math.min(3_600_000, input.intervalMs ?? workerStatus.intervalMs));
  if (workerTimer) clearInterval(workerTimer);
  workerStatus.running = true;
  workerStatus.intervalMs = intervalMs;
  workerStatus.startedAt = new Date().toISOString();
  workerStatus.stoppedAt = undefined;
  const timer = setInterval(() => {
    tickWorker(undefined, runtime).catch(() => undefined);
  }, intervalMs);
  timer.unref?.();
  setWorkerTimer(timer);
  return getWorkerStatus();
}

export function stopWorker(): AgentProjectWorkerStatus {
  if (workerTimer) clearInterval(workerTimer);
  setWorkerTimer(undefined);
  workerStatus.running = false;
  workerStatus.stoppedAt = new Date().toISOString();
  return getWorkerStatus();
}

export function getWorkerStatus(): AgentProjectWorkerStatus {
  return {
    ...workerStatus,
    nextWakeAt: workerStatus.nextWakeAt ?? nextScheduleWake(),
    lastDispatchReport: workerStatus.lastDispatchReport,
  };
}

function nextScheduleWake(): string | undefined {
  return Array.from(schedules.values())
    .filter((schedule) => schedule.enabled)
    .sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt))[0]?.nextRunAt;
}
