import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerArtifactRoutes } from './artifacts.js';

describe('artifact routes', () => {
  it('stores immutable artifact records and reports storage health', async () => {
    const app = Fastify();
    await app.register(registerArtifactRoutes);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/artifacts',
      payload: {
        tenantId: 'tenant_test',
        kind: 'release-pack',
        name: 'test-release-pack',
        content: {
          release: 'customer-portal',
          evidence: ['test', 'audit', 'handoff'],
        },
        metadata: { source: 'route-test' },
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json();
    expect(created.id).toMatch(/^art_/);
    expect(created.sha256).toHaveLength(64);
    expect(created.bytes).toBeGreaterThan(0);
    expect(created.uri).toMatch(/^file:\/\//);

    const listResponse = await app.inject({
      method: 'GET',
      url: '/artifacts?tenantId=tenant_test&kind=release-pack',
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().artifacts.some((artifact: { id: string }) => artifact.id === created.id)).toBe(true);

    const healthResponse = await app.inject({ method: 'GET', url: '/artifacts/health' });
    expect(healthResponse.statusCode).toBe(200);
    expect(healthResponse.json().writable).toBe(true);

    await app.close();
  });
});
