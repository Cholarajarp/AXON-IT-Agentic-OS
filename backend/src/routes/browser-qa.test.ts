import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerBrowserQaRoutes } from './browser-qa.js';

describe('browser qa routes', () => {
  it('creates preview QA evidence with journeys, accessibility findings, and artifacts', async () => {
    const app = Fastify();
    await app.register(registerBrowserQaRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/browser-qa/reports',
      payload: {
        name: 'Customer Portal Preview',
        releaseGoal: 'Validate customer portal dashboard before release',
        htmlSnapshot: '<!doctype html><html lang="en"><head><title>Customer Portal</title></head><body><main><h1>Dashboard</h1><button>Open account</button></main></body></html>',
        journeys: [
          { name: 'Dashboard loads', path: '/', assertions: ['Dashboard', 'Open account'], critical: true },
        ],
        validationEvidence: [
          { kind: 'typecheck', status: 'pass', command: 'npm run typecheck' },
          { kind: 'build', status: 'pass', command: 'npm run build' },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.score).toBeGreaterThanOrEqual(85);
    expect(body.status).toBe('release-ready');
    expect(body.journeys[0].status).toBe('pass');
    expect(body.releaseEvidence).toEqual(expect.arrayContaining([expect.stringContaining('browser smoke result')]));
    expect(body.artifacts.map((artifact: { kind: string }) => artifact.kind)).toEqual(
      expect.arrayContaining(['playwright-spec', 'release-evidence']),
    );

    await app.close();
  });

  it('blocks release when a live preview cannot be reached', async () => {
    const app = Fastify();
    await app.register(registerBrowserQaRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/browser-qa/reports',
      payload: {
        name: 'Broken Preview',
        releaseGoal: 'Validate app preview',
        targetUrl: 'http://127.0.0.1:9',
        journeys: [{ name: 'App loads', path: '/', assertions: ['main'], critical: true }],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.status).toBe('blocked');
    expect(body.preview.reachable).toBe(false);
    expect(body.nextActions).toEqual(expect.arrayContaining([expect.stringContaining('Start or redeploy')]));

    await app.close();
  });
});
