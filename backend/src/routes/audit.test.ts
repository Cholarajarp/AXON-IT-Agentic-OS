import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeAuditHash, registerAuditRoutes, verifyAuditEntries } from './audit.js';

const { sqlMock, getRecentMock } = vi.hoisted(() => ({
  sqlMock: vi.fn(),
  getRecentMock: vi.fn(),
}));

vi.mock('../db/connection.js', () => ({
  sql: sqlMock,
}));

vi.mock('../services/audit-chain.js', () => ({
  auditChain: {
    getRecent: getRecentMock,
  },
}));

function makeRow(sequence: number, previousHash: string, tenantId = 'tenant_default') {
  const row = {
    id: `a${sequence}`,
    sequence,
    timestamp_ms: sequence * 1_000,
    action: 'tool.executed',
    actor: 'system',
    actor_type: 'system' as const,
    resource: 'tool:http.request',
    tenant_id: tenantId,
    details: { ok: true, sequence },
    risk_level: 'low' as const,
    previous_hash: previousHash,
  };

  return {
    ...row,
    hash: computeAuditHash({
      id: row.id,
      sequence: row.sequence,
      timestamp: row.timestamp_ms,
      action: row.action,
      actor: row.actor,
      actorType: row.actor_type,
      resource: row.resource,
      tenantId: row.tenant_id,
      details: row.details,
      riskLevel: row.risk_level,
      previousHash: row.previous_hash,
    }),
  };
}

function makeRecord(sequence: number, previousHash: string, tenantId = 'tenant_default') {
  const row = makeRow(sequence, previousHash, tenantId);
  return {
    id: row.id,
    sequence: row.sequence,
    timestamp: row.timestamp_ms,
    action: row.action,
    actor: row.actor,
    actorType: row.actor_type,
    resource: row.resource,
    tenantId: row.tenant_id,
    details: row.details,
    riskLevel: row.risk_level,
    previousHash: row.previous_hash,
    hash: row.hash,
  };
}

describe('audit verification', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    getRecentMock.mockReset();
  });

  it('accepts a valid hash chain', () => {
    const first = makeRecord(1, '0'.repeat(64));
    const second = makeRecord(2, first.hash);

    expect(verifyAuditEntries([first, second])).toMatchObject({ valid: true, totalEntries: 2 });
  });

  it('rejects a tampered hash chain', () => {
    const first = makeRecord(1, '0'.repeat(64));
    const second = {
      ...makeRecord(2, first.hash),
      hash: 'b'.repeat(64),
    };

    expect(verifyAuditEntries([first, second])).toMatchObject({
      valid: false,
      totalEntries: 2,
      brokenAtSequence: 2,
      brokenEntryId: 'a2',
    });
  });

  it('serves persisted rows and verifies them through the route', async () => {
    const first = makeRow(1, '0'.repeat(64), 'tenant_live');
    const second = makeRow(2, first.hash, 'tenant_live');

    sqlMock
      .mockResolvedValueOnce([second, first])
      .mockResolvedValueOnce([first, second]);

    const app = Fastify();
    await app.register(registerAuditRoutes);

    const auditResponse = await app.inject({
      method: 'GET',
      url: '/audit?tenantId=tenant_live&limit=2',
    });

    expect(auditResponse.statusCode).toBe(200);
    expect(auditResponse.json()).toMatchObject([
      { id: 'a2', tenantId: 'tenant_live' },
      { id: 'a1', tenantId: 'tenant_live' },
    ]);

    const verifyResponse = await app.inject({
      method: 'POST',
      url: '/audit/verify',
      payload: { tenantId: 'tenant_live' },
    });

    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.json()).toMatchObject({
      valid: true,
      totalEntries: 2,
      headHash: second.hash,
      tailHash: first.hash,
    });

    await app.close();
  });

  it('falls back to the in-memory chain when postgres is unavailable', async () => {
    const first = makeRecord(1, '0'.repeat(64), 'tenant_fallback');
    const second = makeRecord(2, first.hash, 'tenant_fallback');

    sqlMock.mockRejectedValueOnce(new Error('db unavailable'));
    getRecentMock.mockReturnValueOnce([second, first]);

    const app = Fastify();
    await app.register(registerAuditRoutes);

    const response = await app.inject({
      method: 'GET',
      url: '/audit?tenantId=tenant_fallback',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject([
      { id: 'a2', tenantId: 'tenant_fallback' },
      { id: 'a1', tenantId: 'tenant_fallback' },
    ]);

    await app.close();
  });
});