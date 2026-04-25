export type ManagedServiceTowerCategory =
  | 'cloud-ops'
  | 'application-support'
  | 'database-ops'
  | 'security-ops'
  | 'devops'
  | 'data-ai'
  | 'quality-engineering'
  | 'finops';

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
  type: 'application' | 'database' | 'cloud-account' | 'pipeline' | 'security-control' | 'model-endpoint';
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
