import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { serviceDesk } from '../service-desk/index.js';

const requestSchema = z.object({
  requester: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  request: z.string().min(8),
  affectedUsers: z.number().int().nonnegative().optional(),
  system: z.string().min(1).optional(),
  urgency: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  compliance: z.array(z.string().min(1)).optional(),
});

const statusSchema = z.object({
  status: z.enum(['intake', 'triaged', 'approved', 'executing', 'monitoring', 'resolved', 'closed']),
});

const idParamsSchema = z.object({ id: z.string().min(1) });
const activationSchema = z.object({
  operator: z.string().min(1).optional(),
  mode: z.enum(['dry-run', 'supervised', 'execute']).optional(),
});
const evidenceSchema = z.object({
  stageId: z.string().min(1).optional(),
  evidence: z.string().min(3),
  artifactId: z.string().min(1).optional(),
  verifiedBy: z.string().min(1).optional(),
  status: z.enum(['satisfied', 'partial', 'blocked']).optional(),
});

export async function registerServiceDeskRoutes(app: FastifyInstance) {
  app.get('/service-desk/tickets', async () => ({
    tickets: serviceDesk.listTickets(),
  }));

  app.get('/service-desk/operations-dashboard', async () => serviceDesk.dashboard());

  app.post('/service-desk/tickets', async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const ticket = serviceDesk.createTicket(parsed.data);
    return reply.status(201).send(ticket);
  });

  app.get('/service-desk/tickets/:id', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const ticket = serviceDesk.getTicket(parsed.data.id);
    if (!ticket) return reply.status(404).send({ message: 'Ticket not found' });
    return ticket;
  });

  app.post('/service-desk/tickets/:id/activate-kernel', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);
    const body = activationSchema.safeParse(request.body ?? {});
    if (!body.success) return validationError(reply, body.error.issues);
    const result = serviceDesk.activateKernel(params.data.id, body.data);
    if (!result) return reply.status(404).send({ message: 'Ticket not found' });
    return result;
  });

  app.post('/service-desk/tickets/:id/evidence', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);
    const body = evidenceSchema.safeParse(request.body ?? {});
    if (!body.success) return validationError(reply, body.error.issues);
    const ticket = serviceDesk.attachEvidence(params.data.id, body.data);
    if (!ticket) return reply.status(404).send({ message: 'Ticket not found' });
    return ticket;
  });

  app.post('/service-desk/tickets/:id/status', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);
    const body = statusSchema.safeParse(request.body);
    if (!body.success) return validationError(reply, body.error.issues);
    const ticket = serviceDesk.updateStatus(params.data.id, body.data.status);
    if (!ticket) return reply.status(404).send({ message: 'Ticket not found' });
    return ticket;
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid service desk request',
    issues,
  });
}
