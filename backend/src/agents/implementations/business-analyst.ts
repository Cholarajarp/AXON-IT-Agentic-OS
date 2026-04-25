import type { AgentExecutionInput } from '../types.js';
import { SimulatedAgent } from './base.js';

export class BusinessAnalystAgent extends SimulatedAgent {
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

  protected getSimulatedDurationMs() { return 1200 + Math.random() * 600; }
  protected getSimulatedCost() { return 0.004 + Math.random() * 0.002; }
}
