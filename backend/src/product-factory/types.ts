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
  status: 'draft' | 'approved' | 'ready-for-execution' | 'executing';
  execution?: {
    workflowId: string;
    dagId: string;
    tasks: number;
    startedAt: string;
  };
  createdAt: string;
}
