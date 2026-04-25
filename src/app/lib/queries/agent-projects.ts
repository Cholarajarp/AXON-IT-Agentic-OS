import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { fetchAPI } from '../api-client';
import { defaultQueryOptions } from '../query-options';
import { queryKeys } from '../query-keys';

export type AgentProjectSecurityPreset = 'restricted' | 'default' | 'full-machine' | 'unrestricted';
export type AgentProjectWorktreeMode = 'local' | 'new-worktree';
export type AgentProjectReviewPolicy = 'request-review' | 'always-proceed';
export type AgentProjectSlashCommand = 'goal' | 'grill-me' | 'schedule' | 'browser' | 'none';
export type AgentProjectAutonomyLevel = 'manual' | 'supervised' | 'autonomous' | 'production-autopilot';
export type AgentProjectExecutionProvider =
  | 'local-process'
  | 'docker'
  | 'kubernetes'
  | 'github-actions'
  | 'codespaces'
  | 'e2b'
  | 'daytona'
  | 'firecracker';
export type AgentProjectDeploymentProvider =
  | 'none'
  | 'vercel'
  | 'railway'
  | 'fly'
  | 'render'
  | 'kubernetes'
  | 'aws-ecs'
  | 'gcp-cloud-run'
  | 'azure-container-apps';
export type AgentProjectTargetEnvironment = 'preview' | 'staging' | 'production';

export interface AgentProjectFolder {
  path: string;
  type: 'local-folder' | 'git-checkout' | 'external-context';
  writable: boolean;
  reason: string;
}

export interface AgentProjectTemplate {
  id: string;
  name: string;
  objective: string;
  prompt: string;
  folders: AgentProjectFolder[];
  skills: string[];
  mcpServers: string[];
  securityPreset: AgentProjectSecurityPreset;
  worktreeMode: AgentProjectWorktreeMode;
  reviewPolicy: AgentProjectReviewPolicy;
}

export interface AgentProjectHook {
  id: string;
  event: 'before-tool-call' | 'after-model-response' | 'artifact-review' | 'loop-stop' | 'browser-session';
  action: string;
  policy: string;
  enabled: boolean;
}

export interface AgentProjectPermission {
  scope: string;
  grant: 'read' | 'write' | 'execute' | 'browser' | 'network' | 'secret';
  persistence: 'conversation' | 'project';
  risk: 'low' | 'medium' | 'high' | 'critical';
}

