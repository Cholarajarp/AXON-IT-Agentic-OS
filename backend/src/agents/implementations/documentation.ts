import type { AgentExecutionInput } from '../types.js';
import { SimulatedAgent } from './base.js';

export class DocumentationAgent extends SimulatedAgent {
  name = 'DocumentationAgent';
  description = 'Writes documentation, API docs, changelogs, knowledge articles';
  version = '1.0.0';
  capabilities = ['document', 'api-docs', 'changelog', 'knowledge-base'];

  protected generateOutput(input: AgentExecutionInput): Record<string, unknown> {
    return {
      documents: [
        { type: 'technical-spec', title: `${input.taskName} — Technical Specification`, wordCount: 850 },
        { type: 'api-reference', title: `API Reference — ${input.taskName}`, endpoints: 4 },
        { type: 'changelog', title: 'CHANGELOG.md entry', lines: 12 },
      ],
      knowledgeBase: {
        articlesCreated: 1,
        articlesUpdated: 2,
        tagsApplied: ['automation', 'workflow', input.taskName.toLowerCase()],
      },
      readabilityScore: 78,
      summary: `Documentation generated for: ${input.description}`,
      tokens: { input: 950, output: 1200 },
    };
  }

  protected getSimulatedDurationMs() { return 1800 + Math.random() * 800; }
  protected getSimulatedCost() { return 0.006 + Math.random() * 0.003; }
}
