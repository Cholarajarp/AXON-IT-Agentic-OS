import type { AgentExecutionInput } from '../types.js';
import { SimulatedAgent } from './base.js';

export class StackResearchAgent extends SimulatedAgent {
  name = 'StackResearchAgent';
  description = 'Researches reference stacks, platform patterns, and architecture standards from public sources';
  version = '1.0.0';
  capabilities = ['research-stack', 'source-synthesis', 'architecture-comparison', 'trend-analysis'];

  protected generateOutput(input: AgentExecutionInput): Record<string, unknown> {
    const goal = typeof input.input.goal === 'string' ? input.input.goal : input.taskName;

    return {
      objective: goal,
      researchNotes: [
        {
          source: 'OpenHands GUI',
          url: 'https://www.openhands.dev/product/gui',
          insight: 'Shared workspace, sandboxed runtime, diff review, and collaborative agent visibility are core UX primitives.',
        },
        {
          source: 'Continue checks',
          url: 'https://docs.continue.dev/checks/quickstart',
          insight: 'Repo-native markdown checks and GitHub status gates make quality control feel native to the codebase.',
        },
        {
          source: 'LangGraph overview',
          url: 'https://docs.langchain.com/oss/python/langgraph/overview',
          insight: 'Durable execution, interrupts, memory, and streaming should be visible in the UI and enforced by the runtime.',
        },
      ],
      referenceStack: {
        frontend: ['React 18', 'TypeScript', 'Vite', 'React Router', 'TanStack Query', 'Radix UI'],
        orchestration: ['Fastify', 'planner', 'scheduler', 'runtime enforcer'],
        execution: ['sandboxed tools', 'policy gates', 'audit trail', 'cost ledger'],
        providers: ['Anthropic', 'OpenAI', 'Google Gemini', 'Ollama'],
      },
      failureModesToAvoid: [
        'Random regex heuristics instead of explicit stack selection rules',
        'Hidden provider health that fails only after launch',
        'A chat UI without orchestration, approvals, or audit evidence',
        'Broad provider support advertised before an adapter is actually wired',
      ],
      recommendations: [
        'Keep a single operator cockpit with command, routing, and evidence in one place.',
        'Gate launch on provider health, budget, and sovereignty before execution starts.',
        'Add a dedicated research agent before architecture tasks so stack choices are source-backed.',
      ],
      tokens: { input: 1200, output: 900 },
    };
  }

  protected getSimulatedDurationMs() { return 1800 + Math.random() * 800; }
  protected getSimulatedCost() { return 0.006 + Math.random() * 0.003; }
}