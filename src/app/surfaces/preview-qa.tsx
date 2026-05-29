import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  Globe2,
  Loader2,
  MonitorSmartphone,
  Play,
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
  useBrowserQaReports,
  useCreateBrowserQaReport,
  type BrowserDeviceProfile,
  type BrowserJourneyInput,
  type BrowserQaReport,
  type ValidationEvidenceInput,
} from '../lib/queries';
import { useRouting } from '../lib/useRouting';

export function PreviewQa() {
  const reports = useBrowserQaReports();
  const createReport = useCreateBrowserQaReport();
  const { setRoute } = useRouting();
  const [selected, setSelected] = useState<BrowserQaReport | null>(null);
  const [name, setName] = useState('');
  const [releaseGoal, setReleaseGoal] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [htmlSnapshot, setHtmlSnapshot] = useState('');
  const [journeyText, setJourneyText] = useState('');
  const [validationMode, setValidationMode] = useState<'passed' | 'planned' | 'failed'>('passed');

  const current = selected ?? reports.data?.reports[0] ?? null;
  const journeysPassed = current?.journeys.filter((journey) => journey.status === 'pass').length ?? 0;
  const blockers = current?.accessibilityFindings.filter((finding) => finding.blocksRelease).length ?? 0;
  const evidenceCount = current?.releaseEvidence.length ?? 0;

  const journeys = useMemo(() => parseJourneys(journeyText), [journeyText]);
  const canRunQa = !createReport.isPending && (targetUrl.trim().length > 0 || htmlSnapshot.trim().length > 0);

  const runQa = async () => {
    const validationEvidence: ValidationEvidenceInput[] =
      validationMode === 'passed'
        ? [
            { kind: 'typecheck', status: 'pass', command: 'npm run typecheck' },
            { kind: 'build', status: 'pass', command: 'npm run build' },
          ]
        : validationMode === 'failed'
          ? [{ kind: 'e2e', status: 'fail', command: 'npm run test:e2e', summary: 'Critical browser journey failed.' }]
          : [{ kind: 'e2e', status: 'planned', command: 'npm run test:e2e' }];

    const report = await createReport.mutateAsync({
      name,
      releaseGoal,
      targetUrl: targetUrl.trim() || undefined,
      htmlSnapshot: htmlSnapshot.trim() || undefined,
      journeys,
      deviceProfiles: ['desktop', 'mobile'] satisfies BrowserDeviceProfile[],
      validationEvidence,
    });
    setSelected(report);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Preview QA"
        description="Browser smoke, accessibility, viewport, Playwright, and release evidence"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<FileCheck2 size={13} />} onClick={() => setRoute('releaseCommand')}>
              Release
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={createReport.isPending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              onClick={runQa}
              disabled={!canRunQa}
            >
              {createReport.isPending ? 'Running' : 'Run QA'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="QA Score" value={current ? `${current.score}%` : '--'} hint={current?.status ?? 'No report'} />
        <Kpi label="Journeys" value={current ? `${journeysPassed}/${current.journeys.length}` : `${journeys.length}`} hint="Browser assertions" />
        <Kpi label="A11y Blockers" value={String(blockers)} hint={`${current?.accessibilityFindings.length ?? 0} findings`} />
        <Kpi label="Evidence" value={String(evidenceCount)} hint="Release artifacts" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)] gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="QA intake" subtitle="Preview, journeys, validation evidence" action={<MonitorSmartphone size={14} className="text-s-brand" />} />
          <div className="p-4 space-y-4">
            <Field label="Name" value={name} onChange={setName} placeholder="Release or product surface name" />
            <Field label="Release goal" value={releaseGoal} onChange={setReleaseGoal} placeholder="Describe the browser proof needed before customer handoff" />
            <Field label="Preview URL" value={targetUrl} onChange={setTargetUrl} placeholder="https://preview.customer-domain.com" />
            <label className="block">
              <span className="label-mono mb-1.5 block">Journeys</span>
              <textarea
                value={journeyText}
                onChange={(event) => setJourneyText(event.target.value)}
                rows={4}
                placeholder="Dashboard loads|/|Dashboard,Open account|critical"
                className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 font-mono text-[11px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <label className="block">
              <span className="label-mono mb-1.5 block">HTML snapshot</span>
              <textarea
                value={htmlSnapshot}
                onChange={(event) => setHtmlSnapshot(event.target.value)}
                rows={8}
                placeholder="Paste captured preview HTML when a preview URL is not reachable from the backend."
                className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 font-mono text-[11px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <div>
              <span className="label-mono mb-1.5 block">Validation</span>
              <div className="grid grid-cols-3 gap-2">
                {(['passed', 'planned', 'failed'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setValidationMode(mode)}
                    className={`rounded-md border px-2 py-1.5 text-[12px] capitalize ${
                      validationMode === mode
                        ? 'border-s-brand bg-s-brand/10 text-s-brand'
                        : 'border-s-border bg-s-base text-s-secondary hover:text-s-primary'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <Button
              variant="primary"
              icon={createReport.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              onClick={runQa}
              disabled={!canRunQa}
              className="w-full justify-center"
            >
              {createReport.isPending ? 'Generating evidence' : 'Generate browser QA evidence'}
            </Button>
          </div>
        </Card>

        <ReportOverview report={current} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <JourneyPanel report={current} />
        <AccessibilityPanel report={current} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <EvidencePanel report={current} />
        <ArtifactsPanel report={current} />
      </div>
    </div>
  );
}

function ReportOverview({ report }: { report: BrowserQaReport | null }) {
  if (!report) {
    return (
      <Card>
        <CardHeader title="Preview report" subtitle="No QA run yet" />
        <EmptyState icon={<Globe2 size={18} />} title="Run Preview QA" description="AXON will package viewport checks, accessibility findings, Playwright specs, and release evidence." />
      </Card>
    );
  }

  const severity = report.status === 'release-ready' ? 'LOW' : report.status === 'blocked' ? 'CRITICAL' : 'MEDIUM';
  return (
    <Card className="overflow-hidden">
      <CardHeader title={report.name} subtitle={new Date(report.createdAt).toLocaleString()} action={<SeverityBadge level={severity} />} />
      <div className="p-4 space-y-4">
        <div className={`rounded-md border p-4 ${report.status === 'blocked' ? 'border-s-critical/30 bg-s-critical/10' : report.status === 'release-ready' ? 'border-s-success/30 bg-s-success/10' : 'border-s-warning/30 bg-s-warning/10'}`}>
          <div className="flex items-center gap-2 text-[13px] font-medium text-s-primary">
            {report.status === 'release-ready' ? <CheckCircle2 size={15} className="text-s-success" /> : <AlertTriangle size={15} className={report.status === 'blocked' ? 'text-s-critical' : 'text-s-warning'} />}
            {report.status}
          </div>
          <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{report.summary}</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Mini label="Preview" value={report.preview.reachable ? 'Reachable' : 'Offline'} />
          <Mini label="Evidence mode" value={formatEvidenceMode(report.evidenceMode)} />
          <Mini label="Latency" value={report.preview.responseMs !== undefined ? `${report.preview.responseMs}ms` : '--'} />
          <Mini label="Title" value={report.preview.title ?? 'Missing'} />
        </div>

        {report.preview.error && (
          <div className="rounded-md border border-s-warning/30 bg-s-warning/10 p-3 text-[12px] text-s-secondary">
            {report.preview.error}
          </div>
        )}

        <div className="rounded-md border border-s-border bg-s-base p-3">
          <div className="label-mono mb-2">Next actions</div>
          <div className="space-y-2">
            {report.nextActions.map((action) => (
              <div key={action} className="flex items-start gap-2 text-[12px] leading-relaxed text-s-secondary">
                <ShieldCheck size={13} className="mt-0.5 shrink-0 text-s-info" />
                <span>{action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function JourneyPanel({ report }: { report: BrowserQaReport | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Journeys" subtitle={report ? `${report.journeys.length} path(s)` : 'No report'} />
      <div className="divide-y divide-s-border max-h-[520px] overflow-y-auto">
        {(report?.journeys ?? []).map((journey) => (
          <div key={journey.id} className="p-4">
            <div className="flex items-center gap-2 min-w-0">
              {journey.status === 'pass' ? <CheckCircle2 size={14} className="text-s-success" /> : <AlertTriangle size={14} className={journey.status === 'fail' ? 'text-s-critical' : 'text-s-warning'} />}
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{journey.name}</span>
              <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 font-mono text-[9px] uppercase text-s-muted">{journey.status}</span>
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{journey.intent}</div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {journey.evidence.map((item) => (
                <span key={item} className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono text-s-muted">
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
        {!report && <EmptyState icon={<MonitorSmartphone size={18} />} title="No journeys yet" />}
      </div>
    </Card>
  );
}

function AccessibilityPanel({ report }: { report: BrowserQaReport | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Accessibility" subtitle={report ? `${report.accessibilityFindings.length} finding(s)` : 'No scan'} />
      <div className="divide-y divide-s-border max-h-[520px] overflow-y-auto">
        {(report?.accessibilityFindings ?? []).map((finding) => (
          <div key={finding.id} className="p-4">
            <div className="flex items-center gap-2 min-w-0">
              <SeverityBadge level={finding.severity} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{finding.title}</span>
              {finding.blocksRelease && (
                <span className="rounded border border-s-critical/30 bg-s-critical/10 px-1.5 py-0.5 text-[9px] font-mono uppercase text-s-critical">
                  blocks
                </span>
              )}
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{finding.detail}</div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-primary">{finding.recommendation}</div>
          </div>
        ))}
        {report && report.accessibilityFindings.length === 0 && <EmptyState icon={<CheckCircle2 size={18} />} title="No accessibility findings" />}
        {!report && <EmptyState icon={<ShieldCheck size={18} />} title="No accessibility scan yet" />}
      </div>
    </Card>
  );
}

function EvidencePanel({ report }: { report: BrowserQaReport | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Release evidence" subtitle={report ? `${report.releaseEvidence.length} item(s)` : 'No evidence'} />
      <div className="p-4 space-y-2">
        {(report?.releaseEvidence ?? []).map((item) => (
          <div key={item} className="rounded-md border border-s-border bg-s-base px-3 py-2 font-mono text-[10px] text-s-muted">
            {item}
          </div>
        ))}
        {!report && <EmptyState icon={<FileCheck2 size={18} />} title="No release evidence yet" />}
      </div>
    </Card>
  );
}

function ArtifactsPanel({ report }: { report: BrowserQaReport | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Artifacts" subtitle={report ? `${report.artifacts.length} generated` : 'No artifacts'} />
      <div className="divide-y divide-s-border max-h-[520px] overflow-y-auto">
        {(report?.artifacts ?? []).map((artifact) => (
          <div key={artifact.id} className="p-4">
            <div className="flex items-center gap-2 min-w-0">
              <FileCheck2 size={14} className="text-s-success" />
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-s-primary">{artifact.path}</span>
              <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 font-mono text-[9px] uppercase text-s-muted">{artifact.kind}</span>
            </div>
            <pre className="mt-2 max-h-32 overflow-auto rounded-md border border-s-border bg-s-base p-2 text-[10px] text-s-muted">
              {artifact.contentPreview}
            </pre>
          </div>
        ))}
        {!report && <EmptyState icon={<FileCheck2 size={18} />} title="No artifacts yet" />}
      </div>
    </Card>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 block">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
      />
    </label>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-s-border bg-s-subtle p-3">
      <div className="label-mono mb-1">{label}</div>
      <div className="font-mono text-[13px] text-s-primary truncate">{value}</div>
    </div>
  );
}

function formatEvidenceMode(mode: BrowserQaReport['evidenceMode']) {
  if (mode === 'live-url') return 'Live URL';
  if (mode === 'html-snapshot') return 'HTML snapshot';
  return 'Generated fallback';
}

function parseJourneys(value: string): BrowserJourneyInput[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = 'Journey', path = '/', assertions = 'main', critical = 'normal'] = line.split('|').map((part) => part.trim());
      return {
        name,
        path,
        assertions: assertions.split(',').map((part) => part.trim()).filter(Boolean),
        critical: critical.toLowerCase() === 'critical',
      };
    });
}
