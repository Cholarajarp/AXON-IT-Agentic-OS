/**
 * Agent Execution Pipeline (the 13-step policy-bound runtime)
 *
 * This is the ONLY path the scheduler should use to run an agent. It threads
 * together every governance control into a single atomic execution:
 *
 *    1.  intent-validation       — required fields present
 *    2.  tenant-isolation        — tenantId present and scoped
 *    3.  rbac-check              — the calling actor (agent role) can execute
 *    4.  rate-limit              — (tenant,agent) bucket has tokens
 *    5.  policy-check            — declarative policies allow this execution
 *    6.  cost-budget-check       — workflow has budget remaining
 *    7.  input-sanitization      — redact secrets in input
 *    8.  prompt-injection-guard  — refuse obvious injection patterns
 *    9.  capability-verification — agent is registered and healthy
 *   10.  execution               — actual agent.execute() call
 *   11.  output-sanitization     — flag PII in output
 *   12.  cost-ledger-write       — record cost + duration to DB
 *   13.  audit-chain-append      — cryptographic, tamper-evident log
 *   (+)  memory-update           — episodic memory of the run
 *
 * Every step is observable. A failure at any step short-circuits the rest,
 * records the failure in the audit chain, and returns a structured result.
 */

import { nanoid } from 'nanoid';
import type { BaseAgent, AgentExecutionResult } from './types.js';
import { agentRegistry } from './registry.js';
import { auditChain } from '../services/audit-chain.js';
import { memoryEngine } from '../services/memory-engine.js';
import { rbacService } from '../services/rbac.js';
import { rateLimiter } from '../services/rate-limiter.js';
import { policyService, type PolicyDecision } from '../services/policy.js';
import { skillRegistry } from '../services/skill-registry.js';
import { broadcastUpdate } from '../ws/gateway.js';
import { sql } from '../db/connection.js';

export interface PipelineInput {
  workflowId: string;
  taskId: string;
  taskName: string;
  description: string;
  agentName: string;
  tenantId: string;
  input: Record<string, unknown>;
  signal: AbortSignal;
  sensitivityLevel?: 'public' | 'internal' | 'confidential' | 'restricted';
  sovereignMode?: boolean;
  costBudget: number;
  costSpent: number;
  approvalApproved?: boolean;
}

export interface PipelineStepResult {
  step: string;
  order: number;
  passed: boolean;
  durationMs: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface PipelineResult {
  executionId: string;
  success: boolean;
  aborted: boolean;
  abortReason?: string;
  abortStep?: string;
  steps: PipelineStepResult[];
  agentResult?: AgentExecutionResult;
  policyDecision?: PolicyDecision;
  sanitized: {
    inputHadSecrets: boolean;
    outputHadPII: boolean;
  };
  durationMs: number;
  cost: number;
}

const SECRET_PATTERNS = [
  /password\s*[:=]\s*\S+/gi,
  /api[_-]?key\s*[:=]\s*\S+/gi,
  /secret\s*[:=]\s*\S+/gi,
  /bearer\s+[A-Za-z0-9._-]+/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
];

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(all\s+)?(prior|previous|system)\s+(messages|prompts|instructions)/i,
  /you\s+are\s+now\s+/i,
  /system\s*:\s*override/i,
  /\bDAN\s+mode\b/i,
  /act\s+as\s+an\s+unrestricted/i,
];

const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/, // US SSN
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, // email
  /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/, // credit card
];

export const PIPELINE_STEPS: Array<{ name: string; order: number; description: string }> = [
  { order: 1, name: 'intent-validation', description: 'Required fields present on the execution input' },
  { order: 2, name: 'tenant-isolation', description: 'Tenant context provided and scoped' },
  { order: 3, name: 'rbac-check', description: 'Agent role has execute permission on workflows' },
  { order: 4, name: 'rate-limit', description: 'Token bucket has capacity for (tenant, agent)' },
  { order: 5, name: 'policy-check', description: 'Declarative policies allow this execution' },
  { order: 6, name: 'cost-budget-check', description: 'Workflow budget has headroom' },
  { order: 7, name: 'input-sanitization', description: 'Secrets in input are redacted before execution' },
  { order: 8, name: 'prompt-injection-guard', description: 'Input does not contain obvious injection payloads' },
  { order: 9, name: 'capability-verification', description: 'Agent is registered and ready' },
  { order: 10, name: 'execution', description: 'Agent.execute() runs with the sanitized input' },
  { order: 11, name: 'output-sanitization', description: 'Output is scanned for PII and flagged' },
  { order: 12, name: 'cost-ledger-write', description: 'Cost + duration recorded to cost_ledger' },
  { order: 13, name: 'audit-chain-append', description: 'Cryptographic audit entry written' },
];

/**
 * The full pipeline. Returns a structured result; never throws to the caller.
 */
