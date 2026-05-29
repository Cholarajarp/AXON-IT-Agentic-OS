import { useEffect, useRef, useState, type ReactNode } from "react";
import { Search, Bell, Sun, Moon, ChevronDown, LogOut, User, Building2, HelpCircle, Command, X, CheckCircle2, AlertTriangle, Database } from "lucide-react";
import { useTheme } from "../lib/store";
import { useRouting, type RouteKey } from "../lib/useRouting";
import { useAcknowledgeAlert, useAlerts, useApprovals, usePlatformHealth, useWorkspaceSettings } from "../lib/queries";

const titles: Record<RouteKey, string> = {
  companyOs: "Company OS",
  missionControl: "Mission Control",
  marketRadar: "Market Radar",
  trustLedger: "Trust Ledger",
  agenticFinops: "Agentic FinOps",
  agentProjects: "Agent Projects",
  productionReadiness: "Production Readiness",
  deliveryBrain: "Delivery Brain",
  structure: "Structure Guardian",
  build: "Build Studio",
  enterprise: "Enterprise OS",
  releaseCommand: "Release Command",
  previewQa: "Preview QA",
  security: "Security",
  checkpoints: "Checkpoints",
  serviceDesk: "Service Desk",
  managedServices: "Managed Services",
  customerDelivery: "Customer Delivery",
  apiForge: "API Forge",
  skillAcademy: "Skill Academy",
  autonomousWorkforce: "Autonomous Workforce",
  command: "Ops Overview",
  workflows: "Workflows",
  dag: "Execution DAG",
  terminal: "Terminal",
  chat: "Chat",
  agents: "Agents",
  memory: "Memory",
  policies: "Policies",
  evidence: "Evidence",
  incidents: "Incidents",
  audit: "Audit Trail",
  cost: "Cost",
  executive: "Executive",
  models: "Models & Providers",
  blueprint: "Plans",
  integrations: "Integrations",
  evaluations: "Evaluation Lab",
  code: "Code",
  tools: "Tools",
  pipeline: "Safety Pipeline",
  database: "Database",
  settings: "Settings",
};

const groupOf: Record<RouteKey, string> = {
  companyOs: "Build",
  missionControl: "Build",
  marketRadar: "Build",
  trustLedger: "Governance",
  agenticFinops: "Build",
  agentProjects: "Build",
  productionReadiness: "Build",
  deliveryBrain: "Build",
  structure: "Platform",
  build: "Build",
  enterprise: "Build",
  releaseCommand: "Build",
  previewQa: "Build",
  security: "Build",
  checkpoints: "Build",
  serviceDesk: "Build",
  managedServices: "Build",
  customerDelivery: "Build",
  apiForge: "Platform",
  skillAcademy: "Build",
  autonomousWorkforce: "Build",
  command: "Operations",
  workflows: "Operations",
  dag: "Operations",
  terminal: "Operations",
  chat: "Operations",
  agents: "Operations",
  memory: "Operations",
  policies: "Governance",
  evidence: "Governance",
  incidents: "Governance",
  audit: "Governance",
  executive: "Insights",
  cost: "Insights",
  models: "Insights",
  blueprint: "Build",
  integrations: "Platform",
  evaluations: "Platform",
  code: "Build",
  tools: "Governance",
  pipeline: "Governance",
  database: "Build",
  settings: "Workspace",
};

