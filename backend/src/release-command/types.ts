export type ReleaseEnvironment = 'preview' | 'staging' | 'production';
export type ReleaseGateStatus = 'pass' | 'warn' | 'block';
export type ReleaseGateCategory = 'product' | 'security' | 'database' | 'deployment' | 'evidence' | 'customer' | 'ops';

export interface ReleaseCommandInput {
  tenantId?: string;
  productName?: string;
  releaseGoal: string;
  environment?: ReleaseEnvironment;
  regulated?: boolean;
  hasBlueprint?: boolean;
  hasPreview?: boolean;
  hasTests?: boolean;
  hasSecurityScan?: boolean;
  hasDatabaseReview?: boolean;
  hasCheckpoint?: boolean;
  hasRollbackPlan?: boolean;
  hasDeploymentPlan?: boolean;
  hasCustomerReport?: boolean;
  hasApiForgeConnectors?: boolean;
  slaMinutes?: number;
  evidenceArtifacts?: string[];
  openRisks?: string[];
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
  inferredInput: Partial<ReleaseCommandInput>;
  evidenceArtifacts: string[];
  gaps: Array<{
    id: string;
    title: string;
    ownerAgent: string;
    nextAction: string;
  }>;
}

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
  deploymentStages: Array<{
    order: number;
    name: string;
    ownerAgent: string;
    action: string;
    evidence: string[];
  }>;
  slaWatch: {
    responseMinutes: number;
    breachRisk: 'low' | 'medium' | 'high';
    monitors: string[];
    escalation: string[];
  };
  faultRecovery: Array<{
    failureMode: string;
    detection: string;
    recovery: string;
    ownerAgent: string;
  }>;
  executiveBrief: string;
  createdAt: string;
}
