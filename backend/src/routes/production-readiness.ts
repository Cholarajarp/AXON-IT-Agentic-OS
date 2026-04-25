import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { productionReadiness } from '../production-readiness/index.js';

const readinessSchema = z.object({
  tenantId: z.string().min(1).optional(),
  mission: z.string().min(8).optional(),
  environment: z.enum(['preview', 'staging', 'production']).optional(),
  regulated: z.boolean().optional(),
  customerName: z.string().min(1).optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

export async function registerProductionReadinessRoutes(app: FastifyInstance) {
  app.get('/production-readiness/reports', async () => ({
    reports: productionReadiness.listReports(),
  }));

  app.post('/production-readiness/reports', async (request, reply) => {
    const parsed = readinessSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(await productionReadiness.createReport(parsed.data));
  });

  app.get('/production-readiness/reports/:id', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const report = productionReadiness.getReport(parsed.data.id);
    if (!report) return reply.status(404).send({ message: 'Production readiness report not found' });
    return report;
  });

  app.get('/production-readiness/activations', async () => ({
    activations: productionReadiness.listActivations(),
  }));

  app.post('/production-readiness/activate', async (request, reply) => {
    const parsed = readinessSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(await productionReadiness.activate(parsed.data));
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid Production Readiness request',
    issues,
  });
}
