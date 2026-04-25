import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerEnterpriseOsRoutes } from './enterprise-os.js';

describe('enterprise os routes', () => {
  it('returns market-aware capability map', async () => {
    const app = Fastify();
    await app.register(registerEnterpriseOsRoutes);

    const response = await app.inject({ method: 'GET', url: '/enterprise-os/capabilities' });

    expect(response.statusCode).toBe(200);
    expect(response.json().capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'prompt-to-product', axonStatus: 'live' }),
        expect.objectContaining({ id: 'database-safety', axonStatus: 'live' }),
      ]),
    );
    expect(response.json().marketSignals).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Autonomous workbench' })]),
    );

    await app.close();
  });

  it('scores enterprise readiness and reports blockers', async () => {
    const app = Fastify();
    await app.register(registerEnterpriseOsRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/enterprise-os/readiness',
      payload: {
        hasBlueprint: true,
        hasPreview: true,
        hasProvider: false,
        hasDatabaseReview: false,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('builder-ready');
    expect(body.missing).toEqual(
      expect.arrayContaining(['Model provider configured', 'Database safety reviewed']),
    );
    expect(body.launchSequence.length).toBeGreaterThan(5);

    await app.close();
  });
});
