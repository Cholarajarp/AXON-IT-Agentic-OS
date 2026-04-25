import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { managedServices } from '../managed-services/index.js';

const requestSchema = z.object({
  customerName: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional(),
  industry: z.string().min(1).optional(),
  objective: z.string().min(12),
  appCount: z.number().int().positive().optional(),
  users: z.number().int().positive().optional(),
  cloudProviders: z.array(z.string().min(1)).optional(),
  environments: z.array(z.string().min(1)).optional(),
  compliance: z.array(z.string().min(1)).optional(),
  painPoints: z.array(z.string().min(1)).optional(),
  coverage: z.enum(['8x5', '16x5', '24x7']).optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

export async function registerManagedServicesRoutes(app: FastifyInstance) {
  app.get('/managed-services/catalog', async () => ({
    towers: managedServices.listCatalog(),
  }));

  app.get('/managed-services/accounts', async () => ({
    accounts: managedServices.listAccounts(),
  }));

  app.post('/managed-services/accounts', async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const account = managedServices.createAccount(parsed.data);
    return reply.status(201).send(account);
  });

  app.get('/managed-services/accounts/:id', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const account = managedServices.getAccount(parsed.data.id);
    if (!account) return reply.status(404).send({ message: 'Managed service account not found' });
    return account;
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid managed services request',
    issues,
  });
}
