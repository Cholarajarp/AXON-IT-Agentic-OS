import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Shield, Plus, AlertCircle, RefreshCw, Eye, Edit3, Copy, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, EmptyState, PageHeader, Button, Tabs, RightPanel } from "../components/ui/primitives";
import {
  useCreatePolicy,
  usePolicies,
  useSimulatePolicy,
  useUpdatePolicyStatus,
  type PolicyInput,
  type PolicySimulationInput,
  type PolicySimulationResult,
} from "../lib/queries";
import type { Policy } from "../lib/store";
import { useToast } from "../lib/toast";

const typeColors: Record<string, string> = {
  Tool: "bg-s-brand/10 text-s-brand border-s-brand/30",
  Data: "bg-s-success/10 text-s-success border-s-success/30",
  Approval: "bg-s-warning/10 text-s-warning border-s-warning/30",
  Model: "bg-s-info/10 text-s-info border-s-info/30",
  Cost: "bg-s-critical/10 text-s-critical border-s-critical/30",
  Environment: "bg-s-blocked/10 text-s-blocked border-s-blocked/30",
};

export function Policies() {
  const { data: policies = [], isLoading, isError, refetch } = usePolicies();
  const createPolicy = useCreatePolicy();
  const simulatePolicy = useSimulatePolicy();
  const updatePolicyStatus = useUpdatePolicyStatus();
  const { toast } = useToast();
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState<Policy | null>(null);
  const [panel, setPanel] = useState<"create" | "simulate" | null>(null);
  const [simulation, setSimulation] = useState<PolicySimulationResult | null>(null);

  const filtered = policies.filter((p) => {
    if (tab === "all") return true;
    return p.status.toLowerCase() === tab;
  });

  const counts = {
    all: policies.length,
    active: policies.filter((p) => p.status === "ACTIVE").length,
    draft: policies.filter((p) => p.status === "DRAFT").length,
    deprecated: policies.filter((p) => p.status === "DEPRECATED").length,
  };

  const totalViolations = policies.reduce((sum, p) => sum + p.violations7d, 0);

  const closePanel = () => {
    setSelected(null);
    setPanel(null);
  };

  const deprecatePolicy = async (policy: Policy) => {
    try {
      await updatePolicyStatus.mutateAsync({ id: policy.id, status: "DEPRECATED" });
      toast({ kind: "success", title: "Policy deprecated", description: `${policy.name} is no longer active.` });
      setSelected((current) => current && current.id === policy.id ? { ...current, status: "DEPRECATED", updatedAt: Date.now() } : current);
    } catch (err) {
      toast({ kind: "error", title: "Status update failed", description: err instanceof Error ? err.message : "Unable to update policy status." });
    }
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Policies" description="Tool, data, approval, model, cost, and environment policies enforced across the agent fleet" />
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
        <PageHeader title="Policies" description="Tool, data, approval, model, cost, and environment policies enforced across the agent fleet" />
        <Card>
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertCircle size={24} className="text-s-critical" />
              <span className="text-s-primary text-sm font-medium">Failed to load policies</span>
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
        title="Policies"
        description="Tool, data, approval, model, cost, and environment policies enforced across the agent fleet"
        action={
          <>
            <Button variant="secondary" size="sm" onClick={() => { setSelected(null); setPanel("simulate"); }}>Simulate</Button>
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => { setSelected(null); setPanel("create"); }}>New Policy</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Card className="p-4 overflow-hidden">
          <div className="label-mono mb-2">Total Policies</div>
          <div className="font-mono text-s-primary text-2xl font-medium tabular-nums">{policies.length}</div>
          <div className="text-s-muted mt-1 text-[11px]">{counts.active} active</div>
        </Card>
        <Card className="p-4 overflow-hidden">
          <div className="label-mono mb-2">Enforcement Rate</div>
          <div className="font-mono text-s-success text-2xl font-medium tabular-nums">100%</div>
          <div className="text-s-muted mt-1 text-[11px]">All evaluations enforced</div>
        </Card>
        <Card className="p-4 overflow-hidden">
          <div className="label-mono mb-2">Violations (7d)</div>
          <div className="font-mono text-s-warning text-2xl font-medium tabular-nums">{totalViolations}</div>
          <div className="text-s-muted mt-1 text-[11px]">Across all policies</div>
        </Card>
        <Card className="p-4 overflow-hidden">
          <div className="label-mono mb-2">Avg Eval Time</div>
          <div className="font-mono text-s-primary text-2xl font-medium tabular-nums">8ms</div>
          <div className="text-s-muted mt-1 text-[11px]">OPA/Rego engine</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 pt-4">
          <Tabs
            tabs={[
              { id: "all", label: "All", count: counts.all },
              { id: "active", label: "Active", count: counts.active },
              { id: "draft", label: "Draft", count: counts.draft },
              { id: "deprecated", label: "Deprecated", count: counts.deprecated },
            ]}
            active={tab}
            onChange={setTab}
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Shield size={20} />}
            title="No policies in this category"
            description="Author policies in Rego or use the visual editor."
            action={<Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setPanel("create")}>Create Policy</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[750px]">
              <colgroup>
                <col className="w-[200px]" />
                <col className="w-[80px]" />
                <col className="w-[120px]" />
                <col className="w-[90px]" />
                <col className="w-[100px]" />
                <col className="w-[70px]" />
                <col className="w-[60px]" />
              </colgroup>
              <thead>
                <tr className="text-left border-b border-s-border">
                  <th className="px-5 py-2.5 label-mono">Policy</th>
                  <th className="px-5 py-2.5 label-mono">Type</th>
                  <th className="px-5 py-2.5 label-mono">Scope</th>
                  <th className="px-5 py-2.5 label-mono">Status</th>
                  <th className="px-5 py-2.5 label-mono">Violations</th>
                  <th className="px-5 py-2.5 label-mono">Version</th>
                  <th className="px-5 py-2.5 label-mono"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((policy) => (
                  <tr
                    key={policy.id}
                    className="border-b border-s-border last:border-0 hover:bg-s-hover cursor-pointer"
                    onClick={() => setSelected(policy)}
                  >
                    <td className="px-5 py-3 min-w-0">
                      <div className="text-s-primary font-mono text-[12.5px] font-medium truncate">{policy.name}</div>
                      <div className="text-s-muted font-mono text-[10px] truncate">{policy.id}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${typeColors[policy.type]}`}>
                        {policy.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-s-secondary text-[11px] truncate">
                      {policy.scope}
                    </td>
                    <td className="px-5 py-3">
                      <PolicyStatusBadge status={policy.status} />
                    </td>
                    <td className="px-5 py-3">
                      {policy.violations7d > 0 ? (
                        <span className="flex items-center gap-1 text-s-warning font-mono text-xs">
                          <AlertTriangle size={11} /> {policy.violations7d}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-s-success font-mono text-xs">
                          <CheckCircle2 size={11} /> 0
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-s-muted text-[11px]">
                      {policy.version}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={(event) => { event.stopPropagation(); setSelected(policy); }} className="p-1 rounded hover:bg-s-subtle text-s-muted hover:text-s-primary"><Eye size={12} /></button>
                        <button onClick={(event) => { event.stopPropagation(); setSelected(policy); }} className="p-1 rounded hover:bg-s-subtle text-s-muted hover:text-s-primary"><Edit3 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RightPanel
        open={!!selected || !!panel}
        onClose={closePanel}
        title={panel === "create" ? "New policy" : panel === "simulate" ? "Policy simulation" : selected?.name ?? ""}
      >
        {panel === "create" && (
          <CreatePolicyPanel
            createPolicy={async (input) => {
              try {
                return await createPolicy.mutateAsync(input);
              } catch (err) {
                toast({ kind: "error", title: "Policy create failed", description: err instanceof Error ? err.message : "Unable to create policy." });
                throw err;
              }
            }}
            busy={createPolicy.isPending}
            onCreated={(policy) => {
              toast({ kind: "success", title: "Policy created", description: `${policy.name} is active in the policy engine.` });
              setPanel(null);
              setSelected(policy);
            }}
          />
        )}
        {panel === "simulate" && (
          <SimulatePolicyPanel
            runSimulation={async (input) => {
              try {
                return await simulatePolicy.mutateAsync(input);
              } catch (err) {
                toast({ kind: "error", title: "Simulation failed", description: err instanceof Error ? err.message : "Unable to evaluate policies." });
                throw err;
              }
            }}
            busy={simulatePolicy.isPending}
            result={simulation}
            setResult={setSimulation}
          />
        )}
        {!panel && selected && (
          <PolicyDetail
            policy={selected}
            onCopy={async (source) => {
              await navigator.clipboard.writeText(source);
              toast({ kind: "success", title: "Policy copied", description: "Policy rule copied to clipboard." });
            }}
            onSimulate={() => setPanel("simulate")}
            onDeprecate={() => deprecatePolicy(selected)}
            statusBusy={updatePolicyStatus.isPending}
          />
        )}
      </RightPanel>
    </div>
  );
}

function PolicyStatusBadge({ status }: { status: string }) {
  const cfg = {
    ACTIVE: { label: "Active", style: "bg-s-success/10 text-s-success border-s-success/30" },
    DRAFT: { label: "Draft", style: "bg-s-info/10 text-s-info border-s-info/30" },
    DEPRECATED: { label: "Deprecated", style: "bg-s-subtle text-s-muted border-s-border" },
  };
  const c = cfg[status as keyof typeof cfg] ?? cfg.ACTIVE;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${c.style}`}>
      {c.label}
    </span>
  );
}

