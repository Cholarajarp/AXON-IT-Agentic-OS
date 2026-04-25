import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerCompanyOsRoutes } from './company-os.js';

describe('company os routes', () => {
  it('builds an integrated IT-company operating mission', async () => {
    const app = Fastify();
    await app.register(registerCompanyOsRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/company-os/missions',
      payload: {
        companyName: 'AXON Global IT',
        mission: 'Beat a 200,000 employee IT company by building and operating secure AI software products with coding agents, cloud operations, database reliability, managed services, continuous learning, and customer trust',
        mode: 'autonomous-factory',
        targetAgentCount: 200000,
        monthlyBudgetUsd: 5000000,
        regulated: true,
        cloudProviders: ['AWS', 'Azure', 'GCP'],
        compliance: ['SOC 2', 'ISO 27001'],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.controlPlane.targetAgentCount).toBe(200000);
    expect(body.skillPlan.roles.length).toBeGreaterThan(5);
    expect(body.managedService.serviceTowers.length).toBeGreaterThan(4);
    expect(body.productBlueprint.backlog.length).toBeGreaterThan(0);
    expect(body.initialTickets.length).toBe(2);
    expect(body.serviceLines.map((line: { name: string }) => line.name)).toEqual(expect.arrayContaining(['AI Product Factory', 'Managed Cloud and SRE']));
    expect(body.commandSystem.length).toBeGreaterThan(3);
    expect(body.economics.grossMarginPercent).toBeGreaterThan(0);
    expect(body.customerTrustSystem.length).toBeGreaterThan(3);

    await app.close();
  });
});
