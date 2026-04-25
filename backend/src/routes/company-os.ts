import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { companyOs } from '../company-os/index.js';

const requestSchema = z.object({
  tenantId: z.string().min(1).optional(),
  companyName: z.string().min(1).optional(),
  mission: z.string().min(12),
  mode: z.enum(['build-and-run', 'managed-it', 'modernize', 'autonomous-factory']).optional(),
  targetAgentCount: z.number().int().positive().max(200000).optional(),
  monthlyBudgetUsd: z.number().positive().optional(),
  regulated: z.boolean().optional(),
  customerSegments: z.array(z.string().min(1)).optional(),
  regions: z.array(z.string().min(1)).optional(),
  cloudProviders: z.array(z.string().min(1)).optional(),
  compliance: z.array(z.string().min(1)).optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

export async function registerCompanyOsRoutes(app: FastifyInstance) {
  app.get('/company-os/missions', async () => ({
    missions: companyOs.listMissions(),
  }));

  app.post('/company-os/missions', async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(companyOs.createMission(parsed.data));
  });

  app.get('/company-os/missions/:id', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const mission = companyOs.getMission(parsed.data.id);
    if (!mission) return reply.status(404).send({ message: 'Company OS mission not found' });
    return mission;
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid Company OS mission request',
    issues,
  });
}
