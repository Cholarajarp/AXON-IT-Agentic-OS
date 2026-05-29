import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerStreamRoutes } from './stream.js';

describe('stream and integration utility routes', () => {
  const app = Fastify({ logger: false });

  beforeAll(async () => {
    await app.register(registerStreamRoutes);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unsupported connector configuration types', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/integrations/configure',
      payload: { type: 'unknown-crm', baseUrl: 'https://crm.example.com', enabled: true },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: 'Unsupported integration type: unknown-crm' });
  });

  it('creates and lists connector tickets through the route layer', async () => {
    await app.inject({
      method: 'POST',
      url: '/integrations/configure',
      payload: { type: 'github', baseUrl: 'https://api.github.com', token: 'test-token', enabled: true },
    });

    const created = await app.inject({
      method: 'POST',
      url: '/integrations/github/tickets',
      payload: { title: 'Create release checklist', description: 'Track customer release evidence.', priority: 'P2', type: 'service_request' },
    });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ externalId: '#100', title: 'Create release checklist' });

    const listed = await app.inject({ method: 'GET', url: '/integrations/github/tickets' });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual([expect.objectContaining({ externalId: '#100' })]);
  });
});
