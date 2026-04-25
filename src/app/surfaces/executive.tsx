import { TrendingUp, TrendingDown, Shield, AlertTriangle } from "lucide-react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from "recharts";
import { Card, CardHeader, PageHeader, Kpi, SeverityBadge } from "../components/ui/primitives";
import { useExecutive } from "../lib/queries";

export function Executive() {
  const { data: metrics } = useExecutive();

  const featuresDelivered = metrics?.featuresDelivered ?? 0;
  const costVsBaseline = metrics?.costVsBaseline ?? 0;
  const complianceScore = metrics?.complianceScore ?? 0;
  const autoResolved = metrics?.autoResolved ?? 0;
  const weeklyVelocity = metrics?.weeklyVelocity ?? [];
  const risks = metrics?.risks ?? [];

  return (
    <div>
      <PageHeader
        title="Executive Dashboard"
        description="Business outcomes, delivery posture, and strategic insights"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Kpi
          label="Features Delivered"
          value={featuresDelivered.toString()}
          trend="up"
          delta="+8 vs last quarter"
          hint="This quarter"
        />
        <Kpi
          label="Cost vs Baseline"
          value={`${costVsBaseline}%`}
          trend="down"
          delta="$24K saved"
          hint="Manual baseline"
        />
        <Kpi
          label="Compliance Score"
          value={`${complianceScore}%`}
          trend="up"
          delta="+3% this month"
          hint="Across all frameworks"
        />
        <Kpi
          label="Auto-Resolved"
          value={autoResolved.toString()}
          trend="up"
          delta="72% auto-rate"
          hint="Incidents this month"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader title="Delivery Velocity" subtitle="Features delivered per week — total vs automated" />
          <div className="px-5 pb-5 pt-2 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyVelocity} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorFeatures" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--s-brand)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--s-brand)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorAutomated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--s-success)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--s-success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--s-border)" vertical={false} />
                <XAxis
                  dataKey="week"
                  tick={{ fill: 'var(--s-text-muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--s-border)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--s-text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--s-bg-elevated)',
                    border: '1px solid var(--s-border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                  labelStyle={{ color: 'var(--s-text-primary)', fontWeight: 500 }}
                />
                <Area
                  type="monotone"
                  dataKey="features"
                  stroke="var(--s-brand)"
                  strokeWidth={2}
                  fill="url(#colorFeatures)"
                  name="Total Features"
                />
                <Area
                  type="monotone"
                  dataKey="automated"
                  stroke="var(--s-success)"
                  strokeWidth={2}
                  fill="url(#colorAutomated)"
                  name="Automated"
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  iconType="line"
                  formatter={(value) => <span className="text-s-secondary text-[11px]">{value}</span>}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Risk Register" subtitle={`${risks.length} open risks`} />
          <div className="divide-y divide-s-border">
            {risks.map((risk) => (
              <div key={risk.id} className="px-5 py-3">
                <div className="flex items-center gap-2 mb-1 min-w-0">
                  <SeverityBadge level={risk.severity} />
                  <span className="text-s-primary text-xs font-medium truncate">{risk.title}</span>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-s-muted text-[10.5px]">{risk.owner}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] border border-s-border ${
                    risk.status === "Mitigating" ? "text-s-warning" : risk.status === "In Progress" ? "text-s-brand" : "text-s-muted"
                  }`}>
                    {risk.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="Weekly Insight" subtitle="Generated by Executive Insight Agent" />
        <div className="p-5">
          <div className="p-4 rounded-lg bg-s-base border border-s-border">
            <div className="text-s-primary text-[13px] leading-relaxed">
              <p className="mb-3">
                <strong>Week 12 Summary:</strong> Delivery velocity reached 7 features/week (6 automated) — a 40% increase over W1 baseline.
                The agent fleet processed 34 goals end-to-end this quarter with a 94% compliance score.
              </p>
              <p className="mb-3">
                <strong>Key wins:</strong> KYC automation reduced onboarding time from 3 days to 4 hours. Auto-remediation resolved 72% of P1/P2 incidents
                without human intervention, improving MTTR from 45min to 12min.
              </p>
              <p>
                <strong>Attention needed:</strong> Payment gateway memory leak (P0) is recurring — root cause analysis suggests connection pool exhaustion
                under peak load. Infrastructure team has been notified. SOC 2 CC8.1 gap requires additional change management controls before next audit window.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <span className="flex items-center gap-1 text-s-success text-[11px]">
              <TrendingUp size={12} /> Velocity +40%
            </span>
            <span className="flex items-center gap-1 text-s-success text-[11px]">
              <TrendingDown size={12} /> Cost -28%
            </span>
            <span className="flex items-center gap-1 text-s-success text-[11px]">
              <Shield size={12} /> Compliance 94%
            </span>
            <span className="flex items-center gap-1 text-s-warning text-[11px]">
              <AlertTriangle size={12} /> 1 P0 open
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
