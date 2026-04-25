import { describe, expect, it } from 'vitest';
import type { ModelRequest, ModelResponse, Provider } from './types.js';
import { ModelRouter } from './router.js';

function createStreamingProvider(): Provider {
  return {
    name: 'streamer',
    config: {
      name: 'streamer',
      models: ['stream-model'],
      costPerInputToken: 0,
      costPerOutputToken: 0,
      maxContextLength: 200000,
      supportsStreaming: true,
      regions: ['local'],
      sovereign: true,
    },
    invoke: async (): Promise<ModelResponse> => ({
      content: 'streamed fallback',
      model: 'stream-model',
      provider: 'streamer',
      tokensIn: 1,
      tokensOut: 2,
      cost: 0,
      latencyMs: 1,
      cached: false,
    }),
    invokeStream: async (_request, callbacks): Promise<ModelResponse> => {
      callbacks.onMeta({ provider: 'streamer', model: 'stream-model', cached: false });
      callbacks.onChunk('streamed');
      callbacks.onChunk(' result');

      return {
        content: 'streamed result',
        model: 'stream-model',
        provider: 'streamer',
        tokensIn: 1,
        tokensOut: 2,
        cost: 0,
        latencyMs: 1,
        cached: false,
      };
    },
    checkHealth: async () => true,
    estimateCost: () => 0,
  };
}

describe('ModelRouter streaming', () => {
  it('emits native streaming chunks and returns the final response', async () => {
    const router = new ModelRouter({ registerDefaults: false });
    router.register(createStreamingProvider());

    const seenMeta: Array<{ provider: string; model: string; cached: boolean }> = [];
    const seenChunks: string[] = [];

    const response = await router.invokeStream(
      {
        messages: [{ role: 'user', content: 'stream this' }],
        bypassCache: true,
      } as ModelRequest,
      {
        onMeta: (meta) => seenMeta.push(meta),
        onChunk: (delta) => seenChunks.push(delta),
      },
    );

    expect(seenMeta).toEqual([{ provider: 'streamer', model: 'stream-model', cached: false }]);
    expect(seenChunks).toEqual(['streamed', ' result']);
    expect(response.content).toBe('streamed result');
    expect(response.provider).toBe('streamer');
  });
});