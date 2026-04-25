export type ToolCategory = 'code' | 'shell' | 'http' | 'database' | 'file' | 'git' | 'cloud' | 'observability' | 'communication';

export interface ToolDefinition {
  name: string;
  category: ToolCategory;
  description: string;
  parameters: ToolParameter[];
  requiresApproval: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  timeout: number;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  default?: unknown;
}

export interface ToolExecutionRequest {
  toolName: string;
  parameters: Record<string, unknown>;
  workflowId: string;
  taskId: string;
  agentId: string;
  tenantId: string;
  sandboxed: boolean;
}

export interface ToolExecutionResult {
  success: boolean;
  output: unknown;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  durationMs: number;
  artifacts?: ToolArtifact[];
  sideEffects?: string[];
}

export interface ToolArtifact {
  type: 'file' | 'url' | 'image' | 'json' | 'log';
  name: string;
  content: string;
  mimeType?: string;
  size?: number;
}

export interface SandboxConfig {
  maxExecutionTime: number;
  maxMemoryMb: number;
  allowNetwork: boolean;
  allowFileSystem: boolean;
  allowedHosts?: string[];
  workingDirectory?: string;
  environmentVariables?: Record<string, string>;
}
