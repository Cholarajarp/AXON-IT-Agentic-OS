import { useState } from "react";
import { Bot, AlertTriangle, Plus, ArrowRight, AlertCircle, RefreshCw, Shield, Clock, CheckCircle2, XCircle, BookOpen, Compass, ServerCog } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader, Button, StatusPill, SeverityBadge } from "../components/ui/primitives";
import { SubmitGoalModal } from "../components/submit-goal-modal";
import { useRouting } from "../lib/useRouting";
import { useWorkflows, useAgents, useAlerts, useApprovals, useResolveApproval, useCost, useIncidents, useModelRuntimeStatus } from "../lib/queries";

const researchSources = [
  {
    name: "OpenHands",
    detail: "Shared workspace, sandboxed runtime, SDK-first, and collaborative agent visibility.",
    tag: "workspace",
  },
  {
    name: "Continue",
    detail: "Repo-native markdown checks that run as GitHub status gates with suggested fixes.",
    tag: "checks",
  },
  {
    name: "LangGraph",
    detail: "Durable execution, interrupts, streaming, and memory for long-running agents.",
    tag: "runtime",
  },
];

const blueprintRules = [
  "Research sources before architecture selection.",
  "Show provider health and sovereignty before launch.",
  "Gate execution on budget, approval, and audit evidence.",
  "Keep command, routing, and verification in one cockpit.",
];

