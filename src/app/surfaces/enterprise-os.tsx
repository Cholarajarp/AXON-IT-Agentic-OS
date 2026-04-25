import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Rocket,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Kpi,
  PageHeader,
  SeverityBadge,
} from '../components/ui/primitives';
import {
  useEnterpriseCapabilities,
  useEnterpriseReadiness,
  type EnterpriseCapability,
  type EnterpriseGate,
} from '../lib/queries';
import { useRouting } from '../lib/useRouting';

const gateInputs = [
  { id: 'hasBlueprint', label: 'Blueprint generated' },
  { id: 'hasPreview', label: 'Preview visible' },
  { id: 'hasProvider', label: 'Provider configured' },
  { id: 'hasDatabaseReview', label: 'Database reviewed' },
  { id: 'hasSecurityReview', label: 'Security reviewed' },
  { id: 'hasDeploymentPlan', label: 'Deployment planned' },
  { id: 'hasEvidence', label: 'Evidence attached' },
] as const;

export function EnterpriseOs() {
  const capabilities = useEnterpriseCapabilities();
  const readiness = useEnterpriseReadiness();
  const { setRoute } = useRouting();
  const [inputs, setInputs] = useState<Record<(typeof gateInputs)[number]['id'], boolean>>({
    hasBlueprint: true,
    hasPreview: true,
    hasProvider: false,
    hasDatabaseReview: false,
    hasSecurityReview: false,
    hasDeploymentPlan: false,
    hasEvidence: false,
  });

  useEffect(() => {
    readiness.mutate(inputs);
  }, []);

  const liveCount = capabilities.data?.capabilities.filter((item) => item.axonStatus === 'live').length ?? 0;
  const partialCount = capabilities.data?.capabilities.filter((item) => item.axonStatus === 'partial').length ?? 0;
  const plannedCount = capabilities.data?.capabilities.filter((item) => item.axonStatus === 'planned').length ?? 0;
  const blockCount = readiness.data?.gates.filter((gate) => gate.status === 'block').length ?? 0;

  const toggle = (id: keyof typeof inputs) => {
    setInputs((current) => ({ ...current, [id]: !current[id] }));
  };

  const recalc = () => readiness.mutate(inputs);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Enterprise OS"
        description="Market-aware capability map, launch readiness, and enterprise proof gates"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Sparkles size={13} />} onClick={() => setRoute('build')}>
              Build Studio
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={readiness.isPending ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
              onClick={recalc}
            >
              Score readiness
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Readiness" value={readiness.data ? `${readiness.data.score}%` : '--'} hint={readiness.data?.status ?? 'Not scored'} />
        <Kpi label="Live Capabilities" value={String(liveCount)} hint={`${partialCount} partial · ${plannedCount} planned`} />
        <Kpi label="Blockers" value={String(blockCount)} hint="Must clear for enterprise launch" />
        <Kpi label="Market Signals" value={String(capabilities.data?.marketSignals.length ?? 0)} hint="Internal reference patterns" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="Launch posture" subtitle="Switch on gates as evidence becomes real" />
          <div className="p-4 space-y-4">
            <div className={`rounded-md border p-4 ${readiness.data?.status === 'enterprise-ready' ? 'border-s-success/30 bg-s-success/10' : 'border-s-warning/30 bg-s-warning/10'}`}>
              <div className="flex items-center gap-2 text-[13px] font-medium text-s-primary">
                {readiness.data?.status === 'enterprise-ready' ? <CheckCircle2 size={15} className="text-s-success" /> : <AlertTriangle size={15} className="text-s-warning" />}
                {readiness.data?.status ?? 'Readiness not scored'}
              </div>
              <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">
                {readiness.data?.summary ?? 'Run the readiness check to see what blocks enterprise launch.'}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {gateInputs.map((gate) => (
                <label key={gate.id} className="flex items-center gap-2 rounded-md border border-s-border bg-s-base px-3 py-2 text-[12px] text-s-primary">
                  <input
                    type="checkbox"
                    checked={inputs[gate.id]}
                    onChange={() => toggle(gate.id)}
                    className="h-4 w-4 accent-s-brand"
                  />
                  <span className="min-w-0 flex-1 truncate">{gate.label}</span>
                </label>
              ))}
            </div>

            <Button
              variant="primary"
              icon={readiness.isPending ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
              onClick={recalc}
              className="w-full justify-center"
            >
              Recalculate enterprise launch
            </Button>

            {readiness.data?.missing.length ? (
              <div className="rounded-md border border-s-border bg-s-base p-3">
                <div className="label-mono mb-2">Missing before enterprise launch</div>
                <div className="space-y-1.5">
                  {readiness.data.missing.map((item) => (
                    <div key={item} className="flex items-start gap-2 text-[11.5px] text-s-secondary">
                      <AlertTriangle size={11} className="mt-0.5 shrink-0 text-s-warning" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <div className="space-y-4 min-w-0">
          <GateBoard gates={readiness.data?.gates ?? []} />
          <LaunchSequence sequence={readiness.data?.launchSequence ?? []} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
        <CapabilityGrid capabilities={capabilities.data?.capabilities ?? []} isLoading={capabilities.isLoading} />
        <MarketSignalPanel signals={capabilities.data?.marketSignals ?? []} />
      </div>
    </div>
  );
}

function GateBoard({ gates }: { gates: EnterpriseGate[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Enterprise gates" subtitle={`${gates.length} checks`} />
      {gates.length === 0 ? (
        <EmptyState icon={<ShieldCheck size={18} />} title="No readiness score yet" description="Run the score to populate launch gates." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-4">
          {gates.map((gate) => (
            <div key={gate.id} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="flex items-center gap-2">
                <StatusDot status={gate.status} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{gate.title}</span>
                <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono uppercase text-s-muted">
                  {gate.status}
                </span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-s-muted">{gate.owner}</div>
              <div className="mt-2 text-[11.5px] leading-relaxed text-s-secondary">{gate.whyItMatters}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {gate.evidence.map((item) => (
                  <span key={item} className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono text-s-muted">
                    {item}
                  </span>
                ))}
              </div>
              {gate.status !== 'pass' && (
                <div className="mt-3 rounded border border-s-warning/30 bg-s-warning/10 px-2 py-1.5 text-[11px] text-s-secondary">
                  {gate.nextAction}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function LaunchSequence({ sequence }: { sequence: Array<{ order: number; name: string; agent: string; output: string }> }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Autonomous launch sequence" subtitle="How AXON moves from idea to operated service" />
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {sequence.map((step) => (
          <div key={step.order} className="rounded-md border border-s-border bg-s-base p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded border border-s-brand/30 bg-s-brand/10 font-mono text-[10px] text-s-brand">
                {step.order}
              </span>
              <span className="min-w-0 truncate text-[12.5px] font-medium text-s-primary">{step.name}</span>
            </div>
            <div className="font-mono text-[10px] text-s-muted">{step.agent}</div>
            <div className="mt-2 text-[11.5px] text-s-secondary">{step.output}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CapabilityGrid({ capabilities, isLoading }: { capabilities: EnterpriseCapability[]; isLoading: boolean }) {
  const grouped = useMemo(() => capabilities, [capabilities]);
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Capability map" subtitle="What AXON must ship well" />
      {isLoading ? (
        <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Loading capabilities" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
          {grouped.map((capability) => (
            <div key={capability.id} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{capability.name}</span>
                <CapabilityStatus status={capability.axonStatus} />
              </div>
              <div className="mt-1 text-[11.5px] leading-relaxed text-s-secondary">{capability.description}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {capability.marketPressure.map((name) => (
                  <span key={name} className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono text-s-muted">
                    {name}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {capability.proof.map((item) => (
                  <span key={item} className="rounded border border-s-brand/30 bg-s-brand/10 px-1.5 py-0.5 text-[9px] font-mono text-s-brand">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function MarketSignalPanel({ signals }: { signals: Array<{ name: string; positioning: string; strengths: string[]; axonResponse: string[]; sourceUrl: string }> }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Market signals" subtitle="Internal reference patterns" />
      <div className="p-4 space-y-3">
        {signals.map((signal) => (
          <div key={signal.name} className="rounded-md border border-s-border bg-s-base p-3">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{signal.name}</span>
            </div>
            <div className="mt-1 text-[11.5px] leading-relaxed text-s-secondary">{signal.positioning}</div>
            <div className="mt-3 label-mono">AXON response</div>
            <div className="mt-2 space-y-1.5">
              {signal.axonResponse.map((item) => (
                <div key={item} className="flex items-start gap-2 text-[11.5px] text-s-secondary">
                  <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-s-success" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function StatusDot({ status }: { status: EnterpriseGate['status'] }) {
  const styles = {
    pass: 'bg-s-success',
    warn: 'bg-s-warning',
    block: 'bg-s-critical',
    todo: 'bg-s-muted',
  };
  return <span className={`h-2 w-2 rounded-full ${styles[status]}`} />;
}

function CapabilityStatus({ status }: { status: EnterpriseCapability['axonStatus'] }) {
  const level = status === 'live' ? 'LOW' : status === 'partial' ? 'MEDIUM' : 'HIGH';
  return <SeverityBadge level={level} />;
}
