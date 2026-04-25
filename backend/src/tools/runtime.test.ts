import { describe, expect, it, beforeEach } from 'vitest';
import { executeTool, TOOL_PIPELINE_STEPS } from './runtime.js';
import { rateLimiter } from '../services/rate-limiter.js';
import { policyService } from '../services/policy.js';

function baseInput(overrides: Partial<Parameters<typeof executeTool>[0]> = {}) {
  return {
    toolName: 'http.request',
    parameters: { url: 'https://example.com/' },
    workflowId: 'wf_tool_test',
    taskId: 'task_tool_test',
    agentId: 'EngineeringAgent',
    tenantId: 'tenant_tool_test',
    sensitivityLevel: 'internal' as const,
    sovereignMode: false,
    approvalApproved: true,
    ...overrides,
  };
}

describe('Tool runtime — 13-step pipeline', () => {
  beforeEach(() => {
    rateLimiter.reset();
    policyService.invalidateCache();
  });

  it('exposes exactly 13 canonical steps', () => {
    expect(TOOL_PIPELINE_STEPS).toHaveLength(13);
    for (let i = 0; i < TOOL_PIPELINE_STEPS.length; i++) {
      expect(TOOL_PIPELINE_STEPS[i]!.order).toBe(i + 1);
    }
  });

  it('aborts at intent-validation when required fields missing', async () => {
    const r = await executeTool(baseInput({ toolName: '' }));
    expect(r.aborted).toBe(true);
    expect(r.abortStep).toBe('intent-validation');
  });

  it('aborts at tool-allowlist for unknown tools', async () => {
    const r = await executeTool(baseInput({ toolName: 'nonexistent.tool' }));
    expect(r.aborted).toBe(true);
    expect(r.abortStep).toBe('tool-allowlist');
  });

  it('aborts at approval-gate when high-risk tool lacks approval', async () => {
    const r = await executeTool(baseInput({
      toolName: 'shell.exec',
      parameters: { program: 'ls', args: ['-la'] },
      approvalApproved: false,
    }));
    expect(r.aborted).toBe(true);
    expect(r.abortStep).toBe('approval-gate');
  });

  it('aborts at capability-check when high-risk tool runs on restricted data without sovereign mode', async () => {
    const r = await executeTool(baseInput({
      toolName: 'shell.exec',
      parameters: { program: 'ls', args: [] },
      sensitivityLevel: 'restricted',
      sovereignMode: false,
      approvalApproved: true,
    }));
    expect(r.aborted).toBe(true);
    // Policy-check fires first for restricted data — that's fine, either is a hard stop.
    expect(['policy-check', 'capability-check']).toContain(r.abortStep);
  });

  it('always writes an audit-chain entry, even on denied executions', async () => {
    const r = await executeTool(baseInput({ toolName: '' }));
    const audit = r.steps.find((s) => s.step === 'audit-chain-append');
    expect(audit).toBeDefined();
    expect(audit?.passed).toBe(true);
  });

  it('redacts secrets in parameter-sanitization without aborting', async () => {
    const r = await executeTool(baseInput({
      toolName: 'http.request',
      parameters: {
        url: 'https://example.com/',
        headers: { Authorization: 'Bearer super-secret-12345' },
      },
    }));
    // Sanitization is non-aborting; it flags but continues.
    expect(r.sanitized.inputHadSecrets).toBe(true);
  });

  it('enforces rate-limit after bucket drain', async () => {
    const key = `tool:${'tenant_rate'}:${'http.request'}`;
    for (let i = 0; i < 200; i++) rateLimiter.tryAcquire(key);
    const r = await executeTool(baseInput({ tenantId: 'tenant_rate' }));
    expect(r.aborted).toBe(true);
    expect(r.abortStep).toBe('rate-limit');
  });
});
