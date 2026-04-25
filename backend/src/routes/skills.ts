import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { skillRegistry } from '../services/skill-registry.js';

const skillSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(2),
  description: z.string().min(5),
  enabled: z.boolean().optional(),
  owner: z.string().min(1).optional(),
  capabilities: z.array(z.string().min(1)).optional(),
  prompts: z.array(z.string().min(1)).optional(),
  allowedTools: z.array(z.string().min(1)).optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
});

const enableSchema = z.object({
  enabled: z.boolean(),
});

const idParamsSchema = z.object({
  id: z.string().min(1),
});

export async function registerSkillRoutes(app: FastifyInstance) {
  app.get('/skills', async () => ({
    skills: await skillRegistry.list(),
  }));

  app.post('/skills', async (request, reply) => {
    const parsed = skillSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const skill = await skillRegistry.upsert(parsed.data);
    return reply.status(201).send(skill);
  });

  app.patch('/skills/:id', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);
    const body = skillSchema.partial().safeParse(request.body);
    if (!body.success) return validationError(reply, body.error.issues);

    const existing = (await skillRegistry.list()).find((skill) => skill.id === params.data.id);
    if (!existing) return reply.status(404).send({ message: 'Skill not found' });
    return skillRegistry.upsert({ ...existing, ...body.data, id: params.data.id });
  });

  app.post('/skills/:id/enabled', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);
    const body = enableSchema.safeParse(request.body);
    if (!body.success) return validationError(reply, body.error.issues);

    const skill = await skillRegistry.setEnabled(params.data.id, body.data.enabled);
    if (!skill) return reply.status(404).send({ message: 'Skill not found' });
    return skill;
  });

  app.delete('/skills/:id', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);

    const removed = await skillRegistry.remove(params.data.id);
    if (!removed) return reply.status(404).send({ message: 'Skill not found or built-in skill cannot be deleted' });
    return { removed: true, id: params.data.id };
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid skill request',
    issues,
  });
}
