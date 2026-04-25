import type { FastifyInstance, FastifyRequest } from 'fastify';
import { sql } from '../db/connection.js';
import type { Incident } from '../types/domain.js';
import { broadcastUpdate } from '../ws/gateway.js';

export async function registerIncidentRoutes(app: FastifyInstance) {
  app.get('/incidents', async () => {
    const rows = await sql`
      SELECT id, severity, title, affected, state, started_at, resolved_at
      FROM incidents
      ORDER BY started_at DESC
    `;
    return rows.map(mapIncident);
  });

  app.get('/incidents/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = req.params;
    const [row] = await sql`
      SELECT id, severity, title, affected, state, started_at, resolved_at
      FROM incidents WHERE id = ${id}
    `;
    if (!row) return reply.status(404).send({ message: 'Incident not found' });
    return mapIncident(row);
  });

  app.post('/incidents/:id/resolve', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = req.params;
    const resolvedAt = Date.now();
    const [row] = await sql`
      UPDATE incidents SET state = 'RESOLVED', resolved_at = ${resolvedAt}
      WHERE id = ${id} AND state NOT IN ('RESOLVED', 'POST_MORTEM')
      RETURNING id, state
    `;
    if (!row) return reply.status(404).send({ message: 'Incident not found or already resolved' });
    broadcastUpdate('incident:resolved', { id, resolvedAt });
    return { success: true, id };
  });
}

function mapIncident(row: Record<string, unknown>): Incident {
  return {
    id: row.id as string,
    severity: row.severity as Incident['severity'],
    title: row.title as string,
    affected: row.affected as string[],
    state: row.state as Incident['state'],
    startedAt: Number(row.started_at),
    resolvedAt: row.resolved_at ? Number(row.resolved_at) : undefined,
  };
}
