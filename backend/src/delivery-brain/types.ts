export type DecisionRisk = 'low' | 'medium' | 'high' | 'critical';

export interface DeliveryBrainInput {
  tenantId?: string;
  mission: string;
  customerType?: string;
  regulated?: boolean;
  budgetUsd?: number;
  deadlineDays?: number;
  existingAnswers?: Record<string, string>;
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
  sourceSignals: Array<{
    name: string;
    url: string;
    takeaway: string;
    appliedTo: string[];
  }>;
  decisionTrace: Array<{
    decision: string;
    selected: string;
    rationale: string;
    alternatives: string[];
    risk: DecisionRisk;
    evidence: string[];
  }>;
  enterpriseArchitecture: {
    frontend: string[];
    backend: string[];
    data: string[];
    aiRuntime: string[];
    infrastructure: string[];
    observability: string[];
    integrations: string[];
  };
  agentOperatingLoop: Array<{
    stage: 'observe' | 'plan' | 'act' | 'verify' | 'learn';
    purpose: string;
    agentResponsibilities: string[];
    requiredEvidence: string[];
  }>;
  securityAndGovernance: Array<{
    control: string;
    mappedFramework: string;
    blocksReleaseWhen: string;
    proof: string[];
  }>;
  uxAndProductExperience: Array<{
    surface: string;
    userNeed: string;
    designRule: string;
    successSignal: string;
  }>;
  deliveryPlan: Array<{
    phase: string;
    durationDays: number;
    owners: string[];
    outputs: string[];
    exitCriteria: string[];
  }>;
  deploymentAndOperations: Array<{
    capability: string;
    implementation: string;
    evidence: string[];
  }>;
  costAndProductivity: {
    estimatedBuildUsd: number;
    estimatedMonthlyRunUsd: number;
    modelSpendPolicy: string[];
    productivityLevers: string[];
  };
  createdAt: string;
}
