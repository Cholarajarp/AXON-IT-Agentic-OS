import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerApiForgeRoutes } from './api-forge.js';

describe('api forge routes', () => {
  it('turns an OpenAPI spec into SDK, CLI, MCP, docs, and quality gate plans', async () => {
    const app = Fastify();
    await app.register(registerApiForgeRoutes);

    const spec = {
      openapi: '3.1.0',
      info: { title: 'Payments API', version: '1.0.0' },
      servers: [{ url: 'https://api.payments.test/v1' }],
      components: {
        schemas: { Payment: { type: 'object' } },
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
      },
      paths: {
        '/payments': {
          get: { operationId: 'listPayments', summary: 'List payments' },
          post: { operationId: 'createPayment', summary: 'Create payment' },
        },
        '/payments/{id}': {
          delete: { operationId: 'deletePayment', summary: 'Delete payment' },
        },
      },
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api-forge/reports',
      payload: {
        spec,
        packageName: 'payments-api',
        targets: ['typescript', 'python', 'cli', 'mcp-server', 'docs-search'],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.specStats.operations).toBe(3);
    expect(body.auth.type).toBe('bearer');
    expect(body.sdkTargets.map((target: { language: string }) => target.language)).toEqual(
      expect.arrayContaining(['typescript', 'python']),
    );
    expect(body.mcpPlan.tools.map((tool: { name: string }) => tool.name)).toEqual(
      expect.arrayContaining(['docs_search', 'sdk_execute', 'approval_required_mutation']),
    );
    expect(body.qualityGates.length).toBeGreaterThan(2);
    expect(body.generatedArtifacts.map((artifact: { kind: string }) => artifact.kind)).toEqual(
      expect.arrayContaining(['sdk', 'cli', 'mcp', 'config']),
    );

    await app.close();
  });
});
