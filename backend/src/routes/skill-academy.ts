import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { skillAcademy } from '../skill-academy/index.js';

const domainSchema = z.enum([
  'product',
  'architecture',
  'frontend',
  'backend',
  'database',
  'devops',
  'security',
  'sre',
  'qa',
  'data-ai',
  'finops',
  'customer-success',
]);

const sourceSchema = z.object({
  title: z.string().min(1).optional(),
  url: z.string().url(),
  type: z.enum(['github', 'documentation', 'standard', 'course', 'internal-runbook']).optional(),
  domains: z.array(domainSchema).optional(),
  trust: z.enum(['community', 'vendor', 'standard', 'internal']).optional(),
});

const planSchema = z.object({
  tenantId: z.string().min(1).optional(),
  objective: z.string().min(12),
  teamSize: z.number().int().positive().optional(),
  budgetUsdPerMonth: z.number().positive().optional(),
  deliveryMode: z.enum(['build', 'operate', 'modernize', 'managed-service']).optional(),
  currentMaturity: z.enum(['starter', 'growing', 'enterprise']).optional(),
  sources: z.array(sourceSchema).optional(),
});

export async function registerSkillAcademyRoutes(app: FastifyInstance) {
  app.get('/skill-academy/roles', async () => ({
    roles: skillAcademy.listRoles(),
  }));

  app.get('/skill-academy/sources', async () => ({
    sources: skillAcademy.listSources(),
  }));

  app.post('/skill-academy/sources', async (request, reply) => {
    const parsed = sourceSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(skillAcademy.addSource(parsed.data));
  });

  app.get('/skill-academy/plans', async () => ({
    plans: skillAcademy.listPlans(),
  }));

  app.post('/skill-academy/plans', async (request, reply) => {
    const parsed = planSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(skillAcademy.createPlan(parsed.data));
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid skill academy request',
    issues,
  });
}
