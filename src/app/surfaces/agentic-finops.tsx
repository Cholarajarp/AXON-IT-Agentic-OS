import { useState, type ReactNode } from 'react';
import {
  BadgeDollarSign,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ExternalLink,
  Gauge,
  GitBranch,
  Loader2,
  Network,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Workflow,
} from 'lucide-react';
import { Button, Card, CardHeader, EmptyState, Kpi, PageHeader, SeverityBadge } from '../components/ui/primitives';
import {
  useAgenticMeshBlueprints,
  useCreateAgenticMeshBlueprint,
  useCreateModelFinOpsReport,
  useModelFinOpsReports,
  type AgenticMeshBlueprint,
  type ModelFinOpsReport,
} from '../lib/queries';

export function AgenticFinOps() {
  const finOpsReports = useModelFinOpsReports();
  const meshBlueprints = useAgenticMeshBlueprints();
  const createFinOps = useCreateModelFinOpsReport();
  const createMesh = useCreateAgenticMeshBlueprint();
  const [mission, setMission] = useState('');
  const [budget, setBudget] = useState(2500);
  const [runs, setRuns] = useState(300);
  const [regulated, setRegulated] = useState(true);
  const [repeatedContext, setRepeatedContext] = useState(true);
  const [selectedFinOps, setSelectedFinOps] = useState<ModelFinOpsReport | null>(null);
  const [selectedMesh, setSelectedMesh] = useState<AgenticMeshBlueprint | null>(null);

  const currentFinOps = selectedFinOps ?? finOpsReports.data?.reports[0] ?? null;
  const currentMesh = selectedMesh ?? meshBlueprints.data?.blueprints[0] ?? null;
  const isGenerating = createFinOps.isPending || createMesh.isPending;

  const generate = async () => {
    const finops = await createFinOps.mutateAsync({
      mission,
      monthlyBudgetUsd: budget,
      expectedRunsPerMonth: runs,
      repeatedContext,
      requiresSovereign: regulated,
      sensitivityLevel: regulated ? 'confidential' : 'internal',
    });
    const mesh = await createMesh.mutateAsync({
      mission,
      regulated,
      budgetUsd: budget,
      autonomyLevel: regulated ? 'supervised' : 'autonomous',
      maxIterations: regulated ? 3 : 2,
    });
    setSelectedFinOps(finops);
    setSelectedMesh(mesh);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Agentic FinOps"
        description="Cost-aware model routing and multi-agent operating mesh for enterprise IT delivery"
        action={
          <Button
            variant="primary"
            size="sm"
            icon={isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            onClick={generate}
            disabled={isGenerating || mission.trim().length < 12}
          >
            {isGenerating ? 'Generating' : 'Generate OS plan'}
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Savings" value={currentFinOps ? `${currentFinOps.optimized.savingsPercent}%` : '--'} hint="vs premium-only baseline" />
        <Kpi label="Quality" value={currentFinOps ? `${currentFinOps.optimized.expectedQualityScore}%` : '--'} hint={currentFinOps?.risk ?? 'No report'} />
        <Kpi label="Mesh Readiness" value={currentMesh ? `${currentMesh.score.enterpriseReadiness}%` : '--'} hint={currentMesh?.autonomyLevel ?? 'No mesh'} />
        <Kpi label="Agents" value={String(currentMesh?.agentRoles.length ?? 0)} hint="Role workers" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)] gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="Operating target" subtitle="Budget, risk, and mission shape the routing plan" action={<Gauge size={14} className="text-s-brand" />} />
          <div className="p-4 space-y-4">
            <label className="block">
              <span className="label-mono mb-1.5 block">Mission</span>
              <textarea
                value={mission}
                onChange={(event) => setMission(event.target.value)}
                rows={7}
                placeholder="Describe the agent workflow, expected monthly runs, data sensitivity, quality target, and cost ceiling."
                className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberField label="Monthly budget" value={budget} min={100} max={1_000_000} onChange={setBudget} prefix="$" />
              <NumberField label="Runs / month" value={runs} min={1} max={100_000} onChange={setRuns} />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-md border border-s-border bg-s-base px-3 py-2">
              <span className="text-[12.5px] text-s-primary">Regulated or customer data</span>
              <input type="checkbox" checked={regulated} onChange={(event) => setRegulated(event.target.checked)} className="h-4 w-4 accent-s-brand" />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border border-s-border bg-s-base px-3 py-2">
              <span className="text-[12.5px] text-s-primary">Repeated repo/API/database context</span>
              <input type="checkbox" checked={repeatedContext} onChange={(event) => setRepeatedContext(event.target.checked)} className="h-4 w-4 accent-s-brand" />
            </label>
            <Button
              variant="primary"
              icon={isGenerating ? <Loader2 size={13} className="animate-spin" /> : <BrainCircuit size={13} />}
              onClick={generate}
              disabled={isGenerating || mission.trim().length < 12}
              className="w-full justify-center"
            >
              {isGenerating ? 'Building mesh and route' : 'Build agentic cost plan'}
            </Button>
          </div>
        </Card>

        <FinOpsSummary report={currentFinOps} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
        <MeshStages blueprint={currentMesh} />
        <MeshRoles blueprint={currentMesh} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <RouteTable report={currentFinOps} />
        <QualityAndCache report={currentFinOps} mesh={currentMesh} />
      </div>
    </div>
  );
}

