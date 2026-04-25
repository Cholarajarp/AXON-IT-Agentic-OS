import type { ModelRequest, ModelResponse, Provider, ProviderConfig, ModelStreamCallbacks } from '../types.js';
import { consumeSseEvents } from './streaming.js';

interface AnthropicResponse {
  model?: string;
  content?: Array<{ type: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

interface AnthropicStreamEvent {
  type?: string;
  message?: {
    model?: string;
  };
  delta?: {
    text?: string;
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export class AnthropicProvider implements Provider {
  name = 'anthropic';
  config: ProviderConfig = {
    name: 'anthropic',
    models: ['claude-opus-4-7', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
    costPerInputToken: 0.000015,
    costPerOutputToken: 0.000075,
    maxContextLength: 200000,
    supportsStreaming: true,
    regions: ['us', 'eu'],
    sovereign: false,
  };

  constructor(private readonly apiKey: string, private readonly baseUrl = 'https://api.anthropic.com/v1') {}

  async invoke(request: ModelRequest): Promise<ModelResponse> {
    const startedAt = Date.now();
    const system = request.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const messages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model || this.config.models[1],
        system: system || undefined,
        messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed: ${response.status} ${await response.text()}`);
    }

    const body = await response.json() as AnthropicResponse;
    const content = body.content?.map((part) => part.text ?? '').join('') ?? '';
    const tokensIn = body.usage?.input_tokens ?? estimateTokens(request.messages.map((m) => m.content).join(' '));
    const tokensOut = body.usage?.output_tokens ?? estimateTokens(content);

    return {
      content,
      model: body.model || request.model || this.config.models[1],
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
    const system = request.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const messages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

    const model = request.model || this.config.models[1];
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        system: system || undefined,
        messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 2048,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed: ${response.status} ${await response.text()}`);
    }

    callbacks.onMeta({ provider: this.name, model, cached: false });

    let content = '';
    let responseModel = model;
    let tokensIn: number | undefined;
    let tokensOut: number | undefined;

    await consumeSseEvents(response, ({ data }) => {
      if (data === '[DONE]') return;

      let event: AnthropicStreamEvent;
      try {
        event = JSON.parse(data) as AnthropicStreamEvent;
      } catch {
        return;
      }

      if (event.type === 'message_start' && event.message?.model) {
        responseModel = event.message.model;
      }

      if (event.type === 'content_block_delta') {
        const deltaText = event.delta?.text ?? '';
        if (deltaText) {
          content += deltaText;
          callbacks.onChunk(deltaText);
        }
      }

      if (event.type === 'message_delta') {
        tokensIn = event.usage?.input_tokens ?? tokensIn;
        tokensOut = event.usage?.output_tokens ?? tokensOut;
      }
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
