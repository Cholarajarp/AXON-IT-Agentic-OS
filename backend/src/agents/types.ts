export interface AgentExecutionInput {
  taskId: string;
  taskName: string;
  description: string;
  input: Record<string, unknown>;
  skillContext?: {
    enabledSkillIds: string[];
    capabilities: string[];
    prompts: string[];
    allowedTools: string[];
  };
  signal: AbortSignal;
  workflowId: string;
}

export interface AgentExecutionResult {
  output: Record<string, unknown>;
  cost: number;
  variables?: Record<string, unknown>;
  artifacts?: AgentArtifact[];
}

export interface AgentArtifact {
  type: 'code' | 'document' | 'config' | 'report' | 'test' | 'diagram';
  name: string;
  content: string;
  language?: string;
}

export interface BaseAgent {
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  execute(input: AgentExecutionInput): Promise<AgentExecutionResult>;
}

export interface AgentMetrics {
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
  avgCost: number;
  lastExecutedAt?: number;
}
