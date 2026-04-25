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
    ]));
    expect(body.cmdbSeed.map((asset: { type: string }) => asset.type)).toEqual(expect.arrayContaining(['cloud-account', 'database', 'model-endpoint']));
    expect(body.financials.monthlyRunCostUsd).toBeGreaterThan(0);

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