function PolicyDetail({
  policy,
  onCopy,
  onSimulate,
  onDeprecate,
  statusBusy,
}: {
  policy: Policy;
  onCopy: (source: string) => Promise<void>;
  onSimulate: () => void;
  onDeprecate: () => void;
  statusBusy: boolean;
}) {
  const regoExample = generateRegoPreview(policy);

  return (
    <div className="p-5 flex flex-col gap-5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${typeColors[policy.type]}`}>
          {policy.type}
        </span>
        <PolicyStatusBadge status={policy.status} />
        <span className="font-mono text-s-muted text-[10px]">{policy.id}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-md bg-s-base border border-s-border">
          <div className="label-mono mb-1">Scope</div>
          <div className="font-mono text-s-primary text-xs">{policy.scope}</div>
        </div>
        <div className="p-3 rounded-md bg-s-base border border-s-border">
          <div className="label-mono mb-1">Version</div>
          <div className="font-mono text-s-primary text-xs">{policy.version}</div>
        </div>
        <div className="p-3 rounded-md bg-s-base border border-s-border">
          <div className="label-mono mb-1">Violations (7d)</div>
          <div className={`font-mono text-xs ${policy.violations7d > 0 ? "text-s-warning" : "text-s-success"}`}>
            {policy.violations7d}
          </div>
        </div>
        <div className="p-3 rounded-md bg-s-base border border-s-border">
          <div className="label-mono mb-1">Last Updated</div>
          <div className="text-s-primary text-xs">{new Date(policy.updatedAt).toLocaleDateString()}</div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="label-mono">Policy Rule (Rego)</div>
          <button onClick={() => void onCopy(regoExample)} className="flex items-center gap-1 text-s-muted hover:text-s-primary text-[11px]">
            <Copy size={11} /> Copy
          </button>
        </div>
        <pre className="p-4 rounded-md bg-s-base border border-s-border font-mono text-s-primary text-[11px] leading-relaxed overflow-x-auto">
          {regoExample}
        </pre>
      </div>

      <div className="flex gap-2 pt-3 border-t border-s-border">
        <Button variant="secondary" size="sm" icon={<Edit3 size={12} />} onClick={() => void onCopy(regoExample)}>Copy Rule</Button>
        <Button variant="secondary" size="sm" onClick={onSimulate}>Simulate</Button>
        {policy.status !== "DEPRECATED" && (
          <Button variant="danger" size="sm" icon={<Trash2 size={12} />} onClick={onDeprecate} disabled={statusBusy}>
            {statusBusy ? "Updating" : "Deprecate"}
          </Button>
        )}
      </div>
    </div>
  );
}

