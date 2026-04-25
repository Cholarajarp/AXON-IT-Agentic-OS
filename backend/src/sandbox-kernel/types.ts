export type SandboxProvider = 'local-process' | 'docker' | 'kubernetes' | 'e2b' | 'daytona' | 'firecracker';
export type SandboxStatus = 'ready' | 'running' | 'blocked' | 'destroyed' | 'expired';
export type SandboxExecutionStatus = 'passed' | 'failed' | 'blocked' | 'timed-out';
export type SandboxCommandRisk = 'low' | 'medium' | 'high' | 'critical';
export type SandboxNetworkPolicy = 'offline' | 'allowlisted' | 'open';

export interface SandboxSessionInput {
  tenantId?: string;
  name?: string;
  goal: string;
  workspacePath?: string;
  provider?: SandboxProvider;
  ttlMinutes?: number;
  cpuLimit?: string;
  memoryMb?: number;
  networkPolicy?: SandboxNetworkPolicy;
}

export interface SandboxExecutionInput {
  command: string;
  timeoutMs?: number;
  workingDirectory?: string;
  allowMutation?: boolean;
}

export interface SandboxExecution {
  id: string;
  command: string;
  risk: SandboxCommandRisk;
  status: SandboxExecutionStatus;
  exitCode?: number;
  stdout: string;
  stderr: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  evidence: string[];
}

export interface SandboxSnapshot {
  id: string;
  label: string;
  fileCount: number;
  totalBytes: number;
  manifestHash: string;
  createdAt: string;
}

export interface SandboxSession {
  id: string;
  tenantId: string;
  name: string;
  goal: string;
  provider: SandboxProvider;
  status: SandboxStatus;
  workspacePath: string;
  sandboxPath: string;
  networkPolicy: SandboxNetworkPolicy;
  resourceLimits: {
    cpu: string;
    memoryMb: number;
    ttlMinutes: number;
  };
  executions: SandboxExecution[];
  snapshots: SandboxSnapshot[];
  evidence: string[];
  createdAt: string;
  expiresAt: string;
  updatedAt: string;
}
