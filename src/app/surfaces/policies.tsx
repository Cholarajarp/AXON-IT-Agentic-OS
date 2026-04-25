import { useState } from "react";
import { Shield, Plus, AlertCircle, RefreshCw, Eye, Edit3, Copy, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, EmptyState, PageHeader, Button, Tabs, RightPanel } from "../components/ui/primitives";
import { usePolicies } from "../lib/queries";
import type { Policy } from "../lib/store";

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
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState<Policy | null>(null);

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
            <Button variant="secondary" size="sm">Simulate</Button>
            <Button variant="primary" size="sm" icon={<Plus size={14} />}>New Policy</Button>
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
            action={<Button variant="primary" size="sm" icon={<Plus size={14} />}>Create Policy</Button>}
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
                        <button className="p-1 rounded hover:bg-s-subtle text-s-muted hover:text-s-primary"><Eye size={12} /></button>
                        <button className="p-1 rounded hover:bg-s-subtle text-s-muted hover:text-s-primary"><Edit3 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RightPanel open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ""}>
        {selected && <PolicyDetail policy={selected} />}
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

function PolicyDetail({ policy }: { policy: Policy }) {
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
          <button className="flex items-center gap-1 text-s-muted hover:text-s-primary text-[11px]">
            <Copy size={11} /> Copy
          </button>
        </div>
        <pre className="p-4 rounded-md bg-s-base border border-s-border font-mono text-s-primary text-[11px] leading-relaxed overflow-x-auto">
          {regoExample}
        </pre>
      </div>

      <div className="flex gap-2 pt-3 border-t border-s-border">
        <Button variant="secondary" size="sm" icon={<Edit3 size={12} />}>Edit</Button>
        <Button variant="secondary" size="sm">Simulate</Button>
        <Button variant="secondary" size="sm">History</Button>
        {policy.status !== "DEPRECATED" && (
          <Button variant="danger" size="sm" icon={<Trash2 size={12} />}>Deprecate</Button>
        )}
      </div>
    </div>
  );
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
  return (templates as Record<string, string>)[key] || templates.Tool;
}
