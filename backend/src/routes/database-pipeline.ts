import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { databasePipeline } from '../database-pipeline/index.js';

const reviewSchema = z.object({
  name: z.string().min(1).optional(),
  sql: z.string().min(1),
  engine: z.enum(['postgresql', 'mysql', 'sqlite', 'sqlserver']).optional(),
  environment: z.enum(['dev', 'staging', 'production']).optional(),
  migrationType: z.enum(['schema', 'data', 'seed', 'rollback']).optional(),
  estimatedRows: z.number().int().nonnegative().optional(),
  tableSizeGb: z.number().nonnegative().optional(),
  hasRollbackPlan: z.boolean().optional(),
  hasBackupCheckpoint: z.boolean().optional(),
});

export async function registerDatabasePipelineRoutes(app: FastifyInstance) {
  app.get('/database-pipeline/policies', async () => ({
    policies: databasePipeline.listPolicies(),
  }));

  app.post('/database-pipeline/review', async (request, reply) => {
    const parsed = reviewSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);

    const review = databasePipeline.review(parsed.data);
    return reply.status(201).send(review);
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid database pipeline request',
    issues,
  });
}
