import type { ServiceBlueprint } from '../product-factory/types.js';
import type { ManagedServiceAccount } from '../managed-services/types.js';
import type { TeamSkillPlan } from '../skill-academy/types.js';
import type { WorkforceControlPlane } from '../autonomous-workforce/types.js';
import type { ServiceDeskTicket } from '../service-desk/types.js';

export type CompanyMissionMode = 'build-and-run' | 'managed-it' | 'modernize' | 'autonomous-factory';

export interface CompanyMissionInput {
  tenantId?: string;
  companyName?: string;
  mission: string;
  mode?: CompanyMissionMode;
  targetAgentCount?: number;
  monthlyBudgetUsd?: number;
  regulated?: boolean;
  customerSegments?: string[];
  regions?: string[];
  cloudProviders?: string[];
  compliance?: string[];
}

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
