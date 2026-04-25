import type { AgentExecutionInput } from '../types.js';
import { SimulatedAgent } from './base.js';

export class MigrationSafetyAgent extends SimulatedAgent {
  name = 'MigrationSafetyAgent';
  description = 'Reviews SQL migrations for lock risk, destructive operations, rollback gaps, and production safety';
  version = '1.0.0';
  capabilities = ['sql-review', 'lock-risk-analysis', 'rollback-review', 'approval-gate'];

  protected generateOutput(input: AgentExecutionInput): Record<string, unknown> {
    return {
      safetyReview: {
        risk: 'requires-gated-review',
        requiredEvidence: ['SQL lint result', 'staging timing', 'rollback or roll-forward plan', 'backup checkpoint'],
        blockedPatterns: ['DROP without contract phase', 'table rewrite on large tables', 'unbounded data mutation'],
      },
      summary: `Checked migration safety for ${input.description}.`,
      tokens: { input: 900, output: 620 },
    };
  }

  protected getSimulatedDurationMs() { return 1000 + Math.random() * 400; }
  protected getSimulatedCost() { return 0.004 + Math.random() * 0.002; }
}
