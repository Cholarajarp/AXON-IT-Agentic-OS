import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { agenticMesh } from '../agentic-mesh/index.js';

const topologySchema = z.enum([
  'hierarchical',
  'sequential-pipeline',
  'parallel-fanout',
  'loop-critic',
  'human-gated',
]);

const blueprintSchema = z.object({
  tenantId: z.string().min(1).optional(),
  mission: z.string().min(8),
  goal: z.string().min(1).optional(),
  regulated: z.boolean().optional(),
  maxIterations: z.number().int().min(1).max(8).optional(),
  autonomyLevel: z.enum(['assistive', 'supervised', 'autonomous']).optional(),
  budgetUsd: z.number().positive().max(10_000_000).optional(),
  preferredTopologies: z.array(topologySchema).max(6).optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

export async function registerAgenticMeshRoutes(app: FastifyInstance) {
  app.get('/agentic-mesh/blueprints', async () => ({
    blueprints: agenticMesh.listBlueprints(),
  }));

  app.post('/agentic-mesh/blueprints', async (request, reply) => {
    const parsed = blueprintSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(agenticMesh.createBlueprint(parsed.data));
  });

  app.get('/agentic-mesh/blueprints/:id', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const blueprint = agenticMesh.getBlueprint(parsed.data.id);
    if (!blueprint) return reply.status(404).send({ message: 'Agentic Mesh blueprint not found' });
    return blueprint;
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid Agentic Mesh request',
    issues,
  });
}
