import { DurableJsonStore } from '../services/durable-json-store.js';
import type {
  AgentProject,
  AgentProjectDeliveryJob,
  AgentProjectDeliveryPack,
  AgentProjectExecution,
  AgentProjectExecutionFabricJob,
  AgentProjectExecutionFabricPlan,
  AgentProjectHookRun,
  AgentProjectPullRequestPackage,
  AgentProjectRun,
  AgentProjectRunRecap,
  AgentProjectRuntimeProfile,
  AgentProjectSchedule,
  AgentProjectWorkerStatus,
  AgentProjectWorkspacePlan,
} from './types.js';

export const projects = new Map<string, AgentProject>();
export const runs = new Map<string, AgentProjectRun>();
export const schedules = new Map<string, AgentProjectSchedule>();
export const workspacePlans = new Map<string, AgentProjectWorkspacePlan>();
export const executions = new Map<string, AgentProjectExecution>();
export const recaps = new Map<string, AgentProjectRunRecap>();
export const deliveryPacks = new Map<string, AgentProjectDeliveryPack>();
export const runtimeProfiles = new Map<string, AgentProjectRuntimeProfile>();
export const hookRuns = new Map<string, AgentProjectHookRun>();
export const pullRequestPackages = new Map<string, AgentProjectPullRequestPackage>();

const executionFabricPlanStore = new DurableJsonStore<Record<string, AgentProjectExecutionFabricPlan>>(
  'agent-projects/execution-fabric-plans.json',
  {},
);
const executionFabricJobStore = new DurableJsonStore<Record<string, AgentProjectExecutionFabricJob>>(
  'agent-projects/execution-fabric-jobs.json',
  {},
);
const deliveryJobStore = new DurableJsonStore<Record<string, AgentProjectDeliveryJob>>(
  'agent-projects/delivery-jobs.json',
  {},
);

export const executionFabricPlans = new Map<string, AgentProjectExecutionFabricPlan>(
  Object.entries(executionFabricPlanStore.read()),
);
export const executionFabricJobs = new Map<string, AgentProjectExecutionFabricJob>(
  Object.entries(executionFabricJobStore.read()),
);
export const deliveryJobs = new Map<string, AgentProjectDeliveryJob>(
  Object.entries(deliveryJobStore.read()),
);

export let workerTimer: ReturnType<typeof setInterval> | undefined;
export const workerStatus: AgentProjectWorkerStatus = {
  running: false,
  intervalMs: 60_000,
  tickCount: 0,
};

export function setWorkerTimer(timer: ReturnType<typeof setInterval> | undefined) {
  workerTimer = timer;
}

export function persistDeliveryJobs() {
  deliveryJobStore.write(Object.fromEntries(deliveryJobs));
}

export function persistExecutionFabricPlans() {
  executionFabricPlanStore.write(Object.fromEntries(executionFabricPlans));
}

export function persistExecutionFabricJobs() {
  executionFabricJobStore.write(Object.fromEntries(executionFabricJobs));
}
