import type { ModelRequest, ModelResponse, Provider, ProviderConfig, ModelStreamCallbacks } from '../types.js';
import { consumeSseEvents } from './streaming.js';

/**
 * vLLMProvider
 *
 * Talks to any vLLM server exposing the OpenAI-compatible /v1/chat/completions API.
 * Treated as sovereign because the endpoint is enterprise-hosted (VPC, on-prem, or air-gapped).
 * Configure via VLLM_BASE_URL (e.g. http://vllm.internal:8000/v1) and optional VLLM_API_KEY.
 */

interface VLLMChoice {
  message?: { content?: string };
}

interface VLLMResponse {
  model?: string;
  choices?: VLLMChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

interface VLLMStreamResponse {
  model?: string;
  choices?: Array<{ delta?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export interface VLLMProviderOptions {
  baseUrl: string;
  apiKey?: string;
  models?: string[];
  defaultModel?: string;
  maxContextLength?: number;
  costPerInputToken?: number;
  costPerOutputToken?: number;
}

export class VLLMProvider implements Provider {
  name = 'vllm';
  config: ProviderConfig;

  private baseUrl: string;
  private apiKey?: string;

  constructor(options: VLLMProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.config = {
      name: 'vllm',
      models: options.models ?? ['mistral-large', 'qwen2.5-coder-32b', 'llama-3.1-70b'],
      costPerInputToken: options.costPerInputToken ?? 0,
      costPerOutputToken: options.costPerOutputToken ?? 0,
      maxContextLength: options.maxContextLength ?? 128000,
      supportsStreaming: true,
      regions: ['private'],
      sovereign: true,
    };
  }

  async invoke(request: ModelRequest): Promise<ModelResponse> {
    const startedAt = Date.now();

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: request.model || this.config.models[0],
        messages: request.messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`vLLM request failed: ${response.status} ${await response.text()}`);
    }

    const body = (await response.json()) as VLLMResponse;
    const content = body.choices?.[0]?.message?.content ?? '';
    const tokensIn = body.usage?.prompt_tokens ?? estimateTokens(request.messages.map((m) => m.content).join(' '));
    const tokensOut = body.usage?.completion_tokens ?? estimateTokens(content);

    return {
      content,
      model: body.model || request.model || this.config.models[0],
      provider: this.name,
      tokensIn,
      tokensOut,
      cost: this.calculateCost(tokensIn, tokensOut),
      latencyMs: Date.now() - startedAt,
      cached: false,
    };
  }

  async invokeStream(request: ModelRequest, callbacks: ModelStreamCallbacks): Promise<ModelResponse> {
    const startedAt = Date.now();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    const model = request.model || this.config.models[0];
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 2048,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`vLLM request failed: ${response.status} ${await response.text()}`);
    }

    callbacks.onMeta({ provider: this.name, model, cached: false });

    let content = '';
    let responseModel = model;
    let tokensIn: number | undefined;
    let tokensOut: number | undefined;

    await consumeSseEvents(response, ({ data }) => {
      if (data === '[DONE]') return;

      let body: VLLMStreamResponse;
      try {
        body = JSON.parse(data) as VLLMStreamResponse;
      } catch {
        return;
      }

      if (body.model) {
        responseModel = body.model;
      }

      const delta = body.choices?.[0]?.delta?.content ?? '';
      if (delta) {
        content += delta;
        callbacks.onChunk(delta);
      }

      tokensIn = body.usage?.prompt_tokens ?? tokensIn;
      tokensOut = body.usage?.completion_tokens ?? tokensOut;
    });

    const totalTokensIn = tokensIn ?? estimateTokens(request.messages.map((m) => m.content).join(' '));
    const totalTokensOut = tokensOut ?? estimateTokens(content);

    return {
      content,
      model: responseModel,
      provider: this.name,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      cost: this.calculateCost(totalTokensIn, totalTokensOut),
      latencyMs: Date.now() - startedAt,
      cached: false,
    };
  }

  async checkHealth(): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
      const response = await fetch(`${this.baseUrl}/models`, { headers });
      return response.ok;
    } catch {
      return false;
    }
  }

  estimateCost(request: ModelRequest): number {
    const input = estimateTokens(request.messages.map((m) => m.content).join(' '));
    const output = request.maxTokens ?? 2048;
    return this.calculateCost(input, output);
  }

  private calculateCost(tokensIn: number, tokensOut: number): number {
    return tokensIn * this.config.costPerInputToken + tokensOut * this.config.costPerOutputToken;
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