export interface AgentProject {
  id: string;
  tenantId: string;
  name: string;
  objective: string;
  folders: AgentProjectFolder[];
  securityPreset: AgentProjectSecurityPreset;
  worktreeMode: AgentProjectWorktreeMode;
  reviewPolicy: AgentProjectReviewPolicy;
  skills: string[];
  mcpServers: string[];
  hooks: AgentProjectHook[];
  permissions: AgentProjectPermission[];
  readiness: {
    score: number;
    status: 'ready' | 'needs-review' | 'blocked';
    blockers: string[];
    warnings: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface AgentProjectRun {
  id: string;
  projectId: string;
  tenantId: string;
  command: AgentProjectSlashCommand;
  mode: 'planning' | 'fast';
  prompt: string;
  normalizedPrompt: string;
  status: 'planned' | 'review-required' | 'ready-to-execute' | 'executing' | 'completed' | 'blocked';
  summary: string;
  subagents: Array<{
    id: string;
    name: string;
    mission: string;
    contextPolicy: string;
    canRunInParallel: boolean;
    expectedArtifacts: string[];
    budgetUsd: number;
  }>;
  taskGroups: Array<{
    id: string;
    title: string;
    ownerAgent: string;
    objective: string;
    dependsOn: string[];
    artifacts: string[];
    reviewRequired: boolean;
  }>;
  artifacts: Array<{
    id: string;
    kind: string;
    name: string;
    uri: string;
    sha256: string;
    reviewRequired: boolean;
  }>;
  questions: string[];
  browserPlan?: {
    enabled: boolean;
    command: string;
    evidence: string[];
  };
  hookPipeline: AgentProjectHook[];
  nextActions: string[];
  createdAt: string;
}

export interface AgentProjectSchedule {
  id: string;
  projectId: string;
  tenantId: string;
  instruction: string;
  schedule: string;
  timezone: string;
  enabled: boolean;
  nextRunAt: string;
  command: AgentProjectSlashCommand;
  autonomousPlan: string[];
  lastRunAt?: string;
  runCount: number;
  createdAt: string;
}

export interface AgentProjectWorkspacePlan {
  id: string;
  projectId: string;
  runId: string;
  mode: AgentProjectWorktreeMode;
  basePath: string;
  worktreePath: string;
  branchName: string;
  commands: Array<{
    label: string;
    command: string;
    risk: 'low' | 'medium' | 'high' | 'critical';
    requiresApproval: boolean;
  }>;
  fileClaims: Array<{
    path: string;
    ownerAgent: string;
    reason: string;
  }>;
  guardrails: string[];
  createdAt: string;
}

export interface AgentProjectExecution {
  id: string;
  projectId: string;
  runId: string;
  tenantId: string;
  status: 'prepared' | 'running' | 'blocked' | 'completed';
  autonomyLevel: AgentProjectAutonomyLevel;
  sandboxSessionId?: string;
  blackboardId: string;
  workspacePlanId: string;
  artifactId: string;
  browserQaReportId?: string;
  gates: Array<{
    id: string;
    title: string;
    status: 'pass' | 'warn' | 'block';
    evidence: string[];
    nextAction: string;
  }>;
  commandRuns: Array<{
    id: string;
    executionId: string;
    projectId: string;
    runId: string;
    label: string;
    command: string;
    risk: 'low' | 'medium' | 'high' | 'critical';
    approved: boolean;
    status: 'passed' | 'failed' | 'blocked' | 'timed-out';
    exitCode?: number;
    stdout: string;
    stderr: string;
    durationMs: number;
    artifactId: string;
    startedAt: string;
    finishedAt: string;
    evidence: string[];
  }>;
  evidence: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentProjectDispatchReport {
  id: string;
  generatedAt: string;
  now: string;
  dueCount: number;
  createdRunIds: string[];
  launchedExecutionIds: string[];
  skipped: Array<{ scheduleId: string; reason: string }>;
  nextWakeAt?: string;
  evidence: string[];
}

export interface AgentProjectWorkerStatus {
  running: boolean;
  intervalMs: number;
  startedAt?: string;
  stoppedAt?: string;
  lastTickAt?: string;
  tickCount: number;
  nextWakeAt?: string;
  lastDispatchReport?: AgentProjectDispatchReport;
}

export interface AgentProjectRunRecap {
  id: string;
  projectId: string;
  runId: string;
  executionId?: string;
  summary: string;
  decisions: string[];
  openGates: string[];
  artifacts: string[];
  nextActions: string[];
  resumePrompt: string;
  artifactId: string;
  createdAt: string;
}

export interface AgentProjectDeliveryPack {
  id: string;
  projectId: string;
  runId: string;
  executionId: string;
  status: 'ready' | 'needs-review' | 'blocked';
  summary: string;
  commandEvidence: string[];
  browserQaReportId?: string;
  releaseChecklist: string[];
  customerUpdate: string;
  artifactId: string;
  createdAt: string;
}

export interface AgentProjectDeliveryJobEvent {
  id?: string;
  at: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  stageId?: string;
  progress?: number;
  evidence?: string[];
}

export interface AgentProjectOperationControl {
  leaseOwner?: string;
  leaseToken?: string;
  leaseExpiresAt?: string;
  heartbeatAt?: string;
  progress: number;
  cancelRequested: boolean;
  cancellationReason?: string;
  deadlineAt?: string;
  attempts: number;
  maxAttempts: number;
  lastEventId?: string;
}

export interface AgentProjectOperationEventTail {
  subjectId: string;
  subjectType: 'delivery-job' | 'execution-fabric-job';
  control: AgentProjectOperationControl;
  events: AgentProjectDeliveryJobEvent[];
  nextAfterId?: string;
}

export interface AgentProjectDeliveryJob {
  id: string;
  projectId: string;
  runId: string;
  tenantId: string;
  executionId?: string;
  deliveryPackId?: string;
  status: 'queued' | 'running' | 'blocked' | 'completed' | 'failed' | 'cancelled';
  autonomyLevel: AgentProjectAutonomyLevel;
  createSandbox: boolean;
  requireHumanApproval: boolean;
  executeApprovedCommands: boolean;
  approvedCommandIndexes: number[];
  requireBrowserEvidence: boolean;
  previewUrl?: string;
  control: AgentProjectOperationControl;
  stages: Array<{
    id: string;
    title: string;
    ownerAgent: string;
    status: 'pending' | 'running' | 'pass' | 'warn' | 'block' | 'failed' | 'skipped';
    evidence: string[];
    nextAction?: string;
    startedAt?: string;
    finishedAt?: string;
  }>;
  events: AgentProjectDeliveryJobEvent[];
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentProjectRuntimeProfile {
  id: string;
  projectId: string;
  runId?: string;
  tenantId: string;
  generatedAt: string;
  agentFiles: Array<{
    path: string;
    name: string;
    prompt: string;
    tools: string[];
    modelPolicy: string;
    permissions: AgentProjectPermission[];
  }>;
  hookFiles: Array<{
    path: string;
    hookId: string;
    event: AgentProjectHook['event'];
    action: string;
    policy: string;
    blocking: boolean;
  }>;
  mcpConfig: {
    path: string;
    servers: Array<{
      name: string;
      transport: 'stdio' | 'http';
      approvalRequired: boolean;
      tools: string[];
    }>;
  };
  slashCommands: Array<{
    command: AgentProjectSlashCommand;
    description: string;
    promptTemplate: string;
  }>;
  settings: {
    securityPreset: AgentProjectSecurityPreset;
    worktreeMode: AgentProjectWorktreeMode;
    reviewPolicy: AgentProjectReviewPolicy;
    skills: string[];
    folders: AgentProjectFolder[];
  };
  artifactId: string;
}

export interface AgentProjectHookRun {
  id: string;
  projectId: string;
  runId?: string;
  tenantId: string;
  event: AgentProjectHook['event'];
  status: 'passed' | 'blocked' | 'failed' | 'skipped';
  results: Array<{
    hookId: string;
    action: string;
    policy: string;
    status: 'passed' | 'blocked' | 'failed' | 'skipped';
    evidence: string[];
  }>;
  artifactId: string;
  createdAt: string;
}

export interface AgentProjectPullRequestPackage {
  id: string;
  projectId: string;
  runId: string;
  executionId?: string;
  tenantId: string;
  title: string;
  branchName: string;
  summary: string;
  changedFiles: string[];
  testEvidence: string[];
  browserEvidence: string[];
  riskNotes: string[];
  bodyMarkdown: string;
  artifactId: string;
  createdAt: string;
}

export interface AgentProjectExecutionFabricGate {
  id: string;
  title: string;
  status: 'pass' | 'warn' | 'block';
  evidence: string[];
  nextAction: string;
}

export interface AgentProjectExecutionFabricStage {
  id: string;
  title: string;
  provider: string;
  action: string;
  status: 'planned' | 'ready' | 'blocked' | 'block' | 'pending' | 'running' | 'pass' | 'warn' | 'failed' | 'skipped';
  evidence: string[];
}

export interface AgentProjectExecutionFabricPlan {
  id: string;
  projectId: string;
  runId: string;
  executionId?: string;
  tenantId: string;
  provider: AgentProjectExecutionProvider;
  deploymentProvider: AgentProjectDeploymentProvider;
  targetEnvironment: AgentProjectTargetEnvironment;
  status: 'ready' | 'needs-approval' | 'blocked';
  estimatedCostUsd: number;
  maxCostUsd: number;
  costPolicy: {
    hardStopUsd: number;
    warnAtUsd: number;
    modelFinOpsReportId: string;
    savingsStrategy: string[];
  };
  secretsRequired: Array<{
    name: string;
    provider: string;
    purpose: string;
    required: boolean;
  }>;
  adapterManifest: {
    kind: string;
    entrypoint: string;
    environment: Record<string, string>;
    requiredSecrets: string[];
    files: Array<{ path: string; content: string }>;
    unsupportedReason?: string;
  };
  gates: AgentProjectExecutionFabricGate[];
  stages: AgentProjectExecutionFabricStage[];
  rollbackPlan: string[];
  launchInstructions: string[];
  artifactId: string;
  createdAt: string;
}

export interface AgentProjectExecutionFabricJob {
  id: string;
  planId: string;
  projectId: string;
  runId: string;
  tenantId: string;
  status: 'queued' | 'running' | 'blocked' | 'completed' | 'failed';
  dryRun: boolean;
  providerRunId?: string;
  providerRunUrl?: string;
  deploymentUrl?: string;
  executionId?: string;
  costSpentUsd: number;
  control: AgentProjectOperationControl;
  stages: AgentProjectExecutionFabricStage[];
  events: AgentProjectDeliveryJobEvent[];
  evidence: string[];
  artifactId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentProjectSdkManifest {
  id: string;
  generatedAt: string;
  apiBase: string;
  endpoints: Array<{ method: string; path: string; purpose: string }>;
  cliCommands: string[];
  sdkTargets: Array<{ language: 'typescript' | 'python' | 'go'; packageName: string; status: 'planned' | 'ready-contract' }>;
  mcpTools: Array<{ name: string; route: string; approvalRequired: boolean }>;
}

export type AgentProjectCapabilityLevel = 'native' | 'partial' | 'missing' | 'external';

export interface AgentProjectCapabilityRoadmap {
  id: string;
  generatedAt: string;
  position: string;
  readinessScore: number;
  capabilityMatrix: Array<{
    capability: string;
    axonToday: AgentProjectCapabilityLevel;
    axonTarget: AgentProjectCapabilityLevel;
    priority: 'P0' | 'P1' | 'P2';
    evidence: string[];
    nextBuild: string;
  }>;
  finalBuilds: Array<{
    priority: 'P0' | 'P1' | 'P2';
    capability: string;
    ownerAgent: string;
    status: 'implemented' | 'next-hardening';
    shippedEvidence: string[];
    remainingHardening: string[];
  }>;
  nextNonNegotiables: string[];
  internalReferences: string[];
}

/* ============================================================
 * Agent Projects — project-scoped agent command center
 * ============================================================ */

export function useAgentProjectTemplates(options?: Partial<UseQueryOptions<{ templates: AgentProjectTemplate[] }>>) {
  return useQuery({
    queryKey: queryKeys.agentProjectTemplates,
    queryFn: () => fetchAPI<{ templates: AgentProjectTemplate[] }>('/agent-projects/templates'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useAgentProjects(options?: Partial<UseQueryOptions<{ projects: AgentProject[] }>>) {
  return useQuery({
    queryKey: queryKeys.agentProjects,
    queryFn: () => fetchAPI<{ projects: AgentProject[] }>('/agent-projects/projects'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateAgentProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tenantId?: string;
      name: string;
      objective: string;
      folders?: AgentProjectFolder[];
      securityPreset?: AgentProjectSecurityPreset;
      worktreeMode?: AgentProjectWorktreeMode;
      reviewPolicy?: AgentProjectReviewPolicy;
      skills?: string[];
      mcpServers?: string[];
      hooks?: AgentProjectHook[];
      permissions?: AgentProjectPermission[];
    }) =>
      fetchAPI<AgentProject>('/agent-projects/projects', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agentProjects }),
  });
}

export function useCreateAgentProjectFromTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      templateId: string;
      tenantId?: string;
      name?: string;
      objective?: string;
    }) =>
      fetchAPI<AgentProject>('/agent-projects/projects/from-template', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agentProjects }),
  });
}

export function useAgentProjectRuns(options?: Partial<UseQueryOptions<{ runs: AgentProjectRun[] }>>) {
  return useQuery({
    queryKey: queryKeys.agentProjectRuns,
    queryFn: () => fetchAPI<{ runs: AgentProjectRun[] }>('/agent-projects/runs'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateAgentProjectRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      projectId: string;
      prompt: string;
      mode?: 'planning' | 'fast';
      voiceTranscript?: string;
      requestedCommand?: AgentProjectSlashCommand;
    }) =>
      fetchAPI<AgentProjectRun>('/agent-projects/runs', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectRuns }),
  });
}

