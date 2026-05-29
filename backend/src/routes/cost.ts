import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { sql } from '../db/connection.js';
import { DurableJsonStore } from '../services/durable-json-store.js';
import type { CostSummary, DailySpend } from '../types/domain.js';

interface CostLedgerRecord {
  id: string;
  workflowId?: string;
  agentId?: string;
  model: string;
  provider: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  durationMs: number;
  domain?: string;
  tenantId: string;
  createdAt: string;
}

interface CostBudgetPolicy {
  monthlyBudgetUsd: number;
  warningThresholdPct: number;
  hardStopThresholdPct: number;
  updatedAt: string;
}

const costLedgerStore = new DurableJsonStore<CostLedgerRecord[]>('cost/ledger.json', []);
const budgetStore = new DurableJsonStore<CostBudgetPolicy>('cost/budget-policy.json', {
  monthlyBudgetUsd: 2500,
  warningThresholdPct: 70,
  hardStopThresholdPct: 95,
  updatedAt: new Date(0).toISOString(),
});

const ledgerSchema = z.object({
  workflowId: z.string().min(1).optional(),
  agentId: z.string().min(1).optional(),
  model: z.string().min(1),
  provider: z.string().min(1),
  tokensIn: z.number().int().min(0).default(0),
  tokensOut: z.number().int().min(0).default(0),
  cost: z.number().min(0),
  durationMs: z.number().int().min(0).default(0),
  domain: z.string().min(1).optional(),
  tenantId: z.string().min(1).default('tenant_default'),
  createdAt: z.string().datetime().optional(),
});

const budgetSchema = z.object({
  monthlyBudgetUsd: z.number().positive().max(10_000_000),
  warningThresholdPct: z.number().min(1).max(100).default(70),
  hardStopThresholdPct: z.number().min(1).max(100).default(95),
}).refine((value) => value.warningThresholdPct <= value.hardStopThresholdPct, {
  message: 'warningThresholdPct must be <= hardStopThresholdPct',
});

export async function registerCostRoutes(app: FastifyInstance) {
  app.get('/cost/summary', async (): Promise<CostSummary & { budgetPolicy: CostBudgetPolicy; source: 'database' | 'local-durable' }> => {
    try {
      return { ...(await databaseSummary()), budgetPolicy: budgetStore.read(), source: 'database' };
    } catch {
      return { ...localSummary(costLedgerStore.read()), budgetPolicy: budgetStore.read(), source: 'local-durable' };
    }
  });

  app.post('/cost/ledger', async (request, reply) => {
    const parsed = ledgerSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationError', message: 'Invalid cost ledger entry', issues: parsed.error.issues });
    }

    const record: CostLedgerRecord = {
      id: `cost_${nanoid(10)}`,
      ...parsed.data,
      createdAt: parsed.data.createdAt ?? new Date().toISOString(),
    };

    const localRecords = [record, ...costLedgerStore.read()].slice(0, 5000);
    costLedgerStore.write(localRecords);

    try {
      await sql`
        INSERT INTO cost_ledger (id, workflow_id, agent_id, model, provider, tokens_in, tokens_out, cost, duration_ms, domain, tenant_id, created_at)
        VALUES (
          ${record.id},
          ${record.workflowId ?? null},
          ${record.agentId ?? null},
          ${record.model},
          ${record.provider},
          ${record.tokensIn},
          ${record.tokensOut},
          ${record.cost},
          ${record.durationMs},
          ${record.domain ?? null},
          ${record.tenantId},
          ${record.createdAt}
        )
        ON CONFLICT (id) DO NOTHING
      `;
    } catch {
      // The durable ledger is authoritative when PostgreSQL is unavailable or
      // a workflow FK does not exist yet.
    }

    return reply.status(201).send({ record, summary: localSummary(localRecords) });
  });

  app.get('/cost/ledger', async () => ({ records: costLedgerStore.read() }));

  app.post('/cost/budget-policy', async (request, reply) => {
    const parsed = budgetSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationError', message: 'Invalid cost budget policy', issues: parsed.error.issues });
    }
    const policy: CostBudgetPolicy = { ...parsed.data, updatedAt: new Date().toISOString() };
    budgetStore.write(policy);
    return reply.status(201).send(policy);
  });

  app.post('/cost/export', async () => {
    const records = costLedgerStore.read();
    const summary = localSummary(records);
    const csv = [
      'id,createdAt,tenantId,workflowId,agentId,provider,model,tokensIn,tokensOut,cost,durationMs,domain',
      ...records.map((record) => [
        record.id,
        record.createdAt,
        record.tenantId,
        record.workflowId ?? '',
        record.agentId ?? '',
        record.provider,
        record.model,
        record.tokensIn,
        record.tokensOut,
        record.cost,
        record.durationMs,
        record.domain ?? '',
      ].map(csvCell).join(',')),
    ].join('\n');

    return {
      generatedAt: new Date().toISOString(),
      summary,
      budgetPolicy: budgetStore.read(),
      records,
      csv,
    };
  });
}

