import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { sql } from '../db/connection.js';
import { DurableJsonStore } from '../services/durable-json-store.js';
import type { Evidence } from '../types/domain.js';

const evidenceStore = new DurableJsonStore<Evidence[]>('evidence/records.json', []);

const evidenceSchema = z.object({
  controlId: z.string().min(2),
  framework: z.string().min(2),
  description: z.string().min(4),
  status: z.enum(['SATISFIED', 'PARTIAL', 'MISSING']).default('PARTIAL'),
  workflowId: z.string().min(1).optional(),
  agentId: z.string().min(1).optional(),
  tenantId: z.string().min(1).default('tenant_default'),
});

export async function registerEvidenceRoutes(app: FastifyInstance) {
  app.get('/evidence', async () => {
    try {
      const rows = await sql`
        SELECT id, control_id, framework, description, status,
               workflow_id, agent_id, generated_at
        FROM evidence
        ORDER BY generated_at DESC
      `;
      const dbRecords = rows.map(mapEvidence);
      return mergeEvidence(dbRecords, evidenceStore.read());
    } catch {
      return evidenceStore.read();
    }
  });

  app.post('/evidence', async (request, reply) => {
    const parsed = evidenceSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid evidence record',
        issues: parsed.error.issues,
      });
    }

    const record: Evidence = {
      id: `ev_${nanoid(10)}`,
      controlId: parsed.data.controlId,
      framework: parsed.data.framework,
      description: parsed.data.description,
      status: parsed.data.status,
      workflowId: parsed.data.workflowId,
      agentId: parsed.data.agentId,
      generatedAt: Date.now(),
    };

    evidenceStore.write(mergeEvidence([record], evidenceStore.read()).slice(0, 5000));

    try {
      await sql`
        INSERT INTO evidence (id, control_id, framework, description, status, workflow_id, agent_id, tenant_id, generated_at)
        VALUES (
          ${record.id},
          ${record.controlId},
          ${record.framework},
          ${record.description},
          ${record.status},
          ${record.workflowId ?? null},
          ${record.agentId ?? null},
          ${parsed.data.tenantId},
          ${record.generatedAt}
        )
        ON CONFLICT (id) DO NOTHING
      `;
    } catch {
      // Local durable evidence is still valid operator evidence in degraded mode.
    }

    return reply.status(201).send(record);
  });

  app.post('/evidence/export', async () => {
    let records: Evidence[];
    try {
      const rows = await sql`
        SELECT id, control_id, framework, description, status,
               workflow_id, agent_id, generated_at
        FROM evidence
        ORDER BY generated_at DESC
      `;
      records = mergeEvidence(rows.map(mapEvidence), evidenceStore.read());
    } catch {
      records = evidenceStore.read();
    }

    const byFramework = records.reduce<Record<string, { total: number; satisfied: number; partial: number; missing: number }>>((acc, item) => {
      const current = acc[item.framework] ?? { total: 0, satisfied: 0, partial: 0, missing: 0 };
      current.total += 1;
      if (item.status === 'SATISFIED') current.satisfied += 1;
      if (item.status === 'PARTIAL') current.partial += 1;
      if (item.status === 'MISSING') current.missing += 1;
      acc[item.framework] = current;
      return acc;
    }, {});

    return {
      generatedAt: new Date().toISOString(),
      recordCount: records.length,
      byFramework,
      records,
      manifest: records.map((record) => ({
        id: record.id,
        controlId: record.controlId,
        framework: record.framework,
        status: record.status,
        generatedAt: new Date(record.generatedAt).toISOString(),
      })),
    };
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

function mergeEvidence(primary: Evidence[], secondary: Evidence[]) {
  const map = new Map<string, Evidence>();
  for (const item of [...primary, ...secondary]) map.set(item.id, item);
  return Array.from(map.values()).sort((a, b) => b.generatedAt - a.generatedAt);
}
