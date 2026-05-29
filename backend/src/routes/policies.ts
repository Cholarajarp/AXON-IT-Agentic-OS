import type { FastifyInstance, FastifyRequest } from 'fastify';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { sql } from '../db/connection.js';
import { policyService, type PolicyDecision, type PolicyRequest, type PolicyRule } from '../services/policy.js';
import { DurableJsonStore } from '../services/durable-json-store.js';
import type { Policy } from '../types/domain.js';

type DurablePolicy = Policy & {
  regoSource?: string;
  tenantId: string;
  createdAt: string;
};

const policyStore = new DurableJsonStore<DurablePolicy[]>('policies/records.json', []);

const policySchema = z.object({
  name: z.string().min(3),
  type: z.enum(['Tool', 'Data', 'Approval', 'Model', 'Cost', 'Environment']),
  scope: z.string().min(1).default('*'),
  version: z.string().min(1).default('1.0'),
  status: z.enum(['ACTIVE', 'DRAFT', 'DEPRECATED']).default('ACTIVE'),
  regoSource: z.string().optional(),
  tenantId: z.string().min(1).default('tenant_default'),
});

const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'DRAFT', 'DEPRECATED']),
});

const simulateSchema = z.object({
  agent: z.string().min(1).default('EngineeringAgent'),
  tenantId: z.string().min(1).default('tenant_default'),
  sensitivityLevel: z.enum(['public', 'internal', 'confidential', 'restricted']).default('internal'),
  sovereignMode: z.boolean().default(false),
  approvalApproved: z.boolean().default(false),
});

export async function registerPolicyRoutes(app: FastifyInstance) {
  app.get('/policies', async () => {
    try {
      const rows = await sql`
        SELECT id, name, type, scope, version, status, updated_at, violations_7d
        FROM policies
        ORDER BY updated_at DESC
      `;
      return mergePolicies(rows.map(mapPolicy), policyStore.read());
    } catch {
      return policyStore.read();
    }
  });

  app.get('/policies/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = req.params;
    try {
      const [row] = await sql`
        SELECT id, name, type, scope, version, status, updated_at, violations_7d
        FROM policies WHERE id = ${id}
      `;
      if (row) return mapPolicy(row);
    } catch {
      // Fall through to durable local lookup.
    }
    const local = policyStore.read().find((policy) => policy.id === id);
    if (!local) return reply.status(404).send({ message: 'Policy not found' });
    return local;
  });

  app.post('/policies', async (request, reply) => {
    const parsed = policySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid policy record',
        issues: parsed.error.issues,
      });
    }

    const now = Date.now();
    const policy: DurablePolicy = {
      id: `pol_${nanoid(10)}`,
      name: parsed.data.name,
      type: parsed.data.type,
      scope: parsed.data.scope,
      version: parsed.data.version,
      status: parsed.data.status,
      violations7d: 0,
      updatedAt: now,
      regoSource: parsed.data.regoSource,
      tenantId: parsed.data.tenantId,
      createdAt: new Date(now).toISOString(),
    };

    policyStore.write(mergePolicies([policy], policyStore.read()) as DurablePolicy[]);

    try {
      await sql`
        INSERT INTO policies (id, name, type, scope, version, status, updated_at, violations_7d, rego_source, tenant_id)
        VALUES (
          ${policy.id},
          ${policy.name},
          ${policy.type},
          ${policy.scope},
          ${policy.version},
          ${policy.status},
          ${policy.updatedAt},
          ${policy.violations7d},
          ${policy.regoSource ?? null},
          ${policy.tenantId}
        )
        ON CONFLICT (id) DO NOTHING
      `;
    } catch {
      // Durable local policy remains active for standalone mode.
    }

    policyService.invalidateCache();
    return reply.status(201).send(policy);
  });

  app.patch('/policies/:id/status', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const parsed = statusSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid policy status',
        issues: parsed.error.issues,
      });
    }

    const now = Date.now();
    const locals = policyStore.read();
    const target = locals.find((policy) => policy.id === request.params.id);
    let updated: Policy | undefined;
    if (target) {
      updated = { ...target, status: parsed.data.status, updatedAt: now };
      policyStore.write(locals.map((policy) => (policy.id === request.params.id ? updated as DurablePolicy : policy)));
    }

    try {
      const [row] = await sql`
        UPDATE policies
        SET status = ${parsed.data.status}, updated_at = ${now}
        WHERE id = ${request.params.id}
        RETURNING id, name, type, scope, version, status, updated_at, violations_7d
      `;
      if (row) updated = mapPolicy(row);
    } catch {
      // Local update above is enough in standalone mode.
    }

    if (!updated) return reply.status(404).send({ message: 'Policy not found' });
    policyService.invalidateCache();
    return updated;
  });

  app.post('/policies/simulate', async (request, reply) => {
    const parsed = simulateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid policy simulation request',
        issues: parsed.error.issues,
      });
    }

    const input = parsed.data;
    const serviceDecision = await policyService.evaluate(input);
    const localDecision = evaluateDurablePolicies(policyStore.read(), input);
    const decision: PolicyDecision = {
      allowed: serviceDecision.allowed && localDecision.allowed,
      matched: [...serviceDecision.matched, ...localDecision.matched],
      reasons: [...serviceDecision.reasons, ...localDecision.reasons],
      requireApproval: serviceDecision.requireApproval || localDecision.requireApproval,
      requireSovereign: serviceDecision.requireSovereign || localDecision.requireSovereign,
    };

    return {
      input,
      decision,
      evaluatedAt: new Date().toISOString(),
    };
  });
}

