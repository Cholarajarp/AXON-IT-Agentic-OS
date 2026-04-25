import type { ModelRequest, ModelResponse } from './types.js';
import { ModelRouter } from './router.js';
import { LocalMockProvider } from './providers/localMock.js';

/**
 * Eval harness for the Model Router.
 *
 * The eval lab runs a fixture set of (request, expectation) pairs against a
 * router seeded only with the deterministic mock provider. This gives us:
 *   - cheap regression gates (no real API calls)
 *   - reproducible CI runs
 *   - a place to pin "golden" outputs before a model/prompt change
 *
 * Expectations are intentionally small-surface (substring match, provider name,
 * non-empty content). Real eval gates (factuality, citation accuracy) live in
 * the Evaluation Lab service and consume these results via the same shape.
 */

export interface EvalCase {
  id: string;
  description: string;
  request: ModelRequest;
  expect: {
    containsAny?: string[];
    provider?: string;
    minContentLength?: number;
  };
}

export interface EvalCaseResult {
  id: string;
  passed: boolean;
  reasons: string[];
  response?: ModelResponse;
}

export interface EvalReport {
  total: number;
  passed: number;
  failed: number;
  results: EvalCaseResult[];
  durationMs: number;
}

export const DEFAULT_EVAL_CASES: EvalCase[] = [
  {
    id: 'triage-incident',
    description: 'Triage task routes to a provider and produces triage-shaped output',
    request: {
      taskType: 'triage summary',
      messages: [{ role: 'user', content: 'Payment API 500s spiking in us-east-1 in the last 10 minutes.' }],
    },
    expect: { containsAny: ['MOCK_TRIAGE', 'triage', 'cause'], provider: 'localMock', minContentLength: 16 },
  },
  {
    id: 'blueprint-design',
    description: 'Blueprint task produces a structured plan shape',
    request: {
      taskType: 'blueprint design architecture',
      messages: [{ role: 'user', content: 'Design a sovereign multi-region checkout platform.' }],
    },
    expect: { containsAny: ['MOCK_BLUEPRINT', 'stages', 'gates'], provider: 'localMock', minContentLength: 16 },
  },
  {
    id: 'sovereign-routing',
    description: 'Restricted sensitivity task routes to a sovereign provider only',
    request: {
      taskType: 'enterprise compliance blueprint',
      sovereignMode: true,
      sensitivityLevel: 'restricted',
      messages: [{ role: 'user', content: 'Produce SOC2 evidence map for the release agent.' }],
    },
    expect: { provider: 'localMock', minContentLength: 8 },
  },
];

export async function runEval(cases: EvalCase[] = DEFAULT_EVAL_CASES): Promise<EvalReport> {
  const start = Date.now();
  const router = new ModelRouter({ registerDefaults: false, cache: null, costLedger: false });
  router.register(new LocalMockProvider());

  const results: EvalCaseResult[] = [];

  for (const c of cases) {
    const reasons: string[] = [];
    let response: ModelResponse | undefined;
    try {
      response = await router.invoke(c.request);

      if (c.expect.provider && response.provider !== c.expect.provider) {
        reasons.push(`expected provider=${c.expect.provider}, got ${response.provider}`);
      }
      if (c.expect.minContentLength && response.content.length < c.expect.minContentLength) {
        reasons.push(`content too short (${response.content.length} < ${c.expect.minContentLength})`);
      }
      if (c.expect.containsAny && c.expect.containsAny.length > 0) {
        const hit = c.expect.containsAny.some((needle) => response!.content.includes(needle));
        if (!hit) {
          reasons.push(`content missing any of [${c.expect.containsAny.join(', ')}]`);
        }
      }
    } catch (err) {
      reasons.push(`invoke threw: ${(err as Error).message}`);
    }

    results.push({ id: c.id, passed: reasons.length === 0, reasons, response });
  }

  const passed = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
    durationMs: Date.now() - start,
  };
}
