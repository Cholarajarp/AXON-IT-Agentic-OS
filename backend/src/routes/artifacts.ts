import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { artifactService } from '../artifacts/index.js';

const artifactSchema = z.object({
  tenantId: z.string().min(1).optional(),
  kind: z.enum(['release-pack', 'browser-trace', 'screenshot', 'security-report', 'database-report', 'customer-report', 'api-package', 'deployment-manifest', 'generic']),
  name: z.string().min(1),
  content: z.union([z.string(), z.record(z.unknown())]),
  contentType: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

export async function registerArtifactRoutes(app: FastifyInstance) {
  app.get('/artifacts', async (request) => {
    const query = request.query as { tenantId?: string; kind?: string; limit?: string };
    return {
      artifacts: artifactService.list({
        tenantId: query.tenantId,
        kind: query.kind,
        limit: query.limit ? Number(query.limit) : undefined,
      }),
    };
  });

  app.get('/artifacts/health', async () => artifactService.health());

  app.post('/artifacts', async (request, reply) => {
    const parsed = artifactSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(artifactService.put(parsed.data));
  });

  app.get('/artifacts/:id', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const artifact = artifactService.get(parsed.data.id);
    if (!artifact) return reply.status(404).send({ message: 'Artifact not found' });
    return artifact;
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid artifact request',
    issues,
  });
}