async function databaseSummary(): Promise<CostSummary> {
  const [totals] = await sql`
    SELECT COALESCE(SUM(cost), 0) as total_spend,
           COUNT(DISTINCT workflow_id) as workflow_count
    FROM cost_ledger
    WHERE created_at > NOW() - INTERVAL '7 days'
  `;

  const totalSpend = Number(totals.total_spend);
  const workflowCount = Number(totals.workflow_count) || 1;

  const [expensive] = await sql`
    SELECT COALESCE(w.name, cl.workflow_id, 'Unscoped workflow') as name, SUM(cl.cost) as total
    FROM cost_ledger cl
    LEFT JOIN workflows w ON w.id = cl.workflow_id
    WHERE cl.created_at > NOW() - INTERVAL '7 days'
    GROUP BY COALESCE(w.name, cl.workflow_id, 'Unscoped workflow')
    ORDER BY total DESC
    LIMIT 1
  `.catch(() => [{ name: 'N/A', total: 0 }]);

  const [topModelRow] = await sql`
    SELECT model, SUM(cost) as total
    FROM cost_ledger
    WHERE created_at > NOW() - INTERVAL '7 days'
    GROUP BY model
    ORDER BY total DESC
    LIMIT 1
  `.catch(() => [{ model: 'N/A', total: 0 }]);

  const dailyRows = await sql`
    SELECT DATE(created_at) as date, provider, SUM(cost) as spend
    FROM cost_ledger
    WHERE created_at > NOW() - INTERVAL '7 days'
    GROUP BY DATE(created_at), provider
    ORDER BY date
  `;

  const domainRows = await sql`
    SELECT domain, SUM(cost) as spend
    FROM cost_ledger
    WHERE created_at > NOW() - INTERVAL '7 days' AND domain IS NOT NULL
    GROUP BY domain
    ORDER BY spend DESC
  `;

  const modelRows = await sql`
    SELECT model, SUM(tokens_in + tokens_out) as tokens, SUM(cost) as cost
    FROM cost_ledger
    WHERE created_at > NOW() - INTERVAL '7 days'
    GROUP BY model
    ORDER BY cost DESC
  `;

  return {
    totalSpend,
    avgPerWorkflow: totalSpend / workflowCount,
    mostExpensive: (expensive?.name as string) || 'N/A',
    topModel: (topModelRow?.model as string) || 'N/A',
    dailySpend: dailyRowsToSpend(dailyRows as Array<Record<string, unknown>>),
    domainBreakdown: domainRows.map((r) => ({
      domain: r.domain as string,
      spend: Number(r.spend),
      color: domainColor(r.domain as string),
    })),
    modelBreakdown: modelRows.map((r) => ({
      model: r.model as string,
      tokens: Number(r.tokens),
      cost: Number(r.cost),
    })),
  };
}

