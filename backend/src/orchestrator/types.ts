export type TaskState = 'PENDING' | 'READY' | 'RUNNING' | 'COMPLETE' | 'FAILED' | 'BLOCKED' | 'SKIPPED';

export interface TaskNode {
  id: string;
  name: string;
  description: string;
  agent: string;
  dependsOn: string[];
  state: TaskState;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  cost?: number;
  retries: number;
  maxRetries: number;
  timeoutMs: number;
  approvalRequired: boolean;
}

export interface TaskDAG {
  id: string;
  workflowId: string;
  goal: string;
  nodes: TaskNode[];
  createdAt: number;
  updatedAt: number;
}

export interface PlannerOutput {
  tasks: Array<{
    id: string;
    name: string;
    description: string;
    agent: string;
    dependsOn: string[];
    input: Record<string, unknown>;
    approvalRequired: boolean;
    timeoutMs: number;
  }>;
  reasoning: string;
}

export interface ExecutionContext {
  workflowId: string;
  tenantId: string;
  dag: TaskDAG;
  variables: Record<string, unknown>;
  costAccumulated: number;
  costBudget: number;
}
