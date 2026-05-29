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

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type BuilderMode = 'saas-app' | 'internal-tool' | 'ai-agent' | 'workflow-automation' | 'api-service' | 'landing-to-app';
export type AppFeatureChip =
  | 'auth'
  | 'database'
  | 'storage'
  | 'realtime'
  | 'payments'
  | 'maps'
  | 'email'
  | 'ai-chat'
  | 'vision'
  | 'voice'
  | 'admin'
  | 'analytics'
  | 'search'
  | 'workflow'
  | 'mobile'
  | 'browser-qa'
  | 'deploy';

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
  defaultRisk: RiskLevel;
}

export interface ProductRequestInput {
  goal: string;
  tenantId?: string;
  customerName?: string;
  builderMode?: BuilderMode;
  featureChips?: AppFeatureChip[];
  designStyle?: 'enterprise' | 'consumer' | 'developer-tool' | 'marketplace' | 'ops-console';
  dataSensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
  deployTarget?: 'vercel' | 'replit' | 'cloud-run' | 'kubernetes' | 'docker-compose' | 'static';
  attachments?: Array<{ name: string; kind: 'screenshot' | 'doc' | 'url' | 'schema' | 'api-spec'; summary: string }>;
  constraints?: string[];
  budgetUsd?: number;
  timelineDays?: number;
  compliance?: string[];
  targetUsers?: string[];
  integrations?: string[];
}

export interface CostEstimate {
  implementationUsd: number;
  modelUsd: number;
  infrastructureUsd: number;
  supportUsd: number;
  totalUsd: number;
  confidence: number;
}

export interface BlueprintBacklogItem {
  id: string;
  title: string;
  ownerAgent: string;
  priority: 'P0' | 'P1' | 'P2';
  acceptanceCriteria: string[];
  dependencies: string[];
}

export interface TraceabilityItem {
  requirementId: string;
  acceptanceCriterion: string;
  backlogItemIds: string[];
  evidenceRequired: string[];
}

export interface BuilderScreenSpec {
  id: string;
  name: string;
  route: string;
  persona: string;
  purpose: string;
  layout: string;
  components: string[];
  interactions: string[];
  states: string[];
  acceptanceCriteria: string[];
}

export interface BuilderDataEntity {
  name: string;
  purpose: string;
  fields: Array<{ name: string; type: string; required: boolean; pii: boolean }>;
  relationships: string[];
  rlsPolicy: string;
}

export interface BuilderApiEndpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  purpose: string;
  auth: 'public' | 'user' | 'admin' | 'service';
  requestSchema: string[];
  responseSchema: string[];
  tests: string[];
}

export interface GeneratedCodeFile {
  path: string;
  language: 'tsx' | 'ts' | 'sql' | 'json' | 'md' | 'yaml' | 'dockerfile';
  purpose: string;
  content: string;
}

export interface ProductQualityGate {
  id: string;
  title: string;
  status: 'pass' | 'warn' | 'block';
  score: number;
  evidence: string[];
  nextAction: string;
}

export interface UiUxBlueprint {
  appType: 'web-app' | 'mobile-app' | 'desktop-app' | 'rag-agent' | 'agentic-platform' | 'api-service';
  designBar: string;
  visualRules: string[];
  tokenSystem: {
    light: Record<string, string>;
    dark: Record<string, string>;
    typeScale: string[];
    spacingScale: string[];
    radiusScale: string[];
  };
  layoutSystem: {
    navigation: string;
    contentModel: string;
    responsiveRules: string[];
  };
  screenRecipes: Array<{
    screenId: string;
    route: string;
    pattern: string;
    primaryComponents: string[];
    loadingState: string;
    emptyState: string;
    errorState: string;
    accessibilityChecks: string[];
  }>;
  componentRecipes: Array<{
    name: string;
    purpose: string;
    states: string[];
    responsiveRules: string[];
    accessibility: string[];
  }>;
  interactionRules: string[];
  performanceRules: string[];
  qualityChecks: Array<{ id: string; title: string; status: ProductQualityGate['status']; evidence: string[] }>;
}

export interface RagSystemPlan {
  enabled: boolean;
  useCases: string[];
  ingestionPipeline: string[];
  chunkingStrategy: string;
  embeddingModel: string;
  vectorStore: string;
  retrievalStrategy: string[];
  citationPolicy: string;
  evaluationPlan: string[];
  safetyControls: string[];
}

