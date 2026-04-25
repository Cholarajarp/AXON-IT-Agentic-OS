import { useMemo, useState } from "react";
import { ArrowRight, AlertTriangle, BookOpen, CheckCircle2, Compass, DollarSign, Network, Rocket, Server, Shield, SlidersHorizontal, Sparkles } from "lucide-react";
import { Button, Card, CardHeader, Kpi, PageHeader, SeverityBadge } from "../components/ui/primitives";
import { useApproveProductBlueprint, useCreateProductBlueprint, useLaunchProductBlueprint, useModelCatalog, useModelRuntimeStatus, useProductBlueprints, useProductCatalog, type ServiceBlueprint } from "../lib/queries";
import { useRouting } from "../lib/useRouting";

const researchSources = [
  {
    name: "OpenHands",
    url: "openhands.dev/product/gui",
    label: "workspace-first",
    detail: "Collaborative agent workspace, sandboxed runtime, diff review, and shareable execution context.",
  },
  {
    name: "Continue",
    url: "docs.continue.dev/checks/quickstart",
    label: "repo-native checks",
    detail: "Checks live beside code, run in CI, and return actionable suggested fixes instead of opaque output.",
  },
  {
    name: "LangGraph",
    url: "docs.langchain.com/oss/python/langgraph/overview",
    label: "durable runtime",
    detail: "Interrupts, memory, streaming, and long-running workflows are first-class rather than hidden.",
  },
] as const;

const stackLayers = [
  {
    title: "Operator shell",
    summary: "One cockpit for command, search, execution, and evidence.",
    items: ["Command center", "Sidebar", "Top bar", "Blueprint lab"],
  },
  {
    title: "Planner + runtime",
    summary: "Goal classification, DAG generation, approval gates, and durable execution.",
    items: ["IntentAgent", "StackResearchAgent", "SolutionArchitectAgent", "Scheduler"],
  },
  {
    title: "Provider router",
    summary: "Model choice must respect cost, context, sovereignty, latency, health, and enterprise boundary.",
    items: ["Anthropic", "OpenAI", "Google Gemini", "AWS Bedrock", "Vertex AI", "Ollama"],
  },
  {
    title: "Governance plane",
    summary: "Audit trail, policy enforcement, evidence capture, and human approval.",
    items: ["Policies", "Approvals", "Evidence", "Audit trail"],
  },
  {
    title: "Delivery quality",
    summary: "Release gates, evals, and cost baselines keep the platform honest.",
    items: ["Evaluation Lab", "Cost", "Incidents", "Executive"],
  },
] as const;

const failureModes = [
  "Random regex-driven stack selection instead of source-backed standards.",
  "Provider support shown in the UI before the runtime can actually connect.",
  "Chat-only workflows without approvals, audit evidence, or rollback paths.",
  "A single-provider bias that turns the platform into a hidden dependency.",
];

