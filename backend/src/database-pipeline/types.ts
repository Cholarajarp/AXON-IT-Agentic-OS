export type DatabaseEngine = 'postgresql' | 'mysql' | 'sqlite' | 'sqlserver';
export type DatabaseEnvironment = 'dev' | 'staging' | 'production';
export type MigrationType = 'schema' | 'data' | 'seed' | 'rollback';
export type DatabaseRiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface DatabaseReviewInput {
  name?: string;
  sql: string;
  engine?: DatabaseEngine;
  environment?: DatabaseEnvironment;
  migrationType?: MigrationType;
  estimatedRows?: number;
  tableSizeGb?: number;
  hasRollbackPlan?: boolean;
  hasBackupCheckpoint?: boolean;
}

export interface DatabaseFinding {
  id: string;
  severity: DatabaseRiskSeverity;
  category: 'destructive-change' | 'lock-risk' | 'data-quality' | 'rollback' | 'operational-readiness';
  title: string;
  detail: string;
  statement?: string;
  recommendation: string;
  blocksProduction: boolean;
}

export interface DatabasePipelineStage {
  order: number;
  name: string;
  ownerAgent: string;
  required: boolean;
  evidence: string[];
  checks: string[];
}

export interface DatabaseReviewResult {
  id: string;
  name: string;
  engine: DatabaseEngine;
  environment: DatabaseEnvironment;
  migrationType: MigrationType;
  riskScore: number;
  severity: DatabaseRiskSeverity;
  blocked: boolean;
  approvalRequired: boolean;
  statementCount: number;
  summary: string;
  findings: DatabaseFinding[];
  safeMigrationPlan: {
    strategy: 'direct' | 'expand-contract' | 'batch-data-change' | 'manual-review';
    phases: Array<{
      name: string;
      description: string;
      requiredEvidence: string[];
    }>;
  };
  rollbackPlan: string[];
  qualityGates: string[];
  pipelineStages: DatabasePipelineStage[];
  agents: string[];
  references: Array<{ title: string; url: string }>;
  createdAt: string;
}

export interface DatabasePolicy {
  id: string;
  title: string;
  description: string;
  severity: DatabaseRiskSeverity;
  enforcedEnvironments: DatabaseEnvironment[];
}
