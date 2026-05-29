import type { FastifyInstance } from 'fastify';
import { sql } from '../db/connection.js';
import type { ExecutiveInsight, ExecutiveMetrics, Risk, WeeklyVelocity } from '../types/domain.js';

export async function registerExecutiveRoutes(app: FastifyInstance) {
  app.get('/executive/summary', async (): Promise<ExecutiveMetrics> => {
    try {
      return await loadExecutiveMetricsFromDatabase();
    } catch (error) {
      app.log.warn({ error }, 'Executive summary database metrics unavailable; returning empty operating baseline');
      return buildEmptyExecutiveMetrics();
    }
  });
}

async function loadExecutiveMetricsFromDatabase(): Promise<ExecutiveMetrics> {
  // Features delivered (completed workflows)
  const [workflowStats] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE state = 'COMPLETE') as completed,
        COUNT(*) as total
      FROM workflows
    `;

  // Auto-resolved incidents
  const [incidentStats] = await sql`
      SELECT COUNT(*) as resolved
      FROM incidents
      WHERE state IN ('RESOLVED', 'POST_MORTEM')
    `;

  // Compliance score (evidence satisfaction rate)
  const [evidenceStats] = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'SATISFIED') as satisfied,
        COUNT(*) FILTER (WHERE status = 'PARTIAL') as partial
      FROM evidence
    `;

  const totalEvidence = Number(evidenceStats.total) || 1;
  const complianceScore = Math.round(
    ((Number(evidenceStats.satisfied) + Number(evidenceStats.partial) * 0.5) / totalEvidence) * 100
  );

  // Cost vs baseline (simplified — compare last 7d to previous 7d)
  const [costComparison] = await sql`
      SELECT
        COALESCE(SUM(cost) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'), 0) as current_period,
        COALESCE(SUM(cost) FILTER (WHERE created_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'), 0) as previous_period
      FROM cost_ledger
    `;

  const currentCost = Number(costComparison.current_period);
  const previousCost = Number(costComparison.previous_period) || currentCost;
  const costVsBaseline = previousCost > 0 ? Math.round(((currentCost - previousCost) / previousCost) * 100) : 0;

  const weeklyVelocityRows = await sql`
      WITH weeks AS (
        SELECT generate_series(
          date_trunc('week', NOW()) - INTERVAL '11 weeks',
          date_trunc('week', NOW()),
          INTERVAL '1 week'
        ) AS week_start
      )
      SELECT
        to_char(weeks.week_start, '"W"IW') AS week,
        COUNT(workflows.id) FILTER (WHERE workflows.state = 'COMPLETE') AS features,
        COUNT(workflows.id) FILTER (
          WHERE workflows.state = 'COMPLETE'
            AND COALESCE(workflows.agent_flow, '') NOT ILIKE '%manual%'
            AND COALESCE(workflows.agent, '') NOT ILIKE '%human%'
        ) AS automated
      FROM weeks
      LEFT JOIN workflows
        ON to_timestamp(workflows.started_at / 1000.0) >= weeks.week_start
       AND to_timestamp(workflows.started_at / 1000.0) < weeks.week_start + INTERVAL '1 week'
      GROUP BY weeks.week_start
      ORDER BY weeks.week_start ASC
    `;
  const weeklyVelocity = weeklyVelocityRows.map((row) => ({
    week: String(row.week),
    features: Number(row.features),
    automated: Number(row.automated),
  }));

  const incidentRiskRows = await sql`
      SELECT id, severity, title, state
      FROM incidents
      WHERE state IN ('ACTIVE', 'REMEDIATING')
      ORDER BY
        CASE severity WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
        started_at DESC
      LIMIT 4
    `;
  const evidenceRiskRows = await sql`
      SELECT id, framework, control_id, description, status
      FROM evidence
      WHERE status IN ('MISSING', 'PARTIAL')
      ORDER BY CASE status WHEN 'MISSING' THEN 0 ELSE 1 END, generated_at DESC
      LIMIT 4
    `;
  const risks = buildRisks(incidentRiskRows, evidenceRiskRows, costVsBaseline);
  const insight = buildInsight({
    featuresDelivered: Number(workflowStats.completed),
    totalWorkflows: Number(workflowStats.total),
    costVsBaseline,
    complianceScore,
    autoResolved: Number(incidentStats.resolved),
    weeklyVelocity,
    risks,
  });

  return {
    featuresDelivered: Number(workflowStats.completed),
    costVsBaseline,
    complianceScore,
    autoResolved: Number(incidentStats.resolved),
    weeklyVelocity,
    risks,
    insight,
  };
}

