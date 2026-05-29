export type ManagedServiceTowerCategory =
  | 'cloud-ops'
  | 'application-support'
  | 'database-ops'
  | 'security-ops'
  | 'devops'
  | 'data-ai'
  | 'quality-engineering'
  | 'finops'
  | 'service-integration'
  | 'sovereign-cloud'
  | 'network-ops'
  | 'workplace-ops'
  | 'enterprise-apps'
  | 'ot-iot-ops'
  | 'business-process-ops';

export type ManagedServiceCoverage = '8x5' | '16x5' | '24x7';
export type ManagedServiceCriticality = 'low' | 'medium' | 'high' | 'mission-critical';

export interface ManagedServiceInput {
  customerName?: string;
  tenantId?: string;
  industry?: string;
  objective: string;
  appCount?: number;
  users?: number;
  cloudProviders?: string[];
  environments?: string[];
  compliance?: string[];
  painPoints?: string[];
  coverage?: ManagedServiceCoverage;
}

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

export interface CmdbAssetSeed {
  id: string;
  name: string;
  type:
    | 'application'
    | 'database'
    | 'cloud-account'
    | 'pipeline'
    | 'security-control'
    | 'model-endpoint'
    | 'network'
    | 'workplace'
    | 'erp-system'
    | 'ot-system'
    | 'vendor-service'
    | 'business-process';
  ownerAgent: string;
  criticality: ManagedServiceCriticality;
  dependencies: string[];
  monitors: string[];
  backupPolicy: string;
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
  cmdbSeed: CmdbAssetSeed[];
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

export type ITGiantId =
  | 'tcs'
  | 'accenture'
  | 'infosys'
  | 'wipro'
  | 'hcltech'
  | 'cognizant'
  | 'capgemini';

export interface ITGiantBenchmark {
  id: ITGiantId;
  name: string;
  currentEdge: string;
  weakSpot: string;
  axonCounter: string;
  sourceUrl: string;
  serviceSignals: string[];
}

export interface ManagedServiceCapabilityBenchmark {
  id: string;
  title: string;
  marketBar: string;
  competitorLeaders: string[];
  requiredTowerCategories: ManagedServiceTowerCategory[];
  axonProof: string[];
  score: number;
  targetScore: number;
  gap: string;
  improvementMove: string;
  commercialImpact: string;
}

export interface ManagedServiceOfferLane {
  id: string;
  title: string;
  buyer: string;
  winCondition: string;
  requiredCapabilities: string[];
  proofRequired: string[];
  pricingModel: 'retainer' | 'outcome-based' | 'hybrid' | 'consumption';
  score: number;
}

export interface ITGiantReadinessReport {
  id: string;
  generatedAt: string;
  accountId?: string;
  customerName?: string;
  status: 'behind-giants' | 'credible-challenger' | 'giant-grade' | 'beyond-giants';
  score: number;
  thesis: string;
  competitors: ITGiantBenchmark[];
  capabilities: ManagedServiceCapabilityBenchmark[];
  serviceGaps: Array<{
    id: string;
    severity: 'medium' | 'high' | 'critical';
    title: string;
    whyItMatters: string;
    fix: string;
    ownerTower: ManagedServiceTowerCategory;
  }>;
  offerLanes: ManagedServiceOfferLane[];
  topMoves: Array<{
    order: number;
    capabilityId: string;
    move: string;
    expectedLift: number;
  }>;
  sourceNotes: string[];
}

export interface ManagedServiceTransformationRun {
  id: string;
  reportId: string;
  accountId?: string;
  generatedAt: string;
  status: 'created' | 'in-progress';
  tactic: string;
  summary: string;
  progress: {
    score: number;
    completedGates: number;
    totalGates: number;
  };
  missionControlRuns: Array<{
    capabilityId: string;
    capabilityTitle: string;
    missionControlRunId: string;
    releaseMissionId: string;
    status: string;
    score: number;
    proof: string[];
  }>;
  stageGates: Array<{
    id: string;
    title: string;
    ownerAgent: string;
    status: 'pass' | 'warn' | 'block' | 'pending';
    score: number;
    evidence: string[];
    nextAction: string;
  }>;
  proofArtifacts: Array<{
    id: string;
    name: string;
    kind: string;
    uri: string;
    sha256: string;
    source: string;
  }>;
  riskRegister: Array<{
    id: string;
    severity: 'medium' | 'high' | 'critical';
    title: string;
    mitigation: string;
    ownerAgent: string;
  }>;
  commercialPack: {
    offerName: string;
    buyerPromise: string;
    pricingModel: ManagedServiceOfferLane['pricingModel'];
    boardMetrics: string[];
    first90Days: string[];
  };
  nextReviewAt: string;
}