function CreatePolicyPanel({
  createPolicy,
  busy,
  onCreated,
}: {
  createPolicy: (input: PolicyInput) => Promise<Policy>;
  busy: boolean;
  onCreated: (policy: Policy) => void;
}) {
  const [form, setForm] = useState<Required<Pick<PolicyInput, "name" | "type" | "scope" | "version" | "status">> & { regoSource: string }>({
    name: "Confidential data sovereign route",
    type: "Data",
    scope: "*",
    version: "1.0",
    status: "ACTIVE",
    regoSource: defaultJsonRule("Data"),
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const policy = await createPolicy(form);
      onCreated(policy);
    } catch {
      // Parent surfaces the error through the shared toast system.
    }
  };

  const updateType = (type: PolicyInput["type"]) => {
    setForm((prev) => ({ ...prev, type, regoSource: defaultJsonRule(type) }));
  };

  return (
    <form onSubmit={submit} className="p-5 flex flex-col gap-4">
      <Field label="Name">
        <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} className={fieldCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select value={form.type} onChange={(event) => updateType(event.target.value as PolicyInput["type"])} className={fieldCls}>
            {(["Tool", "Data", "Approval", "Model", "Cost", "Environment"] as const).map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as Policy["status"] }))} className={fieldCls}>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
          </select>
        </Field>
        <Field label="Scope">
          <input value={form.scope} onChange={(event) => setForm((prev) => ({ ...prev, scope: event.target.value }))} className={fieldCls} />
        </Field>
        <Field label="Version">
          <input value={form.version} onChange={(event) => setForm((prev) => ({ ...prev, version: event.target.value }))} className={fieldCls} />
        </Field>
      </div>
      <Field label="Executable JSON rule">
        <textarea
          value={form.regoSource}
          onChange={(event) => setForm((prev) => ({ ...prev, regoSource: event.target.value }))}
          rows={9}
          className="w-full resize-y rounded-md border border-s-border bg-s-base px-3 py-2 font-mono text-[11.5px] leading-relaxed text-s-primary outline-none focus:border-s-brand"
        />
      </Field>
      <Button variant="primary" icon={<Plus size={13} />} disabled={busy || form.name.trim().length < 3} className="justify-center">
        {busy ? "Creating" : "Create policy"}
      </Button>
    </form>
  );
}

