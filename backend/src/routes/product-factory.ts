import type { FastifyInstance, FastifyReply } from 'fastify';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { productFactory } from '../product-factory/index.js';
import { scheduler } from '../orchestrator/scheduler.js';
import { missionControl } from '../mission-control/index.js';
import type { ServiceBlueprint } from '../product-factory/types.js';

const requestSchema = z.object({
  goal: z.string().min(8),
  tenantId: z.string().min(1).optional(),
  customerName: z.string().min(1).optional(),
  builderMode: z.enum(['saas-app', 'internal-tool', 'ai-agent', 'workflow-automation', 'api-service', 'landing-to-app']).optional(),
  featureChips: z.array(z.enum([
    'auth',
    'database',
    'storage',
    'realtime',
    'payments',
    'maps',
    'email',
    'ai-chat',
    'vision',
    'voice',
    'admin',
    'analytics',
    'search',
    'workflow',
    'mobile',
    'browser-qa',
    'deploy',
  ])).optional(),
  designStyle: z.enum(['enterprise', 'consumer', 'developer-tool', 'marketplace', 'ops-console']).optional(),
  dataSensitivity: z.enum(['public', 'internal', 'confidential', 'restricted']).optional(),
  deployTarget: z.enum(['vercel', 'replit', 'cloud-run', 'kubernetes', 'docker-compose', 'static']).optional(),
  attachments: z.array(z.object({
    name: z.string().min(1),
    kind: z.enum(['screenshot', 'doc', 'url', 'schema', 'api-spec']),
    summary: z.string().min(1),
  })).optional(),
  constraints: z.array(z.string().min(1)).optional(),
  budgetUsd: z.number().positive().optional(),
  timelineDays: z.number().int().positive().optional(),
  compliance: z.array(z.string().min(1)).optional(),
  targetUsers: z.array(z.string().min(1)).optional(),
  integrations: z.array(z.string().min(1)).optional(),
});

const idParamsSchema = z.object({
  id: z.string().min(1),
});

const executeSchema = z.object({
  workflowId: z.string().min(1).optional(),
  budget: z.number().positive().optional(),
});

const agenticLaunchSchema = z.object({
  environment: z.enum(['preview', 'staging', 'production']).optional(),
  previewUrl: z.string().url().optional(),
  htmlSnapshot: z.string().min(1).optional(),
  budgetUsd: z.number().positive().optional(),
  timelineDays: z.number().int().positive().optional(),
  autoApprove: z.boolean().optional(),
});

export async function registerProductFactoryRoutes(app: FastifyInstance) {
  app.get('/product-factory/catalog', async () => ({
    services: productFactory.listCatalog(),
  }));

  app.get('/product-factory/blueprints', async () => ({
    blueprints: productFactory.listBlueprints(),
  }));

  app.post('/product-factory/blueprints', async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);

    const blueprint = productFactory.createBlueprint(parsed.data);
    return reply.status(201).send(blueprint);
  });

  app.get('/product-factory/blueprints/:id', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);

    const blueprint = productFactory.getBlueprint(parsed.data.id);
    if (!blueprint) return reply.status(404).send({ message: 'Blueprint not found' });
    return blueprint;
  });

  app.post('/product-factory/blueprints/:id/approve', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);

    const blueprint = productFactory.approveBlueprint(parsed.data.id);
    if (!blueprint) return reply.status(404).send({ message: 'Blueprint not found' });
    return blueprint;
  });

  app.post('/product-factory/blueprints/:id/execute', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);

    const body = executeSchema.safeParse(request.body ?? {});
    if (!body.success) return validationError(reply, body.error.issues);

    const blueprint = productFactory.getBlueprint(params.data.id);
    if (!blueprint) return reply.status(404).send({ message: 'Blueprint not found' });
    if (blueprint.status === 'draft') {
      return reply.status(409).send({
        message: 'Blueprint must be approved before execution',
        blueprintId: blueprint.id,
      });
    }

    const workflowId = body.data.workflowId ?? `wf_${blueprint.id}_${nanoid(6)}`;
    const budget = body.data.budget ?? Math.max(10, Math.ceil(blueprint.estimates.cost.modelUsd / 10));
    const dag = await scheduler.submitWorkflow(
      workflowId,
      blueprint.goal,
      [blueprint.category, blueprint.templateId, ...blueprint.architecture.stack],
      budget
    );
    const updated = productFactory.markExecuting(blueprint.id, {
      workflowId,
      dagId: dag.id,
      tasks: dag.nodes.length,
      startedAt: new Date().toISOString(),
    });

    return reply.status(202).send({
      blueprint: updated,
      workflowId,
      dagId: dag.id,
      tasks: dag.nodes.length,
      message: 'Blueprint execution started',
    });
  });

  app.post('/product-factory/blueprints/:id/agentic-launch', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);

    const body = agenticLaunchSchema.safeParse(request.body ?? {});
    if (!body.success) return validationError(reply, body.error.issues);

    const existing = productFactory.getBlueprint(params.data.id);
    if (!existing) return reply.status(404).send({ message: 'Blueprint not found' });
    if (existing.status === 'draft' && body.data.autoApprove === false) {
      return reply.status(409).send({
        message: 'Blueprint must be approved or autoApprove must be enabled before agentic launch',
        blueprintId: existing.id,
      });
    }

    const approved = existing.status === 'draft'
      ? productFactory.approveBlueprint(existing.id) ?? existing
      : existing;
    const missionControlRun = await missionControl.createRun({
      blueprintId: approved.id,
      tenantId: approved.tenantId,
      customerName: approved.customerName,
      mission: buildAgenticMission(approved),
      environment: body.data.environment ?? inferLaunchEnvironment(approved),
      regulated: approved.approvalRequired || approved.builder.dataSensitivity === 'restricted' || approved.builder.dataSensitivity === 'confidential',
      budgetUsd: body.data.budgetUsd ?? Math.max(1000, approved.estimates.cost.modelUsd * 10),
      timelineDays: body.data.timelineDays ?? approved.estimates.timelineDays,
      compliance: extractCompliance(approved),
      integrations: extractIntegrations(approved),
      previewUrl: body.data.previewUrl,
      htmlSnapshot: body.data.htmlSnapshot ?? buildBlueprintHtmlSnapshot(approved),
    });

    const updated = productFactory.markAgenticActivation(approved.id, {
      missionControlRunId: missionControlRun.id,
      agenticMeshBlueprintId: missionControlRun.agenticMeshBlueprintId,
      releaseMissionId: missionControlRun.releaseMissionId,
      browserQaReportId: missionControlRun.browserQaReportId,
      blackboardId: missionControlRun.blackboardId,
      trustRecordIds: missionControlRun.trustRecordIds,
      status: missionControlRun.status,
      score: missionControlRun.score,
      activatedAt: new Date().toISOString(),
    });

    return reply.status(202).send({
      blueprint: updated ?? approved,
      missionControlRun,
      message: 'Build Studio agentic launch activated through Mission Control',
    });
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid product factory request',
    issues,
  });
}

