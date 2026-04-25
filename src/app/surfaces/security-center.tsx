import { useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
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
import { useRunSecurityScan, type SecurityFinding, type SecurityScanResult } from '../lib/queries';
import { useRouting } from '../lib/useRouting';

export function SecurityCenter() {
  const scan = useRunSecurityScan();
  const { setRoute } = useRouting();
  const result = scan.data;

  useEffect(() => {
    scan.mutate({ maxFiles: 700 });
    // Initial scan on page load.
  }, []);

  const blockers = result?.findings.filter((finding) => finding.blocksPublish).length ?? 0;
  const critical = result?.findings.filter((finding) => finding.severity === 'CRITICAL').length ?? 0;
  const gatesPassed = result?.publishGates.filter((gate) => gate.passed).length ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Security Center"
        description="Secrets, dependency, database, auth, and publish-safety review"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<LockKeyhole size={13} />} onClick={() => setRoute('settings')}>
              Secrets
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={scan.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              onClick={() => scan.mutate({ maxFiles: 700 })}
              disabled={scan.isPending}
            >
              {scan.isPending ? 'Scanning' : 'Run scan'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Security Score" value={result ? `${result.score}%` : '--'} hint={result?.status ?? 'Not scanned'} />
        <Kpi label="Blockers" value={String(blockers)} hint="Must fix before publish" />
        <Kpi label="Critical" value={String(critical)} hint="Immediate risk" />
        <Kpi label="Gates Passed" value={result ? `${gatesPassed}/${result.publishGates.length}` : '--'} hint={`${result?.scannedFiles ?? 0} files scanned`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-4">
        <StatusPanel result={result} isLoading={scan.isPending} error={scan.error} onScan={() => scan.mutate({ maxFiles: 700 })} />
        <FindingsPanel findings={result?.findings ?? []} isLoading={scan.isPending} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
        <GatePanel result={result} />
        <CategoryPanel result={result} />
      </div>
    </div>
  );
}

function StatusPanel({ result, isLoading, error, onScan }: { result?: SecurityScanResult; isLoading: boolean; error: Error | null; onScan: () => void }) {
  if (error) {
    return (
      <Card>
        <CardHeader title="Scan status" subtitle="Request failed" />
        <EmptyState icon={<AlertTriangle size={18} />} title="Security scan failed" description={error.message} action={<Button size="sm" onClick={onScan}>Retry</Button>} />
      </Card>
    );
  }

  const blocked = result?.status === 'blocked';
  const ready = result?.status === 'safe-to-preview';
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Publish posture" subtitle={result?.createdAt ? new Date(result.createdAt).toLocaleString() : 'Awaiting scan'} />
      <div className="p-4 space-y-4">
        <div className={`rounded-md border p-4 ${blocked ? 'border-s-critical/30 bg-s-critical/10' : ready ? 'border-s-success/30 bg-s-success/10' : 'border-s-warning/30 bg-s-warning/10'}`}>
          <div className="flex items-center gap-2 text-[13px] font-medium text-s-primary">
            {isLoading ? <Loader2 size={15} className="animate-spin text-s-brand" /> : blocked ? <ShieldAlert size={15} className="text-s-critical" /> : <ShieldCheck size={15} className={ready ? 'text-s-success' : 'text-s-warning'} />}
            {isLoading ? 'Scanning workspace' : result?.status ?? 'Not scanned'}
          </div>
          <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">
            {isLoading ? 'Checking source files, manifests, database migrations, auth patterns, and publish gates.' : result?.summary ?? 'Run a scan before publishing generated work.'}
          </div>
        </div>

        <div className="rounded-md border border-s-border bg-s-base p-3">
          <div className="label-mono mb-2">What this checks</div>
          <div className="space-y-2">
            {[
              'Hard-coded API keys, tokens, and credentials',
              'Dependency lockfile and unsafe install scripts',
              'Database tables that may need row-level access controls',
              'Dangerous HTML injection and browser token storage',
              'Publish gates that block risky launches',
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-[12px] text-s-secondary">
                <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-s-success" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <Button
          variant="primary"
          icon={isLoading ? <Loader2 size={13} className="animate-spin" /> : <FileSearch size={13} />}
          onClick={onScan}
          disabled={isLoading}
          className="w-full justify-center"
        >
          {isLoading ? 'Scanning' : 'Run publish safety scan'}
        </Button>
      </div>
    </Card>
  );
}

function FindingsPanel({ findings, isLoading }: { findings: SecurityFinding[]; isLoading: boolean }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Findings" subtitle={`${findings.length} issue${findings.length === 1 ? '' : 's'}`} />
      {isLoading ? (
        <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Scanning workspace" />
      ) : findings.length === 0 ? (
        <EmptyState icon={<ShieldCheck size={18} />} title="No security findings" description="The first-pass publish scan is clean." />
      ) : (
        <div className="divide-y divide-s-border max-h-[720px] overflow-y-auto">
          {findings.map((finding) => (
            <div key={finding.id} className="p-4">
              <div className="flex items-center gap-2 min-w-0">
                <SeverityBadge level={finding.severity} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{finding.title}</span>
                {finding.blocksPublish && (
                  <span className="rounded border border-s-critical/30 bg-s-critical/10 px-1.5 py-0.5 text-[9px] font-mono uppercase text-s-critical">
                    blocks publish
                  </span>
                )}
              </div>
              <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{finding.detail}</div>
              {finding.filePath && (
                <div className="mt-2 rounded-md border border-s-border bg-s-base px-2 py-1.5 font-mono text-[10px] text-s-muted">
                  {finding.filePath}{finding.line ? `:${finding.line}` : ''}
                </div>
              )}
              {finding.excerpt && (
                <pre className="mt-2 overflow-x-auto rounded-md border border-s-border bg-s-subtle px-2 py-1.5 text-[10.5px] text-s-muted">
                  {finding.excerpt}
                </pre>
              )}
              <div className="mt-2 text-[12px] leading-relaxed text-s-primary">{finding.recommendation}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function GatePanel({ result }: { result?: SecurityScanResult }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Publish gates" subtitle={result ? `${result.publishGates.filter((gate) => gate.passed).length}/${result.publishGates.length} passed` : 'Run a scan'} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
        {(result?.publishGates ?? []).map((gate) => (
          <div key={gate.id} className="rounded-md border border-s-border bg-s-base p-3">
            <div className="flex items-center gap-2">
              {gate.passed ? <CheckCircle2 size={14} className="text-s-success" /> : <AlertTriangle size={14} className="text-s-warning" />}
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-s-primary">{gate.title}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {gate.evidence.map((item) => (
                <span key={item} className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono text-s-muted">
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
        {!result && <EmptyState icon={<ShieldCheck size={18} />} title="No gates yet" description="Run a scan to populate publish gates." />}
      </div>
    </Card>
  );
}

function CategoryPanel({ result }: { result?: SecurityScanResult }) {
  const entries = Object.entries(result?.categories ?? {}) as Array<[string, number]>;
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Risk categories" subtitle="Finding distribution" />
      <div className="p-4 space-y-2">
        {entries.length === 0 ? (
          <EmptyState icon={<FileSearch size={18} />} title="No category data" />
        ) : (
          entries.map(([category, count]) => (
            <div key={category} className="flex items-center gap-3 rounded-md border border-s-border bg-s-base px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[12px] capitalize text-s-secondary">{category}</span>
              <span className="font-mono text-[12px] text-s-primary">{count}</span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
