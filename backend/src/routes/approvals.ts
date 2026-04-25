import type { FastifyInstance, FastifyRequest } from 'fastify';
import { sql } from '../db/connection.js';
import type { Approval } from '../types/domain.js';
import { broadcastUpdate } from '../ws/gateway.js';

export async function registerApprovalRoutes(app: FastifyInstance) {
  app.get('/approvals', async () => {
    const rows = await sql`
      SELECT id, title, workflow_id, agent_id, risk_score,
             blast_radius, reversible, expires_at, severity, status
      FROM approvals
      ORDER BY expires_at ASC
    `;
    return rows.map(mapApproval);
  });

  app.patch('/approvals/:id', async (req: FastifyRequest<{ Params: { id: string }; Body: { decision: 'APPROVED' | 'REJECTED' } }>, reply) => {
    const { id } = req.params;
    const { decision } = req.body;
    const [row] = await sql`
      UPDATE approvals SET status = ${decision}
      WHERE id = ${id} AND status = 'PENDING'
      RETURNING id, status
    `;
    if (!row) return reply.status(404).send({ message: 'Approval not found or already resolved' });
    broadcastUpdate('approval:resolved', { id, decision });
    return { success: true, id, decision };
  });
}

function mapApproval(row: Record<string, unknown>): Approval {
  return {
    id: row.id as string,
    title: row.title as string,
    workflowId: row.workflow_id as string,
    agentId: row.agent_id as string,
    riskScore: Number(row.risk_score),
    blastRadius: row.blast_radius as Approval['blastRadius'],
    reversible: row.reversible as boolean,
    expiresAt: Number(row.expires_at),
    severity: row.severity as Approval['severity'],
    status: row.status as Approval['status'],
  };
}
