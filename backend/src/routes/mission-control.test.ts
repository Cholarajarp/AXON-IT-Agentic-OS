import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerMissionControlRoutes } from './mission-control.js';

describe('mission control routes', () => {
  it('creates an autonomous build loop run with connected evidence', async () => {
    const app = Fastify();
    await app.register(registerMissionControlRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/mission-control/runs',
      payload: {
        mission: 'Build and verify an enterprise customer portal with browser QA and release evidence',
        environment: 'preview',
        regulated: true,
        htmlSnapshot: '<!doctype html><html lang="en"><head><title>AXON Mission Preview</title></head><body><main><h1>AXON Mission Preview</h1><button>Start delivery</button><section>Dashboard</section></main></body></html>',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.blueprintId).toMatch(/^bp_/);
    expect(body.finOpsReportId).toMatch(/^finops_/);
    expect(body.agenticMeshBlueprintId).toMatch(/^mesh_/);
    expect(body.databaseReviewId).toMatch(/^dbrev_/);
    expect(body.apiForgeReportId).toMatch(/^api_/);
    expect(body.customerAccountId).toMatch(/^cust_/);
    expect(body.customerReportId).toMatch(/^report_/);
    expect(body.sandboxSessionId).toMatch(/^sbx_/);
    expect(body.browserQaReportId).toMatch(/^qa_/);
    expect(body.blackboardId).toMatch(/^bb_/);
    expect(body.releaseMissionId).toMatch(/^rel_/);
    expect(body.trustRecordIds.length).toBeGreaterThan(5);
    expect(body.phases.length).toBe(9);
    expect(body.evidence).toEqual(expect.arrayContaining([expect.stringContaining('model finops')]));
    expect(body.evidence).toEqual(expect.arrayContaining([expect.stringContaining('agentic mesh')]));
    expect(body.evidence).toEqual(expect.arrayContaining([expect.stringContaining('customer report')]));
    expect(body.evidence).toEqual(expect.arrayContaining([expect.stringContaining('trust ledger')]));
    expect(body.evidence).toEqual(expect.arrayContaining([expect.stringContaining('release mission')]));

    await app.close();
  });
});
