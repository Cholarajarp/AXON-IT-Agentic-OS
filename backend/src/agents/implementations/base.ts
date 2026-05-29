import type { BaseAgent, AgentExecutionInput, AgentExecutionResult } from '../types.js';

export abstract class DeterministicAgent implements BaseAgent {
  abstract name: string;
  abstract description: string;
  abstract version: string;
  abstract capabilities: string[];

  protected abstract generateOutput(input: AgentExecutionInput): Record<string, unknown>;
  protected abstract estimateCost(): number;

  async execute(input: AgentExecutionInput): Promise<AgentExecutionResult> {
    if (input.signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const output = {
      ...this.generateOutput(input),
      ...(input.skillContext
        ? {
            skillContextApplied: {
              skills: input.skillContext.enabledSkillIds,
              capabilities: input.skillContext.capabilities.slice(0, 10),
              promptRules: input.skillContext.prompts.length,
              allowedTools: input.skillContext.allowedTools.slice(0, 10),
            },
          }
        : {}),
    };
    const cost = this.estimateCost();

    return { output, cost };
  }

  protected deterministicRange(input: AgentExecutionInput, salt: string, min: number, max: number): number {
    const source = `${this.name}:${input.workflowId}:${input.taskId}:${input.taskName}:${input.description}:${salt}`;
    let hash = 2166136261;
    for (let i = 0; i < source.length; i += 1) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const ratio = (hash >>> 0) / 0xffffffff;
    return Math.round(min + ratio * (max - min));
  }
}
