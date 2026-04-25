import { buildCapabilityRoadmap } from './capability-roadmap.js';
import * as deliveryJobOps from './delivery-job-operations.js';
import * as executionFabricOps from './execution-fabric-operations.js';
import * as packaging from './delivery-packaging.js';
import * as lifecycle from './project-lifecycle.js';
import * as scheduler from './schedule-worker.js';
import { sdkManifest } from './sdk-manifest.js';
import * as workspaceRuntime from './workspace-runtime.js';
import type {
  AgentProject,
  AgentProjectBrowserEvidenceInput,
  AgentProjectCapabilityRoadmap,
  AgentProjectCommandRun,
  AgentProjectCommandRunInput,
  AgentProjectDeliveryJob,
  AgentProjectDeliveryJobInput,
  AgentProjectDeliveryPack,
  AgentProjectDispatchInput,
  AgentProjectDispatchReport,
  AgentProjectExecution,
  AgentProjectExecutionFabricJob,
  AgentProjectExecutionFabricJobInput,
  AgentProjectExecutionFabricPlan,
  AgentProjectExecutionFabricPlanInput,
  AgentProjectFromTemplateInput,
  AgentProjectHookRun,
  AgentProjectHookRunInput,
  AgentProjectInput,
  AgentProjectLaunchInput,
  AgentProjectOperationEventTail,
  AgentProjectPullRequestPackage,
  AgentProjectPullRequestPackageInput,
  AgentProjectRun,
  AgentProjectRunInput,
  AgentProjectRunRecap,
  AgentProjectRuntimeProfile,
  AgentProjectRuntimeProfileInput,
  AgentProjectSchedule,
  AgentProjectScheduleInput,
  AgentProjectSdkManifest,
  AgentProjectTemplate,
  AgentProjectWorkerStatus,
  AgentProjectWorkspacePlan,
} from './types.js';

export class AgentProjectsService {
  listTemplates(): AgentProjectTemplate[] {
    return lifecycle.listTemplates();
  }

  createProjectFromTemplate(input: AgentProjectFromTemplateInput): AgentProject {
    return lifecycle.createProjectFromTemplate(input);
  }

  listProjects(): AgentProject[] {
    return lifecycle.listProjects();
  }

  getProject(id: string): AgentProject | undefined {
    return lifecycle.getProject(id);
  }

  createProject(input: AgentProjectInput): AgentProject {
    return lifecycle.createProject(input);
  }

  listRuns(projectId?: string): AgentProjectRun[] {
    return lifecycle.listRuns(projectId);
  }

  createRun(input: AgentProjectRunInput): AgentProjectRun {
    return lifecycle.createRun(input);
  }

  listSchedules(projectId?: string): AgentProjectSchedule[] {
    return lifecycle.listSchedules(projectId);
  }

  createSchedule(input: AgentProjectScheduleInput): AgentProjectSchedule {
    return lifecycle.createSchedule(input);
  }

  listWorkspacePlans(runId?: string): AgentProjectWorkspacePlan[] {
    return workspaceRuntime.listWorkspacePlans(runId);
  }

  prepareWorkspacePlan(runId: string): AgentProjectWorkspacePlan {
    return workspaceRuntime.prepareWorkspacePlan(runId);
  }

  listExecutions(runId?: string): AgentProjectExecution[] {
    return workspaceRuntime.listExecutions(runId);
  }

  async launchRun(input: AgentProjectLaunchInput): Promise<AgentProjectExecution> {
    return workspaceRuntime.launchRun(input);
  }

  async runExecutionCommand(input: AgentProjectCommandRunInput): Promise<AgentProjectCommandRun> {
    return workspaceRuntime.runExecutionCommand(input);
  }

  async createBrowserEvidence(input: AgentProjectBrowserEvidenceInput) {
    return workspaceRuntime.createBrowserEvidence(input);
  }

  async dispatchDueSchedules(input: AgentProjectDispatchInput = {}): Promise<AgentProjectDispatchReport> {
    return scheduler.dispatchDueSchedules(input, this.scheduleRuntime());
  }

  async tickWorker(input: AgentProjectDispatchInput = {}): Promise<AgentProjectDispatchReport> {
    return scheduler.tickWorker(input, this.scheduleRuntime());
  }

  startWorker(input: { intervalMs?: number } = {}): AgentProjectWorkerStatus {
    return scheduler.startWorker(input, this.scheduleRuntime());
  }

  stopWorker(): AgentProjectWorkerStatus {
    return scheduler.stopWorker();
  }

  workerStatus(): AgentProjectWorkerStatus {
    return scheduler.getWorkerStatus();
  }

  createRunRecap(runId: string): AgentProjectRunRecap {
    return packaging.createRunRecap(runId, this.packagingRuntime());
  }

  createDeliveryPack(executionId: string): AgentProjectDeliveryPack {
    return packaging.createDeliveryPack(executionId);
  }

  listDeliveryJobs(runId?: string): AgentProjectDeliveryJob[] {
    return deliveryJobOps.listDeliveryJobs(runId);
  }

  getDeliveryJob(id: string): AgentProjectDeliveryJob | undefined {
    return deliveryJobOps.getDeliveryJob(id);
  }

