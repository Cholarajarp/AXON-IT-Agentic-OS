import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { deliveryBrain } from '../delivery-brain/index.js';

const requestSchema = z.object({
  tenantId: z.string().min(1).optional(),
  mission: z.string().min(12),
  customerType: z.string().min(1).optional(),
  regulated: z.boolean().optional(),
  budgetUsd: z.number().positive().optional(),
  deadlineDays: z.number().int().positive().optional(),
  existingAnswers: z.record(z.string(), z.string()).optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

export async function registerDeliveryBrainRoutes(app: FastifyInstance) {
  app.get('/delivery-brain/dossiers', async () => ({
    dossiers: deliveryBrain.listDossiers(),
  }));

  app.post('/delivery-brain/dossiers', async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(deliveryBrain.createDossier(parsed.data));
  });

  app.get('/delivery-brain/dossiers/:id', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const dossier = deliveryBrain.getDossier(parsed.data.id);
    if (!dossier) return reply.status(404).send({ message: 'Delivery Brain dossier not found' });
    return dossier;
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid Delivery Brain request',
    issues,
  });
}