export function useAgentProjectWorkspacePlans(options?: Partial<UseQueryOptions<{ workspacePlans: AgentProjectWorkspacePlan[] }>>) {
  return useQuery({
    queryKey: queryKeys.agentProjectWorkspacePlans,
    queryFn: () => fetchAPI<{ workspacePlans: AgentProjectWorkspacePlan[] }>('/agent-projects/workspace-plans'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function usePrepareAgentProjectWorkspacePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) =>
      fetchAPI<AgentProjectWorkspacePlan>(`/agent-projects/runs/${encodeURIComponent(runId)}/workspace-plan`, {
        method: 'POST',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectWorkspacePlans }),
  });
}

export function useAgentProjectSchedules(options?: Partial<UseQueryOptions<{ schedules: AgentProjectSchedule[] }>>) {
  return useQuery({
    queryKey: queryKeys.agentProjectSchedules,
    queryFn: () => fetchAPI<{ schedules: AgentProjectSchedule[] }>('/agent-projects/schedules'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateAgentProjectSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      projectId: string;
      instruction: string;
      schedule: string;
      timezone?: string;
      enabled?: boolean;
    }) =>
      fetchAPI<AgentProjectSchedule>('/agent-projects/schedules', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectSchedules }),
  });
}

export function useDispatchAgentProjectSchedules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input?: {
      now?: string;
      limit?: number;
      launch?: boolean;
      createSandbox?: boolean;
      autonomyLevel?: AgentProjectAutonomyLevel;
    }) =>
      fetchAPI<AgentProjectDispatchReport>('/agent-projects/schedules/run-due', {
        method: 'POST',
        body: JSON.stringify(input ?? {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectSchedules });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectRuns });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectExecutions });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectWorkspacePlans });
    },
  });
}

