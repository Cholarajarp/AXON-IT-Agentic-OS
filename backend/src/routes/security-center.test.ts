import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerSecurityCenterRoutes } from './security-center.js';

describe('security center routes', () => {
  it('requires review when a committed credential assignment is detected', async () => {
    const app = Fastify();
    await app.register(registerSecurityCenterRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/security-center/scan',
      payload: {
        files: [
          {
            path: 'src/server.ts',
            content: "const apiKey = 'test_secret_fixture_value_12345';",
          },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.status).toBe('needs-review');
    expect(body.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'secret', blocksPublish: true }),
      ]),
    );
    expect(body.findings[0].excerpt).not.toContain('fixture_value_12345');

    await app.close();
  });

  it('allows runtime environment secret references', async () => {
    const app = Fastify();
    await app.register(registerSecurityCenterRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/security-center/scan',
      payload: {
        files: [
          {
            path: 'src/github.ts',
            content: 'const token = process.env.GITHUB_TOKEN; const secret = Deno.env.get("AXON_CONFIG_SECRET");',
          },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'secret', title: 'Hard-coded secret assignment detected' }),
      ]),
    );

    await app.close();
  });

  it('flags missing row-level access control for user tables', async () => {
    const app = Fastify();
    await app.register(registerSecurityCenterRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/security-center/scan',
      payload: {
        files: [
          {
            path: 'supabase/migrations/001_users.sql',
            content: 'create table customer_tickets (id uuid primary key, tenant_id uuid, body text);',
          },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: expect.stringContaining('database-missing-rls'), category: 'database' }),
      ]),
    );

    await app.close();
  });
});
