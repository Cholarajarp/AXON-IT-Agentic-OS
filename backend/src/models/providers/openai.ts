import type { ModelRequest, ModelResponse, Provider, ProviderConfig, ModelStreamCallbacks } from '../types.js';
import { consumeSseEvents } from './streaming.js';

interface OpenAIChoice {
  message?: { content?: string };
}

interface OpenAIResponse {
  model?: string;
  choices?: OpenAIChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

interface OpenAIStreamResponse {
  model?: string;
  choices?: Array<{
    delta?: { content?: string };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export class OpenAIProvider implements Provider {
  name = 'openai';
  config: ProviderConfig = {
    name: 'openai',
    models: ['gpt-5.2', 'gpt-5.4-mini'],
    costPerInputToken: 0.00001,
    costPerOutputToken: 0.00003,
    maxContextLength: 200000,
    supportsStreaming: true,
    regions: ['us', 'eu'],
    sovereign: false,
  };

  constructor(private readonly apiKey: string, private readonly baseUrl = 'https://api.openai.com/v1') {}

  async invoke(request: ModelRequest): Promise<ModelResponse> {
    const startedAt = Date.now();
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model || this.config.models[0],
        messages: request.messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
    }

    const body = await response.json() as OpenAIResponse;
    const tokensIn = body.usage?.prompt_tokens ?? estimateTokens(request.messages.map((m) => m.content).join(' '));
    const tokensOut = body.usage?.completion_tokens ?? estimateTokens(body.choices?.[0]?.message?.content ?? '');

    return {
      content: body.choices?.[0]?.message?.content ?? '',
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
    const model = request.model || this.config.models[0];
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 2048,
        stream: true,
        stream_options: { include_usage: true },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
    }

    callbacks.onMeta({ provider: this.name, model, cached: false });

    let content = '';
    let responseModel = model;
    let tokensIn: number | undefined;
    let tokensOut: number | undefined;

    await consumeSseEvents(response, ({ data }) => {
      if (data === '[DONE]') return;

      let event: OpenAIStreamResponse;
      try {
        event = JSON.parse(data) as OpenAIStreamResponse;
      } catch {
        return;
      }

      if (event.model) {
        responseModel = event.model;
      }

      const delta = event.choices?.[0]?.delta?.content ?? '';
      if (delta) {
        content += delta;
        callbacks.onChunk(delta);
      }

      tokensIn = event.usage?.prompt_tokens ?? tokensIn;
      tokensOut = event.usage?.completion_tokens ?? tokensOut;
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
    return Boolean(this.apiKey);
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
