export type AgentProjectFolderType = 'local-folder' | 'git-checkout' | 'external-context';
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
  type: AgentProjectFolderType;
  writable: boolean;
  reason: string;
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

export interface AgentProjectInput {
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

export interface AgentProjectFromTemplateInput {
  templateId: string;
  name?: string;
  objective?: string;
  tenantId?: string;
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

export interface AgentProjectRunInput {
  projectId: string;
  prompt: string;
  mode?: 'planning' | 'fast';
  voiceTranscript?: string;
  requestedCommand?: AgentProjectSlashCommand;
}

export interface AgentProjectSubagent {
  id: string;
  name: string;
  mission: string;
  contextPolicy: string;
  canRunInParallel: boolean;
  expectedArtifacts: string[];
  budgetUsd: number;
}

export interface AgentProjectTaskGroup {
  id: string;
  title: string;
  ownerAgent: string;
  objective: string;
  dependsOn: string[];
  artifacts: string[];
  reviewRequired: boolean;
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
  subagents: AgentProjectSubagent[];
  taskGroups: AgentProjectTaskGroup[];
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

export interface AgentProjectScheduleInput {
  projectId: string;
  instruction: string;
  schedule: string;
  timezone?: string;
  enabled?: boolean;
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

export interface AgentProjectWorkspaceCommand {
  label: string;
  command: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  requiresApproval: boolean;
}

export interface AgentProjectFileClaim {
  path: string;
  ownerAgent: string;
  reason: string;
}

export interface AgentProjectWorkspacePlan {
  id: string;
  projectId: string;
  runId: string;
  mode: AgentProjectWorktreeMode;
  basePath: string;
  worktreePath: string;
  branchName: string;
  commands: AgentProjectWorkspaceCommand[];
  fileClaims: AgentProjectFileClaim[];
  guardrails: string[];
  createdAt: string;
}

export interface AgentProjectLaunchInput {
  runId: string;
  autonomyLevel?: AgentProjectAutonomyLevel;
  createSandbox?: boolean;
  requireHumanApproval?: boolean;
  workspacePath?: string;
}

export interface AgentProjectExecutionGate {
  id: string;
  title: string;
  status: 'pass' | 'warn' | 'block';
  evidence: string[];
  nextAction: string;
}

export interface AgentProjectCommandRunInput {
  executionId: string;
  commandIndex?: number;
  command?: string;
  approved?: boolean;
  timeoutMs?: number;
}

export interface AgentProjectCommandRun {
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
}

export interface AgentProjectBrowserEvidenceInput {
  executionId: string;
  targetUrl?: string;
  htmlSnapshot?: string;
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
  gates: AgentProjectExecutionGate[];
  commandRuns: AgentProjectCommandRun[];
  evidence: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentProjectDispatchInput {
  now?: string;
  limit?: number;
  launch?: boolean;
  createSandbox?: boolean;
  autonomyLevel?: AgentProjectAutonomyLevel;
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

export type AgentProjectDeliveryJobStatus =
  | 'queued'
  | 'running'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentProjectDeliveryJobStage {
  id: string;
  title: string;
  ownerAgent: string;
  status: 'pending' | 'running' | 'pass' | 'warn' | 'block' | 'failed' | 'skipped';
  evidence: string[];
  nextAction?: string;
  startedAt?: string;
  finishedAt?: string;
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

export interface AgentProjectDeliveryJobInput {
  runId: string;
  autonomyLevel?: AgentProjectAutonomyLevel;
  createSandbox?: boolean;
  requireHumanApproval?: boolean;
  executeApprovedCommands?: boolean;
  approvedCommandIndexes?: number[];
  requireBrowserEvidence?: boolean;
  previewUrl?: string;
}

export interface AgentProjectDeliveryJob {
  id: string;
  projectId: string;
  runId: string;
  tenantId: string;
  executionId?: string;
  deliveryPackId?: string;
  status: AgentProjectDeliveryJobStatus;
  autonomyLevel: AgentProjectAutonomyLevel;
  createSandbox: boolean;
  requireHumanApproval: boolean;
  executeApprovedCommands: boolean;
  approvedCommandIndexes: number[];
  requireBrowserEvidence: boolean;
  previewUrl?: string;
  control: AgentProjectOperationControl;
  stages: AgentProjectDeliveryJobStage[];
  events: AgentProjectDeliveryJobEvent[];
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentProjectRuntimeProfileInput {
  projectId: string;
  runId?: string;
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

export interface AgentProjectHookRunInput {
  projectId: string;
  runId?: string;
  event: AgentProjectHook['event'];
  approved?: boolean;
  payload?: Record<string, unknown>;
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

export interface AgentProjectPullRequestPackageInput {
  runId: string;
  executionId?: string;
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

export interface AgentProjectExecutionFabricPlanInput {
  runId: string;
  executionId?: string;
  provider?: AgentProjectExecutionProvider;
  deploymentProvider?: AgentProjectDeploymentProvider;
  targetEnvironment?: AgentProjectTargetEnvironment;
  maxCostUsd?: number;
  requirePullRequest?: boolean;
  requireDeployment?: boolean;
  allowNetwork?: boolean;
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

export interface AgentProjectExecutionFabricJobInput {
  planId: string;
  approved?: boolean;
  dryRun?: boolean;
  providedSecrets?: string[];
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

export interface AgentProjectRoadmapCapability {
  capability: string;
  axonToday: AgentProjectCapabilityLevel;
  axonTarget: AgentProjectCapabilityLevel;
  priority: 'P0' | 'P1' | 'P2';
  evidence: string[];
  nextBuild: string;
}

export interface AgentProjectFinalBuildItem {
  priority: 'P0' | 'P1' | 'P2';
  capability: string;
  ownerAgent: string;
  status: 'implemented' | 'next-hardening';
  shippedEvidence: string[];
  remainingHardening: string[];
}

export interface AgentProjectCapabilityRoadmap {
  id: string;
  generatedAt: string;
  position: string;
  readinessScore: number;
  capabilityMatrix: AgentProjectRoadmapCapability[];
  finalBuilds: AgentProjectFinalBuildItem[];
  nextNonNegotiables: string[];
  internalReferences: string[];
}
