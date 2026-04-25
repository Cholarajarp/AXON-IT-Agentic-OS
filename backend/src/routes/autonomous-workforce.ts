import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { autonomousWorkforce } from '../autonomous-workforce/index.js';

const requestSchema = z.object({
  tenantId: z.string().min(1).optional(),
  mission: z.string().min(12),
  targetAgentCount: z.number().int().positive().max(200000).optional(),
  workMode: z.enum(['build', 'operate', 'transform', 'managed-service']).optional(),
  monthlyBudgetUsd: z.number().positive().optional(),
  riskTolerance: z.enum(['low', 'medium', 'high']).optional(),
  regulated: z.boolean().optional(),
  regions: z.array(z.string().min(1)).optional(),
  customerSegments: z.array(z.string().min(1)).optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

export async function registerAutonomousWorkforceRoutes(app: FastifyInstance) {
  app.get('/autonomous-workforce/control-planes', async () => ({
    controlPlanes: autonomousWorkforce.listControlPlanes(),
  }));

  app.post('/autonomous-workforce/control-planes', async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(autonomousWorkforce.createControlPlane(parsed.data));
  });

  app.get('/autonomous-workforce/control-planes/:id', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const controlPlane = autonomousWorkforce.getControlPlane(parsed.data.id);
    if (!controlPlane) return reply.status(404).send({ message: 'Autonomous workforce control plane not found' });
    return controlPlane;
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid autonomous workforce request',
    issues,
  });
}
