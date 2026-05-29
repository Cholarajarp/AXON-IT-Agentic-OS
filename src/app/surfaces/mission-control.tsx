import { useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  GitBranch,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
} from 'lucide-react';
import { Button, Card, CardHeader, EmptyState, Kpi, PageHeader, SeverityBadge } from '../components/ui/primitives';
import {
  useCreateMissionControlRun,
  useMissionControlRuns,
  type MissionControlRun,
  type ReleaseEnvironment,
} from '../lib/queries';
import { useRouting } from '../lib/useRouting';

export function MissionControl() {
  const runs = useMissionControlRuns();
  const createRun = useCreateMissionControlRun();
  const { setRoute } = useRouting();
  const [mission, setMission] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [environment, setEnvironment] = useState<ReleaseEnvironment>('preview');
  const [regulated, setRegulated] = useState(true);
  const [htmlSnapshot, setHtmlSnapshot] = useState('');
  const [selected, setSelected] = useState<MissionControlRun | null>(null);

  const list = runs.data?.runs ?? [];
  const current = selected ?? list[0] ?? null;
  const passCount = current?.phases.filter((phase) => phase.status === 'pass').length ?? 0;
  const blockedCount = current?.phases.filter((phase) => phase.status === 'block').length ?? 0;

  const run = async () => {
    const created = await createRun.mutateAsync({
      customerName,
      mission,
      environment,
      regulated,
      htmlSnapshot,
      compliance: regulated ? ['SOC 2', 'ISO 27001'] : [],
      integrations: ['GitHub', 'PostgreSQL', 'Browser QA'],
    });
    setSelected(created);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mission Control"
        description="One autonomous loop: plan, sandbox, preview QA, security, blackboard, release gate, and evidence"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<FileCheck2 size={13} />} onClick={() => setRoute('releaseCommand')}>
              Release
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={createRun.isPending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              onClick={run}
              disabled={createRun.isPending || mission.trim().length < 12}
            >
              {createRun.isPending ? 'Running' : 'Run mission'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Mission Score" value={current ? `${current.score}%` : '--'} hint={current?.status ?? 'No run'} />
        <Kpi label="Phases Passed" value={current ? `${passCount}/${current.phases.length}` : '--'} hint="Autonomous loop" />
        <Kpi label="Blockers" value={String(blockedCount)} hint="Release blockers" />
        <Kpi label="Evidence" value={String(current?.evidence.length ?? 0)} hint="Attached artifacts" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)] gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="Mission intake" subtitle="AXON infers defaults and executes the gated loop" action={<ClipboardCheck size={14} className="text-s-brand" />} />
          <div className="p-4 space-y-4">
            <Field label="Customer" value={customerName} onChange={setCustomerName} placeholder="Customer or internal business owner" />
            <label className="block">
              <span className="label-mono mb-1.5 block">Mission</span>
              <textarea
                value={mission}
                onChange={(event) => setMission(event.target.value)}
                rows={5}
                placeholder="Describe the real product or service outcome, repository context, target users, quality gates, timeline, and release environment."
                className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="label-mono mb-1.5 block">Environment</span>
                <select value={environment} onChange={(event) => setEnvironment(event.target.value as ReleaseEnvironment)} className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand">
                  <option value="preview">preview</option>
                  <option value="staging">staging</option>
                  <option value="production">production</option>
                </select>
              </label>
              <label className="flex items-center justify-between gap-3 rounded-md border border-s-border bg-s-base px-3 py-2">
                <span className="text-[12.5px] text-s-primary">Regulated</span>
                <input type="checkbox" checked={regulated} onChange={(event) => setRegulated(event.target.checked)} className="h-4 w-4 accent-s-brand" />
              </label>
            </div>
            <label className="block">
              <span className="label-mono mb-1.5 block">Preview HTML snapshot</span>
              <textarea
                value={htmlSnapshot}
                onChange={(event) => setHtmlSnapshot(event.target.value)}
                rows={8}
                placeholder="Paste captured preview HTML when a live preview URL is not available."
                className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 font-mono text-[11px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <Button
              variant="primary"
              icon={createRun.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              onClick={run}
              disabled={createRun.isPending || mission.trim().length < 12}
              className="w-full justify-center"
            >
              {createRun.isPending ? 'Executing OS loop' : 'Plan, verify, and score release'}
            </Button>
          </div>
        </Card>

        <RunList runs={list} selectedId={current?.id} isLoading={runs.isLoading} onSelect={setSelected} onRefresh={() => runs.refetch()} />
      </div>

      <RunDetail run={current} />
    </div>
  );
}

function RunList({ runs, selectedId, isLoading, onSelect, onRefresh }: { runs: MissionControlRun[]; selectedId?: string; isLoading: boolean; onSelect: (run: MissionControlRun) => void; onRefresh: () => void }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Mission runs" subtitle={`${runs.length} autonomous run${runs.length === 1 ? '' : 's'}`} action={<Button size="sm" variant="ghost" icon={<RefreshCw size={12} />} onClick={onRefresh}>Refresh</Button>} />
      {isLoading ? (
        <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Loading mission runs" />
      ) : runs.length === 0 ? (
        <EmptyState icon={<Bot size={18} />} title="No mission runs yet" description="Run the autonomous loop to connect planning, sandboxing, QA, security, evidence, and release." />
      ) : (
        <div className="divide-y divide-s-border max-h-[620px] overflow-y-auto">
          {runs.map((item) => (
            <button key={item.id} onClick={() => onSelect(item)} className={`w-full p-4 text-left ${selectedId === item.id ? 'bg-s-brand/5' : 'hover:bg-s-hover'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <SeverityBadge level={severityForStatus(item.status)} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{item.mission}</span>
                <span className="font-mono text-[11px] text-s-muted">{item.score}%</span>
              </div>
              <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{item.summary}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Token>{item.blueprintId}</Token>
                <Token>{item.sandboxSessionId}</Token>
                <Token>{item.releaseMissionId}</Token>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function RunDetail({ run }: { run: MissionControlRun | null }) {
  if (!run) {
    return (
      <Card>
        <EmptyState icon={<ClipboardCheck size={18} />} title="No mission selected" description="A mission run will show the full IT service software workflow from intake to release gate." />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
      <Card className="overflow-hidden">
        <CardHeader title="Autonomous execution phases" subtitle={run.summary} action={<SeverityBadge level={severityForStatus(run.status)} />} />
        <div className="p-4 space-y-3">
          {run.phases.map((phase) => (
            <div key={phase.order} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="flex items-center gap-2 min-w-0">
                {phase.status === 'pass' ? <CheckCircle2 size={14} className="text-s-success" /> : <AlertTriangle size={14} className={phase.status === 'block' ? 'text-s-critical' : 'text-s-warning'} />}
                <span className="font-mono text-[10px] text-s-muted">{String(phase.order).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{phase.name}</span>
                <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 font-mono text-[9px] uppercase text-s-muted">{phase.status}</span>
              </div>
              <div className="mt-2 text-[12px] text-s-secondary">{phase.ownerAgent}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">{phase.evidence.map((item) => <Token key={item}>{item}</Token>)}</div>
              {phase.status !== 'pass' && <div className="mt-2 text-[12px] leading-relaxed text-s-primary">{phase.nextAction}</div>}
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-4 min-w-0">
        <SidePanel title="Connected systems" icon={<GitBranch size={14} className="text-s-brand" />}>
          <Asset label="Model FinOps" value={run.finOpsReportId} />
          <Asset label="Agentic Mesh" value={run.agenticMeshBlueprintId} />
          <Asset label="Blueprint" value={run.blueprintId} />
          <Asset label="Database Review" value={run.databaseReviewId} />
          <Asset label="API Forge" value={run.apiForgeReportId} />
          <Asset label="Customer Account" value={run.customerAccountId} />
          <Asset label="Customer Report" value={run.customerReportId} />
          <Asset label="Sandbox" value={run.sandboxSessionId} />
          <Asset label="Browser QA" value={run.browserQaReportId} />
          <Asset label="Blackboard" value={run.blackboardId} />
          <Asset label="Release mission" value={run.releaseMissionId} />
        </SidePanel>
        <SidePanel title="Agent team" icon={<Bot size={14} className="text-s-brand" />}>
          <div className="flex flex-wrap gap-1.5">{run.agentTeam.map((agent) => <Token key={agent}>{agent}</Token>)}</div>
        </SidePanel>
        <SidePanel title="Evidence" icon={<FileCheck2 size={14} className="text-s-success" />}>
          <div className="space-y-1.5">{run.evidence.map((item) => <Line key={item} icon={<ShieldCheck size={12} className="text-s-success" />}>{item}</Line>)}</div>
        </SidePanel>
        <SidePanel title="Next actions" icon={<TerminalSquare size={14} className="text-s-warning" />}>
          <div className="space-y-1.5">{run.nextActions.length ? run.nextActions.map((item) => <Line key={item} icon={<AlertTriangle size={12} className="text-s-warning" />}>{item}</Line>) : <Line icon={<CheckCircle2 size={12} className="text-s-success" />}>Ready for the next release stage.</Line>}</div>
        </SidePanel>
      </div>
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
      <div className="font-mono text-[11px] text-s-primary truncate">{value}</div>
    </div>
  );
}

function Token({ children }: { children: ReactNode }) {
  return <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[10px] font-mono text-s-muted">{children}</span>;
}

function Line({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[12px] leading-relaxed text-s-secondary">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function severityForStatus(status: MissionControlRun['status']) {
  if (status === 'ready') return 'LOW';
  if (status === 'blocked') return 'CRITICAL';
  return 'MEDIUM';
}
