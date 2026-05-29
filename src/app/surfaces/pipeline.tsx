import { useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, Loader2, PlayCircle, RefreshCw, Shield, TerminalSquare, XCircle } from 'lucide-react';
import { Button, Card, CardHeader, EmptyState, Kpi, PageHeader } from '../components/ui/primitives';
import { PipelineVisualizer } from '../components/pipeline-visualizer';
import { useAgentPipeline, useExecuteTool, useRunAgentPipelineProbe, useToolPipeline, type AgentPipelineProbeResult, type ToolRuntimeResult } from '../lib/queries';
import { useToast } from '../lib/toast';

/**
 * Pipeline surface.
 *
 * Renders the twin 13-step enforcement pipelines that every agent execution
 * and every tool call must flow through. This is the governance spine of the
 * platform: every agent action gets the same auth, policy, audit, and rate-limit spine.
 *
 * Shown side by side so operators can see where controls align (auth, policy,
 * rate-limit, audit) and where they differ (agent capability vs tool allowlist).
 */

export function Pipeline() {
  const agent = useAgentPipeline();
  const tool = useToolPipeline();
  const agentProbe = useRunAgentPipelineProbe();
  const toolProbe = useExecuteTool();
  const { toast } = useToast();
  const [lastAgentProbe, setLastAgentProbe] = useState<AgentPipelineProbeResult | null>(null);
  const [lastToolProbe, setLastToolProbe] = useState<ToolRuntimeResult | null>(null);

  if (agent.isLoading || tool.isLoading) {
    return (
      <div>
        <PageHeader title="Enforcement Pipeline" description="The 13-step policy-bound runtime every execution flows through" />
        <Card>
          <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Loading pipeline definition" />
        </Card>
      </div>
    );
  }

  if (agent.isError || tool.isError) {
    return (
      <div>
        <PageHeader title="Enforcement Pipeline" description="The 13-step policy-bound runtime every execution flows through" />
        <Card>
          <EmptyState
            icon={<Shield size={18} />}
            title="Pipeline definitions unavailable"
            description="Start the backend so /agents/pipeline and /tools/pipeline can respond."
            action={<Button variant="primary" size="sm" icon={<RefreshCw size={13} />} onClick={() => { agent.refetch(); tool.refetch(); }}>Retry</Button>}
          />
        </Card>
      </div>
    );
  }

  const agentSteps = agent.data?.steps ?? [];
  const toolSteps = tool.data?.steps ?? [];

  const runAgentProbe = async () => {
    try {
      const result = await agentProbe.mutateAsync({
        workflowId: 'wf_pipeline_probe',
        taskId: 'task_agent_pipeline_probe',
        taskName: 'PipelineProbeAgent',
        description: 'Verify the agent enforcement pipeline without side effects.',
        tenantId: 'tenant_default',
        input: { goal: 'probe-agent-pipeline', sensitive: false },
      });
      setLastAgentProbe(result);
      toast({
        kind: result.aborted ? 'warning' : 'success',
        title: result.aborted ? 'Agent probe aborted' : 'Agent probe passed',
        description: `${result.steps.filter((step) => step.passed).length}/${result.steps.length} steps passed.`,
      });
    } catch (err) {
      toast({ kind: 'error', title: 'Agent probe failed', description: err instanceof Error ? err.message : 'Unable to run agent pipeline probe.' });
    }
  };

  const runToolProbe = async () => {
    try {
      const result = await toolProbe.mutateAsync({
        toolName: 'file.operations',
        parameters: { operation: 'list', path: '.' },
        workflowId: 'wf_pipeline_probe',
        taskId: 'task_tool_pipeline_probe',
        agentId: 'PipelineProbeAgent',
        tenantId: 'tenant_default',
        sensitivityLevel: 'internal',
        sovereignMode: true,
        approvalApproved: true,
      });
      setLastToolProbe(result);
      toast({
        kind: result.success ? 'success' : 'warning',
        title: result.success ? 'Tool probe passed' : 'Tool probe did not complete',
        description: result.success ? `${result.steps.length} enforcement steps ran.` : result.abortReason ?? 'Tool runtime returned a non-success result.',
      });
    } catch (err) {
      toast({ kind: 'error', title: 'Tool probe failed', description: err instanceof Error ? err.message : 'Unable to run tool pipeline probe.' });
    }
  };

  return (
    <div>
      <PageHeader
        title="Enforcement Pipeline"
        description="Twin 13-step spines: every agent execution and every tool call pass through policy, sanitization, and audit before they run."
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<PlayCircle size={13} />} onClick={runAgentProbe} disabled={agentProbe.isPending}>
              {agentProbe.isPending ? 'Agent running' : 'Agent probe'}
            </Button>
            <Button variant="primary" size="sm" icon={<TerminalSquare size={13} />} onClick={runToolProbe} disabled={toolProbe.isPending}>
              {toolProbe.isPending ? 'Tool running' : 'Tool probe'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Kpi label="Agent Steps" value={String(agentSteps.length)} hint="Between goal and execution" />
        <Kpi label="Tool Steps" value={String(toolSteps.length)} hint="Between agent call and side effect" />
        <Kpi label="Always-On Audit" value="cryptographic" hint="Every run, success or denial" />
        <Kpi label="Short-Circuit" value="first failure" hint="Later steps skip on abort" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <PipelineVisualizer
          title="Agent Pipeline"
          subtitle={`${agentSteps.length} canonical steps · intent → audit`}
          steps={agentSteps}
        />
        <PipelineVisualizer
          title="Tool Pipeline"
          subtitle={`${toolSteps.length} canonical steps · intent → audit`}
          steps={toolSteps}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ProbeCard
          title="Last agent probe"
          result={lastAgentProbe}
          emptyTitle="No agent probe run yet"
          action={<Button variant="secondary" size="sm" icon={<PlayCircle size={12} />} onClick={runAgentProbe} disabled={agentProbe.isPending}>Run</Button>}
        />
        <ProbeCard
          title="Last tool probe"
          result={lastToolProbe}
          emptyTitle="No tool probe run yet"
          action={<Button variant="secondary" size="sm" icon={<TerminalSquare size={12} />} onClick={runToolProbe} disabled={toolProbe.isPending}>Run</Button>}
        />
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardHeader title="Why this matters" subtitle="What the enforcement spine gives you that terminal-only agents do not" />
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px] text-s-secondary leading-relaxed">
          <ShineCard title="Fail-closed governance">
            Any step that fails aborts the execution and is recorded to the audit chain with the specific step name. No partial side effects.
          </ShineCard>
          <ShineCard title="Cryptographic audit">
            Every run — approved, denied, or errored — appends a hash-linked entry. Tampering invalidates the chain.
          </ShineCard>
          <ShineCard title="Identical semantics">
            Agent and tool pipelines share policy, RBAC, rate-limit, and audit services. One policy set governs both execution surfaces.
          </ShineCard>
        </div>
      </Card>
    </div>
  );
}

