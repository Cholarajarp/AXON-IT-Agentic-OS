export interface ModelRequest {
  model?: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  taskType?: string;
  tenantId?: string;
  sensitivityLevel?: 'public' | 'internal' | 'confidential' | 'restricted';
  costBudget?: number;
  sovereignMode?: boolean;
  /** Skip the response cache for this request even if the key is cacheable. */
  bypassCache?: boolean;
  /** Preferred provider name; router will try it first if healthy. */
  preferredProvider?: string;
}

export interface ModelResponse {
  content: string;
  model: string;
  provider: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  latencyMs: number;
  cached: boolean;
}

export interface ModelStreamCallbacks {
  onMeta: (meta: { provider: string; model: string; cached: boolean }) => void;
  onChunk: (delta: string) => void;
}

export interface ProviderHealth {
  name: string;
  healthy: boolean;
  lastChecked: number;
  consecutiveFailures: number;
  cooldownUntil?: number;
  avgLatencyMs: number;
  totalRequests: number;
  totalFailures: number;
}

export interface ProviderConfig {
  name: string;
  models: string[];
  costPerInputToken: number;
  costPerOutputToken: number;
  maxContextLength: number;
  supportsStreaming: boolean;
  regions: string[];
  sovereign: boolean;
}

export interface SelectionCriteria {
  taskType?: string;
  costBudget?: number;
  latencyTarget?: number;
  contextLength?: number;
  sensitivityLevel?: string;
  sovereignMode?: boolean;
  preferredProvider?: string;
}

export interface Provider {
  name: string;
  config: ProviderConfig;
  invoke(request: ModelRequest): Promise<ModelResponse>;
  invokeStream?(request: ModelRequest, callbacks: ModelStreamCallbacks): Promise<ModelResponse>;
  checkHealth(): Promise<boolean>;
  estimateCost(request: ModelRequest): number;
}
