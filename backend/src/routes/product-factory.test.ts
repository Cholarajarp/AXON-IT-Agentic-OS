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
        goal: 'Build a production SaaS product for support ticket triage with Slack and GitHub integrations',
        customerName: 'Acme IT',
        builderMode: 'saas-app',
        featureChips: ['auth', 'database', 'ai-chat', 'workflow', 'browser-qa', 'deploy'],
        designStyle: 'enterprise',
        deployTarget: 'docker-compose',
        integrations: ['Slack', 'GitHub'],
        compliance: ['SOC 2'],
        targetUsers: ['Support agent', 'Customer admin'],
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
    expect(body.builder).toMatchObject({
      mode: 'saas-app',
      deployTarget: 'docker-compose',
      designStyle: 'enterprise',
    });
    expect(body.builder.featureChips).toEqual(expect.arrayContaining(['auth', 'database', 'ai-chat', 'workflow']));
    expect(body.appMap.length).toBeGreaterThanOrEqual(4);
    expect(body.screens.length).toBe(body.appMap.length);
    expect(body.dataModel).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'users' })]));
    expect(body.apiPlan).toEqual(expect.arrayContaining([expect.objectContaining({ method: 'POST' })]));
    expect(body.apiPlan).toEqual(expect.arrayContaining([expect.objectContaining({ method: 'PATCH' })]));
    expect(body.generatedFiles).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'src/App.tsx' })]));
    expect(body.generatedFiles).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'src/lib/release-gates.ts' })]));
    expect(body.generatedFiles).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'src/theme/tokens.ts' })]));
    expect(body.generatedFiles.find((file: { path: string; content: string }) => file.path === 'db/schema.sql').content).toContain('ENABLE ROW LEVEL SECURITY');
    expect(body.uiUxBlueprint.designBar).toContain('FRONTEND_DESIGN.md');
    expect(body.agenticBuildPlan.team).toEqual(expect.arrayContaining([expect.objectContaining({ role: 'UX Systems Agent' })]));
    expect(body.qualityGates).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'browser-qa' })]));
    expect(body.qualityGates).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'data-safety' })]));
    expect(body.qualityGates).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'ui-ux' })]));
    expect(body.deploymentPlan.commands).toEqual(expect.arrayContaining(['npm run build']));
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

  it('creates a full UI, RAG, ML, and agentic delivery package for AI platforms', async () => {
    const app = Fastify();
    await app.register(registerProductFactoryRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/product-factory/blueprints',
      payload: {
        goal: 'Build an agentic RAG platform for legal operations with document ingestion, semantic search, cited answers, human approval gates, admin analytics, and production deployment',
        builderMode: 'ai-agent',
        featureChips: ['auth', 'database', 'ai-chat', 'search', 'storage', 'workflow', 'admin', 'analytics', 'browser-qa', 'deploy'],
        targetUsers: ['Legal operator', 'Reviewer', 'Platform admin'],
        integrations: ['SharePoint', 'Slack'],
        compliance: ['SOC 2', 'GDPR'],
        constraints: ['Production customer documents', 'citation required', 'human approval for writes'],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.uiUxBlueprint).toMatchObject({
      appType: 'agentic-platform',
      designBar: expect.stringContaining('FRONTEND_DESIGN.md'),
    });
    expect(body.uiUxBlueprint.screenRecipes.length).toBe(body.screens.length);
    expect(body.ragPlan).toMatchObject({ enabled: true });
    expect(body.ragPlan.retrievalStrategy).toEqual(expect.arrayContaining([expect.stringContaining('tenant and permission filters')]));
    expect(body.mlPlan.enabled).toBe(true);
    expect(body.agenticBuildPlan.team).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'AI/ML Engineer Agent' }),
      expect.objectContaining({ role: 'Security and Release Agent' }),
    ]));
    expect(body.apiPlan).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '/api/v1/rag/query' }),
      expect.objectContaining({ path: '/api/v1/agents/run' }),
    ]));
    expect(body.generatedFiles).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'ai/rag-pipeline.ts' }),
      expect.objectContaining({ path: 'ai/agentic-build-team.ts' }),
      expect.objectContaining({ path: 'tests/e2e/primary-flow.spec.ts' }),
    ]));
    expect(body.qualityGates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'rag-agent', status: 'pass' }),
      expect.objectContaining({ id: 'ai-ml', status: 'pass' }),
      expect.objectContaining({ id: 'agentic-delivery', status: 'pass' }),
    ]));

    await app.close();
  });

  it('activates a Build Studio blueprint through Mission Control agentic systems', async () => {
    const app = Fastify();
    await app.register(registerProductFactoryRoutes);

    const created = await app.inject({
      method: 'POST',
      url: '/product-factory/blueprints',
      payload: {
        goal: 'Build an agentic RAG platform for enterprise IT software delivery with citations, browser QA, release evidence, and human approval gates',
        builderMode: 'ai-agent',
        featureChips: ['auth', 'database', 'ai-chat', 'search', 'storage', 'workflow', 'browser-qa', 'deploy'],
        targetUsers: ['Software engineer', 'Reviewer', 'Platform admin'],
        integrations: ['GitHub', 'Slack'],
        compliance: ['SOC 2'],
        constraints: ['Production customer documents', 'human approval for writes'],
        deployTarget: 'kubernetes',
      },
    });
    const id = created.json().id;

    const activated = await app.inject({
      method: 'POST',
      url: `/product-factory/blueprints/${id}/agentic-launch`,
      payload: { environment: 'staging' },
    });

    expect(activated.statusCode).toBe(202);
    const body = activated.json();
    expect(body.blueprint).toMatchObject({
      id,
      status: 'executing',
      agenticActivation: {
        missionControlRunId: expect.stringMatching(/^mctl_/),
        agenticMeshBlueprintId: expect.stringMatching(/^mesh_/),
        releaseMissionId: expect.stringMatching(/^rel_/),
        browserQaReportId: expect.stringMatching(/^qa_/),
        blackboardId: expect.stringMatching(/^bb_/),
      },
    });
    expect(body.missionControlRun).toMatchObject({
      blueprintId: id,
      agenticMeshBlueprintId: body.blueprint.agenticActivation.agenticMeshBlueprintId,
      releaseMissionId: body.blueprint.agenticActivation.releaseMissionId,
      browserQaReportId: body.blueprint.agenticActivation.browserQaReportId,
      blackboardId: body.blueprint.agenticActivation.blackboardId,
    });
    expect(body.blueprint.agenticActivation.trustRecordIds.length).toBeGreaterThan(5);
    expect(body.missionControlRun.trustRecordIds).toEqual(body.blueprint.agenticActivation.trustRecordIds);
    expect(body.message).toContain('Mission Control');

    await app.close();
  });

  it('turns restricted source artifacts into governed blueprint scope', async () => {
    const app = Fastify();
    await app.register(registerProductFactoryRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/product-factory/blueprints',
      payload: {
        goal: 'Build an enterprise AI case management SaaS for regulated customer support',
        dataSensitivity: 'restricted',
        attachments: [
          {
            name: 'legacy-schema.sql',
            kind: 'schema',
            summary: 'Contains production customer data tables and PII fields',
          },
        ],
        targetUsers: ['Compliance owner', 'Support manager'],
        integrations: ['Zendesk'],
        compliance: ['HIPAA'],
        constraints: ['Production customer data'],
        featureChips: ['auth', 'database', 'ai-chat', 'search', 'browser-qa', 'deploy'],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.approvalRequired).toBe(true);
    expect(body.builder.dataSensitivity).toBe('restricted');
    expect(body.builder.promptQualityScore).toBeGreaterThanOrEqual(70);
    expect(body.scope).toEqual(expect.arrayContaining([expect.stringContaining('legacy-schema.sql')]));
    expect(body.dependencies).toEqual(expect.arrayContaining([expect.stringContaining('schema artifact reviewed')]));
    expect(body.risks).toEqual(expect.arrayContaining([expect.objectContaining({ level: 'critical' })]));
    expect(body.dataModel).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'source_artifacts' })]));
    expect(body.deploymentPlan.envVars).toEqual(expect.arrayContaining(['SOVEREIGN_MODEL_ENDPOINT', 'DATA_RETENTION_DAYS']));

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
        goal: 'Build a production SaaS product for IT change approvals with GitHub integration',
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
