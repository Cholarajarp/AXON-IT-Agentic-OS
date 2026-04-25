import type { ModelRequest, ModelResponse, Provider, ProviderHealth, SelectionCriteria } from './types.js';
import type { ModelStreamCallbacks } from './types.js';
import { BedrockProvider } from './providers/bedrock.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { GoogleProvider } from './providers/google.js';
import { OllamaProvider } from './providers/ollama.js';
import { OpenAIProvider } from './providers/openai.js';
import { VertexAIProvider } from './providers/vertexai.js';
import { VLLMProvider } from './providers/vllm.js';
import { LocalMockProvider } from './providers/localMock.js';
import { ResponseCache } from './cache.js';
import { sql } from '../db/connection.js';
import { splitTextIntoChunks } from './providers/streaming.js';
import { buildSelectionCriteria, selectBestProvider } from './routing-policy.js';
import type { ProviderConfigInput, SavedProviderConfig } from '../services/model-provider-config.js';

const BACKOFF_BASE_MS = 250;
const MAX_RETRIES = 3;
const COOLDOWN_MS = 30000;
const JITTER_FACTOR = 0.25;

export interface ModelRouterOptions {
  registerDefaults?: boolean;
  cache?: ResponseCache | null;
  costLedger?: boolean;
}

export class ModelRouter {
  private providers = new Map<string, Provider>();
  private health = new Map<string, ProviderHealth>();
  private cache: ResponseCache | null;
  private costLedger: boolean;

  constructor(options: ModelRouterOptions = {}) {
    this.cache = options.cache === null ? null : (options.cache ?? new ResponseCache());
    this.costLedger = options.costLedger ?? true;
    if (options.registerDefaults !== false) {
      this.registerDefaults();
    }
  }

  private registerDefaults() {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const googleKey = process.env.GOOGLE_API_KEY;
    const vertexProject = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    const vertexLocation = process.env.GCP_LOCATION || process.env.GOOGLE_CLOUD_LOCATION;
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL;
    const vllmBaseUrl = process.env.VLLM_BASE_URL;
    const bedrockRegion = process.env.AWS_REGION;
    const bedrockAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const bedrockSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const bedrockSessionToken = process.env.AWS_SESSION_TOKEN;
    const bedrockClaudeModelId = process.env.BEDROCK_CLAUDE_MODEL_ID;
    const bedrockNovaModelId = process.env.BEDROCK_NOVA_MODEL_ID;

    if (anthropicKey) this.register(new AnthropicProvider(anthropicKey, process.env.ANTHROPIC_BASE_URL));
    if (openaiKey) this.register(new OpenAIProvider(openaiKey, process.env.OPENAI_BASE_URL));
    if (googleKey) this.register(new GoogleProvider(googleKey, process.env.GOOGLE_BASE_URL));
    if (vertexProject && vertexLocation) {
      this.register(new VertexAIProvider({
        project: vertexProject,
        location: vertexLocation,
      }));
    }
    if (ollamaBaseUrl) this.register(new OllamaProvider(ollamaBaseUrl));
    if (vllmBaseUrl) {
      this.register(new VLLMProvider({
        baseUrl: vllmBaseUrl,
        apiKey: process.env.VLLM_API_KEY,
      }));
    }
    if (bedrockRegion && bedrockAccessKeyId && bedrockSecretAccessKey) {
      this.register(new BedrockProvider({
        region: bedrockRegion,
        accessKeyId: bedrockAccessKeyId,
        secretAccessKey: bedrockSecretAccessKey,
        sessionToken: bedrockSessionToken,
        modelIds: {
          'claude-sonnet-bedrock': bedrockClaudeModelId,
          'amazon-nova-pro': bedrockNovaModelId,
        },
      }));
    }

    // Always register a deterministic mock so dev/test/eval never get "no providers".
    if (process.env.NODE_ENV === 'test' || process.env.MODEL_PROVIDER_MOCK === '1' || this.providers.size === 0) {
      this.register(new LocalMockProvider());
    }
  }

