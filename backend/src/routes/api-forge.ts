import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { apiForge } from '../api-forge/index.js';

const targetSchema = z.enum(['typescript', 'python', 'go', 'java', 'cli', 'mcp-server', 'docs-search']);

const reportSchema = z.object({
  name: z.string().min(1).optional(),
  specText: z.string().optional(),
  spec: z.unknown().optional(),
  baseUrl: z.string().url().optional(),
  targets: z.array(targetSchema).optional(),
  tenantId: z.string().min(1).optional(),
  packageName: z.string().min(1).optional(),
  authType: z.enum(['none', 'api-key', 'bearer', 'basic', 'oauth2', 'unknown']).optional(),
  agentOptimized: z.boolean().optional(),
}).superRefine((value, ctx) => {
  if (!value.spec && !value.specText?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['specText'],
      message: 'Provide specText or spec so API Forge builds from a real contract.',
    });
  }
});

const idParamsSchema = z.object({ id: z.string().min(1) });

export async function registerApiForgeRoutes(app: FastifyInstance) {
  app.get('/api-forge/reports', async () => ({
    reports: apiForge.listReports(),
  }));

  app.post('/api-forge/reports', async (request, reply) => {
    const parsed = reportSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(apiForge.createReport(parsed.data));
  });

  app.get('/api-forge/reports/:id', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const report = apiForge.getReport(parsed.data.id);
    if (!report) return reply.status(404).send({ message: 'API Forge report not found' });
    return report;
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid API Forge request',
    issues,
  });
}
