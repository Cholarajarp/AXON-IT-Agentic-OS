import type { AgentExecutionInput } from '../types.js';
import { SimulatedAgent } from './base.js';

export class IntentAgent extends SimulatedAgent {
  name = 'IntentAgent';
  description = 'Parses user intent, classifies goal type, extracts structured requirements';
  version = '1.0.0';
  capabilities = ['parse', 'classify', 'extract-requirements'];

  protected generateOutput(input: AgentExecutionInput): Record<string, unknown> {
    const goal = (input.input.goal as string) || input.description;
    return {
      classification: this.classifyGoal(goal),
      entities: this.extractEntities(goal),
      requirements: [`Implement: ${goal}`, 'Ensure quality standards', 'Document changes'],
      confidence: 0.92,
      tokens: { input: 450, output: 280 },
    };
  }

  protected getSimulatedDurationMs() { return 800 + Math.random() * 400; }
  protected getSimulatedCost() { return 0.002 + Math.random() * 0.001; }

  private classifyGoal(goal: string): string {
    const lower = goal.toLowerCase();
    if (lower.includes('deploy')) return 'deployment';
    if (lower.includes('fix') || lower.includes('bug')) return 'bugfix';
    if (lower.includes('build') || lower.includes('create')) return 'feature';
    if (lower.includes('monitor') || lower.includes('alert')) return 'observability';
    return 'general';
  }

  private extractEntities(goal: string): string[] {
    return goal.split(/\s+/).filter((w) => w.length > 4).slice(0, 5);
  }
}
