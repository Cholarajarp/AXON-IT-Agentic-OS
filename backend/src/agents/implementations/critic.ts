import type { AgentExecutionInput } from '../types.js';
import { DeterministicAgent } from './base.js';

export class CriticAgent extends DeterministicAgent {
  name = 'CriticAgent';
  description = 'Evaluates agent outputs, detects contradictions, requests rework, and stops quality loops';
  version = '1.0.0';
  capabilities = ['critique', 'quality-gate', 'confidence-score', 'rework-request', 'hallucination-check'];

  protected generateOutput(input: AgentExecutionInput): Record<string, unknown> {
    return {
      criticDecision: {
        status: 'needs-evidence',
        confidence: 0.86,
        reworkRequired: false,
        stopCondition: 'tests pass, artifacts exist, citations match, and no release blocker remains',
      },
      checks: [
        'Output matches requested schema',
        'Claims are backed by workspace or source evidence',
        'Risk-triggered reviewer ran for security/database/release paths',
      ],
      generatedFor: input.description,
      tokens: { input: 610, output: 360 },
    };
  }

  protected estimateDurationMs() { return 910; }
  protected estimateCost() { return 0.002; }
}
