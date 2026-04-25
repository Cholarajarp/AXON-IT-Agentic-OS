import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerSettingsRoutes } from './settings.js';

describe('workspace settings routes', () => {
  it('returns backend settings and persists security toggles in the service', async () => {
    const app = Fastify();
    await app.register(registerSettingsRoutes);

    const initial = await app.inject({ method: 'GET', url: '/settings' });
    expect(initial.statusCode).toBe(200);
    expect(initial.json().runtime.backendConnected).toBe(true);

    const updated = await app.inject({
      method: 'PATCH',
      url: '/settings',
      payload: {
        workspace: {
          name: 'AXON Production Workspace',
          region: 'us-east-1',
        },
        security: {
          requireSso: true,
          encryptedProviderStorage: true,
        },
      },
    });

    expect(updated.statusCode).toBe(200);
    expect(updated.json().workspace.name).toBe('AXON Production Workspace');
    expect(updated.json().workspace.region).toBe('us-east-1');
    expect(updated.json().security.requireSso).toBe(true);
    expect(updated.json().security.encryptedProviderStorage).toBe(true);

    const fetched = await app.inject({ method: 'GET', url: '/settings' });
    expect(fetched.json().workspace.name).toBe('AXON Production Workspace');
    expect(fetched.json().security.requireSso).toBe(true);

    await app.close();
  });
});
