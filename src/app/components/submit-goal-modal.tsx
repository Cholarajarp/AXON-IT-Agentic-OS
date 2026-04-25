import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, GitBranch, Loader2, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Modal, Button, EmptyState } from "./ui/primitives";
import { useToast } from "../lib/toast";
import { useSubmitGoal, useExecuteWorkflow, useModelCatalog, useModelRuntimeStatus, type ModelRoute } from "../lib/queries";

const domains = ["Software Delivery", "SRE", "Security", "Compliance", "Data Platform", "Product"] as const;

const providerLabels: Record<ModelRoute["provider"], string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google Gemini",
  bedrock: "AWS Bedrock",
  vertexai: "Vertex AI",
  ollama: "Ollama",
  local: "Local Runtime",
};

const providerSetup: Partial<Record<ModelRoute["provider"], { env: string[]; note: string }>> = {
  anthropic: {
    env: ["ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL (optional)"],
    note: "Uses the Anthropic Messages API with your local key or gateway URL.",
  },
  openai: {
    env: ["OPENAI_API_KEY", "OPENAI_BASE_URL (optional)"],
    note: "Uses OpenAI chat completions directly from the backend router.",
  },
  google: {
    env: ["GOOGLE_API_KEY", "GOOGLE_BASE_URL (optional)"],
    note: "Uses the Gemini REST API for source-backed planning and review.",
  },
  vertexai: {
    env: ["GCP_PROJECT_ID", "GCP_LOCATION", "GOOGLE_APPLICATION_CREDENTIALS (optional)"],
    note: "Uses Vertex AI REST with Google ADC or a service account JSON.",
  },
  ollama: {
    env: ["OLLAMA_BASE_URL"],
    note: "Routes to a local Ollama runtime for offline or sovereign workflows.",
  },
  bedrock: {
    env: ["AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN (optional)", "BEDROCK_CLAUDE_MODEL_ID (optional)", "BEDROCK_NOVA_MODEL_ID (optional)"],
    note: "Uses AWS Bedrock Runtime through IAM credentials with optional model-ID overrides.",
  },
};

