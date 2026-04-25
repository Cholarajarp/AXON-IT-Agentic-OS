import { createHash } from 'node:crypto';
import type { ModelRequest, ModelResponse, Provider, ProviderConfig } from '../types.js';
import type { ModelStreamCallbacks } from '../types.js';
import { splitTextIntoChunks } from './streaming.js';

/**
 * LocalMockProvider
 *
 * A deterministic provider used for:
 *   - unit/integration tests (NODE_ENV=test, MODEL_PROVIDER_MOCK=1)
 *   - offline developer loops
 *   - the eval lab (pinning regression outputs without hitting real APIs)
 *
 * Output is keyed by (model, taskType, messages hash) so the same input
 * always produces the same response. A small fixture table is consulted
 * first so humans can hand-author golden responses for eval gates.
 */

type Fixture = {
  match: (request: ModelRequest) => boolean;
  respond: (request: ModelRequest) => string;
};

const DEFAULT_FIXTURES: Fixture[] = [
  {
    match: (req) => (req.taskType ?? '').toLowerCase().includes('triage'),
    respond: () => 'MOCK_TRIAGE: likely cause = upstream timeout; remediation = restart + check dependency health.',
  },
  {
    match: (req) => (req.taskType ?? '').toLowerCase().includes('blueprint'),
    respond: () => 'MOCK_BLUEPRINT: {stages:[plan,build,test,deploy],gates:[policy,eval,approval]}',
  },
  {
    match: (req) => (req.taskType ?? '').toLowerCase().includes('summary'),
    respond: (req) => `MOCK_SUMMARY: ${req.messages.at(-1)?.content.slice(0, 120) ?? ''}`,
  },
];

export class LocalMockProvider implements Provider {
  name = 'localMock';
  config: ProviderConfig = {
    name: 'localMock',
    models: ['mock-small', 'mock-large'],
    costPerInputToken: 0,
    costPerOutputToken: 0,
    maxContextLength: 1_000_000,
    supportsStreaming: true,
    regions: ['local'],
    sovereign: true,
  };

  private fixtures: Fixture[];
  private artificialLatencyMs: number;

  constructor(options: { fixtures?: Fixture[]; artificialLatencyMs?: number } = {}) {
    this.fixtures = [...(options.fixtures ?? []), ...DEFAULT_FIXTURES];
    this.artificialLatencyMs = options.artificialLatencyMs ?? 0;
  }

  async invoke(request: ModelRequest): Promise<ModelResponse> {
    const startedAt = Date.now();
    if (this.artificialLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.artificialLatencyMs));
    }

    const fixture = this.fixtures.find((f) => f.match(request));
    const content = fixture
      ? fixture.respond(request)
      : this.deterministicResponse(request);

    const inputText = request.messages.map((m) => m.content).join(' ');
    const tokensIn = estimateTokens(inputText);
    const tokensOut = estimateTokens(content);

    return {
      content,
      model: request.model || this.config.models[0],
      provider: this.name,
      tokensIn,
      tokensOut,
      cost: 0,
      latencyMs: Date.now() - startedAt,
      cached: false,
    };
  }

  async invokeStream(request: ModelRequest, callbacks: ModelStreamCallbacks): Promise<ModelResponse> {
    const response = await this.invoke(request);
    callbacks.onMeta({
      provider: response.provider,
      model: response.model,
      cached: false,
    });

    for (const chunk of splitTextIntoChunks(response.content)) {
      callbacks.onChunk(chunk);
    }

    return response;
  }

  async checkHealth(): Promise<boolean> {
    return true;
  }

  estimateCost(): number {
    return 0;
  }

  /**
   * Deterministic fallback: stable hash of (model, taskType, messages)
   * guarantees identical input produces identical output across runs.
   */
  private deterministicResponse(request: ModelRequest): string {
    const payload = JSON.stringify({
      model: request.model ?? 'mock-small',
      taskType: request.taskType ?? 'generic',
      messages: request.messages,
    });
    const digest = createHash('sha256').update(payload).digest('hex').slice(0, 12);
    const lastUser = request.messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
    return `MOCK[${digest}]: ${lastUser.slice(0, 240)}`;
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
