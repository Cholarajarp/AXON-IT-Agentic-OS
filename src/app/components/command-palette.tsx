import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ArrowRight, LayoutGrid, GitBranch, GitCommit, Headphones, CloudCog, GraduationCap, Bot, Brain, BrainCircuit, Shield, ShieldCheck, FileCheck2, AlertTriangle, BarChart3, PieChart, Settings, Sun, Moon, Plus, Network, Terminal, MessageSquare, Clock, Cpu, Puzzle, TestTubeDiagonal, Wrench, ListChecks, Code2, Database, Sparkles, Compass, Building2, FolderTree, BadgeDollarSign, FileCode2, Rocket, MonitorSmartphone, ClipboardCheck, Radar, Fingerprint, Gauge, Factory } from "lucide-react";
import { useTheme } from "../lib/store";
import { useRouting, type RouteKey } from "../lib/useRouting";

interface Item {
  id: string;
  label: string;
  hint?: string;
  group: "Navigate" | "Actions" | "Recent";
  icon: typeof LayoutGrid;
  run: () => void;
  keywords?: string;
}

export function CommandPalette({
  open,
  onClose,
  onSubmitGoal,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitGoal: () => void;
}) {
  const { setRoute } = useRouting();
  const { theme, toggle } = useTheme();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const nav: { route: RouteKey; label: string; icon: typeof LayoutGrid }[] = [
      { route: "companyOs", label: "Company OS", icon: Building2 },
      { route: "missionControl", label: "Mission Control", icon: ClipboardCheck },
      { route: "marketRadar", label: "Market Radar", icon: Radar },
      { route: "deliveryBrain", label: "Delivery Brain", icon: BrainCircuit },
      { route: "agenticFinops", label: "Agentic FinOps", icon: Gauge },
      { route: "agentProjects", label: "Agent Projects", icon: Network },
      { route: "productionReadiness", label: "Production Readiness", icon: Factory },
      { route: "structure", label: "Structure Guardian", icon: FolderTree },
      { route: "apiForge", label: "API Forge", icon: FileCode2 },
      { route: "build", label: "Build Studio", icon: Sparkles },
      { route: "enterprise", label: "Enterprise OS", icon: ShieldCheck },
      { route: "releaseCommand", label: "Release Command", icon: Rocket },
      { route: "trustLedger", label: "Trust Ledger", icon: Fingerprint },
      { route: "previewQa", label: "Preview QA", icon: MonitorSmartphone },
      { route: "blueprint", label: "Plans", icon: Compass },
      { route: "code", label: "Code", icon: Code2 },
      { route: "database", label: "Database", icon: Database },
      { route: "security", label: "Security", icon: ShieldCheck },
      { route: "checkpoints", label: "Checkpoints", icon: GitCommit },
      { route: "serviceDesk", label: "Service Desk", icon: Headphones },
      { route: "managedServices", label: "Managed Services", icon: CloudCog },
      { route: "customerDelivery", label: "Customer Delivery", icon: BadgeDollarSign },
      { route: "skillAcademy", label: "Skill Academy", icon: GraduationCap },
      { route: "autonomousWorkforce", label: "Autonomous Workforce", icon: Network },
      { route: "command", label: "Ops Overview", icon: LayoutGrid },
      { route: "workflows", label: "Workflows", icon: GitBranch },
      { route: "dag", label: "Execution DAG", icon: Network },
      { route: "terminal", label: "Terminal", icon: Terminal },
      { route: "chat", label: "Chat", icon: MessageSquare },
      { route: "agents", label: "Agents", icon: Bot },
      { route: "memory", label: "Memory", icon: Brain },
      { route: "policies", label: "Policies", icon: Shield },
      { route: "evidence", label: "Evidence", icon: FileCheck2 },
      { route: "incidents", label: "Incidents", icon: AlertTriangle },
      { route: "audit", label: "Audit Trail", icon: Clock },
      { route: "executive", label: "Executive Dashboard", icon: PieChart },
      { route: "cost", label: "Cost", icon: BarChart3 },
      { route: "models", label: "Models & Providers", icon: Cpu },
      { route: "integrations", label: "Integrations & Marketplace", icon: Puzzle },
      { route: "evaluations", label: "Evaluation Lab", icon: TestTubeDiagonal },
      { route: "tools", label: "Tools", icon: Wrench },
      { route: "pipeline", label: "Safety Pipeline", icon: ListChecks },
      { route: "settings", label: "Settings", icon: Settings },
    ];

    return [
      ...nav.map<Item>((n) => ({
        id: `nav-${n.route}`,
        label: `Go to ${n.label}`,
        hint: "Navigate",
        group: "Navigate",
        icon: n.icon,
        run: () => { setRoute(n.route); onClose(); },
        keywords: n.label,
      })),
      {
        id: "act-submit",
        label: "Submit new goal",
        hint: "⌘ G",
        group: "Actions",
        icon: Plus,
        run: () => { onSubmitGoal(); onClose(); },
      },
      {
        id: "act-theme",
        label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        hint: "⌘ Shift T",
        group: "Actions",
        icon: theme === "dark" ? Sun : Moon,
        run: () => { toggle(); onClose(); },
      },
    ];
  }, [setRoute, theme, toggle, onClose, onSubmitGoal]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(term) ||
        (i.keywords ?? "").toLowerCase().includes(term),
    );
  }, [items, q]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, filtered.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        filtered[active]?.run();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered, active, onClose]);

  if (!open) return null;

  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center pt-24 px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-s-elevated border border-s-border rounded-lg w-full max-w-xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-s-border">
          <Search size={15} className="text-s-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            placeholder="Type a command, search resources, jump anywhere…"
            className="flex-1 bg-transparent outline-none text-s-primary placeholder:text-s-muted"
            style={{ fontSize: "13.5px" }}
          />
          <kbd className="font-mono text-s-muted bg-s-subtle border border-s-border rounded px-1.5 py-0.5" style={{ fontSize: "10px" }}>
            esc
          </kbd>
        </div>

        <div className="max-h-96 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="text-s-muted text-center py-10" style={{ fontSize: "12.5px" }}>
              No results for "{q}"
            </div>
          ) : (
            filtered.map((it, i) => {
              const newGroup = it.group !== lastGroup;
              lastGroup = it.group;
              const Icon = it.icon;
              return (
                <div key={it.id}>
                  {newGroup && (
                    <div className="px-4 pt-2.5 pb-1 label-mono">{it.group}</div>
                  )}
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={it.run}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-left ${
                      i === active ? "bg-s-hover" : ""
                    }`}
                  >
                    <Icon size={14} className="text-s-secondary" />
                    <span className="flex-1 text-s-primary" style={{ fontSize: "13px" }}>{it.label}</span>
                    {it.hint && (
                      <span className="font-mono text-s-muted" style={{ fontSize: "10px" }}>{it.hint}</span>
                    )}
                    {i === active && <ArrowRight size={12} className="text-s-brand" />}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-s-border bg-s-base">
          <div className="flex items-center gap-3 text-s-muted font-mono" style={{ fontSize: "10px" }}>
            <span><kbd className="bg-s-subtle border border-s-border rounded px-1">↑↓</kbd> navigate</span>
            <span><kbd className="bg-s-subtle border border-s-border rounded px-1">↵</kbd> select</span>
          </div>
          <span className="text-s-muted font-mono" style={{ fontSize: "10px" }}>v1.0.0</span>
        </div>
      </div>
    </div>
  );
}