export function CommandCenter() {
  const { data: workflows = [], isLoading: workflowsLoading, isError: workflowsError, error: workflowsErrorMsg, refetch: refetchWorkflows } = useWorkflows();
  const { data: agents = [] } = useAgents();
  const { data: alerts = [] } = useAlerts();
  const { data: approvals = [] } = useApprovals();
  const { data: cost } = useCost();
  const { data: incidents = [] } = useIncidents();
  const { data: runtimeStatus } = useModelRuntimeStatus();
  const resolveApprovalMutation = useResolveApproval();
  const { setRoute } = useRouting();
  const [goalOpen, setGoalOpen] = useState(false);

  const counts = {
    running: workflows.filter((w) => w.state === "RUNNING").length,
    awaiting: workflows.filter((w) => w.state === "AWAITING_APPROVAL").length,
    complete: workflows.filter((w) => w.state === "COMPLETE").length,
    failed: workflows.filter((w) => w.state === "FAILED").length,
  };
  const pendingApprovals = approvals.filter((a) => a.status === "PENDING");
  const openIncidents = incidents.filter((i) => i.state !== "RESOLVED" && i.state !== "POST_MORTEM").length;
  const totalBudget = workflows.reduce((sum, w) => sum + w.budget, 0);
  const totalSpend = cost?.totalSpend ?? workflows.reduce((sum, w) => sum + w.cost, 0);
  const budgetUsed = totalBudget > 0 ? Math.min(100, Math.round((totalSpend / totalBudget) * 100)) : 0;
  const operationalScore = Math.max(0, 100 - counts.failed * 12 - openIncidents * 8 - alerts.filter((a) => a.severity === "P0").length * 15);
  const liveProviders = runtimeStatus?.providers ?? [];
  const healthyProviders = runtimeStatus?.health.filter((provider) => provider.healthy).length ?? 0;

  if (workflowsLoading) {
    return (
      <div>
        <PageHeader title="Command Center" description="Real-time oversight across active workflows and agent fleet" />
        <Card>
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw size={24} className="text-s-muted animate-spin" />
              <span className="text-s-secondary text-[13px]">Loading command center...</span>
            </div>
          </div>
        </Card>
        <SubmitGoalModal open={goalOpen} onClose={() => setGoalOpen(false)} />
      </div>
    );
  }

  if (workflowsError) {
    return (
      <div>
        <PageHeader title="Command Center" description="Real-time oversight across active workflows and agent fleet" />
        <Card>
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 max-w-md text-center">
              <AlertCircle size={24} className="text-s-critical" />
              <span className="text-s-primary text-sm font-medium">Failed to load</span>
              <span className="text-s-secondary text-[13px]">
                {workflowsErrorMsg instanceof Error ? workflowsErrorMsg.message : "An unexpected error occurred"}
              </span>
              <Button variant="primary" size="sm" icon={<RefreshCw size={13} />} onClick={() => refetchWorkflows()}>Retry</Button>
            </div>
          </div>
        </Card>
        <SubmitGoalModal open={goalOpen} onClose={() => setGoalOpen(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Command Center"
        description="Real-time oversight across active workflows and agent fleet"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Compass size={14} />} onClick={() => setRoute("blueprint")}>
              Blueprint Lab
            </Button>
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setGoalOpen(true)}>
              Submit Goal
            </Button>
          </div>
        }
      />

      <Card className="relative mb-5 overflow-hidden border border-s-border/80 bg-gradient-to-br from-s-surface via-s-surface to-s-base">
        <div className="relative grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-5 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="rounded-full border border-s-brand/30 bg-s-brand/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-s-brand">
                Blueprint mode
              </span>
              <span className="rounded-full border border-s-border bg-s-subtle px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-s-secondary">
                StackResearchAgent
              </span>
              <span className="rounded-full border border-s-border bg-s-subtle px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-s-secondary">
                {liveProviders.length} live providers
              </span>
            </div>

            <div className="flex items-start gap-3">
              <Compass size={18} className="mt-1 text-s-brand shrink-0" />
              <div className="min-w-0">
                <h2 className="text-[20px] font-medium tracking-tight text-s-primary">Source-backed stack choices, not random regex.</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-s-secondary max-w-3xl">
                  The operating model is now grounded in three public patterns: OpenHands for collaborative workspaces, Continue for repo-native checks, and LangGraph for durable execution and human-in-the-loop control.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              {researchSources.map((source) => (
                <div key={source.name} className="rounded-md border border-s-border bg-s-base p-3 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-[13px] font-medium text-s-primary truncate">{source.name}</div>
                    <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-s-secondary">
                      {source.tag}
                    </span>
                  </div>
                  <div className="text-[11px] text-s-secondary leading-relaxed">{source.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-md border border-s-border bg-s-base p-4">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={14} className="text-s-brand" />
                <span className="label-mono">Build rules</span>
              </div>
              <div className="space-y-2">
                {blueprintRules.map((rule) => (
                  <div key={rule} className="flex items-start gap-2 text-[12px] text-s-secondary">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-s-brand shrink-0" />
                    <span>{rule}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-s-border bg-s-base p-4">
              <div className="flex items-center gap-2 mb-3">
                <ServerCog size={14} className="text-s-brand" />
                <span className="label-mono">Live router</span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-mono text-[28px] font-medium tabular-nums text-s-primary">{healthyProviders}/{liveProviders.length}</span>
                <span className="text-[11px] text-s-muted">healthy providers</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(liveProviders.length > 0 ? liveProviders : ["No live providers"]).map((provider) => (
                  <span key={provider} className="rounded border border-s-border bg-s-surface px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-s-secondary">
                    {provider}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 3-column responsive grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left — Status */}
        <div className="space-y-4 min-w-0">
          <Card className="p-5 overflow-hidden">
            <div className="label-mono mb-2">Active Workflows</div>
            <div className="flex items-baseline gap-3 mb-4">
              <span className="font-mono text-s-primary text-4xl font-medium tabular-nums tracking-tight">
                {workflows.length}
              </span>
              <span className="text-s-muted text-xs">
                {counts.running} running
              </span>
            </div>
            <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-s-subtle mb-3">
              <div className="bg-s-brand" style={{ width: `${(counts.running / Math.max(workflows.length, 1)) * 100}%` }} />
              <div className="bg-s-warning" style={{ width: `${(counts.awaiting / Math.max(workflows.length, 1)) * 100}%` }} />
              <div className="bg-s-success" style={{ width: `${(counts.complete / Math.max(workflows.length, 1)) * 100}%` }} />
              <div className="bg-s-critical" style={{ width: `${(counts.failed / Math.max(workflows.length, 1)) * 100}%` }} />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Running", value: counts.running, color: "bg-s-brand" },
                { label: "Awaiting", value: counts.awaiting, color: "bg-s-warning" },
                { label: "Done", value: counts.complete, color: "bg-s-success" },
                { label: "Failed", value: counts.failed, color: "bg-s-critical" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.color}`} />
                    <span className="label-mono">{s.label}</span>
                  </div>
                  <div className="font-mono text-s-primary text-[15px]">{s.value}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Agent Fleet" subtitle={`${agents.length} instances`} />
            <div className="p-3 grid grid-cols-2 gap-1.5">
              {agents.slice(0, 8).map((a) => (
                <div key={a.id} className="flex items-center justify-between px-2 py-1.5 rounded-md bg-s-base border border-s-border min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.state === "RUNNING" ? "bg-s-brand animate-pulse" : a.state === "ERROR" ? "bg-s-critical" : "bg-s-muted"}`} />
                    <span className="text-s-primary truncate text-[11px]">{a.type.replace("Agent", "")}</span>
                  </div>
                  <span className="font-mono text-s-secondary text-[10px] shrink-0 ml-1">{a.completion}%</span>
                </div>
              ))}
            </div>
            <div className="px-3 pb-3">
              <button
                onClick={() => setRoute("agents")}
                className="w-full text-center text-s-secondary hover:text-s-brand py-1.5 rounded-md hover:bg-s-hover transition-colors text-[11.5px]"
              >
                View all {agents.length} agents →
              </button>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Active Alerts"
              action={alerts.length > 0 ? <span className="font-mono text-s-critical text-[11px]">{alerts.length} OPEN</span> : undefined}
            />
            {alerts.length === 0 ? (
              <EmptyState icon={<AlertTriangle size={18} />} title="All systems normal" description="No active alerts." />
            ) : (
              <div className="p-2">
                {alerts.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 px-2.5 py-2 rounded-md hover:bg-s-hover min-w-0">
                    <SeverityBadge level={a.severity} />
                    <div className="min-w-0 flex-1">
                      <span className="text-s-primary block truncate text-xs">{a.title}</span>
                      <span className="text-s-muted font-mono text-[10px]">{a.source}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Center — Activity */}
        <div className="space-y-4 min-w-0">
          <Card className="overflow-hidden">
            <CardHeader
              title="Live Activity"
              subtitle="Real-time workflow state"
              action={
                <button onClick={() => setRoute("workflows")} className="text-s-secondary hover:text-s-primary flex items-center gap-1 text-xs">
                  View all <ArrowRight size={12} />
                </button>
              }
            />
            <div className="divide-y divide-s-border">
              {workflows.slice(0, 5).map((w) => (
                <div key={w.id} className="px-4 py-3 hover:bg-s-hover cursor-pointer min-w-0" onClick={() => setRoute("workflows")}>
                  <div className="flex items-center gap-2 mb-1.5 min-w-0">
                    <StatusPill state={w.state} />
                    <span className="text-s-primary truncate text-[13px] font-medium">{w.name}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-s-secondary flex-1 truncate text-xs">→ {w.step}</span>
                    <div className="w-16 h-1 bg-s-subtle rounded-full overflow-hidden shrink-0">
                      <div className="h-full bg-s-brand rounded-full" style={{ width: `${w.progress}%` }} />
                    </div>
                    <span className="font-mono text-s-secondary text-[11px] shrink-0 w-7 text-right">{w.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Pending Approvals"
              subtitle={pendingApprovals.length === 0 ? "Nothing requires attention" : `${pendingApprovals.length} awaiting review`}
            />
            {pendingApprovals.length === 0 ? (
              <EmptyState icon={<Shield size={18} />} title="No pending approvals" description="High-risk actions will appear here." />
            ) : (
              <div className="divide-y divide-s-border">
                {pendingApprovals.map((a) => (
                  <div key={a.id} className="px-4 py-3 min-w-0">
                    <div className="flex items-center gap-2 mb-2 min-w-0">
                      <SeverityBadge level={a.severity} />
                      <span className="text-s-primary truncate text-[12.5px] font-medium">{a.title}</span>
                    </div>
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <span className="text-s-muted text-[11px]">Blast: {a.blastRadius}</span>
                      <span className="text-s-muted text-[11px]">Risk: {a.riskScore}/100</span>
                      <span className="text-s-muted text-[11px]">{a.reversible ? "Reversible" : "Irreversible"}</span>
                      <span className="flex items-center gap-1 text-s-muted ml-auto text-[11px]">
                        <Clock size={10} className="shrink-0" /> {Math.round((a.expiresAt - Date.now()) / 60000)}m
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="success" size="sm" icon={<CheckCircle2 size={12} />}
                        onClick={() => resolveApprovalMutation.mutate({ id: a.id, decision: "APPROVED" })}>
                        Approve
                      </Button>
                      <Button variant="danger" size="sm" icon={<XCircle size={12} />}
                        onClick={() => resolveApprovalMutation.mutate({ id: a.id, decision: "REJECTED" })}>
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right — Metrics */}
        <div className="space-y-4 min-w-0">
          <Card className="p-5 overflow-hidden">
            <div className="label-mono mb-2">Spend This Week</div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-mono text-s-primary text-[28px] font-medium tabular-nums">${totalSpend.toFixed(2)}</span>
              {cost && <span className="font-mono text-s-secondary text-[11px]">{cost.topModel}</span>}
            </div>
            <div className="text-s-muted text-[11px] mb-3">Workflow budget pool: ${totalBudget.toFixed(2)}</div>
            <div className="w-full h-2 bg-s-subtle rounded-full overflow-hidden">
              <div className="h-full bg-s-brand rounded-full" style={{ width: `${budgetUsed}%` }} />
            </div>
          </Card>

          <Card className="p-5 overflow-hidden">
            <div className="label-mono mb-2">Operational Score</div>
            <div className="flex items-baseline gap-2 mb-3">
              <span className={`font-mono text-[28px] font-medium tabular-nums ${operationalScore >= 85 ? "text-s-success" : operationalScore >= 70 ? "text-s-warning" : "text-s-critical"}`}>
                {operationalScore}%
              </span>
              <span className="text-s-muted text-[11px]">live</span>
            </div>
            <div className="space-y-2">
              {[
                { label: "Workflows", value: workflows.length ? Math.round((counts.complete / workflows.length) * 100) : 0 },
                { label: "Incidents", value: Math.max(0, 100 - openIncidents * 20) },
                { label: "Alerts", value: Math.max(0, 100 - alerts.length * 10) },
              ].map((sla) => (
                <div key={sla.label} className="flex items-center gap-2">
                  <span className="text-s-muted w-20 text-[11px] shrink-0">{sla.label}</span>
                  <div className="flex-1 h-1.5 bg-s-subtle rounded-full overflow-hidden min-w-0">
                    <div className="h-full rounded-full bg-s-success" style={{ width: `${sla.value}%` }} />
                  </div>
                  <span className="font-mono text-s-secondary text-[10px] shrink-0">{sla.value}%</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Failing Agents" subtitle="Last 24h" />
            {agents.filter((a) => a.state === "ERROR").length === 0 ? (
              <EmptyState icon={<Bot size={18} />} title="All healthy" description="No agent errors." />
            ) : (
              <div className="p-3">
                {agents.filter((a) => a.state === "ERROR").map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-2.5 py-2 rounded-md hover:bg-s-hover min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-s-critical shrink-0" />
                      <span className="text-s-primary truncate text-xs">{a.type}</span>
                    </div>
                    <span className="text-s-critical font-mono text-[11px] shrink-0">ERROR</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <SubmitGoalModal open={goalOpen} onClose={() => setGoalOpen(false)} />
    </div>
  );
}
