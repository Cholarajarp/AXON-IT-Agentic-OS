import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerManagedServicesRoutes } from './managed-services.js';

describe('managed services routes', () => {
  it('creates a 24x7 managed service model with cloud, security, database, AI, and FinOps towers', async () => {
    const app = Fastify();
    await app.register(registerManagedServicesRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/managed-services/accounts',
      payload: {
        customerName: 'Acme Bank',
        industry: 'Financial services',
        objective: 'Run 45 production banking applications on AWS and Azure with postgres database migration safety, AI support, cost showback, PCI DSS, and 24x7 operations',
        appCount: 45,
        users: 18000,
        cloudProviders: ['AWS', 'Azure'],
        compliance: ['PCI DSS', 'SOC 2'],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.coverage).toBe('24x7');
    expect(body.serviceTowers.map((tower: { category: string }) => tower.category)).toEqual(expect.arrayContaining([
      'cloud-ops',
      'security-ops',
      'database-ops',
      'data-ai',
      'finops',
      'service-integration',
    ]));
    expect(body.cmdbSeed.map((asset: { type: string }) => asset.type)).toEqual(expect.arrayContaining(['cloud-account', 'database', 'model-endpoint']));
    expect(body.financials.monthlyRunCostUsd).toBeGreaterThan(0);

    await app.close();
  });

  it('benchmarks against IT giants and creates transformation runs with proof', async () => {
    const app = Fastify();
    await app.register(registerManagedServicesRoutes);

    const accountResponse = await app.inject({
      method: 'POST',
      url: '/managed-services/accounts',
      payload: {
        customerName: 'EuroGov Cloud',
        industry: 'Public sector',
        objective: 'Run sovereign EU cloud, DORA and NIS2 evidence, MDR, SIAM vendor governance, workplace, network, SAP, OT IoT edge operations, and business process operations',
        appCount: 80,
        users: 50000,
        cloudProviders: ['Azure', 'GCP'],
        compliance: ['GDPR', 'DORA', 'NIS2', 'ISO 27001'],
        coverage: '24x7',
      },
    });
    const account = accountResponse.json();
    expect(account.serviceTowers.map((tower: { category: string }) => tower.category)).toEqual(expect.arrayContaining([
      'sovereign-cloud',
      'service-integration',
      'network-ops',
      'workplace-ops',
      'enterprise-apps',
      'ot-iot-ops',
      'business-process-ops',
    ]));

    const readinessResponse = await app.inject({
      method: 'GET',
      url: `/managed-services/it-giant-readiness?accountId=${account.id}`,
    });
    expect(readinessResponse.statusCode).toBe(200);
    const readiness = readinessResponse.json();
    expect(readiness.competitors.map((item: { id: string }) => item.id)).toEqual(expect.arrayContaining(['tcs', 'accenture', 'infosys', 'wipro']));
    expect(readiness.capabilities.length).toBeGreaterThan(6);
    expect(readiness.offerLanes.length).toBeGreaterThan(1);

    const runResponse = await app.inject({
      method: 'POST',
      url: '/managed-services/transformation-runs',
      payload: { accountId: account.id, maxMissions: 2 },
    });
    expect(runResponse.statusCode).toBe(201);
    const run = runResponse.json();
    expect(run.missionControlRuns).toHaveLength(2);
    expect(run.stageGates.length).toBeGreaterThanOrEqual(6);
    expect(run.proofArtifacts.map((artifact: { kind: string }) => artifact.kind)).toEqual(expect.arrayContaining(['release-pack', 'customer-handoff']));
    expect(run.commercialPack.boardMetrics).toContain('SLA attainment');

    await app.close();
  });

  it('lists created managed service accounts', async () => {
    const app = Fastify();
    await app.register(registerManagedServicesRoutes);

    await app.inject({
      method: 'POST',
      url: '/managed-services/accounts',
      payload: {
        customerName: 'Retail Co',
        objective: 'Stabilize ecommerce application support, release engineering, security evidence, and service desk operations',
      },
    });

    const response = await app.inject({ method: 'GET', url: '/managed-services/accounts' });

    expect(response.statusCode).toBe(200);
    expect(response.json().accounts.length).toBeGreaterThan(0);

    await app.close();
  });
});
