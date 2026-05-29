import { TrendingUp, TrendingDown, Shield, AlertTriangle } from "lucide-react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from "recharts";
import { Card, CardHeader, EmptyState, PageHeader, Kpi, SeverityBadge } from "../components/ui/primitives";
import { useExecutive } from "../lib/queries";

export function Executive() {
  const { data: metrics } = useExecutive();

  const featuresDelivered = metrics?.featuresDelivered ?? 0;
  const costVsBaseline = metrics?.costVsBaseline ?? 0;
  const complianceScore = metrics?.complianceScore ?? 0;
  const autoResolved = metrics?.autoResolved ?? 0;
  const weeklyVelocity = metrics?.weeklyVelocity ?? [];
  const risks = metrics?.risks ?? [];
  const insight = metrics?.insight;
  const lastFour = weeklyVelocity.slice(-4);
  const previousFour = weeklyVelocity.slice(-8, -4);
  const recentFeatures = lastFour.reduce((total, item) => total + item.features, 0);
  const previousFeatures = previousFour.reduce((total, item) => total + item.features, 0);
  const velocityDelta = previousFeatures > 0 ? Math.round(((recentFeatures - previousFeatures) / previousFeatures) * 100) : 0;
  const automatedRecent = lastFour.reduce((total, item) => total + item.automated, 0);
  const automationRate = recentFeatures > 0 ? Math.round((automatedRecent / recentFeatures) * 100) : 0;

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
          trend={velocityDelta >= 0 ? "up" : "down"}
          delta={`${velocityDelta >= 0 ? "+" : ""}${velocityDelta}% vs prior 4 weeks`}
          hint="Completed workflows"
        />
        <Kpi
          label="Cost vs Baseline"
          value={`${costVsBaseline}%`}
          trend={costVsBaseline <= 0 ? "down" : "up"}
          delta={costVsBaseline <= 0 ? "Below previous 7 days" : "Above previous 7 days"}
          hint="Model and workflow spend"
        />
        <Kpi
          label="Compliance Score"
          value={`${complianceScore}%`}
          trend={complianceScore >= 90 ? "up" : "down"}
          delta={complianceScore >= 90 ? "Evidence healthy" : "Evidence gaps open"}
          hint="Across all frameworks"
        />
        <Kpi
          label="Auto-Resolved"
          value={autoResolved.toString()}
          trend={automationRate >= 50 ? "up" : "down"}
          delta={`${automationRate}% recent automation`}
          hint="Resolved incidents"
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
            {risks.length === 0 && (
              <EmptyState
                icon={<Shield size={18} />}
                title="No executive risks"
                description="Active incidents, missing evidence, and cost variance risks will appear here."
              />
            )}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="Weekly Insight" subtitle="Generated by Executive Insight Agent" />
        <div className="p-5">
          <div className="p-4 rounded-lg bg-s-base border border-s-border">
            <div className="text-s-primary text-[13px] leading-relaxed">
              <p className="mb-3"><strong>{insight?.headline ?? "No executive signal yet"}</strong></p>
              <p className="mb-3">{insight?.summary ?? "Submit delivery workflows and collect evidence to generate operating insight."}</p>
              <p className="mb-3"><strong>Wins:</strong> {(insight?.wins ?? ["No wins recorded yet."]).join(" · ")}</p>
              <p><strong>Attention:</strong> {(insight?.attention ?? ["No attention items recorded yet."]).join(" · ")}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {(insight?.signals ?? []).map((signal) => (
              <span key={signal.label} className={`flex items-center gap-1 text-[11px] ${signalClass(signal.tone)}`}>
                {signalIcon(signal.tone)} {signal.label} {signal.value}
              </span>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function signalClass(tone: 'success' | 'warning' | 'critical' | 'neutral') {
  if (tone === 'success') return 'text-s-success';
  if (tone === 'warning') return 'text-s-warning';
  if (tone === 'critical') return 'text-s-critical';
  return 'text-s-muted';
}

function signalIcon(tone: 'success' | 'warning' | 'critical' | 'neutral') {
  if (tone === 'critical' || tone === 'warning') return <AlertTriangle size={12} />;
  if (tone === 'success') return <TrendingUp size={12} />;
  return <TrendingDown size={12} />;
}
