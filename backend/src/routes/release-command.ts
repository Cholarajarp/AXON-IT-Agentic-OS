import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { releaseCommand } from '../release-command/index.js';

const missionSchema = z.object({
  tenantId: z.string().min(1).optional(),
  productName: z.string().min(1).optional(),
  releaseGoal: z.string().min(12),
  environment: z.enum(['preview', 'staging', 'production']).optional(),
  regulated: z.boolean().optional(),
  hasBlueprint: z.boolean().optional(),
  hasPreview: z.boolean().optional(),
  hasTests: z.boolean().optional(),
  hasSecurityScan: z.boolean().optional(),
  hasDatabaseReview: z.boolean().optional(),
  hasCheckpoint: z.boolean().optional(),
  hasRollbackPlan: z.boolean().optional(),
  hasDeploymentPlan: z.boolean().optional(),
  hasCustomerReport: z.boolean().optional(),
  hasApiForgeConnectors: z.boolean().optional(),
  slaMinutes: z.number().int().positive().optional(),
  evidenceArtifacts: z.array(z.string().min(1)).optional(),
  openRisks: z.array(z.string().min(1)).optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

export async function registerReleaseCommandRoutes(app: FastifyInstance) {
  app.get('/release-command/missions', async () => ({
    missions: releaseCommand.listMissions(),
  }));

  app.post('/release-command/evidence-snapshot', async (request, reply) => {
    const parsed = missionSchema.pick({
      releaseGoal: true,
      environment: true,
      regulated: true,
      slaMinutes: true,
    }).safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(await releaseCommand.collectEvidence(parsed.data));
  });

  app.post('/release-command/missions', async (request, reply) => {
    const parsed = missionSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(releaseCommand.createMission(parsed.data));
  });

  app.post('/release-command/missions/auto', async (request, reply) => {
    const parsed = missionSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(await releaseCommand.createMissionFromEvidence(parsed.data));
  });

  app.get('/release-command/missions/:id', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const mission = releaseCommand.getMission(parsed.data.id);
    if (!mission) return reply.status(404).send({ message: 'Release command mission not found' });
    return mission;
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid Release Command request',
    issues,
  });
}
