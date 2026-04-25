import { describe, expect, it } from 'vitest';
import { LocalMockProvider } from './providers/localMock.js';
import { ResponseCache } from './cache.js';
import { ModelRouter } from './router.js';
import { runEval } from './eval.js';
import type { ModelRequest } from './types.js';

describe('LocalMockProvider', () => {
  it('produces deterministic output for identical requests', async () => {
    const provider = new LocalMockProvider();
    const request: ModelRequest = {
      taskType: 'generic-task',
      messages: [{ role: 'user', content: 'what is 2 + 2?' }],
    };

    const a = await provider.invoke(request);
    const b = await provider.invoke(request);

    expect(a.content).toBe(b.content);
    expect(a.provider).toBe('localMock');
    expect(a.cost).toBe(0);
  });

  it('returns fixture-driven output for known task types', async () => {
    const provider = new LocalMockProvider();
    const response = await provider.invoke({
      taskType: 'triage-incident',
      messages: [{ role: 'user', content: 'API is down' }],
    });
    expect(response.content).toContain('MOCK_TRIAGE');
  });
});

describe('ResponseCache', () => {
  it('bypasses the cache when temperature > 0', () => {
    const cache = new ResponseCache();
    const req: ModelRequest = {
      temperature: 0.7,
      messages: [{ role: 'user', content: 'hello' }],
    };
    expect(cache.keyFor(req)).toBeNull();
  });

  it('returns cached responses with cached flag set', async () => {
    const cache = new ResponseCache();
    const req: ModelRequest = { messages: [{ role: 'user', content: 'hello' }] };

    cache.set(req, {
      content: 'hi',
      model: 'm',
      provider: 'p',
      tokensIn: 1,
      tokensOut: 1,
      cost: 0,
      latencyMs: 1,
      cached: false,
    });

    const hit = cache.get(req);
    expect(hit?.cached).toBe(true);
    expect(hit?.content).toBe('hi');
  });
});

describe('ModelRouter with mock provider', () => {
  it('short-circuits on cache hit without re-invoking the provider', async () => {
    const router = new ModelRouter({ registerDefaults: false });
    router.register(new LocalMockProvider());

    const request: ModelRequest = {
      taskType: 'summary',
      messages: [{ role: 'user', content: 'summarize this article' }],
    };

    const first = await router.invoke(request);
    const second = await router.invoke(request);

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.content).toBe(first.content);
    expect(router.getCacheSize()).toBe(1);
  });

  it('bypassCache forces a fresh invocation', async () => {
    const router = new ModelRouter({ registerDefaults: false });
    router.register(new LocalMockProvider());

    const base: ModelRequest = {
      taskType: 'summary',
      messages: [{ role: 'user', content: 'test content' }],
    };

    await router.invoke(base);
    const bypassed = await router.invoke({ ...base, bypassCache: true });

    expect(bypassed.cached).toBe(false);
  });

  it('recovers a cooled-down provider after a successful health check', async () => {
    const router = new ModelRouter({ registerDefaults: false });
    let failCount = 0;
    router.register({
      name: 'localMock',
      config: {
        name: 'localMock',
        models: ['mock-small'],
        costPerInputToken: 0,
        costPerOutputToken: 0,
        maxContextLength: 1_000_000,
        supportsStreaming: false,
        regions: ['local'],
        sovereign: true,
      },
      invoke: async () => {
        if (failCount < 3) {
          failCount++;
          throw new Error('synthetic outage');
        }
        return {
          content: 'recovered',
          model: 'mock-small',
          provider: 'localMock',
          tokensIn: 1,
          tokensOut: 1,
          cost: 0,
          latencyMs: 1,
          cached: false,
        };
      },
      checkHealth: async () => true,
      estimateCost: () => 0,
    });

    const request: ModelRequest = {
      messages: [{ role: 'user', content: 'ping' }],
      bypassCache: true,
    };

    await expect(router.invoke(request)).rejects.toThrow();
    const before = router.getHealth().find((h) => h.name === 'localMock');
    expect(before?.healthy).toBe(false);
    expect(before?.cooldownUntil).toBeTruthy();

    await router.checkAllHealth();
    const after = router.getHealth().find((h) => h.name === 'localMock');
    expect(after?.healthy).toBe(true);
    expect(after?.cooldownUntil).toBeUndefined();
    expect(after?.consecutiveFailures).toBe(0);

    const response = await router.invoke(request);
    expect(response.content).toBe('recovered');
  });
});

describe('Eval harness', () => {
  it('runs the default eval suite against the mock provider and all cases pass', async () => {
    const report = await runEval();
    expect(report.total).toBeGreaterThan(0);
    expect(report.failed).toBe(0);
    expect(report.passed).toBe(report.total);
  });
});