  tailDeliveryJobEvents(jobId: string, afterId?: string, limit?: number): AgentProjectOperationEventTail | undefined {
    return deliveryJobOps.tailDeliveryJobEvents(jobId, afterId, limit);
  }

  heartbeatDeliveryJob(
    jobId: string,
    input: { leaseOwner?: string; progress?: number; stageId?: string; message?: string },
  ): AgentProjectDeliveryJob {
    return deliveryJobOps.heartbeatDeliveryJob(jobId, input);
  }

  queueDeliveryJob(input: AgentProjectDeliveryJobInput): AgentProjectDeliveryJob {
    return deliveryJobOps.queueDeliveryJob(input);
  }

  async runDeliveryJob(jobId: string): Promise<AgentProjectDeliveryJob> {
    return deliveryJobOps.runDeliveryJob(jobId, this.deliveryJobRuntime());
  }

  cancelDeliveryJob(jobId: string): AgentProjectDeliveryJob {
    return deliveryJobOps.cancelDeliveryJob(jobId);
  }

  retryDeliveryJob(jobId: string): AgentProjectDeliveryJob {
    return deliveryJobOps.retryDeliveryJob(jobId);
  }

  listRuntimeProfiles(projectId?: string): AgentProjectRuntimeProfile[] {
    return packaging.listRuntimeProfiles(projectId);
  }

  createRuntimeProfile(input: AgentProjectRuntimeProfileInput): AgentProjectRuntimeProfile {
    return packaging.createRuntimeProfile(input);
  }

  runHooks(input: AgentProjectHookRunInput): AgentProjectHookRun {
    return packaging.runHooks(input);
  }

  createPullRequestPackage(input: AgentProjectPullRequestPackageInput): AgentProjectPullRequestPackage {
    return packaging.createPullRequestPackage(input, this.packagingRuntime());
  }

  listExecutionFabricPlans(runId?: string): AgentProjectExecutionFabricPlan[] {
    return executionFabricOps.listExecutionFabricPlans(runId);
  }

  getExecutionFabricPlan(id: string): AgentProjectExecutionFabricPlan | undefined {
    return executionFabricOps.getExecutionFabricPlan(id);
  }

  listExecutionFabricJobs(planId?: string): AgentProjectExecutionFabricJob[] {
    return executionFabricOps.listExecutionFabricJobs(planId);
  }

  getExecutionFabricJob(id: string): AgentProjectExecutionFabricJob | undefined {
    return executionFabricOps.getExecutionFabricJob(id);
  }

  tailExecutionFabricJobEvents(jobId: string, afterId?: string, limit?: number): AgentProjectOperationEventTail | undefined {
    return executionFabricOps.tailExecutionFabricJobEvents(jobId, afterId, limit);
  }

  heartbeatExecutionFabricJob(
    jobId: string,
    input: { leaseOwner?: string; progress?: number; stageId?: string; message?: string },
  ): AgentProjectExecutionFabricJob {
    return executionFabricOps.heartbeatExecutionFabricJob(jobId, input);
  }

  createExecutionFabricPlan(input: AgentProjectExecutionFabricPlanInput): AgentProjectExecutionFabricPlan {
    return executionFabricOps.createExecutionFabricPlan(input, this.executionFabricRuntime());
  }

  async runExecutionFabricJob(input: AgentProjectExecutionFabricJobInput): Promise<AgentProjectExecutionFabricJob> {
    return executionFabricOps.runExecutionFabricJob(input, this.executionFabricRuntime());
  }

  sdkManifest(apiBase = '/api/v1'): AgentProjectSdkManifest {
    return sdkManifest(apiBase);
  }

  capabilityRoadmap(): AgentProjectCapabilityRoadmap {
    return buildCapabilityRoadmap();
  }

  private scheduleRuntime(): scheduler.ScheduleRuntime {
    return {
      createRun: (input) => this.createRun(input),
      launchRun: (input) => this.launchRun(input),
    };
  }

  private packagingRuntime(): packaging.PackagingRuntime {
    return {
      listExecutions: (runId) => this.listExecutions(runId),
      listWorkspacePlans: (runId) => this.listWorkspacePlans(runId),
    };
  }

  private deliveryJobRuntime(): deliveryJobOps.DeliveryJobRuntime {
    return {
      prepareWorkspacePlan: (runId) => this.prepareWorkspacePlan(runId),
      launchRun: (input) => this.launchRun(input),
      runExecutionCommand: (input) => this.runExecutionCommand(input),
      createBrowserEvidence: (input) => this.createBrowserEvidence(input),
      createDeliveryPack: (executionId) => this.createDeliveryPack(executionId),
    };
  }

  private executionFabricRuntime(): executionFabricOps.ExecutionFabricRuntime {
    return {
      listExecutions: (runId) => this.listExecutions(runId),
      listWorkspacePlans: (runId) => this.listWorkspacePlans(runId),
      prepareWorkspacePlan: (runId) => this.prepareWorkspacePlan(runId),
      launchRun: (input) => this.launchRun(input),
      runExecutionCommand: (input) => this.runExecutionCommand(input),
      createPullRequestPackage: (input) => this.createPullRequestPackage(input),
    };
  }
}

export const agentProjects = new AgentProjectsService();
