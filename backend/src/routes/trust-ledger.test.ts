import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerTrustLedgerRoutes } from './trust-ledger.js';

describe('trust ledger routes', () => {
  it('records evidence, evaluates policy, verifies the chain, and exports controls', async () => {
    const app = Fastify();
    await app.register(registerTrustLedgerRoutes);

    const recordResponse = await app.inject({
      method: 'POST',
      url: '/trust-ledger/records',
      payload: {
        kind: 'browser-artifact',
        actor: 'QAAgent',
        subject: 'Preview QA trace',
        summary: 'Browser journey passed with screenshot and trace artifacts.',
        risk: 'low',
        artifacts: ['trace.zip', 'homepage.png'],
      },
    });

    expect(recordResponse.statusCode).toBe(201);
    expect(recordResponse.json().hash).toHaveLength(64);
    expect(recordResponse.json().signature).toHaveLength(64);

    const signingStatusResponse = await app.inject({ method: 'GET', url: '/trust-ledger/signing-status' });
    expect(signingStatusResponse.statusCode).toBe(200);
    expect(signingStatusResponse.json().keyFingerprint).toHaveLength(12);

    const policyResponse = await app.inject({
      method: 'POST',
      url: '/trust-ledger/policy/decide',
      payload: {
        actor: 'ReleaseAgent',
        action: 'deploy production',
        resource: 'customer-portal',
        environment: 'production',
        risk: 'high',
        requestedScopes: ['deploy:write'],
      },
    });

    expect(policyResponse.statusCode).toBe(201);
    expect(policyResponse.json().decision).toBe('block');
    expect(policyResponse.json().record.kind).toBe('policy-decision');

    const verifyResponse = await app.inject({
      method: 'POST',
      url: '/trust-ledger/verify',
      payload: {},
    });
    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.json().valid).toBe(true);

    const exportResponse = await app.inject({
      method: 'POST',
      url: '/trust-ledger/export',
      payload: { format: 'release-pack' },
    });
    expect(exportResponse.statusCode).toBe(200);
    expect(exportResponse.json().controls.length).toBeGreaterThan(0);
    expect(exportResponse.json().records.length).toBeGreaterThanOrEqual(2);

    await app.close();
  });
});
