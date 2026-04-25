import type { FastifyInstance } from 'fastify';
import { sql } from '../db/connection.js';
import type { Evidence } from '../types/domain.js';

export async function registerEvidenceRoutes(app: FastifyInstance) {
  app.get('/evidence', async () => {
    const rows = await sql`
      SELECT id, control_id, framework, description, status,
             workflow_id, agent_id, generated_at
      FROM evidence
      ORDER BY generated_at DESC
    `;
    return rows.map(mapEvidence);
  });
}

function mapEvidence(row: Record<string, unknown>): Evidence {
  return {
    id: row.id as string,
    controlId: row.control_id as string,
    framework: row.framework as string,
    description: row.description as string,
    status: row.status as Evidence['status'],
    workflowId: (row.workflow_id as string) || undefined,
    agentId: (row.agent_id as string) || undefined,
    generatedAt: Number(row.generated_at),
  };
}
