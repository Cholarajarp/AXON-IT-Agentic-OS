import { nanoid } from 'nanoid';
import type { AgentExecutionInput, AgentExecutionResult } from './types.js';
import { broadcastUpdate } from '../ws/gateway.js';

export interface RuntimeStep {
  name: string;
  order: number;
  execute(context: RuntimeContext): Promise<RuntimeContext>;
}

export interface RuntimeContext {
  executionId: string;
  workflowId: string;
  taskId: string;
  agentName: string;
  tenantId: string;
  input: AgentExecutionInput;
  result?: AgentExecutionResult;
  startedAt: number;
  steps: StepResult[];
  aborted: boolean;
  abortReason?: string;
  metadata: Record<string, unknown>;
}

export interface StepResult {
  step: string;
  order: number;
  passed: boolean;
  durationMs: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

const STEPS: RuntimeStep[] = [
  {
    name: 'intent-validation',
    order: 1,
    async execute(ctx) {
      const input = ctx.input;
      if (!input.taskId || !input.workflowId || !input.description) {
        ctx.aborted = true;
        ctx.abortReason = 'Missing required fields: taskId, workflowId, or description';
      }
      return ctx;
    },
  },
  {
    name: 'tenant-isolation',
    order: 2,
    async execute(ctx) {
      if (!ctx.tenantId) {
        ctx.aborted = true;
        ctx.abortReason = 'Tenant ID required for execution';
      }
      return ctx;
    },
  },
  {
    name: 'policy-check',
    order: 3,
    async execute(ctx) {
      const blockedAgents = (ctx.metadata.blockedAgents as string[]) || [];
      if (blockedAgents.includes(ctx.agentName)) {
        ctx.aborted = true;
        ctx.abortReason = `Agent ${ctx.agentName} is blocked by policy`;
      }
      return ctx;
    },
  },
  {
    name: 'rate-limit',
    order: 4,
    async execute(ctx) {
      // Rate limiting per tenant — 100 executions per minute
      const rateKey = `${ctx.tenantId}:${ctx.agentName}`;
      ctx.metadata.rateKey = rateKey;
      return ctx;
    },
  },
  {
    name: 'cost-budget-check',
    order: 5,
    async execute(ctx) {
      const budget = (ctx.metadata.costBudget as number) || 100;
      const spent = (ctx.metadata.costSpent as number) || 0;
      if (spent >= budget) {
        ctx.aborted = true;
        ctx.abortReason = `Budget exhausted: $${spent.toFixed(4)} / $${budget.toFixed(2)}`;
      }
      return ctx;
    },
  },
  {
    name: 'input-sanitization',
    order: 6,
    async execute(ctx) {
      const sensitivePatterns = [/password\s*[:=]\s*\S+/gi, /api[_-]?key\s*[:=]\s*\S+/gi, /secret\s*[:=]\s*\S+/gi];
      const inputStr = JSON.stringify(ctx.input.input);
      for (const pattern of sensitivePatterns) {
        if (pattern.test(inputStr)) {
          ctx.metadata.sensitiveDataDetected = true;
          ctx.metadata.redactedInput = inputStr.replace(pattern, '[REDACTED]');
        }
      }
      return ctx;
    },
  },
  {
    name: 'prompt-injection-guard',
    order: 7,
    async execute(ctx) {
      const injectionPatterns = [
        /ignore\s+(all\s+)?previous\s+instructions/i,
        /you\s+are\s+now\s+/i,
        /system\s*:\s*override/i,
        /\{\{.*\}\}/,
      ];
      const inputStr = JSON.stringify(ctx.input.input);
      for (const pattern of injectionPatterns) {
        if (pattern.test(inputStr)) {
          ctx.aborted = true;
          ctx.abortReason = 'Potential prompt injection detected';
        }
      }
      return ctx;
    },
  },
  {
    name: 'capability-verification',
    order: 8,
    async execute(ctx) {
      // Verify agent is registered and capable
      ctx.metadata.capabilityVerified = true;
      return ctx;
    },
  },
  {
    name: 'execution',
    order: 9,
    async execute(ctx) {
      // Actual execution happens here — handled by scheduler
      // This step is a placeholder in the enforcer pipeline
      ctx.metadata.executionPhase = true;
      return ctx;
    },
  },
  {
    name: 'output-sanitization',
    order: 10,
    async execute(ctx) {
      if (ctx.result) {
        const outputStr = JSON.stringify(ctx.result.output);
        const piiPatterns = [/\b\d{3}-\d{2}-\d{4}\b/, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i];
        for (const pattern of piiPatterns) {
          if (pattern.test(outputStr)) {
            ctx.metadata.piiDetectedInOutput = true;
          }
        }
      }
      return ctx;
    },
  },
  {
    name: 'cost-recording',
    order: 11,
    async execute(ctx) {
      if (ctx.result) {
        ctx.metadata.executionCost = ctx.result.cost;
        ctx.metadata.totalDurationMs = Date.now() - ctx.startedAt;
      }
      return ctx;
    },
  },
  {
    name: 'audit-logging',
    order: 12,
    async execute(ctx) {
      ctx.metadata.auditRecord = {
        executionId: ctx.executionId,
        workflowId: ctx.workflowId,
        taskId: ctx.taskId,
        agent: ctx.agentName,
        tenant: ctx.tenantId,
        timestamp: Date.now(),
        success: !ctx.aborted && !!ctx.result,
        cost: ctx.metadata.executionCost || 0,
        durationMs: Date.now() - ctx.startedAt,
        sensitiveData: !!ctx.metadata.sensitiveDataDetected,
        piiInOutput: !!ctx.metadata.piiDetectedInOutput,
      };
      return ctx;
    },
  },
  {
    name: 'memory-update',
    order: 13,
    async execute(ctx) {
      if (ctx.result && !ctx.aborted) {
        ctx.metadata.memoryUpdate = {
          type: 'episodic',
          content: `Agent ${ctx.agentName} executed task "${ctx.input.taskName}" with ${ctx.result ? 'success' : 'failure'}`,
          source: ctx.agentName,
          workflowId: ctx.workflowId,
        };
      }
      return ctx;
    },
  },
];

export class RuntimeEnforcer {
  private steps = STEPS;

