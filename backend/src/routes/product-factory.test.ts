import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { scheduler } from '../orchestrator/scheduler.js';
import { registerProductFactoryRoutes } from './product-factory.js';

describe('product factory routes', () => {
  afterEach(() => {
    scheduler.stop();
  });

  it('returns the productized service catalog', async () => {
    const app = Fastify();
    await app.register(registerProductFactoryRoutes);

    const response = await app.inject({
      method: 'GET',
      url: '/product-factory/catalog',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'saas-mvp', category: 'application-build' }),
        expect.objectContaining({ id: 'repo-modernization', category: 'repo-modernization' }),
      ])
    );

    await app.close();
  });

  it('creates a traceable blueprint from a natural-language request', async () => {
    const app = Fastify();
    await app.register(registerProductFactoryRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/product-factory/blueprints',
      payload: {
        goal: 'Build a SaaS MVP for support ticket triage with Slack and GitHub integrations',
        customerName: 'Acme IT',
        integrations: ['Slack', 'GitHub'],
        compliance: ['SOC 2'],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toMatchObject({
      category: 'application-build',
      templateId: 'saas-mvp',
      customerName: 'Acme IT',
      approvalRequired: true,
      status: 'draft',
    });
    expect(body.acceptanceCriteria.length).toBeGreaterThan(3);
    expect(body.backlog).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'BL-001' })]));
    expect(body.traceability[0]).toEqual(
      expect.objectContaining({
        requirementId: 'REQ-001',
        evidenceRequired: expect.arrayContaining(['test-result']),
      })
    );
    expect(new Set(body.traceability[0].backlogItemIds).size).toBe(
      body.traceability[0].backlogItemIds.length
    );

    await app.close();
  });

  it('approves an existing blueprint', async () => {
    const app = Fastify();
    await app.register(registerProductFactoryRoutes);

    const created = await app.inject({
      method: 'POST',
      url: '/product-factory/blueprints',
      payload: {
        goal: 'Automate employee onboarding workflow approvals for IT service desk',
      },
    });
    const id = created.json().id;

    const approved = await app.inject({
      method: 'POST',
      url: `/product-factory/blueprints/${id}/approve`,
    });

    expect(approved.statusCode).toBe(200);
    expect(approved.json().status).toMatch(/approved|ready-for-execution/);

    await app.close();
  });

  it('starts orchestrator execution for an approved blueprint', async () => {
    const app = Fastify();
    await app.register(registerProductFactoryRoutes);

    const created = await app.inject({
      method: 'POST',
      url: '/product-factory/blueprints',
      payload: {
        goal: 'Build a SaaS MVP for IT change approvals with GitHub integration',
      },
    });
    const id = created.json().id;

    await app.inject({
      method: 'POST',
      url: `/product-factory/blueprints/${id}/approve`,
    });

    const executed = await app.inject({
      method: 'POST',
      url: `/product-factory/blueprints/${id}/execute`,
      payload: { workflowId: 'wf_product_factory_test', budget: 25 },
    });

    expect(executed.statusCode).toBe(202);
    expect(executed.json()).toMatchObject({
      workflowId: 'wf_product_factory_test',
      message: 'Blueprint execution started',
      blueprint: {
        id,
        status: 'executing',
        execution: { workflowId: 'wf_product_factory_test' },
      },
    });
    expect(executed.json().tasks).toBeGreaterThan(0);
    expect(scheduler.getDAG('wf_product_factory_test')).toBeDefined();

    await app.close();
  });
});
