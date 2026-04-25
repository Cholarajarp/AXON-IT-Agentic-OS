import { createHash } from 'crypto';
import { nanoid } from 'nanoid';
import { sql } from '../db/connection.js';
import { broadcastUpdate } from '../ws/gateway.js';

export interface AuditEntry {
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

class AuditChain {
  private chain: AuditEntry[] = [];
  private sequence = 0;
  private lastHash = '0'.repeat(64);

  computeHash(entry: Omit<AuditEntry, 'hash'>): string {
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

  async append(params: {
    action: string;
    actor: string;
    actorType: 'human' | 'agent' | 'system';
    resource: string;
    tenantId: string;
    details: Record<string, unknown>;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<AuditEntry> {
    this.sequence++;

    const entry: AuditEntry = {
      id: nanoid(16),
      sequence: this.sequence,
      timestamp: Date.now(),
      action: params.action,
      actor: params.actor,
      actorType: params.actorType,
      resource: params.resource,
      tenantId: params.tenantId,
      details: params.details,
      riskLevel: params.riskLevel,
      previousHash: this.lastHash,
      hash: '',
    };

    entry.hash = this.computeHash(entry);
    this.lastHash = entry.hash;
    this.chain.push(entry);

    if (this.chain.length > 10000) {
      this.chain = this.chain.slice(-5000);
    }

    if (!isUnitTest()) {
      try {
        await sql`
          INSERT INTO audit_chain (id, sequence, timestamp_ms, action, actor, actor_type, resource, tenant_id, details, risk_level, previous_hash, hash)
          VALUES (${entry.id}, ${entry.sequence}, ${entry.timestamp}, ${entry.action}, ${entry.actor}, ${entry.actorType}, ${entry.resource}, ${entry.tenantId}, ${JSON.stringify(entry.details)}, ${entry.riskLevel}, ${entry.previousHash}, ${entry.hash})
        `;
      } catch {
        // DB table may not exist yet — chain still works in-memory
      }
    }

    broadcastUpdate('audit.entry', { id: entry.id, action: entry.action, actor: entry.actor, riskLevel: entry.riskLevel });
    return entry;
  }

  async hydrate(limit = 10000): Promise<number> {
    const rows = await sql`
      SELECT id, sequence, timestamp_ms, action, actor, actor_type, resource,
             tenant_id, details, risk_level, previous_hash, hash
      FROM audit_chain
      ORDER BY sequence DESC
      LIMIT ${limit}
    `;

    const entries = [...rows].reverse().map((row) => ({
      id: row.id,
      sequence: Number(row.sequence),
      timestamp: Number(row.timestamp_ms),
      action: row.action,
      actor: row.actor,
      actorType: row.actor_type,
      resource: row.resource,
      tenantId: row.tenant_id,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
      riskLevel: row.risk_level,
      previousHash: row.previous_hash,
      hash: row.hash,
    }));

    this.chain = entries;
    this.sequence = entries.at(-1)?.sequence ?? 0;
    this.lastHash = entries.at(-1)?.hash ?? '0'.repeat(64);
    return entries.length;
  }

  verify(): { valid: boolean; brokenAt?: number; totalEntries: number } {
    for (let i = 1; i < this.chain.length; i++) {
      const entry = this.chain[i]!;
      const prev = this.chain[i - 1]!;

      if (entry.previousHash !== prev.hash) {
        return { valid: false, brokenAt: entry.sequence, totalEntries: this.chain.length };
      }

      const { hash: _h, ...rest } = entry;
      const recomputed = this.computeHash(rest);
      if (recomputed !== entry.hash) {
        return { valid: false, brokenAt: entry.sequence, totalEntries: this.chain.length };
      }
    }
    return { valid: true, totalEntries: this.chain.length };
  }

  getRecent(limit = 50, tenantId?: string): AuditEntry[] {
    let entries = this.chain.slice(-limit);
    if (tenantId) {
      entries = entries.filter((e) => e.tenantId === tenantId);
    }
    return entries.reverse();
  }

  getByAction(action: string, limit = 20): AuditEntry[] {
    return this.chain.filter((e) => e.action === action).slice(-limit).reverse();
  }

  getStats() {
    const byAction = new Map<string, number>();
    const byRisk = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const entry of this.chain) {
      byAction.set(entry.action, (byAction.get(entry.action) || 0) + 1);
      byRisk[entry.riskLevel]++;
    }
    return {
      totalEntries: this.chain.length,
      currentSequence: this.sequence,
      chainIntegrity: this.verify().valid,
      byAction: Object.fromEntries(byAction),
      byRisk,
    };
  }
}

export const auditChain = new AuditChain();

function isUnitTest(): boolean {
  return process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
}
