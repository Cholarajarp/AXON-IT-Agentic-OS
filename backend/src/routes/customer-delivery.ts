import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { customerDelivery } from '../customer-delivery/index.js';

const accountSchema = z.object({
  tenantId: z.string().min(1).optional(),
  customerName: z.string().min(1).optional(),
  industry: z.string().min(1).optional(),
  projectName: z.string().min(1).optional(),
  request: z.string().min(12),
  pricingModel: z.enum(['fixed-scope', 'subscription', 'usage-based', 'enterprise-managed-service']).optional(),
  budgetUsd: z.number().positive().optional(),
  timelineDays: z.number().int().positive().optional(),
  supportPlan: z.enum(['starter', 'business', 'enterprise']).optional(),
  compliance: z.array(z.string().min(1)).optional(),
  targetUsers: z.array(z.string().min(1)).optional(),
  integrations: z.array(z.string().min(1)).optional(),
});

const accountParamsSchema = z.object({ accountId: z.string().min(1) });
const reportParamsSchema = z.object({ accountId: z.string().min(1), projectId: z.string().min(1) });

export async function registerCustomerDeliveryRoutes(app: FastifyInstance) {
  app.get('/customer-delivery/accounts', async () => ({
    accounts: customerDelivery.listAccounts(),
  }));

  app.post('/customer-delivery/accounts', async (request, reply) => {
    const parsed = accountSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(customerDelivery.createAccount(parsed.data));
  });

  app.get('/customer-delivery/accounts/:accountId', async (request, reply) => {
    const parsed = accountParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const account = customerDelivery.getAccount(parsed.data.accountId);
    if (!account) return reply.status(404).send({ message: 'Customer account not found' });
    return account;
  });

  app.post('/customer-delivery/accounts/:accountId/projects/:projectId/report', async (request, reply) => {
    const parsed = reportParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const report = customerDelivery.generateReport(parsed.data.accountId, parsed.data.projectId);
    if (!report) return reply.status(404).send({ message: 'Customer project not found' });
    return reply.status(201).send(report);
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid Customer Delivery request',
    issues,
  });
}
