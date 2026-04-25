import { useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Bot,
  Brain,
  CheckCircle2,
  GitBranch,
  Loader2,
  Network,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button, Card, CardHeader, EmptyState, Kpi, PageHeader, SeverityBadge } from '../components/ui/primitives';
import {
  useAutonomousWorkforcePlanes,
  useCreateAutonomousWorkforcePlane,
  type AgentArchetype,
  type AutonomyLevel,
  type WorkforceControlPlane,
  type WorkMode,
} from '../lib/queries';
import { useRouting } from '../lib/useRouting';

export function AutonomousWorkforce() {
  const planes = useAutonomousWorkforcePlanes();
  const createPlane = useCreateAutonomousWorkforcePlane();
  const { setRoute } = useRouting();
  const [mission, setMission] = useState('');
  const [targetAgentCount, setTargetAgentCount] = useState(200000);
  const [monthlyBudgetUsd, setMonthlyBudgetUsd] = useState(5000000);
  const [workMode, setWorkMode] = useState<WorkMode>('managed-service');
  const [riskTolerance, setRiskTolerance] = useState<'low' | 'medium' | 'high'>('medium');
  const [regulated, setRegulated] = useState(true);
  const [selected, setSelected] = useState<WorkforceControlPlane | null>(null);

  const list = planes.data?.controlPlanes ?? [];
  const current = selected ?? list[0] ?? null;

  const create = async () => {
    const plane = await createPlane.mutateAsync({
      mission,
      targetAgentCount,
      monthlyBudgetUsd,
      workMode,
      riskTolerance,
      regulated,
    });
    setSelected(plane);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Autonomous Workforce"
        description="Control plane for massive AI IT organizations: roles, autonomy, behavior, fault recovery, growth loops, governance, and cost"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Brain size={13} />} onClick={() => setRoute('skillAcademy')}>
              Skill Academy
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={createPlane.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              onClick={create}
              disabled={createPlane.isPending || mission.trim().length < 12}
            >
              {createPlane.isPending ? 'Designing' : 'Design control plane'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Agents" value={current ? current.targetAgentCount.toLocaleString() : targetAgentCount.toLocaleString()} hint="Virtual workforce capacity" />
        <Kpi label="Org units" value={String(current?.orgUnits.length ?? 0)} hint="IT functions" />
        <Kpi label="Autonomy" value={current?.autonomyLevel ?? '--'} hint="Risk-adjusted mode" />
        <Kpi label="Capacity" value={current ? `${Math.round(current.economics.automationCapacityHours / 1000)}k h` : '--'} hint="Automation hours / month" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="Design massive AI workforce" subtitle="Model the operating system before letting agents act" action={<Network size={14} className="text-s-brand" />} />
          <div className="p-4 space-y-4">
            <label className="block">
              <span className="label-mono mb-1.5 block">Mission</span>
              <textarea
                value={mission}
                onChange={(event) => setMission(event.target.value)}
                rows={6}
                placeholder="Describe the real AI workforce mission, job functions, autonomy limits, budget, compliance, and recovery model."
                className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberField label="Target agents" value={targetAgentCount} onChange={setTargetAgentCount} />
              <NumberField label="Budget / month" value={monthlyBudgetUsd} onChange={setMonthlyBudgetUsd} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="label-mono mb-1.5 block">Work mode</span>
                <select value={workMode} onChange={(event) => setWorkMode(event.target.value as WorkMode)} className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand">
                  <option value="build">build</option>
                  <option value="operate">operate</option>
                  <option value="transform">transform</option>
                  <option value="managed-service">managed-service</option>
                </select>
              </label>
              <label className="block">
                <span className="label-mono mb-1.5 block">Risk tolerance</span>
                <select value={riskTolerance} onChange={(event) => setRiskTolerance(event.target.value as typeof riskTolerance)} className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand">
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </label>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-md border border-s-border bg-s-base p-3">
              <span>
                <span className="block text-[12.5px] font-medium text-s-primary">Regulated work</span>
                <span className="block text-[11px] text-s-muted">For finance, healthcare, SOC 2, PCI, HIPAA, or high-risk data</span>
              </span>
              <input type="checkbox" checked={regulated} onChange={(event) => setRegulated(event.target.checked)} className="h-4 w-4 accent-s-brand" />
            </label>
            <Button
              variant="primary"
              icon={createPlane.isPending ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
              onClick={create}
              disabled={createPlane.isPending || mission.trim().length < 12}
              className="w-full justify-center"
            >
              {createPlane.isPending ? 'Generating control plane' : 'Generate autonomous OS'}
            </Button>
          </div>
        </Card>

        <PlaneList planes={list} selectedId={current?.id} isLoading={planes.isLoading} onSelect={setSelected} onRefresh={() => planes.refetch()} />
      </div>

      <PlaneDetail plane={current} />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 block">{label}</span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand"
      />
    </label>
  );
}

function PlaneList({ planes, selectedId, isLoading, onSelect, onRefresh }: { planes: WorkforceControlPlane[]; selectedId?: string; isLoading: boolean; onSelect: (plane: WorkforceControlPlane) => void; onRefresh: () => void }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Control planes" subtitle={`${planes.length} design${planes.length === 1 ? '' : 's'}`} action={<Button size="sm" variant="ghost" icon={<RefreshCw size={12} />} onClick={onRefresh}>Refresh</Button>} />
      {isLoading ? (
        <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Loading workforce planes" />
      ) : planes.length === 0 ? (
        <EmptyState icon={<Users size={18} />} title="No autonomous workforce yet" description="Design a control plane before scaling agent autonomy." />
      ) : (
        <div className="divide-y divide-s-border max-h-[620px] overflow-y-auto">
          {planes.map((plane) => (
            <button key={plane.id} onClick={() => onSelect(plane)} className={`w-full p-4 text-left ${selectedId === plane.id ? 'bg-s-brand/5' : 'hover:bg-s-hover'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="rounded border border-s-brand/30 bg-s-brand/10 px-1.5 py-0.5 text-[10px] font-mono uppercase text-s-brand">{plane.workMode}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{plane.mission}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Token>{plane.targetAgentCount.toLocaleString()} agents</Token>
                <Token>{plane.autonomyLevel}</Token>
                <Token>{plane.orgUnits.length} units</Token>
                <Token>${plane.economics.estimatedMonthlyRunUsd.toLocaleString()}/mo</Token>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function PlaneDetail({ plane }: { plane: WorkforceControlPlane | null }) {
  if (!plane) {
    return (
      <Card>
        <EmptyState icon={<Network size={18} />} title="No control plane selected" description="Generate an autonomous workforce design to see org units, behavior models, fault recovery, growth loops, and economics." />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
      <Card className="overflow-hidden">
        <CardHeader title="Massive agent organization" subtitle={`${plane.workMode} · ${plane.autonomyLevel} · ${plane.targetAgentCount.toLocaleString()} agents`} action={<SeverityBadge level={badgeForAutonomy(plane.autonomyLevel)} />} />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Mini label="Run cost" value={`$${Math.round(plane.economics.estimatedMonthlyRunUsd / 1000)}k`} />
            <Mini label="Cost / agent" value={`$${plane.economics.costPerAgentUsd}`} />
            <Mini label="Review reserve" value={`$${Math.round(plane.economics.humanReviewReserveUsd / 1000)}k`} />
            <Mini label="Capacity" value={`${Math.round(plane.economics.automationCapacityHours / 1000)}k h`} />
          </div>

          <div>
            <SectionTitle>Org units</SectionTitle>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {plane.orgUnits.map((unit) => (
                <div key={unit.id} className="rounded-md border border-s-border bg-s-base p-3">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{unit.name}</span>
                    <Token>{unit.headcount.toLocaleString()}</Token>
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-s-muted">{unit.leadArchetype}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{unit.responsibilities.map((item) => <Token key={item}>{item}</Token>)}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionTitle>Agent archetypes</SectionTitle>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {plane.archetypes.map((archetype) => <ArchetypeCard key={archetype.id} archetype={archetype} />)}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4 min-w-0">
        <SidePanel title="Operating system" icon={<Brain size={14} className="text-s-brand" />}>
          <CompactList title="Planning" items={plane.operatingSystem.planning} />
          <CompactList title="Execution" items={plane.operatingSystem.execution} />
          <CompactList title="Memory" items={plane.operatingSystem.memory} />
          <CompactList title="Feedback" items={plane.operatingSystem.feedback} />
          <CompactList title="Governance" items={plane.operatingSystem.governance} />
        </SidePanel>

        <SidePanel title="Fault management" icon={<AlertTriangle size={14} className="text-s-warning" />}>
          {plane.faultManagement.map((fault) => (
            <div key={fault.fault} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="text-[12.5px] font-medium text-s-primary">{fault.fault}</div>
              <div className="mt-1 text-[12px] leading-relaxed text-s-secondary">{fault.detector}</div>
              <div className="mt-2 text-[12px] leading-relaxed text-s-primary">{fault.response}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">{fault.recoveryEvidence.map((item) => <Token key={item}>{item}</Token>)}</div>
            </div>
          ))}
        </SidePanel>

        <SidePanel title="Growth loops" icon={<TrendingUp size={14} className="text-s-success" />}>
          {plane.growthSystem.map((loop) => (
            <div key={loop.signal} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="font-mono text-[10px] text-s-muted">{loop.owner} · {loop.metric}</div>
              <div className="mt-1 text-[12.5px] text-s-primary">{loop.signal}</div>
              <div className="mt-1 text-[12px] leading-relaxed text-s-secondary">{loop.action}</div>
            </div>
          ))}
        </SidePanel>

        <SidePanel title="Decision behavior" icon={<ShieldCheck size={14} className="text-s-brand" />}>
          <CompactList title="Incentives" items={plane.decisionPsychology.incentives} />
          <CompactList title="Anti-patterns" items={plane.decisionPsychology.antiPatterns} />
          <CompactList title="Customer empathy" items={plane.decisionPsychology.customerEmpathy} />
        </SidePanel>

        <SidePanel title="Launch sequence" icon={<GitBranch size={14} className="text-s-brand" />}>
          {plane.launchSequence.map((step) => (
            <div key={step.order} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded border border-s-brand/30 bg-s-brand/10 font-mono text-[10px] text-s-brand">{step.order}</span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-s-primary">{step.milestone}</span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-s-muted">{step.owner}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">{step.exitCriteria.map((item) => <Token key={item}>{item}</Token>)}</div>
            </div>
          ))}
        </SidePanel>
      </div>
    </div>
  );
}

function ArchetypeCard({ archetype }: { archetype: AgentArchetype }) {
  return (
    <div className="rounded-md border border-s-border bg-s-base p-3">
      <div className="flex items-center gap-2">
        <Bot size={13} className="text-s-brand" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{archetype.name}</span>
        <Token>{archetype.headcount.toLocaleString()}</Token>
      </div>
      <div className="mt-1 text-[12px] leading-relaxed text-s-secondary">{archetype.mission}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Token>{archetype.autonomyLevel}</Token>
        <Token>{archetype.behaviorModel.communicationStyle}</Token>
      </div>
      <div className="mt-3">
        <div className="label-mono mb-1">Decision rights</div>
        <div className="flex flex-wrap gap-1.5">{archetype.decisionRights.slice(0, 5).map((right) => <Token key={right}>{right}</Token>)}</div>
      </div>
      <div className="mt-3">
        <div className="label-mono mb-1">Quality gates</div>
        <div className="flex flex-wrap gap-1.5">{archetype.qualityGates.slice(0, 5).map((gate) => <Token key={gate}>{gate}</Token>)}</div>
      </div>
    </div>
  );
}

function badgeForAutonomy(level: AutonomyLevel) {
  if (level === 'autonomous') return 'LOW';
  if (level === 'executive-review') return 'MEDIUM';
  if (level === 'supervised') return 'P1';
  return 'P2';
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-s-border bg-s-subtle p-3">
      <div className="label-mono mb-1">{label}</div>
      <div className="font-mono text-[16px] text-s-primary">{value}</div>
    </div>
  );
}

function SidePanel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title={title} action={icon} />
      <div className="p-4 space-y-2">{children}</div>
    </Card>
  );
}

function CompactList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-s-border bg-s-base p-3">
      <div className="label-mono mb-2">{title}</div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item} className="flex gap-2 text-[12px] leading-relaxed text-s-secondary">
            <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-s-success" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Token({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[10px] font-mono text-s-muted">
      {children}
    </span>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="mb-2 label-mono">{children}</div>;
}
