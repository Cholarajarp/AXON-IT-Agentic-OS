import type { AgentExecutionInput } from '../types.js';
import { SimulatedAgent } from './base.js';

export class PMOAgent extends SimulatedAgent {
  name = 'PMOAgent';
  description = 'Creates project plans, estimates effort, tracks progress';
  version = '1.0.0';
  capabilities = ['plan', 'estimate', 'track', 'resource-allocate'];

  protected generateOutput(input: AgentExecutionInput): Record<string, unknown> {
    return {
      plan: {
        phases: [
          { name: 'Discovery', duration: '2d', status: 'complete' },
          { name: 'Design', duration: '3d', status: 'complete' },
          { name: 'Implementation', duration: '5d', status: 'in_progress' },
          { name: 'Testing', duration: '2d', status: 'pending' },
          { name: 'Release', duration: '1d', status: 'pending' },
        ],
        totalDuration: '13d',
        criticalPath: ['Design', 'Implementation', 'Testing'],
      },
      estimates: {
        effort: '65 story points',
        confidence: 0.82,
        risks: ['External dependency delays', 'Scope creep'],
      },
      resources: {
        agents: 4,
        parallelizable: true,
        bottleneck: 'Implementation phase',
      },
      generatedFor: input.description,
      tokens: { input: 720, output: 580 },
    };
  }

  protected getSimulatedDurationMs() { return 1200 + Math.random() * 600; }
  protected getSimulatedCost() { return 0.004 + Math.random() * 0.002; }
}
