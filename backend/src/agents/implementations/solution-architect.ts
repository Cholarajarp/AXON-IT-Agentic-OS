import type { AgentExecutionInput } from '../types.js';
import { SimulatedAgent } from './base.js';

export class SolutionArchitectAgent extends SimulatedAgent {
  name = 'SolutionArchitectAgent';
  description = 'Designs system architecture, selects technologies, designs APIs';
  version = '1.0.0';
  capabilities = ['architecture', 'system-design', 'tech-selection', 'api-design'];

  protected generateOutput(input: AgentExecutionInput): Record<string, unknown> {
    return {
      architecture: {
        pattern: 'Event-driven microservices',
        components: ['API Gateway', 'Orchestrator', 'Agent Pool', 'Event Bus', 'Data Store'],
        communication: 'Async message passing with synchronous API layer',
      },
      techStack: {
        runtime: 'Node.js 20 LTS',
        framework: 'Fastify 5',
        database: 'PostgreSQL 17',
        cache: 'Redis 7',
        messaging: 'BullMQ',
      },
      apiContracts: [
        { method: 'POST', path: '/api/v1/workflows', description: `Create workflow for: ${input.description}` },
        { method: 'GET', path: '/api/v1/workflows/:id/dag', description: 'Get task DAG' },
      ],
      decisions: [
        { decision: 'Use event sourcing for audit trail', rationale: 'Complete history for compliance' },
        { decision: 'Agent pool with bounded concurrency', rationale: 'Prevent resource exhaustion' },
      ],
      tokens: { input: 850, output: 720 },
    };
  }

  protected getSimulatedDurationMs() { return 2000 + Math.random() * 1000; }
  protected getSimulatedCost() { return 0.008 + Math.random() * 0.004; }
}