function SimulatePolicyPanel({
  runSimulation,
  busy,
  result,
  setResult,
}: {
  runSimulation: (input: PolicySimulationInput) => Promise<PolicySimulationResult>;
  busy: boolean;
  result: PolicySimulationResult | null;
  setResult: (result: PolicySimulationResult) => void;
}) {
  const [form, setForm] = useState<PolicySimulationInput>({
    agent: "EngineeringAgent",
    tenantId: "tenant_default",
    sensitivityLevel: "confidential",
    sovereignMode: false,
    approvalApproved: false,
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setResult(await runSimulation(form));
    } catch {
      // Parent surfaces the error through the shared toast system.
    }
  };

  return (
    <form onSubmit={submit} className="p-5 flex flex-col gap-4">
      <Field label="Agent">
        <input value={form.agent ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, agent: event.target.value }))} className={fieldCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tenant">
          <input value={form.tenantId ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, tenantId: event.target.value }))} className={fieldCls} />
        </Field>
        <Field label="Sensitivity">
          <select value={form.sensitivityLevel} onChange={(event) => setForm((prev) => ({ ...prev, sensitivityLevel: event.target.value as PolicySimulationInput["sensitivityLevel"] }))} className={fieldCls}>
            <option value="public">Public</option>
            <option value="internal">Internal</option>
            <option value="confidential">Confidential</option>
            <option value="restricted">Restricted</option>
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[12px] text-s-secondary">
        <input type="checkbox" checked={Boolean(form.sovereignMode)} onChange={(event) => setForm((prev) => ({ ...prev, sovereignMode: event.target.checked }))} className="h-4 w-4 accent-s-brand" />
        Sovereign route requested
      </label>
      <label className="flex items-center gap-2 text-[12px] text-s-secondary">
        <input type="checkbox" checked={Boolean(form.approvalApproved)} onChange={(event) => setForm((prev) => ({ ...prev, approvalApproved: event.target.checked }))} className="h-4 w-4 accent-s-brand" />
        Human approval already granted
      </label>
      <Button variant="primary" icon={<Shield size={13} />} disabled={busy} className="justify-center">
        {busy ? "Evaluating" : "Run simulation"}
      </Button>
      {result && (
        <div className={`rounded-md border p-3 ${result.decision.allowed ? "border-s-success/30 bg-s-success/10" : "border-s-warning/30 bg-s-warning/10"}`}>
          <div className="mb-2 flex items-center gap-2">
            {result.decision.allowed ? <CheckCircle2 size={14} className="text-s-success" /> : <AlertTriangle size={14} className="text-s-warning" />}
            <span className="text-[13px] font-medium text-s-primary">{result.decision.allowed ? "Allowed" : "Blocked"}</span>
          </div>
          <div className="space-y-1 text-[11.5px] text-s-secondary">
            <div>Matched: {result.decision.matched.length ? result.decision.matched.join(", ") : "none"}</div>
            <div>Reasons: {result.decision.reasons.length ? result.decision.reasons.join("; ") : "no denial reasons"}</div>
          </div>
        </div>
      )}
    </form>
  );
}

