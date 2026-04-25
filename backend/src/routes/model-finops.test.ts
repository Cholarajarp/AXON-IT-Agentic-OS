import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerModelFinOpsRoutes } from './model-finops.js';

describe('model finops routes', () => {
  it('creates a cost-aware model routing report with cache and quality guardrails', async () => {
    const app = Fastify();
    await app.register(registerModelFinOpsRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/model-finops/reports',
      payload: {
        mission: 'Build an enterprise AI IT OS with coding, database migration, browser QA, release evidence, and customer reports while reducing API costs',
        monthlyBudgetUsd: 1200,
        expectedRunsPerMonth: 300,
        contextTokens: 48000,
        outputTokens: 6000,
        repeatedContext: true,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.id).toMatch(/^finops_/);
    expect(body.optimized.savingsPercent).toBeGreaterThan(0);
    expect(body.route.length).toBeGreaterThan(4);
    expect(body.route.some((step: { strategy: string }) => step.strategy === 'cache-first')).toBe(true);
    expect(body.cachePlan.enabled).toBe(true);
    expect(body.guardrails.length).toBeGreaterThanOrEqual(3);
    expect(body.agentBudgets.some((budget: { agent: string }) => budget.agent === 'FinOpsAgent')).toBe(true);

    const list = await app.inject({ method: 'GET', url: '/model-finops/reports' });
    expect(list.statusCode).toBe(200);
    expect(list.json().reports.length).toBeGreaterThanOrEqual(1);

    await app.close();
  });
});
