import type { FastifyInstance, FastifyRequest } from 'fastify';
import { sql } from '../db/connection.js';
import type { MemoryRecord } from '../types/domain.js';

export async function registerMemoryRoutes(app: FastifyInstance) {
  app.get('/memory', async (req: FastifyRequest<{ Querystring: { q?: string } }>) => {
    const query = req.query.q;

    let rows;
    if (query) {
      const pattern = `%${query}%`;
      rows = await sql`
        SELECT id, type, content, source, confidence, tags,
               access_count, last_accessed, related_workflows, created_at
        FROM memory_records
        WHERE content ILIKE ${pattern}
           OR source ILIKE ${pattern}
           OR ${query} = ANY(tags)
        ORDER BY last_accessed DESC
        LIMIT 50
      `;
    } else {
      rows = await sql`
        SELECT id, type, content, source, confidence, tags,
               access_count, last_accessed, related_workflows, created_at
        FROM memory_records
        ORDER BY last_accessed DESC
        LIMIT 100
      `;
    }

    return rows.map(mapMemory);
  });
}

function mapMemory(row: Record<string, unknown>): MemoryRecord {
  return {
    id: row.id as string,
    type: row.type as MemoryRecord['type'],
    content: row.content as string,
    source: row.source as string,
    confidence: Number(row.confidence),
    tags: row.tags as string[],
    accessCount: Number(row.access_count),
    lastAccessed: Number(row.last_accessed),
    relatedWorkflows: row.related_workflows as string[],
    createdAt: Number(row.created_at),
  };
}
