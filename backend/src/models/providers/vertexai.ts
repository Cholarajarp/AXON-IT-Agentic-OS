import { GoogleAuth } from 'google-auth-library';
import type { ModelRequest, ModelResponse, Provider, ProviderConfig, ModelStreamCallbacks } from '../types.js';
import { consumeSseEvents } from './streaming.js';

type VertexModelKey = 'gemini-2.5-pro' | 'gemini-2.5-flash';

interface VertexProviderOptions {
  project: string;
  location: string;
  modelIds?: Partial<Record<VertexModelKey, string>>;
}

interface VertexResponse {
  modelVersion?: string;
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

const DEFAULT_MODEL_IDS: Record<VertexModelKey, string> = {
  'gemini-2.5-pro': 'gemini-2.5-pro',
  'gemini-2.5-flash': 'gemini-2.5-flash',
};

const MODEL_PRICING: Record<VertexModelKey, { input: number; output: number }> = {
  'gemini-2.5-pro': { input: 0.000012, output: 0.000036 },
  'gemini-2.5-flash': { input: 0.000012, output: 0.000036 },
};

export class VertexAIProvider implements Provider {
  name = 'vertexai';

  config: ProviderConfig;

  private readonly auth: GoogleAuth;
  private readonly modelIds: Record<VertexModelKey, string>;

  constructor(
    private readonly options: VertexProviderOptions,
  ) {
    this.modelIds = {
      'gemini-2.5-pro': options.modelIds?.['gemini-2.5-pro'] ?? DEFAULT_MODEL_IDS['gemini-2.5-pro'],
      'gemini-2.5-flash': options.modelIds?.['gemini-2.5-flash'] ?? DEFAULT_MODEL_IDS['gemini-2.5-flash'],
    };

    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      projectId: options.project,
    });

    this.config = {
      name: 'vertexai',
      models: Object.keys(this.modelIds),
      costPerInputToken: MODEL_PRICING['gemini-2.5-pro'].input,
      costPerOutputToken: MODEL_PRICING['gemini-2.5-pro'].output,
      maxContextLength: 1000000,
      supportsStreaming: true,
      regions: [options.location],
      sovereign: true,
    };
  }

  async invoke(request: ModelRequest): Promise<ModelResponse> {
    const startedAt = Date.now();
    const system = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n');
    const messages = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      }));

    const { modelKey, modelId } = this.resolveModel(request.model);
    const response = await fetch(this.buildEndpoint(modelId), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: messages,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        generationConfig: {
          temperature: request.temperature ?? 0.2,
          maxOutputTokens: request.maxTokens ?? 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Vertex AI request failed: ${response.status} ${await response.text()}`);
    }

    const body = await response.json() as VertexResponse;
    const content = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
    const tokensIn = body.usageMetadata?.promptTokenCount ?? estimateTokens(request.messages.map((message) => message.content).join(' '));
    const tokensOut = body.usageMetadata?.candidatesTokenCount ?? estimateTokens(content);

    return {
      content,
      model: body.modelVersion || modelId,
      provider: this.name,
      tokensIn,
      tokensOut,
      cost: this.calculateCost(modelKey, tokensIn, tokensOut),
      latencyMs: Date.now() - startedAt,
      cached: false,
    };
  }

  async invokeStream(request: ModelRequest, callbacks: ModelStreamCallbacks): Promise<ModelResponse> {
    const startedAt = Date.now();
    const system = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n');
    const messages = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      }));

    const { modelKey, modelId } = this.resolveModel(request.model);
    const response = await fetch(`${this.buildEndpoint(modelId)}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: messages,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        generationConfig: {
          temperature: request.temperature ?? 0.2,
          maxOutputTokens: request.maxTokens ?? 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Vertex AI request failed: ${response.status} ${await response.text()}`);
    }

    callbacks.onMeta({ provider: this.name, model: modelId, cached: false });

    let content = '';
    let responseModel = modelId;
    let tokensIn: number | undefined;
    let tokensOut: number | undefined;

    await consumeSseEvents(response, ({ data }) => {
      if (data === '[DONE]') return;

      let body: VertexResponse;
      try {
        body = JSON.parse(data) as VertexResponse;
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
      cost: this.calculateCost(modelKey, totalTokensIn, totalTokensOut),
      latencyMs: Date.now() - startedAt,
      cached: false,
    };
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch {
      return false;
    }
  }

  estimateCost(request: ModelRequest): number {
    const { modelKey } = this.resolveModel(request.model);
    const input = estimateTokens(request.messages.map((message) => message.content).join(' '));
    const output = request.maxTokens ?? 2048;
    return this.calculateCost(modelKey, input, output);
  }

  private resolveModel(requestedModel?: string): { modelKey: VertexModelKey; modelId: string } {
    if (requestedModel === 'gemini-2.5-pro' || requestedModel === 'gemini-2.5-flash') {
      return { modelKey: requestedModel, modelId: this.modelIds[requestedModel] };
    }

    const matchedModel = Object.entries(this.modelIds).find(([, modelId]) => modelId === requestedModel);
    if (matchedModel) {
      const [modelKey, modelId] = matchedModel as [VertexModelKey, string];
      return { modelKey, modelId };
    }

    if (requestedModel) {
      return { modelKey: 'gemini-2.5-pro', modelId: requestedModel };
    }

    return { modelKey: 'gemini-2.5-pro', modelId: this.modelIds['gemini-2.5-pro'] };
  }

  private calculateCost(modelKey: VertexModelKey, tokensIn: number, tokensOut: number): number {
    const pricing = MODEL_PRICING[modelKey];
    return tokensIn * pricing.input + tokensOut * pricing.output;
  }

  private buildEndpoint(modelId: string): string {
    const project = encodeURIComponent(this.options.project);
    const location = encodeURIComponent(this.options.location);
    const model = encodeURIComponent(modelId);
    return `https://${this.options.location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
  }

  private async getAccessToken(): Promise<string> {
    const client = await this.auth.getClient();
    const token = await client.getAccessToken();
    if (!token) {
      throw new Error('Vertex AI authentication failed: no access token available');
    }

    if (typeof token === 'string') {
      return token;
    }

    if (token.token) {
      return token.token;
    }

    throw new Error('Vertex AI authentication failed: empty access token');
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}