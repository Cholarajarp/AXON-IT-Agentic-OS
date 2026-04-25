import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';
import { sql } from '../db/connection.js';
import { auditChain } from '../services/audit-chain.js';

export interface AuditEntryRecord {
  id: string;
  sequence: number;
  timestamp: number;
  action: string;
  actor: string;
  actorType: 'human' | 'agent' | 'system';
  resource: string;
  tenantId: string;
  details: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  previousHash: string;
  hash: string;
}

export interface AuditVerificationResult {
  valid: boolean;
  totalEntries: number;
  brokenAtSequence?: number;
  brokenEntryId?: string;
  headHash?: string;
  tailHash?: string;
}

interface AuditQuery {
  limit?: string;
  tenantId?: string;
}

interface AuditVerifyBody {
  tenantId?: string;
}

export async function registerAuditRoutes(app: FastifyInstance) {
  app.get('/audit', async (req: FastifyRequest<{ Querystring: AuditQuery }>) => {
    const limit = normalizeLimit(req.query.limit);
    const tenantId = req.query.tenantId?.trim();

    try {
      if (tenantId) {
        const rows = await sql`
          SELECT id, sequence, timestamp_ms, action, actor, actor_type, resource,
                 tenant_id, details, risk_level, previous_hash, hash
          FROM audit_chain
          WHERE tenant_id = ${tenantId}
          ORDER BY sequence DESC
          LIMIT ${limit}
        `;
        return rows.map(mapAuditRow);
      }

      const rows = await sql`
        SELECT id, sequence, timestamp_ms, action, actor, actor_type, resource,
               tenant_id, details, risk_level, previous_hash, hash
        FROM audit_chain
        ORDER BY sequence DESC
        LIMIT ${limit}
      `;
      return rows.map(mapAuditRow);
    } catch {
      return auditChain.getRecent(limit, tenantId).map((entry) => ({
        id: entry.id,
        sequence: entry.sequence,
        timestamp: entry.timestamp,
        action: entry.action,
        actor: entry.actor,
        actorType: entry.actorType,
        resource: entry.resource,
        tenantId: entry.tenantId,
        details: entry.details,
        riskLevel: entry.riskLevel,
        previousHash: entry.previousHash,
        hash: entry.hash,
      }));
    }
  });

  app.post('/audit/verify', async (req: FastifyRequest<{ Body: AuditVerifyBody }>, reply: FastifyReply) => {
    const tenantId = req.body.tenantId?.trim();
    try {
      const rows = tenantId
        ? await sql`
            SELECT id, sequence, timestamp_ms, action, actor, actor_type, resource,
                   tenant_id, details, risk_level, previous_hash, hash
            FROM audit_chain
            WHERE tenant_id = ${tenantId}
            ORDER BY sequence ASC
          `
        : await sql`
            SELECT id, sequence, timestamp_ms, action, actor, actor_type, resource,
                   tenant_id, details, risk_level, previous_hash, hash
            FROM audit_chain
            ORDER BY sequence ASC
          `;

      return reply.send(verifyAuditEntries(rows.map(mapAuditRow)));
    } catch {
      return reply.send(verifyAuditEntries(auditChain.getRecent(10_000, tenantId).reverse()));
    }
  });
}

export function verifyAuditEntries(entries: AuditEntryRecord[]): AuditVerificationResult {
  if (entries.length === 0) {
    return { valid: true, totalEntries: 0 };
  }

  let previousHash = '0'.repeat(64);
  for (const entry of entries) {
    if (entry.previousHash !== previousHash) {
      return {
        valid: false,
        totalEntries: entries.length,
        brokenAtSequence: entry.sequence,
        brokenEntryId: entry.id,
        headHash: entries.at(-1)?.hash,
        tailHash: entries[0]?.hash,
      };
    }

    const expectedHash = computeAuditHash({
      id: entry.id,
      sequence: entry.sequence,
      timestamp: entry.timestamp,
      action: entry.action,
      actor: entry.actor,
      actorType: entry.actorType,
      resource: entry.resource,
      tenantId: entry.tenantId,
      details: entry.details,
      riskLevel: entry.riskLevel,
      previousHash: entry.previousHash,
    });

    if (expectedHash !== entry.hash) {
      return {
        valid: false,
        totalEntries: entries.length,
        brokenAtSequence: entry.sequence,
        brokenEntryId: entry.id,
        headHash: entries.at(-1)?.hash,
        tailHash: entries[0]?.hash,
      };
    }

    previousHash = entry.hash;
  }

  return {
    valid: true,
    totalEntries: entries.length,
    headHash: entries.at(-1)?.hash,
    tailHash: entries[0]?.hash,
  };
}

export function computeAuditHash(entry: {
  id: string;
  sequence: number;
  timestamp: number;
  action: string;
  actor: string;
  actorType: 'human' | 'agent' | 'system';
  resource: string;
  tenantId: string;
  details: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  previousHash: string;
}): string {
  const data = JSON.stringify({
    id: entry.id,
    sequence: entry.sequence,
    timestamp: entry.timestamp,
    action: entry.action,
    actor: entry.actor,
    resource: entry.resource,
    tenantId: entry.tenantId,
    details: entry.details,
    previousHash: entry.previousHash,
  });
  return createHash('sha256').update(data).digest('hex');
}

function mapAuditRow(row: Record<string, unknown>): AuditEntryRecord {
  return {
    id: row.id as string,
    sequence: Number(row.sequence),
    timestamp: Number(row.timestamp_ms),
    action: row.action as string,
    actor: row.actor as string,
    actorType: row.actor_type as AuditEntryRecord['actorType'],
    resource: row.resource as string,
    tenantId: row.tenant_id as string,
    details: normalizeDetails(row.details),
    riskLevel: row.risk_level as AuditEntryRecord['riskLevel'],
    previousHash: row.previous_hash as string,
    hash: row.hash as string,
  };
}

function normalizeDetails(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return { value };
    }
  }
  return { value };
}

function normalizeLimit(rawLimit?: string): number {
  const parsed = Number.parseInt(rawLimit ?? '100', 10);
  if (Number.isNaN(parsed)) return 100;
  return Math.min(Math.max(parsed, 1), 500);
}