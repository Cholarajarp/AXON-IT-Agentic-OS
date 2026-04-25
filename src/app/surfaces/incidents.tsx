import { useState } from "react";
import { AlertCircle, RefreshCw, Clock, CheckCircle2, Activity, Shield, Zap } from "lucide-react";
import { Card, PageHeader, Button, Kpi, SeverityBadge, RightPanel } from "../components/ui/primitives";
import { useIncidents, useResolveIncident } from "../lib/queries";
import type { Incident } from "../lib/store";

const stateStyles = {
  ACTIVE: { label: "Active", color: "text-s-critical", icon: AlertCircle },
  REMEDIATING: { label: "Remediating", color: "text-s-warning", icon: Activity },
  RESOLVED: { label: "Resolved", color: "text-s-success", icon: CheckCircle2 },
  POST_MORTEM: { label: "Post-Mortem", color: "text-s-info", icon: Shield },
} as const;

type IncidentState = keyof typeof stateStyles;

function getStateStyle(state: string) {
  return stateStyles[state as IncidentState] ?? stateStyles.ACTIVE;
}

export function Incidents() {
  const { data: incidents = [], isLoading, isError, error, refetch } = useIncidents();
  const resolveIncidentMutation = useResolveIncident();
  const [selected, setSelected] = useState<Incident | null>(null);
  const [tab, setTab] = useState<"active" | "resolved" | "all">("active");

  const active = incidents.filter((i) => i.state !== "RESOLVED" && i.state !== "POST_MORTEM");
  const resolved = incidents.filter((i) => i.state === "RESOLVED" || i.state === "POST_MORTEM");

  const filtered = tab === "active" ? active : tab === "resolved" ? resolved : incidents;

  const counts = {
    p0: active.filter((i) => i.severity === "P0").length,
    p1: active.filter((i) => i.severity === "P1").length,
    p2: active.filter((i) => i.severity === "P2").length,
    p3: active.filter((i) => i.severity === "P3").length,
  };

  const mttr = resolved.length > 0
    ? Math.round(resolved.reduce((sum, i) => sum + ((i.resolvedAt || 0) - i.startedAt), 0) / resolved.length / 60000)
    : 0;

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Incidents" description="Active and resolved incidents with SRE Agent timelines" />
        <Card>
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={24} className="text-s-muted animate-spin" />
          </div>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <PageHeader title="Incidents" description="Active and resolved incidents with SRE Agent timelines" />
        <Card>
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertCircle size={24} className="text-s-critical" />
              <span className="text-s-primary text-sm font-medium">Failed to load incidents</span>
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

  return (
    <div>
      <PageHeader
        title="Incidents"
        description="Active and resolved incidents with SRE Agent timelines"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm">Runbooks</Button>
            <Button variant="secondary" size="sm">Export</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-5">
        <Kpi label="P0 Active" value={counts.p0.toString()} hint="Critical, customer-impacting" trend={counts.p0 > 0 ? "up" : "flat"} />
        <Kpi label="P1 Active" value={counts.p1.toString()} hint="Major degradation" trend={counts.p1 > 0 ? "up" : "flat"} />
        <Kpi label="P2 Active" value={counts.p2.toString()} hint="Minor / partial" />
        <Kpi label="P3 Active" value={counts.p3.toString()} hint="Informational" />
        <Kpi label="MTTR" value={mttr > 0 ? `${mttr}m` : "—"} hint="Mean time to resolve" trend="down" delta="Improving" />
      </div>

      <Card>
        <div className="flex items-center justify-between px-5 py-3 border-b border-s-border">
          <div className="flex items-center gap-1 p-0.5 rounded-md bg-s-subtle border border-s-border">
            {(["active", "resolved", "all"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  tab === t ? "bg-s-surface text-s-primary shadow-sm" : "text-s-secondary hover:text-s-primary"
                }`}
              >
                {t === "active" ? `Active (${active.length})` : t === "resolved" ? `Resolved (${resolved.length})` : `All (${incidents.length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-s-border">
          {filtered.map((incident) => (
            <IncidentRow key={incident.id} incident={incident} onClick={() => setSelected(incident)} />
          ))}
        </div>
      </Card>

      <RightPanel open={!!selected} onClose={() => setSelected(null)} title={selected?.title ?? ""}>
        {selected && (
          <IncidentDetail
            incident={selected}
            onResolve={() => {
              resolveIncidentMutation.mutate(selected.id);
              setSelected(null);
            }}
          />
        )}
      </RightPanel>
    </div>
  );
}

function IncidentRow({ incident, onClick }: { incident: Incident; onClick: () => void }) {
  const style = getStateStyle(incident.state);
  const Icon = style.icon;
  const elapsed = Math.floor((Date.now() - incident.startedAt) / 60000);

  return (
    <button onClick={onClick} className="w-full text-left px-5 py-4 hover:bg-s-hover transition-colors">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 shrink-0 ${style.color}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <SeverityBadge level={incident.severity} />
            <span className="text-s-primary text-[13px] font-medium truncate">{incident.title}</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-s-border text-[10px] font-medium ${style.color}`}>
              {style.label}
            </span>
            <span className="text-s-muted text-[11px]">
              {incident.affected.length} service{incident.affected.length > 1 ? "s" : ""} affected
            </span>
            <span className="flex items-center gap-1 text-s-muted text-[11px]">
              <Clock size={10} /> {formatDuration(elapsed)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function IncidentDetail({ incident, onResolve }: { incident: Incident; onResolve: () => void }) {
  const style = getStateStyle(incident.state);
  const elapsed = Math.floor((Date.now() - incident.startedAt) / 60000);

  const timeline = generateTimeline(incident);

  return (
    <div className="p-5 flex flex-col gap-5">
      <div className="flex items-center gap-2 flex-wrap">
        <SeverityBadge level={incident.severity} />
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-s-border text-[10px] font-medium ${style.color}`}>
          {style.label}
        </span>
        <span className="font-mono text-s-muted text-[10px]">{incident.id}</span>
      </div>

      <div>
        <div className="label-mono mb-1">Affected Services</div>
        <div className="flex flex-wrap gap-1.5">
          {incident.affected.map((s) => (
            <span key={s} className="px-2 py-0.5 rounded bg-s-subtle border border-s-border font-mono text-s-primary text-[11px]">
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-md bg-s-base border border-s-border">
          <div className="flex items-center gap-1.5 text-s-muted text-[10.5px] mb-1">
            <Clock size={10} /> Duration
          </div>
          <div className="font-mono text-s-primary text-sm font-medium">{formatDuration(elapsed)}</div>
        </div>
        <div className="p-3 rounded-md bg-s-base border border-s-border">
          <div className="flex items-center gap-1.5 text-s-muted text-[10.5px] mb-1">
            <Zap size={10} /> Impact
          </div>
          <div className="font-mono text-s-primary text-sm font-medium">
            {incident.affected.length} services
          </div>
        </div>
      </div>

      <div>
        <div className="label-mono mb-3">Timeline</div>
        <div className="relative pl-5">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-s-border" />
          {timeline.map((event, i) => (
            <div key={i} className="relative flex items-start gap-3 mb-4 last:mb-0">
              <div className={`absolute left-[-13px] w-3 h-3 rounded-full border-2 ${
                i === 0 ? "bg-s-critical border-s-critical" :
                event.type === "resolution" ? "bg-s-success border-s-success" :
                "bg-s-surface border-s-border"
              }`} />
              <div className="flex-1 min-w-0">
                <div className="text-s-primary text-xs font-medium">{event.title}</div>
                <div className="text-s-muted text-[11px]">{event.description}</div>
                <div className="text-s-muted font-mono text-[10px] mt-0.5">{event.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-3 border-t border-s-border">
        {incident.state !== "RESOLVED" && (
          <Button variant="primary" size="sm" icon={<CheckCircle2 size={12} />} onClick={onResolve}>
            Mark Resolved
          </Button>
        )}
        <Button variant="secondary" size="sm">View Runbook</Button>
        <Button variant="secondary" size="sm">Post-Mortem</Button>
      </div>
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function generateTimeline(incident: Incident) {
  const events = [
    { type: "detection", title: "Incident Detected", description: `Alert triggered: ${incident.title}`, time: new Date(incident.startedAt).toLocaleTimeString() },
    { type: "triage", title: "Auto-Triage", description: `SREAgent classified as ${incident.severity} — ${incident.affected.length} services affected`, time: new Date(incident.startedAt + 120000).toLocaleTimeString() },
    { type: "investigation", title: "Root Cause Analysis", description: "SREAgent correlating metrics, logs, and traces", time: new Date(incident.startedAt + 300000).toLocaleTimeString() },
  ];

  if (incident.state === "REMEDIATING") {
    events.push({ type: "remediation", title: "Remediation In Progress", description: "Automated fix proposed — awaiting approval", time: new Date(incident.startedAt + 600000).toLocaleTimeString() });
  }

  if (incident.state === "RESOLVED" && incident.resolvedAt) {
    events.push(
      { type: "fix", title: "Fix Applied", description: "Automated remediation executed successfully", time: new Date(incident.resolvedAt - 300000).toLocaleTimeString() },
      { type: "resolution", title: "Incident Resolved", description: "All SLOs restored to healthy state", time: new Date(incident.resolvedAt).toLocaleTimeString() },
    );
  }

  return events;
}
