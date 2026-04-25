export type { Workflow, AgentInstance, Approval, Policy, Evidence, Incident, Alert } from '../store';
export interface ModelRoute {
  provider: 'anthropic' | 'openai' | 'google' | 'bedrock' | 'vertexai' | 'ollama' | 'local';
  model: string;
  mode: 'quality' | 'balanced' | 'fast' | 'sovereign';
  maxCostUsd: number;
  requiresApproval: boolean;
}

export interface SubmitGoalPayload {
  name: string;
  goal: string;
  domain: string;
  modelRoute: ModelRoute;
  agentFlow: string;
  repositoryUrl?: string;
}

export interface ModelCatalogResponse {
  modelCatalog: Array<{
    provider: ModelRoute['provider'];
    models: Array<{
      id: string;
      label: string;
      fit: string;
      quality: number;
      latency: number;
      cost: number;
      sovereign: boolean;
    }>;
  }>;
  agentFlows: Array<{
    id: string;
    label: string;
    agents: string[];
    risk: 'low' | 'medium' | 'high';
  }>;
  routingModes: Array<{
    id: ModelRoute['mode'];
    label: string;
    description: string;
  }>;
}

export interface ProviderRuntimeHealth {
  name: string;
  healthy: boolean;
  lastChecked: number;
  consecutiveFailures: number;
  cooldownUntil?: number;
  avgLatencyMs: number;
  totalRequests: number;
  totalFailures: number;
}

export interface ModelRuntimeStatus {
  providers: string[];
  health: ProviderRuntimeHealth[];
}

export type ConfigurableProvider = 'anthropic' | 'openai' | 'google' | 'bedrock' | 'ollama' | 'vllm';

export interface ProviderConfigInput {
  provider: ConfigurableProvider;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  modelIds?: Record<string, string>;
}

export interface PublicProviderConfig {
  provider: ConfigurableProvider;
  enabled: boolean;
  configuredAt: string;
  updatedAt: string;
  secretMode: 'encrypted' | 'local-obfuscated';
  apiKeyMasked?: string;
  accessKeyIdMasked?: string;
  secretAccessKeyMasked?: string;
  sessionTokenMasked?: string;
  baseUrl?: string;
  region?: string;
  modelIds?: Record<string, string>;
}

export interface WorkspaceSettings {
  workspace: {
    name: string;
    tenantId: string;
    region: string;
    timezone: string;
  };
  security: {
    requireSso: boolean;
    twoFactorAuth: boolean;
    tamperEvidentAuditLog: boolean;
    encryptedProviderStorage: boolean;
  };
  notifications: {
    emailDigests: boolean;
    slackAlerts: boolean;
    pushToMobile: boolean;
  };
  runtime: {
    backendConnected: boolean;
    providerSecretMode: 'encrypted' | 'local-obfuscated';
    auditSigningConfigured: boolean;
    kmsSigningConfigured: boolean;
    ssoConfigured: boolean;
  };
  updatedAt: string;
}

export interface WorkspaceSettingsUpdate {
  workspace?: Partial<WorkspaceSettings['workspace']>;
  security?: Partial<WorkspaceSettings['security']>;
  notifications?: Partial<WorkspaceSettings['notifications']>;
}

export interface PlatformHealth {
  status: 'healthy' | 'degraded';
  timestamp: string;
  liveness: 'live';
  readiness: 'ready' | 'not-ready';
  services: {
    database: 'connected' | 'disconnected';
    api: 'running';
  };
  readyUrl: string;
}

export type ConnectorRuntimeStatus = 'needs-config' | 'disabled' | 'configured' | 'connected' | 'degraded';

export interface IntegrationStatus {
  type: string;
  name: string;
  category: string;
  configured: boolean;
  enabled: boolean;
  healthy: boolean;
  status: ConnectorRuntimeStatus;
  lastChecked: string;
  baseUrl?: string;
  scopes: string[];
  setupHint: string;
  productionNote: string;
}

export interface IntegrationConfigInput {
  type: string;
  baseUrl: string;
  token?: string;
  enabled: boolean;
}

export interface EvalCaseResult {
  id: string;
  passed: boolean;
  reasons: string[];
  response?: {
    content: string;
    model: string;
    provider: string;
    tokensIn: number;
    tokensOut: number;
    cost: number;
    latencyMs: number;
    cached: boolean;
  };
}

export interface ModelEvaluationReport {
  generatedAt: string;
  report: {
    total: number;
    passed: number;
    failed: number;
    results: EvalCaseResult[];
    durationMs: number;
  };
  runtime: {
    providers: string[];
    healthyProviders: number;
    health: ProviderRuntimeHealth[];
  };
  gates: Array<{
    id: string;
    title: string;
    status: 'pass' | 'warn' | 'fail';
    score: number;
    evidence: string[];
  }>;
}

export interface SkillPack {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  owner: string;
  capabilities: string[];
  prompts: string[];
  allowedTools: string[];
  riskLevel: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
}

export interface SkillPackInput {
  id?: string;
  name: string;
  description: string;
  enabled?: boolean;
  owner?: string;
  capabilities?: string[];
  prompts?: string[];
  allowedTools?: string[];
  riskLevel?: SkillPack['riskLevel'];
}

export interface CostSummary {
  totalSpend: number;
  avgPerWorkflow: number;
  mostExpensive: string;
  topModel: string;
  dailySpend: { date: string; anthropic: number; openai: number; gemini: number; local: number }[];
  domainBreakdown: { domain: string; spend: number; color: string }[];
  modelBreakdown: { model: string; tokens: number; cost: number }[];
}