function buildAgenticMission(blueprint: ServiceBlueprint) {
  return [
    `Build Studio activation for ${blueprint.templateName}.`,
    `Goal: ${blueprint.goal}`,
    `UI/UX: ${blueprint.uiUxBlueprint.designBar}`,
    `AI/ML: ${blueprint.mlPlan.enabled ? 'model routing, evals, guardrails, and feedback loops required' : 'helper intelligence only'}.`,
    `RAG: ${blueprint.ragPlan.enabled ? `${blueprint.ragPlan.vectorStore}; ${blueprint.ragPlan.citationPolicy}` : 'not enabled'}.`,
    `Agentic workflow: ${blueprint.agenticBuildPlan.operatingModel} with ${blueprint.agenticBuildPlan.team.map((member) => member.role).join(', ')}.`,
    `Quality gates: ${blueprint.qualityGates.map((gate) => `${gate.id}=${gate.status}`).join(', ')}.`,
    `Generated artifacts: ${blueprint.generatedFiles.map((file) => file.path).join(', ')}.`,
  ].join(' ');
}

function inferLaunchEnvironment(blueprint: ServiceBlueprint): 'preview' | 'staging' | 'production' {
  if (blueprint.builder.deployTarget === 'kubernetes' || blueprint.approvalRequired) return 'staging';
  return 'preview';
}

function extractCompliance(blueprint: ServiceBlueprint) {
  return blueprint.scope
    .filter((item) => item.startsWith('Compliance profile:'))
    .flatMap((item) => item.replace('Compliance profile:', '').split(',').map((value) => value.trim()).filter(Boolean));
}

function extractIntegrations(blueprint: ServiceBlueprint) {
  return blueprint.scope
    .filter((item) => item.startsWith('Connector setup:'))
    .map((item) => item.replace('Connector setup:', '').trim())
    .filter(Boolean);
}

function buildBlueprintHtmlSnapshot(blueprint: ServiceBlueprint) {
  const title = escapeHtml(blueprint.templateName);
  const routes = blueprint.appMap.map((route) => `<li>${escapeHtml(route.route)} ${escapeHtml(route.name)}</li>`).join('');
  const gates = blueprint.qualityGates.map((gate) => `<li>${escapeHtml(gate.title)} ${escapeHtml(gate.status)} ${gate.score}</li>`).join('');
  return `<!doctype html>
<html lang="en">
<head><title>AXON Mission Preview - ${title}</title></head>
<body>
  <main>
    <p>AXON Mission Preview</p>
    <h1>${title}</h1>
    <button type="button">Start delivery</button>
    <section>
      <h2>Dashboard</h2>
      <p>${escapeHtml(blueprint.builder.enhancedPrompt)}</p>
    </section>
    <section><h2>Application map</h2><ul>${routes}</ul></section>
    <section><h2>Quality gates</h2><ul>${gates}</ul></section>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