  register(provider: Provider) {
    this.providers.set(provider.name, provider);
    this.health.set(provider.name, {
      name: provider.name,
      healthy: true,
      lastChecked: Date.now(),
      consecutiveFailures: 0,
      avgLatencyMs: 0,
      totalRequests: 0,
      totalFailures: 0,
    });
  }

  unregister(name: string): boolean {
    const removed = this.providers.delete(name);
    this.health.delete(name);
    return removed;
  }

  configureProvider(config: SavedProviderConfig | ProviderConfigInput): Provider {
    if (!config.enabled) {
      this.unregister(config.provider);
      throw new Error(`Provider ${config.provider} is disabled`);
    }

    switch (config.provider) {
      case 'anthropic': {
        if (!config.apiKey) throw new Error('Anthropic API key is required');
        const provider = new AnthropicProvider(config.apiKey, config.baseUrl);
        this.register(provider);
        return provider;
      }
      case 'openai': {
        if (!config.apiKey) throw new Error('OpenAI API key is required');
        const provider = new OpenAIProvider(config.apiKey, config.baseUrl);
        this.register(provider);
        return provider;
      }
      case 'google': {
        if (!config.apiKey) throw new Error('Google API key is required');
        const provider = new GoogleProvider(config.apiKey, config.baseUrl);
        this.register(provider);
        return provider;
      }
      case 'ollama': {
        if (!config.baseUrl) throw new Error('Ollama base URL is required');
        const provider = new OllamaProvider(config.baseUrl);
        this.register(provider);
        return provider;
      }
      case 'vllm': {
        if (!config.baseUrl) throw new Error('vLLM base URL is required');
        const provider = new VLLMProvider({ baseUrl: config.baseUrl, apiKey: config.apiKey });
        this.register(provider);
        return provider;
      }
      case 'bedrock': {
        if (!config.region || !config.accessKeyId || !config.secretAccessKey) {
          throw new Error('AWS region, access key id, and secret access key are required');
        }
        const provider = new BedrockProvider({
          region: config.region,
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
          sessionToken: config.sessionToken,
          modelIds: config.modelIds,
        });
        this.register(provider);
        return provider;
      }
      default:
        throw new Error(`Unsupported provider: ${(config as { provider: string }).provider}`);
    }
  }

  async hydrateConfiguredProviders(configs: SavedProviderConfig[]): Promise<string[]> {
    const registered: string[] = [];
    for (const config of configs) {
      if (!config.enabled) continue;
      try {
        this.configureProvider(config);
        registered.push(config.provider);
      } catch {
        // A single broken local credential should not prevent the API from starting.
      }
    }
    return registered;
  }

  async invoke(request: ModelRequest): Promise<ModelResponse> {
    // Short-circuit on cache hit (deterministic requests only).
    if (this.cache && !request.bypassCache) {
      const cached = this.cache.get(request);
      if (cached) return cached;
    }

    const criteria = buildSelectionCriteria(request);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const provider = this.selectProvider(request, criteria);
      if (!provider) {
        throw new Error('No healthy providers available');
      }

      try {
        const start = Date.now();
        const response = await provider.invoke(request);
        const latencyMs = Date.now() - start;

        this.recordSuccess(provider.name, latencyMs);
        await this.writeCostLedger(request, response, latencyMs);

        if (this.cache && !request.bypassCache) {
          this.cache.set(request, response);
        }

        return response;
      } catch (err) {
        lastError = err as Error;
        this.recordFailure(provider.name);

        const delay = this.calculateBackoff(attempt);
        await this.sleep(delay);
      }
    }

