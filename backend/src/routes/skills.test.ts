import Fastify from 'fastify';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerSkillRoutes } from './skills.js';

let stateDir: string;

describe('skill registry routes', () => {
  beforeEach(async () => {
    stateDir = await mkdtemp(path.join(tmpdir(), 'axon-skills-'));
    process.env.AXON_LOCAL_STATE_DIR = stateDir;
  });

  afterEach(async () => {
    delete process.env.AXON_LOCAL_STATE_DIR;
    await rm(stateDir, { recursive: true, force: true });
  });

  it('lists default skills and creates an operator skill pack', async () => {
    const app = Fastify();
    await app.register(registerSkillRoutes);

    const list = await app.inject({ method: 'GET', url: '/skills' });
    expect(list.statusCode).toBe(200);
    expect(list.json().skills.length).toBeGreaterThan(0);

    const created = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: {
        name: 'FinOps Review',
        description: 'Review cloud and model cost before launch.',
        capabilities: ['cost-estimation', 'budget-policy'],
        prompts: ['Show cost, risk, and cheaper alternatives before launch.'],
        allowedTools: ['cost.summary', 'models.catalog'],
        riskLevel: 'medium',
      },
    });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      name: 'FinOps Review',
      enabled: true,
      capabilities: ['cost-estimation', 'budget-policy'],
    });

    const removed = await app.inject({
      method: 'DELETE',
      url: `/skills/${created.json().id}`,
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json()).toMatchObject({ removed: true, id: created.json().id });

    await app.close();
  });
});
