export type CheckpointScope = 'workspace' | 'product' | 'database' | 'security' | 'deployment';
export type CheckpointStatus = 'created' | 'restore-previewed' | 'restore-marked';

export interface CheckpointArtifact {
  path: string;
  hash: string;
  bytes: number;
  kind: 'file' | 'config' | 'database' | 'evidence' | 'preview';
}

export interface CheckpointInput {
  name: string;
  description?: string;
  scope?: CheckpointScope;
  workflowId?: string;
  blueprintId?: string;
  includePaths?: string[];
  metadata?: Record<string, unknown>;
}

export interface ProjectCheckpoint {
  id: string;
  name: string;
  description: string;
  scope: CheckpointScope;
  status: CheckpointStatus;
  workflowId?: string;
  blueprintId?: string;
  artifacts: CheckpointArtifact[];
  metadata: Record<string, unknown>;
  costUsd: number;
  createdAt: string;
  updatedAt: string;
}

export interface RollbackPreview {
  checkpointId: string;
  safeToRestore: boolean;
  summary: string;
  impactedArtifacts: Array<{
    path: string;
    checkpointHash: string;
    currentHash?: string;
    state: 'unchanged' | 'changed' | 'missing' | 'new';
  }>;
  requiredApprovals: string[];
  warnings: string[];
  nextSteps: string[];
}
