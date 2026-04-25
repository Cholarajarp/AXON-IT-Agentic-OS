import { Loader2, RefreshCw, Shield } from 'lucide-react';
import { Button, Card, CardHeader, EmptyState, Kpi, PageHeader } from '../components/ui/primitives';
import { PipelineVisualizer } from '../components/pipeline-visualizer';
import { useAgentPipeline, useToolPipeline } from '../lib/queries';

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

  return (
    <div>
      <PageHeader
        title="Enforcement Pipeline"
        description="Twin 13-step spines: every agent execution and every tool call pass through policy, sanitization, and audit before they run."
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

function ShineCard({ title, children }: { title: string; children: string }) {
  return (
    <div className="rounded-md border border-s-border bg-s-subtle p-3">
      <div className="text-[12px] font-medium text-s-primary mb-1">{title}</div>
      <div>{children}</div>
    </div>
  );
}
