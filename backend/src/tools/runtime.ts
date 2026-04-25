/**
 * Tool Execution Runtime — the governance spine for every tool call.
 *
 * This mirrors the agent pipeline but enforces tool-specific controls:
 *
 *   1.  intent-validation       — required fields present
 *   2.  tenant-isolation        — tenantId scoped, sandbox derived
 *   3.  tool-allowlist          — tool is registered
 *   4.  rbac-check              — actor can execute tools
 *   5.  rate-limit              — per (tenant, tool) bucket
 *   6.  policy-check            — declarative policies allow this call
 *   7.  approval-gate           — approvalRequired tools need approvalApproved=true
 *   8.  parameter-sanitization  — strip secrets, deep-redact
 *   9.  capability-check        — tool handler present, risk level acceptable
 *  10.  execution               — tool.execute() with sandbox config
 *  11.  output-sanitization     — flag PII in output
 *  12.  tool-ledger-write       — record to tool_executions
 *  13.  audit-chain-append      — tamper-evident log entry
 *
 * Like the agent pipeline, failures short-circuit but audit-chain always runs.
 * The return value is a structured result; this function never throws.
 */

import { nanoid } from 'nanoid';
import { toolRegistry } from './registry.js';
import type { ToolExecutionRequest, ToolExecutionResult, SandboxConfig } from './types.js';
import { auditChain } from '../services/audit-chain.js';
import { rbacService } from '../services/rbac.js';
import { rateLimiter } from '../services/rate-limiter.js';
import { policyService, type PolicyDecision } from '../services/policy.js';
import { broadcastUpdate } from '../ws/gateway.js';
import { sql } from '../db/connection.js';
import { sandboxPaths, ensureSandbox, buildSafeEnv } from './safety/sandbox-fs.js';

export interface ToolRuntimeInput {
  toolName: string;
  parameters: Record<string, unknown>;
  workflowId: string;
  taskId: string;
  agentId: string;
  tenantId: string;
  sensitivityLevel?: 'public' | 'internal' | 'confidential' | 'restricted';
  sovereignMode?: boolean;
  approvalApproved?: boolean;
  allowedHosts?: string[];
}

export interface ToolStepResult {
  step: string;
  order: number;
  passed: boolean;
  durationMs: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolRuntimeResult {
  executionId: string;
  success: boolean;
  aborted: boolean;
  abortReason?: string;
  abortStep?: string;
  steps: ToolStepResult[];
  toolResult?: ToolExecutionResult;
  policyDecision?: PolicyDecision;
  sanitized: {
    inputHadSecrets: boolean;
    outputHadPII: boolean;
  };
  durationMs: number;
}

export const TOOL_PIPELINE_STEPS = [
  { order: 1, name: 'intent-validation', description: 'Required fields on the tool call' },
  { order: 2, name: 'tenant-isolation', description: 'Tenant context and sandbox derived' },
  { order: 3, name: 'tool-allowlist', description: 'Tool is registered in the ToolRegistry' },
  { order: 4, name: 'rbac-check', description: 'Caller has tools:execute permission' },
  { order: 5, name: 'rate-limit', description: '(tenant, tool) bucket has capacity' },
  { order: 6, name: 'policy-check', description: 'Declarative policies allow this tool call' },
  { order: 7, name: 'approval-gate', description: 'High-risk tools require an approved decision' },
  { order: 8, name: 'parameter-sanitization', description: 'Secrets in parameters are redacted' },
  { order: 9, name: 'capability-check', description: 'Handler present and risk level acceptable' },
  { order: 10, name: 'execution', description: 'Tool handler runs with derived sandbox' },
  { order: 11, name: 'output-sanitization', description: 'PII in output is flagged' },
  { order: 12, name: 'tool-ledger-write', description: 'tool_executions row recorded' },
  { order: 13, name: 'audit-chain-append', description: 'Cryptographic audit entry written' },
];

const SECRET_PATTERNS = [
  /password\s*[:=]\s*\S+/gi,
  /api[_-]?key\s*[:=]\s*\S+/gi,
  /secret\s*[:=]\s*\S+/gi,
  /bearer\s+[A-Za-z0-9._-]+/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
];

const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/,
];

