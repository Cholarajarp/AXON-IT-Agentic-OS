import { useEffect } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ClipboardList,
  FolderTree,
  GitCompareArrows,
  GitPullRequest,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
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
  useRunStructureGuardianScan,
  type StructureAction,
  type StructureFinding,
  type StructureScanResult,
} from '../lib/queries';

const actionStyles: Record<StructureAction, string> = {
  keep: 'border-s-success/30 bg-s-success/10 text-s-success',
  ignore: 'border-s-border bg-s-subtle text-s-secondary',
  archive: 'border-s-warning/30 bg-s-warning/10 text-s-warning',
  migrate: 'border-s-info/30 bg-s-info/10 text-s-info',
  delete: 'border-s-critical/30 bg-s-critical/10 text-s-critical',
  review: 'border-s-warning/30 bg-s-warning/10 text-s-warning',
};

export function StructureGuardian() {
  const scan = useRunStructureGuardianScan();
  const result = scan.data;

  useEffect(() => {
    scan.mutate({ includeNested: true });
  }, []);

  const blockers = result?.findings.filter((finding) => finding.blocksCleanup).length ?? 0;
  const duplicateDrift = result?.legacyComparison.driftedSharedCount ?? 0;
  const cleanupCandidates = result?.cleanupCandidates.length ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Structure Guardian"
        description="Canonical source tree, duplicate config review, cleanup safety, and enterprise build gaps"
        action={
          <Button
            variant="primary"
            size="sm"
            icon={scan.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            onClick={() => scan.mutate({ includeNested: true })}
            disabled={scan.isPending}
          >
            {scan.isPending ? 'Scanning' : 'Scan workspace'}
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Structure Score" value={result ? `${result.score}%` : '--'} hint={result?.status ?? 'Not scanned'} />
        <Kpi label="Cleanup Blockers" value={String(blockers)} hint="Need owner approval" />
        <Kpi label="Legacy Drift" value={String(duplicateDrift)} hint="Root vs migration package" />
        <Kpi label="Cleanup Items" value={String(cleanupCandidates)} hint="Delete, ignore, archive, migrate" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-4">
        <PosturePanel result={result} isLoading={scan.isPending} error={scan.error} onScan={() => scan.mutate({ includeNested: true })} />
        <FindingsPanel findings={result?.findings ?? []} isLoading={scan.isPending} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
        <KeepPanel result={result} />
        <CleanupPanel result={result} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <LegacyComparePanel result={result} />
        <ConfigPanel result={result} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <MigrationPanel result={result} />
        <GapPanel result={result} />
      </div>
    </div>
  );
}

function LegacyComparePanel({ result }: { result?: StructureScanResult }) {
  const comparison = result?.legacyComparison;
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Legacy comparison" subtitle={comparison?.legacyRoot ?? 'Root vs legacy source'} />
      {!comparison ? (
        <EmptyState icon={<GitCompareArrows size={18} />} title="No comparison yet" />
      ) : (
        <div className="p-4 space-y-4">
          <div className="rounded-md border border-s-border bg-s-base p-3 text-[12px] leading-relaxed text-s-secondary">
            {comparison.summary}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniMetric label="Exact" value={comparison.exactDuplicateCount} />
            <MiniMetric label="Drifted" value={comparison.driftedSharedCount} />
            <MiniMetric label="Legacy only" value={comparison.legacyOnlyCount} />
            <MiniMetric label="Root only" value={comparison.rootOnlyCount} />
          </div>
          <div className="space-y-2">
            <div className="label-mono">Drifted shared files</div>
            {comparison.driftedSharedFiles.slice(0, 8).map((file) => (
              <div key={file.path} className="rounded-md border border-s-border bg-s-base p-2">
                <div className="flex items-center gap-2">
                  <GitPullRequest size={13} className="text-s-warning" />
                  <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-s-primary">{file.path}</span>
                  <span className="shrink-0 font-mono text-[10px] text-s-muted">
                    {file.rootBytes}/{file.legacyBytes}b
                  </span>
                </div>
              </div>
            ))}
            {comparison.driftedSharedFiles.length === 0 && (
              <div className="rounded-md border border-s-border bg-s-base p-3 text-[12px] text-s-muted">
                No drifted shared files after ignore rules.
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function ConfigPanel({ result }: { result?: StructureScanResult }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Config matrix" subtitle="Duplicate root configs should stay removed" />
      <div className="divide-y divide-s-border">
        {(result?.duplicateConfigs ?? []).map((config) => (
          <div key={config.fileName} className="p-3">
            <div className="flex items-center gap-2">
              <GitCompareArrows size={13} className={config.status === 'same' ? 'text-s-success' : config.status === 'different' ? 'text-s-warning' : 'text-s-muted'} />
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-s-primary">{config.fileName}</span>
              <span className={`rounded border px-1.5 py-0.5 text-[9px] font-mono uppercase ${
                config.status === 'same'
                  ? 'border-s-success/30 bg-s-success/10 text-s-success'
                  : config.status === 'different'
                    ? 'border-s-warning/30 bg-s-warning/10 text-s-warning'
                    : 'border-s-border bg-s-subtle text-s-muted'
              }`}>
                {config.status}
              </span>
            </div>
            <div className="mt-2 text-[11.5px] leading-relaxed text-s-secondary">{config.recommendation}</div>
          </div>
        ))}
        {!result && <EmptyState icon={<GitCompareArrows size={18} />} title="No config matrix yet" />}
      </div>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-s-border bg-s-subtle p-3">
      <div className="label-mono mb-1">{label}</div>
      <div className="font-mono text-xl text-s-primary">{value}</div>
    </div>
  );
}

function PosturePanel({
  result,
  isLoading,
  error,
  onScan,
}: {
  result?: StructureScanResult;
  isLoading: boolean;
  error: Error | null;
  onScan: () => void;
}) {
  if (error) {
    return (
      <Card>
        <CardHeader title="Workspace posture" subtitle="Scan failed" />
        <EmptyState icon={<AlertTriangle size={18} />} title="Structure scan failed" description={error.message} action={<Button size="sm" onClick={onScan}>Retry</Button>} />
      </Card>
    );
  }

  const blocked = result?.status === 'blocked';
  const clean = result?.status === 'clean';

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Workspace posture" subtitle={result?.createdAt ? new Date(result.createdAt).toLocaleString() : 'Awaiting scan'} />
      <div className="p-4 space-y-4">
        <div className={`rounded-md border p-4 ${blocked ? 'border-s-critical/30 bg-s-critical/10' : clean ? 'border-s-success/30 bg-s-success/10' : 'border-s-warning/30 bg-s-warning/10'}`}>
          <div className="flex items-center gap-2 text-[13px] font-medium text-s-primary">
            {isLoading ? <Loader2 size={15} className="animate-spin text-s-brand" /> : clean ? <ShieldCheck size={15} className="text-s-success" /> : <AlertTriangle size={15} className={blocked ? 'text-s-critical' : 'text-s-warning'} />}
            {isLoading ? 'Scanning project structure' : result?.status ?? 'Not scanned'}
          </div>
          <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">
            {isLoading ? 'Checking canonical roots, duplicate configs, generated artifacts, local state, and enterprise gaps.' : result?.summary ?? 'Run a scan before deleting or moving project files.'}
          </div>
        </div>

        <div className="rounded-md border border-s-border bg-s-base p-3">
          <div className="label-mono mb-2">Cleanup rule</div>
          <div className="space-y-2">
            {[
              'Root src and backend/src are the canonical application.',
              'Nested source with .git is treated as migration material until archived.',
              'Generated output can be removed only when a rebuild path exists.',
              'Config drift must be migrated or accepted before cleanup.',
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-[12px] text-s-secondary">
                <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-s-success" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function FindingsPanel({ findings, isLoading }: { findings: StructureFinding[]; isLoading: boolean }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Findings" subtitle={`${findings.length} structure signal${findings.length === 1 ? '' : 's'}`} />
      {isLoading ? (
        <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Scanning workspace" />
      ) : findings.length === 0 ? (
        <EmptyState icon={<FolderTree size={18} />} title="No findings yet" description="Run a scan to inspect the workspace." />
      ) : (
        <div className="divide-y divide-s-border max-h-[720px] overflow-y-auto">
          {findings.map((finding) => (
            <div key={finding.id} className="p-4">
              <div className="flex items-center gap-2 min-w-0">
                {finding.severity === 'INFO' ? (
                  <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[10px] font-mono text-s-muted">INFO</span>
                ) : (
                  <SeverityBadge level={finding.severity} />
                )}
                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase ${actionStyles[finding.action]}`}>
                  {finding.action}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{finding.title}</span>
              </div>
              <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{finding.detail}</div>
              {finding.path && (
                <div className="mt-2 rounded-md border border-s-border bg-s-base px-2 py-1.5 font-mono text-[10px] text-s-muted">
                  {finding.path}
                </div>
              )}
              <div className="mt-2 text-[12px] leading-relaxed text-s-primary">{finding.recommendation}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function KeepPanel({ result }: { result?: StructureScanResult }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Valid source to keep" subtitle="Canonical paths and owners" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
        {(result?.validKeepPaths ?? []).map((entry) => (
          <div key={entry.path} className="rounded-md border border-s-border bg-s-base p-3">
            <div className="flex items-center gap-2">
              <FolderTree size={14} className="text-s-success" />
              <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-s-primary">{entry.path}</span>
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{entry.reason}</div>
            <div className="mt-2 rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono text-s-muted inline-flex">
              {entry.ownerAgent}
            </div>
          </div>
        ))}
        {!result && <EmptyState icon={<FolderTree size={18} />} title="No source map yet" />}
      </div>
    </Card>
  );
}

function CleanupPanel({ result }: { result?: StructureScanResult }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Cleanup candidates" subtitle="Review before action" />
      <div className="divide-y divide-s-border">
        {(result?.cleanupCandidates ?? []).map((candidate) => (
          <div key={`${candidate.path}-${candidate.action}`} className="p-4">
            <div className="flex items-center gap-2 min-w-0">
              {candidate.action === 'delete' ? <Trash2 size={14} className="text-s-critical" /> : candidate.action === 'archive' ? <Archive size={14} className="text-s-warning" /> : <GitCompareArrows size={14} className="text-s-info" />}
              <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-s-primary">{candidate.path}</span>
              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase ${actionStyles[candidate.action]}`}>
                {candidate.action}
              </span>
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{candidate.reason}</div>
            {candidate.safeCommand && (
              <div className="mt-2 rounded-md border border-s-border bg-s-base px-2 py-1.5 font-mono text-[10px] text-s-muted">
                {candidate.safeCommand}
              </div>
            )}
          </div>
        ))}
        {(!result || result.cleanupCandidates.length === 0) && (
          <EmptyState icon={<CheckCircle2 size={18} />} title="No cleanup candidates" />
        )}
      </div>
    </Card>
  );
}

function MigrationPanel({ result }: { result?: StructureScanResult }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Migration plan" subtitle="How to remove duplicate trees safely" />
      <div className="p-4 space-y-3">
        {(result?.migrationPlan ?? []).map((step) => (
          <div key={step.order} className="rounded-md border border-s-border bg-s-base p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-s-border bg-s-subtle font-mono text-[10px] text-s-primary">
                {step.order}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-s-primary">{step.ownerAgent}</span>
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{step.action}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {step.evidence.map((item) => (
                <span key={item} className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono text-s-muted">
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
        {!result && <EmptyState icon={<ClipboardList size={18} />} title="No migration plan yet" />}
      </div>
    </Card>
  );
}

function GapPanel({ result }: { result?: StructureScanResult }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Enterprise gaps" subtitle="Capabilities to become a real IT operating platform" />
      <div className="divide-y divide-s-border">
        {(result?.missingEnterpriseCapabilities ?? []).map((gap) => (
          <div key={gap.id} className="p-4">
            <div className="flex items-center gap-2 text-[13px] font-medium text-s-primary">
              <ClipboardList size={14} className="text-s-brand" />
              <span className="min-w-0 flex-1 truncate">{gap.capability}</span>
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{gap.whyItMatters}</div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-primary">{gap.buildNext}</div>
          </div>
        ))}
        {!result && <EmptyState icon={<ClipboardList size={18} />} title="No gap analysis yet" />}
      </div>
    </Card>
  );
}