function buildRisks(
  incidentRows: Array<Record<string, unknown>>,
  evidenceRows: Array<Record<string, unknown>>,
  costVsBaseline: number,
): Risk[] {
  const incidentRisks = incidentRows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    severity: mapIncidentSeverity(String(row.severity)),
    owner: 'SRE',
    status: String(row.state).replace(/_/g, ' '),
  }));
  const evidenceRisks = evidenceRows.map((row) => ({
    id: String(row.id),
    title: `${String(row.framework)} ${String(row.control_id)} evidence ${String(row.status).toLowerCase()}`,
    severity: String(row.status) === 'MISSING' ? 'HIGH' as const : 'MEDIUM' as const,
    owner: 'Compliance',
    status: String(row.status).replace(/_/g, ' '),
  }));
  const costRisk: Risk[] = costVsBaseline > 20 ? [{
    id: 'risk_cost_variance',
    title: `Model and workflow spend is ${costVsBaseline}% above the previous 7-day baseline`,
    severity: costVsBaseline > 50 ? 'HIGH' : 'MEDIUM',
    owner: 'FinOps',
    status: 'Reviewing',
  }] : [];
  return [...incidentRisks, ...evidenceRisks, ...costRisk].slice(0, 6);
}

function mapIncidentSeverity(severity: string): Risk['severity'] {
  if (severity === 'P0') return 'CRITICAL';
  if (severity === 'P1') return 'HIGH';
  if (severity === 'P2') return 'MEDIUM';
  return 'LOW';
}

function buildInsight(input: {
  featuresDelivered: number;
  totalWorkflows: number;
  costVsBaseline: number;
  complianceScore: number;
  autoResolved: number;
  weeklyVelocity: WeeklyVelocity[];
  risks: Risk[];
}): ExecutiveInsight {
  const lastFour = input.weeklyVelocity.slice(-4);
  const previousFour = input.weeklyVelocity.slice(-8, -4);
  const recentFeatures = sum(lastFour, 'features');
  const previousFeatures = sum(previousFour, 'features');
  const recentAutomated = sum(lastFour, 'automated');
  const automationRate = recentFeatures > 0 ? Math.round((recentAutomated / recentFeatures) * 100) : 0;
  const velocityDelta = previousFeatures > 0 ? Math.round(((recentFeatures - previousFeatures) / previousFeatures) * 100) : 0;
  const criticalRisks = input.risks.filter((risk) => risk.severity === 'CRITICAL' || risk.severity === 'HIGH').length;

  return {
    headline: input.totalWorkflows > 0
      ? `${input.featuresDelivered} completed workflow(s), ${automationRate}% automated delivery in the last 4 weeks`
      : 'No completed workflow data yet; submit real delivery goals to populate executive insight',
    summary: [
      `Delivery velocity ${velocityDelta >= 0 ? 'improved' : 'declined'} ${Math.abs(velocityDelta)}% versus the prior 4-week window.`,
      `Compliance evidence is ${input.complianceScore}% satisfied and cost variance is ${input.costVsBaseline}%.`,
      criticalRisks > 0 ? `${criticalRisks} high-priority risk(s) need executive attention.` : 'No high-priority executive risks are currently open.',
    ].join(' '),
    wins: [
      `${recentFeatures} accepted outcome(s) in the last 4 weeks`,
      `${recentAutomated} outcome(s) routed through agentic automation`,
      `${input.autoResolved} incident(s) resolved or moved to post-mortem`,
    ],
    attention: input.risks.length
      ? input.risks.slice(0, 3).map((risk) => `${risk.severity}: ${risk.title}`)
      : ['No active incident, compliance, or cost risks were found in the operating data.'],
    signals: [
      { label: 'Velocity delta', value: `${velocityDelta}%`, tone: velocityDelta >= 0 ? 'success' : 'warning' },
      { label: 'Automation rate', value: `${automationRate}%`, tone: automationRate >= 70 ? 'success' : automationRate >= 30 ? 'neutral' : 'warning' },
      { label: 'Compliance', value: `${input.complianceScore}%`, tone: input.complianceScore >= 90 ? 'success' : input.complianceScore >= 70 ? 'warning' : 'critical' },
      { label: 'Open high risks', value: String(criticalRisks), tone: criticalRisks === 0 ? 'success' : criticalRisks > 2 ? 'critical' : 'warning' },
    ],
  };
}

function sum(rows: WeeklyVelocity[], key: keyof Pick<WeeklyVelocity, 'features' | 'automated'>) {
  return rows.reduce((total, row) => total + row[key], 0);
}

function buildEmptyExecutiveMetrics(): ExecutiveMetrics {
  const weeklyVelocity = buildEmptyWeeklyVelocity();
  const risks: Risk[] = [];
  return {
    featuresDelivered: 0,
    costVsBaseline: 0,
    complianceScore: 0,
    autoResolved: 0,
    weeklyVelocity,
    risks,
    insight: buildInsight({
      featuresDelivered: 0,
      totalWorkflows: 0,
      costVsBaseline: 0,
      complianceScore: 0,
      autoResolved: 0,
      weeklyVelocity,
      risks,
    }),
  };
}

function buildEmptyWeeklyVelocity(referenceDate = new Date()): WeeklyVelocity[] {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(referenceDate);
    date.setDate(referenceDate.getDate() - (11 - index) * 7);
    return { week: isoWeekLabel(date), features: 0, automated: 0 };
  });
}

function isoWeekLabel(date: Date): string {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `W${String(week).padStart(2, '0')}`;
}
