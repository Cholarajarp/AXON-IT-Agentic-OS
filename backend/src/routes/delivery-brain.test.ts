import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerDeliveryBrainRoutes } from './delivery-brain.js';

describe('delivery brain routes', () => {
  it('turns a broad founder mission into a source-backed enterprise dossier without repetitive questions', async () => {
    const app = Fastify();
    await app.register(registerDeliveryBrainRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/delivery-brain/dossiers',
      payload: {
        mission: 'Build next level IT agent OS that understands user needs once, builds enterprise AI software products, shows how it works, proves security, modern UI/UX, deployment, management, current skills from GitHub, and cost-controlled operations to beat a 200000 employee IT company',
        regulated: true,
        budgetUsd: 5000000,
        existingAnswers: {
          productionAccess: 'reviewed only',
          customerPromise: 'enterprise trust and speed',
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.inferredIntent.noRepeatPolicy.length).toBeGreaterThan(2);
    expect(body.sourceSignals.map((source: { name: string }) => source.name)).toEqual(expect.arrayContaining([
      'Google Vertex AI Agent Builder',
      'NIST AI Risk Management Framework',
      'OWASP Top 10 for LLM Applications',
    ]));
    expect(body.decisionTrace.length).toBeGreaterThan(2);
    expect(body.enterpriseArchitecture.aiRuntime).toEqual(expect.arrayContaining(['role-based agent registry']));
    expect(body.securityAndGovernance.length).toBeGreaterThan(3);
    expect(body.deliveryPlan.length).toBeGreaterThan(3);

    await app.close();
  });
});
