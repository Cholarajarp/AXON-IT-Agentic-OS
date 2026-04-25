import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { securityCenter } from '../security-center/index.js';

const scanSchema = z.object({
  workspacePath: z.string().min(1).optional(),
  maxFiles: z.number().int().positive().max(2000).optional(),
  files: z.array(z.object({
    path: z.string().min(1),
    content: z.string(),
  })).max(200).optional(),
});

export async function registerSecurityCenterRoutes(app: FastifyInstance) {
  app.post('/security-center/scan', async (request, reply) => {
    const parsed = scanSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);

    const result = await securityCenter.scan(parsed.data);
    return reply.status(201).send(result);
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid security scan request',
    issues,
  });
}
