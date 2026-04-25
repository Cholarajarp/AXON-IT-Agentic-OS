import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerServiceDeskRoutes } from './service-desk.js';

describe('service desk routes', () => {
  it('triages production outage as P0 incident', async () => {
    const app = Fastify();
    await app.register(registerServiceDeskRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/service-desk/tickets',
      payload: {
        requester: 'Ops Lead',
        request: 'Production API is down for all customers and login is failing',
        affectedUsers: 2500,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      category: 'incident',
      priority: 'P0',
      approvalRequired: true,
    });
    expect(response.json().assignedAgents).toEqual(expect.arrayContaining(['SREAgent', 'ExecutiveInsightAgent']));

    await app.close();
  });

  it('routes database migrations to database agents and approval', async () => {
    const app = Fastify();
    await app.register(registerServiceDeskRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/service-desk/tickets',
      payload: {
        request: 'Need PostgreSQL schema migration for customer tickets table',
        urgency: 'high',
        compliance: ['SOC 2'],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.category).toBe('database');
    expect(body.priority).toBe('P1');
    expect(body.assignedAgents).toEqual(expect.arrayContaining(['MigrationSafetyAgent', 'DataQualityAgent']));
    expect(body.evidenceRequired).toEqual(expect.arrayContaining(['database safety report']));

    await app.close();
  });

  it('keeps rollback-heavy database work in the database pipeline', async () => {
    const app = Fastify();
    await app.register(registerServiceDeskRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/service-desk/tickets',
      payload: {
        request: 'Need postgres database schema migration with rollback, RLS checks, SQL review, and data quality gates',
        system: 'postgres database',
        affectedUsers: 150,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.category).toBe('database');
    expect(body.assignedAgents).toEqual(expect.arrayContaining(['DatabaseArchitectAgent', 'MigrationSafetyAgent', 'DataQualityAgent']));
    expect(body.evidenceRequired).toEqual(expect.arrayContaining(['backup checkpoint', 'quality gates']));

    await app.close();
  });
});
