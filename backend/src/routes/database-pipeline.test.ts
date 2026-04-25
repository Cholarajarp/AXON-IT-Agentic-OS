import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerDatabasePipelineRoutes } from './database-pipeline.js';

describe('database pipeline routes', () => {
  it('returns enforced database policies', async () => {
    const app = Fastify();
    await app.register(registerDatabasePipelineRoutes);

    const response = await app.inject({
      method: 'GET',
      url: '/database-pipeline/policies',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'db-prod-destructive-change-gate' }),
        expect.objectContaining({ id: 'db-quality-gates-required' }),
      ]),
    );

    await app.close();
  });

  it('allows additive migrations with evidence gates', async () => {
    const app = Fastify();
    await app.register(registerDatabasePipelineRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/database-pipeline/review',
      payload: {
        sql: 'ALTER TABLE customers ADD COLUMN marketing_opt_in boolean DEFAULT false;',
        environment: 'staging',
        hasRollbackPlan: true,
        tableSizeGb: 1,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.blocked).toBe(false);
    expect(body.approvalRequired).toBe(true);
    expect(body.safeMigrationPlan.strategy).toMatch(/direct|expand-contract/);
    expect(body.qualityGates).toEqual(expect.arrayContaining(['SQL lint and policy review pass']));

    await app.close();
  });

  it('blocks destructive production migrations', async () => {
    const app = Fastify();
    await app.register(registerDatabasePipelineRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/database-pipeline/review',
      payload: {
        sql: 'DROP TABLE invoices; TRUNCATE TABLE customers;',
        environment: 'production',
        hasBackupCheckpoint: true,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.blocked).toBe(true);
    expect(body.severity).toBe('CRITICAL');
    expect(body.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'destructive-change', blocksProduction: true }),
      ]),
    );

    await app.close();
  });

  it('flags large PostgreSQL index builds without concurrently', async () => {
    const app = Fastify();
    await app.register(registerDatabasePipelineRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/database-pipeline/review',
      payload: {
        sql: 'CREATE INDEX idx_events_account_id ON events(account_id);',
        engine: 'postgresql',
        environment: 'production',
        estimatedRows: 5_000_000,
        hasRollbackPlan: true,
        hasBackupCheckpoint: true,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.blocked).toBe(false);
    expect(body.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'db-postgres-index-without-concurrently', severity: 'HIGH' }),
      ]),
    );
    expect(body.safeMigrationPlan.strategy).toBe('batch-data-change');

    await app.close();
  });

  it('blocks unbounded production updates', async () => {
    const app = Fastify();
    await app.register(registerDatabasePipelineRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/database-pipeline/review',
      payload: {
        sql: "UPDATE users SET role = 'admin';",
        environment: 'production',
        migrationType: 'data',
        hasRollbackPlan: true,
        hasBackupCheckpoint: true,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.blocked).toBe(true);
    expect(body.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'db-unbounded-update', blocksProduction: true }),
      ]),
    );

    await app.close();
  });
});
