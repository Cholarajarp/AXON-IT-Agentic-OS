import type { FastifyInstance } from 'fastify';
import { sql } from '../db/connection.js';
import type { CostSummary, DailySpend, DomainCost, ModelCost } from '../types/domain.js';

export async function registerCostRoutes(app: FastifyInstance) {
  app.get('/cost/summary', async (): Promise<CostSummary> => {
    // Total spend
    const [totals] = await sql`
      SELECT COALESCE(SUM(cost), 0) as total_spend,
             COUNT(DISTINCT workflow_id) as workflow_count
      FROM cost_ledger
      WHERE created_at > NOW() - INTERVAL '7 days'
    `;

    const totalSpend = Number(totals.total_spend);
    const workflowCount = Number(totals.workflow_count) || 1;

    // Most expensive workflow
    const [expensive] = await sql`
      SELECT w.name, SUM(cl.cost) as total
      FROM cost_ledger cl
      JOIN workflows w ON w.id = cl.workflow_id
      WHERE cl.created_at > NOW() - INTERVAL '7 days'
      GROUP BY w.name
      ORDER BY total DESC
      LIMIT 1
    `.catch(() => [{ name: 'N/A', total: 0 }]);

    // Top model by spend
    const [topModelRow] = await sql`
      SELECT model, SUM(cost) as total
      FROM cost_ledger
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY model
      ORDER BY total DESC
      LIMIT 1
    `.catch(() => [{ model: 'N/A', total: 0 }]);

    // Daily spend by provider (last 7 days)
    const dailyRows = await sql`
      SELECT DATE(created_at) as date, provider, SUM(cost) as spend
      FROM cost_ledger
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at), provider
      ORDER BY date
    `;

    const dailyMap = new Map<string, DailySpend>();
    for (const row of dailyRows) {
      const dateStr = new Date(row.date as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, { date: dateStr, anthropic: 0, openai: 0, gemini: 0, local: 0 });
      }
      const entry = dailyMap.get(dateStr)!;
      const provider = row.provider as keyof Omit<DailySpend, 'date'>;
      if (provider in entry) {
        entry[provider] = Number(row.spend);
      }
    }

    // Domain breakdown
    const domainRows = await sql`
      SELECT domain, SUM(cost) as spend
      FROM cost_ledger
      WHERE created_at > NOW() - INTERVAL '7 days' AND domain IS NOT NULL
      GROUP BY domain
      ORDER BY spend DESC
    `;

    const domainColors: Record<string, string> = {
      Engineering: '#00C8FF',
      Compliance: '#00D084',
      Analytics: '#8B5CF6',
      Documentation: '#F5A623',
      Security: '#FF4444',
      Infrastructure: '#7B8FF0',
    };

    const domainBreakdown: DomainCost[] = domainRows.map((r) => ({
      domain: r.domain as string,
      spend: Number(r.spend),
      color: domainColors[r.domain as string] || '#555870',
    }));

    // Model breakdown
    const modelRows = await sql`
      SELECT model, SUM(tokens_in + tokens_out) as tokens, SUM(cost) as cost
      FROM cost_ledger
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY model
      ORDER BY cost DESC
    `;

    const modelBreakdown: ModelCost[] = modelRows.map((r) => ({
      model: r.model as string,
      tokens: Number(r.tokens),
      cost: Number(r.cost),
    }));

    return {
      totalSpend,
      avgPerWorkflow: totalSpend / workflowCount,
      mostExpensive: (expensive?.name as string) || 'N/A',
      topModel: (topModelRow?.model as string) || 'N/A',
      dailySpend: Array.from(dailyMap.values()),
      domainBreakdown,
      modelBreakdown,
    };
  });
}
