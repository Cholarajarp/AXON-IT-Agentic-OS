import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { checkpointService } from '../checkpoints/index.js';

const checkpointSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  scope: z.enum(['workspace', 'product', 'database', 'security', 'deployment']).optional(),
  workflowId: z.string().min(1).optional(),
  blueprintId: z.string().min(1).optional(),
  includePaths: z.array(z.string().min(1)).max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

export async function registerCheckpointRoutes(app: FastifyInstance) {
  checkpointService.seedIfEmpty();

  app.get('/checkpoints', async () => ({
    checkpoints: checkpointService.list(),
  }));

  app.post('/checkpoints', async (request, reply) => {
    const parsed = checkpointSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const checkpoint = await checkpointService.create(parsed.data);
    return reply.status(201).send(checkpoint);
  });

  app.get('/checkpoints/:id', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const checkpoint = checkpointService.get(parsed.data.id);
    if (!checkpoint) return reply.status(404).send({ message: 'Checkpoint not found' });
    return checkpoint;
  });

  app.post('/checkpoints/:id/preview-rollback', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const preview = await checkpointService.previewRollback(parsed.data.id);
    if (!preview) return reply.status(404).send({ message: 'Checkpoint not found' });
    return preview;
  });

  app.post('/checkpoints/:id/mark-restored', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const checkpoint = checkpointService.markRestored(parsed.data.id);
    if (!checkpoint) return reply.status(404).send({ message: 'Checkpoint not found' });
    return checkpoint;
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid checkpoint request',
    issues,
  });
}
