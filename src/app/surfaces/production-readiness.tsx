import { useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Factory,
  Loader2,
  Rocket,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { Button, Card, CardHeader, EmptyState, Kpi, PageHeader, SeverityBadge } from '../components/ui/primitives';
import {
  useActivateProductionReadiness,
  useCreateProductionReadinessReport,
  useProductionReadinessReports,
  type ProductionCapability,
  type ProductionReadinessReport,
} from '../lib/queries';
import { useRouting } from '../lib/useRouting';

export function ProductionReadiness() {
  const reports = useProductionReadinessReports();
  const createReport = useCreateProductionReadinessReport();
  const activate = useActivateProductionReadiness();
  const { setRoute } = useRouting();
  const [mission, setMission] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [environment, setEnvironment] = useState<'preview' | 'staging' | 'production'>('staging');
  const [regulated, setRegulated] = useState(true);
  const [selected, setSelected] = useState<ProductionReadinessReport | null>(null);

  const current = selected ?? reports.data?.reports[0] ?? null;
  const active = current?.capabilities.filter((capability) => capability.status === 'active').length ?? 0;
  const blocked = current?.capabilities.filter((capability) => capability.status === 'inactive' || capability.level === 'production-blocked').length ?? 0;
  const busy = createReport.isPending || activate.isPending;

  const audit = async () => {
    const report = await createReport.mutateAsync({ mission, environment, regulated });
    setSelected(report);
  };

  const runActivation = async () => {
    const result = await activate.mutateAsync({ mission, environment, regulated, customerName: customerName.trim() || undefined });
    setSelected(result.report);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Production Readiness"
        description="Activates standalone AXON services into one production delivery loop and shows what is still blocked"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Workflow size={13} />} onClick={() => setRoute('missionControl')}>
              Missions
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={busy ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
              onClick={runActivation}
              disabled={busy || mission.trim().length < 8}
            >
              {busy ? 'Activating' : 'Activate all'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Readiness" value={current ? `${current.score}%` : '--'} hint={current?.status ?? 'No audit'} />
        <Kpi label="Runtime" value={current ? `${current.runtime.score}%` : '--'} hint={current?.runtime.status ?? 'No runtime'} />
        <Kpi label="Active Services" value={current ? `${active}/${current.capabilities.length}` : '--'} hint="Connected to evidence" />
        <Kpi label="Blocked" value={String(blocked + (current?.runtime.blockers.length ?? 0))} hint="Needs activation/adapters" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)] gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="Activation target" subtitle="Run this before selling or delivering a customer service" action={<Factory size={14} className="text-s-brand" />} />
          <div className="p-4 space-y-4">
            <label className="block">
              <span className="label-mono mb-1.5 block">Mission</span>
              <textarea
                value={mission}
                onChange={(event) => setMission(event.target.value)}
                rows={7}
                placeholder="Describe the production service loop you want to activate and the proof required before customer delivery."
                className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <label className="block">
              <span className="label-mono mb-1.5 block">Customer</span>
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Customer or internal delivery owner"
                className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="label-mono mb-1.5 block">Environment</span>
                <select value={environment} onChange={(event) => setEnvironment(event.target.value as typeof environment)} className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand">
                  <option value="preview">preview</option>
                  <option value="staging">staging</option>
                  <option value="production">production</option>
                </select>
              </label>
              <label className="flex items-center justify-between gap-3 rounded-md border border-s-border bg-s-base px-3 py-2 mt-5 sm:mt-[22px]">
                <span className="text-[12.5px] text-s-primary">Regulated</span>
                <input type="checkbox" checked={regulated} onChange={(event) => setRegulated(event.target.checked)} className="h-4 w-4 accent-s-brand" />
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button variant="secondary" icon={<ShieldCheck size={13} />} onClick={audit} disabled={busy || mission.trim().length < 8}>
                Audit only
              </Button>
              <Button variant="primary" icon={busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} onClick={runActivation} disabled={busy || mission.trim().length < 8}>
                Activate services
              </Button>
            </div>
          </div>
        </Card>

        <ReadinessSummary report={current} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
        <CapabilitiesPanel report={current} />
        <ServiceOffersPanel report={current} />
      </div>

      <ActivationFlow report={current} />
    </div>
  );
}