export interface MlSystemPlan {
  enabled: boolean;
  modelRoutes: Array<{ task: string; route: 'fast' | 'balanced' | 'quality' | 'sovereign'; rationale: string }>;
  dataPipelines: string[];
  evaluationMetrics: string[];
  guardrails: string[];
  feedbackLoops: string[];
}

export interface AgenticBuildPlan {
  operatingModel: 'single-agent' | 'multi-agent-supervised' | 'multi-agent-autonomous';
  team: Array<{
    role: string;
    responsibilities: string[];
    artifacts: string[];
    qualityGate: string;
  }>;
  workflow: Array<{
    phase: string;
    owner: string;
    inputs: string[];
    outputs: string[];
    doneWhen: string[];
  }>;
  collaborationProtocol: string[];
  humanGates: string[];
  failureModes: Array<{ mode: string; detection: string; recovery: string }>;
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
  risks: Array<{ id: string; level: RiskLevel; description: string; mitigation: string }>;
  dependencies: string[];
  acceptanceCriteria: string[];
  backlog: BlueprintBacklogItem[];
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
    cost: CostEstimate;
  };
  evidenceRequirements: string[];
  traceability: TraceabilityItem[];
  deliveryBrief: string;
  engineeringPlan: string;
  approvalRequired: boolean;
  builder: {
    mode: BuilderMode;
    featureChips: AppFeatureChip[];
    designStyle: NonNullable<ProductRequestInput['designStyle']>;
    dataSensitivity: NonNullable<ProductRequestInput['dataSensitivity']>;
    deployTarget: NonNullable<ProductRequestInput['deployTarget']>;
    promptQualityScore: number;
    enhancedPrompt: string;
    followUpQuestions: Array<{ id: string; question: string; whyItMatters: string; defaultAnswer: string }>;
    competitorBaseline: Array<{ platform: 'Lovable' | 'Replit' | 'Google AI Studio'; capability: string; axonResponse: string }>;
  };
  appMap: Array<{ route: string; name: string; purpose: string; primaryActions: string[]; dataNeeded: string[] }>;
  screens: BuilderScreenSpec[];
  componentInventory: Array<{ name: string; kind: 'layout' | 'input' | 'data-display' | 'feedback' | 'navigation'; reusedFromSystem: boolean; notes: string }>;
  dataModel: BuilderDataEntity[];
  apiPlan: BuilderApiEndpoint[];
  authPlan: {
    provider: 'email-password' | 'oauth-sso' | 'magic-link' | 'service-token';
    roles: Array<{ role: string; permissions: string[] }>;
    policies: string[];
  };
  aiPlan: {
    modelRoute: string;
    aiFeatures: string[];
    guardrails: string[];
    evals: string[];
    memory: string[];
  };
  designSystem: {
    palette: string[];
    typography: string[];
    spacing: string;
    accessibility: string[];
    responsiveRules: string[];
  };
  uiUxBlueprint: UiUxBlueprint;
  ragPlan: RagSystemPlan;
  mlPlan: MlSystemPlan;
  agenticBuildPlan: AgenticBuildPlan;
  generatedFiles: GeneratedCodeFile[];
  qualityGates: ProductQualityGate[];
  deploymentPlan: {
    target: NonNullable<ProductRequestInput['deployTarget']>;
    environments: string[];
    envVars: string[];
    commands: string[];
    rollback: string[];
    observability: string[];
  };
  previewSpec: {
    status: 'draft' | 'interactive' | 'blocked';
    primaryFlow: string[];
    testUsers: string[];
    emptyStates: string[];
    loadingStates: string[];
    errorStates: string[];
  };
  ownership: {
    exportMode: 'repo-owned' | 'portable-zip' | 'managed';
    lockInRisk: 'low' | 'medium' | 'high';
    handoffArtifacts: string[];
  };
  agenticActivation?: {
    missionControlRunId: string;
    agenticMeshBlueprintId: string;
    releaseMissionId: string;
    browserQaReportId: string;
    blackboardId: string;
    trustRecordIds: string[];
    status: 'ready' | 'needs-review' | 'blocked';
    score: number;
    activatedAt: string;
  };
  status: 'draft' | 'approved' | 'ready-for-execution' | 'executing';
  execution?: {
    workflowId: string;
    dagId: string;
    tasks: number;
    startedAt: string;
  };
  createdAt: string;
}
