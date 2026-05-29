export type ServiceRequestCategory =
  | 'incident'
  | 'access'
  | 'change'
  | 'deployment'
  | 'security'
  | 'database'
  | 'procurement'
  | 'support'
  | 'product-build';

export type ServiceRequestPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type ServiceRequestStatus = 'intake' | 'triaged' | 'approved' | 'executing' | 'monitoring' | 'resolved' | 'closed';
export type ServiceLifecycleStageStatus = 'pending' | 'active' | 'blocked' | 'completed' | 'breached';
export type ServiceCriticality = 'low' | 'medium' | 'high' | 'mission-critical';
export type ConfigurationItemType =
  | 'application'
  | 'api'
  | 'database'
  | 'cloud-account'
  | 'pipeline'
  | 'security-control'
  | 'model-endpoint'
  | 'network'
  | 'vendor-service'
  | 'business-process';

export interface ServiceDeskInput {
  requester?: string;
  tenantId?: string;
  title?: string;
  request: string;
  affectedUsers?: number;
  system?: string;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  compliance?: string[];
}

export interface ServiceDeskEvidenceInput {
  stageId?: string;
  evidence: string;
  artifactId?: string;
  verifiedBy?: string;
  status?: 'satisfied' | 'partial' | 'blocked';
}

export interface ServiceOperationsKernel {
  customer: {
    id: string;
    name: string;
    segment: 'internal' | 'smb' | 'mid-market' | 'enterprise' | 'regulated-enterprise';
    tier: 'standard' | 'premium' | 'mission-critical';
    region: string;
    serviceOwner: string;
    successManager: string;
  };
  contract: {
    id: string;
    name: string;
    coverage: '8x5' | '16x5' | '24x7';
    monthlyRecurringUsd: number;
    serviceCreditRatePct: number;
    renewalDate: string;
    obligations: string[];
  };
  service: {
    id: string;
    name: string;
    type: ServiceRequestCategory;
    environment: 'dev' | 'staging' | 'production';
    criticality: ServiceCriticality;
    serviceWindow: string;
    ownerAgent: string;
    serviceLevel: {
      availabilityTargetPct: number;
      responseTargetMinutes: number;
      resolutionTargetHours: number;
      errorBudgetMinutesMonthly: number;
    };
  };
  cmdb: Array<{
    id: string;
    name: string;
    type: ConfigurationItemType;
    criticality: ServiceCriticality;
    ownerAgent: string;
    health: 'healthy' | 'at-risk' | 'degraded' | 'unknown';
    dependencies: string[];
    monitors: string[];
    backupPolicy: string;
    dataClass: 'public' | 'internal' | 'confidential' | 'restricted';
    rtoMinutes: number;
    rpoMinutes: number;
  }>;
  serviceGraph: Array<{
    from: string;
    to: string;
    relationship: 'depends-on' | 'feeds' | 'protects' | 'deploys' | 'observes';
    risk: 'low' | 'medium' | 'high' | 'critical';
  }>;
  slaClock: {
    openedAt: string;
    responseDueAt: string;
    resolutionDueAt: string;
    responseBreached: boolean;
    resolutionBreached: boolean;
    minutesToResponseDue: number;
    minutesToResolutionDue: number;
    burnRate: number;
    state: 'inside-sla' | 'at-risk' | 'breached';
  };
  lifecycle: Array<{
    id: string;
    name: string;
    status: ServiceLifecycleStageStatus;
    ownerAgent: string;
    dueAt: string;
    startedAt?: string;
    completedAt?: string;
    exitCriteria: string[];
    evidenceRequired: string[];
    evidenceProvided: string[];
    blockers: string[];
    nextAction: string;
  }>;
  incidentCommand: {
    commander: string;
    severity: ServiceRequestPriority;
    bridge: string;
    customerImpact: string;
    blastRadius: string[];
    stakeholderCadence: string;
    timeline: Array<{ at: string; event: string; evidence: string[] }>;
  };
  changeControl: {
    changeId: string;
    type: 'standard' | 'normal' | 'emergency';
    risk: 'low' | 'medium' | 'high' | 'critical';
    cabRequired: boolean;
    approvals: Array<{ approver: string; status: 'pending' | 'approved' | 'rejected'; reason: string }>;
    deploymentWindow: string;
    rollbackPlan: string[];
    policyDecision: 'allow' | 'requires-approval' | 'block';
  };
  remediation: {
    mode: 'manual' | 'supervised-agent' | 'auto-remediation';
    actions: Array<{ order: number; action: string; ownerAgent: string; risk: 'low' | 'medium' | 'high' | 'critical'; reversible: boolean }>;
    automations: string[];
    safeguards: string[];
    approvalGates: string[];
  };
  release: {
    releaseId: string;
    strategy: 'no-release' | 'rolling' | 'blue-green' | 'canary' | 'rollback-only';
    environments: string[];
    smokeTests: string[];
    rollbackTrigger: string;
    deploymentArtifacts: string[];
  };
  problemManagement: {
    problemId: string;
    knownError: string;
    rootCauseHypotheses: string[];
    preventionBacklog: Array<{ title: string; ownerAgent: string; priority: ServiceRequestPriority }>;
    recurrenceRisk: 'low' | 'medium' | 'high';
  };
  financial: {
    estimatedRevenueAtRiskUsd: number;
    serviceCreditExposureUsd: number;
    engineeringCostUsd: number;
    marginImpactUsd: number;
    invoiceNote: string;
  };
  qbr: {
    narrative: string;
    valueMetrics: Array<{ label: string; value: string; evidence: string[] }>;
    risksToReview: string[];
    renewalSignals: string[];
  };
  evidencePack: {
    artifactId?: string;
    trustRecordId?: string;
    coveragePct: number;
    missing: string[];
    ledgerControls: string[];
    exportReady: boolean;
  };
  integrations: Array<{
    system: 'ServiceNow' | 'Jira Service Management' | 'GitHub' | 'Slack' | 'Teams' | 'PagerDuty' | 'Datadog' | 'AWS' | 'Azure' | 'GCP';
    action: string;
    status: 'planned' | 'ready' | 'needs-config';
    payload: Record<string, unknown>;
  }>;
  automationSafety: {
    maxAutonomy: 'recommend-only' | 'draft-and-approve' | 'execute-with-approval' | 'execute-low-risk';
    requireHumanApprovalFor: string[];
    forbiddenActions: string[];
    toolScopes: string[];
  };
  score: number;
  maturity: 'intake-only' | 'controlled' | 'operational' | 'enterprise-grade';
  nextBestActions: string[];
}

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
  approvals: Array<{
    approver: string;
    reason: string;
  }>;
  runbook: Array<{
    step: number;
    ownerAgent: string;
    action: string;
    evidence: string[];
  }>;
  customerUpdates: Array<{
    audience: 'requester' | 'stakeholders' | 'executive';
    message: string;
  }>;
  risks: Array<{
    level: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    mitigation: string;
  }>;
  evidenceRequired: string[];
  evidenceProvided: Array<{
    id: string;
    stageId?: string;
    evidence: string;
    artifactId?: string;
    verifiedBy: string;
    status: 'satisfied' | 'partial' | 'blocked';
    createdAt: string;
  }>;
  automationPlan: string;
  kernel: ServiceOperationsKernel;
  linkedArtifacts: string[];
  trustRecordIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ServiceOperationsDashboard {
  generatedAt: string;
  totalTickets: number;
  activeTickets: number;
  p0Tickets: number;
  breachedTickets: number;
  averageKernelScore: number;
  averageEvidenceCoveragePct: number;
  cmdbItems: number;
  revenueAtRiskUsd: number;
  serviceCreditExposureUsd: number;
  lifecycleCompletionPct: number;
  topServices: Array<{ service: string; tickets: number; highestPriority: ServiceRequestPriority; revenueAtRiskUsd: number }>;
  controlGaps: string[];
  nextActions: string[];
}

export interface ServiceDeskActivationResult {
  ticket: ServiceDeskTicket;
  artifactId: string;
  trustRecordId: string;
  nextActions: string[];
}
