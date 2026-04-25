import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerMarketRadarRoutes } from './market-radar.js';

describe('market radar routes', () => {
  it('creates a market report with ranked build packs and gaps', async () => {
    const app = Fastify();
    await app.register(registerMarketRadarRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/market-radar/reports',
      payload: {
        focus: 'Build browser QA, sandbox, governance, deployment, and customer proof for enterprise AI delivery.',
        targetUser: 'enterprise founders and IT leaders',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.signals.length).toBeGreaterThan(8);
    expect(body.gaps.length).toBeGreaterThan(4);
    expect(body.buildPacks[0].impactScore).toBeGreaterThanOrEqual(body.buildPacks[1].impactScore);
    expect(body.recommendedSequence[0].buildPackId).toBe(body.buildPacks[0].id);
    expect(body.referenceCoverage.map((item: { source: string }) => item.source)).toEqual(
      expect.arrayContaining(['cloud-coding-agent', 'browser-app-builder', 'full-stack-builder']),
    );

    await app.close();
  });

  it('launches a build pack into mission control', async () => {
    const app = Fastify();
    await app.register(registerMarketRadarRoutes);

    const reportResponse = await app.inject({
      method: 'POST',
      url: '/market-radar/reports',
      payload: { focus: 'Build signed evidence and browser worker moat' },
    });
    const report = reportResponse.json();

    const launchResponse = await app.inject({
      method: 'POST',
      url: `/market-radar/reports/${report.id}/launch`,
      payload: { buildPackId: report.buildPacks[0].id },
    });

    expect(launchResponse.statusCode).toBe(201);
    const launch = launchResponse.json();
    expect(launch.missionControlRunId).toMatch(/^mctl_/);
    expect(launch.releaseMissionId).toMatch(/^rel_/);

    await app.close();
  });
});
