import { useState } from "react";
import { TrendingDown, Download, RefreshCw, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Card, CardHeader, PageHeader, Kpi, Button } from "../components/ui/primitives";
import { useCost } from "../lib/queries";

export function Cost() {
  const { data: costData, isLoading, isError, error, refetch } = useCost();
  const [range, setRange] = useState("7d");

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Cost" description="Token spend, model breakdown, and per-workflow economics" />
        <Card>
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw size={24} className="text-s-muted animate-spin" />
              <span className="text-s-secondary text-[13px]">Loading cost data...</span>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <PageHeader title="Cost" description="Token spend, model breakdown, and per-workflow economics" />
        <Card>
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 max-w-md text-center">
              <AlertCircle size={24} className="text-s-critical" />
              <span className="text-s-primary text-sm font-medium">Failed to load cost data</span>
              <span className="text-s-secondary text-[13px]">
                {error instanceof Error ? error.message : "An unexpected error occurred"}
              </span>
              <Button variant="primary" size="sm" icon={<RefreshCw size={13} />} onClick={() => refetch()}>Retry</Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const totalSpend = costData?.totalSpend ?? 0;
  const avgPerWorkflow = costData?.avgPerWorkflow ?? 0;
  const mostExpensive = costData?.mostExpensive ?? "—";
  const topModel = costData?.topModel ?? "—";
  const dailySpend = costData?.dailySpend ?? [];
  const domainBreakdown = costData?.domainBreakdown ?? [];
  const modelBreakdown = costData?.modelBreakdown ?? [];

  return (
    <div>
      <PageHeader
        title="Cost"
        description="Token spend, model breakdown, and per-workflow economics"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Download size={13} />}>Export</Button>
            <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-s-subtle border border-s-border">
              {["24h", "7d", "30d", "90d"].map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    range === r ? "bg-s-surface text-s-primary shadow-sm" : "text-s-secondary hover:text-s-primary"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Kpi label="Total Spend" value={`$${totalSpend.toLocaleString()}`} trend="down" delta="-12% vs last period" hint={`Range: ${range}`} />
        <Kpi label="Avg / Workflow" value={`$${avgPerWorkflow.toFixed(2)}`} hint="Across all workflows" />
        <Kpi label="Most Expensive" value={mostExpensive} hint="Single workflow" />
        <Kpi label="Top Model" value={topModel} hint="By total spend" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">
        <Card className="lg:col-span-3 overflow-hidden">
          <CardHeader title="Daily Spend by Provider" subtitle={`Last ${range}`} />
          <div className="px-5 pb-5 pt-2 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySpend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--s-border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'var(--s-text-muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--s-border)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--s-text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
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
                  formatter={(value: number, name: string) => [`$${value}`, name.charAt(0).toUpperCase() + name.slice(1)]}
                />
                <Bar dataKey="anthropic" stackId="a" fill="#00C8FF" radius={[0, 0, 0, 0]} name="Anthropic" />
                <Bar dataKey="openai" stackId="a" fill="#10A37F" name="OpenAI" />
                <Bar dataKey="gemini" stackId="a" fill="#8B5CF6" name="Gemini" />
                <Bar dataKey="local" stackId="a" fill="#F5A623" radius={[3, 3, 0, 0]} name="Local" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader title="Spend by Domain" subtitle="Distribution" />
          <div className="px-5 pb-5 pt-2 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={domainBreakdown}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="spend"
                  nameKey="domain"
                >
                  {domainBreakdown.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--s-bg-elevated)',
                    border: '1px solid var(--s-border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Spend']}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span className="text-s-secondary text-[11px]">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Model Breakdown"
          subtitle="Token usage and cost by model"
          action={<TrendingDown size={14} className="text-s-success" />}
        />
        <div className="overflow-x-auto">
          <table className="w-full table-fixed min-w-[600px]">
            <colgroup>
              <col className="w-[180px]" />
              <col className="w-[120px]" />
              <col className="w-[100px]" />
              <col className="w-[80px]" />
              <col />
            </colgroup>
            <thead>
              <tr className="text-left border-b border-s-border">
                <th className="px-5 py-2.5 label-mono">Model</th>
                <th className="px-5 py-2.5 label-mono">Tokens</th>
                <th className="px-5 py-2.5 label-mono">Cost</th>
                <th className="px-5 py-2.5 label-mono">Share</th>
                <th className="px-5 py-2.5 label-mono">Usage</th>
              </tr>
            </thead>
            <tbody>
              {modelBreakdown.map((m) => {
                const share = totalSpend > 0 ? (m.cost / totalSpend * 100) : 0;
                return (
                  <tr key={m.model} className="border-b border-s-border last:border-0 hover:bg-s-hover">
                    <td className="px-5 py-3">
                      <span className="text-s-primary text-[13px] font-medium">{m.model}</span>
                    </td>
                    <td className="px-5 py-3 font-mono text-s-secondary text-xs">
                      {formatTokens(m.tokens)}
                    </td>
                    <td className="px-5 py-3 font-mono text-s-primary text-xs">
                      ${m.cost.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 font-mono text-s-secondary text-xs">
                      {share.toFixed(1)}%
                    </td>
                    <td className="px-5 py-3">
                      <div className="w-full h-1.5 bg-s-subtle rounded-full overflow-hidden">
                        <div className="h-full bg-s-brand rounded-full" style={{ width: `${share}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}
