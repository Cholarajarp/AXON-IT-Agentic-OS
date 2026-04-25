import type { FastifyInstance, FastifyRequest } from 'fastify';
import { sql } from '../db/connection.js';
import type { Alert } from '../types/domain.js';
import { broadcastUpdate } from '../ws/gateway.js';

export async function registerAlertRoutes(app: FastifyInstance) {
  app.get('/alerts', async () => {
    const rows = await sql`
      SELECT id, severity, title, source, created_at
      FROM alerts
      WHERE acknowledged = false
      ORDER BY created_at DESC
    `;
    return rows.map(mapAlert);
  });

  app.post('/alerts/:id/acknowledge', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = req.params;
    const [row] = await sql`
      UPDATE alerts SET acknowledged = true
      WHERE id = ${id} AND acknowledged = false
      RETURNING id
    `;
    if (!row) return reply.status(404).send({ message: 'Alert not found or already acknowledged' });
    broadcastUpdate('alert:acknowledged', { id });
    return { success: true, id };
  });
}

function mapAlert(row: Record<string, unknown>): Alert {
  return {
    id: row.id as string,
    severity: row.severity as Alert['severity'],
    title: row.title as string,
    source: row.source as string,
    createdAt: Number(row.created_at),
  };
}
