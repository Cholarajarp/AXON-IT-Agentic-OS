import { useMemo, useState } from "react";
import {
  Activity,
  Boxes,
  CheckCircle2,
  GitPullRequest,
  KeyRound,
  Loader2,
  PlugZap,
  RadioTower,
  RefreshCw,
  Shield,
  Slack,
  Wrench,
} from "lucide-react";
import { Button, Card, CardHeader, EmptyState, Kpi, PageHeader, SeverityBadge } from "../components/ui/primitives";
import {
  useConfigureIntegration,
  useIntegrations,
  useSkills,
  type ConnectorRuntimeStatus,
  type IntegrationStatus,
} from "../lib/queries";
import { useRouting } from "../lib/useRouting";

const icons: Record<string, typeof PlugZap> = {
  github: GitPullRequest,
  slack: Slack,
  jira: Boxes,
  datadog: Activity,
  pagerduty: RadioTower,
  servicenow: Wrench,
};

const statusClass: Record<ConnectorRuntimeStatus, string> = {
  "needs-config": "text-s-muted",
  disabled: "text-s-secondary",
  configured: "text-s-info",
  connected: "text-s-success",
  degraded: "text-s-warning",
};

const statusCopy: Record<ConnectorRuntimeStatus, string> = {
  "needs-config": "Needs credentials",
  disabled: "Disabled",
  configured: "Configured, verification pending",
  connected: "Connected",
  degraded: "Configured but unhealthy",
};

