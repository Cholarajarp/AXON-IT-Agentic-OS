import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Activity, Copy, Cpu, Gauge, Loader2, RefreshCw, Route, Server, Shield, Zap } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, Kpi, PageHeader, SeverityBadge } from "../components/ui/primitives";
import { useModelCatalog, useModelRuntimeStatus, type ModelCatalogResponse, type ModelRoute, type ModelRuntimeStatus } from "../lib/queries";
import { useToast } from "../lib/toast";

type CatalogProvider = ModelCatalogResponse["modelCatalog"][number];
type CatalogModel = CatalogProvider["models"][number];

const providerLabels: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google Gemini",
  bedrock: "AWS Bedrock",
  vertexai: "Vertex AI",
  ollama: "Ollama",
  local: "Local Runtime",
};

const providerSetup: Partial<Record<ModelRoute["provider"], { env: string[]; note: string; snippet: string }>> = {
  anthropic: {
    env: ["ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL (optional)"],
    note: "Direct Anthropic Messages API access.",
    snippet: "ANTHROPIC_API_KEY=your_key_here\nANTHROPIC_BASE_URL=https://api.anthropic.com/v1",
  },
  openai: {
    env: ["OPENAI_API_KEY", "OPENAI_BASE_URL (optional)"],
    note: "OpenAI chat completions routed through the backend.",
    snippet: "OPENAI_API_KEY=your_key_here\nOPENAI_BASE_URL=https://api.openai.com/v1",
  },
  google: {
    env: ["GOOGLE_API_KEY", "GOOGLE_BASE_URL (optional)"],
    note: "Gemini REST API for large-context planning and synthesis.",
    snippet: "GOOGLE_API_KEY=your_key_here\nGOOGLE_BASE_URL=https://generativelanguage.googleapis.com/v1beta",
  },
  vertexai: {
    env: ["GCP_PROJECT_ID", "GCP_LOCATION", "GOOGLE_APPLICATION_CREDENTIALS (optional)"],
    note: "Vertex AI REST with Google ADC or a service account JSON.",
    snippet: "GCP_PROJECT_ID=your-gcp-project\nGCP_LOCATION=us-central1\nGOOGLE_APPLICATION_CREDENTIALS=C:\\path\\to\\service-account.json",
  },
  ollama: {
    env: ["OLLAMA_BASE_URL"],
    note: "Local Ollama runtime for private or offline execution.",
    snippet: "OLLAMA_BASE_URL=http://localhost:11434",
  },
  bedrock: {
    env: ["AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN (optional)", "BEDROCK_CLAUDE_MODEL_ID (optional)", "BEDROCK_NOVA_MODEL_ID (optional)"],
    note: "AWS Bedrock Runtime via IAM credentials with optional model-ID overrides.",
    snippet: "AWS_REGION=ap-south-1\nAWS_ACCESS_KEY_ID=...\nAWS_SECRET_ACCESS_KEY=...\nAWS_SESSION_TOKEN=...\nBEDROCK_CLAUDE_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0\nBEDROCK_NOVA_MODEL_ID=amazon.nova-pro-v1:0",
  },
};

