import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { browserQa } from '../browser-qa/index.js';

const deviceSchema = z.enum(['desktop', 'tablet', 'mobile']);
const validationKindSchema = z.enum(['typecheck', 'unit', 'integration', 'build', 'e2e', 'security', 'accessibility']);
const validationStatusSchema = z.enum(['pass', 'warn', 'fail', 'planned']);

const reportSchema = z.object({
  tenantId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  releaseGoal: z.string().min(8).optional(),
  targetUrl: z.string().url().optional(),
  htmlSnapshot: z.string().min(1).optional(),
  journeys: z.array(z.object({
    name: z.string().min(1),
    path: z.string().min(1).optional(),
    intent: z.string().min(1).optional(),
    assertions: z.array(z.string().min(1)).optional(),
    critical: z.boolean().optional(),
  })).max(20).optional(),
  deviceProfiles: z.array(deviceSchema).max(3).optional(),
  validationEvidence: z.array(z.object({
    kind: validationKindSchema,
    status: validationStatusSchema,
    command: z.string().min(1).optional(),
    summary: z.string().min(1).optional(),
  })).max(20).optional(),
}).superRefine((value, ctx) => {
  if (!value.targetUrl?.trim() && !value.htmlSnapshot?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['targetUrl'],
      message: 'Provide a preview URL or HTML snapshot so QA evidence is based on a real product surface.',
    });
  }
});

const idParamsSchema = z.object({ id: z.string().min(1) });

export async function registerBrowserQaRoutes(app: FastifyInstance) {
  app.get('/browser-qa/reports', async () => ({
    reports: browserQa.listReports(),
  }));

  app.post('/browser-qa/reports', async (request, reply) => {
    const parsed = reportSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(await browserQa.createReport(parsed.data));
  });

  app.get('/browser-qa/reports/:id', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const report = browserQa.getReport(parsed.data.id);
    if (!report) return reply.status(404).send({ message: 'Browser QA report not found' });
    return report;
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid Browser QA request',
    issues,
  });
}