function ReadinessSummary({ report }: { report: ProductionReadinessReport | null }) {
  if (!report) {
    return (
      <Card>
        <EmptyState icon={<Factory size={18} />} title="No production audit yet" description="Audit the current tenant or activate all services to generate connected mission evidence." />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Readiness posture" subtitle={new Date(report.generatedAt).toLocaleString()} action={<SeverityBadge level={report.status === 'production-loop-ready' ? 'LOW' : report.status === 'pilot-ready' ? 'MEDIUM' : 'HIGH'} />} />
      <div className="p-4 space-y-4">
        <div className="rounded-md border border-s-brand/30 bg-s-brand/10 p-4 text-[12px] leading-relaxed text-s-primary">{report.summary}</div>
        <div className="rounded-md border border-s-border bg-s-base p-3">
          <div className="flex items-center gap-2">
            <SeverityBadge level={report.runtime.productionReady ? 'LOW' : report.runtime.blockers.length ? 'CRITICAL' : 'MEDIUM'} />
            <span className="text-[13px] font-medium text-s-primary">Runtime foundation: {report.runtime.status} at {report.runtime.score}%</span>
          </div>
          <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">
            {report.runtime.productionReady ? 'Database, artifact storage, signing, deployment, browser worker, and secrets gates passed.' : 'External production claims stay blocked until runtime gates pass.'}
          </div>
        </div>
        <MiniList title="Next actions" items={report.nextActions} icon={<CheckCircle2 size={12} className="text-s-success" />} />
        <MiniList title="Blockers" items={report.blockers.length ? report.blockers : ['No blocking capability gaps in the activated loop.']} icon={<AlertTriangle size={12} className={report.blockers.length ? 'text-s-warning' : 'text-s-success'} />} />
      </div>
    </Card>
  );
}

function CapabilitiesPanel({ report }: { report: ProductionReadinessReport | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Capability activation" subtitle={report ? `${report.capabilities.length} services` : 'No report'} action={<ShieldCheck size={14} className="text-s-success" />} />
      <div className="divide-y divide-s-border">
        {(report?.capabilities ?? []).map((capability) => (
          <CapabilityRow key={capability.id} capability={capability} />
        ))}
        {!report && <EmptyState icon={<ShieldCheck size={18} />} title="No capabilities audited" />}
      </div>
    </Card>
  );
}

function CapabilityRow({ capability }: { capability: ProductionCapability }) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 min-w-0">
        <SeverityBadge level={capability.status === 'active' ? 'LOW' : capability.status === 'partial' ? 'MEDIUM' : 'HIGH'} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{capability.name}</span>
        <Token>{capability.category}</Token>
      </div>
      <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{capability.productionUse}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">{capability.evidence.slice(0, 4).map((item) => <Token key={item}>{item}</Token>)}</div>
      {capability.gaps.length > 0 && (
        <div className="mt-2 text-[12px] leading-relaxed text-s-primary">{capability.gaps[0]}</div>
      )}
    </div>
  );
}

function ServiceOffersPanel({ report }: { report: ProductionReadinessReport | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Sellable services" subtitle={report ? `${report.serviceOffers.length} offers` : 'No report'} action={<Rocket size={14} className="text-s-brand" />} />
      <div className="divide-y divide-s-border">
        {(report?.serviceOffers ?? []).map((offer) => (
          <div key={offer.id} className="p-4">
            <div className="flex items-center gap-2 min-w-0">
              <SeverityBadge level={offer.ready ? 'LOW' : 'HIGH'} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{offer.name}</span>
            </div>
            <div className="mt-2 text-[12px] text-s-secondary">{offer.priceModel}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">{offer.includedCapabilities.map((item) => <Token key={item}>{item}</Token>)}</div>
            {offer.blockers.length > 0 && <div className="mt-2 text-[12px] leading-relaxed text-s-primary">Blocked by: {offer.blockers.join(', ')}</div>}
          </div>
        ))}
        {!report && <EmptyState icon={<Rocket size={18} />} title="No services audited" />}
      </div>
    </Card>
  );
}

function ActivationFlow({ report }: { report: ProductionReadinessReport | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Production delivery flow" subtitle="What the activated loop must produce every time" action={<Workflow size={14} className="text-s-brand" />} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
        {(report?.activationFlow ?? []).map((stage) => (
          <div key={stage.order} className="rounded-md border border-s-border bg-s-base p-3">
            <div className="flex items-center gap-2">
              <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 font-mono text-[9px] text-s-muted">{String(stage.order).padStart(2, '0')}</span>
              <span className="text-[13px] font-medium text-s-primary">{stage.stage}</span>
            </div>
            <div className="mt-2 text-[12px] text-s-secondary">{stage.service}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">{stage.evidence.map((item) => <Token key={item}>{item}</Token>)}</div>
          </div>
        ))}
        {!report && <EmptyState icon={<Workflow size={18} />} title="No flow yet" />}
      </div>
    </Card>
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
