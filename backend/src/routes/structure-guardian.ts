import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { structureGuardian } from '../structure-guardian/index.js';

const scanSchema = z.object({
  workspacePath: z.string().min(1).optional(),
  includeNested: z.boolean().optional(),
});

export async function registerStructureGuardianRoutes(app: FastifyInstance) {
  app.post('/structure-guardian/scan', async (request, reply) => {
    const parsed = scanSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);

    const result = await structureGuardian.scan(parsed.data);
    return reply.status(201).send(result);
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid Structure Guardian request',
    issues,
  });
}