function FinOpsSummary({ report }: { report: ModelFinOpsReport | null }) {
  if (!report) {
    return (
      <Card>
        <EmptyState icon={<BadgeDollarSign size={18} />} title="No FinOps plan yet" description="Generate a plan to see model cascade, cache policy, quality gates, and budget controls." />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Cost route summary" subtitle={report.summary} action={<SeverityBadge level={report.risk === 'critical' ? 'CRITICAL' : report.risk === 'high' ? 'HIGH' : report.risk === 'medium' ? 'MEDIUM' : 'LOW'} />} />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Metric label="Premium baseline" value={`$${report.baseline.estimatedMonthlyCostUsd.toFixed(2)}/mo`} />
          <Metric label="Optimized route" value={`$${report.optimized.estimatedMonthlyCostUsd.toFixed(2)}/mo`} />
          <Metric label="Monthly savings" value={`$${report.optimized.savingsUsd.toFixed(2)}`} />
          <Metric label="Task budget" value={`$${report.budgetPolicy.taskBudgetUsd.toFixed(2)}`} />
        </div>
        <div className="rounded-md border border-s-brand/30 bg-s-brand/10 p-3">
          <div className="flex items-center gap-2">
            <TrendingDown size={14} className="text-s-success" />
            <span className="text-[13px] font-medium text-s-primary">{report.optimized.savingsPercent}% estimated reduction</span>
          </div>
          <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{report.baseline.policy}</div>
        </div>
        <div className="flex flex-wrap gap-1.5">{report.taskTypes.map((task) => <Token key={task}>{task}</Token>)}</div>
      </div>
    </Card>
  );
}

function MeshStages({ blueprint }: { blueprint: AgenticMeshBlueprint | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Agentic mesh stages" subtitle={blueprint ? blueprint.summary : 'No mesh'} action={<Network size={14} className="text-s-brand" />} />
      <div className="divide-y divide-s-border">
        {(blueprint?.stages ?? []).map((stage) => (
          <div key={stage.order} className="p-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 font-mono text-[9px] text-s-muted">{String(stage.order).padStart(2, '0')}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{stage.name}</span>
              <Token>{stage.topology}</Token>
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{stage.objective}</div>
            <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <MiniList title="Agents" items={stage.agents} icon={<Bot size={12} className="text-s-info" />} />
              <MiniList title="Gates" items={[stage.qualityGate, stage.costControl, stage.failurePolicy]} icon={<CheckCircle2 size={12} className="text-s-success" />} />
            </div>
          </div>
        ))}
        {!blueprint && <EmptyState icon={<Workflow size={18} />} title="No mesh generated" />}
      </div>
    </Card>
  );
}

function MeshRoles({ blueprint }: { blueprint: AgenticMeshBlueprint | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Agent roles" subtitle={blueprint ? `${blueprint.agentRoles.length} workers` : 'No mesh'} action={<Bot size={14} className="text-s-brand" />} />
      <div className="divide-y divide-s-border max-h-[720px] overflow-y-auto">
        {(blueprint?.agentRoles ?? []).map((role) => (
          <div key={role.agent} className="p-4">
            <div className="flex items-center gap-2 min-w-0">
              <Token>{role.role}</Token>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{role.agent}</span>
              {role.canRunInParallel && <GitBranch size={13} className="text-s-info" />}
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{role.modelPolicy}</div>
            <div className="mt-2 space-y-1.5">
              {role.responsibilities.slice(0, 3).map((item) => <Line key={item} icon={<CheckCircle2 size={12} className="text-s-success" />}>{item}</Line>)}
            </div>
          </div>
        ))}
        {!blueprint && <EmptyState icon={<Bot size={18} />} title="No roles yet" />}
      </div>
    </Card>
  );
}

function RouteTable({ report }: { report: ModelFinOpsReport | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Model cascade" subtitle={report ? `${report.route.length} task routes` : 'No report'} action={<BadgeDollarSign size={14} className="text-s-success" />} />
      <div className="divide-y divide-s-border">
        {(report?.route ?? []).map((step) => (
          <div key={`${step.order}-${step.taskType}`} className="p-4">
            <div className="flex items-center gap-2 min-w-0">
              <Token>{step.strategy}</Token>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{step.taskType}</span>
              <span className="font-mono text-[11px] text-s-muted">${step.estimatedCostUsd.toFixed(4)}</span>
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{step.purpose}</div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Metric label="Primary" value={`${step.primary.provider}/${step.primary.model}`} />
              <Metric label="Fallback" value={`${step.fallback.provider}/${step.fallback.model}`} />
              <Metric label="Escalate" value={step.escalation.target.model} />
            </div>
          </div>
        ))}
        {!report && <EmptyState icon={<BadgeDollarSign size={18} />} title="No model route yet" />}
      </div>
    </Card>
  );
}

function QualityAndCache({ report, mesh }: { report: ModelFinOpsReport | null; mesh: AgenticMeshBlueprint | null }) {
  return (
    <div className="space-y-4 min-w-0">
      <Card className="overflow-hidden">
        <CardHeader title="Context cache" subtitle={report?.cachePlan.enabled ? report.cachePlan.cacheKey : 'No cache plan'} action={<ShieldCheck size={14} className="text-s-success" />} />
        {report ? (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Provider" value={report.cachePlan.provider} />
              <Metric label="Savings" value={`$${report.cachePlan.estimatedMonthlySavingsUsd.toFixed(2)}/mo`} />
              <Metric label="Prefix tokens" value={formatTokens(report.cachePlan.prefixTokens)} />
              <Metric label="Hit rate" value={`${Math.round(report.cachePlan.expectedHitRate * 100)}%`} />
            </div>
            <div className="flex flex-wrap gap-1.5">{report.cachePlan.cacheableBlocks.map((item) => <Token key={item}>{item}</Token>)}</div>
          </div>
        ) : (
          <EmptyState icon={<ShieldCheck size={18} />} title="No cache policy yet" />
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Quality loops and sources" subtitle={mesh ? `${mesh.qualityLoops.length} loops` : 'No mesh'} action={<ExternalLink size={14} className="text-s-muted" />} />
        <div className="p-4 space-y-4">
          {(mesh?.qualityLoops ?? []).map((loop) => (
            <div key={loop.id} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="text-[13px] font-medium text-s-primary">{loop.id}</div>
              <div className="mt-1 text-[12px] leading-relaxed text-s-secondary">{loop.stopCondition}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">{loop.evidence.map((item) => <Token key={item}>{item}</Token>)}</div>
            </div>
          ))}
          {(report?.sources ?? []).map((source) => (
            <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block rounded-md border border-s-border bg-s-base p-3 hover:border-s-brand/60">
              <div className="text-[12px] font-medium text-s-primary">{source.title}</div>
              <div className="mt-1 text-[11.5px] leading-relaxed text-s-secondary">{source.signal}</div>
            </a>
          ))}
          {!mesh && !report && <EmptyState icon={<ExternalLink size={18} />} title="No quality evidence yet" />}
        </div>
      </Card>
    </div>
  );
}

function NumberField({ label, value, min, max, prefix, onChange }: { label: string; value: number; min: number; max: number; prefix?: string; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 block">{label}</span>
      <div className="flex items-center rounded-md border border-s-border bg-s-base focus-within:border-s-brand">
        {prefix && <span className="pl-3 font-mono text-[12px] text-s-muted">{prefix}</span>}
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1 rounded-md bg-transparent px-3 py-2 text-[13px] text-s-primary outline-none"
        />
      </div>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-s-border bg-s-base p-3 min-w-0">
      <div className="label-mono mb-1">{label}</div>
      <div className="truncate font-mono text-[11px] text-s-primary">{value}</div>
    </div>
  );
}

function MiniList({ title, items, icon }: { title: string; items: string[]; icon: ReactNode }) {
  return (
    <div className="rounded-md border border-s-border bg-s-base p-3">
      <div className="label-mono mb-2">{title}</div>
      <div className="space-y-1.5">{items.slice(0, 6).map((item) => <Line key={item} icon={icon}>{item}</Line>)}</div>
    </div>
  );
}

function Line({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[12px] leading-relaxed text-s-secondary">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function Token({ children }: { children: ReactNode }) {
  return <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[10px] font-mono text-s-muted">{children}</span>;
}

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}