export function SubmitGoalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const submitGoalMutation = useSubmitGoal();
  const executeWorkflow = useExecuteWorkflow();
  const { data: catalog, isLoading, isError, refetch } = useModelCatalog({ enabled: open });
  const { data: runtimeStatus } = useModelRuntimeStatus({ enabled: open });
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [domain, setDomain] = useState<(typeof domains)[number]>("Software Delivery");
  const [agentFlow, setAgentFlow] = useState("AutonomousSDLC");
  const [provider, setProvider] = useState<ModelRoute["provider"]>("anthropic");
  const [model, setModel] = useState("claude-sonnet-4-5");
  const [mode, setMode] = useState<ModelRoute["mode"]>("balanced");
  const [maxCostUsd, setMaxCostUsd] = useState(15);
  const [requiresApproval, setRequiresApproval] = useState(true);

  const liveProviders = useMemo(() => new Set(runtimeStatus?.providers ?? []), [runtimeStatus]);

  const providerModels = useMemo(
    () => catalog?.modelCatalog.find((entry) => entry.provider === provider)?.models ?? [],
    [catalog, provider],
  );

  const selectedModel = providerModels.find((entry) => entry.id === model);
  const providerIsLive = !runtimeStatus || liveProviders.has(provider);
  const providerState = runtimeStatus
    ? providerIsLive
      ? "Connected"
      : "Setup required"
    : "Checking status";

  const providerNote = providerSetup[provider]?.note ?? "Select a supported provider to continue.";

  const reset = () => {
    setName("");
    setGoal("");
    setRepositoryUrl("");
    setDomain("Software Delivery");
    setAgentFlow("AutonomousSDLC");
    setProvider("anthropic");
    setModel("claude-sonnet-4-5");
    setMode("balanced");
    setMaxCostUsd(15);
    setRequiresApproval(true);
  };

  const submit = async () => {
    if (!name.trim() || !goal.trim() || !catalog) return;

    if (runtimeStatus && !providerIsLive) {
      toast({
        kind: "error",
        title: "Provider not connected",
        description: `${providerLabels[provider]} is not live yet. Open Models & Providers to finish setup.`,
      });
      return;
    }

    try {
      const payload = {
        name: name.trim(),
        goal: goal.trim(),
        domain,
        repositoryUrl: repositoryUrl.trim() || undefined,
        agentFlow,
        modelRoute: {
          provider,
          model,
          mode,
          maxCostUsd,
          requiresApproval,
        },
      };
      const wf = await submitGoalMutation.mutateAsync(payload);
      executeWorkflow.mutate({ workflowId: wf.id, goal: wf.goal, domain: wf.domain, budget: wf.budget });
      toast({ kind: "success", title: "Agent flow launched", description: `${agentFlow} is routing through ${provider}/${model}` });
      reset();
      onClose();
    } catch (error) {
      toast({
        kind: "error",
        title: "Failed to launch agent flow",
        description: error instanceof Error ? error.message : "The backend rejected the launch request",
      });
    }
  };

  const inputCls =
    "w-full px-3 py-2 rounded-md bg-s-subtle border border-s-border text-s-primary placeholder:text-s-muted outline-none focus:border-s-brand/50";

  return (
    <Modal open={open} onClose={onClose} title="Launch Agent Flow" width={780}>
      {isLoading ? (
        <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Loading model catalog" description="Reading live backend routing configuration." />
      ) : isError || !catalog ? (
        <EmptyState
          icon={<SlidersHorizontal size={18} />}
          title="Model catalog unavailable"
          description="Start the backend and database before launching production agent flows."
          action={<Button variant="primary" size="sm" onClick={() => refetch()}>Retry</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-5">
          <div className="flex flex-col gap-4 min-w-0">
            <div>
              <label className="label-mono mb-1.5 block">Workflow Name</label>
              <input
                className={`${inputCls} text-[13px]`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Repair failing CI and open production PR"
              />
            </div>

            <div>
              <label className="label-mono mb-1.5 block">Repository URL</label>
              <div className="relative">
                <GitBranch size={13} className="absolute left-3 top-2.5 text-s-muted" />
                <input
                  className={`${inputCls} pl-8 text-[13px]`}
                  value={repositoryUrl}
                  onChange={(e) => setRepositoryUrl(e.target.value)}
                  placeholder="https://github.com/org/repo"
                />
              </div>
            </div>

            <div>
              <label className="label-mono mb-1.5 block">Goal Description</label>
              <textarea
                className={`${inputCls} text-[13px] resize-y`}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Describe the outcome. Include constraints, branch, tests, rollout target, and acceptance criteria."
                rows={5}
              />
            </div>

            <div>
              <label className="label-mono mb-1.5 block">Work Domain</label>
              <div className="flex flex-wrap gap-1.5">
                {domains.map((item) => (
                  <button
                    key={item}
                    onClick={() => setDomain(item)}
                    className={`px-2.5 py-1 rounded-md border text-[12px] transition-colors ${
                      domain === item
                        ? "bg-s-brand/10 text-s-brand border-s-brand/40"
                        : "border-s-border text-s-secondary hover:border-s-border-strong"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 min-w-0">
            <div>
              <label className="label-mono mb-1.5 block">Agent Flow</label>
              <select className={`${inputCls} text-[13px]`} value={agentFlow} onChange={(e) => setAgentFlow(e.target.value)}>
                {catalog.agentFlows.map((flow) => (
                  <option key={flow.id} value={flow.id}>
                    {flow.label} - {flow.agents.join(" + ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-mono mb-1.5 block">Provider</label>
                <select
                  className={`${inputCls} text-[13px]`}
                  value={provider}
                  onChange={(e) => {
                    const nextProvider = e.target.value as ModelRoute["provider"];
                    const nextModel = catalog.modelCatalog.find((entry) => entry.provider === nextProvider)?.models[0]?.id;
                    setProvider(nextProvider);
                    if (nextModel) setModel(nextModel);
                  }}
                >
                  {catalog.modelCatalog.map((entry) => (
                    <option
                      key={entry.provider}
                      value={entry.provider}
                      disabled={Boolean(runtimeStatus && !liveProviders.has(entry.provider))}
                    >
                      {providerLabels[entry.provider] ?? entry.provider}
                      {runtimeStatus
                        ? liveProviders.has(entry.provider)
                          ? " (live)"
                          : " (setup)"
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-mono mb-1.5 block">Model</label>
                <select className={`${inputCls} text-[13px]`} value={model} onChange={(e) => setModel(e.target.value)}>
                  {providerModels.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label-mono mb-1.5 block">Routing Mode</label>
              <div className="grid grid-cols-2 gap-1.5">
                {catalog.routingModes.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setMode(item.id)}
                    className={`text-left p-2 rounded-md border transition-colors ${
                      mode === item.id ? "border-s-brand/50 bg-s-brand/10" : "border-s-border bg-s-base hover:border-s-border-strong"
                    }`}
                  >
                    <div className="text-s-primary text-[12px] font-medium">{item.label}</div>
                    <div className="text-s-secondary text-[10.5px] mt-0.5 leading-snug">{item.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div
              className={`rounded-md border p-3 ${
                providerIsLive
                  ? "border-s-success/30 bg-s-success/10"
                  : "border-s-warning/30 bg-s-warning/10"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {providerIsLive ? (
                  <CheckCircle2 size={14} className="text-s-success" />
                ) : (
                  <AlertTriangle size={14} className="text-s-warning" />
                )}
                <span className="text-s-primary text-[12.5px] font-medium">{providerState}</span>
              </div>
              <div className="text-s-secondary text-[11.5px] leading-relaxed">{providerNote}</div>
              {providerSetup[provider]?.env && providerSetup[provider]!.env.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {providerSetup[provider]!.env.map((envVar) => (
                    <span key={envVar} className="rounded border border-s-border bg-s-base px-1.5 py-0.5 text-[10px] font-mono text-s-secondary">
                      {envVar}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {selectedModel && (
              <div className="rounded-md bg-s-base border border-s-border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 size={14} className="text-s-success" />
                  <span className="text-s-primary text-[12.5px] font-medium">{selectedModel.label}</span>
                </div>
                <div className="text-s-secondary text-[11.5px] mb-3">{selectedModel.fit}</div>
                <div className="grid grid-cols-3 gap-2">
                  <Meter label="Quality" value={selectedModel.quality} />
                  <Meter label="Latency" value={selectedModel.latency} />
                  <Meter label="Cost" value={100 - selectedModel.cost} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <label className="label-mono mb-1.5 block">Max Cost USD</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  className={`${inputCls} text-[13px] font-mono`}
                  value={maxCostUsd}
                  onChange={(e) => setMaxCostUsd(Number(e.target.value))}
                />
              </div>
              <button
                onClick={() => setRequiresApproval((value) => !value)}
                className={`h-9 px-3 rounded-md border flex items-center gap-2 text-[12px] ${
                  requiresApproval ? "bg-s-success/10 border-s-success/30 text-s-success" : "border-s-border text-s-secondary"
                }`}
              >
                <ShieldCheck size={13} />
                Approval
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-s-border">
              <span className="text-[11px] text-s-muted font-mono">
                API-only launch. Backend credentials and database state are required. Provider state is refreshed from the live router.
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose} disabled={submitGoalMutation.isPending}>Cancel</Button>
                <Button
                  variant="primary"
                  onClick={submit}
                  disabled={!name.trim() || !goal.trim() || !providerIsLive || submitGoalMutation.isPending}
                  icon={submitGoalMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : undefined}
                >
                  {submitGoalMutation.isPending ? "Launching..." : providerIsLive ? "Launch" : "Connect provider"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="label-mono">{label}</span>
        <span className="font-mono text-s-secondary text-[10px]">{value}</span>
      </div>
      <div className="h-1.5 bg-s-subtle rounded-full overflow-hidden">
        <div className="h-full bg-s-brand rounded-full" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
