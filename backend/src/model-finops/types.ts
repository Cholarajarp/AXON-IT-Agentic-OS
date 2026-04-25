export type FinOpsTaskType =
  | 'triage'
  | 'planning'
  | 'coding'
  | 'review'
  | 'security'
  | 'database'
  | 'browser-qa'
  | 'release'
  | 'customer-report';

export type FinOpsStrategy =
  | 'cache-first'
  | 'small-model-first'
  | 'cascade'
  | 'critic-only-on-risk'
  | 'sovereign-local'
  | 'batch';

export type FinOpsRisk = 'low' | 'medium' | 'high' | 'critical';
export type FinOpsSensitivity = 'public' | 'internal' | 'confidential' | 'restricted';

export interface ModelFinOpsInput {
  tenantId?: string;
  mission: string;
  taskTypes?: FinOpsTaskType[];
  monthlyBudgetUsd?: number;
  taskBudgetUsd?: number;
  expectedRunsPerMonth?: number;
  contextTokens?: number;
  outputTokens?: number;
  qualityTarget?: number;
  sensitivityLevel?: FinOpsSensitivity;
  risk?: FinOpsRisk;
  requiresSovereign?: boolean;
  repeatedContext?: boolean;
  providerPreference?: Array<'anthropic' | 'openai' | 'google' | 'vertexai' | 'bedrock' | 'ollama' | 'vllm' | 'localMock'>;
}

export interface FinOpsModelChoice {
  provider: string;
  model: string;
  tier: 'local' | 'economy' | 'balanced' | 'premium' | 'sovereign';
  inputUsdPer1K: number;
  outputUsdPer1K: number;
  maxContextTokens: number;
  supportsContextCache: boolean;
  sovereign: boolean;
  bestFor: FinOpsTaskType[];
}

export interface FinOpsRouteStep {
  order: number;
  taskType: FinOpsTaskType;
  purpose: string;
  strategy: FinOpsStrategy;
  primary: FinOpsModelChoice;
  fallback: FinOpsModelChoice;
  escalation: {
    trigger: string;
    target: FinOpsModelChoice;
    maxExtraPasses: number;
  };
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  qualityGate: string;
  cachePolicy: string;
}

export interface FinOpsCachePlan {
  enabled: boolean;
  cacheKey: string;
  provider: string;
  prefixTokens: number;
  ttlMinutes: number;
  expectedHitRate: number;
  cachedTokenDiscountPercent: number;
  estimatedMonthlySavingsUsd: number;
  cacheableBlocks: string[];
}

export interface FinOpsBudgetPolicy {
  monthlyBudgetUsd: number;
  taskBudgetUsd: number;
  hardStopUsd: number;
  warnAtPercent: number;
  maxPremiumPasses: number;
  maxCriticPasses: number;
  rules: string[];
}

export interface FinOpsQualityGuardrail {
  id: string;
  title: string;
  whyItPreservesAccuracy: string;
  ownerAgent: string;
  evidence: string[];
}

export interface FinOpsAgentBudget {
  agent: string;
  allowedTaskTypes: FinOpsTaskType[];
  defaultStrategy: FinOpsStrategy;
  maxCostPerRunUsd: number;
  escalationModel: string;
  stopCondition: string;
}

export interface ModelFinOpsReport {
  id: string;
  tenantId: string;
  mission: string;
  generatedAt: string;
  taskTypes: FinOpsTaskType[];
  risk: FinOpsRisk;
  sensitivityLevel: FinOpsSensitivity;
  summary: string;
  baseline: {
    model: string;
    estimatedRunCostUsd: number;
    estimatedMonthlyCostUsd: number;
    policy: string;
  };
  optimized: {
    estimatedRunCostUsd: number;
    estimatedMonthlyCostUsd: number;
    savingsUsd: number;
    savingsPercent: number;
    expectedQualityScore: number;
    latencyPosture: 'fast' | 'balanced' | 'deep';
  };
  route: FinOpsRouteStep[];
  cachePlan: FinOpsCachePlan;
  budgetPolicy: FinOpsBudgetPolicy;
  guardrails: FinOpsQualityGuardrail[];
  agentBudgets: FinOpsAgentBudget[];
  nextActions: string[];
  sources: Array<{ title: string; url: string; signal: string }>;
}
