import {
  LayoutGrid,
  GitBranch,
  Bot,
  Brain,
  Shield,
  FileCheck2,
  AlertTriangle,
  BarChart3,
  Settings,
  HelpCircle,
  PieChart,
  Pin,
  Network,
  Compass,
  Terminal,
  MessageSquare,
  Clock,
  Cpu,
  Puzzle,
  TestTubeDiagonal,
  Wrench,
  ListChecks,
  Code2,
  Database,
  Sparkles,
  ShieldCheck,
  GitCommit,
  Headphones,
  CloudCog,
  GraduationCap,
  NetworkIcon,
  Building2,
  BrainCircuit,
  FolderTree,
  BadgeDollarSign,
  FileCode2,
  Rocket,
  MonitorSmartphone,
  ClipboardCheck,
  Radar,
  Fingerprint,
  Gauge,
  Factory,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouting, type RouteKey } from "../lib/useRouting";
import { useWorkflows, useAgents, useIncidents } from "../lib/queries";

interface NavItem {
  id: RouteKey;
  label: string;
  icon: typeof LayoutGrid;
  group: "Build" | "Operations" | "Governance" | "Insights" | "Platform";
}

const items: NavItem[] = [
  { id: "companyOs", label: "Company OS", icon: Building2, group: "Build" },
  { id: "missionControl", label: "Mission Control", icon: ClipboardCheck, group: "Build" },
  { id: "marketRadar", label: "Market Radar", icon: Radar, group: "Build" },
  { id: "deliveryBrain", label: "Delivery Brain", icon: BrainCircuit, group: "Build" },
  { id: "agenticFinops", label: "Agentic FinOps", icon: Gauge, group: "Build" },
  { id: "agentProjects", label: "Agent Projects", icon: NetworkIcon, group: "Build" },
  { id: "productionReadiness", label: "Production Readiness", icon: Factory, group: "Build" },
  { id: "structure", label: "Structure Guardian", icon: FolderTree, group: "Platform" },
  { id: "apiForge", label: "API Forge", icon: FileCode2, group: "Platform" },
  { id: "build", label: "Build Studio", icon: Sparkles, group: "Build" },
  { id: "enterprise", label: "Enterprise OS", icon: ShieldCheck, group: "Build" },
  { id: "releaseCommand", label: "Release Command", icon: Rocket, group: "Build" },
  { id: "trustLedger", label: "Trust Ledger", icon: Fingerprint, group: "Governance" },
  { id: "previewQa", label: "Preview QA", icon: MonitorSmartphone, group: "Build" },
  { id: "blueprint", label: "Plans", icon: Compass, group: "Build" },
  { id: "code", label: "Code", icon: Code2, group: "Build" },
  { id: "database", label: "Database", icon: Database, group: "Build" },
  { id: "security", label: "Security", icon: ShieldCheck, group: "Build" },
  { id: "checkpoints", label: "Checkpoints", icon: GitCommit, group: "Build" },
  { id: "serviceDesk", label: "Service Desk", icon: Headphones, group: "Build" },
  { id: "managedServices", label: "Managed Services", icon: CloudCog, group: "Build" },
  { id: "customerDelivery", label: "Customer Delivery", icon: BadgeDollarSign, group: "Build" },
  { id: "skillAcademy", label: "Skill Academy", icon: GraduationCap, group: "Build" },
  { id: "autonomousWorkforce", label: "Autonomous Workforce", icon: NetworkIcon, group: "Build" },
  { id: "command", label: "Ops Overview", icon: LayoutGrid, group: "Operations" },
  { id: "workflows", label: "Workflows", icon: GitBranch, group: "Operations" },
  { id: "dag", label: "Execution DAG", icon: Network, group: "Operations" },
  { id: "terminal", label: "Terminal", icon: Terminal, group: "Operations" },
  { id: "chat", label: "Chat", icon: MessageSquare, group: "Operations" },
  { id: "agents", label: "Agents", icon: Bot, group: "Operations" },
  { id: "memory", label: "Memory", icon: Brain, group: "Platform" },
  { id: "policies", label: "Policies", icon: Shield, group: "Governance" },
  { id: "evidence", label: "Evidence", icon: FileCheck2, group: "Governance" },
  { id: "incidents", label: "Incidents", icon: AlertTriangle, group: "Governance" },
  { id: "audit", label: "Audit Trail", icon: Clock, group: "Governance" },
  { id: "tools", label: "Tools", icon: Wrench, group: "Governance" },
  { id: "pipeline", label: "Safety Pipeline", icon: ListChecks, group: "Governance" },
  { id: "executive", label: "Executive", icon: PieChart, group: "Insights" },
  { id: "cost", label: "Cost", icon: BarChart3, group: "Insights" },
  { id: "models", label: "Models", icon: Cpu, group: "Insights" },
  { id: "integrations", label: "Integrations", icon: Puzzle, group: "Platform" },
  { id: "evaluations", label: "Evaluation Lab", icon: TestTubeDiagonal, group: "Platform" },
];