    throw lastError || new Error('All provider attempts failed');
  }

  async invokeStream(request: ModelRequest, callbacks: ModelStreamCallbacks): Promise<ModelResponse> {
    if (this.cache && !request.bypassCache) {
      const cached = this.cache.get(request);
      if (cached) {
        callbacks.onMeta({
          provider: cached.provider,
          model: cached.model,
          cached: true,
        });
        for (const chunk of splitTextIntoChunks(cached.content)) {
          callbacks.onChunk(chunk);
        }
        return cached;
      }
    }

    const criteria = buildSelectionCriteria(request);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const provider = this.selectProvider(request, criteria);
      if (!provider) {
        throw new Error('No healthy providers available');
      }

      let emittedChunk = false;

      try {
        const start = Date.now();
        const response = await this.invokeProviderStream(provider, request, {
          onMeta: callbacks.onMeta,
          onChunk: (delta) => {
            emittedChunk = true;
            callbacks.onChunk(delta);
          },
        });
        const latencyMs = Date.now() - start;

        this.recordSuccess(provider.name, latencyMs);
        await this.writeCostLedger(request, response, latencyMs);

        if (this.cache && !request.bypassCache) {
          this.cache.set(request, response);
        }

        return response;
      } catch (err) {
        lastError = err as Error;
        this.recordFailure(provider.name);

        if (emittedChunk) {
          throw lastError;
        }

        const delay = this.calculateBackoff(attempt);
        await this.sleep(delay);
      }
    }

    throw lastError || new Error('All provider attempts failed');
  }

  selectProvider(request: ModelRequest, criteria: SelectionCriteria): Provider | null {
    return selectBestProvider(request, criteria, this.providers, this.health);
  }

  private async invokeProviderStream(
    provider: Provider,
    request: ModelRequest,
    callbacks: ModelStreamCallbacks,
  ): Promise<ModelResponse> {
    if (provider.invokeStream) {
      return provider.invokeStream(request, callbacks);
    }

    const response = await provider.invoke(request);
    callbacks.onMeta({
      provider: response.provider,
      model: response.model,
      cached: response.cached,
    });

    for (const chunk of splitTextIntoChunks(response.content)) {
      callbacks.onChunk(chunk);
    }

    return response;
  }

  private recordSuccess(name: string, latencyMs: number) {
    const h = this.health.get(name);
    if (!h) return;
    h.healthy = true;
    h.consecutiveFailures = 0;
    h.lastChecked = Date.now();
    h.totalRequests++;
    h.avgLatencyMs = (h.avgLatencyMs * (h.totalRequests - 1) + latencyMs) / h.totalRequests;
  }

  private recordFailure(name: string) {
    const h = this.health.get(name);
    if (!h) return;
    h.consecutiveFailures++;
    h.totalFailures++;
    h.totalRequests++;
    h.lastChecked = Date.now();
    if (h.consecutiveFailures >= 3) {
      h.healthy = false;
      h.cooldownUntil = Date.now() + COOLDOWN_MS;
    }
  }

  private calculateBackoff(attempt: number): number {
    const exponential = BACKOFF_BASE_MS * Math.pow(2, attempt);
    const jitter = exponential * JITTER_FACTOR * (Math.random() * 2 - 1);
    return Math.round(exponential + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async writeCostLedger(request: ModelRequest, response: ModelResponse, durationMs: number) {
    if (!this.costLedger) return;

    try {
      await sql`
        INSERT INTO cost_ledger (tenant_id, workflow_id, provider, model, tokens_in, tokens_out, cost, duration_ms, domain)
        VALUES (
          ${request.tenantId || 'default'},
          ${null},
          ${response.provider},
          ${response.model},
          ${response.tokensIn},
          ${response.tokensOut},
          ${response.cost},
          ${durationMs},
          ${'model-router'}
        )
      `;
    } catch {
      // DB may not be available in test mode; the router must still succeed.
    }
  }

  getHealth(): ProviderHealth[] {
    return Array.from(this.health.values());
  }

  getProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getCacheSize(): number {
    return this.cache?.size() ?? 0;
  }

  clearCache(): void {
    this.cache?.clear();
  }

  async checkAllHealth(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    for (const [name, provider] of this.providers) {
      try {
        const healthy = await provider.checkHealth();
        results.set(name, healthy);
        const h = this.health.get(name)!;
        h.healthy = healthy;
        h.lastChecked = Date.now();
        if (healthy) {
          h.consecutiveFailures = 0;
          h.cooldownUntil = undefined;
        }
      } catch {
        results.set(name, false);
      }
    }
    return results;
  }
}

export const modelRouter = new ModelRouter();