export interface ExecutiveMetrics {
  featuresDelivered: number;
  costVsBaseline: number;
  complianceScore: number;
  autoResolved: number;
  weeklyVelocity: { week: string; features: number; automated: number }[];
  risks: { id: string; title: string; severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL'; owner: string; status: string }[];
}

export interface MemoryRecord {
  id: string;
  type: 'semantic' | 'episodic' | 'procedural';
  content: string;
  source: string;
  confidence: number;
  accessCount: number;
  lastAccessed: number;
  relatedWorkflows: string[];
  tags: string[];
}

export interface CodeIndexResult {
  workspaceId: string;
  workspacePath: string;
  filesIndexed: number;
  symbolsExtracted: number;
  durationMs: number;
  errors: Array<{ filePath: string; error: string; line?: number }>;
}

export interface CodeIndexStatus {
  workspaceId: string;
  totalFiles: number;
  indexedFiles: number;
  inProgress: boolean;
  lastIndexedAt?: string;
  errors: Array<{ filePath: string; error: string; line?: number }>;
}

export interface CodeSearchResult {
  filePath: string;
  line: number;
  column: number;
  snippet: string;
  score: number;
  context?: string;
}

export interface CodeSymbol {
  id: string;
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'method' | 'property' | 'enum' | 'namespace';
  filePath: string;
  lineStart: number;
  lineEnd: number;
  columnStart: number;
  columnEnd: number;
  documentation?: string;
  signature?: string;
  parentId?: string;
}

export interface CodeAnalysis {
  filePath: string;
  language: string;
  symbols: CodeSymbol[];
  imports: string[];
  exports: string[];
  dependencies: string[];
  circularDependencies: string[];
  unusedImports: string[];
  complexity: number;
}

export interface CodePattern {
  name: string;
  type: 'architectural' | 'design' | 'anti-pattern';
  confidence: number;
  files: string[];
  description: string;
}

export type ServiceCategory =
  | 'application-build'
  | 'repo-modernization'
  | 'deployment-ops'
  | 'automation'
  | 'integration'
  | 'data-ai-workflow'
  | 'ops-remediation'
  | 'security-remediation'
  | 'support'
  | 'advisory';

export interface ServiceCatalogTemplate {
  id: string;
  name: string;
  category: ServiceCategory;
  description: string;
  idealFor: string[];
  deliverables: string[];
  acceptanceCriteria: string[];
  basePriceUsd: number;
  baseTimelineDays: number;
  defaultRisk: 'low' | 'medium' | 'high' | 'critical';
}

export interface ProductRequestInput {
  goal: string;
  tenantId?: string;
  customerName?: string;
  constraints?: string[];
  budgetUsd?: number;
  timelineDays?: number;
  compliance?: string[];
  targetUsers?: string[];
  integrations?: string[];
}

export interface ServiceBlueprint {
  id: string;
  tenantId: string;
  customerName: string;
  category: ServiceCategory;
  templateId: string;
  templateName: string;
  goal: string;
  personas: string[];
  scope: string[];
  nonGoals: string[];
  assumptions: string[];
  risks: Array<{ id: string; level: 'low' | 'medium' | 'high' | 'critical'; description: string; mitigation: string }>;
  dependencies: string[];
  acceptanceCriteria: string[];
  backlog: Array<{
    id: string;
    title: string;
    ownerAgent: string;
    priority: 'P0' | 'P1' | 'P2';
    acceptanceCriteria: string[];
    dependencies: string[];
  }>;
  architecture: {
    summary: string;
    stack: string[];
    apiContracts: string[];
    dataModel: string[];
    threatModel: string[];
  };
  estimates: {
    timelineDays: number;
    effortPersonDays: number;
    cost: {
      implementationUsd: number;
      modelUsd: number;
      infrastructureUsd: number;
      supportUsd: number;
      totalUsd: number;
      confidence: number;
    };
  };
  evidenceRequirements: string[];
  traceability: Array<{
    requirementId: string;
    acceptanceCriterion: string;
    backlogItemIds: string[];
    evidenceRequired: string[];
  }>;
  deliveryBrief: string;
  engineeringPlan: string;
  approvalRequired: boolean;
  status: 'draft' | 'approved' | 'ready-for-execution' | 'executing';
  execution?: {
    workflowId: string;
    dagId: string;
    tasks: number;
    startedAt: string;
  };
  createdAt: string;
}

export type DatabaseEngine = 'postgresql' | 'mysql' | 'sqlite' | 'sqlserver';

export type DatabaseEnvironment = 'dev' | 'staging' | 'production';

export type MigrationType = 'schema' | 'data' | 'seed' | 'rollback';

export type DatabaseRiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface DatabaseReviewInput {
  name?: string;
  sql: string;
  engine?: DatabaseEngine;
  environment?: DatabaseEnvironment;
  migrationType?: MigrationType;
  estimatedRows?: number;
  tableSizeGb?: number;
  hasRollbackPlan?: boolean;
  hasBackupCheckpoint?: boolean;
}

export interface DatabaseFinding {
  id: string;
  severity: DatabaseRiskSeverity;
  category: 'destructive-change' | 'lock-risk' | 'data-quality' | 'rollback' | 'operational-readiness';
  title: string;
  detail: string;
  statement?: string;
  recommendation: string;
  blocksProduction: boolean;
}

export interface DatabasePipelineStage {
  order: number;
  name: string;
  ownerAgent: string;
  required: boolean;
  evidence: string[];
  checks: string[];
}

export interface DatabasePolicy {
  id: string;
  title: string;
  description: string;
  severity: DatabaseRiskSeverity;
  enforcedEnvironments: DatabaseEnvironment[];
}

export interface DatabaseReviewResult {
  id: string;
  name: string;
  engine: DatabaseEngine;
  environment: DatabaseEnvironment;
  migrationType: MigrationType;
  riskScore: number;
  severity: DatabaseRiskSeverity;
  blocked: boolean;
  approvalRequired: boolean;
  statementCount: number;
  summary: string;
  findings: DatabaseFinding[];
  safeMigrationPlan: {
    strategy: 'direct' | 'expand-contract' | 'batch-data-change' | 'manual-review';
    phases: Array<{
      name: string;
      description: string;
      requiredEvidence: string[];
    }>;
  };
  rollbackPlan: string[];
  qualityGates: string[];
  pipelineStages: DatabasePipelineStage[];
  agents: string[];
  references: Array<{ title: string; url: string }>;
  createdAt: string;
}

export type EnterpriseGateStatus = 'pass' | 'warn' | 'block' | 'todo';

export interface EnterpriseCapability {
  id: string;
  name: string;
  category: 'build' | 'agent' | 'preview' | 'data' | 'security' | 'ops' | 'enterprise';
  description: string;
  axonStatus: 'live' | 'partial' | 'planned';
  marketPressure: string[];
  proof: string[];
}

export interface EnterpriseMarketSignal {
  name: string;
  positioning: string;
  strengths: string[];
  axonResponse: string[];
  sourceUrl: string;
}

export interface EnterpriseGate {
  id: string;
  title: string;
  status: EnterpriseGateStatus;
  owner: string;
  whyItMatters: string;
  evidence: string[];
  nextAction: string;
}

export interface EnterpriseReadiness {
  score: number;
  status: 'not-ready' | 'builder-ready' | 'enterprise-ready';
  summary: string;
  gates: EnterpriseGate[];
  missing: string[];
  launchSequence: Array<{
    order: number;
    name: string;
    agent: string;
    output: string;
  }>;
}

export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type SecurityCategory = 'secret' | 'dependency' | 'database' | 'auth' | 'code' | 'publish';

export interface SecurityFinding {
  id: string;
  severity: SecuritySeverity;
  category: SecurityCategory;
  title: string;
  detail: string;
  filePath?: string;
  line?: number;
  excerpt?: string;
  recommendation: string;
  blocksPublish: boolean;
}

export interface SecurityScanResult {
  id: string;
  score: number;
  status: 'safe-to-preview' | 'needs-review' | 'blocked';
  summary: string;
  scannedFiles: number;
  findings: SecurityFinding[];
  publishGates: Array<{
    id: string;
    title: string;
    passed: boolean;
    evidence: string[];
  }>;
  categories: Record<SecurityCategory, number>;
  createdAt: string;
}

export type CheckpointScope = 'workspace' | 'product' | 'database' | 'security' | 'deployment';

export type CheckpointStatus = 'created' | 'restore-previewed' | 'restore-marked';

export interface CheckpointArtifact {
  path: string;
  hash: string;
  bytes: number;
  kind: 'file' | 'config' | 'database' | 'evidence' | 'preview';
}

export interface ProjectCheckpoint {
  id: string;
  name: string;
  description: string;
  scope: CheckpointScope;
  status: CheckpointStatus;
  workflowId?: string;
  blueprintId?: string;
  artifacts: CheckpointArtifact[];
  metadata: Record<string, unknown>;
  costUsd: number;
  createdAt: string;
  updatedAt: string;
}

export interface RollbackPreview {
  checkpointId: string;
  safeToRestore: boolean;
  summary: string;
  impactedArtifacts: Array<{
    path: string;
    checkpointHash: string;
    currentHash?: string;
    state: 'unchanged' | 'changed' | 'missing' | 'new';
  }>;
  requiredApprovals: string[];
  warnings: string[];
  nextSteps: string[];
}

export type ServiceRequestCategory = 'incident' | 'access' | 'change' | 'deployment' | 'security' | 'database' | 'procurement' | 'support' | 'product-build';

export type ServiceRequestPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type ServiceRequestStatus = 'intake' | 'triaged' | 'approved' | 'executing' | 'resolved';

export interface ServiceDeskTicket {
  id: string;
  tenantId: string;
  requester: string;
  title: string;
  request: string;
  category: ServiceRequestCategory;
  priority: ServiceRequestPriority;
  status: ServiceRequestStatus;
  system: string;
  affectedUsers: number;
  sla: {
    responseMinutes: number;
    resolutionHours: number;
    escalation: string[];
  };
  assignedAgents: string[];
  approvalRequired: boolean;
  approvals: Array<{ approver: string; reason: string }>;
  runbook: Array<{ step: number; ownerAgent: string; action: string; evidence: string[] }>;
  customerUpdates: Array<{ audience: 'requester' | 'stakeholders' | 'executive'; message: string }>;
  risks: Array<{ level: 'low' | 'medium' | 'high' | 'critical'; description: string; mitigation: string }>;
  evidenceRequired: string[];
  automationPlan: string;
  createdAt: string;
  updatedAt: string;
}

export type ManagedServiceTowerCategory = 'cloud-ops' | 'application-support' | 'database-ops' | 'security-ops' | 'devops' | 'data-ai' | 'quality-engineering' | 'finops';

export type ManagedServiceCoverage = '8x5' | '16x5' | '24x7';

export type ManagedServiceCriticality = 'low' | 'medium' | 'high' | 'mission-critical';

export interface ManagedServiceTower {
  id: string;
  name: string;
  category: ManagedServiceTowerCategory;
  coverage: ManagedServiceCoverage;
  criticality: ManagedServiceCriticality;
  agents: string[];
  services: string[];
  sla: {
    p1ResponseMinutes: number;
    p1ResolutionHours: number;
    p2ResponseMinutes: number;
    p2ResolutionHours: number;
  };
  runbooks: string[];
  automations: string[];
  kpis: string[];
  evidence: string[];
}

export interface ManagedServiceAccount {
  id: string;
  tenantId: string;
  customerName: string;
  industry: string;
  objective: string;
  maturity: 'transition' | 'stabilize' | 'optimize' | 'transform';
  coverage: ManagedServiceCoverage;
  serviceTowers: ManagedServiceTower[];
  cmdbSeed: Array<{
    id: string;
    name: string;
    type: 'application' | 'database' | 'cloud-account' | 'pipeline' | 'security-control' | 'model-endpoint';
    ownerAgent: string;
    criticality: ManagedServiceCriticality;
    dependencies: string[];
    monitors: string[];
    backupPolicy: string;
  }>;
  deliveryPods: Array<{
    name: string;
    mission: string;
    agents: string[];
    ceremonies: string[];
  }>;
  transitionPlan: Array<{
    phase: string;
    durationDays: number;
    outcomes: string[];
    exitCriteria: string[];
  }>;
  aiOperatingModel: {
    llmRouting: string[];
    memory: string[];
    guardrails: string[];
    escalationPolicy: string[];
  };
  governance: Array<{
    forum: string;
    cadence: string;
    decisions: string[];
  }>;
  financials: {
    transitionCostUsd: number;
    monthlyRunCostUsd: number;
    projectedAutomationSavingsPercent: number;
    confidence: number;
  };
  risks: Array<{
    level: 'medium' | 'high' | 'critical';
    description: string;
    mitigation: string;
  }>;
  createdAt: string;
}

export type SkillDomain = 'product' | 'architecture' | 'frontend' | 'backend' | 'database' | 'devops' | 'security' | 'sre' | 'qa' | 'data-ai' | 'finops' | 'customer-success';

export type LearningSourceType = 'github' | 'documentation' | 'standard' | 'course' | 'internal-runbook';

export interface LearningSource {
  id: string;
  title: string;
  url: string;
  type: LearningSourceType;
  trust: 'community' | 'vendor' | 'standard' | 'internal';
  domains: SkillDomain[];
  topics: string[];
  refreshCadenceDays: number;
  lastReviewedAt: string;
}

export interface RoleSkillProfile {
  role: string;
  mission: string;
  domains: SkillDomain[];
  requiredSkills: Array<{
    name: string;
    domain: SkillDomain;
    targetLevel: 1 | 2 | 3 | 4 | 5;
    evidence: string[];
  }>;
  tools: string[];
  handoffs: string[];
}

export interface TeamSkillPlan {
  id: string;
  tenantId: string;
  objective: string;
  deliveryMode: 'build' | 'operate' | 'modernize' | 'managed-service';
  targetTeamSize: number;
  skillCoverageScore: number;
  monthlyCostUsd: number;
  projectedProductivityLiftPercent: number;
  roles: RoleSkillProfile[];
  squads: Array<{
    name: string;
    mission: string;
    roles: string[];
    workflow: string[];
    successMetrics: string[];
  }>;
  learningBacklog: Array<{
    id: string;
    skill: string;
    domain: SkillDomain;
    priority: 'P0' | 'P1' | 'P2';
    reason: string;
    sources: string[];
    practiceTask: string;
    validationEvidence: string[];
  }>;
  governance: Array<{
    ceremony: string;
    cadence: string;
    outputs: string[];
  }>;
  costControls: Array<{
    control: string;
    owner: string;
    expectedImpact: string;
  }>;
  sources: LearningSource[];
  createdAt: string;
}

export type WorkforceFunction = 'strategy' | 'product' | 'architecture' | 'engineering' | 'database' | 'security' | 'sre' | 'qa' | 'data-ai' | 'finops' | 'customer-success' | 'delivery';

export type AutonomyLevel = 'assist' | 'supervised' | 'autonomous' | 'executive-review';

export type WorkMode = 'build' | 'operate' | 'transform' | 'managed-service';

export interface AgentArchetype {
  id: string;
  name: string;
  function: WorkforceFunction;
  headcount: number;
  autonomyLevel: AutonomyLevel;
  mission: string;
  decisionRights: string[];
  tools: string[];
  knowledge: string[];
  behaviorModel: {
    principles: string[];
    communicationStyle: string;
    uncertaintyRule: string;
    empathyPattern: string;
    conflictRule: string;
  };
  qualityGates: string[];
  escalationTriggers: string[];
  growthPlan: string[];
}

export interface WorkforceControlPlane {
  id: string;
  tenantId: string;
  mission: string;
  targetAgentCount: number;
  workMode: WorkMode;
  autonomyLevel: AutonomyLevel;
  orgUnits: Array<{
    id: string;
    name: string;
    function: WorkforceFunction;
    headcount: number;
    leadArchetype: string;
    responsibilities: string[];
    interfaces: string[];
  }>;
  archetypes: AgentArchetype[];
  operatingSystem: {
    planning: string[];
    execution: string[];
    memory: string[];
    feedback: string[];
    governance: string[];
  };
  faultManagement: Array<{
    fault: string;
    detector: string;
    response: string;
    recoveryEvidence: string[];
  }>;
  growthSystem: Array<{
    signal: string;
    action: string;
    owner: string;
    metric: string;
  }>;
  decisionPsychology: {
    incentives: string[];
    antiPatterns: string[];
    calibration: string[];
    customerEmpathy: string[];
  };
  economics: {
    monthlyBudgetUsd: number;
    estimatedMonthlyRunUsd: number;
    costPerAgentUsd: number;
    automationCapacityHours: number;
    humanReviewReserveUsd: number;
    savingsControls: string[];
  };
  launchSequence: Array<{
    order: number;
    milestone: string;
    owner: string;
    exitCriteria: string[];
  }>;
  createdAt: string;
}

export type CompanyMissionMode = 'build-and-run' | 'managed-it' | 'modernize' | 'autonomous-factory';

export interface CompanyOperatingMission {
  id: string;
  tenantId: string;
  companyName: string;
  mission: string;
  mode: CompanyMissionMode;
  executiveSummary: string;
  northStarMetric: string;
  operatingPrinciples: string[];
  controlPlane: WorkforceControlPlane;
  skillPlan: TeamSkillPlan;
  managedService: ManagedServiceAccount;
  productBlueprint: ServiceBlueprint;
  initialTickets: ServiceDeskTicket[];
  portfolio: Array<{
    horizon: '0-30 days' | '31-90 days' | '91-180 days' | '181-365 days';
    theme: string;
    outcomes: string[];
    owner: string;
    proof: string[];
  }>;
  serviceLines: Array<{
    name: string;
    mission: string;
    agentCapacity: number;
    revenueModel: string;
    deliveryOutputs: string[];
    qualityBar: string[];
  }>;
  commandSystem: Array<{
    level: string;
    owns: string;
    decisions: string[];
    escalation: string;
  }>;
  economics: {
    monthlyBudgetUsd: number;
    estimatedRunUsd: number;
    revenueCapacityUsd: number;
    grossMarginPercent: number;
    costPerOutcomeUsd: number;
    savingsLevers: string[];
  };
  riskAndFaultModel: Array<{
    risk: string;
    earlySignal: string;
    prevention: string;
    recovery: string;
  }>;
  customerTrustSystem: Array<{
    moment: string;
    behavior: string;
    evidence: string[];
  }>;
  createdAt: string;
}

export interface DeliveryBrainDossier {
  id: string;
  tenantId: string;
  mission: string;
  inferredIntent: {
    problem: string;
    targetUsers: string[];
    desiredOutcomes: string[];
    nonGoals: string[];
    assumptions: string[];
    blockerQuestions: string[];
    confidence: number;
    noRepeatPolicy: string[];
  };
  sourceSignals: Array<{ name: string; url: string; takeaway: string; appliedTo: string[] }>;
  decisionTrace: Array<{ decision: string; selected: string; rationale: string; alternatives: string[]; risk: 'low' | 'medium' | 'high' | 'critical'; evidence: string[] }>;
  enterpriseArchitecture: {
    frontend: string[];
    backend: string[];
    data: string[];
    aiRuntime: string[];
    infrastructure: string[];
    observability: string[];
    integrations: string[];
  };
  agentOperatingLoop: Array<{ stage: 'observe' | 'plan' | 'act' | 'verify' | 'learn'; purpose: string; agentResponsibilities: string[]; requiredEvidence: string[] }>;
  securityAndGovernance: Array<{ control: string; mappedFramework: string; blocksReleaseWhen: string; proof: string[] }>;
  uxAndProductExperience: Array<{ surface: string; userNeed: string; designRule: string; successSignal: string }>;
  deliveryPlan: Array<{ phase: string; durationDays: number; owners: string[]; outputs: string[]; exitCriteria: string[] }>;
  deploymentAndOperations: Array<{ capability: string; implementation: string; evidence: string[] }>;
  costAndProductivity: {
    estimatedBuildUsd: number;
    estimatedMonthlyRunUsd: number;
    modelSpendPolicy: string[];
    productivityLevers: string[];
  };
  createdAt: string;
}

export type StructureSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type StructureAction = 'keep' | 'ignore' | 'archive' | 'migrate' | 'delete' | 'review';

export type StructureCategory =
  | 'canonical-root'
  | 'duplicate-config'
  | 'legacy-source'
  | 'generated-artifact'
  | 'local-state'
  | 'missing-capability'
  | 'governance';

export interface DuplicateConfig {
  fileName: string;
  rootPath: string;
  duplicatePath: string;
  status: 'same' | 'different' | 'missing-root' | 'missing-duplicate';
  recommendation: string;
}

export interface StructureFinding {
  id: string;
  severity: StructureSeverity;
  category: StructureCategory;
  action: StructureAction;
  title: string;
  detail: string;
  path?: string;
  recommendation: string;
  blocksCleanup: boolean;
}

export interface LegacyComparison {
  enabled: boolean;
  legacyRoot?: string;
  summary: string;
  exactDuplicateCount: number;
  driftedSharedCount: number;
  legacyOnlyCount: number;
  rootOnlyCount: number;
  ignoredDirectories: string[];
  exactDuplicateFiles: Array<{ path: string; bytes: number; recommendation: string }>;
  driftedSharedFiles: Array<{ path: string; rootBytes: number; legacyBytes: number; recommendation: string }>;
  legacyOnlyFiles: Array<{ path: string; bytes: number; recommendation: string }>;
}

export interface StructureScanResult {
  id: string;
  workspaceRoot: string;
  canonicalRoot: string;
  score: number;
  status: 'clean' | 'needs-review' | 'blocked';
  summary: string;
  validKeepPaths: Array<{ path: string; reason: string; ownerAgent: string }>;
  cleanupCandidates: Array<{ path: string; action: StructureAction; reason: string; safeCommand?: string }>;
  duplicateConfigs: DuplicateConfig[];
  legacyComparison: LegacyComparison;
  findings: StructureFinding[];
  migrationPlan: Array<{ order: number; ownerAgent: string; action: string; evidence: string[] }>;
  missingEnterpriseCapabilities: Array<{ id: string; capability: string; whyItMatters: string; buildNext: string }>;
  createdAt: string;
}

export type DeliveryPricingModel = 'fixed-scope' | 'subscription' | 'usage-based' | 'enterprise-managed-service';

export type DeliveryProjectStatus = 'discovery' | 'approved' | 'executing' | 'verifying' | 'delivered' | 'operating';

export type DeliveryMilestoneStatus = 'planned' | 'in-progress' | 'complete' | 'blocked';

export type FeedbackPriority = 'P0' | 'P1' | 'P2' | 'P3';

export interface DeliveryReport {
  id: string;
  status: 'draft' | 'ready-for-customer' | 'sent';
  executiveSummary: string;
  completedWork: string[];
  verificationEvidence: string[];
  deployLinks: Array<{ label: string; url: string; environment: 'preview' | 'staging' | 'production' }>;
  riskRegister: Array<{ risk: string; level: 'low' | 'medium' | 'high' | 'critical'; mitigation: string }>;
  nextRecommendations: string[];
  customerMessage: string;
  generatedAt: string;
}

export interface FeedbackBacklogItem {
  id: string;
  source: 'customer-feedback' | 'support-ticket' | 'incident' | 'usage-analytics' | 'delivery-review';
  priority: FeedbackPriority;
  title: string;
  description: string;
  ownerAgent: string;
  acceptanceCriteria: string[];
  revenueImpactUsd: number;
}

export interface CustomerProject {
  id: string;
  name: string;
  request: string;
  pricingModel: DeliveryPricingModel;
  status: DeliveryProjectStatus;
  statementOfWork: {
    objective: string;
    scope: string[];
    outOfScope: string[];
    assumptions: string[];
    acceptanceCriteria: string[];
  };
  milestones: Array<{
    id: string;
    name: string;
    status: DeliveryMilestoneStatus;
    dueDay: number;
    ownerAgent: string;
    deliverables: string[];
    exitCriteria: string[];
  }>;
  sla: {
    responseMinutes: number;
    resolutionHours: number;
    coverage: '8x5' | '16x5' | '24x7';
    escalation: string[];
  };
  marginModel: {
    revenueUsd: number;
    deliveryCostUsd: number;
    modelCostUsd: number;
    cloudCostUsd: number;
    supportCostUsd: number;
    grossMarginPercent: number;
  };
  deliveryReport: DeliveryReport;
  feedbackBacklog: FeedbackBacklogItem[];
}

export interface CustomerAccount {
  id: string;
  tenantId: string;
  customerName: string;
  industry: string;
  health: 'green' | 'amber' | 'red';
  supportPlan: 'starter' | 'business' | 'enterprise';
  projects: CustomerProject[];
  commercialSummary: {
    annualContractValueUsd: number;
    projectedGrossMarginPercent: number;
    modelCostUsd: number;
    cloudCostUsd: number;
    humanReviewCostUsd: number;
    supportCostUsd: number;
  };
  renewalSignals: Array<{ signal: string; level: 'positive' | 'watch' | 'risk'; action: string }>;
  createdAt: string;
}

export type ApiForgeTarget = 'typescript' | 'python' | 'go' | 'java' | 'cli' | 'mcp-server' | 'docs-search';

export type ApiForgeAuthType = 'none' | 'api-key' | 'bearer' | 'basic' | 'oauth2' | 'unknown';

export type ApiForgeRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ApiOperation {
  id: string;
  method: string;
  path: string;
  summary: string;
  operationId: string;
  risk: ApiForgeRiskLevel;
  tags: string[];
  parameters: Array<{ name: string; in: string; required: boolean }>;
}

export interface ApiForgeReport {
  id: string;
  tenantId: string;
  name: string;
  packageName: string;
  baseUrl: string;
  contractScore: number;
  status: 'ready' | 'needs-review' | 'blocked';
  summary: string;
  specStats: {
    paths: number;
    operations: number;
    schemas: number;
    missingOperationIds: number;
    destructiveOperations: number;
  };
  auth: { type: ApiForgeAuthType; source: 'provided' | 'inferred' | 'missing'; recommendation: string };
  operations: ApiOperation[];
  sdkTargets: Array<{
    language: Exclude<ApiForgeTarget, 'cli' | 'mcp-server' | 'docs-search'>;
    packageName: string;
    nativePatterns: string[];
    generatedFiles: string[];
    testPlan: string[];
  }>;
  cliPlan: {
    packageName: string;
    commands: Array<{ command: string; operationId: string; description: string }>;
    safety: string[];
  };
  mcpPlan: {
    mode: 'code-mode' | 'endpoint-tools' | 'hybrid';
    packageName: string;
    tools: Array<{ name: string; purpose: string; operations: string[]; risk: ApiForgeRiskLevel }>;
    sandboxPolicy: string[];
    tokenEfficiency: string;
  };
  docsSearchPlan: {
    enabled: boolean;
    sources: string[];
    chunking: string;
    retrievalPolicy: string[];
  };
  qualityGates: Array<{ id: string; title: string; passed: boolean; evidence: string[] }>;
  generatedArtifacts: Array<{ path: string; kind: 'sdk' | 'cli' | 'mcp' | 'docs' | 'test' | 'config'; contentPreview: string }>;
  createdAt: string;
}

export type BrowserQaStatus = 'release-ready' | 'needs-review' | 'blocked';

export type BrowserJourneyStatus = 'pass' | 'warn' | 'fail' | 'skipped';

export type BrowserDeviceProfile = 'desktop' | 'tablet' | 'mobile';

export type ValidationEvidenceKind = 'typecheck' | 'unit' | 'integration' | 'build' | 'e2e' | 'security' | 'accessibility';

export type ValidationEvidenceStatus = 'pass' | 'warn' | 'fail' | 'planned';

export interface BrowserJourneyInput {
  name: string;
  path?: string;
  intent?: string;
  assertions?: string[];
  critical?: boolean;
}

export interface ValidationEvidenceInput {
  kind: ValidationEvidenceKind;
  status: ValidationEvidenceStatus;
  command?: string;
  summary?: string;
}

export interface BrowserQaReport {
  id: string;
  tenantId: string;
  name: string;
  releaseGoal: string;
  targetUrl?: string;
  status: BrowserQaStatus;
  score: number;
  summary: string;
  preview: {
    url?: string;
    reachable: boolean;
    statusCode?: number;
    responseMs?: number;
    contentType?: string;
    title?: string;
    error?: string;
  };
  journeys: Array<{
    id: string;
    name: string;
    path: string;
    intent: string;
    status: BrowserJourneyStatus;
    critical: boolean;
    deviceProfiles: BrowserDeviceProfile[];
    assertions: Array<{ text: string; passed: boolean; evidence: string }>;
    evidence: string[];
    durationMs: number;
  }>;
  accessibilityFindings: Array<{
    id: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    title: string;
    detail: string;
    recommendation: string;
    blocksRelease: boolean;
  }>;
  validationEvidence: ValidationEvidenceInput[];
  releaseEvidence: string[];
  artifacts: Array<{
    id: string;
    kind: 'playwright-spec' | 'screenshot-plan' | 'trace-plan' | 'accessibility-report' | 'release-evidence';
    path: string;
    contentPreview: string;
  }>;
  nextActions: string[];
  createdAt: string;
}

export type MissionControlStatus = 'ready' | 'needs-review' | 'blocked';

export type MissionPhaseStatus = 'pass' | 'warn' | 'block';

export interface MissionControlRun {
  id: string;
  tenantId: string;
  mission: string;
  status: MissionControlStatus;
  score: number;
  summary: string;
  blueprintId: string;
  finOpsReportId: string;
  agenticMeshBlueprintId: string;
  databaseReviewId: string;
  apiForgeReportId: string;
  customerAccountId: string;
  customerReportId: string;
  sandboxSessionId: string;
  browserQaReportId: string;
  blackboardId: string;
  releaseMissionId: string;
  trustRecordIds: string[];
  phases: Array<{
    order: number;
    name: string;
    ownerAgent: string;
    status: MissionPhaseStatus;
    evidence: string[];
    nextAction: string;
  }>;
  agentTeam: string[];
  evidence: string[];
  nextActions: string[];
  createdAt: string;
}

export type CapabilityArea = 'sandbox' | 'agent-runtime' | 'browser-qa' | 'deployment' | 'governance' | 'security' | 'marketplace' | 'ux' | 'memory' | 'finops' | 'evidence';

export type BuildPackUrgency = 'P0' | 'P1' | 'P2' | 'P3';

export type BuildPackStatus = 'recommended' | 'ready-for-mission-control' | 'planned';

export interface MarketSignal {
  id: string;
  source: string;
  sourceUrl: string;
  observedCapability: string;
  strategicIntent: string;
  axonResponse: string;
  areas: CapabilityArea[];
  confidence: number;
  freshness: 'today' | 'recent' | 'evergreen';
}

export interface CapabilityGap {
  id: string;
  title: string;
  area: CapabilityArea;
  urgency: BuildPackUrgency;
  sourcePatterns: string[];
  userBenefit: string;
  currentAxonProof: string[];
  missing: string[];
  buildPackId: string;
}

export interface MarketBuildPack {
  id: string;
  name: string;
  status: BuildPackStatus;
  urgency: BuildPackUrgency;
  whyNow: string;
  userBenefit: string;
  moat: string;
  modules: string[];
  ownerAgents: string[];
  features: string[];
  acceptanceCriteria: string[];
  evidence: string[];
  missionPrompt: string;
  impactScore: number;
}

export interface MarketRadarReport {
  id: string;
  tenantId: string;
  focus: string;
  targetUser: string;
  generatedAt: string;
  marketThesis: string;
  summary: string;
  moatScore: number;
  signals: MarketSignal[];
  gaps: CapabilityGap[];
  buildPacks: MarketBuildPack[];
  recommendedSequence: Array<{ order: number; buildPackId: string; rationale: string }>;
  referenceCoverage: Array<{ source: string; signals: number; axonResponse: string }>;
}

export interface MarketRadarLaunch {
  reportId: string;
  buildPackId: string;
  missionControlRunId: string;
  releaseMissionId: string;
  status: string;
  score: number;
}

export type FinOpsTaskType =
  | 'triage'
  | 'planning'
  | 'coding'
  | 'review'
  | 'security'
  | 'database'
  | 'browser-qa'
  | 'release'
  | 'customer-report';

export type FinOpsStrategy =
  | 'cache-first'
  | 'small-model-first'
  | 'cascade'
  | 'critic-only-on-risk'
  | 'sovereign-local'
  | 'batch';

export type FinOpsRisk = 'low' | 'medium' | 'high' | 'critical';

export type FinOpsSensitivity = 'public' | 'internal' | 'confidential' | 'restricted';

export interface FinOpsModelChoice {
  provider: string;
  model: string;
  tier: 'local' | 'economy' | 'balanced' | 'premium' | 'sovereign';
  inputUsdPer1K: number;
  outputUsdPer1K: number;
  maxContextTokens: number;
  supportsContextCache: boolean;
  sovereign: boolean;
  bestFor: FinOpsTaskType[];
}

export interface FinOpsRouteStep {
  order: number;
  taskType: FinOpsTaskType;
  purpose: string;
  strategy: FinOpsStrategy;
  primary: FinOpsModelChoice;
  fallback: FinOpsModelChoice;
  escalation: {
    trigger: string;
    target: FinOpsModelChoice;
    maxExtraPasses: number;
  };
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  qualityGate: string;
  cachePolicy: string;
}

export interface ModelFinOpsReport {
  id: string;
  tenantId: string;
  mission: string;
  generatedAt: string;
  taskTypes: FinOpsTaskType[];
  risk: FinOpsRisk;
  sensitivityLevel: FinOpsSensitivity;
  summary: string;
  baseline: {
    model: string;
    estimatedRunCostUsd: number;
    estimatedMonthlyCostUsd: number;
    policy: string;
  };
  optimized: {
    estimatedRunCostUsd: number;
    estimatedMonthlyCostUsd: number;
    savingsUsd: number;
    savingsPercent: number;
    expectedQualityScore: number;
    latencyPosture: 'fast' | 'balanced' | 'deep';
  };
  route: FinOpsRouteStep[];
  cachePlan: {
    enabled: boolean;
    cacheKey: string;
    provider: string;
    prefixTokens: number;
    ttlMinutes: number;
    expectedHitRate: number;
    cachedTokenDiscountPercent: number;
    estimatedMonthlySavingsUsd: number;
    cacheableBlocks: string[];
  };
  budgetPolicy: {
    monthlyBudgetUsd: number;
    taskBudgetUsd: number;
    hardStopUsd: number;
    warnAtPercent: number;
    maxPremiumPasses: number;
    maxCriticPasses: number;
    rules: string[];
  };
  guardrails: Array<{
    id: string;
    title: string;
    whyItPreservesAccuracy: string;
    ownerAgent: string;
    evidence: string[];
  }>;
  agentBudgets: Array<{
    agent: string;
    allowedTaskTypes: FinOpsTaskType[];
    defaultStrategy: FinOpsStrategy;
    maxCostPerRunUsd: number;
    escalationModel: string;
    stopCondition: string;
  }>;
  nextActions: string[];
  sources: Array<{ title: string; url: string; signal: string }>;
}

export type MeshTopology =
  | 'hierarchical'
  | 'sequential-pipeline'
  | 'parallel-fanout'
  | 'loop-critic'
  | 'human-gated';

export interface AgenticMeshBlueprint {
  id: string;
  tenantId: string;
  mission: string;
  generatedAt: string;
  autonomyLevel: 'assistive' | 'supervised' | 'autonomous';
  topologies: MeshTopology[];
  finOpsReportId: string;
  summary: string;
  agentRoles: Array<{
    agent: string;
    role: 'coordinator' | 'planner' | 'researcher' | 'builder' | 'critic' | 'operator' | 'customer';
    responsibilities: string[];
    inputChannels: string[];
    outputChannels: string[];
    modelPolicy: string;
    canRunInParallel: boolean;
  }>;
  stages: Array<{
    order: number;
    name: string;
    topology: MeshTopology;
    leadAgent: string;
    agents: string[];
    objective: string;
    dependsOn: number[];
    status: 'planned' | 'ready' | 'blocked';
    sharedStateKeys: string[];
    qualityGate: string;
    costControl: string;
    failurePolicy: string;
    expectedArtifacts: string[];
  }>;
  taskEnvelopes: Array<{
    id: string;
    protocol: 'AXON-A2A';
    senderAgent: string;
    receiverAgent: string;
    task: string;
    expectedArtifacts: string[];
    status: 'created' | 'delegated' | 'waiting' | 'completed';
    securityContext: {
      tenantScoped: boolean;
      dataClass: 'public' | 'internal' | 'confidential' | 'restricted';
      requiredScopes: string[];
    };
  }>;
  qualityLoops: Array<{
    id: string;
    trigger: string;
    generatorAgent: string;
    criticAgent: string;
    maxIterations: number;
    stopCondition: string;
    evidence: string[];
  }>;
  sharedState: Array<{ key: string; ownerAgent: string; retention: string; purpose: string }>;
  humanGates: Array<{ gate: string; owner: string; reason: string; unblockCondition: string }>;
  operatingRules: string[];
  score: {
    autonomy: number;
    reliability: number;
    costDiscipline: number;
    enterpriseReadiness: number;
  };
  nextActions: string[];
}

export type ProductionCapabilityStatus = 'active' | 'partial' | 'inactive';

export type ProductionLevel = 'prototype' | 'pilot' | 'production-loop' | 'production-blocked';

export type ProductionReadinessStatus = 'blocked' | 'pilot-ready' | 'production-loop-ready';

export interface ProductionCapability {
  id: string;
  name: string;
  category: 'intake' | 'agentic' | 'engineering' | 'data' | 'security' | 'release' | 'customer' | 'governance' | 'ops';
  status: ProductionCapabilityStatus;
  level: ProductionLevel;
  ownerAgent: string;
  routeOrSurface: string;
  productionUse: string;
  evidence: string[];
  gaps: string[];
  activationAction: string;
}

export interface ProductionServiceOffer {
  id: string;
  name: string;
  ready: boolean;
  priceModel: 'fixed-scope' | 'subscription' | 'usage-based' | 'enterprise-managed-service';
  includedCapabilities: string[];
  requiredEvidence: string[];
  blockers: string[];
}

export interface ProductionReadinessReport {
  id: string;
  tenantId: string;
  generatedAt: string;
  mission: string;
  status: ProductionReadinessStatus;
  score: number;
  summary: string;
  capabilities: ProductionCapability[];
  serviceOffers: ProductionServiceOffer[];
  blockers: string[];
  nextActions: string[];
  runtime: {
    status: string;
    score: number;
    productionReady: boolean;
    blockers: string[];
  };
  activationFlow: Array<{ order: number; stage: string; service: string; evidence: string[] }>;
}

export interface ProductionActivationResult {
  id: string;
  tenantId: string;
  missionControlRunId: string;
  releaseMissionId: string;
  activatedCapabilityIds: string[];
  report: ProductionReadinessReport;
}

export type ReleaseEnvironment = 'preview' | 'staging' | 'production';

export type ReleaseGateStatus = 'pass' | 'warn' | 'block';

export type ReleaseGateCategory = 'product' | 'security' | 'database' | 'deployment' | 'evidence' | 'customer' | 'ops';

export interface ReleaseGate {
  id: string;
  category: ReleaseGateCategory;
  title: string;
  status: ReleaseGateStatus;
  ownerAgent: string;
  whyItMatters: string;
  evidenceRequired: string[];
  evidenceProvided: string[];
  nextAction: string;
  blocksRelease: boolean;
}

export interface EvidenceManifestItem {
  id: string;
  kind: 'blueprint' | 'test' | 'security' | 'database' | 'checkpoint' | 'deployment' | 'customer-report' | 'connector' | 'ops';
  title: string;
  required: boolean;
  present: boolean;
  source: string;
}

export interface ReleaseCommandMission {
  id: string;
  tenantId: string;
  productName: string;
  releaseGoal: string;
  environment: ReleaseEnvironment;
  status: 'ready-to-launch' | 'needs-review' | 'blocked';
  score: number;
  summary: string;
  gates: ReleaseGate[];
  evidenceManifest: EvidenceManifestItem[];
  deploymentStages: Array<{ order: number; name: string; ownerAgent: string; action: string; evidence: string[] }>;
  slaWatch: {
    responseMinutes: number;
    breachRisk: 'low' | 'medium' | 'high';
    monitors: string[];
    escalation: string[];
  };
  faultRecovery: Array<{ failureMode: string; detection: string; recovery: string; ownerAgent: string }>;
  executiveBrief: string;
  createdAt: string;
}

export interface ReleaseEvidenceSnapshot {
  id: string;
  releaseGoal: string;
  generatedAt: string;
  signals: {
    blueprints: number;
    approvedBlueprints: number;
    securityStatus: 'safe-to-preview' | 'needs-review' | 'blocked';
    securityScore: number;
    securityFindings: number;
    checkpoints: number;
    rollbackPreviews: number;
    apiForgeReports: number;
    readyApiForgeReports: number;
    browserQaReports: number;
    releaseReadyBrowserQaReports: number;
    customerAccounts: number;
    customerReportsReady: number;
  };
  inferredInput: Partial<{
    hasBlueprint: boolean;
    hasPreview: boolean;
    hasTests: boolean;
    hasSecurityScan: boolean;
    hasDatabaseReview: boolean;
    hasCheckpoint: boolean;
    hasRollbackPlan: boolean;
    hasDeploymentPlan: boolean;
    hasCustomerReport: boolean;
    hasApiForgeConnectors: boolean;
    evidenceArtifacts: string[];
  }>;
  evidenceArtifacts: string[];
  gaps: Array<{ id: string; title: string; ownerAgent: string; nextAction: string }>;
}

export interface AuditEntryRecord {
  id: string;
  sequence: number;
  timestamp: number;
  action: string;
  actor: string;
  actorType: 'human' | 'agent' | 'system';
  resource: string;
  tenantId: string;
  details: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  previousHash: string;
  hash: string;
}

export interface AuditVerificationResult {
  valid: boolean;
  totalEntries: number;
  brokenAtSequence?: number;
  brokenEntryId?: string;
  headHash?: string;
  tailHash?: string;
}

export type TrustRecordKind =
  | 'policy-decision'
  | 'command-evidence'
  | 'browser-artifact'
  | 'security-scan'
  | 'database-review'
  | 'release-manifest'
  | 'approval'
  | 'deployment'
  | 'cost'
  | 'customer-handoff'
  | 'market-signal';

export type TrustRisk = 'low' | 'medium' | 'high' | 'critical';

export type PolicyDecision = 'allow' | 'requires-approval' | 'block';

export interface TrustRecord {
  id: string;
  sequence: number;
  tenantId: string;
  kind: TrustRecordKind;
  actor: string;
  actorType: 'human' | 'agent' | 'system';
  subject: string;
  summary: string;
  risk: TrustRisk;
  source: string;
  artifacts: string[];
  metadata: Record<string, unknown>;
  controls: string[];
  timestamp: string;
  previousHash: string;
  hash: string;
  signature: string;
}

export interface PolicyDecisionRecord {
  id: string;
  decision: PolicyDecision;
  reason: string;
  requiredApprovals: string[];
  record: TrustRecord;
}

export interface TrustLedgerVerification {
  valid: boolean;
  totalRecords: number;
  headHash?: string;
  brokenAtSequence?: number;
  brokenRecordId?: string;
}

export interface TrustLedgerExport {
  id: string;
  generatedAt: string;
  tenantId: string;
  format: 'soc2-lite' | 'iso27001-lite' | 'release-pack';
  verification: TrustLedgerVerification;
  controls: Array<{
    controlId: string;
    title: string;
    recordIds: string[];
    status: 'satisfied' | 'partial' | 'missing';
  }>;
  records: TrustRecord[];
}

export interface DAGNode {
  id: string;
  name: string;
  description: string;
  agent: string;
  dependsOn: string[];
  state: 'PENDING' | 'READY' | 'RUNNING' | 'COMPLETE' | 'FAILED' | 'BLOCKED' | 'SKIPPED';
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  cost?: number;
}

export interface DAGResponse {
  id: string;
  workflowId: string;
  goal: string;
  nodes: DAGNode[];
  progress: number;
  isComplete: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface OrchestratorStatus {
  activeWorkflows: number;
  runningTasks: number;
  workflows: Array<{
    id: string;
    progress: number;
    tasks: number;
    running: number;
    complete: number;
    failed: number;
  }>;
}

export interface PipelineStep {
  order: number;
  name: string;
  description: string;
}

export interface ToolDefinition {
  name: string;
  category: string;
  description: string;
  parameters: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required: boolean;
    description: string;
    default?: unknown;
  }>;
  requiresApproval: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  timeout: number;
}

export interface ToolStats {
  totalExecutions: number;
  successRate: number;
  byTool: Record<string, number>;
  registeredTools: number;
}

export interface ToolStepResult {
  step: string;
  order: number;
  passed: boolean;
  durationMs: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolRuntimeResult {
  executionId: string;
  success: boolean;
  aborted: boolean;
  abortReason?: string;
  abortStep?: string;
  steps: ToolStepResult[];
  toolResult?: {
    success: boolean;
    output: unknown;
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    durationMs: number;
  };
  policyDecision?: {
    allowed: boolean;
    matched: string[];
    reasons: string[];
    requireApproval: boolean;
    requireSovereign: boolean;
  };
  sanitized: {
    inputHadSecrets: boolean;
    outputHadPII: boolean;
  };
  durationMs: number;
}

export interface ToolExecuteInput {
  toolName: string;
  parameters: Record<string, unknown>;
  workflowId: string;
  taskId: string;
  agentId: string;
  tenantId: string;
  sensitivityLevel?: 'public' | 'internal' | 'confidential' | 'restricted';
  sovereignMode?: boolean;
  approvalApproved?: boolean;
  allowedHosts?: string[];
}

export interface ModelInvokeRequest {
  model?: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  taskType?: string;
  tenantId?: string;
  sensitivityLevel?: 'public' | 'internal' | 'confidential' | 'restricted';
  costBudget?: number;
  sovereignMode?: boolean;
  preferredProvider?: string;
  bypassCache?: boolean;
}

export interface ModelInvokeResponse {
  content: string;
  model: string;
  provider: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  latencyMs: number;
  cached: boolean;
}
