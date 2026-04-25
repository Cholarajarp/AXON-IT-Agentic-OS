import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerAutonomousWorkforceRoutes } from './autonomous-workforce.js';

describe('autonomous workforce routes', () => {
  it('designs a 200k-agent IT operating system with fault, growth, economics, and governance controls', async () => {
    const app = Fastify();
    await app.register(registerAutonomousWorkforceRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/autonomous-workforce/control-planes',
      payload: {
        mission: 'Build a 200,000 agent autonomous IT operating system for product building, secure software engineering, database reliability, cloud operations, AI learning, and managed services',
        targetAgentCount: 200000,
        workMode: 'managed-service',
        monthlyBudgetUsd: 5000000,
        riskTolerance: 'medium',
        regulated: true,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.targetAgentCount).toBe(200000);
    expect(body.autonomyLevel).toBe('supervised');
    expect(body.orgUnits.map((unit: { function: string }) => unit.function)).toEqual(expect.arrayContaining(['engineering', 'security', 'sre', 'data-ai', 'delivery']));
    expect(body.archetypes.length).toBeGreaterThan(8);
    expect(body.faultManagement.map((fault: { fault: string }) => fault.fault)).toEqual(expect.arrayContaining(['hallucinated or unsupported decision', 'cost runaway']));
    expect(body.growthSystem.length).toBeGreaterThan(3);
    expect(body.economics.automationCapacityHours).toBeGreaterThan(0);
    expect(body.launchSequence.length).toBeGreaterThan(4);

    await app.close();
  });
});
