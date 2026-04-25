import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { trustLedger } from '../trust-ledger/index.js';

const kindSchema = z.enum([
  'policy-decision',
  'command-evidence',
  'browser-artifact',
  'security-scan',
  'database-review',
  'release-manifest',
  'approval',
  'deployment',
  'cost',
  'customer-handoff',
  'market-signal',
]);
const riskSchema = z.enum(['low', 'medium', 'high', 'critical']);

const recordSchema = z.object({
  tenantId: z.string().min(1).optional(),
  kind: kindSchema,
  actor: z.string().min(1),
  actorType: z.enum(['human', 'agent', 'system']).optional(),
  subject: z.string().min(1),
  summary: z.string().min(1),
  risk: riskSchema.optional(),
  source: z.string().min(1).optional(),
  artifacts: z.array(z.string().min(1)).optional(),
  metadata: z.record(z.unknown()).optional(),
  controls: z.array(z.string().min(1)).optional(),
});

const policySchema = z.object({
  tenantId: z.string().min(1).optional(),
  actor: z.string().min(1),
  action: z.string().min(1),
  resource: z.string().min(1),
  risk: riskSchema.optional(),
  environment: z.enum(['preview', 'staging', 'production']).optional(),
  dataClass: z.enum(['public', 'internal', 'confidential', 'restricted']).optional(),
  requestedScopes: z.array(z.string().min(1)).optional(),
  hasApproval: z.boolean().optional(),
});

const querySchema = z.object({
  tenantId: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  kind: kindSchema.optional(),
});

const exportSchema = z.object({
  tenantId: z.string().min(1).optional(),
  format: z.enum(['soc2-lite', 'iso27001-lite', 'release-pack']).optional(),
});

export async function registerTrustLedgerRoutes(app: FastifyInstance) {
  app.get('/trust-ledger/records', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return { records: trustLedger.listRecords(parsed.data) };
  });

  app.get('/trust-ledger/signing-status', async () => trustLedger.signingStatus());

  app.post('/trust-ledger/records', async (request, reply) => {
    const parsed = recordSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(trustLedger.append(parsed.data));
  });

  app.post('/trust-ledger/policy/decide', async (request, reply) => {
    const parsed = policySchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(trustLedger.evaluatePolicy(parsed.data));
  });

  app.post('/trust-ledger/verify', async (request, reply) => {
    const parsed = z.object({ tenantId: z.string().min(1).optional() }).safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return trustLedger.verify(parsed.data.tenantId);
  });

  app.post('/trust-ledger/export', async (request, reply) => {
    const parsed = exportSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return trustLedger.exportPack(parsed.data);
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid Trust Ledger request',
    issues,
  });
}
