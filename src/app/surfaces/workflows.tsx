import { useMemo, useState } from "react";
import { GitBranch, Plus, Filter, Download, Search, AlertCircle, RefreshCw } from "lucide-react";
import { Card, EmptyState, PageHeader, Button, StatusPill, Tabs, RightPanel } from "../components/ui/primitives";
import { SubmitGoalModal } from "../components/submit-goal-modal";
import { type Workflow } from "../lib/store";
import { useWorkflows, useKillWorkflow } from "../lib/queries";
import { useRouting } from "../lib/useRouting";
import { useToast } from "../lib/toast";

export function Workflows() {
  const { data: workflows = [], isLoading, isError, error, refetch } = useWorkflows();
  const killWorkflowMutation = useKillWorkflow();
  const { setRoute } = useRouting();
  const { toast } = useToast();
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [goalOpen, setGoalOpen] = useState(false);
  const [selected, setSelected] = useState<Workflow | null>(null);

  const filtered = useMemo(() => {
    return workflows.filter((w) => {
      if (tab !== "all" && w.state.toLowerCase() !== tab) return false;
      if (q && !w.name.toLowerCase().includes(q.toLowerCase()) && !w.id.includes(q)) return false;
      return true;
    });
  }, [workflows, tab, q]);

  const counts = useMemo(() => ({
    all: workflows.length,
    running: workflows.filter((w) => w.state === "RUNNING").length,
    awaiting_approval: workflows.filter((w) => w.state === "AWAITING_APPROVAL").length,
    complete: workflows.filter((w) => w.state === "COMPLETE").length,
    failed: workflows.filter((w) => w.state === "FAILED").length,
  }), [workflows]);

  const killWorkflow = (id: string) => {
    killWorkflowMutation.mutate(id);
  };

  const exportWorkflows = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ exportedAt: new Date().toISOString(), workflows: filtered }, null, 2));
      toast({ kind: "success", title: "Workflows exported", description: `${filtered.length} workflow records copied to clipboard.` });
    } catch {
      toast({ kind: "error", title: "Export failed", description: "Clipboard access was blocked by the browser." });
    }
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Workflows" description="All goals, plans, and active execution lifecycles" />
        <Card>
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={24} className="text-s-muted animate-spin" />
          </div>
        </Card>
        <SubmitGoalModal open={goalOpen} onClose={() => setGoalOpen(false)} />
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <PageHeader title="Workflows" description="All goals, plans, and active execution lifecycles" />
        <Card>
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertCircle size={24} className="text-s-critical" />
              <span className="text-s-primary text-sm font-medium">Failed to load workflows</span>
              <span className="text-s-secondary text-[13px]">
                {error instanceof Error ? error.message : "An unexpected error occurred"}
              </span>
              <Button variant="primary" size="sm" icon={<RefreshCw size={13} />} onClick={() => refetch()}>Retry</Button>
            </div>
          </div>
        </Card>
        <SubmitGoalModal open={goalOpen} onClose={() => setGoalOpen(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <PageHeader
        title="Workflows"
        description="All goals, plans, and active execution lifecycles"
        action={
          <>
            <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={exportWorkflows}>Export</Button>
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setGoalOpen(true)}>Submit Goal</Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="px-4 pt-4">
          <Tabs
            tabs={[
              { id: "all", label: "All", count: counts.all },
              { id: "running", label: "Running", count: counts.running },
              { id: "awaiting_approval", label: "Awaiting", count: counts.awaiting_approval },
              { id: "complete", label: "Complete", count: counts.complete },
              { id: "failed", label: "Failed", count: counts.failed },
            ]}
            active={tab}
            onChange={setTab}
          />
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-b border-s-border">
          <div className="flex items-center gap-2 flex-1 max-w-sm px-2.5 py-1.5 rounded-md bg-s-subtle border border-s-border">
            <Search size={13} className="text-s-muted shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by name or ID…"
              className="bg-transparent flex-1 min-w-0 outline-none text-s-primary placeholder:text-s-muted text-[12.5px]"
            />
          </div>
          <Button variant="ghost" size="sm" icon={<Filter size={13} />} onClick={() => { setQ(""); setTab("all"); }}>Clear</Button>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<GitBranch size={20} />}
            title={workflows.length === 0 ? "No workflows yet" : "No matches"}
            description={workflows.length === 0
              ? "Submit a goal to begin. The orchestrator will plan, decompose, and assign agents."
              : "Try clearing filters or searching by a different term."}
            action={workflows.length === 0 && (
              <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setGoalOpen(true)}>Submit Goal</Button>
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[700px]">
              <colgroup>
                <col className="w-[100px]" />
                <col className="w-[180px]" />
                <col />
                <col className="w-[120px]" />
                <col className="w-[100px]" />
                <col className="w-[80px]" />
                <col className="w-[50px]" />
              </colgroup>
              <thead>
                <tr className="text-left border-b border-s-border">
                  <th className="px-4 py-2.5 label-mono">Status</th>
                  <th className="px-4 py-2.5 label-mono">Workflow</th>
                  <th className="px-4 py-2.5 label-mono">Goal</th>
                  <th className="px-4 py-2.5 label-mono">Progress</th>
                  <th className="px-4 py-2.5 label-mono">Cost</th>
                  <th className="px-4 py-2.5 label-mono">Started</th>
                  <th className="px-4 py-2.5 label-mono"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr
                    key={w.id}
                    onClick={() => setSelected(w)}
                    className="border-b border-s-border hover:bg-s-hover cursor-pointer"
                  >
                    <td className="px-4 py-3"><StatusPill state={w.state} /></td>
                    <td className="px-4 py-3 min-w-0">
                      <div className="text-s-primary truncate text-[13px] font-medium">{w.name}</div>
                      <div className="text-s-muted font-mono truncate text-[10px]">{w.id}</div>
                    </td>
                    <td className="px-4 py-3 min-w-0">
                      <span className="text-s-secondary truncate block text-[12.5px]">{w.goal}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1 bg-s-subtle rounded-full overflow-hidden shrink-0">
                          <div className="h-full bg-s-brand" style={{ width: `${w.progress}%` }} />
                        </div>
                        <span className="font-mono text-s-secondary text-[11px] shrink-0">{w.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-s-secondary text-xs">
                      ${w.cost}/{w.budget}
                    </td>
                    <td className="px-4 py-3 font-mono text-s-secondary text-xs">
                      {new Date(w.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); killWorkflow(w.id); }}
                        className="text-s-muted hover:text-s-critical text-[11px]"
                      >
                        Kill
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RightPanel open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ""}>
        {selected && (
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <StatusPill state={selected.state} />
              <span className="font-mono text-s-muted text-[11px]">{selected.id}</span>
            </div>
            <div>
              <div className="label-mono mb-1">Goal</div>
              <div className="text-s-primary text-[13px] leading-relaxed">{selected.goal}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="label-mono mb-1">Assigned Agent</div>
                <div className="font-mono text-s-code text-xs">{selected.agent}</div>
              </div>
              <div>
                <div className="label-mono mb-1">Domain</div>
                <div className="text-s-primary text-xs">{selected.domain.join(", ")}</div>
              </div>
              <div>
                <div className="label-mono mb-1">Progress</div>
                <div className="font-mono text-s-primary text-[13px]">{selected.progress}%</div>
              </div>
              <div>
                <div className="label-mono mb-1">Cost</div>
                <div className="font-mono text-s-primary text-[13px]">${selected.cost} / ${selected.budget}</div>
              </div>
            </div>
            <div>
              <div className="label-mono mb-1">Current Step</div>
              <div className="text-s-primary text-[13px]">{selected.step}</div>
            </div>
            <div className="flex gap-2 pt-3 border-t border-s-border">
              <Button variant="secondary" size="sm" onClick={() => setRoute("dag")}>View DAG</Button>
              <Button variant="secondary" size="sm" onClick={() => setRoute("audit")}>Audit Log</Button>
              <Button variant="danger" size="sm" onClick={() => { killWorkflow(selected.id); setSelected(null); }}>
                Kill Workflow
              </Button>
            </div>
          </div>
        )}
      </RightPanel>

      <SubmitGoalModal open={goalOpen} onClose={() => setGoalOpen(false)} />
    </div>
  );
}
