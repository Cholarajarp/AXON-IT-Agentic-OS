import { useState, type ReactNode } from 'react';
import {
  Brain,
  CheckCircle2,
  GitBranch,
  Layers,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import { Button, Card, CardHeader, EmptyState, Kpi, PageHeader, SeverityBadge } from '../components/ui/primitives';
import {
  useCreateDeliveryBrainDossier,
  useDeliveryBrainDossiers,
  type DeliveryBrainDossier,
} from '../lib/queries';
import { useRouting } from '../lib/useRouting';

export function DeliveryBrain() {
  const dossiers = useDeliveryBrainDossiers();
  const createDossier = useCreateDeliveryBrainDossier();
  const { setRoute } = useRouting();
  const [mission, setMission] = useState('');
  const [budgetUsd, setBudgetUsd] = useState(5000000);
  const [deadlineDays, setDeadlineDays] = useState(90);
  const [regulated, setRegulated] = useState(true);
  const [selected, setSelected] = useState<DeliveryBrainDossier | null>(null);

  const list = dossiers.data?.dossiers ?? [];
  const current = selected ?? list[0] ?? null;

  const create = async () => {
    const dossier = await createDossier.mutateAsync({
      mission,
      budgetUsd,
      deadlineDays,
      regulated,
      existingAnswers: {
        productionAccess: 'reviewed only',
        customerPromise: 'enterprise trust and speed',
      },
    });
    setSelected(dossier);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Delivery Brain"
        description="Source-backed product reasoning: understand once, infer defaults, avoid repetitive questions, design enterprise stack, security, UX, deployment, and proof"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Layers size={13} />} onClick={() => setRoute('companyOs')}>
              Company OS
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={createDossier.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              onClick={create}
              disabled={createDossier.isPending || mission.trim().length < 12}
            >
              {createDossier.isPending ? 'Reasoning' : 'Generate dossier'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Confidence" value={current ? `${Math.round(current.inferredIntent.confidence * 100)}%` : '--'} hint="Intent understanding" />
        <Kpi label="Decisions" value={String(current?.decisionTrace.length ?? 0)} hint="Visible reasoning summary" />
        <Kpi label="Sources" value={String(current?.sourceSignals.length ?? 0)} hint="Current references" />
        <Kpi label="Blockers" value={String(current?.inferredIntent.blockerQuestions.length ?? 0)} hint="Only critical questions" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="Mission understanding" subtitle="One messy request becomes a build-ready enterprise dossier" action={<Brain size={14} className="text-s-brand" />} />
          <div className="p-4 space-y-4">
            <label className="block">
              <span className="label-mono mb-1.5 block">Mission</span>
              <textarea
                value={mission}
                onChange={(event) => setMission(event.target.value)}
                rows={7}
                placeholder="Describe the real product or service goal, users, constraints, proof, security, UI/UX, deployment, and operations needs."
                className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberField label="Budget" value={budgetUsd} onChange={setBudgetUsd} />
              <NumberField label="Deadline days" value={deadlineDays} onChange={setDeadlineDays} />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-md border border-s-border bg-s-base p-3">
              <span>
                <span className="block text-[12.5px] font-medium text-s-primary">Enterprise regulated</span>
                <span className="block text-[11px] text-s-muted">Security, compliance, and production gates stay stricter</span>
              </span>
              <input type="checkbox" checked={regulated} onChange={(event) => setRegulated(event.target.checked)} className="h-4 w-4 accent-s-brand" />
            </label>
            <Button
              variant="primary"
              icon={createDossier.isPending ? <Loader2 size={13} className="animate-spin" /> : <Brain size={13} />}
              onClick={create}
              disabled={createDossier.isPending || mission.trim().length < 12}
              className="w-full justify-center"
            >
              {createDossier.isPending ? 'Creating dossier' : 'Think and design product'}
            </Button>
          </div>
        </Card>

        <DossierList dossiers={list} selectedId={current?.id} isLoading={dossiers.isLoading} onSelect={setSelected} onRefresh={() => dossiers.refetch()} />
      </div>

      <DossierDetail dossier={current} />
    </div>
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

function DossierList({ dossiers, selectedId, isLoading, onSelect, onRefresh }: { dossiers: DeliveryBrainDossier[]; selectedId?: string; isLoading: boolean; onSelect: (dossier: DeliveryBrainDossier) => void; onRefresh: () => void }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Dossiers" subtitle={`${dossiers.length} generated`} action={<Button size="sm" variant="ghost" icon={<RefreshCw size={12} />} onClick={onRefresh}>Refresh</Button>} />
      {isLoading ? (
        <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Loading dossiers" />
      ) : dossiers.length === 0 ? (
        <EmptyState icon={<Brain size={18} />} title="No delivery brain dossier yet" description="Generate a dossier to see inferred intent, decisions, architecture, UX, security, deployment, and proof." />
      ) : (
        <div className="divide-y divide-s-border max-h-[620px] overflow-y-auto">
          {dossiers.map((dossier) => (
            <button key={dossier.id} onClick={() => onSelect(dossier)} className={`w-full p-4 text-left ${selectedId === dossier.id ? 'bg-s-brand/5' : 'hover:bg-s-hover'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <SeverityBadge level={dossier.inferredIntent.confidence >= 0.8 ? 'LOW' : 'MEDIUM'} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{dossier.inferredIntent.problem}</span>
              </div>
              <div className="mt-1 text-[12px] leading-relaxed text-s-secondary">{dossier.mission}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Token>{dossier.sourceSignals.length} sources</Token>
                <Token>{dossier.decisionTrace.length} decisions</Token>
                <Token>{dossier.inferredIntent.blockerQuestions.length} blockers</Token>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function DossierDetail({ dossier }: { dossier: DeliveryBrainDossier | null }) {
  if (!dossier) {
    return (
      <Card>
        <EmptyState icon={<Brain size={18} />} title="No dossier selected" description="Generate one to show how AXON thinks, decides, secures, designs, deploys, and explains enterprise product delivery." />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
      <Card className="overflow-hidden">
        <CardHeader title="Enterprise product dossier" subtitle={dossier.inferredIntent.problem} action={<SeverityBadge level={dossier.inferredIntent.blockerQuestions.length ? 'P1' : 'LOW'} />} />
        <div className="p-4 space-y-4">
          <div className="rounded-md border border-s-border bg-s-base p-3">
            <div className="label-mono mb-2">Understood intent</div>
            <div className="text-[13px] leading-relaxed text-s-primary">{dossier.inferredIntent.problem}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">{dossier.inferredIntent.targetUsers.map((item) => <Token key={item}>{item}</Token>)}</div>
          </div>

          <Section title="Desired outcomes" items={dossier.inferredIntent.desiredOutcomes} icon={<Target size={14} className="text-s-brand" />} />
          <Section title="No-repeat policy" items={dossier.inferredIntent.noRepeatPolicy} icon={<RefreshCw size={14} className="text-s-brand" />} />

          <div>
            <SectionTitle>Decision trace</SectionTitle>
            <div className="space-y-2">
              {dossier.decisionTrace.map((decision) => (
                <div key={decision.decision} className="rounded-md border border-s-border bg-s-base p-3">
                  <div className="flex items-center gap-2">
                    <GitBranch size={13} className="text-s-brand" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{decision.decision}</span>
                    <SeverityBadge level={decision.risk === 'critical' ? 'CRITICAL' : decision.risk === 'high' ? 'HIGH' : decision.risk === 'medium' ? 'MEDIUM' : 'LOW'} />
                  </div>
                  <div className="mt-1 text-[12px] text-s-primary">{decision.selected}</div>
                  <div className="mt-1 text-[12px] leading-relaxed text-s-secondary">{decision.rationale}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{decision.evidence.map((item) => <Token key={item}>{item}</Token>)}</div>
                </div>
              ))}
            </div>
          </div>

          <Architecture dossier={dossier} />
          <DeliveryPlan dossier={dossier} />
        </div>
      </Card>

      <div className="space-y-4 min-w-0">
        <SidePanel title="Source signals" icon={<Sparkles size={14} className="text-s-brand" />}>
          {dossier.sourceSignals.map((source) => (
            <div key={source.url} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="text-[12.5px] font-medium text-s-primary">{source.name}</div>
              <div className="mt-1 truncate font-mono text-[10px] text-s-muted">{source.url}</div>
              <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{source.takeaway}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">{source.appliedTo.map((item) => <Token key={item}>{item}</Token>)}</div>
            </div>
          ))}
        </SidePanel>

        <SidePanel title="Security and governance" icon={<ShieldCheck size={14} className="text-s-brand" />}>
          {dossier.securityAndGovernance.map((control) => (
            <div key={control.control} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="flex items-center gap-2">
                <LockKeyhole size={12} className="text-s-brand" />
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-s-primary">{control.control}</span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-s-muted">{control.mappedFramework}</div>
              <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{control.blocksReleaseWhen}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">{control.proof.map((item) => <Token key={item}>{item}</Token>)}</div>
            </div>
          ))}
        </SidePanel>

        <SidePanel title="UX and product experience" icon={<Layers size={14} className="text-s-brand" />}>
          {dossier.uxAndProductExperience.map((item) => (
            <div key={item.surface} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="text-[12.5px] font-medium text-s-primary">{item.surface}</div>
              <div className="mt-1 text-[12px] text-s-secondary">{item.userNeed}</div>
              <div className="mt-2 text-[12px] leading-relaxed text-s-primary">{item.designRule}</div>
              <div className="mt-1 font-mono text-[10px] text-s-muted">{item.successSignal}</div>
            </div>
          ))}
        </SidePanel>

        <SidePanel title="Deployment and operations" icon={<Rocket size={14} className="text-s-brand" />}>
          {dossier.deploymentAndOperations.map((item) => (
            <div key={item.capability} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="text-[12.5px] font-medium text-s-primary">{item.capability}</div>
              <div className="mt-1 text-[12px] leading-relaxed text-s-secondary">{item.implementation}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">{item.evidence.map((evidence) => <Token key={evidence}>{evidence}</Token>)}</div>
            </div>
          ))}
        </SidePanel>
      </div>
    </div>
  );
}

function Architecture({ dossier }: { dossier: DeliveryBrainDossier }) {
  const entries = Object.entries(dossier.enterpriseArchitecture) as Array<[string, string[]]>;
  return (
    <div>
      <SectionTitle>Enterprise architecture</SectionTitle>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {entries.map(([name, items]) => (
          <div key={name} className="rounded-md border border-s-border bg-s-base p-3">
            <div className="label-mono mb-2">{name}</div>
            <div className="flex flex-wrap gap-1.5">{items.map((item) => <Token key={item}>{item}</Token>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeliveryPlan({ dossier }: { dossier: DeliveryBrainDossier }) {
  return (
    <div>
      <SectionTitle>Delivery plan</SectionTitle>
      <div className="space-y-2">
        {dossier.deliveryPlan.map((phase) => (
          <div key={phase.phase} className="rounded-md border border-s-border bg-s-base p-3">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{phase.phase}</span>
              <Token>{phase.durationDays}d</Token>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">{phase.owners.map((item) => <Token key={item}>{item}</Token>)}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">{phase.outputs.map((item) => <Token key={item}>{item}</Token>)}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">{phase.exitCriteria.map((item) => <Token key={item}>{item}</Token>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, items, icon }: { title: string; items: string[]; icon: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title={title} action={icon} />
      <div className="p-4 space-y-1.5">
        {items.map((item) => (
          <div key={item} className="flex gap-2 text-[12px] leading-relaxed text-s-secondary">
            <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-s-success" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </Card>
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
