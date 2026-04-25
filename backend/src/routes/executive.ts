import type { FastifyInstance } from 'fastify';
import { sql } from '../db/connection.js';
import type { ExecutiveMetrics } from '../types/domain.js';

export async function registerExecutiveRoutes(app: FastifyInstance) {
  app.get('/executive/summary', async (): Promise<ExecutiveMetrics> => {
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

    // Weekly velocity (synthetic — based on real workflow data)
    const weeklyVelocity = generateVelocityData(Number(workflowStats.completed));

    // Risk register
    const risks = [
      { id: 'risk_001', title: 'Payment gateway memory leak recurring', severity: 'HIGH' as const, owner: 'SRE Team', status: 'Mitigating' },
      { id: 'risk_002', title: 'SOC 2 CC8.1 gap — change management controls', severity: 'HIGH' as const, owner: 'Compliance', status: 'In Progress' },
      { id: 'risk_003', title: 'Vendor lock-in risk with primary LLM provider', severity: 'MEDIUM' as const, owner: 'Platform', status: 'Monitoring' },
      { id: 'risk_004', title: 'SEBI CSCRF quarterly testing deadline approaching', severity: 'MEDIUM' as const, owner: 'Security', status: 'In Progress' },
    ];

    return {
      featuresDelivered: Number(workflowStats.completed),
      costVsBaseline,
      complianceScore,
      autoResolved: Number(incidentStats.resolved),
      weeklyVelocity,
      risks,
    };
  });
}

function generateVelocityData(completed: number): { week: string; features: number; automated: number }[] {
  const weeks = 12;
  const data = [];
  for (let i = weeks; i >= 1; i--) {
    const base = Math.max(1, Math.floor(completed / weeks) + Math.floor(Math.random() * 3));
    const features = base + Math.floor(i * 0.3);
    data.push({
      week: `W${weeks - i + 1}`,
      features,
      automated: Math.max(1, features - Math.floor(Math.random() * 2)),
    });
  }
  return data;
}
