import { BedrockRuntimeClient, ConverseCommand, ConverseStreamCommand, type ConverseCommandInput } from '@aws-sdk/client-bedrock-runtime';
import type { ModelRequest, ModelResponse, Provider, ProviderConfig, ModelStreamCallbacks } from '../types.js';

type BedrockModelKey = 'claude-sonnet-bedrock' | 'amazon-nova-pro';

interface BedrockProviderOptions {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  modelIds?: Partial<Record<BedrockModelKey, string>>;
}

interface BedrockResponse {
  output?: {
    message?: {
      content?: Array<{ text?: string }>;
    };
  };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

const DEFAULT_MODEL_IDS: Record<BedrockModelKey, string> = {
  'claude-sonnet-bedrock': 'anthropic.claude-3-5-sonnet-20240620-v1:0',
  'amazon-nova-pro': 'amazon.nova-pro-v1:0',
};

const MODEL_PRICING: Record<BedrockModelKey, { input: number; output: number }> = {
  'claude-sonnet-bedrock': { input: 0.000015, output: 0.000075 },
  'amazon-nova-pro': { input: 0.000008, output: 0.000032 },
};

export class BedrockProvider implements Provider {
  name = 'bedrock';

  config: ProviderConfig;

  private readonly client: BedrockRuntimeClient;
  private readonly modelIds: Record<BedrockModelKey, string>;
  private readonly defaultModel: BedrockModelKey = 'claude-sonnet-bedrock';

  constructor(options: BedrockProviderOptions) {
    this.modelIds = {
      'claude-sonnet-bedrock': options.modelIds?.['claude-sonnet-bedrock'] ?? process.env.BEDROCK_CLAUDE_MODEL_ID ?? DEFAULT_MODEL_IDS['claude-sonnet-bedrock'],
      'amazon-nova-pro': options.modelIds?.['amazon-nova-pro'] ?? process.env.BEDROCK_NOVA_MODEL_ID ?? DEFAULT_MODEL_IDS['amazon-nova-pro'],
    };

    this.client = new BedrockRuntimeClient({
      region: options.region,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
        ...(options.sessionToken ? { sessionToken: options.sessionToken } : {}),
      },
    });

    this.config = {
      name: 'bedrock',
      models: Object.keys(this.modelIds),
      costPerInputToken: MODEL_PRICING[this.defaultModel].input,
      costPerOutputToken: MODEL_PRICING[this.defaultModel].output,
      maxContextLength: 200000,
      supportsStreaming: true,
      regions: [options.region],
      sovereign: true,
    };
  }

  async invoke(request: ModelRequest): Promise<ModelResponse> {
    const startedAt = Date.now();
    const system = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n');
    const messages: NonNullable<ConverseCommandInput['messages']> = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: (message.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: [{ text: message.content }],
      }));

    const { modelKey, modelId } = this.resolveModel(request.model);
    const response = await this.client.send(new ConverseCommand({
      modelId,
      messages,
      ...(system ? { system: [{ text: system }] } : {}),
      inferenceConfig: {
        temperature: request.temperature ?? 0.2,
        maxTokens: request.maxTokens ?? 2048,
      },
    }));

    const body = response as BedrockResponse;
    const content = body.output?.message?.content?.map((part) => part.text ?? '').join('') ?? '';
    const tokensIn = body.usage?.inputTokens ?? estimateTokens(request.messages.map((message) => message.content).join(' '));
    const tokensOut = body.usage?.outputTokens ?? estimateTokens(content);

    return {
      content,
      model: modelId,
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
    const messages: NonNullable<ConverseCommandInput['messages']> = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: (message.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: [{ text: message.content }],
      }));

    const { modelKey, modelId } = this.resolveModel(request.model);
    const response = await this.client.send(new ConverseStreamCommand({
      modelId,
      messages,
      ...(system ? { system: [{ text: system }] } : {}),
      inferenceConfig: {
        temperature: request.temperature ?? 0.2,
        maxTokens: request.maxTokens ?? 2048,
      },
    }));

    const stream = (response as { stream?: AsyncIterable<Record<string, unknown>> }).stream;
    if (!stream) {
      throw new Error('Bedrock streaming response missing stream');
    }

    callbacks.onMeta({ provider: this.name, model: modelId, cached: false });

    let content = '';
    let tokensIn: number | undefined;
    let tokensOut: number | undefined;

    for await (const event of stream) {
      const contentBlockDelta = event as { contentBlockDelta?: { delta?: { text?: string } } };
      const text = contentBlockDelta.contentBlockDelta?.delta?.text ?? '';
      if (text) {
        content += text;
        callbacks.onChunk(text);
      }

      const metadata = event as { metadata?: { usage?: { inputTokens?: number; outputTokens?: number } } };
      tokensIn = metadata.metadata?.usage?.inputTokens ?? tokensIn;
      tokensOut = metadata.metadata?.usage?.outputTokens ?? tokensOut;
    }

    const totalTokensIn = tokensIn ?? estimateTokens(request.messages.map((message) => message.content).join(' '));
    const totalTokensOut = tokensOut ?? estimateTokens(content);

    return {
      content,
      model: modelId,
      provider: this.name,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      cost: this.calculateCost(modelKey, totalTokensIn, totalTokensOut),
      latencyMs: Date.now() - startedAt,
      cached: false,
    };
  }

  async checkHealth(): Promise<boolean> {
    return true;
  }

  estimateCost(request: ModelRequest): number {
    const { modelKey } = this.resolveModel(request.model);
    const input = estimateTokens(request.messages.map((message) => message.content).join(' '));
    const output = request.maxTokens ?? 2048;
    return this.calculateCost(modelKey, input, output);
  }

  private resolveModel(requestedModel?: string): { modelKey: BedrockModelKey; modelId: string } {
    if (requestedModel === 'claude-sonnet-bedrock' || requestedModel === 'amazon-nova-pro') {
      return { modelKey: requestedModel, modelId: this.modelIds[requestedModel] };
    }

    const matchedModel = Object.entries(this.modelIds).find(([, modelId]) => modelId === requestedModel);
    if (matchedModel) {
      const [modelKey, modelId] = matchedModel as [BedrockModelKey, string];
      return { modelKey, modelId };
    }

    if (requestedModel) {
      return { modelKey: this.defaultModel, modelId: requestedModel };
    }

    return { modelKey: this.defaultModel, modelId: this.modelIds[this.defaultModel] };
  }

  private calculateCost(modelKey: BedrockModelKey, tokensIn: number, tokensOut: number): number {
    const pricing = MODEL_PRICING[modelKey];
    return tokensIn * pricing.input + tokensOut * pricing.output;
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}