export function TopBar({ onOpenPalette, onOpenHelp }: { onOpenPalette: () => void; onOpenHelp: () => void }) {
  const { route, setRoute } = useRouting();
  const { theme, toggle } = useTheme();
  const { data: alerts = [] } = useAlerts();
  const { data: approvals = [] } = useApprovals();
  const settings = useWorkspaceSettings();
  const health = usePlatformHealth();
  const acknowledgeAlert = useAcknowledgeAlert();

  const topbarRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [projOpen, setProjOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const notifCount = alerts.length + approvals.filter((a) => a.status === "PENDING").length;
  const workspace = settings.data?.workspace;
  const runtime = settings.data?.runtime;
  const workspaceName = workspace?.name ?? "AXON Workspace";
  const tenantId = workspace?.tenantId ?? "tenant_default";
  const region = workspace?.region?.trim() || "Set in Settings";
  const operatorLabel = workspaceName.trim() || "AXON Workspace";
  const operatorMeta = tenantId.trim() || "Workspace operator";
  const avatarInitial = operatorLabel.slice(0, 1).toUpperCase() || "A";
  const apiLive = runtime?.backendConnected && !health.isError;
  const dbReady = health.data?.services.database === "connected";
  const pendingApprovals = approvals.filter((a) => a.status === "PENDING");
  const visibleAlerts = alerts.slice(0, 4);

  const closeAll = () => { setMenuOpen(false); setProjOpen(false); setNotifOpen(false); };

  useEffect(() => {
    if (!menuOpen && !projOpen && !notifOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!topbarRef.current?.contains(event.target as Node)) closeAll();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAll();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, projOpen, notifOpen]);

  const markAlertsRead = () => {
    void Promise.all(alerts.map((alert) => acknowledgeAlert.mutateAsync(alert.id))).finally(() => setNotifOpen(false));
  };

  return (
    <header ref={topbarRef} className="sticky top-0 h-[52px] shrink-0 bg-s-surface/95 backdrop-blur-xl border-b border-s-border flex items-center px-4 gap-2 min-w-0 z-20">
      <div className="flex items-center gap-1.5 min-w-0 text-[12.5px]">
        <button onClick={() => setRoute("build")} className="shrink-0 text-s-muted hover:text-s-primary">
          Axon
        </button>
        <span className="shrink-0 text-s-muted">/</span>
        <span className="shrink-0 text-s-muted hidden sm:inline">{groupOf[route]}</span>
        <span className="shrink-0 text-s-muted hidden sm:inline">/</span>
        <span className="shrink-0 text-s-primary font-medium">{titles[route]}</span>
      </div>

      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        <div className="relative">
          <button
            onClick={() => { closeAll(); setProjOpen((v) => !v); }}
            className="flex h-8 items-center gap-1.5 px-2 rounded-md border border-s-border bg-s-surface text-s-primary hover:border-s-border-strong hover:bg-s-hover text-[12px]"
          >
            <Building2 size={13} className="text-s-muted shrink-0" />
            <span className="hidden md:inline truncate max-w-[130px]">{workspaceName}</span>
            <span
              className={`hidden md:inline shrink-0 px-1 rounded font-mono uppercase tracking-wider border text-[9px] ${
                runtime?.backendConnected
                  ? "bg-s-success/10 text-s-success border-s-success/30"
                  : "bg-s-warning/10 text-s-warning border-s-warning/30"
              }`}
            >
              {runtime?.backendConnected ? "live" : "offline"}
            </span>
            <ChevronDown size={11} className="text-s-muted shrink-0" />
          </button>
          {projOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-s-elevated border border-s-border rounded-md py-1 z-50">
              <div className="px-3 py-2 flex items-center justify-between border-b border-s-border">
                <span className="label-mono">Workspace</span>
                <button onClick={() => setProjOpen(false)} className="rounded p-1 text-s-muted hover:bg-s-hover hover:text-s-primary" aria-label="Close workspace menu">
                  <X size={13} />
                </button>
              </div>
              <div className="px-3 py-3">
                <div className="text-s-primary truncate text-[13px] font-medium">{workspaceName}</div>
                <div className="text-s-muted font-mono text-[10px]">{tenantId}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                <MiniMeta label="Region" value={region} />
                <MiniMeta label="Source" value="/api/v1/settings" />
              </div>
              <button
                onClick={() => { setRoute("settings"); setProjOpen(false); }}
                className="w-full text-left px-3 py-2 border-t border-s-border text-s-primary hover:bg-s-hover flex items-center gap-2 text-[12.5px]"
              >
                <User size={13} /> Edit workspace settings
              </button>
            </div>
          )}
        </div>

        <div className="hidden xl:flex items-center gap-1.5">
          <StatusChip
            icon={apiLive ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
            tone={apiLive ? "success" : "warning"}
            label={apiLive ? "API live" : "API offline"}
          />
          <StatusChip
            icon={dbReady ? <Database size={12} /> : <AlertTriangle size={12} />}
            tone={dbReady ? "success" : "warning"}
            label={dbReady ? "DB ready" : "DB degraded"}
          />
        </div>

        <button
          onClick={onOpenPalette}
          className="hidden md:flex h-8 items-center gap-2 w-60 2xl:w-80 px-2.5 rounded-md bg-s-subtle border border-s-border hover:border-s-border-strong hover:bg-s-hover text-left text-[12.5px]"
        >
          <Search size={13} className="text-s-muted shrink-0" />
          <span className="flex-1 text-s-muted truncate">Search or run command…</span>
          <kbd className="shrink-0 font-mono text-s-muted bg-s-surface border border-s-border rounded px-1 text-[10px]">
            ⌘K
          </kbd>
        </button>

        <button
          onClick={onOpenPalette}
          aria-label="Command palette"
          className="md:hidden w-8 h-8 rounded-md border border-s-border flex items-center justify-center text-s-secondary hover:text-s-primary hover:bg-s-hover"
        >
          <Command size={14} />
        </button>

        <button
          onClick={toggle}
          aria-label="Toggle theme"
          className="w-8 h-8 rounded-md border border-s-border flex items-center justify-center text-s-secondary hover:text-s-primary hover:bg-s-hover"
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <button
          onClick={onOpenHelp}
          aria-label="Help"
          className="hidden sm:flex w-8 h-8 rounded-md border border-s-border items-center justify-center text-s-secondary hover:text-s-primary hover:bg-s-hover"
        >
          <HelpCircle size={14} />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { closeAll(); setNotifOpen((v) => !v); }}
            aria-label="Notifications"
            className="relative w-8 h-8 rounded-md border border-s-border flex items-center justify-center text-s-secondary hover:text-s-primary hover:bg-s-hover"
          >
            <Bell size={14} />
            {notifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-s-critical text-white font-mono px-0.5 flex items-center justify-center text-[9px]">
                {notifCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-s-elevated border border-s-border rounded-md z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-s-border flex items-center justify-between">
                <div>
                  <span className="text-s-primary text-[13px] font-medium">Notifications</span>
                  <div className="text-s-muted text-[11px]">{notifCount} open signal{notifCount === 1 ? "" : "s"}</div>
                </div>
                <div className="flex items-center gap-1">
                  {alerts.length > 0 && (
                    <button onClick={markAlertsRead} className="text-s-muted hover:text-s-primary text-[11px] px-2 py-1 rounded hover:bg-s-hover">
                      Clear
                    </button>
                  )}
                  <button onClick={() => setNotifOpen(false)} className="rounded p-1 text-s-muted hover:bg-s-hover hover:text-s-primary" aria-label="Close notifications">
                    <X size={13} />
                  </button>
                </div>
              </div>
              <div className="max-h-[360px] overflow-y-auto p-2">
                {visibleAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    onClick={() => acknowledgeAlert.mutate(alert.id)}
                    className="w-full rounded-md px-3 py-2 text-left hover:bg-s-hover"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-s-critical/30 bg-s-critical/10 px-1.5 py-0.5 text-[10px] font-mono text-s-critical">{alert.severity}</span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-s-primary">{alert.title}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-s-muted truncate">{alert.source}</div>
                  </button>
                ))}
                {pendingApprovals.slice(0, 4).map((approval) => (
                  <button
                    key={approval.id}
                    onClick={() => { setRoute("policies"); setNotifOpen(false); }}
                    className="w-full rounded-md px-3 py-2 text-left hover:bg-s-hover"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-s-warning/30 bg-s-warning/10 px-1.5 py-0.5 text-[10px] font-mono text-s-warning">{approval.severity}</span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-s-primary">{approval.title}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-s-muted truncate">Approval · blast radius {approval.blastRadius}</div>
                  </button>
                ))}
                {notifCount === 0 && (
                  <div className="py-8 text-center text-s-muted text-[12.5px]">
                    No open notifications
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => { closeAll(); setMenuOpen((v) => !v); }}
            className="flex items-center gap-1 pl-1 pr-1.5 py-1 rounded-md hover:bg-s-hover"
          >
            <div className="w-7 h-7 rounded-full bg-s-info flex items-center justify-center text-white text-[11px] font-semibold shrink-0">
              {avatarInitial}
            </div>
            <ChevronDown size={11} className="text-s-muted shrink-0" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-s-elevated border border-s-border rounded-md py-1 z-50">
              <div className="px-3 py-2.5 border-b border-s-border flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-s-info flex items-center justify-center text-white text-[11px] font-semibold shrink-0">
                  {avatarInitial}
                </div>
                <div className="min-w-0 flex-1">
                <div className="text-s-primary text-[13px] font-medium truncate">{operatorLabel}</div>
                <div className="text-s-muted font-mono text-[10px] truncate">{operatorMeta}</div>
                </div>
                <button onClick={() => setMenuOpen(false)} className="rounded p-1 text-s-muted hover:bg-s-hover hover:text-s-primary" aria-label="Close account menu">
                  <X size={13} />
                </button>
              </div>
              <button
                onClick={() => { setRoute("settings"); setMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-s-primary hover:bg-s-hover flex items-center gap-2 text-[12.5px]"
              >
                <User size={13} /> Profile & Settings
              </button>
              <button
                onClick={() => { onOpenHelp(); setMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-s-primary hover:bg-s-hover flex items-center gap-2 text-[12.5px]"
              >
                <HelpCircle size={13} /> Help & Shortcuts
              </button>
              <div className="border-t border-s-border my-1" />
              <button className="w-full text-left px-3 py-1.5 text-s-critical hover:bg-s-hover flex items-center gap-2 text-[12.5px]">
                <LogOut size={13} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function StatusChip({ icon, label, tone }: { icon: ReactNode; label: string; tone: "success" | "warning" }) {
  const style = tone === "success"
    ? "border-s-success/25 bg-s-success/10 text-s-success"
    : "border-s-warning/25 bg-s-warning/10 text-s-warning";
  return (
    <span className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-[11px] font-mono ${style}`}>
      {icon}
      {label}
    </span>
  );
}

function MiniMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-s-border bg-s-subtle p-2 min-w-0">
      <div className="label-mono mb-1">{label}</div>
      <div className="truncate font-mono text-[10px] text-s-primary">{value}</div>
    </div>
  );
}
