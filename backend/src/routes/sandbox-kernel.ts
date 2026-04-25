import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { sandboxKernel } from '../sandbox-kernel/index.js';

const providerSchema = z.enum(['local-process', 'docker', 'kubernetes', 'e2b', 'daytona', 'firecracker']);
const networkPolicySchema = z.enum(['offline', 'allowlisted', 'open']);

const sessionSchema = z.object({
  tenantId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  goal: z.string().min(8),
  workspacePath: z.string().min(1).optional(),
  provider: providerSchema.optional(),
  ttlMinutes: z.number().int().positive().max(1440).optional(),
  cpuLimit: z.string().min(1).optional(),
  memoryMb: z.number().int().positive().max(32768).optional(),
  networkPolicy: networkPolicySchema.optional(),
});

const executionSchema = z.object({
  command: z.string().min(1),
  timeoutMs: z.number().int().positive().max(120000).optional(),
  workingDirectory: z.string().min(1).optional(),
  allowMutation: z.boolean().optional(),
});

const snapshotSchema = z.object({
  label: z.string().min(1).optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

export async function registerSandboxKernelRoutes(app: FastifyInstance) {
  app.get('/sandbox-kernel/sessions', async () => ({
    sessions: sandboxKernel.listSessions(),
  }));

  app.post('/sandbox-kernel/sessions', async (request, reply) => {
    const parsed = sessionSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(await sandboxKernel.createSession(parsed.data));
  });

  app.get('/sandbox-kernel/sessions/:id', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const session = sandboxKernel.getSession(parsed.data.id);
    if (!session) return reply.status(404).send({ message: 'Sandbox session not found' });
    return session;
  });

  app.post('/sandbox-kernel/sessions/:id/execute', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);
    const body = executionSchema.safeParse(request.body ?? {});
    if (!body.success) return validationError(reply, body.error.issues);
    const execution = await sandboxKernel.execute(params.data.id, body.data);
    if (!execution) return reply.status(404).send({ message: 'Sandbox session not found' });
    return reply.status(execution.status === 'blocked' ? 409 : 201).send(execution);
  });

  app.post('/sandbox-kernel/sessions/:id/snapshot', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);
    const body = snapshotSchema.safeParse(request.body ?? {});
    if (!body.success) return validationError(reply, body.error.issues);
    const snapshot = await sandboxKernel.snapshot(params.data.id, body.data.label);
    if (!snapshot) return reply.status(404).send({ message: 'Sandbox session not found' });
    return reply.status(201).send(snapshot);
  });

  app.post('/sandbox-kernel/sessions/:id/destroy', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const session = await sandboxKernel.destroy(parsed.data.id);
    if (!session) return reply.status(404).send({ message: 'Sandbox session not found' });
    return session;
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid Sandbox Kernel request',
    issues,
  });
}
