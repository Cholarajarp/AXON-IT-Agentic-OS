import type { FastifyInstance, FastifyReply } from 'fastify';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { productFactory } from '../product-factory/index.js';
import { scheduler } from '../orchestrator/scheduler.js';

const requestSchema = z.object({
  goal: z.string().min(8),
  tenantId: z.string().min(1).optional(),
  customerName: z.string().min(1).optional(),
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
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid product factory request',
    issues,
  });
}
