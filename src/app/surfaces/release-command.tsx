import { useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Loader2,
  RadioTower,
  Rocket,
  ShieldCheck,
  Siren,
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
  useCreateReleaseCommandMission,
  useCollectReleaseEvidence,
  useCreateAutoReleaseCommandMission,
  useReleaseCommandMissions,
  type ReleaseEvidenceSnapshot,
  type ReleaseCommandMission,
  type ReleaseEnvironment,
  type ReleaseGate,
} from '../lib/queries';
import { useRouting } from '../lib/useRouting';

function parseList(value: string) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

export function ReleaseCommand() {
  const missions = useReleaseCommandMissions();
  const createMission = useCreateReleaseCommandMission();
  const collectEvidence = useCollectReleaseEvidence();
  const createAutoMission = useCreateAutoReleaseCommandMission();
  const { setRoute } = useRouting();

  const [productName, setProductName] = useState('');
  const [releaseGoal, setReleaseGoal] = useState('');
  const [environment, setEnvironment] = useState<ReleaseEnvironment>('production');
  const [regulated, setRegulated] = useState(true);
  const [slaMinutes, setSlaMinutes] = useState(15);
  const [evidenceArtifacts, setEvidenceArtifacts] = useState('');
  const [openRisks, setOpenRisks] = useState('');
  const [checks, setChecks] = useState({
    hasBlueprint: false,
    hasPreview: false,
    hasTests: false,
    hasSecurityScan: false,
    hasDatabaseReview: false,
    hasCheckpoint: false,
    hasRollbackPlan: false,
    hasDeploymentPlan: false,
    hasCustomerReport: false,
    hasApiForgeConnectors: false,
  });
  const [selected, setSelected] = useState<ReleaseCommandMission | null>(null);
  const [snapshot, setSnapshot] = useState<ReleaseEvidenceSnapshot | null>(null);

  const current = selected ?? missions.data?.missions[0] ?? null;
  const blockers = current?.gates.filter((gate) => gate.status === 'block').length ?? 0;
  const warnings = current?.gates.filter((gate) => gate.status === 'warn').length ?? 0;
  const evidencePresent = current?.evidenceManifest.filter((item) => item.present).length ?? 0;

  const create = async () => {
    const mission = await createMission.mutateAsync({
      productName,
      releaseGoal,
      environment,
      regulated,
      slaMinutes,
      evidenceArtifacts: parseList(evidenceArtifacts),
      openRisks: parseList(openRisks),
      ...checks,
    });
    setSelected(mission);
  };

  const autoCollect = async () => {
    const evidence = await collectEvidence.mutateAsync({
      releaseGoal,
      environment,
      regulated,
      slaMinutes,
    });
    setSnapshot(evidence);
    const inferred = evidence.inferredInput;
    setChecks((currentChecks) => ({
      ...currentChecks,
      hasBlueprint: Boolean(inferred.hasBlueprint),
      hasPreview: Boolean(inferred.hasPreview),
      hasTests: Boolean(inferred.hasTests),
      hasSecurityScan: Boolean(inferred.hasSecurityScan),
      hasDatabaseReview: Boolean(inferred.hasDatabaseReview),
      hasCheckpoint: Boolean(inferred.hasCheckpoint),
      hasRollbackPlan: Boolean(inferred.hasRollbackPlan),
      hasDeploymentPlan: Boolean(inferred.hasDeploymentPlan),
      hasCustomerReport: Boolean(inferred.hasCustomerReport),
      hasApiForgeConnectors: Boolean(inferred.hasApiForgeConnectors),
    }));
    setEvidenceArtifacts(evidence.evidenceArtifacts.join('\n'));
    setOpenRisks(evidence.gaps.map((gap) => gap.title).join('\n'));
  };

  const createAuto = async () => {
    const mission = await createAutoMission.mutateAsync({
      productName,
      releaseGoal,
      environment,
      regulated,
      slaMinutes,
      evidenceArtifacts: parseList(evidenceArtifacts),
      openRisks: parseList(openRisks),
    });
    setSelected(mission);
  };

  const toggle = (key: keyof typeof checks) => {
    setChecks((currentChecks) => ({ ...currentChecks, [key]: !currentChecks[key] }));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Release Command"
        description="All-in-one launch gate: security, database, tests, checkpoints, deployment, customer report, SLA, and evidence"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<ShieldCheck size={13} />} onClick={() => setRoute('enterprise')}>
              Enterprise OS
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={createMission.isPending ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
              onClick={create}
              disabled={createMission.isPending || releaseGoal.trim().length < 12}
            >
              {createMission.isPending ? 'Scoring' : 'Score launch'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Release Score" value={current ? `${current.score}%` : '--'} hint={current?.status ?? 'No mission'} />
        <Kpi label="Blockers" value={String(blockers)} hint="Must clear before production" />
        <Kpi label="Warnings" value={String(warnings)} hint="Review or accept risk" />
        <Kpi label="Evidence" value={current ? `${evidencePresent}/${current.evidenceManifest.length}` : '0/0'} hint="Manifest coverage" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)] gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="Launch intake" subtitle="Describe the release and attach known evidence" action={<Rocket size={14} className="text-s-brand" />} />
          <div className="p-4 space-y-4">
            <Field label="Product" value={productName} onChange={setProductName} placeholder="Product or service name" />
            <label className="block">
              <span className="label-mono mb-1.5 block">Release goal</span>
              <textarea
                value={releaseGoal}
                onChange={(event) => setReleaseGoal(event.target.value)}
                rows={5}
                placeholder="Describe the real release, environment, customer impact, evidence, rollback plan, and SLA."
                className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="label-mono mb-1.5 block">Environment</span>
                <select
                  value={environment}
                  onChange={(event) => setEnvironment(event.target.value as ReleaseEnvironment)}
                  className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand"
                >
                  <option value="preview">Preview</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </select>
              </label>
              <NumberField label="SLA minutes" value={slaMinutes} onChange={setSlaMinutes} />
            </div>
            <label className="flex items-center gap-2 rounded-md border border-s-border bg-s-base px-3 py-2 text-[12px] text-s-primary">
              <input type="checkbox" checked={regulated} onChange={() => setRegulated((value) => !value)} className="h-4 w-4 accent-s-brand" />
              Regulated / customer-impacting release
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(checks).map(([key, value]) => (
                <label key={key} className="flex items-center gap-2 rounded-md border border-s-border bg-s-base px-3 py-2 text-[11.5px] text-s-primary">
                  <input type="checkbox" checked={value} onChange={() => toggle(key as keyof typeof checks)} className="h-4 w-4 accent-s-brand" />
                  <span className="min-w-0 flex-1 truncate">{key.replace(/^has/, '').replace(/[A-Z]/g, ' $&').trim()}</span>
                </label>
              ))}
            </div>

            <TextArea label="Evidence artifacts" value={evidenceArtifacts} onChange={setEvidenceArtifacts} placeholder="One artifact per line: test run, security scan, checkpoint, browser QA, customer report" />
            <TextArea label="Open risks" value={openRisks} onChange={setOpenRisks} placeholder="One open risk per line" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                variant="secondary"
                icon={collectEvidence.isPending ? <Loader2 size={13} className="animate-spin" /> : <ClipboardCheck size={13} />}
                onClick={autoCollect}
                disabled={collectEvidence.isPending || releaseGoal.trim().length < 12}
                className="justify-center"
              >
                {collectEvidence.isPending ? 'Collecting' : 'Auto collect'}
              </Button>
              <Button
                variant="primary"
                icon={createAutoMission.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                onClick={createAuto}
                disabled={createAutoMission.isPending || releaseGoal.trim().length < 12}
                className="justify-center"
              >
                {createAutoMission.isPending ? 'Scoring' : 'Auto score'}
              </Button>
            </div>

            <Button
              variant="primary"
              icon={createMission.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              onClick={create}
              disabled={createMission.isPending || releaseGoal.trim().length < 12}
              className="w-full justify-center"
            >
              {createMission.isPending ? 'Creating release command' : 'Create release command'}
            </Button>
          </div>
        </Card>

        <ReleaseOverview mission={current} />
      </div>

      {snapshot && <EvidenceSnapshotPanel snapshot={snapshot} />}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <GatePanel gates={current?.gates ?? []} />
        <EvidencePanel mission={current} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <DeploymentPanel mission={current} />
        <RecoveryPanel mission={current} />
      </div>
    </div>
  );
}

