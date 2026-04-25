import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerSecurityCenterRoutes } from './security-center.js';

describe('security center routes', () => {
  it('blocks publishing when a secret is detected', async () => {
    const app = Fastify();
    await app.register(registerSecurityCenterRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/security-center/scan',
      payload: {
        files: [
          {
            path: 'src/server.ts',
            content: "const apiKey = 'sk-1234567890abcdefghijklmnop';",
          },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.status).toBe('blocked');
    expect(body.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'secret', blocksPublish: true }),
      ]),
    );
    expect(body.findings[0].excerpt).not.toContain('abcdefghijklmnop');

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
