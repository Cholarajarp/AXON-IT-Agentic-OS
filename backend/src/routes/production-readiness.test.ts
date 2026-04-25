import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerProductionReadinessRoutes } from './production-readiness.js';

describe('production readiness routes', () => {
  it('activates the production delivery loop and reports service readiness', async () => {
    const app = Fastify();
    await app.register(registerProductionReadinessRoutes);

    const activation = await app.inject({
      method: 'POST',
      url: '/production-readiness/activate',
      payload: {
        mission: 'Activate AXON for production-ready product delivery with database safety, API Forge, QA, security, release, and customer report',
        environment: 'staging',
        regulated: true,
      },
    });

    expect(activation.statusCode).toBe(201);
    const body = activation.json();
    expect(body.missionControlRunId).toMatch(/^mctl_/);
    expect(body.releaseMissionId).toMatch(/^rel_/);
    expect(body.report.capabilities.length).toBeGreaterThan(8);
    expect(body.report.capabilities.some((capability: { id: string; status: string }) => capability.id === 'model-finops' && capability.status === 'active')).toBe(true);
    expect(body.report.serviceOffers.length).toBeGreaterThan(2);
    expect(body.report.runtime.status).toMatch(/blocked|pilot-ready|development-only|production-ready/);
    expect(body.report.runtime.blockers).toEqual(expect.any(Array));
    if (!body.report.runtime.productionReady) {
      expect(body.report.blockers.some((blocker: string) => blocker.startsWith('Runtime:'))).toBe(true);
    }
    expect(body.activatedCapabilityIds).toEqual(expect.arrayContaining(['product-factory', 'agentic-mesh', 'model-finops', 'customer-delivery']));

    await app.close();
  });
});