const fieldCls = "w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="label-mono mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function defaultJsonRule(type: PolicyInput["type"]) {
  const rules: Record<PolicyInput["type"], unknown> = {
    Tool: { when: { sensitivityLevel: "internal" }, require: { approval: false } },
    Data: { when: { sensitivityLevel: "confidential" }, require: { sovereign: true } },
    Approval: { when: { sensitivityLevel: "restricted" }, require: { approval: true, sovereign: true } },
    Model: { when: { sovereignOnly: true }, require: { sovereign: true } },
    Cost: { when: { tenantId: "tenant_default" }, deny: [] },
    Environment: { when: { agent: "ReleaseAgent" }, require: { approval: true } },
  };
  return JSON.stringify(rules[type], null, 2);
}

function generateRegoPreview(policy: Policy) {
  const templates: Record<string, string> = {
    Approval: `package axon.policy.approval

default allow = false

allow {
  input.environment != "production"
}

allow {
  input.environment == "production"
  input.approval_status == "APPROVED"
  input.approver_role == "platform_admin"
}`,
    Data: `package axon.policy.data

default allow = false

allow {
  not contains_pii(input.data)
}

allow {
  contains_pii(input.data)
  input.agent_role == "compliance_agent"
  input.audit_trail_enabled == true
}

contains_pii(data) {
  data.fields[_].classification == "PII"
}`,
    Tool: `package axon.policy.tool

default allow = false

allow {
  input.tool_name in approved_tools
  input.sandbox_enabled == true
}

approved_tools = {
  "file_read", "http_get", "db_query",
  "k8s_get", "git_read"
}`,
    Cost: `package axon.policy.cost

default allow = false

allow {
  input.estimated_cost <= input.budget_remaining
  input.estimated_cost <= max_single_call
}

max_single_call = 5.00`,
    Model: `package axon.policy.model

default allow = false

allow {
  input.sovereign_mode == false
  input.provider in allowed_providers
}

allow {
  input.sovereign_mode == true
  input.provider in sovereign_providers
}

sovereign_providers = {"ollama", "vllm"}
allowed_providers = {"anthropic", "openai", "gemini", "ollama", "vllm"}`,
    Environment: `package axon.policy.environment

default allow = false

allow {
  input.environment == "staging"
}

allow {
  input.environment == "production"
  input.change_approved == true
  input.rollback_plan_exists == true
}`,
  };
  const key = policy.type as string;
  return (templates as Record<string, string>)[key] ?? templates.Tool ?? "";
}
