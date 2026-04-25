import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sqlMock, broadcastUpdateMock } = vi.hoisted(() => ({
  sqlMock: vi.fn(),
  broadcastUpdateMock: vi.fn(),
}));

vi.mock('../db/connection.js', () => ({
  sql: sqlMock,
}));

vi.mock('../ws/gateway.js', () => ({
  broadcastUpdate: broadcastUpdateMock,
}));

import { auditChain } from './audit-chain.js';

function makeEntry(sequence: number, previousHash: string) {
  const entry = {
    id: `audit-${sequence}`,
    sequence,
    timestamp: 1_700_000_000_000 + sequence,
    action: 'tool.executed',
    actor: 'system',
    actorType: 'system' as const,
    resource: 'tool:http.request',
    tenantId: 'tenant_default',
    details: { sequence },
    riskLevel: 'low' as const,
    previousHash,
    hash: '',
  };

  return {
    ...entry,
    hash: auditChain.computeHash(entry),
  };
}

describe('audit chain hydration', () => {
  beforeEach(async () => {
    sqlMock.mockReset();
    broadcastUpdateMock.mockReset();
    sqlMock.mockResolvedValue([]);
    await auditChain.hydrate();
  });

  it('continues the persisted chain after hydrate', async () => {
    const first = makeEntry(1, '0'.repeat(64));
    const second = makeEntry(2, first.hash);

    sqlMock.mockResolvedValueOnce([second, first]);
    const loaded = await auditChain.hydrate();

    expect(loaded).toBe(2);

    sqlMock.mockResolvedValueOnce([]);
    const appended = await auditChain.append({
      action: 'tool.executed',
      actor: 'system',
      actorType: 'system',
      resource: 'tool:filesystem.read',
      tenantId: 'tenant_default',
      details: { ok: true },
      riskLevel: 'low',
    });

    expect(appended.sequence).toBe(3);
    expect(appended.previousHash).toBe(second.hash);
    expect(auditChain.getRecent(3).map((entry) => entry.sequence)).toEqual([3, 2, 1]);
    expect(broadcastUpdateMock).toHaveBeenCalledWith(
      'audit.entry',
      expect.objectContaining({ action: 'tool.executed', actor: 'system' }),
    );
  });
});