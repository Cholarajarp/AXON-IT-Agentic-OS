export type WorkforceFunction =
  | 'strategy'
  | 'product'
  | 'architecture'
  | 'engineering'
  | 'database'
  | 'security'
  | 'sre'
  | 'qa'
  | 'data-ai'
  | 'finops'
  | 'customer-success'
  | 'delivery';

export type AutonomyLevel = 'assist' | 'supervised' | 'autonomous' | 'executive-review';
export type WorkMode = 'build' | 'operate' | 'transform' | 'managed-service';

export interface WorkforceDesignInput {
  tenantId?: string;
  mission: string;
  targetAgentCount?: number;
  workMode?: WorkMode;
  monthlyBudgetUsd?: number;
  riskTolerance?: 'low' | 'medium' | 'high';
  regulated?: boolean;
  regions?: string[];
  customerSegments?: string[];
}

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

export interface OrgUnit {
  id: string;
  name: string;
  function: WorkforceFunction;
  headcount: number;
  leadArchetype: string;
  responsibilities: string[];
  interfaces: string[];
}

export interface WorkforceControlPlane {
  id: string;
  tenantId: string;
  mission: string;
  targetAgentCount: number;
  workMode: WorkMode;
  autonomyLevel: AutonomyLevel;
  orgUnits: OrgUnit[];
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
