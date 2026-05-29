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
    expect(response.json().kernel).toMatchObject({
      service: { criticality: 'mission-critical' },
      contract: { coverage: '24x7' },
      changeControl: { cabRequired: true },
    });
    expect(response.json().kernel.cmdb.length).toBeGreaterThanOrEqual(3);

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
    expect(body.kernel.serviceGraph.length).toBeGreaterThan(0);
    expect(body.kernel.remediation.safeguards).toEqual(expect.arrayContaining(['checkpoint before stateful change']));

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

  it('activates the service operations kernel with artifact and trust evidence', async () => {
    const app = Fastify();
    await app.register(registerServiceDeskRoutes);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/service-desk/tickets',
      payload: {
        requester: 'Retail Ops',
        request: 'Production billing API is slow after deployment and customers cannot complete checkout',
        system: 'billing API',
        affectedUsers: 900,
        urgency: 'critical',
      },
    });

    const ticket = createResponse.json();
    const activation = await app.inject({
      method: 'POST',
      url: `/service-desk/tickets/${ticket.id}/activate-kernel`,
      payload: { operator: 'Ops Lead', mode: 'supervised' },
    });

    expect(activation.statusCode).toBe(200);
    const body = activation.json();
    expect(body.artifactId).toMatch(/^art_/);
    expect(body.trustRecordId).toMatch(/^tr_/);
    expect(body.ticket.linkedArtifacts).toContain(body.artifactId);
    expect(body.ticket.kernel.evidencePack.trustRecordId).toBe(body.trustRecordId);
    expect(body.ticket.kernel.qbr.valueMetrics.length).toBeGreaterThanOrEqual(3);

    await app.close();
  });

  it('attaches stage evidence and updates the operations dashboard', async () => {
    const app = Fastify();
    await app.register(registerServiceDeskRoutes);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/service-desk/tickets',
      payload: {
        request: 'Need security vulnerability remediation for SSO token exposure',
        system: 'sso',
        urgency: 'high',
        compliance: ['SOC 2', 'ISO 27001'],
      },
    });

    const ticket = createResponse.json();
    const evidenceResponse = await app.inject({
      method: 'POST',
      url: `/service-desk/tickets/${ticket.id}/evidence`,
      payload: {
        stageId: 'remediation',
        evidence: 'security scan report and remediation proof attached',
        verifiedBy: 'Security Lead',
      },
    });

    expect(evidenceResponse.statusCode).toBe(200);
    expect(evidenceResponse.json().evidenceProvided[0]).toMatchObject({
      stageId: 'remediation',
      verifiedBy: 'Security Lead',
      status: 'satisfied',
    });

    const dashboardResponse = await app.inject({ method: 'GET', url: '/service-desk/operations-dashboard' });
    expect(dashboardResponse.statusCode).toBe(200);
    expect(dashboardResponse.json()).toMatchObject({
      totalTickets: expect.any(Number),
      cmdbItems: expect.any(Number),
      revenueAtRiskUsd: expect.any(Number),
    });
    expect(dashboardResponse.json().nextActions.length).toBeGreaterThan(0);

    await app.close();
  });
});