export function useAgentProjectWorkerStatus(options?: Partial<UseQueryOptions<AgentProjectWorkerStatus>>) {
  return useQuery({
    queryKey: queryKeys.agentProjectWorkerStatus,
    queryFn: () => fetchAPI<AgentProjectWorkerStatus>('/agent-projects/worker/status'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useTickAgentProjectWorker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input?: {
      now?: string;
      limit?: number;
      launch?: boolean;
      createSandbox?: boolean;
      autonomyLevel?: AgentProjectAutonomyLevel;
    }) =>
      fetchAPI<AgentProjectDispatchReport>('/agent-projects/worker/tick', {
        method: 'POST',
        body: JSON.stringify(input ?? {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectWorkerStatus });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectSchedules });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectRuns });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectExecutions });
    },
  });
}

export function useStartAgentProjectWorker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input?: { intervalMs?: number }) =>
      fetchAPI<AgentProjectWorkerStatus>('/agent-projects/worker/start', {
        method: 'POST',
        body: JSON.stringify(input ?? {}),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectWorkerStatus }),
  });
}

export function useStopAgentProjectWorker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fetchAPI<AgentProjectWorkerStatus>('/agent-projects/worker/stop', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectWorkerStatus }),
  });
}

export function useAgentProjectExecutions(options?: Partial<UseQueryOptions<{ executions: AgentProjectExecution[] }>>) {
  return useQuery({
    queryKey: queryKeys.agentProjectExecutions,
    queryFn: () => fetchAPI<{ executions: AgentProjectExecution[] }>('/agent-projects/executions'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useAgentProjectDeliveryJobs(options?: Partial<UseQueryOptions<{ jobs: AgentProjectDeliveryJob[] }>>) {
  return useQuery({
    queryKey: queryKeys.agentProjectDeliveryJobs,
    queryFn: () => fetchAPI<{ jobs: AgentProjectDeliveryJob[] }>('/agent-projects/delivery-jobs'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useAgentProjectDeliveryJobEvents(
  jobId?: string,
  options?: Partial<UseQueryOptions<AgentProjectOperationEventTail>>
) {
  return useQuery({
    queryKey: queryKeys.agentProjectDeliveryJobEvents(jobId ?? 'none'),
    queryFn: () => fetchAPI<AgentProjectOperationEventTail>(`/agent-projects/delivery-jobs/${encodeURIComponent(jobId ?? '')}/events`),
    enabled: Boolean(jobId),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useQueueAgentProjectDeliveryJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      runId: string;
      autonomyLevel?: AgentProjectAutonomyLevel;
      createSandbox?: boolean;
      requireHumanApproval?: boolean;
      executeApprovedCommands?: boolean;
      approvedCommandIndexes?: number[];
      requireBrowserEvidence?: boolean;
      previewUrl?: string;
    }) =>
      fetchAPI<AgentProjectDeliveryJob>('/agent-projects/delivery-jobs', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectDeliveryJobs }),
  });
}

export function useRunAgentProjectDeliveryJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) =>
      fetchAPI<AgentProjectDeliveryJob>(`/agent-projects/delivery-jobs/${encodeURIComponent(jobId)}/run`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectDeliveryJobs });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectExecutions });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectWorkspacePlans });
      queryClient.invalidateQueries({ queryKey: queryKeys.browserQaReports });
    },
  });
}

export function useCancelAgentProjectDeliveryJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) =>
      fetchAPI<AgentProjectDeliveryJob>(`/agent-projects/delivery-jobs/${encodeURIComponent(jobId)}/cancel`, {
        method: 'POST',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectDeliveryJobs }),
  });
}

export function useRetryAgentProjectDeliveryJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) =>
      fetchAPI<AgentProjectDeliveryJob>(`/agent-projects/delivery-jobs/${encodeURIComponent(jobId)}/retry`, {
        method: 'POST',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectDeliveryJobs }),
  });
}

export function useHeartbeatAgentProjectDeliveryJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { jobId: string; leaseOwner?: string; progress?: number; stageId?: string; message?: string }) =>
      fetchAPI<AgentProjectDeliveryJob>(`/agent-projects/delivery-jobs/${encodeURIComponent(input.jobId)}/heartbeat`, {
        method: 'POST',
        body: JSON.stringify({
          leaseOwner: input.leaseOwner,
          progress: input.progress,
          stageId: input.stageId,
          message: input.message,
        }),
      }),
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectDeliveryJobs });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectDeliveryJobEvents(input.jobId) });
    },
  });
}

export function useCreateAgentProjectRuntimeProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId: string; runId?: string }) =>
      fetchAPI<AgentProjectRuntimeProfile>(`/agent-projects/projects/${encodeURIComponent(input.projectId)}/runtime-profile`, {
        method: 'POST',
        body: JSON.stringify({ runId: input.runId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectSdkManifest }),
  });
}

