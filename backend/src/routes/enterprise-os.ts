import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { enterpriseOs } from '../enterprise-os/index.js';

const readinessSchema = z.object({
  hasBlueprint: z.boolean().optional(),
  hasPreview: z.boolean().optional(),
  hasProvider: z.boolean().optional(),
  hasDatabaseReview: z.boolean().optional(),
  hasSecurityReview: z.boolean().optional(),
  hasDeploymentPlan: z.boolean().optional(),
  hasEvidence: z.boolean().optional(),
});

export async function registerEnterpriseOsRoutes(app: FastifyInstance) {
  app.get('/enterprise-os/capabilities', async () => enterpriseOs.listCapabilities());

  app.post('/enterprise-os/readiness', async (request, reply) => {
    const parsed = readinessSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid enterprise readiness request',
        issues: parsed.error.issues,
      });
    }
    return enterpriseOs.readiness(parsed.data);
  });
}