function mapPolicy(row: Record<string, unknown>): Policy {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as Policy['type'],
    scope: row.scope as string,
    version: row.version as string,
    status: row.status as Policy['status'],
    updatedAt: Number(row.updated_at),
    violations7d: Number(row.violations_7d),
  };
}

function mergePolicies(primary: Policy[], secondary: Policy[]): Policy[] {
  const map = new Map<string, Policy>();
  for (const policy of [...primary, ...secondary]) map.set(policy.id, policy);
  return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

function evaluateDurablePolicies(policies: DurablePolicy[], request: PolicyRequest): PolicyDecision {
  const decision: PolicyDecision = {
    allowed: true,
    matched: [],
    reasons: [],
    requireApproval: false,
    requireSovereign: false,
  };

  for (const policy of policies.filter((item) => item.status === 'ACTIVE')) {
    const rule = parsePolicyRule(policy);
    if (!matches(rule, request)) continue;
    decision.matched.push(policy.name);
    if (rule.deny?.length) {
      decision.allowed = false;
      decision.reasons.push(...rule.deny);
    }
    if (rule.require?.approval) {
      decision.requireApproval = true;
      if (!request.approvalApproved) {
        decision.allowed = false;
        decision.reasons.push(`${policy.name}: approval required`);
      }
    }
    if (rule.require?.sovereign) {
      decision.requireSovereign = true;
      if (!request.sovereignMode) {
        decision.allowed = false;
        decision.reasons.push(`${policy.name}: sovereign mode required`);
      }
    }
  }

  return decision;
}

function parsePolicyRule(policy: DurablePolicy): PolicyRule['rule'] {
  if (!policy.regoSource) return {};
  try {
    return JSON.parse(policy.regoSource) as PolicyRule['rule'];
  } catch {
    return {};
  }
}

function matches(rule: PolicyRule['rule'], request: PolicyRequest): boolean {
  const when = rule.when;
  if (!when) return true;
  if (when.agent && when.agent !== request.agent) return false;
  if (when.tenantId && when.tenantId !== request.tenantId) return false;
  if (when.sensitivityLevel && when.sensitivityLevel !== request.sensitivityLevel) return false;
  if (when.sovereignOnly && !request.sovereignMode) return false;
  return true;
}
