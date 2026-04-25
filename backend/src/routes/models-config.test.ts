import Fastify from 'fastify';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { modelRouter } from '../models/router.js';
import { registerModelRoutes } from './models.js';

let stateDir: string;

describe('model provider web configuration', () => {
  beforeEach(async () => {
    stateDir = await mkdtemp(path.join(tmpdir(), 'axon-model-config-'));
    process.env.AXON_LOCAL_STATE_DIR = stateDir;
    modelRouter.unregister('anthropic');
    modelRouter.unregister('openai');
    modelRouter.unregister('bedrock');
  });

  afterEach(async () => {
    delete process.env.AXON_LOCAL_STATE_DIR;
    await rm(stateDir, { recursive: true, force: true });
  });

  it('saves a masked Anthropic config and registers the provider', async () => {
    const app = Fastify();
    await app.register(registerModelRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/models/config',
      payload: {
        provider: 'anthropic',
        enabled: true,
        apiKey: 'sk-ant-test-1234567890',
        baseUrl: 'https://api.anthropic.com/v1',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().provider).toMatchObject({
      provider: 'anthropic',
      enabled: true,
      apiKeyMasked: 'sk-a••••7890',
    });
    expect(response.json().provider.apiKey).toBeUndefined();
    expect(modelRouter.getProviders()).toContain('anthropic');

    await app.close();
  });

  it('saves Bedrock credentials without returning secrets', async () => {
    const app = Fastify();
    await app.register(registerModelRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/models/config',
      payload: {
        provider: 'bedrock',
        enabled: true,
        region: 'ap-south-1',
        accessKeyId: 'AKIA_TEST_ACCESS_KEY',
        secretAccessKey: 'super-secret-key',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().provider).toMatchObject({
      provider: 'bedrock',
      region: 'ap-south-1',
      accessKeyIdMasked: 'AKIA••••_KEY',
      secretAccessKeyMasked: 'supe••••-key',
    });
    expect(response.json().provider.secretAccessKey).toBeUndefined();
    expect(modelRouter.getProviders()).toContain('bedrock');

    await app.close();
  });
});
