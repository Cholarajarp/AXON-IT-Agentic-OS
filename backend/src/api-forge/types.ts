export type ApiForgeTarget = 'typescript' | 'python' | 'go' | 'java' | 'cli' | 'mcp-server' | 'docs-search';
export type ApiForgeAuthType = 'none' | 'api-key' | 'bearer' | 'basic' | 'oauth2' | 'unknown';
export type ApiForgeRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ApiForgeInput {
  name?: string;
  specText?: string;
  spec?: unknown;
  baseUrl?: string;
  targets?: ApiForgeTarget[];
  tenantId?: string;
  packageName?: string;
  authType?: ApiForgeAuthType;
  agentOptimized?: boolean;
}

export interface ApiOperation {
  id: string;
  method: string;
  path: string;
  summary: string;
  operationId: string;
  risk: ApiForgeRiskLevel;
  tags: string[];
  parameters: Array<{
    name: string;
    in: string;
    required: boolean;
  }>;
}

export interface ApiForgeReport {
  id: string;
  tenantId: string;
  name: string;
  packageName: string;
  baseUrl: string;
  contractScore: number;
  status: 'ready' | 'needs-review' | 'blocked';
  summary: string;
  specStats: {
    paths: number;
    operations: number;
    schemas: number;
    missingOperationIds: number;
    destructiveOperations: number;
  };
  auth: {
    type: ApiForgeAuthType;
    source: 'provided' | 'inferred' | 'missing';
    recommendation: string;
  };
  operations: ApiOperation[];
  sdkTargets: Array<{
    language: Exclude<ApiForgeTarget, 'cli' | 'mcp-server' | 'docs-search'>;
    packageName: string;
    nativePatterns: string[];
    generatedFiles: string[];
    testPlan: string[];
  }>;
  cliPlan: {
    packageName: string;
    commands: Array<{ command: string; operationId: string; description: string }>;
    safety: string[];
  };
  mcpPlan: {
    mode: 'code-mode' | 'endpoint-tools' | 'hybrid';
    packageName: string;
    tools: Array<{ name: string; purpose: string; operations: string[]; risk: ApiForgeRiskLevel }>;
    sandboxPolicy: string[];
    tokenEfficiency: string;
  };
  docsSearchPlan: {
    enabled: boolean;
    sources: string[];
    chunking: string;
    retrievalPolicy: string[];
  };
  qualityGates: Array<{
    id: string;
    title: string;
    passed: boolean;
    evidence: string[];
  }>;
  generatedArtifacts: Array<{
    path: string;
    kind: 'sdk' | 'cli' | 'mcp' | 'docs' | 'test' | 'config';
    contentPreview: string;
  }>;
  createdAt: string;
}
