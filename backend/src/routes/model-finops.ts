import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { modelFinOps } from '../model-finops/index.js';

const taskTypeSchema = z.enum([
  'triage',
  'planning',
  'coding',
  'review',
  'security',
  'database',
  'browser-qa',
  'release',
  'customer-report',
]);

const reportSchema = z.object({
  tenantId: z.string().min(1).optional(),
  mission: z.string().min(8),
  taskTypes: z.array(taskTypeSchema).max(12).optional(),
  monthlyBudgetUsd: z.number().positive().max(10_000_000).optional(),
  taskBudgetUsd: z.number().positive().max(250_000).optional(),
  expectedRunsPerMonth: z.number().int().positive().max(100_000).optional(),
  contextTokens: z.number().int().positive().max(1_000_000).optional(),
  outputTokens: z.number().int().positive().max(128_000).optional(),
  qualityTarget: z.number().min(50).max(99).optional(),
  sensitivityLevel: z.enum(['public', 'internal', 'confidential', 'restricted']).optional(),
  risk: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  requiresSovereign: z.boolean().optional(),
  repeatedContext: z.boolean().optional(),
  providerPreference: z.array(z.enum(['anthropic', 'openai', 'google', 'vertexai', 'bedrock', 'ollama', 'vllm', 'localMock'])).max(8).optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

export async function registerModelFinOpsRoutes(app: FastifyInstance) {
  app.get('/model-finops/reports', async () => ({
    reports: modelFinOps.listReports(),
  }));

  app.post('/model-finops/reports', async (request, reply) => {
    const parsed = reportSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(modelFinOps.createReport(parsed.data));
  });

  app.get('/model-finops/reports/:id', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const report = modelFinOps.getReport(parsed.data.id);
    if (!report) return reply.status(404).send({ message: 'Model FinOps report not found' });
    return report;
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid Model FinOps request',
    issues,
  });
}
