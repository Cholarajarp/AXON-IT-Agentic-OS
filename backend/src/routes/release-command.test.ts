import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerReleaseCommandRoutes } from './release-command.js';

describe('release command routes', () => {
  it('blocks production release when required evidence gates are missing', async () => {
    const app = Fastify();
    await app.register(registerReleaseCommandRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/release-command/missions',
      payload: {
        productName: 'Banking Ops Portal',
        releaseGoal: 'Launch production banking ops portal with PostgreSQL migration, API connectors, PCI evidence, customer report, and 24x7 SLA.',
        environment: 'production',
        regulated: true,
        hasBlueprint: true,
        hasPreview: true,
        hasTests: true,
        hasSecurityScan: false,
        hasDatabaseReview: false,
        hasCheckpoint: true,
        hasRollbackPlan: true,
        hasDeploymentPlan: false,
        hasCustomerReport: false,
        hasApiForgeConnectors: true,
        evidenceArtifacts: ['approved blueprint', 'test output', 'checkpoint id', 'rollback preview', 'API Forge report'],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.status).toBe('blocked');
    expect(body.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'security', status: 'block' }),
        expect.objectContaining({ id: 'database', status: 'block' }),
        expect.objectContaining({ id: 'deployment', status: 'block' }),
      ]),
    );
    expect(body.evidenceManifest).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'customer-report', required: true })]),
    );
    expect(body.faultRecovery.length).toBeGreaterThan(2);

    await app.close();
  });

  it('collects OS evidence and creates an auto-scored release mission', async () => {
    const app = Fastify();
    await app.register(registerReleaseCommandRoutes);

    const snapshotResponse = await app.inject({
      method: 'POST',
      url: '/release-command/evidence-snapshot',
      payload: {
        releaseGoal: 'Launch preview API integration product with customer report and MCP connector',
        environment: 'preview',
      },
    });

    expect(snapshotResponse.statusCode).toBe(201);
    const snapshot = snapshotResponse.json();
    expect(snapshot.signals).toEqual(expect.objectContaining({ checkpoints: expect.any(Number) }));
    expect(snapshot.inferredInput).toEqual(expect.objectContaining({ hasCheckpoint: true }));
    expect(snapshot.gaps.length).toBeGreaterThan(0);

    const autoResponse = await app.inject({
      method: 'POST',
      url: '/release-command/missions/auto',
      payload: {
        productName: 'API Integration Preview',
        releaseGoal: 'Launch preview API integration product with customer report and MCP connector',
        environment: 'preview',
      },
    });

    expect(autoResponse.statusCode).toBe(201);
    expect(autoResponse.json().evidenceManifest.length).toBeGreaterThan(0);

    await app.close();
  });
});
