import type { AgentExecutionInput } from '../types.js';
import { SimulatedAgent } from './base.js';

export class InfrastructureAgent extends SimulatedAgent {
  name = 'InfrastructureAgent';
  description = 'Provisions infrastructure, deploys services, configures systems';
  version = '1.0.0';
  capabilities = ['deploy', 'provision', 'configure', 'scale'];

  protected generateOutput(input: AgentExecutionInput): Record<string, unknown> {
    return {
      provider: 'AWS',
      region: 'ap-south-1',
      resources: [
        { type: 'ECS Service', name: `axon-${input.taskId}`, status: 'ACTIVE' },
        { type: 'RDS Instance', name: 'axon-postgres', status: 'AVAILABLE' },
        { type: 'ElastiCache', name: 'axon-redis', status: 'AVAILABLE' },
        { type: 'ALB', name: 'axon-lb', status: 'ACTIVE' },
      ],
      scaling: { min: 2, max: 10, target: 70 },
      networking: { vpc: 'vpc-axon-prod', subnets: 3, securityGroups: 2 },
      cost: { monthly: '$142.50', breakdown: { compute: '$68', database: '$52', network: '$22.50' } },
      tokens: { input: 750, output: 620 },
    };
  }

  protected getSimulatedDurationMs() { return 4000 + Math.random() * 2000; }
  protected getSimulatedCost() { return 0.004 + Math.random() * 0.002; }
}
