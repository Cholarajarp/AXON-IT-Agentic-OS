import { useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  CloudCog,
  DollarSign,
  GitBranch,
  Loader2,
  Network,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { Button, Card, CardHeader, EmptyState, Kpi, PageHeader, SeverityBadge } from '../components/ui/primitives';
import {
  useCompanyOsMissions,
  useCreateCompanyOsMission,
  type CompanyMissionMode,
  type CompanyOperatingMission,
} from '../lib/queries';
import { useRouting } from '../lib/useRouting';

function parseList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function CompanyOs() {
  const missions = useCompanyOsMissions();
  const createMission = useCreateCompanyOsMission();
  const { setRoute } = useRouting();
  const [companyName, setCompanyName] = useState('');
  const [mission, setMission] = useState('');
  const [mode, setMode] = useState<CompanyMissionMode>('autonomous-factory');
  const [targetAgentCount, setTargetAgentCount] = useState(200000);
  const [monthlyBudgetUsd, setMonthlyBudgetUsd] = useState(5000000);
  const [regulated, setRegulated] = useState(true);
  const [cloudProviders, setCloudProviders] = useState('');
  const [compliance, setCompliance] = useState('');
  const [selected, setSelected] = useState<CompanyOperatingMission | null>(null);

  const list = missions.data?.missions ?? [];
  const current = selected ?? list[0] ?? null;

  const create = async () => {
    const generated = await createMission.mutateAsync({
      companyName,
      mission,
      mode,
      targetAgentCount,
      monthlyBudgetUsd,
      regulated,
      cloudProviders: parseList(cloudProviders),
      compliance: parseList(compliance),
      customerSegments: ['enterprise founders', 'engineering leaders', 'IT operations teams'],
    });
    setSelected(generated);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Company OS"
        description="One integrated operating mission to beat a 200k-person IT company: portfolio, workforce, skills, services, delivery, operations, cost, faults, and trust"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Network size={13} />} onClick={() => setRoute('autonomousWorkforce')}>
              Workforce
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={createMission.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              onClick={create}
              disabled={createMission.isPending || mission.trim().length < 12}
            >
              {createMission.isPending ? 'Building company' : 'Build company OS'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Agents" value={current ? current.controlPlane.targetAgentCount.toLocaleString() : targetAgentCount.toLocaleString()} hint="Company-scale workforce" />
        <Kpi label="Service lines" value={String(current?.serviceLines.length ?? 0)} hint="Revenue engines" />
        <Kpi label="Gross margin" value={current ? `${current.economics.grossMarginPercent}%` : '--'} hint="Estimated operating margin" />
        <Kpi label="Tickets seeded" value={String(current?.initialTickets.length ?? 0)} hint="First execution gates" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="Build the IT company" subtitle="Generate the integrated mission, not separate proof points" action={<Building2 size={14} className="text-s-brand" />} />
          <div className="p-4 space-y-4">
            <Field label="Company name" value={companyName} onChange={setCompanyName} placeholder="Your company or product studio" />
            <label className="block">
              <span className="label-mono mb-1.5 block">Mission</span>
              <textarea
                value={mission}
                onChange={(event) => setMission(event.target.value)}
                rows={6}
                placeholder="Describe the real IT operating mission, customer segment, services, compliance needs, and growth target."
                className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberField label="Agents" value={targetAgentCount} onChange={setTargetAgentCount} />
              <NumberField label="Budget / month" value={monthlyBudgetUsd} onChange={setMonthlyBudgetUsd} />
            </div>
            <label className="block">
              <span className="label-mono mb-1.5 block">Mode</span>
              <select value={mode} onChange={(event) => setMode(event.target.value as CompanyMissionMode)} className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand">
                <option value="build-and-run">build-and-run</option>
                <option value="managed-it">managed-it</option>
                <option value="modernize">modernize</option>
                <option value="autonomous-factory">autonomous-factory</option>
              </select>
            </label>
            <Field label="Cloud providers" value={cloudProviders} onChange={setCloudProviders} placeholder="AWS, Azure, GCP" />
            <Field label="Compliance" value={compliance} onChange={setCompliance} placeholder="SOC 2, ISO 27001, HIPAA" />
            <label className="flex items-center justify-between gap-3 rounded-md border border-s-border bg-s-base p-3">
              <span>
                <span className="block text-[12.5px] font-medium text-s-primary">Regulated enterprise</span>
                <span className="block text-[11px] text-s-muted">Adds stricter approval, evidence, and autonomy gates</span>
              </span>
              <input type="checkbox" checked={regulated} onChange={(event) => setRegulated(event.target.checked)} className="h-4 w-4 accent-s-brand" />
            </label>
            <Button
              variant="primary"
              icon={createMission.isPending ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
              onClick={create}
              disabled={createMission.isPending || mission.trim().length < 12}
              className="w-full justify-center"
            >
              {createMission.isPending ? 'Composing operating company' : 'Generate full IT company'}
            </Button>
          </div>
        </Card>

        <MissionList missions={list} selectedId={current?.id} isLoading={missions.isLoading} onSelect={setSelected} onRefresh={() => missions.refetch()} />
      </div>

      <MissionDetail mission={current} />
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 block">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand" />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 block">{label}</span>
      <input type="number" min={1} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand" />
    </label>
  );
}

function MissionList({ missions, selectedId, isLoading, onSelect, onRefresh }: { missions: CompanyOperatingMission[]; selectedId?: string; isLoading: boolean; onSelect: (mission: CompanyOperatingMission) => void; onRefresh: () => void }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Company missions" subtitle={`${missions.length} operating compan${missions.length === 1 ? 'y' : 'ies'}`} action={<Button size="sm" variant="ghost" icon={<RefreshCw size={12} />} onClick={onRefresh}>Refresh</Button>} />
      {isLoading ? (
        <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Loading company missions" />
      ) : missions.length === 0 ? (
        <EmptyState icon={<Building2 size={18} />} title="No Company OS mission yet" description="Generate the integrated operating mission to connect workforce, skills, service lines, delivery, operations, cost, and customer trust." />
      ) : (
        <div className="divide-y divide-s-border max-h-[620px] overflow-y-auto">
          {missions.map((item) => (
            <button key={item.id} onClick={() => onSelect(item)} className={`w-full p-4 text-left ${selectedId === item.id ? 'bg-s-brand/5' : 'hover:bg-s-hover'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="rounded border border-s-brand/30 bg-s-brand/10 px-1.5 py-0.5 text-[10px] font-mono uppercase text-s-brand">{item.mode}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{item.companyName}</span>
              </div>
              <div className="mt-1 text-[12px] leading-relaxed text-s-secondary">{item.executiveSummary}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Token>{item.controlPlane.targetAgentCount.toLocaleString()} agents</Token>
                <Token>{item.serviceLines.length} service lines</Token>
                <Token>{item.skillPlan.roles.length} roles</Token>
                <Token>{item.economics.grossMarginPercent}% margin</Token>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function MissionDetail({ mission }: { mission: CompanyOperatingMission | null }) {
  if (!mission) {
    return (
      <Card>
        <EmptyState icon={<Building2 size={18} />} title="No integrated company selected" description="Build a Company OS mission to see the complete IT-company operating system." />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
      <Card className="overflow-hidden">
        <CardHeader title={mission.companyName} subtitle={mission.executiveSummary} action={<SeverityBadge level={mission.controlPlane.autonomyLevel === 'supervised' ? 'P1' : 'LOW'} />} />
        <div className="p-4 space-y-4">
          <div className="rounded-md border border-s-border bg-s-base p-3">
            <div className="label-mono mb-2">North star</div>
            <div className="text-[13px] leading-relaxed text-s-primary">{mission.northStarMetric}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">{mission.operatingPrinciples.map((item) => <Token key={item}>{item}</Token>)}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Mini label="Run cost" value={`$${Math.round(mission.economics.estimatedRunUsd / 1000)}k`} />
            <Mini label="Revenue cap" value={`$${Math.round(mission.economics.revenueCapacityUsd / 1000)}k`} />
            <Mini label="Cost/outcome" value={`$${mission.economics.costPerOutcomeUsd}`} />
            <Mini label="Margin" value={`${mission.economics.grossMarginPercent}%`} />
          </div>

          <div>
            <SectionTitle>Service lines replacing IT departments</SectionTitle>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {mission.serviceLines.map((line) => (
                <div key={line.name} className="rounded-md border border-s-border bg-s-base p-3">
                  <div className="flex items-center gap-2">
                    <CloudCog size={13} className="text-s-brand" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{line.name}</span>
                    <Token>{line.agentCapacity.toLocaleString()}</Token>
                  </div>
                  <div className="mt-1 text-[12px] leading-relaxed text-s-secondary">{line.mission}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{line.deliveryOutputs.map((item) => <Token key={item}>{item}</Token>)}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{line.qualityBar.map((item) => <Token key={item}>{item}</Token>)}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionTitle>Portfolio roadmap</SectionTitle>
            <div className="space-y-2">
              {mission.portfolio.map((item) => (
                <div key={item.horizon} className="rounded-md border border-s-border bg-s-base p-3">
                  <div className="flex items-center gap-2">
                    <Target size={13} className="text-s-brand" />
                    <span className="font-mono text-[10px] text-s-muted">{item.horizon}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{item.theme}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{item.outcomes.map((outcome) => <Token key={outcome}>{outcome}</Token>)}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{item.proof.map((proof) => <Token key={proof}>{proof}</Token>)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4 min-w-0">
        <SidePanel title="Command hierarchy" icon={<GitBranch size={14} className="text-s-brand" />}>
          {mission.commandSystem.map((level) => (
            <div key={level.level} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="text-[12.5px] font-medium text-s-primary">{level.level}</div>
              <div className="mt-1 text-[12px] leading-relaxed text-s-secondary">{level.owns}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">{level.decisions.map((item) => <Token key={item}>{item}</Token>)}</div>
              <div className="mt-2 text-[12px] text-s-primary">{level.escalation}</div>
            </div>
          ))}
        </SidePanel>

        <SidePanel title="Generated operating assets" icon={<Users size={14} className="text-s-brand" />}>
          <Asset label="Workforce control plane" value={`${mission.controlPlane.orgUnits.length} org units · ${mission.controlPlane.archetypes.length} archetypes`} />
          <Asset label="Skill Academy plan" value={`${mission.skillPlan.roles.length} roles · ${mission.skillPlan.learningBacklog.length} learning items`} />
          <Asset label="Managed services model" value={`${mission.managedService.serviceTowers.length} towers · ${mission.managedService.cmdbSeed.length} CMDB assets`} />
          <Asset label="Product blueprint" value={`${mission.productBlueprint.backlog.length} backlog items · ${mission.productBlueprint.estimates.timelineDays} days`} />
          <Asset label="Service desk launch" value={`${mission.initialTickets.length} execution tickets`} />
        </SidePanel>

        <SidePanel title="Fault and recovery" icon={<AlertTriangle size={14} className="text-s-warning" />}>
          {mission.riskAndFaultModel.map((risk) => (
            <div key={risk.risk} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="text-[12.5px] font-medium text-s-primary">{risk.risk}</div>
              <div className="mt-1 text-[12px] text-s-secondary">{risk.earlySignal}</div>
              <div className="mt-2 text-[12px] leading-relaxed text-s-primary">{risk.prevention}</div>
              <div className="mt-1 text-[12px] leading-relaxed text-s-muted">{risk.recovery}</div>
            </div>
          ))}
        </SidePanel>

        <SidePanel title="Customer trust" icon={<ShieldCheck size={14} className="text-s-brand" />}>
          {mission.customerTrustSystem.map((item) => (
            <div key={item.moment} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="text-[12.5px] font-medium text-s-primary">{item.moment}</div>
              <div className="mt-1 text-[12px] leading-relaxed text-s-secondary">{item.behavior}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">{item.evidence.map((evidence) => <Token key={evidence}>{evidence}</Token>)}</div>
            </div>
          ))}
        </SidePanel>

        <SidePanel title="Savings levers" icon={<DollarSign size={14} className="text-s-success" />}>
          <div className="space-y-1.5">
            {mission.economics.savingsLevers.map((item) => (
              <div key={item} className="flex gap-2 text-[12px] leading-relaxed text-s-secondary">
                <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-s-success" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </SidePanel>
      </div>
    </div>
  );
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

function Asset({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-s-border bg-s-base p-3">
      <div className="label-mono mb-1">{label}</div>
      <div className="text-[12.5px] text-s-primary">{value}</div>
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
