import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { missionControl } from '../mission-control/index.js';

const runSchema = z.object({
  tenantId: z.string().min(1).optional(),
  blueprintId: z.string().min(1).optional(),
  customerName: z.string().min(1).optional(),
  mission: z.string().min(12),
  previewUrl: z.string().url().optional(),
  htmlSnapshot: z.string().min(1).optional(),
  environment: z.enum(['preview', 'staging', 'production']).optional(),
  regulated: z.boolean().optional(),
  budgetUsd: z.number().positive().optional(),
  timelineDays: z.number().int().positive().optional(),
  compliance: z.array(z.string().min(1)).optional(),
  integrations: z.array(z.string().min(1)).optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

export async function registerMissionControlRoutes(app: FastifyInstance) {
  app.get('/mission-control/runs', async () => ({
    runs: missionControl.listRuns(),
  }));

  app.post('/mission-control/runs', async (request, reply) => {
    const parsed = runSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(await missionControl.createRun(parsed.data));
  });

  app.get('/mission-control/runs/:id', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const run = missionControl.getRun(parsed.data.id);
    if (!run) return reply.status(404).send({ message: 'Mission Control run not found' });
    return run;
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid Mission Control request',
    issues,
  });
}
