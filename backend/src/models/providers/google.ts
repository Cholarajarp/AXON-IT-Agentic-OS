import type { ModelRequest, ModelResponse, Provider, ProviderConfig, ModelStreamCallbacks } from '../types.js';
import { consumeSseEvents } from './streaming.js';

interface GoogleContentPart {
  text?: string;
}

interface GoogleCandidate {
  content?: {
    parts?: GoogleContentPart[];
  };
}

interface GoogleResponse {
  modelVersion?: string;
  candidates?: GoogleCandidate[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export class GoogleProvider implements Provider {
  name = 'google';

  config: ProviderConfig = {
    name: 'google',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash'],
    costPerInputToken: 0.000012,
    costPerOutputToken: 0.000036,
    maxContextLength: 1000000,
    supportsStreaming: true,
    regions: ['global'],
    sovereign: false,
  };

  constructor(private readonly apiKey: string, private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta') {}

  async invoke(request: ModelRequest): Promise<ModelResponse> {
    const startedAt = Date.now();
    const model = request.model || this.config.models[0];
    const system = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n');
    const contents = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      }));

    const response = await fetch(`${this.baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(this.apiKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
        generationConfig: {
          temperature: request.temperature ?? 0.2,
          maxOutputTokens: request.maxTokens ?? 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Google request failed: ${response.status} ${await response.text()}`);
    }

    const body = await response.json() as GoogleResponse;
    const content = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
    const tokensIn = body.usageMetadata?.promptTokenCount ?? estimateTokens(request.messages.map((message) => message.content).join(' '));
    const tokensOut = body.usageMetadata?.candidatesTokenCount ?? estimateTokens(content);

    return {
      content,
      model: body.modelVersion || model,
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
    const system = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n');
    const contents = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      }));

    const response = await fetch(`${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
        generationConfig: {
          temperature: request.temperature ?? 0.2,
          maxOutputTokens: request.maxTokens ?? 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Google request failed: ${response.status} ${await response.text()}`);
    }

    callbacks.onMeta({ provider: this.name, model, cached: false });

    let content = '';
    let responseModel = model;
    let tokensIn: number | undefined;
    let tokensOut: number | undefined;

    await consumeSseEvents(response, ({ data }) => {
      if (data === '[DONE]') return;

      let body: GoogleResponse;
      try {
        body = JSON.parse(data) as GoogleResponse;
      } catch {
        return;
      }

      if (body.modelVersion) {
        responseModel = body.modelVersion;
      }

      const delta = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
      if (delta) {
        content += delta;
        callbacks.onChunk(delta);
      }

      tokensIn = body.usageMetadata?.promptTokenCount ?? tokensIn;
      tokensOut = body.usageMetadata?.candidatesTokenCount ?? tokensOut;
    });

    const totalTokensIn = tokensIn ?? estimateTokens(request.messages.map((message) => message.content).join(' '));
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
    const input = estimateTokens(request.messages.map((message) => message.content).join(' '));
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