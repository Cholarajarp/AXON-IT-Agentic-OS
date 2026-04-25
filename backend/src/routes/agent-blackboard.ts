import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { agentBlackboard } from '../agent-blackboard/index.js';

const entryKindSchema = z.enum(['finding', 'decision', 'blocker', 'artifact', 'risk', 'next-action', 'ownership']);
const severitySchema = z.enum(['low', 'medium', 'high', 'critical']);
const entryStatusSchema = z.enum(['open', 'accepted', 'resolved', 'superseded']);

const boardSchema = z.object({
  tenantId: z.string().min(1).optional(),
  missionId: z.string().min(1).optional(),
  title: z.string().min(1),
  goal: z.string().min(8),
  ownerAgent: z.string().min(1).optional(),
});

const entrySchema = z.object({
  kind: entryKindSchema,
  title: z.string().min(1),
  detail: z.string().min(1),
  agent: z.string().min(1),
  severity: severitySchema.optional(),
  status: entryStatusSchema.optional(),
  evidence: z.array(z.string().min(1)).optional(),
  relatedFiles: z.array(z.string().min(1)).optional(),
});

const ownershipSchema = z.object({
  filePath: z.string().min(1),
  agent: z.string().min(1),
  reason: z.string().min(1),
});

const statusSchema = z.object({
  status: entryStatusSchema,
});

const boardParamsSchema = z.object({ id: z.string().min(1) });
const entryParamsSchema = z.object({ id: z.string().min(1), entryId: z.string().min(1) });

export async function registerAgentBlackboardRoutes(app: FastifyInstance) {
  app.get('/agent-blackboard/boards', async () => ({
    boards: agentBlackboard.listBoards(),
  }));

  app.post('/agent-blackboard/boards', async (request, reply) => {
    const parsed = boardSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(agentBlackboard.createBoard(parsed.data));
  });

  app.get('/agent-blackboard/boards/:id', async (request, reply) => {
    const parsed = boardParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const board = agentBlackboard.getBoard(parsed.data.id);
    if (!board) return reply.status(404).send({ message: 'Blackboard not found' });
    return board;
  });

  app.post('/agent-blackboard/boards/:id/entries', async (request, reply) => {
    const params = boardParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);
    const body = entrySchema.safeParse(request.body ?? {});
    if (!body.success) return validationError(reply, body.error.issues);
    const entry = agentBlackboard.addEntry(params.data.id, body.data);
    if (!entry) return reply.status(404).send({ message: 'Blackboard not found' });
    return reply.status(201).send(entry);
  });

  app.patch('/agent-blackboard/boards/:id/entries/:entryId', async (request, reply) => {
    const params = entryParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);
    const body = statusSchema.safeParse(request.body ?? {});
    if (!body.success) return validationError(reply, body.error.issues);
    const entry = agentBlackboard.updateEntryStatus(params.data.id, params.data.entryId, body.data.status);
    if (!entry) return reply.status(404).send({ message: 'Blackboard entry not found' });
    return entry;
  });

  app.post('/agent-blackboard/boards/:id/file-claims', async (request, reply) => {
    const params = boardParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);
    const body = ownershipSchema.safeParse(request.body ?? {});
    if (!body.success) return validationError(reply, body.error.issues);
    const board = agentBlackboard.claimFile(params.data.id, body.data);
    if (!board) return reply.status(404).send({ message: 'Blackboard not found' });
    return reply.status(201).send(board);
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid Agent Blackboard request',
    issues,
  });
}