export function useRunAgentProjectHooks() {
  return useMutation({
    mutationFn: (input: {
      projectId: string;
      runId?: string;
      event: AgentProjectHook['event'];
      approved?: boolean;
      payload?: Record<string, unknown>;
    }) =>
      fetchAPI<AgentProjectHookRun>('/agent-projects/hooks/run', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

export function useCreateAgentProjectPullRequestPackage() {
  return useMutation({
    mutationFn: (input: { runId: string; executionId?: string }) =>
      fetchAPI<AgentProjectPullRequestPackage>(`/agent-projects/runs/${encodeURIComponent(input.runId)}/pr-package`, {
        method: 'POST',
        body: JSON.stringify({ executionId: input.executionId }),
      }),
  });
}

export function useAgentProjectExecutionFabricPlans(options?: Partial<UseQueryOptions<{ plans: AgentProjectExecutionFabricPlan[] }>>) {
  return useQuery({
    queryKey: queryKeys.agentProjectExecutionFabricPlans,
    queryFn: () => fetchAPI<{ plans: AgentProjectExecutionFabricPlan[] }>('/agent-projects/execution-fabric/plans'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useAgentProjectExecutionFabricJobs(options?: Partial<UseQueryOptions<{ jobs: AgentProjectExecutionFabricJob[] }>>) {
  return useQuery({
    queryKey: queryKeys.agentProjectExecutionFabricJobs,
    queryFn: () => fetchAPI<{ jobs: AgentProjectExecutionFabricJob[] }>('/agent-projects/execution-fabric/jobs'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useAgentProjectExecutionFabricJobEvents(
  jobId?: string,
  options?: Partial<UseQueryOptions<AgentProjectOperationEventTail>>
) {
  return useQuery({
    queryKey: queryKeys.agentProjectExecutionFabricJobEvents(jobId ?? 'none'),
    queryFn: () => fetchAPI<AgentProjectOperationEventTail>(`/agent-projects/execution-fabric/jobs/${encodeURIComponent(jobId ?? '')}/events`),
    enabled: Boolean(jobId),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateAgentProjectExecutionFabricPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      runId: string;
      executionId?: string;
      provider?: AgentProjectExecutionProvider;
      deploymentProvider?: AgentProjectDeploymentProvider;
      targetEnvironment?: AgentProjectTargetEnvironment;
      maxCostUsd?: number;
      requirePullRequest?: boolean;
      requireDeployment?: boolean;
      allowNetwork?: boolean;
    }) =>
      fetchAPI<AgentProjectExecutionFabricPlan>('/agent-projects/execution-fabric/plans', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectExecutionFabricPlans }),
  });
}

export function useRunAgentProjectExecutionFabricJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      planId: string;
      approved?: boolean;
      dryRun?: boolean;
      providedSecrets?: string[];
    }) =>
      fetchAPI<AgentProjectExecutionFabricJob>('/agent-projects/execution-fabric/jobs', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectExecutionFabricJobs });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectExecutionFabricPlans });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectExecutions });
    },
  });
}