export async function executeTool(input: ToolRuntimeInput): Promise<ToolRuntimeResult> {
  const executionId = nanoid(12);
  const start = Date.now();
  const steps: ToolStepResult[] = [];

  let aborted = false;
  let abortReason: string | undefined;
  let abortStep: string | undefined;
  let inputHadSecrets = false;
  let outputHadPII = false;
  let sanitizedParams = input.parameters;
  let toolResult: ToolExecutionResult | undefined;
  let policyDecision: PolicyDecision | undefined;

  const record = (name: string, order: number, passed: boolean, s: number, message?: string, metadata?: Record<string, unknown>) => {
    steps.push({ step: name, order, passed, durationMs: Date.now() - s, message, metadata });
    if (!passed && !aborted) {
      aborted = true;
      abortReason = message;
      abortStep = name;
    }
  };

  // Step 1 — intent-validation
  {
    const s = Date.now();
    const ok = Boolean(input.toolName && input.workflowId && input.taskId && input.tenantId && input.agentId);
    record('intent-validation', 1, ok, s, ok ? undefined : 'Missing required fields');
  }

  // Step 2 — tenant-isolation + sandbox derivation
  let paths: ReturnType<typeof sandboxPaths> | undefined;
  if (!aborted) {
    const s = Date.now();
    try {
      paths = sandboxPaths(input.tenantId, input.workflowId, input.taskId);
      await ensureSandbox(paths);
      record('tenant-isolation', 2, true, s, undefined, { taskDir: paths.taskDir });
    } catch (err) {
      record('tenant-isolation', 2, false, s, `Sandbox derivation failed: ${(err as Error).message}`);
    }
  }

  // Step 3 — tool-allowlist
  const handler = !aborted ? toolRegistry.get(input.toolName) : undefined;
  if (!aborted) {
    const s = Date.now();
    record('tool-allowlist', 3, Boolean(handler), s, handler ? undefined : `Tool not registered: ${input.toolName}`);
  }

  // Step 4 — rbac-check (agent role)
  if (!aborted) {
    const s = Date.now();
    const synthetic = {
      id: `agent:${input.agentId}`,
      email: `${input.agentId}@axon.local`,
      name: input.agentId,
      role: 'agent' as const,
      tenantId: input.tenantId,
      permissions: [],
      active: true,
    };
    const ok = rbacService.canAccess(synthetic, 'tools', 'execute');
    record('rbac-check', 4, ok, s, ok ? undefined : 'Agent role lacks tools:execute');
  }

  // Step 5 — rate-limit (per tenant+tool)
  if (!aborted) {
    const s = Date.now();
    const key = `tool:${input.tenantId}:${input.toolName}`;
    const ok = rateLimiter.tryAcquire(key);
    record('rate-limit', 5, ok, s, ok ? undefined : `Tool rate limit exceeded for ${key}`, { key });
  }

  // Step 6 — policy-check
  if (!aborted) {
    const s = Date.now();
    policyDecision = await policyService.evaluate({
      agent: input.agentId,
      tenantId: input.tenantId,
      sensitivityLevel: input.sensitivityLevel,
      sovereignMode: input.sovereignMode,
      approvalApproved: input.approvalApproved,
    });
    record('policy-check', 6, policyDecision.allowed, s,
      policyDecision.allowed ? undefined : policyDecision.reasons.join('; '),
      { matched: policyDecision.matched });
  }

  // Step 7 — approval-gate (tools with requiresApproval=true need explicit approval)
  if (!aborted && handler) {
    const s = Date.now();
    const needs = handler.definition.requiresApproval;
    const ok = !needs || input.approvalApproved === true;
    record('approval-gate', 7, ok, s, ok ? undefined : `Tool ${input.toolName} requires approval`);
  }

  // Step 8 — parameter-sanitization (non-aborting; redacts in place)
  if (!aborted) {
    const s = Date.now();
    const asStr = JSON.stringify(input.parameters);
    inputHadSecrets = SECRET_PATTERNS.some((p) => p.test(asStr));
    if (inputHadSecrets) {
      let redacted = asStr;
      for (const p of SECRET_PATTERNS) redacted = redacted.replace(p, '[REDACTED]');
      try {
        sanitizedParams = JSON.parse(redacted);
      } catch {
        sanitizedParams = { redacted: true };
      }
    }
    record('parameter-sanitization', 8, true, s, inputHadSecrets ? 'Secrets redacted' : undefined, { redacted: inputHadSecrets });
  }

  // Step 9 — capability-check
  if (!aborted && handler) {
    const s = Date.now();
    const risk = handler.definition.riskLevel;
    const restrictedHighRisk = input.sensitivityLevel === 'restricted' && (risk === 'high' || risk === 'critical');
    const ok = !restrictedHighRisk || input.sovereignMode === true;
    record('capability-check', 9, ok, s, ok ? undefined : `High-risk tool on restricted data requires sovereignMode`, { risk });
  }

  // Step 10 — execution
  if (!aborted && handler && paths) {
    const s = Date.now();
    const sandboxCfg: SandboxConfig = {
      maxExecutionTime: handler.definition.timeout,
      maxMemoryMb: 512,
      allowNetwork: handler.definition.category === 'http' || handler.definition.category === 'cloud',
      allowFileSystem: handler.definition.category === 'file' || handler.definition.category === 'git' || handler.definition.category === 'code',
      allowedHosts: input.allowedHosts,
      workingDirectory: paths.taskDir,
      environmentVariables: buildSafeEnv(),
    };
    const execRequest: ToolExecutionRequest = {
      toolName: input.toolName,
      parameters: sanitizedParams,
      workflowId: input.workflowId,
      taskId: input.taskId,
      agentId: input.agentId,
      tenantId: input.tenantId,
      sandboxed: true,
    };

    try {
      toolResult = await handler.execute(execRequest, sandboxCfg);
      record('execution', 10, Boolean(toolResult.success), s,
        toolResult.success ? undefined : `Tool reported failure`,
        { durationMs: toolResult.durationMs });
    } catch (err) {
      record('execution', 10, false, s, `Tool threw: ${(err as Error).message}`);
    }
  }

  // Step 11 — output-sanitization
  if (!aborted && toolResult) {
    const s = Date.now();
    const outStr = JSON.stringify(toolResult.output ?? '');
    outputHadPII = PII_PATTERNS.some((p) => p.test(outStr));
    record('output-sanitization', 11, true, s, outputHadPII ? 'PII detected in output' : undefined, { piiDetected: outputHadPII });
  }

  // Step 12 — tool-ledger-write
  if (!aborted && toolResult) {
    const s = Date.now();
    try {
      await sql`
        INSERT INTO tool_executions (tool_name, workflow_id, task_id, agent_id, tenant_id, parameters, result, success, duration_ms)
        VALUES (
          ${input.toolName},
          ${input.workflowId},
          ${input.taskId},
          ${input.agentId},
          ${input.tenantId},
          ${JSON.stringify(sanitizedParams)},
          ${JSON.stringify({ output: toolResult.output, success: toolResult.success })},
          ${toolResult.success},
          ${toolResult.durationMs}
        )
      `;
      record('tool-ledger-write', 12, true, s);
    } catch (err) {
      steps.push({ step: 'tool-ledger-write', order: 12, passed: true, durationMs: Date.now() - s, message: `ledger write skipped: ${(err as Error).message}` });
    }
  }

  // Step 13 — audit-chain-append (ALWAYS)
  {
    const s = Date.now();
    try {
      await auditChain.append({
        action: aborted ? 'tool.execution.denied' : 'tool.execution.completed',
        actor: input.agentId,
        actorType: 'agent',
        resource: `tool:${input.toolName}/workflow:${input.workflowId}`,
        tenantId: input.tenantId,
        details: {
          executionId,
          toolName: input.toolName,
          abortStep,
          abortReason,
          inputHadSecrets,
          outputHadPII,
          stepsRun: steps.length,
        },
        riskLevel: aborted ? 'high' : (inputHadSecrets || outputHadPII ? 'medium' : 'low'),
      });
      record('audit-chain-append', 13, true, s);
    } catch (err) {
      steps.push({ step: 'audit-chain-append', order: 13, passed: false, durationMs: Date.now() - s, message: `audit write failed: ${(err as Error).message}` });
    }
  }

  const durationMs = Date.now() - start;
  const result: ToolRuntimeResult = {
    executionId,
    success: !aborted && Boolean(toolResult?.success),
    aborted,
    abortReason,
    abortStep,
    steps,
    toolResult,
    policyDecision,
    sanitized: { inputHadSecrets, outputHadPII },
    durationMs,
  };

  broadcastUpdate('tool.executed', {
    executionId,
    workflowId: input.workflowId,
    taskId: input.taskId,
    agent: input.agentId,
    tool: input.toolName,
    success: result.success,
    aborted,
    abortStep,
    durationMs,
  });

  return result;
}
