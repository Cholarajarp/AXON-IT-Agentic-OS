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
  axonIntegration: {
    status: 'planned' | 'activated' | 'blocked';
    connectedSurfaces: string[];
    productBlueprintId: string;
    workforceControlPlaneId: string;
    skillPlanId: string;
    managedServiceAccountId: string;
    serviceDeskTicketIds: string[];
    missionControlRunId?: string;
    agenticMeshBlueprintId?: string;
    releaseMissionId?: string;
    browserQaReportId?: string;
    blackboardId?: string;
    trustRecordIds: string[];
    score?: number;
    activatedAt?: string;
  };
  enterpriseScore: {
    overall: number;
    operatingModel: number;
    integration: number;
    governance: number;
    knowledge: number;
    automation: number;
    customerTrust: number;
    gaps: string[];
  };
  knowledgeFabric: {
    permissionModel: string;
    citationPolicy: string;
    freshnessSla: string;
    retrievalModes: string[];
    sources: Array<{
      system: string;
      data: string;
      syncMode: 'synced-index' | 'federated-realtime' | 'event-stream';
      owner: string;
      accessControl: string;
    }>;
  };
  integrationFabric: Array<{
    system: string;
    domain: 'identity' | 'work' | 'knowledge' | 'engineering' | 'service' | 'finance' | 'security' | 'observability' | 'customer';
    connectorType: 'synced' | 'federated' | 'workflow' | 'event' | 'identity' | 'mcp';
    dataPolicy: string;
    actionsEnabled: string[];
    evidence: string[];
  }>;
  valueStreams: Array<{
    name: string;
    objective: string;
    intakeChannels: string[];
    systemsOfRecord: string[];
    automationLoop: Array<'observe' | 'triage' | 'plan' | 'act' | 'verify' | 'learn'>;
    humanGates: string[];
    kpis: string[];
    axonSurfaces: string[];
  }>;
  governanceControls: Array<{
    control: string;
    framework: string;
    enforcement: string;
    owner: string;
    evidence: string[];
    blocksWhen: string;
  }>;
  decisionRights: Array<{
    decision: string;
    owner: string;
    autonomy: 'autonomous' | 'supervised' | 'human-approval';
    policy: string;
    escalation: string;
    evidence: string[];
  }>;
  operatingCadence: Array<{
    cadence: 'real-time' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
    ritual: string;
    owners: string[];
    inputs: string[];
    outputs: string[];
  }>;
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