function localSummary(records: CostLedgerRecord[]): CostSummary {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = records.filter((record) => new Date(record.createdAt).getTime() >= cutoff);
  const totalSpend = recent.reduce((total, record) => total + record.cost, 0);
  const workflowIds = new Set(recent.map((record) => record.workflowId ?? 'unscoped'));
  const modelTotals = groupBy(recent, (record) => record.model, (record) => record.cost);
  const workflowTotals = groupBy(recent, (record) => record.workflowId ?? 'Unscoped workflow', (record) => record.cost);
  const domainTotals = groupBy(recent.filter((record) => record.domain), (record) => record.domain ?? 'Unscoped', (record) => record.cost);
  const tokenTotals = new Map<string, { tokens: number; cost: number }>();
  for (const record of recent) {
    const current = tokenTotals.get(record.model) ?? { tokens: 0, cost: 0 };
    current.tokens += record.tokensIn + record.tokensOut;
    current.cost += record.cost;
    tokenTotals.set(record.model, current);
  }

  return {
    totalSpend,
    avgPerWorkflow: totalSpend / Math.max(workflowIds.size, 1),
    mostExpensive: topKey(workflowTotals) ?? 'N/A',
    topModel: topKey(modelTotals) ?? 'N/A',
    dailySpend: localDailySpend(recent),
    domainBreakdown: Array.from(domainTotals.entries()).map(([domain, spend]) => ({ domain, spend, color: domainColor(domain) })),
    modelBreakdown: Array.from(tokenTotals.entries())
      .map(([model, value]) => ({ model, tokens: value.tokens, cost: value.cost }))
      .sort((a, b) => b.cost - a.cost),
  };
}

function dailyRowsToSpend(rows: Array<Record<string, unknown>>): DailySpend[] {
  const dailyMap = new Map<string, DailySpend>();
  for (const row of rows) {
    const dateStr = new Date(row.date as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!dailyMap.has(dateStr)) dailyMap.set(dateStr, { date: dateStr, anthropic: 0, openai: 0, gemini: 0, local: 0 });
    const entry = dailyMap.get(dateStr)!;
    assignProviderSpend(entry, String(row.provider), Number(row.spend));
  }
  return Array.from(dailyMap.values());
}

function localDailySpend(records: CostLedgerRecord[]): DailySpend[] {
  const dailyMap = new Map<string, DailySpend>();
  for (const record of records) {
    const date = new Date(record.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!dailyMap.has(date)) dailyMap.set(date, { date, anthropic: 0, openai: 0, gemini: 0, local: 0 });
    assignProviderSpend(dailyMap.get(date)!, record.provider, record.cost);
  }
  return Array.from(dailyMap.values()).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

function assignProviderSpend(entry: DailySpend, provider: string, spend: number) {
  const key: keyof Omit<DailySpend, 'date'> = provider.toLowerCase().includes('anthropic')
    ? 'anthropic'
    : provider.toLowerCase().includes('openai')
      ? 'openai'
      : provider.toLowerCase().includes('gemini') || provider.toLowerCase().includes('google')
        ? 'gemini'
        : 'local';
  entry[key] += spend;
}

function groupBy(records: CostLedgerRecord[], keyFn: (record: CostLedgerRecord) => string, valueFn: (record: CostLedgerRecord) => number) {
  const map = new Map<string, number>();
  for (const record of records) map.set(keyFn(record), (map.get(keyFn(record)) ?? 0) + valueFn(record));
  return map;
}

function topKey(map: Map<string, number>) {
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
}

function domainColor(domain: string) {
  const domainColors: Record<string, string> = {
    Engineering: '#0A84FF',
    Compliance: '#30D158',
    Analytics: '#BF5AF2',
    Documentation: '#FF9F0A',
    Security: '#FF453A',
    Infrastructure: '#64D2FF',
  };
  return domainColors[domain] || '#8E8E93';
}

function csvCell(value: unknown) {
  return JSON.stringify(String(value ?? ''));
}
