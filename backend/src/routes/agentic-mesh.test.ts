import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerAgenticMeshRoutes } from './agentic-mesh.js';

describe('agentic mesh routes', () => {
  it('creates a multi-agent blueprint with handoffs, loops, gates, and FinOps linkage', async () => {
    const app = Fastify();
    await app.register(registerAgenticMeshRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/agentic-mesh/blueprints',
      payload: {
        mission: 'Build a 200000-employee capable IT agentic OS for enterprise software delivery, secure databases, browser QA, release operations, and customer handoff',
        regulated: true,
        budgetUsd: 2000,
        autonomyLevel: 'supervised',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.id).toMatch(/^mesh_/);
    expect(body.finOpsReportId).toMatch(/^finops_/);
    expect(body.topologies).toEqual(expect.arrayContaining(['parallel-fanout', 'loop-critic', 'human-gated']));
    expect(body.agentRoles.some((role: { agent: string }) => role.agent === 'AgenticCoordinatorAgent')).toBe(true);
    expect(body.taskEnvelopes.length).toBeGreaterThan(4);
    expect(body.qualityLoops.length).toBeGreaterThan(0);
    expect(body.humanGates.length).toBeGreaterThan(1);
    expect(body.score.enterpriseReadiness).toBeGreaterThan(80);

    const list = await app.inject({ method: 'GET', url: '/agentic-mesh/blueprints' });
    expect(list.statusCode).toBe(200);
    expect(list.json().blueprints.length).toBeGreaterThanOrEqual(1);

    await app.close();
  });
});
