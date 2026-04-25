import { useState } from "react";
import { GitBranch, Play, CheckCircle2, XCircle, Clock, Loader2, ShieldAlert, SkipForward, Zap, ArrowRight } from "lucide-react";
import { Card, CardHeader, PageHeader, Button, StatusPill } from "../components/ui/primitives";
import { useWorkflows, useDAG, useOrchestratorStatus, useExecuteWorkflow, type DAGNode } from "../lib/queries";

const stateConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  PENDING: { icon: Clock, color: "text-s-muted", label: "Pending" },
  READY: { icon: Zap, color: "text-s-brand", label: "Ready" },
  RUNNING: { icon: Loader2, color: "text-s-warning", label: "Running" },
  COMPLETE: { icon: CheckCircle2, color: "text-s-success", label: "Complete" },
  FAILED: { icon: XCircle, color: "text-s-critical", label: "Failed" },
  BLOCKED: { icon: ShieldAlert, color: "text-s-warning", label: "Blocked" },
  SKIPPED: { icon: SkipForward, color: "text-s-muted", label: "Skipped" },
};

export function DAGViewer() {
  const { data: workflows = [] } = useWorkflows();
  const { data: status } = useOrchestratorStatus();
  const executeMutation = useExecuteWorkflow();
  const runningWorkflows = workflows.filter((w) => w.state === "RUNNING" || w.state === "PENDING");
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Execution DAG"
        description="Real-time task graph visualization — watch agents execute your goals step by step"
      />

      {/* Orchestrator Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="p-4">
            <div className="text-[11px] font-mono uppercase tracking-wider text-s-muted mb-1">Active Workflows</div>
            <div className="text-[28px] font-mono font-medium tabular-nums text-s-primary">{status?.activeWorkflows ?? 0}</div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-[11px] font-mono uppercase tracking-wider text-s-muted mb-1">Running Tasks</div>
            <div className="text-[28px] font-mono font-medium tabular-nums text-s-primary">{status?.runningTasks ?? 0}</div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-[11px] font-mono uppercase tracking-wider text-s-muted mb-1">Queued</div>
            <div className="text-[28px] font-mono font-medium tabular-nums text-s-primary">{runningWorkflows.length}</div>
          </div>
        </Card>
      </div>

      {/* Workflow Selector */}
      {runningWorkflows.length > 0 && (
        <Card className="mb-6">
          <CardHeader title="Active Workflows" subtitle="Select a workflow to view its execution DAG" />
          <div className="px-4 pb-4 space-y-2">
            {runningWorkflows.map((wf) => (
              <button
                key={wf.id}
                onClick={() => setSelectedWorkflow(wf.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  selectedWorkflow === wf.id
                    ? "border-s-brand bg-s-brand/5"
                    : "border-s-border hover:bg-s-hover"
                }`}
              >
                <GitBranch size={16} className="text-s-brand shrink-0" />
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-[13px] font-medium text-s-primary truncate">{wf.name}</div>
                  <div className="text-[11px] text-s-muted truncate">{wf.goal}</div>
                </div>
                <StatusPill state={wf.state} />
                <div className="text-[11px] font-mono text-s-muted shrink-0">{wf.progress}%</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* DAG View */}
      {selectedWorkflow ? (
        <DAGGraph workflowId={selectedWorkflow} />
      ) : (
        <Card>
          <div className="p-12 text-center">
            <GitBranch size={48} className="mx-auto text-s-muted mb-4 opacity-50" />
            <div className="text-[13px] text-s-muted mb-4">
              {runningWorkflows.length > 0
                ? "Select a workflow above to view its task graph"
                : "No active workflows. Submit a goal to start an execution."}
            </div>
            {runningWorkflows.length === 0 && (
              <Button onClick={() => {
                const wf = workflows[0];
                if (wf) {
                  executeMutation.mutate({ workflowId: wf.id, goal: wf.goal, domain: wf.domain });
                  setSelectedWorkflow(wf.id);
                }
              }}>
                <Play size={14} className="mr-1.5" /> Execute First Workflow
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function DAGGraph({ workflowId }: { workflowId: string }) {
  const { data: dag, isLoading, isError } = useDAG(workflowId);

  if (isLoading) {
    return (
      <Card>
        <div className="p-8 text-center">
          <Loader2 size={24} className="animate-spin mx-auto text-s-brand mb-2" />
          <div className="text-[13px] text-s-muted">Loading DAG...</div>
        </div>
      </Card>
    );
  }

  if (isError || !dag) {
    return (
      <Card>
        <div className="p-8 text-center">
          <div className="text-[13px] text-s-muted">No active DAG for this workflow. It may have completed or not yet started execution.</div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title={`Task Graph — ${dag.goal}`} subtitle={`${dag.nodes.length} tasks · ${dag.progress}% complete`} />
      <div className="px-4 pb-4">
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-s-subtle rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-s-brand rounded-full transition-all duration-500"
            style={{ width: `${dag.progress}%` }}
          />
        </div>

        {/* Task nodes */}
        <div className="space-y-2">
          {dag.nodes.map((node, idx) => (
            <TaskNodeRow key={node.id} node={node} isLast={idx === dag.nodes.length - 1} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function TaskNodeRow({ node, isLast }: { node: DAGNode; isLast: boolean }) {
  const fallback = { icon: Clock, color: "text-s-muted", label: "Unknown" };
  const config = stateConfig[node.state] || fallback;
  const Icon = config.icon;
  const isRunning = node.state === "RUNNING";

  return (
    <div className="flex items-start gap-3">
      {/* Timeline */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center border ${
          node.state === "COMPLETE" ? "border-s-success bg-s-success/10" :
          node.state === "RUNNING" ? "border-s-warning bg-s-warning/10" :
          node.state === "FAILED" ? "border-s-critical bg-s-critical/10" :
          "border-s-border bg-s-surface"
        }`}>
          <Icon size={14} className={`${config.color} ${isRunning ? "animate-spin" : ""}`} />
        </div>
        {!isLast && <div className="w-px h-6 bg-s-border" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-s-primary truncate">{node.name}</span>
          <span className={`text-[10px] font-mono uppercase tracking-wider ${config.color}`}>{config.label}</span>
        </div>
        <div className="text-[11px] text-s-muted truncate">{node.description}</div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] font-mono text-s-secondary">{node.agent}</span>
          {node.cost !== undefined && (
            <span className="text-[10px] font-mono text-s-muted">${node.cost.toFixed(4)}</span>
          )}
          {node.error && (
            <span className="text-[10px] font-mono text-s-critical truncate">{node.error}</span>
          )}
        </div>
      </div>

      {/* Arrow to next */}
      {!isLast && node.state === "COMPLETE" && (
        <ArrowRight size={12} className="text-s-success shrink-0 mt-2" />
      )}
    </div>
  );
}
