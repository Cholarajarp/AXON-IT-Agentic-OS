import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { marketRadar } from '../market-radar/index.js';

const reportSchema = z.object({
  focus: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional(),
  targetUser: z.string().min(1).optional(),
  includeMoonshots: z.boolean().optional(),
  observedSignals: z.array(z.object({
    source: z.string().min(1),
    capability: z.string().min(1),
    sourceUrl: z.string().url().optional(),
  })).max(20).optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });
const launchSchema = z.object({ buildPackId: z.string().min(1) });
const moatActivationSchema = z.object({
  tactic: z.string().min(1).optional(),
  maxMissions: z.number().int().min(1).max(5).optional(),
  tenantId: z.string().min(1).optional(),
});

export async function registerMarketRadarRoutes(app: FastifyInstance) {
  app.get('/market-radar/competitive-benchmark', async () => marketRadar.getCompetitiveBenchmark());

  app.get('/market-radar/moat-activation-runs', async () => ({
    runs: marketRadar.listMoatActivationRuns(),
  }));

  app.post('/market-radar/moat-activation-runs', async (request, reply) => {
    const parsed = moatActivationSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(await marketRadar.createMoatActivationRun(parsed.data));
  });

  app.get('/market-radar/reports', async () => ({
    reports: marketRadar.listReports(),
  }));

  app.post('/market-radar/reports', async (request, reply) => {
    const parsed = reportSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(marketRadar.createReport(parsed.data));
  });

  app.get('/market-radar/reports/:id', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const report = marketRadar.getReport(parsed.data.id);
    if (!report) return reply.status(404).send({ message: 'Market Radar report not found' });
    return report;
  });

  app.post('/market-radar/reports/:id/launch', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);
    const body = launchSchema.safeParse(request.body ?? {});
    if (!body.success) return validationError(reply, body.error.issues);
    const launch = await marketRadar.launchBuildPack(params.data.id, body.data.buildPackId);
    if (!launch) return reply.status(404).send({ message: 'Market Radar report or build pack not found' });
    return reply.status(201).send(launch);
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid Market Radar request',
    issues,
  });
}
