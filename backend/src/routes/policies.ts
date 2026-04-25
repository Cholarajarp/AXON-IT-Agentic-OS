import type { FastifyInstance, FastifyRequest } from 'fastify';
import { sql } from '../db/connection.js';
import type { Policy } from '../types/domain.js';

export async function registerPolicyRoutes(app: FastifyInstance) {
  app.get('/policies', async () => {
    const rows = await sql`
      SELECT id, name, type, scope, version, status, updated_at, violations_7d
      FROM policies
      ORDER BY updated_at DESC
    `;
    return rows.map(mapPolicy);
  });

  app.get('/policies/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = req.params;
    const [row] = await sql`
      SELECT id, name, type, scope, version, status, updated_at, violations_7d
      FROM policies WHERE id = ${id}
    `;
    if (!row) return reply.status(404).send({ message: 'Policy not found' });
    return mapPolicy(row);
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