export function Sidebar({ onOpenHelp }: { onOpenHelp: () => void }) {
  const { route, setRoute } = useRouting();
  const { data: workflows = [] } = useWorkflows();
  const { data: agents = [] } = useAgents();
  const { data: incidents = [] } = useIncidents();
  const [recent, setRecent] = useState<RouteKey[]>([]);
  const [pinned, setPinned] = useState<RouteKey[]>(["build", "workflows"]);

  useEffect(() => {
    setRecent((prev) => {
      const next = [route, ...prev.filter((r) => r !== route)].slice(0, 4);
      return next;
    });
  }, [route]);

  const togglePin = (id: RouteKey) => {
    setPinned((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const counts: Partial<Record<RouteKey, number>> = {
    workflows: workflows.length || undefined,
    agents: agents.length || undefined,
    incidents: incidents.filter((i) => i.state !== "RESOLVED").length || undefined,
  };

  const groups = ["Build", "Operations", "Governance", "Insights", "Platform"] as const;
  const labelOf = (id: RouteKey) => items.find((i) => i.id === id)?.label ?? id;
  const iconOf = (id: RouteKey) => items.find((i) => i.id === id)?.icon ?? LayoutGrid;

  return (
    <aside className="w-60 shrink-0 bg-s-surface border-r border-s-border flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="h-14 shrink-0 px-4 flex items-center gap-2.5 border-b border-s-border">
        <div className="w-7 h-7 shrink-0 rounded-md bg-gradient-to-br from-s-brand to-s-brand-dim flex items-center justify-center">
          <div className="w-2.5 h-2.5 bg-s-surface rounded-sm" />
        </div>
        <div className="min-w-0 flex flex-col leading-tight">
          <span className="text-s-primary tracking-tight truncate text-[13px] font-semibold">
            AXON IT Agentic AI OS
          </span>
          <span className="text-s-muted font-mono tracking-widest text-[9px]">
            Enterprise v1.0
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-3 px-2">
        {pinned.length > 0 && (
          <div className="mb-3">
            <div className="px-2 pb-1.5 label-mono flex items-center gap-1">
              <Pin size={9} /> Pinned
            </div>
            {pinned.map((id) => {
              const Icon = iconOf(id);
              const active = route === id;
              return (
                <button
                  key={id}
                  onClick={() => setRoute(id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md mb-0.5 min-w-0 text-[13px] ${
                    active ? "bg-s-brand/10 text-s-brand" : "text-s-secondary hover:bg-s-hover hover:text-s-primary"
                  }`}
                >
                  <Icon size={15} className="shrink-0" />
                  <span className="flex-1 truncate text-left">{labelOf(id)}</span>
                  {counts[id] !== undefined && (
                    <span className="shrink-0 font-mono px-1.5 py-0.5 rounded bg-s-subtle text-s-secondary text-[10px]">
                      {counts[id]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {groups.map((g) => (
          <div key={g} className="mb-3">
            <div className="px-2 pb-1.5 label-mono">{g}</div>
            {items
              .filter((i) => i.group === g)
              .map((item) => {
                const Icon = item.icon;
                const active = route === item.id;
                const isPinned = pinned.includes(item.id);
                return (
                  <div key={item.id} className="group">
                    <button
                      onClick={() => setRoute(item.id)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md mb-0.5 min-w-0 transition-colors text-[13px] ${
                        active
                          ? "bg-s-brand/10 text-s-brand"
                          : "text-s-secondary hover:bg-s-hover hover:text-s-primary"
                      }`}
                    >
                      <Icon size={15} className="shrink-0" />
                      <span className="flex-1 truncate text-left">{item.label}</span>
                      {counts[item.id] !== undefined && (
                        <span className="shrink-0 font-mono px-1.5 py-0.5 rounded bg-s-subtle text-s-secondary text-[10px] group-hover:hidden">
                          {counts[item.id]}
                        </span>
                      )}
                      <span
                        onClick={(e) => { e.stopPropagation(); togglePin(item.id); }}
                        className={`shrink-0 p-1 rounded transition-opacity ${
                          isPinned
                            ? "text-s-brand opacity-100"
                            : "text-s-muted opacity-0 group-hover:opacity-100 hover:bg-s-subtle"
                        }`}
                        title={isPinned ? "Unpin" : "Pin"}
                      >
                        <Pin size={10} />
                      </span>
                    </button>
                  </div>
                );
              })}
          </div>
        ))}

        {recent.length > 1 && (
          <div className="mb-3">
            <div className="px-2 pb-1.5 label-mono">Recent</div>
            {recent.slice(1).map((id) => {
              const Icon = iconOf(id);
              return (
                <button
                  key={id}
                  onClick={() => setRoute(id)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md min-w-0 text-s-secondary hover:bg-s-hover hover:text-s-primary text-[12.5px]"
                >
                  <Icon size={14} className="shrink-0" />
                  <span className="truncate">{labelOf(id)}</span>
                </button>
              );
            })}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-s-border p-2">
        <button
          onClick={() => setRoute("settings")}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] ${
            route === "settings" ? "bg-s-brand/10 text-s-brand" : "text-s-secondary hover:bg-s-hover hover:text-s-primary"
          }`}
        >
          <Settings size={15} className="shrink-0" /> Settings
        </button>
        <button
          onClick={onOpenHelp}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-s-secondary hover:bg-s-hover hover:text-s-primary text-[13px]"
        >
          <HelpCircle size={15} className="shrink-0" /> Help & Docs
        </button>
      </div>
    </aside>
  );
}