function ProbeCard({
  title,
  result,
  emptyTitle,
  action,
}: {
  title: string;
  result: AgentPipelineProbeResult | ToolRuntimeResult | null;
  emptyTitle: string;
  action: ReactNode;
}) {
  const steps = result?.steps ?? [];
  const aborted = Boolean(result && 'aborted' in result && result.aborted);
  const success = Boolean(result && ('success' in result ? result.success : !result.aborted));
  const passed = steps.filter((step) => step.passed).length;
  const executionId = result ? ('executionId' in result ? result.executionId : '') : '';
  const abortReason = result && 'abortReason' in result ? result.abortReason : undefined;

  return (
    <Card className="overflow-hidden">
      <CardHeader title={title} subtitle={result ? `${executionId} · ${passed}/${steps.length} steps passed` : 'Run a live backend probe'} action={action} />
      {result ? (
        <div className="p-4">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Token>{success ? 'success' : aborted ? 'aborted' : 'failed'}</Token>
            <Token>{steps.length} steps</Token>
            {'durationMs' in result && <Token>{result.durationMs}ms</Token>}
          </div>
          {abortReason && <div className="mb-3 rounded-md border border-s-warning/30 bg-s-warning/10 p-2 text-[12px] text-s-warning">{abortReason}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {steps.map((step) => (
              <div key={`${step.order}-${step.step}`} className="flex items-center gap-2 rounded-md border border-s-border bg-s-subtle px-2 py-1.5">
                {step.passed ? <CheckCircle2 size={13} className="text-s-success" /> : <XCircle size={13} className="text-s-critical" />}
                <span className="min-w-0 flex-1 truncate text-[11px] font-mono text-s-secondary">{step.order}. {step.step}</span>
                <span className="font-mono text-[10px] text-s-muted">{step.durationMs}ms</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState icon={<Shield size={18} />} title={emptyTitle} description="Run a probe to record live enforcement evidence from the backend runtime." />
      )}
    </Card>
  );
}

function Token({ children }: { children: ReactNode }) {
  return <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[10px] font-mono text-s-muted">{children}</span>;
}

function ShineCard({ title, children }: { title: string; children: string }) {
  return (
    <div className="rounded-md border border-s-border bg-s-subtle p-3">
      <div className="text-[12px] font-medium text-s-primary mb-1">{title}</div>
      <div>{children}</div>
    </div>
  );
}
