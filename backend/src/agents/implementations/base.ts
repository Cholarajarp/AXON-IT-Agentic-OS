import type { BaseAgent, AgentExecutionInput, AgentExecutionResult } from '../types.js';

export abstract class SimulatedAgent implements BaseAgent {
  abstract name: string;
  abstract description: string;
  abstract version: string;
  abstract capabilities: string[];

  protected abstract generateOutput(input: AgentExecutionInput): Record<string, unknown>;
  protected abstract getSimulatedDurationMs(): number;
  protected abstract getSimulatedCost(): number;

  async execute(input: AgentExecutionInput): Promise<AgentExecutionResult> {
    const duration = this.getSimulatedDurationMs();
    await this.simulateWork(duration, input.signal);

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
    const cost = this.getSimulatedCost();

    return { output, cost };
  }

  private simulateWork(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const timeout = setTimeout(resolve, ms);
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
  }
}