const guardrails = [
  "Research sources before architecture decisions.",
  "Show provider readiness and setup requirements in the product shell.",
  "Keep launch blocked until budget, approval, and health checks pass.",
  "Treat evals and evidence as release artifacts, not optional extras.",
];

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function Blueprint() {
  const { data: catalog } = useModelCatalog();
  const { data: runtimeStatus } = useModelRuntimeStatus();
  const { data: productCatalog } = useProductCatalog();
  const { data: blueprints } = useProductBlueprints();
  const createBlueprint = useCreateProductBlueprint();
  const approveBlueprint = useApproveProductBlueprint();
  const launchBlueprint = useLaunchProductBlueprint();
  const { setRoute } = useRouting();
  const [goal, setGoal] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [integrations, setIntegrations] = useState("");
  const [compliance, setCompliance] = useState("");
  const [activeBlueprint, setActiveBlueprint] = useState<ServiceBlueprint | null>(null);

  const liveProviders = useMemo(() => new Set(runtimeStatus?.providers ?? []), [runtimeStatus]);
  const healthyProviders = runtimeStatus?.health.filter((provider) => provider.healthy).length ?? 0;
  const catalogProviders = catalog?.modelCatalog ?? [];
  const serviceCount = productCatalog?.services.length ?? 0;
  const blueprintCount = blueprints?.blueprints.length ?? 0;
  const liveProviderCount = liveProviders.size;
  const sovereignProviderCount = catalogProviders.filter((provider) => provider.models.some((model) => model.sovereign)).length;
  const blockedProviderCount = Math.max(0, catalogProviders.length - liveProviderCount);
  const operatingState = blockedProviderCount === 0 && liveProviderCount > 0 ? "Ready" : healthyProviders > 0 ? "Partial" : "Blocked";
  const operatingCopy = blockedProviderCount === 0
    ? "All catalogued providers are live and the shell can route without guessing."
    : `${blockedProviderCount} provider${blockedProviderCount === 1 ? "" : "s"} still need setup before the shell is fully green.`;
  const blueprintScore = Math.min(100, 58 + healthyProviders * 10 + liveProviderCount * 4 + sovereignProviderCount * 4 + researchSources.length * 2 - blockedProviderCount * 2);

  const handleGenerateBlueprint = async () => {
    const blueprint = await createBlueprint.mutateAsync({
      goal,
      customerName,
      integrations: parseList(integrations),
      compliance: parseList(compliance),
    });
    setActiveBlueprint(blueprint);
  };

  const handleApproveBlueprint = async () => {
    if (!activeBlueprint) return;
    const blueprint = await approveBlueprint.mutateAsync(activeBlueprint.id);
    setActiveBlueprint(blueprint);
  };

  const handleLaunchBlueprint = async () => {
    if (!activeBlueprint) return;
    const result = await launchBlueprint.mutateAsync({ id: activeBlueprint.id });
    setActiveBlueprint(result.blueprint);
    setRoute("dag");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Blueprint Lab"
        description="Source-backed platform standards, provider readiness, and build guardrails"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<SlidersHorizontal size={13} />} onClick={() => setRoute("models")}>
              Provider setup
            </Button>
            <Button variant="primary" size="sm" icon={<ArrowRight size={13} />} onClick={() => setRoute("evaluations")}>
              Check release gates
            </Button>
          </div>
        }
      />

      <Card className="overflow-hidden">
        <CardHeader
          title="Product Factory intake"
          subtitle="Turn a business request into a priced, traceable service blueprint"
          action={<SeverityBadge level="P1" />}
        />
        <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-4 p-4">
          <div className="space-y-3 min-w-0">
            <label className="block min-w-0">
              <span className="label-mono mb-2 block">Customer</span>
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Customer or internal product owner"
                className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none transition-colors placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <label className="block min-w-0">
              <span className="label-mono mb-2 block">Request</span>
              <textarea
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                rows={5}
                placeholder="Describe the real product/service outcome, users, repository context, acceptance criteria, integrations, and release target."
                className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] leading-relaxed text-s-primary outline-none transition-colors placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block min-w-0">
                <span className="label-mono mb-2 block">Integrations</span>
                <input
                  value={integrations}
                  onChange={(event) => setIntegrations(event.target.value)}
                  placeholder="GitHub, Slack, ServiceNow"
                  className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none transition-colors placeholder:text-s-muted focus:border-s-brand"
                />
              </label>
              <label className="block min-w-0">
                <span className="label-mono mb-2 block">Compliance</span>
                <input
                  value={compliance}
                  onChange={(event) => setCompliance(event.target.value)}
                  placeholder="SOC 2, ISO 27001"
                  className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none transition-colors placeholder:text-s-muted focus:border-s-brand"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                icon={<Sparkles size={13} />}
                onClick={handleGenerateBlueprint}
                disabled={createBlueprint.isPending || goal.trim().length < 8}
              >
                {createBlueprint.isPending ? "Generating" : "Generate blueprint"}
              </Button>
              <span className="text-[11px] text-s-muted">
                {serviceCount} catalog services · {blueprintCount} blueprints in memory
              </span>
            </div>
          </div>

          <div className="min-w-0 rounded-md border border-s-border bg-s-base">
            {activeBlueprint ? (
              <div className="p-4 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[14px] font-medium text-s-primary">{activeBlueprint.templateName}</span>
                      <span className="rounded border border-s-brand/30 bg-s-brand/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-s-brand">
                        {activeBlueprint.category}
                      </span>
                      <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-s-secondary">
                        {activeBlueprint.status}
                      </span>
                    </div>
                    <p className="text-[12px] leading-relaxed text-s-secondary">{activeBlueprint.goal}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant={activeBlueprint.status === "draft" ? "success" : "secondary"}
                      size="sm"
                      icon={<CheckCircle2 size={13} />}
                      onClick={handleApproveBlueprint}
                      disabled={approveBlueprint.isPending || activeBlueprint.status !== "draft"}
                    >
                      {activeBlueprint.status === "draft" ? "Approve" : "Approved"}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Rocket size={13} />}
                      onClick={handleLaunchBlueprint}
                      disabled={launchBlueprint.isPending || activeBlueprint.status === "draft" || activeBlueprint.status === "executing"}
                    >
                      {activeBlueprint.status === "executing" ? "Launched" : "Launch"}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <div className="rounded-md border border-s-border bg-s-subtle p-2">
                    <div className="label-mono mb-1">Timeline</div>
                    <div className="font-mono text-[14px] text-s-primary">{activeBlueprint.estimates.timelineDays}d</div>
                  </div>
                  <div className="rounded-md border border-s-border bg-s-subtle p-2">
                    <div className="label-mono mb-1">Effort</div>
                    <div className="font-mono text-[14px] text-s-primary">{activeBlueprint.estimates.effortPersonDays}pd</div>
                  </div>
                  <div className="rounded-md border border-s-border bg-s-subtle p-2">
                    <div className="label-mono mb-1">Estimate</div>
                    <div className="font-mono text-[14px] text-s-primary">${activeBlueprint.estimates.cost.totalUsd.toLocaleString("en-US")}</div>
                  </div>
                  <div className="rounded-md border border-s-border bg-s-subtle p-2">
                    <div className="label-mono mb-1">Evidence</div>
                    <div className="font-mono text-[14px] text-s-primary">{activeBlueprint.evidenceRequirements.length}</div>
                  </div>
                </div>
                {activeBlueprint.execution && (
                  <div className="rounded-md border border-s-brand/30 bg-s-brand/10 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="label-mono mb-1 text-s-brand">Workflow launched</div>
                        <div className="font-mono text-[12px] text-s-primary truncate">
                          {activeBlueprint.execution.workflowId} · {activeBlueprint.execution.tasks} tasks
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" icon={<Network size={13} />} onClick={() => setRoute("dag")}>
                        Open DAG
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <div className="label-mono mb-2">Backlog</div>
                    <div className="space-y-2">
                      {activeBlueprint.backlog.map((item) => (
                        <div key={item.id} className="rounded-md border border-s-border bg-s-surface p-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono text-s-secondary">{item.id}</span>
                            <span className="text-[12px] font-medium text-s-primary truncate">{item.title}</span>
                          </div>
                          <div className="mt-1 text-[10px] text-s-muted">{item.ownerAgent} · {item.priority}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="label-mono mb-2">Architecture</div>
                    <p className="text-[12px] leading-relaxed text-s-secondary">{activeBlueprint.architecture.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {activeBlueprint.architecture.stack.map((item) => (
                        <span key={item} className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[10px] font-mono text-s-secondary">
                          {item}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 label-mono mb-2">Traceability</div>
                    <div className="space-y-1.5">
                      {activeBlueprint.traceability.slice(0, 4).map((item) => (
                        <div key={item.requirementId} className="flex items-start gap-2 text-[11px] text-s-secondary">
                          <CheckCircle2 size={11} className="mt-0.5 text-s-success shrink-0" />
                          <span><span className="font-mono text-s-primary">{item.requirementId}</span> → {item.backlogItemIds.join(", ") || "BL-001"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center p-6 text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-s-border bg-s-subtle text-s-muted">
                  <DollarSign size={18} />
                </div>
                <div className="text-[13px] font-medium text-s-primary">No generated blueprint yet</div>
                <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-s-secondary">
                  Submit the intake form to produce scope, cost, backlog, architecture, evidence, and traceability from one source of truth.
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="relative overflow-hidden border border-s-border/80 bg-gradient-to-br from-s-surface via-s-base to-s-surface">
        <div className="relative grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-5 p-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-s-brand/30 bg-s-brand/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-s-brand">
                Source-backed
              </span>
              <span className="rounded-full border border-s-border bg-s-subtle px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-s-secondary">
                StackResearchAgent
              </span>
              <span className="rounded-full border border-s-border bg-s-subtle px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-s-secondary">
                {liveProviders.size} live providers
              </span>
            </div>

            <div className="flex items-start gap-3">
              <Compass size={18} className="mt-1 text-s-brand shrink-0" />
              <div className="min-w-0">
                <h2 className="text-[20px] font-medium tracking-tight text-s-primary">Build from standards, not from guesswork.</h2>
                <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-s-secondary">
                  This platform now has a place for stack research, routing standards, and provider readiness. The goal is to make the operator see the same truth the runtime sees.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {researchSources.map((source) => (
                <div key={source.name} className="rounded-md border border-s-border bg-s-base p-3 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-s-primary truncate">{source.name}</div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-s-muted">{source.url}</div>
                    </div>
                    <span className="rounded border border-s-border bg-s-surface px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-s-secondary">
                      {source.label}
                    </span>
                  </div>
                  <div className="text-[11px] leading-relaxed text-s-secondary">{source.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-md border border-s-border bg-s-base p-4">
              <div className="flex items-center gap-2 mb-3">
                <SlidersHorizontal size={14} className="text-s-brand" />
                <span className="label-mono">Operating posture</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-s-primary">{operatingState}</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-s-secondary">{operatingCopy}</p>
                </div>
                <span className={`rounded border px-2 py-1 text-[10px] font-mono uppercase tracking-wider ${operatingState === "Ready" ? "border-s-success/30 bg-s-success/10 text-s-success" : operatingState === "Partial" ? "border-s-warning/30 bg-s-warning/10 text-s-warning" : "border-s-border bg-s-subtle text-s-secondary"}`}>
                  {blueprintScore}%
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-md border border-s-border bg-s-subtle p-2 min-w-0">
                  <div className="flex items-center gap-1.5 text-s-muted mb-1">
                    <Server size={13} />
                    <span className="text-[9px] font-mono uppercase tracking-wider truncate">Live</span>
                  </div>
                  <div className="text-[13px] font-mono text-s-primary truncate">{liveProviderCount}</div>
                </div>
                <div className="rounded-md border border-s-border bg-s-subtle p-2 min-w-0">
                  <div className="flex items-center gap-1.5 text-s-muted mb-1">
                    <CheckCircle2 size={13} />
                    <span className="text-[9px] font-mono uppercase tracking-wider truncate">Healthy</span>
                  </div>
                  <div className="text-[13px] font-mono text-s-primary truncate">{healthyProviders}</div>
                </div>
                <div className="rounded-md border border-s-border bg-s-subtle p-2 min-w-0">
                  <div className="flex items-center gap-1.5 text-s-muted mb-1">
                    <Shield size={13} />
                    <span className="text-[9px] font-mono uppercase tracking-wider truncate">Sovereign</span>
                  </div>
                  <div className="text-[13px] font-mono text-s-primary truncate">{sovereignProviderCount}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" icon={<SlidersHorizontal size={13} />} onClick={() => setRoute("models")}>
                  Provider setup
                </Button>
                <Button variant="ghost" size="sm" icon={<Compass size={13} />} onClick={() => setRoute("command")}>
                  Command center
                </Button>
              </div>
            </div>

            <div className="rounded-md border border-s-border bg-s-base p-4">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={14} className="text-s-brand" />
                <span className="label-mono">Build rules</span>
              </div>
              <div className="space-y-2.5">
                {guardrails.map((rule) => (
                  <div key={rule} className="flex items-start gap-2 text-[12px] text-s-secondary">
                    <CheckCircle2 size={12} className="mt-0.5 text-s-success shrink-0" />
                    <span>{rule}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-s-border bg-s-base p-4">
              <div className="flex items-center gap-2 mb-3">
                <Server size={14} className="text-s-brand" />
                <span className="label-mono">Router health</span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-mono text-[28px] font-medium tabular-nums text-s-primary">{healthyProviders}/{liveProviders.size}</span>
                <span className="text-[11px] text-s-muted">healthy providers</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {catalogProviders.map((provider) => (
                  <span
                    key={provider.provider}
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${liveProviders.has(provider.provider) ? "border-s-success/30 bg-s-success/10 text-s-success" : "border-s-border bg-s-subtle text-s-secondary"}`}
                  >
                    {provider.provider}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi label="Blueprint Score" value={`${blueprintScore}%`} delta={blueprintScore > 85 ? "strong" : "building"} trend={blueprintScore > 85 ? "up" : "flat"} hint="Composite readiness signal" />
        <Kpi label="Research Signals" value={String(researchSources.length)} hint="OpenHands, Continue, LangGraph" />
        <Kpi label="Live Providers" value={String(liveProviders.size)} delta={`${healthyProviders} healthy`} trend={healthyProviders > 0 ? "up" : "flat"} hint="Seen by the router" />
        <Kpi label="Guardrails" value={String(guardrails.length)} hint="Blocking conditions and standards" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.95fr] gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="Reference stack" subtitle="The shape of a serious agentic platform" action={<SeverityBadge level="HIGH" />} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
            {stackLayers.map((layer) => (
              <div key={layer.title} className="rounded-md border border-s-border bg-s-base p-3 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-s-primary truncate">{layer.title}</div>
                    <div className="text-[11px] text-s-secondary leading-relaxed mt-1">{layer.summary}</div>
                  </div>
                  <span className="rounded border border-s-border bg-s-surface px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-s-secondary">
                    layer
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {layer.items.map((item) => (
                    <span key={item} className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[10px] font-mono text-s-secondary">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4 min-w-0">
          <Card className="overflow-hidden">
            <CardHeader title="What to avoid" subtitle="The failure modes we are designing out" />
            <div className="p-4 space-y-2.5">
              {failureModes.map((item) => (
                <div key={item} className="flex items-start gap-2 text-[12px] text-s-secondary">
                  <AlertTriangle size={12} className="mt-0.5 text-s-warning shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Blueprint pipeline" subtitle="How research becomes execution" />
            <div className="p-4 space-y-3">
              {[
                { step: "1", label: "Research", detail: "StackResearchAgent gathers source-backed patterns and platform signals." },
                { step: "2", label: "Architect", detail: "SolutionArchitectAgent turns research into a concrete architecture plan." },
                { step: "3", label: "Secure", detail: "SecurityAgent checks providers, policies, and risk boundaries." },
                { step: "4", label: "Sequence", detail: "PMOAgent creates the delivery roadmap and milestones." },
                { step: "5", label: "Document", detail: "DocumentationAgent publishes the approved blueprint for the team." },
              ].map((item, index, all) => (
                <div key={item.step} className="flex items-start gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-s-brand/10 border border-s-brand/30 text-s-brand flex items-center justify-center shrink-0 font-mono text-[10px]">
                    {item.step}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-s-primary">{item.label}</span>
                      {index === 0 && <span className="rounded border border-s-brand/30 bg-s-brand/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-s-brand">agent</span>}
                    </div>
                    <div className="mt-1 text-[11px] text-s-secondary leading-relaxed">{item.detail}</div>
                  </div>
                  {index < all.length - 1 && <Network size={12} className="mt-1 shrink-0 text-s-muted" />}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
