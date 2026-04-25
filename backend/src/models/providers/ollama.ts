import type { ModelRequest, ModelResponse, Provider, ProviderConfig, ModelStreamCallbacks } from '../types.js';
import { consumeLineEvents } from './streaming.js';

interface OllamaResponse {
  model?: string;
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaStreamResponse {
  model?: string;
  message?: { content?: string };
  response?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  done?: boolean;
}

export class OllamaProvider implements Provider {
  name = 'ollama';
  config: ProviderConfig = {
    name: 'ollama',
    models: ['llama3.1:70b', 'qwen2.5-coder:32b'],
    costPerInputToken: 0,
    costPerOutputToken: 0,
    maxContextLength: 128000,
    supportsStreaming: true,
    regions: ['local'],
    sovereign: true,
  };

  constructor(private readonly baseUrl: string) {}

  async invoke(request: ModelRequest): Promise<ModelResponse> {
    const startedAt = Date.now();
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model || this.config.models[0],
        messages: request.messages,
        stream: false,
        options: {
          temperature: request.temperature ?? 0.2,
          num_predict: request.maxTokens ?? 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${await response.text()}`);
    }

    const body = await response.json() as OllamaResponse;
    const content = body.message?.content ?? '';
    const tokensIn = body.prompt_eval_count ?? estimateTokens(request.messages.map((m) => m.content).join(' '));
    const tokensOut = body.eval_count ?? estimateTokens(content);

    return {
      content,
      model: body.model || request.model || this.config.models[0],
      provider: this.name,
      tokensIn,
      tokensOut,
      cost: 0,
      latencyMs: Date.now() - startedAt,
      cached: false,
    };
  }

  async invokeStream(request: ModelRequest, callbacks: ModelStreamCallbacks): Promise<ModelResponse> {
    const startedAt = Date.now();
    const model = request.model || this.config.models[0];
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: request.messages,
        stream: true,
        options: {
          temperature: request.temperature ?? 0.2,
          num_predict: request.maxTokens ?? 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${await response.text()}`);
    }

    callbacks.onMeta({ provider: this.name, model, cached: false });

    let content = '';
    let responseModel = model;
    let tokensIn: number | undefined;
    let tokensOut: number | undefined;

    await consumeLineEvents(response, (line) => {
      let body: OllamaStreamResponse;
      try {
        body = JSON.parse(line) as OllamaStreamResponse;
      } catch {
        return;
      }

      if (body.model) {
        responseModel = body.model;
      }

      const delta = body.message?.content ?? body.response ?? '';
      if (delta) {
        content += delta;
        callbacks.onChunk(delta);
      }

      tokensIn = body.prompt_eval_count ?? tokensIn;
      tokensOut = body.eval_count ?? tokensOut;
    });

    const totalTokensIn = tokensIn ?? estimateTokens(request.messages.map((m) => m.content).join(' '));
    const totalTokensOut = tokensOut ?? estimateTokens(content);

    return {
      content,
      model: responseModel,
      provider: this.name,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      cost: 0,
      latencyMs: Date.now() - startedAt,
      cached: false,
    };
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  estimateCost(): number {
    return 0;
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