export function Integrations() {
  const integrations = useIntegrations();
  const skills = useSkills();
  const configure = useConfigureIntegration();
  const { setRoute } = useRouting();
  const connectors = integrations.data ?? [];
  const skillPacks = skills.data?.skills ?? [];
  const enabledSkills = skillPacks.filter((skill) => skill.enabled).length;
  const configured = connectors.filter((item) => item.configured).length;
  const enabled = connectors.filter((item) => item.enabled).length;
  const currentType = connectors[0]?.type ?? "";

  const [selectedType, setSelectedType] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [enabledConfig, setEnabledConfig] = useState(true);

  const selectedConnector = useMemo(
    () => connectors.find((item) => item.type === (selectedType || currentType)) ?? connectors[0],
    [connectors, currentType, selectedType],
  );

  const configureSelected = async () => {
    if (!selectedConnector || !baseUrl.trim()) return;
    await configure.mutateAsync({
      type: selectedConnector.type,
      baseUrl: baseUrl.trim(),
      token: token.trim() || undefined,
      enabled: enabledConfig,
    });
    setToken("");
  };

  const pickConnector = (connector: IntegrationStatus) => {
    setSelectedType(connector.type);
    setBaseUrl(connector.baseUrl ?? "");
    setEnabledConfig(connector.enabled || !connector.configured);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Integrations & Marketplace"
        description="Backend-backed connector posture, scoped credentials, and enabled skill packs"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={13} />} onClick={() => integrations.refetch()}>
              Refresh
            </Button>
            <Button variant="primary" size="sm" icon={<PlugZap size={14} />} onClick={() => setRoute("settings")}>
              Provider keys
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Registered Connectors" value={String(connectors.length)} hint="Backend adapters" />
        <Kpi label="Configured" value={`${configured}/${connectors.length || 0}`} hint="Stored in runtime registry" />
        <Kpi label="Enabled" value={String(enabled)} hint="Allowed for workflows" />
        <Kpi label="Skill Packs" value={`${enabledSkills}/${skillPacks.length || 0}`} hint="Enabled capabilities" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="Connector setup" subtitle="Configure real endpoints before agents can use external systems" action={<KeyRound size={14} className="text-s-brand" />} />
          <div className="p-4 space-y-4">
            {connectors.length === 0 ? (
              <EmptyState icon={<PlugZap size={18} />} title="No connectors registered" description="Backend connector registry did not return any adapters." />
            ) : (
              <>
                <label className="block">
                  <span className="label-mono mb-1.5 block">Connector</span>
                  <select
                    value={selectedConnector?.type ?? ""}
                    onChange={(event) => {
                      const connector = connectors.find((item) => item.type === event.target.value);
                      if (connector) pickConnector(connector);
                    }}
                    className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand"
                  >
                    {connectors.map((connector) => (
                      <option key={connector.type} value={connector.type}>{connector.name}</option>
                    ))}
                  </select>
                </label>
                <Field label="Base URL" value={baseUrl} onChange={setBaseUrl} placeholder="https://api.vendor.com" />
                <Field label="Token" type="password" value={token} onChange={setToken} placeholder="Paste a scoped token" />
                <label className="flex items-center justify-between gap-3 rounded-md border border-s-border bg-s-base p-3">
                  <span>
                    <span className="block text-[12.5px] font-medium text-s-primary">Enabled for agent workflows</span>
                    <span className="block text-[11px] text-s-muted">Write actions still require policy and approval gates.</span>
                  </span>
                  <input type="checkbox" checked={enabledConfig} onChange={(event) => setEnabledConfig(event.target.checked)} className="h-4 w-4 accent-s-brand" />
                </label>
                <Button
                  variant="primary"
                  icon={configure.isPending ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />}
                  onClick={configureSelected}
                  disabled={configure.isPending || !selectedConnector || baseUrl.trim().length < 8}
                  className="w-full justify-center"
                >
                  {configure.isPending ? "Saving connector" : "Save connector config"}
                </Button>
                {selectedConnector && (
                  <div className="rounded-md border border-s-border bg-s-subtle p-3 text-[12px] leading-relaxed text-s-secondary">
                    <div className="font-medium text-s-primary">{selectedConnector.setupHint}</div>
                    <div className="mt-1">{selectedConnector.productionNote}</div>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Connection posture" subtitle="Live backend registry state, no hardcoded connected systems" />
          {integrations.isLoading ? (
            <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Loading connectors" />
          ) : connectors.length === 0 ? (
            <EmptyState icon={<PlugZap size={18} />} title="No connectors available" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3">
              {connectors.map((item) => {
                const Icon = icons[item.type] ?? PlugZap;
                return (
                  <button
                    key={item.type}
                    onClick={() => pickConnector(item)}
                    className="rounded-md bg-s-base border border-s-border p-3 text-left transition-colors hover:border-s-brand/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-md bg-s-subtle border border-s-border flex items-center justify-center text-s-brand">
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-s-primary text-[13px] font-medium">{item.name}</span>
                            <span className="text-s-muted text-[10px]">{item.category}</span>
                          </div>
                          <div className="mt-1 text-[11px] leading-relaxed text-s-secondary">{statusCopy[item.status]}</div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.scopes.map((scope) => (
                              <span key={scope} className="font-mono text-[10px] text-s-secondary bg-s-subtle border border-s-border rounded px-1.5 py-0.5">
                                {scope}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-mono uppercase text-[10px] ${statusClass[item.status]}`}>{item.status}</div>
                        <div className="text-s-muted font-mono text-[10px] mt-1">{item.enabled ? "enabled" : "off"}</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-s-border flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-s-secondary text-[11px]">{item.baseUrl ?? item.setupHint}</span>
                      <span className="text-s-brand text-[11px] font-medium">Configure</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="Enabled skill packs" subtitle="Runtime capabilities loaded from backend skill registry" action={<SeverityBadge level="LOW" />} />
          {skills.isLoading ? (
            <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Loading skill packs" />
          ) : skillPacks.length === 0 ? (
            <EmptyState icon={<Wrench size={18} />} title="No skill packs registered" description="Create skill packs in Settings to expand agent behavior." />
          ) : (
            <div className="divide-y divide-s-border">
              {skillPacks.map((pack) => (
                <div key={pack.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-s-primary text-[13px] font-medium">{pack.name}</span>
                      <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${pack.enabled ? "bg-s-success/10 text-s-success border-s-success/20" : "bg-s-subtle text-s-muted border-s-border"}`}>
                        {pack.enabled ? "enabled" : "disabled"}
                      </span>
                    </div>
                    <div className="text-s-secondary text-[11.5px] mt-1">{pack.description}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {pack.capabilities.slice(0, 5).map((capability) => (
                        <span key={capability} className="font-mono text-[10px] text-s-muted bg-s-subtle border border-s-border rounded px-1.5 py-0.5">
                          {capability}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setRoute("settings")}>
                    Manage
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Security posture" subtitle="Controls applied before a connector can run" />
          <div className="p-4 space-y-3">
            {[
              { icon: KeyRound, title: "Secret vault binding", desc: "Credentials are accepted through backend config routes and never echoed after save." },
              { icon: Shield, title: "Scope diff review", desc: "Connector scopes are visible before operators enable workflow use." },
              { icon: RadioTower, title: "Webhook verification", desc: "Production adapters must add signature checks, replay windows, nonce cache, and rate limits." },
              { icon: Wrench, title: "Tool dry-run mode", desc: "Write actions remain behind policy, blast-radius, and approval gates." },
              { icon: CheckCircle2, title: "Audit emitters", desc: "Connector reads and writes can be hash-chained into the Trust Ledger." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-3">
                  <Icon size={14} className="text-s-brand mt-0.5" />
                  <div>
                    <div className="text-s-primary text-[12.5px] font-medium">{item.title}</div>
                    <div className="text-s-secondary text-[11.5px]">{item.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
      />
    </label>
  );
}