function ReleaseOverview({ mission }: { mission: ReleaseCommandMission | null }) {
  if (!mission) {
    return (
      <Card>
        <CardHeader title="Release posture" subtitle="No command mission yet" />
        <EmptyState icon={<ClipboardCheck size={18} />} title="Create a release command" description="AXON will combine product, security, database, checkpoint, deployment, customer, and ops gates." />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader title={mission.productName} subtitle={`${mission.environment} • ${mission.status}`} action={<SeverityBadge level={mission.status === 'blocked' ? 'CRITICAL' : mission.status === 'ready-to-launch' ? 'LOW' : 'MEDIUM'} />} />
      <div className="p-4 space-y-4">
        <div className={`rounded-md border p-4 ${mission.status === 'ready-to-launch' ? 'border-s-success/30 bg-s-success/10' : mission.status === 'blocked' ? 'border-s-critical/30 bg-s-critical/10' : 'border-s-warning/30 bg-s-warning/10'}`}>
          <div className="flex items-center gap-2 text-[13px] font-medium text-s-primary">
            {mission.status === 'ready-to-launch' ? <CheckCircle2 size={15} className="text-s-success" /> : <AlertTriangle size={15} className={mission.status === 'blocked' ? 'text-s-critical' : 'text-s-warning'} />}
            {mission.summary}
          </div>
          <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{mission.executiveBrief}</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Mini label="SLA response" value={`${mission.slaWatch.responseMinutes}m`} />
          <Mini label="Breach risk" value={mission.slaWatch.breachRisk} />
          <Mini label="Monitors" value={String(mission.slaWatch.monitors.length)} />
        </div>
        <ListBlock title="Escalation" items={mission.slaWatch.escalation} icon={<Siren size={13} className="text-s-warning" />} />
      </div>
    </Card>
  );
}

function EvidenceSnapshotPanel({ snapshot }: { snapshot: ReleaseEvidenceSnapshot }) {
  const signalEntries = Object.entries(snapshot.signals);
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Evidence Autopilot snapshot" subtitle={`Collected ${new Date(snapshot.generatedAt).toLocaleString()}`} />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {signalEntries.map(([key, value]) => (
            <Mini key={key} label={key.replace(/[A-Z]/g, ' $&')} value={String(value)} />
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <ListBlock title="Imported evidence" items={snapshot.evidenceArtifacts.length ? snapshot.evidenceArtifacts : ['No evidence artifacts imported yet']} icon={<FileCheck2 size={13} className="text-s-info" />} />
          <div className="rounded-md border border-s-border bg-s-base p-3">
            <div className="label-mono mb-2">Gaps to close</div>
            <div className="space-y-2">
              {snapshot.gaps.map((gap) => (
                <div key={gap.id} className="rounded border border-s-border bg-s-subtle p-2">
                  <div className="text-[12px] font-medium text-s-primary">{gap.title}</div>
                  <div className="mt-1 text-[11px] text-s-muted">{gap.ownerAgent} · {gap.nextAction}</div>
                </div>
              ))}
              {snapshot.gaps.length === 0 && (
                <div className="text-[12px] text-s-secondary">No evidence gaps detected from current OS signals.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function GatePanel({ gates }: { gates: ReleaseGate[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Release gates" subtitle={`${gates.length} integrated checks`} />
      <div className="divide-y divide-s-border max-h-[620px] overflow-y-auto">
        {gates.map((gate) => (
          <div key={gate.id} className="p-4">
            <div className="flex items-center gap-2 min-w-0">
              <StatusDot status={gate.status} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{gate.title}</span>
              <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono uppercase text-s-muted">{gate.category}</span>
            </div>
            <div className="mt-1 font-mono text-[10px] text-s-muted">{gate.ownerAgent}</div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{gate.whyItMatters}</div>
            {gate.status !== 'pass' && <div className="mt-2 text-[12px] text-s-primary">{gate.nextAction}</div>}
          </div>
        ))}
        {gates.length === 0 && <EmptyState icon={<ShieldCheck size={18} />} title="No gates yet" />}
      </div>
    </Card>
  );
}

function EvidencePanel({ mission }: { mission: ReleaseCommandMission | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Evidence manifest" subtitle="Required launch proof" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
        {(mission?.evidenceManifest ?? []).map((item) => (
          <div key={item.id} className="rounded-md border border-s-border bg-s-base p-3">
            <div className="flex items-center gap-2">
              {item.present ? <CheckCircle2 size={14} className="text-s-success" /> : item.required ? <AlertTriangle size={14} className="text-s-warning" /> : <FileCheck2 size={14} className="text-s-muted" />}
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-s-primary">{item.title}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-mono text-s-muted">
              <span>{item.source}</span>
              <span>{item.required ? 'required' : 'optional'} / {item.present ? 'present' : 'missing'}</span>
            </div>
          </div>
        ))}
        {!mission && <EmptyState icon={<FileCheck2 size={18} />} title="No manifest yet" />}
      </div>
    </Card>
  );
}

function DeploymentPanel({ mission }: { mission: ReleaseCommandMission | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Deployment stages" subtitle="Release execution runbook" />
      <div className="divide-y divide-s-border">
        {(mission?.deploymentStages ?? []).map((stage) => (
          <div key={stage.order} className="p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-s-border bg-s-subtle font-mono text-[10px] text-s-primary">{stage.order}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{stage.name}</span>
            </div>
            <div className="mt-1 font-mono text-[10px] text-s-muted">{stage.ownerAgent}</div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{stage.action}</div>
          </div>
        ))}
        {!mission && <EmptyState icon={<Rocket size={18} />} title="No deployment plan yet" />}
      </div>
    </Card>
  );
}

function RecoveryPanel({ mission }: { mission: ReleaseCommandMission | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Fault recovery" subtitle="Failure detection and response" />
      <div className="divide-y divide-s-border">
        {(mission?.faultRecovery ?? []).map((item) => (
          <div key={item.failureMode} className="p-4">
            <div className="flex items-center gap-2">
              <RadioTower size={14} className="text-s-warning" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{item.failureMode}</span>
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{item.detection}</div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-primary">{item.recovery}</div>
            <div className="mt-2 font-mono text-[10px] text-s-muted">{item.ownerAgent}</div>
          </div>
        ))}
        {!mission && <EmptyState icon={<RadioTower size={18} />} title="No recovery model yet" />}
      </div>
    </Card>
  );
}

function StatusDot({ status }: { status: ReleaseGate['status'] }) {
  const classes = status === 'pass' ? 'bg-s-success' : status === 'warn' ? 'bg-s-warning' : 'bg-s-critical';
  return <span className={`h-2 w-2 shrink-0 rounded-full ${classes}`} />;
}

function ListBlock({ title, items, icon }: { title: string; items: string[]; icon: ReactNode }) {
  return (
    <div className="rounded-md border border-s-border bg-s-base p-3">
      <div className="label-mono mb-2">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className="inline-flex items-center gap-1 rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono text-s-muted">
            {icon}
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-s-border bg-s-subtle p-3">
      <div className="label-mono mb-1">{label}</div>
      <div className="font-mono text-lg text-s-primary">{value}</div>
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
      <input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand" />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 block">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} placeholder={placeholder} className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[12px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand" />
    </label>
  );
}
