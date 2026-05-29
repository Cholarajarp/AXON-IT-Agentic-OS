import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { TrendingDown, Download, RefreshCw, AlertCircle, PlusCircle, Save } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Card, CardHeader, PageHeader, Kpi, Button, EmptyState } from "../components/ui/primitives";
import { useCost, useExportCost, useRecordCost, useUpdateCostBudgetPolicy } from "../lib/queries";
import { useToast } from "../lib/toast";

const inputCls = "w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[12.5px] text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand";

export function Cost() {
  const { data: costData, isLoading, isError, error, refetch } = useCost();
  const recordCost = useRecordCost();
  const updateBudget = useUpdateCostBudgetPolicy();
  const exportCost = useExportCost();
  const { toast } = useToast();
  const [range, setRange] = useState("7d");
  const [ledger, setLedger] = useState({
    provider: "localMock",
    model: "mock-small",
    domain: "Engineering",
    workflowId: "wf_finops_manual",
    agentId: "FinOpsAgent",
    tokensIn: "1200",
    tokensOut: "350",
    cost: "0.00",
    durationMs: "420",
  });
  const [budget, setBudget] = useState({
    monthlyBudgetUsd: "2500",
    warningThresholdPct: "70",
    hardStopThresholdPct: "95",
  });

  useEffect(() => {
    if (!costData?.budgetPolicy) return;
    setBudget({
      monthlyBudgetUsd: String(costData.budgetPolicy.monthlyBudgetUsd),
      warningThresholdPct: String(costData.budgetPolicy.warningThresholdPct),
      hardStopThresholdPct: String(costData.budgetPolicy.hardStopThresholdPct),
    });
  }, [costData?.budgetPolicy]);

  const handleExport = async () => {
    try {
      const bundle = await exportCost.mutateAsync();
      await navigator.clipboard.writeText(bundle.csv);
      toast({ kind: "success", title: "Cost package exported", description: `${bundle.records.length} ledger rows copied as CSV.` });
    } catch (err) {
      toast({ kind: "error", title: "Export failed", description: err instanceof Error ? err.message : "Unable to export cost package." });
    }
  };

  const handleRecordCost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cost = Number(ledger.cost);
    if (!Number.isFinite(cost) || cost < 0) {
      toast({ kind: "warning", title: "Invalid cost", description: "Enter a non-negative USD amount." });
      return;
    }

    try {
      const result = await recordCost.mutateAsync({
        provider: ledger.provider,
        model: ledger.model,
        domain: ledger.domain || undefined,
        workflowId: ledger.workflowId || undefined,
        agentId: ledger.agentId || undefined,
        tokensIn: Math.max(0, Math.floor(Number(ledger.tokensIn) || 0)),
        tokensOut: Math.max(0, Math.floor(Number(ledger.tokensOut) || 0)),
        cost,
        durationMs: Math.max(0, Math.floor(Number(ledger.durationMs) || 0)),
      });
      toast({ kind: "success", title: "Spend recorded", description: `${result.record.provider}/${result.record.model} added to the durable ledger.` });
    } catch (err) {
      toast({ kind: "error", title: "Record failed", description: err instanceof Error ? err.message : "Unable to record cost." });
    }
  };

  const handleSaveBudget = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const policy = await updateBudget.mutateAsync({
        monthlyBudgetUsd: Number(budget.monthlyBudgetUsd),
        warningThresholdPct: Number(budget.warningThresholdPct),
        hardStopThresholdPct: Number(budget.hardStopThresholdPct),
      });
      toast({ kind: "success", title: "Budget policy saved", description: `$${policy.monthlyBudgetUsd.toLocaleString()} monthly cap is active.` });
    } catch (err) {
      toast({ kind: "error", title: "Budget save failed", description: err instanceof Error ? err.message : "Unable to save budget policy." });
    }
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Cost" description="Token spend, model breakdown, and per-workflow economics" />
        <Card>
          <div className="p-5 space-y-3">
            <div className="h-6 w-48 rounded bg-s-subtle" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-24 rounded-md bg-s-subtle border border-s-border" />
              ))}
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
  const budgetPolicy = costData?.budgetPolicy;
  const budgetUsage = budgetPolicy ? Math.min(100, (totalSpend / budgetPolicy.monthlyBudgetUsd) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Cost"
        description="Token spend, model breakdown, and per-workflow economics"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={handleExport} disabled={exportCost.isPending}>
              {exportCost.isPending ? "Exporting" : "Export"}
            </Button>
            <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-s-subtle border border-s-border">
              {["24h", "7d", "30d", "90d"].map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    range === r ? "bg-s-surface text-s-primary" : "text-s-secondary hover:text-s-primary"
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

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4 mb-5">
        <Card className="overflow-hidden">
          <CardHeader title="Record model spend" subtitle="Writes to the backend cost ledger and refreshes FinOps metrics" />
          <form onSubmit={handleRecordCost} className="p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
            <Field label="Provider">
              <input value={ledger.provider} onChange={(event) => setLedger((prev) => ({ ...prev, provider: event.target.value }))} className={inputCls} />
            </Field>
            <Field label="Model">
              <input value={ledger.model} onChange={(event) => setLedger((prev) => ({ ...prev, model: event.target.value }))} className={inputCls} />
            </Field>
            <Field label="Domain">
              <input value={ledger.domain} onChange={(event) => setLedger((prev) => ({ ...prev, domain: event.target.value }))} className={inputCls} />
            </Field>
            <Field label="Cost USD">
              <input inputMode="decimal" value={ledger.cost} onChange={(event) => setLedger((prev) => ({ ...prev, cost: event.target.value }))} className={inputCls} />
            </Field>
            <Field label="Tokens in">
              <input inputMode="numeric" value={ledger.tokensIn} onChange={(event) => setLedger((prev) => ({ ...prev, tokensIn: event.target.value }))} className={inputCls} />
            </Field>
            <Field label="Tokens out">
              <input inputMode="numeric" value={ledger.tokensOut} onChange={(event) => setLedger((prev) => ({ ...prev, tokensOut: event.target.value }))} className={inputCls} />
            </Field>
            <Field label="Workflow">
              <input value={ledger.workflowId} onChange={(event) => setLedger((prev) => ({ ...prev, workflowId: event.target.value }))} className={inputCls} />
            </Field>
            <Field label="Agent">
              <input value={ledger.agentId} onChange={(event) => setLedger((prev) => ({ ...prev, agentId: event.target.value }))} className={inputCls} />
            </Field>
            <Field label="Duration ms">
              <input inputMode="numeric" value={ledger.durationMs} onChange={(event) => setLedger((prev) => ({ ...prev, durationMs: event.target.value }))} className={inputCls} />
            </Field>
            <div className="md:col-span-3 flex items-end justify-end">
              <Button variant="primary" icon={<PlusCircle size={14} />} disabled={recordCost.isPending || !ledger.provider || !ledger.model}>
                {recordCost.isPending ? "Recording" : "Record spend"}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Budget controls" subtitle={costData?.source === "local-durable" ? "Durable local ledger active" : "Database-backed ledger active"} />
          <form onSubmit={handleSaveBudget} className="p-4 space-y-3">
            <div className="rounded-md border border-s-border bg-s-subtle p-3">
              <div className="flex items-center justify-between gap-3 text-[12px]">
                <span className="text-s-secondary">Current usage</span>
                <span className="font-mono text-s-primary">{budgetUsage.toFixed(1)}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-s-base overflow-hidden">
                <div className={`h-full rounded-full ${budgetUsage >= 95 ? "bg-s-critical" : budgetUsage >= 70 ? "bg-s-warning" : "bg-s-success"}`} style={{ width: `${budgetUsage}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Monthly USD">
                <input inputMode="decimal" value={budget.monthlyBudgetUsd} onChange={(event) => setBudget((prev) => ({ ...prev, monthlyBudgetUsd: event.target.value }))} className={inputCls} />
              </Field>
              <Field label="Warn %">
                <input inputMode="numeric" value={budget.warningThresholdPct} onChange={(event) => setBudget((prev) => ({ ...prev, warningThresholdPct: event.target.value }))} className={inputCls} />
              </Field>
              <Field label="Stop %">
                <input inputMode="numeric" value={budget.hardStopThresholdPct} onChange={(event) => setBudget((prev) => ({ ...prev, hardStopThresholdPct: event.target.value }))} className={inputCls} />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" icon={<Save size={14} />} disabled={updateBudget.isPending}>
                {updateBudget.isPending ? "Saving" : "Save budget"}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">
        <Card className="lg:col-span-3 overflow-hidden">
          <CardHeader title="Daily Spend by Provider" subtitle={`Last ${range}`} />
          <div className="px-5 pb-5 pt-2 h-[280px]">
            {dailySpend.length === 0 ? (
              <EmptyState icon={<TrendingDown size={18} />} title="No ledger rows yet" description="Record model spend or run workflows to populate provider cost trends." />
            ) : (
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
                  }}
                  labelStyle={{ color: 'var(--s-text-primary)', fontWeight: 500 }}
                  formatter={(value: number, name: string) => [`$${value}`, name.charAt(0).toUpperCase() + name.slice(1)]}
                />
                <Bar dataKey="anthropic" stackId="a" fill="#0A84FF" radius={[0, 0, 0, 0]} name="Anthropic" />
                <Bar dataKey="openai" stackId="a" fill="#30D158" name="OpenAI" />
                <Bar dataKey="gemini" stackId="a" fill="#BF5AF2" name="Gemini" />
                <Bar dataKey="local" stackId="a" fill="#FF9F0A" radius={[3, 3, 0, 0]} name="Local" />
              </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader title="Spend by Domain" subtitle="Distribution" />
          <div className="px-5 pb-5 pt-2 h-[280px]">
            {domainBreakdown.length === 0 ? (
              <EmptyState icon={<TrendingDown size={18} />} title="No domain spend" description="Add a domain when recording ledger entries to see allocation." />
            ) : (
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
            )}
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
              {modelBreakdown.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-[12.5px] text-s-secondary" colSpan={5}>
                    No model usage recorded yet.
                  </td>
                </tr>
              ) : modelBreakdown.map((m) => {
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="label-mono mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}