export async function executeWithRuntimeEnforcement(input: PipelineInput): Promise<PipelineResult> {
  const executionId = nanoid(12);
  const pipelineStart = Date.now();
  const steps: PipelineStepResult[] = [];

  let aborted = false;
  let abortReason: string | undefined;
  let abortStep: string | undefined;
  let inputHadSecrets = false;
  let outputHadPII = false;
  let sanitizedInput = input.input;
  let agentResult: AgentExecutionResult | undefined;
  let policyDecision: PolicyDecision | undefined;
  let agent: BaseAgent | undefined;
  let skillContext:
    | {
        enabledSkillIds: string[];
        capabilities: string[];
        prompts: string[];
        allowedTools: string[];
      }
    | undefined;

  const recordStep = (name: string, order: number, passed: boolean, start: number, message?: string, metadata?: Record<string, unknown>) => {
    steps.push({ step: name, order, passed, durationMs: Date.now() - start, message, metadata });
    if (!passed && !aborted) {
      aborted = true;
      abortReason = message;
      abortStep = name;
    }
  };

  // Step 1: intent-validation
  {
    const s = Date.now();
    const ok = Boolean(input.taskId && input.workflowId && input.description && input.agentName);
    recordStep('intent-validation', 1, ok, s, ok ? undefined : 'Missing required fields: taskId, workflowId, description, or agentName');
  }

  // Step 2: tenant-isolation
  if (!aborted) {
    const s = Date.now();
    const ok = Boolean(input.tenantId && input.tenantId.length > 0);
    recordStep('tenant-isolation', 2, ok, s, ok ? undefined : 'tenantId is required');
  }

  // Step 3: rbac-check (agents execute under the 'agent' role by default)
  if (!aborted) {
    const s = Date.now();
    const synthetic = {
      id: `agent:${input.agentName}`,
      email: `${input.agentName}@axon.local`,
      name: input.agentName,
      role: 'agent' as const,
      tenantId: input.tenantId,
      permissions: [],
      active: true,
    };
    const ok = rbacService.canAccess(synthetic, 'workflows', 'update');
    recordStep('rbac-check', 3, ok, s, ok ? undefined : `Agent role lacks workflows:update permission`);
  }

  // Step 4: rate-limit
  if (!aborted) {
    const s = Date.now();
    const key = `${input.tenantId}:${input.agentName}`;
    const ok = rateLimiter.tryAcquire(key);
    recordStep('rate-limit', 4, ok, s, ok ? undefined : `Rate limit exceeded for ${key}`, { key });
  }

  // Step 5: policy-check
  if (!aborted) {
    const s = Date.now();
    policyDecision = await policyService.evaluate({
      agent: input.agentName,
      tenantId: input.tenantId,
      sensitivityLevel: input.sensitivityLevel,
      sovereignMode: input.sovereignMode,
      approvalApproved: input.approvalApproved,
    });
    recordStep('policy-check', 5, policyDecision.allowed, s,
      policyDecision.allowed ? undefined : policyDecision.reasons.join('; '),
      { matched: policyDecision.matched });
  }

  // Step 6: cost-budget-check
  if (!aborted) {
    const s = Date.now();
    const ok = input.costSpent < input.costBudget;
    recordStep('cost-budget-check', 6, ok, s,
      ok ? undefined : `Budget exhausted: $${input.costSpent.toFixed(4)} / $${input.costBudget.toFixed(2)}`);
  }

  // Step 7: input-sanitization (does NOT abort; redacts in place)
  if (!aborted) {
    const s = Date.now();
    const asStr = JSON.stringify(input.input);
    inputHadSecrets = SECRET_PATTERNS.some((p) => p.test(asStr));
    if (inputHadSecrets) {
      let redacted = asStr;
      for (const p of SECRET_PATTERNS) redacted = redacted.replace(p, '[REDACTED]');
      try {
        sanitizedInput = JSON.parse(redacted);
      } catch {
        sanitizedInput = { redacted: true };
      }
    }
    recordStep('input-sanitization', 7, true, s, inputHadSecrets ? 'Secrets detected and redacted' : undefined, { redacted: inputHadSecrets });
  }

  // Step 8: prompt-injection-guard
  if (!aborted) {
    const s = Date.now();
    const asStr = JSON.stringify(sanitizedInput);
    const hit = INJECTION_PATTERNS.find((p) => p.test(asStr));
    const ok = !hit;
    recordStep('prompt-injection-guard', 8, ok, s, ok ? undefined : `Potential prompt injection matched: ${hit?.source}`);
  }

  // Step 9: capability-verification
  if (!aborted) {
    const s = Date.now();
    const ok = agentRegistry.has(input.agentName);
    if (ok) agent = agentRegistry.get(input.agentName);
    recordStep('capability-verification', 9, ok, s, ok ? undefined : `Agent not registered: ${input.agentName}`);
  }

  // Step 10: execution
  if (!aborted && agent) {
    const s = Date.now();
    try {
      const enabledSkills = (await skillRegistry.list()).filter((skill) => skill.enabled);
      skillContext = {
        enabledSkillIds: enabledSkills.map((skill) => skill.id),
        capabilities: unique(enabledSkills.flatMap((skill) => skill.capabilities)),
        prompts: unique(enabledSkills.flatMap((skill) => skill.prompts)),
        allowedTools: unique(enabledSkills.flatMap((skill) => skill.allowedTools)),
      };
      agentResult = await agent.execute({
        taskId: input.taskId,
        taskName: input.taskName,
        description: input.description,
        input: sanitizedInput,
        skillContext,
        signal: input.signal,
        workflowId: input.workflowId,
      });
      recordStep('execution', 10, true, s, undefined, {
        cost: agentResult.cost,
        skillsApplied: skillContext.enabledSkillIds,
        skillCapabilities: skillContext.capabilities,
      });
    } catch (err) {
      const error = err as Error;
      recordStep('execution', 10, false, s, `Agent threw: ${error.message}`);
    }
  }

  // Step 11: output-sanitization
  if (!aborted && agentResult) {
    const s = Date.now();
    const outStr = JSON.stringify(agentResult.output);
    outputHadPII = PII_PATTERNS.some((p) => p.test(outStr));
    recordStep('output-sanitization', 11, true, s, outputHadPII ? 'PII detected in output' : undefined, { piiDetected: outputHadPII });
  }

  // Step 12: cost-ledger-write
  if (!aborted && agentResult) {
    const s = Date.now();
    const durationMs = Date.now() - pipelineStart;
    if (isUnitTest()) {
      recordStep('cost-ledger-write', 12, true, s, 'ledger write skipped in test mode');
    } else {
      try {
        await sql`
          INSERT INTO cost_ledger (tenant_id, workflow_id, agent_id, provider, model, tokens_in, tokens_out, cost, duration_ms, domain)
          VALUES (
            ${input.tenantId},
            ${input.workflowId},
            ${input.agentName},
            ${'agent-pipeline'},
            ${'agent-internal'},
            ${0},
            ${0},
            ${agentResult.cost},
            ${durationMs},
            ${'agent-execution'}
          )
        `;
        recordStep('cost-ledger-write', 12, true, s);
      } catch (err) {
        // DB optional; still record the step but mark the issue without aborting
        steps.push({ step: 'cost-ledger-write', order: 12, passed: true, durationMs: Date.now() - s, message: `ledger write skipped: ${(err as Error).message}` });
      }
    }
  }

  // Step 13: audit-chain-append (ALWAYS — even on failure)
  {
    const s = Date.now();
    try {
      await auditChain.append({
        action: aborted ? 'agent.execution.denied' : 'agent.execution.completed',
        actor: input.agentName,
        actorType: 'agent',
        resource: `workflow:${input.workflowId}/task:${input.taskId}`,
        tenantId: input.tenantId,
        details: {
          executionId,
          abortStep,
          abortReason,
          inputHadSecrets,
          outputHadPII,
          policyMatched: policyDecision?.matched ?? [],
          skillsApplied: skillContext?.enabledSkillIds ?? [],
          stepsRun: steps.length,
        },
        riskLevel: aborted ? 'high' : (outputHadPII || inputHadSecrets ? 'medium' : 'low'),
      });
      recordStep('audit-chain-append', 13, true, s);
    } catch (err) {
      steps.push({ step: 'audit-chain-append', order: 13, passed: false, durationMs: Date.now() - s, message: `audit write failed: ${(err as Error).message}` });
    }
  }

  // Memory update (soft step — does not affect success)
  if (!aborted && agentResult) {
    try {
      await memoryEngine.store({
        type: 'episodic',
        content: `Agent ${input.agentName} completed task "${input.taskName}" in workflow ${input.workflowId}`,
        source: input.agentName,
        confidence: 0.9,
        tags: ['execution', input.agentName, input.workflowId],
        tenantId: input.tenantId,
        workflowId: input.workflowId,
        agentId: input.agentName,
        metadata: { executionId, cost: agentResult.cost, durationMs: Date.now() - pipelineStart },
      });
    } catch {
      // soft-fail
    }
  }

  const durationMs = Date.now() - pipelineStart;
  const result: PipelineResult = {
    executionId,
    success: !aborted && Boolean(agentResult),
    aborted,
    abortReason,
    abortStep,
    steps,
    agentResult,
    policyDecision,
    sanitized: { inputHadSecrets, outputHadPII },
    durationMs,
    cost: agentResult?.cost ?? 0,
  };

  broadcastUpdate('pipeline.executed', {
    executionId,
    workflowId: input.workflowId,
    taskId: input.taskId,
    agent: input.agentName,
    success: result.success,
    aborted: result.aborted,
    abortStep: result.abortStep,
    stepsRun: result.steps.length,
    durationMs,
    cost: result.cost,
  });

  agentRegistry.recordExecution(input.agentName, durationMs, result.cost, result.success);

  return result;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function isUnitTest(): boolean {
  return process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
}
