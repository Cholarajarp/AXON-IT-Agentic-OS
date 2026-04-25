import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerProductionRuntimeRoutes } from './production-runtime.js';

describe('production runtime routes', () => {
  it('reports runtime gates without claiming production when foundations are missing', async () => {
    const app = Fastify();
    await app.register(registerProductionRuntimeRoutes);

    const response = await app.inject({ method: 'GET', url: '/production-runtime/status' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.gates.length).toBeGreaterThanOrEqual(5);
    expect(body.status).toMatch(/blocked|pilot-ready|development-only|production-ready/);
    expect(body.gates.some((gate: { id: string }) => gate.id === 'database')).toBe(true);

    await app.close();
  });
});