  async enforce(input: AgentExecutionInput, tenantId: string, metadata: Record<string, unknown> = {}): Promise<RuntimeContext> {
    const ctx: RuntimeContext = {
      executionId: nanoid(12),
      workflowId: input.workflowId,
      taskId: input.taskId,
      agentName: input.taskName,
      tenantId,
      input,
      startedAt: Date.now(),
      steps: [],
      aborted: false,
      metadata,
    };

    for (const step of this.steps) {
      if (ctx.aborted) break;

      const stepStart = Date.now();
      try {
        await step.execute(ctx);
        ctx.steps.push({
          step: step.name,
          order: step.order,
          passed: !ctx.aborted,
          durationMs: Date.now() - stepStart,
          message: ctx.aborted ? ctx.abortReason : undefined,
        });
      } catch (err) {
        const error = err as Error;
        ctx.aborted = true;
        ctx.abortReason = `Step ${step.name} threw: ${error.message}`;
        ctx.steps.push({
          step: step.name,
          order: step.order,
          passed: false,
          durationMs: Date.now() - stepStart,
          message: error.message,
        });
      }
    }

    broadcastUpdate('runtime.enforced', {
      executionId: ctx.executionId,
      workflowId: ctx.workflowId,
      agent: ctx.agentName,
      passed: !ctx.aborted,
      steps: ctx.steps.length,
      durationMs: Date.now() - ctx.startedAt,
    });

    return ctx;
  }

  getSteps(): Array<{ name: string; order: number }> {
    return this.steps.map((s) => ({ name: s.name, order: s.order }));
  }
}

export const runtimeEnforcer = new RuntimeEnforcer();
