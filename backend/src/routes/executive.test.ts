import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerExecutiveRoutes } from './executive.js';

describe('executive routes', () => {
  const app = Fastify({ logger: false });

  beforeAll(async () => {
    await app.register(registerExecutiveRoutes);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns an operating baseline instead of failing when database metrics are unavailable', async () => {
    const response = await app.inject({ method: 'GET', url: '/executive/summary' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.weeklyVelocity).toHaveLength(12);
    expect(body.insight).toMatchObject({
      headline: expect.stringContaining('No completed workflow data yet'),
      signals: expect.any(Array),
    });
  });
});
