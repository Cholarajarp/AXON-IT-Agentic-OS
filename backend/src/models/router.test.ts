import { describe, expect, it, vi } from 'vitest';
import type { ModelRequest, ModelResponse, Provider } from './types.js';
import { ModelRouter } from './router.js';

function createProvider(
  name: string,
  overrides: Partial<Provider['config']> & {
    estimatedCost: number;
    invoke?: Provider['invoke'];
    checkHealth?: Provider['checkHealth'];
  },
): Provider {
  return {
    name,
    config: {
      name,
      models: [`${name}-model`],
      costPerInputToken: 0.00001,
      costPerOutputToken: 0.00003,
      maxContextLength: 200000,
      supportsStreaming: true,
      regions: ['global'],
      sovereign: false,
      ...overrides,
    },
    invoke: overrides.invoke ?? (async (request: ModelRequest): Promise<ModelResponse> => {
      return {
        content: `${name}:${request.taskType ?? 'task'}`,
        model: `${name}-model`,
        provider: name,
        tokensIn: 8,
        tokensOut: 8,
        cost: overrides.estimatedCost,
        latencyMs: 8,
        cached: false,
      };
    }),
    checkHealth: overrides.checkHealth ?? (async () => true),
    estimateCost(): number {
      return overrides.estimatedCost;
    },
  };
}

describe('ModelRouter policy', () => {
  it('prefers sovereign providers for enterprise and restricted tasks', () => {
    const router = new ModelRouter({ registerDefaults: false });
    router.register(createProvider('openai', {
      sovereign: false,
      supportsStreaming: true,
      costPerOutputToken: 0.00003,
      estimatedCost: 0.08,
    }));
    router.register(createProvider('bedrock', {
      sovereign: true,
      supportsStreaming: true,
      costPerOutputToken: 0.00003,
      estimatedCost: 0.05,
    }));
    router.register(createProvider('vertexai', {
      sovereign: true,
      supportsStreaming: true,
      costPerOutputToken: 0.00003,
      estimatedCost: 0.05,
    }));

    const request: ModelRequest = {
      messages: [{ role: 'user', content: 'Design a compliant deployment blueprint for a regulated platform' }],
      taskType: 'enterprise security compliance blueprint',
      sovereignMode: true,
      sensitivityLevel: 'restricted',
    };

    const selected = router.selectProvider(request, {
      taskType: request.taskType,
      sovereignMode: request.sovereignMode,
      sensitivityLevel: request.sensitivityLevel,
      contextLength: 64,
      costBudget: 1,
    });

    expect(selected?.name).not.toBe('openai');
    expect(['bedrock', 'vertexai']).toContain(selected?.name);
  });

  it('keeps standard operational triage on cheaper cloud providers', () => {
    const router = new ModelRouter({ registerDefaults: false });
    router.register(createProvider('openai', {
      sovereign: false,
      supportsStreaming: true,
      costPerOutputToken: 0.00003,
      estimatedCost: 0.02,
    }));
    router.register(createProvider('google', {
      sovereign: false,
      supportsStreaming: true,
      costPerOutputToken: 0.000036,
      estimatedCost: 0.025,
    }));
    router.register(createProvider('bedrock', {
      sovereign: true,
      supportsStreaming: true,
      costPerOutputToken: 0.00008,
      estimatedCost: 0.11,
    }));

    const request: ModelRequest = {
      messages: [{ role: 'user', content: 'Triage this incident and summarize the likely root cause' }],
      taskType: 'triage summary status',
      sensitivityLevel: 'public',
    };

    const selected = router.selectProvider(request, {
      taskType: request.taskType,
      sensitivityLevel: request.sensitivityLevel,
      contextLength: 48,
      costBudget: 0.1,
    });

    expect(selected?.name).toBeDefined();
    expect(selected?.name).not.toBe('bedrock');
    expect(['openai', 'google']).toContain(selected?.name);
  });

  it('falls back after retries and cools down a failing sovereign provider', async () => {
    vi.useFakeTimers();

    try {
      const router = new ModelRouter({ registerDefaults: false });
      router.register(createProvider('bedrock', {
        sovereign: true,
        supportsStreaming: true,
        costPerOutputToken: 0.00002,
        estimatedCost: 0.01,
        invoke: async () => {
          throw new Error('bedrock outage');
        },
      }));
      router.register(createProvider('vertexai', {
        sovereign: true,
        supportsStreaming: true,
        costPerOutputToken: 0.00003,
        estimatedCost: 0.02,
      }));

      const request: ModelRequest = {
        messages: [{ role: 'user', content: 'Design a compliant deployment blueprint for a regulated platform' }],
        taskType: 'enterprise security compliance blueprint',
        sovereignMode: true,
        sensitivityLevel: 'restricted',
      };

      const criteria = {
        taskType: request.taskType,
        sovereignMode: request.sovereignMode,
        sensitivityLevel: request.sensitivityLevel,
        contextLength: 64,
        costBudget: 1,
      };

      expect(router.selectProvider(request, criteria)?.name).toBe('bedrock');

      const invokePromise = router.invoke(request);
      await vi.runAllTimersAsync();

      const response = await invokePromise;
      expect(response.provider).toBe('vertexai');

      const bedrockHealth = router.getHealth().find((provider) => provider.name === 'bedrock');
      expect(bedrockHealth?.consecutiveFailures).toBeGreaterThan(0);
      expect(router.selectProvider(request, criteria)?.name).toBe('vertexai');
    } finally {
      vi.useRealTimers();
    }
  });

  it('refreshes provider health through checkAllHealth', async () => {
    const router = new ModelRouter({ registerDefaults: false });
    router.register(createProvider('bedrock', {
      sovereign: true,
      supportsStreaming: true,
      estimatedCost: 0.01,
      checkHealth: async () => false,
    }));
    router.register(createProvider('google', {
      sovereign: false,
      supportsStreaming: true,
      estimatedCost: 0.02,
      checkHealth: async () => true,
    }));

    const results = await router.checkAllHealth();
    expect(results.get('bedrock')).toBe(false);
    expect(results.get('google')).toBe(true);

    const health = router.getHealth();
    expect(health.find((provider) => provider.name === 'bedrock')?.healthy).toBe(false);
    expect(health.find((provider) => provider.name === 'google')?.healthy).toBe(true);

    const selected = router.selectProvider(
      {
        messages: [{ role: 'user', content: 'Triage this incident and summarize the likely root cause' }],
        taskType: 'triage summary status',
        sensitivityLevel: 'public',
      },
      {
        taskType: 'triage summary status',
        sensitivityLevel: 'public',
        contextLength: 48,
        costBudget: 1,
      },
    );

    expect(selected?.name).toBe('google');
  });
});