export function Models() {
  const { data: catalog, isLoading, isError, error, refetch, isFetching } = useModelCatalog();
  const { data: runtimeStatus, refetch: refetchRuntime } = useModelRuntimeStatus();
  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const { toast } = useToast();

  const providers = catalog?.modelCatalog ?? [];
  const visibleProviders = selectedProvider === "all" ? providers : providers.filter((p) => p.provider === selectedProvider);
  const allModels = useMemo(() => providers.flatMap((p) => p.models.map((model) => ({ provider: p.provider, model }))), [providers]);
  const sovereignCount = allModels.filter(({ model }) => model.sovereign).length;
  const bestQuality = allModels.reduce<CatalogModel | null>((best, item) => (!best || item.model.quality > best.quality ? item.model : best), null);
  const liveProviders = new Set(runtimeStatus?.providers ?? []);
  const healthyProviders = runtimeStatus?.health.filter((provider) => provider.healthy).length ?? 0;

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Models & Routing" description="Backend-governed provider catalog, model routes, and agent-flow selection" />
        <Card>
          <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Loading model catalog" description="AXON is reading the backend routing registry." />
        </Card>
      </div>
    );
  }

  if (isError || !catalog) {
    return (
      <div>
        <PageHeader title="Models & Routing" description="Backend-governed provider catalog, model routes, and agent-flow selection" />
        <Card>
          <EmptyState
            icon={<Server size={18} />}
            title="Model registry unavailable"
            description={error instanceof Error ? error.message : "Start the AXON backend and set VITE_API_URL to the API origin."}
            action={<Button variant="primary" size="sm" icon={<RefreshCw size={13} />} onClick={() => refetch()}>Retry</Button>}
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Models & Routing"
        description="Choose provider, model, routing mode, budget gates, and agent flow before execution"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />} onClick={() => refetch()}>Refresh catalog</Button>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={13} className={runtimeStatus ? "" : "animate-spin"} />} onClick={() => refetchRuntime()}>Refresh health</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Kpi label="Connected Providers" value={String(liveProviders.size)} delta={`${healthyProviders} healthy`} trend={healthyProviders === liveProviders.size ? "up" : "flat"} hint="Backed by the live router" />
        <Kpi label="Selectable Models" value={String(allModels.length)} hint="Available in launch composer" />
        <Kpi label="Sovereign Routes" value={String(sovereignCount)} delta={sovereignCount ? "ready" : "none"} trend={sovereignCount ? "up" : "flat"} hint="Local or enterprise-boundary options" />
        <Kpi label="Top Quality" value={bestQuality ? `${bestQuality.quality}` : "0"} hint={bestQuality?.label ?? "No model registered"} />
      </div>

      <Card className="mb-5 overflow-hidden">
        <CardHeader title="Provider connectivity" subtitle="Only live providers are selectable in the launch modal. Setup snippets are ready to copy." />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
          {providers.map((provider) => (
            <ProviderConnectivityCard
              key={provider.provider}
              provider={provider}
              live={liveProviders.has(provider.provider)}
              health={runtimeStatus?.health.find((entry) => entry.name === provider.provider)}
                onCopy={async () => {
                  const setup = providerSetup[provider.provider];
                  if (!setup) return;

                  try {
                    await navigator.clipboard.writeText(setup.snippet);
                    toast({ kind: "success", title: "Setup copied", description: `${provider.provider} environment snippet copied to clipboard.` });
                  } catch {
                    toast({ kind: "error", title: "Copy failed", description: "Clipboard access was blocked by the browser." });
                  }
              }}
            />
          ))}
        </div>
      </Card>

      <Card className="mb-5 overflow-hidden">
        <CardHeader title="Routing Modes" subtitle="Execution policy passed with every submitted goal" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 p-4">
          {catalog.routingModes.map((mode) => (
            <div key={mode.id} className="rounded-md border border-s-border bg-s-subtle p-3 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Route size={13} className="text-s-brand shrink-0" />
                <span className="text-[12px] font-medium text-s-primary truncate">{mode.label}</span>
              </div>
              <p className="text-[11px] text-s-secondary leading-relaxed">{mode.description}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4">
        <button
          onClick={() => setSelectedProvider("all")}
          className={`shrink-0 rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors ${selectedProvider === "all" ? "border-s-brand bg-s-brand/10 text-s-brand" : "border-s-border text-s-secondary hover:text-s-primary"}`}
        >
          All providers
        </button>
        {providers.map((provider) => (
          <button
            key={provider.provider}
            onClick={() => setSelectedProvider(provider.provider)}
            className={`shrink-0 rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors ${selectedProvider === provider.provider ? "border-s-brand bg-s-brand/10 text-s-brand" : "border-s-border text-s-secondary hover:text-s-primary"}`}
          >
            {providerLabels[provider.provider] ?? provider.provider}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
        {visibleProviders.map((provider) => (
          <ProviderCard
            key={provider.provider}
            provider={provider}
            live={liveProviders.has(provider.provider)}
            health={runtimeStatus?.health.find((entry) => entry.name === provider.provider)}
          />
        ))}
      </div>

      <Card>
        <CardHeader title="Agent Flows" subtitle="Reusable orchestration topologies for serious software delivery" />
        <div className="divide-y divide-s-border">
          {catalog.agentFlows.map((flow) => (
            <div key={flow.id} className="px-4 py-3 grid grid-cols-1 lg:grid-cols-[220px_1fr_90px] gap-3 items-center">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-s-primary truncate">{flow.label}</div>
                <div className="text-[10px] font-mono text-s-muted">{flow.id}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {flow.agents.map((agent) => (
                  <span key={agent} className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[10px] font-mono text-s-secondary">
                    {agent}
                  </span>
                ))}
              </div>
              <SeverityBadge level={flow.risk.toUpperCase() as "LOW" | "MEDIUM" | "HIGH"} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ProviderCard({
  provider,
  live,
  health,
}: {
  provider: CatalogProvider;
  live: boolean;
  health?: ModelRuntimeStatus["health"][number];
}) {
  const sovereign = provider.models.some((model) => model.sovereign);
  const avgQuality = Math.round(provider.models.reduce((sum, model) => sum + model.quality, 0) / Math.max(provider.models.length, 1));
  const statusLabel = live ? (health?.healthy === false ? "Degraded" : "Connected") : "Setup";
  const statusClass = live
    ? health?.healthy === false
      ? "border-s-warning/30 bg-s-warning/10 text-s-warning"
      : "border-s-success/30 bg-s-success/10 text-s-success"
    : "border-s-warning/30 bg-s-warning/10 text-s-warning";

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={providerLabels[provider.provider] ?? provider.provider}
        subtitle={`${provider.models.length} selectable models`}
        action={
          <div className="flex items-center gap-2">
            <span className={`rounded border px-2 py-1 text-[10px] font-mono uppercase ${statusClass}`}>{statusLabel}</span>
            {sovereign && <span className="rounded border border-s-brand/30 bg-s-brand/10 px-2 py-1 text-[10px] font-mono uppercase text-s-brand">Sovereign</span>}
          </div>
        }
      />
      <div className="p-4">
        {health && live && (
          <div className="mb-4 rounded-md border border-s-border bg-s-subtle px-3 py-2 text-[11px] text-s-secondary">
            <div className="flex items-center justify-between gap-2">
              <span>{health.healthy ? "Healthy" : "Degraded"}</span>
              <span className="font-mono text-s-muted">{health.consecutiveFailures} failures</span>
            </div>
            <div className="mt-1 font-mono text-[10px] text-s-muted">
              Last checked {new Date(health.lastChecked).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Metric icon={<Cpu size={13} />} label="Models" value={String(provider.models.length)} />
          <Metric icon={<Gauge size={13} />} label="Avg quality" value={String(avgQuality)} />
          <Metric icon={<Shield size={13} />} label="Boundary" value={sovereign ? "Mixed" : "Cloud"} />
        </div>
        <div className="space-y-3">
          {provider.models.map((model) => (
            <div key={model.id} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-s-primary truncate">{model.label}</div>
                  <div className="text-[10px] font-mono text-s-muted truncate">{model.id}</div>
                </div>
                {model.sovereign && <Shield size={14} className="text-s-brand shrink-0" />}
              </div>
              <p className="text-[11px] text-s-secondary leading-relaxed mb-3">{model.fit}</p>
              <div className="grid grid-cols-3 gap-2">
                <Score icon={<Activity size={12} />} label="Quality" value={model.quality} />
                <Score icon={<Zap size={12} />} label="Latency" value={model.latency} />
                <Score icon={<Gauge size={12} />} label="Cost" value={model.cost} inverted />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function ProviderConnectivityCard({
  provider,
  live,
  health,
  onCopy,
}: {
  provider: CatalogProvider;
  live: boolean;
  health?: ModelRuntimeStatus["health"][number];
  onCopy: () => void | Promise<void>;
}) {
  const setup = providerSetup[provider.provider];
  const stateLabel = live ? (health?.healthy === false ? "Degraded" : "Connected") : "Setup required";
  const stateClass = live
    ? health?.healthy === false
      ? "border-s-warning/30 bg-s-warning/10 text-s-warning"
      : "border-s-success/30 bg-s-success/10 text-s-success"
    : "border-s-warning/30 bg-s-warning/10 text-s-warning";

  return (
    <div className="rounded-md border border-s-border bg-s-base p-3 min-w-0">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-[13px] font-medium text-s-primary truncate">{providerLabels[provider.provider] ?? provider.provider}</div>
            <span className="text-[10px] font-mono text-s-muted uppercase tracking-wider">{provider.provider}</span>
          </div>
          <div className="text-[11px] text-s-secondary mt-1 leading-relaxed">{setup?.note ?? "Provider connection metadata unavailable."}</div>
        </div>
        <span className={`rounded border px-2 py-1 text-[10px] font-mono uppercase shrink-0 ${stateClass}`}>{stateLabel}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(setup?.env ?? []).map((envVar) => (
          <span key={envVar} className="rounded border border-s-border bg-s-surface px-1.5 py-0.5 text-[10px] font-mono text-s-secondary">
            {envVar}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-[10px] font-mono text-s-muted min-w-0 truncate">
          {live
            ? health?.healthy === false
              ? `${health.consecutiveFailures} consecutive failures`
              : `Healthy ${health ? `· ${health.totalRequests} checks` : ''}`
            : "Copy setup to connect"}
        </div>
        <Button variant="ghost" size="sm" icon={<Copy size={12} />} onClick={onCopy} disabled={!setup}>
          Copy setup
        </Button>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-s-border bg-s-subtle p-2 min-w-0">
      <div className="flex items-center gap-1.5 text-s-muted mb-1">
        {icon}
        <span className="text-[9px] font-mono uppercase tracking-wider truncate">{label}</span>
      </div>
      <div className="text-[13px] font-mono text-s-primary truncate">{value}</div>
    </div>
  );
}

function Score({ icon, label, value, inverted = false }: { icon: ReactNode; label: string; value: number; inverted?: boolean }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = inverted && pct <= 35 ? "bg-s-success" : pct >= 85 ? "bg-s-success" : pct >= 60 ? "bg-s-brand" : "bg-s-warning";

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="flex items-center gap-1 text-[10px] text-s-muted">{icon}{label}</span>
        <span className="text-[10px] font-mono text-s-secondary">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-s-subtle overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