export function useHeartbeatAgentProjectExecutionFabricJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { jobId: string; leaseOwner?: string; progress?: number; stageId?: string; message?: string }) =>
      fetchAPI<AgentProjectExecutionFabricJob>(`/agent-projects/execution-fabric/jobs/${encodeURIComponent(input.jobId)}/heartbeat`, {
        method: 'POST',
        body: JSON.stringify({
          leaseOwner: input.leaseOwner,
          progress: input.progress,
          stageId: input.stageId,
          message: input.message,
        }),
      }),
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectExecutionFabricJobs });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectExecutionFabricJobEvents(input.jobId) });
    },
  });
}

export function useLaunchAgentProjectExecution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      runId: string;
      autonomyLevel?: AgentProjectAutonomyLevel;
      createSandbox?: boolean;
      requireHumanApproval?: boolean;
      workspacePath?: string;
    }) =>
      fetchAPI<AgentProjectExecution>('/agent-projects/executions', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectExecutions });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectWorkspacePlans });
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectRuns });
    },
  });
}

export function useRunAgentProjectExecutionCommand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      executionId: string;
      commandIndex?: number;
      command?: string;
      approved?: boolean;
      timeoutMs?: number;
    }) =>
      fetchAPI<AgentProjectExecution['commandRuns'][number]>(`/agent-projects/executions/${encodeURIComponent(input.executionId)}/commands`, {
        method: 'POST',
        body: JSON.stringify({
          commandIndex: input.commandIndex,
          command: input.command,
          approved: input.approved,
          timeoutMs: input.timeoutMs,
        }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectExecutions }),
  });
}

export function useCreateAgentProjectRunRecap() {
  return useMutation({
    mutationFn: (runId: string) =>
      fetchAPI<AgentProjectRunRecap>(`/agent-projects/runs/${encodeURIComponent(runId)}/recap`, {
        method: 'POST',
      }),
  });
}

export function useCreateAgentProjectDeliveryPack() {
  return useMutation({
    mutationFn: (executionId: string) =>
      fetchAPI<AgentProjectDeliveryPack>(`/agent-projects/executions/${encodeURIComponent(executionId)}/delivery-pack`, {
        method: 'POST',
      }),
  });
}

export function useCreateAgentProjectBrowserEvidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      executionId: string;
      targetUrl?: string;
      htmlSnapshot?: string;
    }) =>
      fetchAPI<{ report: unknown; execution: AgentProjectExecution; artifact: { id: string; sha256: string; uri: string } }>(
        `/agent-projects/executions/${encodeURIComponent(input.executionId)}/browser-evidence`,
        {
          method: 'POST',
          body: JSON.stringify({
            targetUrl: input.targetUrl,
            htmlSnapshot: input.htmlSnapshot,
          }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentProjectExecutions });
      queryClient.invalidateQueries({ queryKey: queryKeys.browserQaReports });
    },
  });
}

export function useAgentProjectCapabilityRoadmap(options?: Partial<UseQueryOptions<AgentProjectCapabilityRoadmap>>) {
  return useQuery({
    queryKey: queryKeys.agentProjectCapabilityRoadmap,
    queryFn: () => fetchAPI<AgentProjectCapabilityRoadmap>('/agent-projects/capability-roadmap'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useAgentProjectSdkManifest(options?: Partial<UseQueryOptions<AgentProjectSdkManifest>>) {
  return useQuery({
    queryKey: queryKeys.agentProjectSdkManifest,
    queryFn: () => fetchAPI<AgentProjectSdkManifest>('/agent-projects/sdk-manifest'),
    ...defaultQueryOptions,
    ...options,
  });
}
