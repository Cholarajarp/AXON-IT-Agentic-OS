import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerCheckpointRoutes } from './checkpoints.js';

describe('checkpoint routes', () => {
  it('creates a checkpoint with tracked artifacts', async () => {
    const app = Fastify();
    await app.register(registerCheckpointRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/checkpoints',
      payload: {
        name: 'Test checkpoint',
        scope: 'workspace',
        includePaths: ['package.json'],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.id).toMatch(/^chk_/);
    expect(body.artifacts).toEqual([
      expect.objectContaining({ path: 'package.json', kind: 'config' }),
    ]);

    await app.close();
  });

  it('previews rollback without mutating files', async () => {
    const app = Fastify();
    await app.register(registerCheckpointRoutes);

    const created = await app.inject({
      method: 'POST',
      url: '/checkpoints',
      payload: {
        name: 'Rollback checkpoint',
        scope: 'workspace',
        includePaths: ['package.json'],
      },
    });
    const id = created.json().id;

    const preview = await app.inject({
      method: 'POST',
      url: `/checkpoints/${id}/preview-rollback`,
    });

    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({
      checkpointId: id,
      safeToRestore: true,
    });
    expect(preview.json().warnings).toEqual(
      expect.arrayContaining(['Rollback is preview-only in this version; no files are modified by this API.']),
    );

    await app.close();
  });
});
