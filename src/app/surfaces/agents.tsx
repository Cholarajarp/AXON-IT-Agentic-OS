import { useState } from "react";
import { Bot, Activity, Clock, Cpu, Zap, RefreshCw, Search, Filter } from "lucide-react";
import { Card, PageHeader, Button, Kpi, RightPanel } from "../components/ui/primitives";
import { useAgents } from "../lib/queries";
import type { AgentInstance } from "../lib/store";

const stateConfig = {
  RUNNING: { label: "Running", dot: "bg-s-brand animate-pulse", badge: "bg-s-brand/10 text-s-brand border-s-brand/30" },
  IDLE: { label: "Idle", dot: "bg-s-success", badge: "bg-s-success/10 text-s-success border-s-success/30" },
  ERROR: { label: "Error", dot: "bg-s-critical", badge: "bg-s-critical/10 text-s-critical border-s-critical/30" },
};

export function Agents() {
  const { data: agents = [], isLoading } = useAgents();
  const [selected, setSelected] = useState<AgentInstance | null>(null);
  const [filter, setFilter] = useState<"all" | "RUNNING" | "IDLE" | "ERROR">("all");
  const [q, setQ] = useState("");

  const filtered = agents.filter((a) => {
    if (filter !== "all" && a.state !== filter) return false;
    if (q && !a.type.toLowerCase().includes(q.toLowerCase()) && !a.id.includes(q)) return false;
    return true;
  });

  const counts = {
    total: agents.length,
    running: agents.filter((a) => a.state === "RUNNING").length,
    idle: agents.filter((a) => a.state === "IDLE").length,
    error: agents.filter((a) => a.state === "ERROR").length,
  };

  const totalTokens = agents.reduce((sum, a) => sum + a.tokensUsed, 0);
  const avgConfidence = agents.length > 0
    ? (agents.reduce((sum, a) => sum + a.confidence, 0) / agents.length * 100).toFixed(1)
    : "0";

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Agent Fleet" description="Monitor, manage, and inspect all active agent instances" />
        <Card>
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw size={24} className="text-s-muted animate-spin" />
              <span className="text-s-secondary text-[13px]">Loading agent fleet...</span>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Agent Fleet"
        description="Monitor, manage, and inspect all active agent instances"
        action={
          <Button variant="secondary" size="sm" icon={<RefreshCw size={13} />}>
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Kpi label="Total Agents" value={counts.total.toString()} hint={`${counts.running} active now`} />
        <Kpi label="Running" value={counts.running.toString()} trend="up" delta="+2 vs yesterday" hint="Currently executing" />
        <Kpi label="Avg Confidence" value={`${avgConfidence}%`} hint="Across all agents" />
        <Kpi label="Tokens Used" value={formatTokens(totalTokens)} hint="Session total" />
      </div>

      <Card>
        <div className="flex items-center justify-between px-5 py-3 border-b border-s-border">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 max-w-sm px-2.5 py-1.5 rounded-md bg-s-subtle border border-s-border">
              <Search size={13} className="text-s-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search agents..."
                className="bg-transparent flex-1 min-w-0 outline-none text-s-primary placeholder:text-s-muted text-[12.5px]"
              />
            </div>
            <Button variant="ghost" size="sm" icon={<Filter size={13} />}>Filters</Button>
          </div>
          <div className="flex items-center gap-1 p-0.5 rounded-md bg-s-subtle border border-s-border">
            {(["all", "RUNNING", "IDLE", "ERROR"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  filter === f ? "bg-s-surface text-s-primary shadow-sm" : "text-s-secondary hover:text-s-primary"
                }`}
              >
                {f === "all" ? "All" : f === "RUNNING" ? "Running" : f === "IDLE" ? "Idle" : "Error"}
                {f !== "all" && (
                  <span className="ml-1 font-mono opacity-60">
                    {f === "RUNNING" ? counts.running : f === "IDLE" ? counts.idle : counts.error}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
          {filtered.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onClick={() => setSelected(agent)} />
          ))}
        </div>
      </Card>

      <RightPanel open={!!selected} onClose={() => setSelected(null)} title={selected?.type ?? ""}>
        {selected && <AgentDetail agent={selected} />}
      </RightPanel>
    </div>
  );
}

function AgentCard({ agent, onClick }: { agent: AgentInstance; onClick: () => void }) {
  const cfg = stateConfig[agent.state];
  return (
    <button
      onClick={onClick}
      className="text-left w-full p-4 rounded-lg bg-s-base border border-s-border hover:border-s-border-strong transition-all hover:shadow-sm group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-md bg-s-subtle border border-s-border flex items-center justify-center shrink-0">
            <Bot size={14} className="text-s-secondary" />
          </div>
          <div className="min-w-0">
            <div className="text-s-primary text-[13px] font-medium group-hover:text-s-brand transition-colors truncate">
              {agent.type}
            </div>
            <div className="text-s-muted font-mono text-[10px]">
              v{agent.version}
            </div>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] shrink-0 ${cfg.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>

      {agent.currentTask && (
        <div className="text-s-secondary text-[11.5px] truncate mb-3">
          {agent.currentTask}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-s-muted text-[10.5px]">
            <Zap size={10} /> {(agent.confidence * 100).toFixed(0)}%
          </span>
          <span className="flex items-center gap-1 text-s-muted text-[10.5px]">
            <Cpu size={10} /> {formatTokens(agent.tokensUsed)}
          </span>
        </div>
        <div className="w-16 h-1.5 bg-s-subtle rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              agent.state === "ERROR" ? "bg-s-critical" : agent.completion === 100 ? "bg-s-success" : "bg-s-brand"
            }`}
            style={{ width: `${agent.completion}%` }}
          />
        </div>
      </div>
    </button>
  );
}

function AgentDetail({ agent }: { agent: AgentInstance }) {
  const cfg = stateConfig[agent.state];
  const elapsed = Math.floor((Date.now() - agent.updatedAt) / 1000);

  return (
    <div className="p-5 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-s-subtle border border-s-border flex items-center justify-center shrink-0">
          <Bot size={18} className="text-s-secondary" />
        </div>
        <div className="min-w-0">
          <div className="text-s-primary text-[15px] font-medium truncate">{agent.type}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] ${cfg.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
            <span className="text-s-muted font-mono text-[10px]">v{agent.version}</span>
          </div>
        </div>
      </div>

      {agent.currentTask && (
        <div className="p-3 rounded-md bg-s-base border border-s-border">
          <div className="label-mono mb-1">Current Task</div>
          <div className="text-s-primary text-[12.5px] leading-relaxed">{agent.currentTask}</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <MetricTile icon={<Activity size={13} />} label="Completion" value={`${agent.completion}%`} />
        <MetricTile icon={<Zap size={13} />} label="Confidence" value={`${(agent.confidence * 100).toFixed(1)}%`} />
        <MetricTile icon={<Cpu size={13} />} label="Tokens Used" value={formatTokens(agent.tokensUsed)} />
        <MetricTile icon={<Clock size={13} />} label="Last Update" value={formatElapsed(elapsed)} />
      </div>

      <div>
        <div className="label-mono mb-2">Task Progress</div>
        <div className="w-full h-2 bg-s-subtle rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              agent.state === "ERROR" ? "bg-s-critical" : agent.completion === 100 ? "bg-s-success" : "bg-s-brand"
            }`}
            style={{ width: `${agent.completion}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-s-muted text-[11px]">0%</span>
          <span className="font-mono text-s-primary text-[11px]">{agent.completion}%</span>
          <span className="text-s-muted text-[11px]">100%</span>
        </div>
      </div>

      <div>
        <div className="label-mono mb-2">Capabilities</div>
        <div className="flex flex-wrap gap-1.5">
          {getCapabilities(agent.type).map((cap) => (
            <span key={cap} className="px-2 py-0.5 rounded bg-s-subtle border border-s-border text-s-secondary text-[11px]">
              {cap}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-3 border-t border-s-border">
        {agent.state === "ERROR" && <Button variant="primary" size="sm" icon={<RefreshCw size={12} />}>Retry</Button>}
        {agent.state === "RUNNING" && <Button variant="danger" size="sm">Pause</Button>}
        <Button variant="secondary" size="sm">View Logs</Button>
        <Button variant="secondary" size="sm">Trace</Button>
      </div>
    </div>
  );
}

function MetricTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-3 rounded-md bg-s-base border border-s-border">
      <div className="flex items-center gap-1.5 text-s-muted text-[10.5px] mb-1">
        {icon} {label}
      </div>
      <div className="font-mono text-s-primary text-sm font-medium">{value}</div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function getCapabilities(type: string): string[] {
  const caps: Record<string, string[]> = {
    IntentAgent: ['NLU', 'Goal Parsing', 'Disambiguation', 'Context Window'],
    BusinessAnalystAgent: ['Requirements', 'User Stories', 'Acceptance Criteria', 'Domain Analysis'],
    SolutionArchitectAgent: ['System Design', 'Trade-off Analysis', 'RFC Generation', 'Diagramming'],
    EngineeringAgent: ['Code Generation', 'Refactoring', 'Testing', 'PR Creation'],
    QAAgent: ['SAST', 'DAST', 'SCA', 'Property Testing', 'Load Testing'],
    SecurityAgent: ['Threat Modeling', 'PII Detection', 'Prompt Injection Guard', 'Output Sanitization'],
    InfrastructureAgent: ['Terraform', 'K8s Manifests', 'Migration', 'Scaling'],
    ReleaseAgent: ['Canary Deploy', 'Feature Flags', 'Rollback', 'SLO Monitoring'],
    SREAgent: ['Incident Detection', 'Root Cause', 'Auto-Remediation', 'Runbooks'],
    ComplianceAgent: ['SOC 2', 'ISO 27001', 'HIPAA', 'GDPR', 'Evidence Collection'],
    DocumentationAgent: ['API Docs', 'Runbooks', 'Architecture Docs', 'Changelogs'],
    PMOAgent: ['Resource Planning', 'Risk Register', 'Sprint Metrics', 'Roadmap'],
    ExecutiveInsightAgent: ['Business Metrics', 'Weekly Reports', 'ROI Analysis', 'Trend Detection'],
    DomainAgent: ['Knowledge Retrieval', 'Domain Rules', 'Ontology', 'Reasoning'],
    StackResearchAgent: ['Source Synthesis', 'Public Docs Review', 'Stack Comparison', 'Trend Analysis'],
  };
  return caps[type] || ['General Purpose'];
}
