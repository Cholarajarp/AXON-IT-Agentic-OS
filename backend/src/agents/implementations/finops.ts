import type { AgentExecutionInput } from '../types.js';
import { SimulatedAgent } from './base.js';

export class FinOpsAgent extends SimulatedAgent {
  name = 'FinOpsAgent';
  description = 'Controls model budgets, routing, caching, provider escalation, and margin guardrails';
  version = '1.0.0';
  capabilities = ['model-routing', 'budget-policy', 'context-cache', 'provider-failover', 'margin-guardrail'];

  protected generateOutput(input: AgentExecutionInput): Record<string, unknown> {
    return {
      routingPolicy: {
        default: 'small-model-first',
        escalation: ['low-confidence', 'failed-tests', 'security-risk', 'database-risk', 'release-blocker'],
        cache: ['system-prompt', 'repo-map', 'api-specs', 'database-schema', 'policy-pack', 'product-brief'],
      },
      budget: {
        monthlyCapUsd: Number(input.input.monthlyBudgetUsd ?? 2500),
        warnAtPercent: 80,
        hardStopPercent: 110,
        premiumPasses: 2,
      },
      controls: [
        'Use local/sovereign route for confidential code and database context',
        'Batch summaries and customer reports',
        'Record planned versus actual spend as release evidence',
      ],
      generatedFor: input.description,
      tokens: { input: 540, output: 420 },
    };
  }

  protected getSimulatedDurationMs() { return 650 + Math.random() * 350; }
  protected getSimulatedCost() { return 0.001 + Math.random() * 0.001; }
}
