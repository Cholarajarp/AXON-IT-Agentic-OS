import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerCompanyOsRoutes } from './company-os.js';

describe('company os routes', () => {
  it('builds an integrated IT service software operating mission', async () => {
    const app = Fastify();
    await app.register(registerCompanyOsRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/company-os/missions',
      payload: {
        companyName: 'AXON Global IT',
        mission: 'Build and operate enterprise-grade IT service software with coding agents, cloud operations, database reliability, managed services, continuous learning, and customer trust',
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
    expect(body.axonIntegration).toMatchObject({
      status: 'planned',
      productBlueprintId: body.productBlueprint.id,
      workforceControlPlaneId: body.controlPlane.id,
      managedServiceAccountId: body.managedService.id,
    });
    expect(body.enterpriseScore.overall).toBeGreaterThanOrEqual(85);
    expect(body.knowledgeFabric.sources.length).toBeGreaterThan(4);
    expect(body.integrationFabric.map((item: { system: string }) => item.system)).toEqual(expect.arrayContaining(['Okta / Entra ID']));
    expect(body.valueStreams.map((stream: { name: string }) => stream.name)).toEqual(expect.arrayContaining(['Idea to production software']));
    expect(body.governanceControls).toEqual(expect.arrayContaining([expect.objectContaining({ framework: 'NIST AI RMF' })]));
    expect(body.decisionRights).toEqual(expect.arrayContaining([expect.objectContaining({ autonomy: 'human-approval' })]));
    expect(body.operatingCadence.length).toBeGreaterThan(3);
    expect(body.serviceLines.map((line: { name: string }) => line.name)).toEqual(expect.arrayContaining(['AI Product Factory', 'Managed Cloud and SRE']));
    expect(body.commandSystem.length).toBeGreaterThan(3);
    expect(body.economics.grossMarginPercent).toBeGreaterThan(0);
    expect(body.customerTrustSystem.length).toBeGreaterThan(3);

    await app.close();
  });

  it('activates Company OS through AXON Mission Control', async () => {
    const app = Fastify();
    await app.register(registerCompanyOsRoutes);

    const created = await app.inject({
      method: 'POST',
      url: '/company-os/missions',
      payload: {
        companyName: 'AXON Enterprise OS',
        mission: 'Run an enterprise Company OS that connects Build Studio, identity, service management, knowledge, engineering delivery, governance, and customer operations',
        mode: 'build-and-run',
        targetAgentCount: 50000,
        monthlyBudgetUsd: 1500000,
        regulated: true,
        cloudProviders: ['AWS', 'Azure'],
        compliance: ['SOC 2'],
      },
    });

    const activated = await app.inject({
      method: 'POST',
      url: `/company-os/missions/${created.json().id}/activate-axon`,
    });

    expect(activated.statusCode).toBe(202);
    const body = activated.json();
    expect(body.message).toContain('Mission Control');
    expect(body.mission.axonIntegration).toMatchObject({
      status: 'activated',
      missionControlRunId: expect.stringMatching(/^mctl_/),
      agenticMeshBlueprintId: expect.stringMatching(/^mesh_/),
      releaseMissionId: expect.stringMatching(/^rel_/),
      browserQaReportId: expect.stringMatching(/^qa_/),
      blackboardId: expect.stringMatching(/^bb_/),
    });
    expect(body.mission.axonIntegration.trustRecordIds.length).toBeGreaterThan(5);
    expect(body.mission.enterpriseScore.gaps).not.toContain('Mission Control activation pending');

    await app.close();
  });
});
