import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerSandboxKernelRoutes } from './sandbox-kernel.js';

describe('sandbox kernel routes', () => {
  it('creates a session, runs a safe command, snapshots, and destroys it', async () => {
    const app = Fastify();
    await app.register(registerSandboxKernelRoutes);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/sandbox-kernel/sessions',
      payload: {
        goal: 'Run deterministic validation in an isolated task workspace',
        name: 'Validation sandbox',
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const session = createResponse.json();
    expect(session.status).toBe('ready');

    const executeResponse = await app.inject({
      method: 'POST',
      url: `/sandbox-kernel/sessions/${session.id}/execute`,
      payload: {
        command: 'node -e "console.log(42)"',
        timeoutMs: 5000,
      },
    });

    expect(executeResponse.statusCode).toBe(201);
    const execution = executeResponse.json();
    expect(execution.status).toBe('passed');
    expect(execution.stdout).toContain('42');

    const snapshotResponse = await app.inject({
      method: 'POST',
      url: `/sandbox-kernel/sessions/${session.id}/snapshot`,
      payload: { label: 'after validation' },
    });

    expect(snapshotResponse.statusCode).toBe(201);
    expect(snapshotResponse.json().manifestHash).toHaveLength(64);

    const destroyResponse = await app.inject({
      method: 'POST',
      url: `/sandbox-kernel/sessions/${session.id}/destroy`,
    });
    expect(destroyResponse.statusCode).toBe(200);
    expect(destroyResponse.json().status).toBe('destroyed');

    await app.close();
  });

  it('blocks high-risk commands without mutation approval', async () => {
    const app = Fastify();
    await app.register(registerSandboxKernelRoutes);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/sandbox-kernel/sessions',
      payload: { goal: 'Check risky commands are gated' },
    });
    const session = createResponse.json();

    const executeResponse = await app.inject({
      method: 'POST',
      url: `/sandbox-kernel/sessions/${session.id}/execute`,
      payload: { command: 'npm install left-pad' },
    });

    expect(executeResponse.statusCode).toBe(409);
    expect(executeResponse.json().status).toBe('blocked');
    expect(executeResponse.json().risk).toBe('high');

    await app.close();
  });
});
