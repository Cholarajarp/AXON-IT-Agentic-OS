import type { AgentExecutionInput } from '../types.js';
import { DeterministicAgent } from './base.js';

export class BusinessAnalystAgent extends DeterministicAgent {
  name = 'BusinessAnalystAgent';
  description = 'Analyzes business requirements, defines acceptance criteria, maps stakeholders';
  version = '1.0.0';
  capabilities = ['analyze-requirements', 'define-acceptance', 'stakeholder-map'];

  protected generateOutput(input: AgentExecutionInput): Record<string, unknown> {
    return {
      userStories: [
        `As a user, I want to ${input.description} so that I can achieve my goal`,
        `As an admin, I want visibility into ${input.taskName} progress`,
      ],
      acceptanceCriteria: [
        'System responds within 200ms p95',
        'All error states handled gracefully',
        'Audit trail maintained for compliance',
        'Rollback capability within 5 minutes',
      ],
      stakeholders: ['Engineering', 'Product', 'Security', 'Compliance'],
      priority: 'HIGH',
      estimatedEffort: '3-5 days',
      tokens: { input: 620, output: 450 },
    };
  }

  protected estimateDurationMs() { return 1500; }
  protected estimateCost() { return 0.005; }
}
