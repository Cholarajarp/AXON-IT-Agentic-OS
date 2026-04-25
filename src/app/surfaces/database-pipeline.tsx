import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileCheck2,
  Loader2,
  PlayCircle,
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
import {
  useDatabasePolicies,
  useReviewDatabaseMigration,
  type DatabaseEngine,
  type DatabaseEnvironment,
  type DatabaseFinding,
  type DatabaseReviewResult,
  type MigrationType,
} from '../lib/queries';

const controlInput = 'w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[12.5px] text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand';

export function DatabasePipeline() {
  const [name, setName] = useState('');
  const [sql, setSql] = useState('');
  const [engine, setEngine] = useState<DatabaseEngine>('postgresql');
  const [environment, setEnvironment] = useState<DatabaseEnvironment>('staging');
  const [migrationType, setMigrationType] = useState<MigrationType>('schema');
  const [estimatedRows, setEstimatedRows] = useState(250000);
  const [tableSizeGb, setTableSizeGb] = useState(4);
  const [hasRollbackPlan, setHasRollbackPlan] = useState(false);
  const [hasBackupCheckpoint, setHasBackupCheckpoint] = useState(false);

  const policies = useDatabasePolicies();
  const reviewMigration = useReviewDatabaseMigration();
  const review = reviewMigration.data;

  const blockingFindings = review?.findings.filter((finding) => finding.blocksProduction).length ?? 0;
  const requiredStages = review?.pipelineStages.filter((stage) => stage.required).length ?? 0;
  const qualityGateCount = review?.qualityGates.length ?? 0;

  const submit = async () => {
    await reviewMigration.mutateAsync({
      name,
      sql,
      engine,
      environment,
      migrationType,
      estimatedRows,
      tableSizeGb,
      hasRollbackPlan,
      hasBackupCheckpoint,
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Database Pipeline"
        description="Safe schema, data, and product database change review"
        action={
          <Button
            variant="primary"
            icon={reviewMigration.isPending ? <Loader2 size={13} className="animate-spin" /> : <PlayCircle size={13} />}
            onClick={submit}
            disabled={reviewMigration.isPending || sql.trim().length === 0}
          >
            {reviewMigration.isPending ? 'Reviewing' : 'Run review'}
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Risk Score" value={review ? String(review.riskScore) : '--'} hint={review?.severity ?? 'No review yet'} />
        <Kpi label="Blocking Findings" value={String(blockingFindings)} hint={review?.blocked ? 'Production blocked' : 'No production block'} />
        <Kpi label="Quality Gates" value={String(qualityGateCount)} hint={review?.safeMigrationPlan.strategy ?? 'Awaiting SQL'} />
        <Kpi label="Required Stages" value={String(requiredStages)} hint={`${review?.agents.length ?? 6} agents wired`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)] gap-4">
        <ReviewForm
          name={name}
          sql={sql}
          engine={engine}
          environment={environment}
          migrationType={migrationType}
          estimatedRows={estimatedRows}
          tableSizeGb={tableSizeGb}
          hasRollbackPlan={hasRollbackPlan}
          hasBackupCheckpoint={hasBackupCheckpoint}
          onName={setName}
          onSql={setSql}
          onEngine={setEngine}
          onEnvironment={setEnvironment}
          onMigrationType={setMigrationType}
          onEstimatedRows={setEstimatedRows}
          onTableSizeGb={setTableSizeGb}
          onRollbackPlan={setHasRollbackPlan}
          onBackupCheckpoint={setHasBackupCheckpoint}
          onSubmit={submit}
          isPending={reviewMigration.isPending}
        />

        <ReviewResultPanel review={review} error={reviewMigration.error} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
        <PipelineStages review={review} />
        <PolicyPanel policies={policies.data?.policies ?? []} isLoading={policies.isLoading} />
      </div>
    </div>
  );
}

function ReviewForm({
  name,
  sql,
  engine,
  environment,
  migrationType,
  estimatedRows,
  tableSizeGb,
  hasRollbackPlan,
  hasBackupCheckpoint,
  onName,
  onSql,
  onEngine,
  onEnvironment,
  onMigrationType,
  onEstimatedRows,
  onTableSizeGb,
  onRollbackPlan,
  onBackupCheckpoint,
  onSubmit,
  isPending,
}: {
  name: string;
  sql: string;
  engine: DatabaseEngine;
  environment: DatabaseEnvironment;
  migrationType: MigrationType;
  estimatedRows: number;
  tableSizeGb: number;
  hasRollbackPlan: boolean;
  hasBackupCheckpoint: boolean;
  onName: (value: string) => void;
  onSql: (value: string) => void;
  onEngine: (value: DatabaseEngine) => void;
  onEnvironment: (value: DatabaseEnvironment) => void;
  onMigrationType: (value: MigrationType) => void;
  onEstimatedRows: (value: number) => void;
  onTableSizeGb: (value: number) => void;
  onRollbackPlan: (value: boolean) => void;
  onBackupCheckpoint: (value: boolean) => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Migration input" subtitle="SQL, engine, environment, and safety evidence" action={<Database size={15} className="text-s-brand" />} />
      <div className="p-4 space-y-4">
        <Field label="Change name">
          <input
            value={name}
            onChange={(event) => onName(event.target.value)}
            className={controlInput}
            placeholder="Production schema or data migration name"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Engine">
            <select value={engine} onChange={(event) => onEngine(event.target.value as DatabaseEngine)} className={controlInput}>
              <option value="postgresql">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="sqlite">SQLite</option>
              <option value="sqlserver">SQL Server</option>
            </select>
          </Field>
          <Field label="Environment">
            <select value={environment} onChange={(event) => onEnvironment(event.target.value as DatabaseEnvironment)} className={controlInput}>
              <option value="dev">Dev</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </Field>
          <Field label="Type">
            <select value={migrationType} onChange={(event) => onMigrationType(event.target.value as MigrationType)} className={controlInput}>
              <option value="schema">Schema</option>
              <option value="data">Data</option>
              <option value="seed">Seed</option>
              <option value="rollback">Rollback</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Estimated rows">
            <input
              type="number"
              min={0}
              value={estimatedRows}
              onChange={(event) => onEstimatedRows(Number(event.target.value))}
              className={controlInput}
            />
          </Field>
          <Field label="Table size GB">
            <input
              type="number"
              min={0}
              value={tableSizeGb}
              onChange={(event) => onTableSizeGb(Number(event.target.value))}
              className={controlInput}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <CheckRow label="Rollback plan attached" checked={hasRollbackPlan} onChange={onRollbackPlan} />
          <CheckRow label="Backup checkpoint ready" checked={hasBackupCheckpoint} onChange={onBackupCheckpoint} />
        </div>

        <Field label="Migration SQL">
          <textarea
            value={sql}
            onChange={(event) => onSql(event.target.value)}
            placeholder="Paste the actual migration SQL to review, such as ALTER TABLE, CREATE INDEX CONCURRENTLY, or controlled UPDATE statements."
            className="min-h-[260px] w-full resize-y rounded-md border border-s-border bg-s-base px-3 py-2 font-mono text-[12px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
            spellCheck={false}
          />
        </Field>

        <Button
          variant="primary"
          icon={isPending ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
          onClick={onSubmit}
          disabled={isPending || sql.trim().length === 0}
          className="w-full justify-center"
        >
          {isPending ? 'Reviewing migration' : 'Review database change'}
        </Button>
      </div>
    </Card>
  );
}

function ReviewResultPanel({ review, error }: { review?: DatabaseReviewResult; error: Error | null }) {
  if (error) {
    return (
      <Card>
        <CardHeader title="Review result" subtitle="Request failed" />
        <EmptyState icon={<AlertTriangle size={18} />} title="Review failed" description={error.message} />
      </Card>
    );
  }

  if (!review) {
    return (
      <Card>
        <CardHeader title="Review result" subtitle="Awaiting migration SQL" />
        <EmptyState
          icon={<ShieldCheck size={18} />}
          title="Run a database safety review"
          description="Findings, staged rollout, rollback notes, and quality gates appear here."
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Review result"
        subtitle={review.summary}
        action={<SeverityBadge level={review.severity} />}
      />
      <div className="p-4 space-y-4">
        <div className={`rounded-md border px-3 py-2 ${review.blocked ? 'border-s-critical/30 bg-s-critical/10' : 'border-s-success/30 bg-s-success/10'}`}>
          <div className="flex items-center gap-2 text-[13px] font-medium text-s-primary">
            {review.blocked ? <ShieldAlert size={15} className="text-s-critical" /> : <CheckCircle2 size={15} className="text-s-success" />}
            {review.blocked ? 'Blocked for production' : review.approvalRequired ? 'Approval required' : 'Safe to apply with gates'}
          </div>
          <div className="mt-1 text-[12px] leading-relaxed text-s-secondary">
            Strategy: <span className="font-mono text-s-primary">{review.safeMigrationPlan.strategy}</span> · Statements: {review.statementCount}
          </div>
        </div>

        <FindingList findings={review.findings} />

        <div>
          <SectionLabel>Safe migration plan</SectionLabel>
          <div className="space-y-2">
            {review.safeMigrationPlan.phases.map((phase) => (
              <div key={phase.name} className="rounded-md border border-s-border bg-s-base p-3">
                <div className="text-[12.5px] font-medium text-s-primary">{phase.name}</div>
                <div className="mt-1 text-[11.5px] leading-relaxed text-s-secondary">{phase.description}</div>
                <TokenList values={phase.requiredEvidence} />
              </div>
            ))}
          </div>
        </div>

        <TwoColumnList title="Rollback plan" values={review.rollbackPlan} icon={<FileCheck2 size={13} />} />
        <TwoColumnList title="Quality gates" values={review.qualityGates} icon={<ShieldCheck size={13} />} />
      </div>
    </Card>
  );
}

function FindingList({ findings }: { findings: DatabaseFinding[] }) {
  if (findings.length === 0) {
    return (
      <div className="rounded-md border border-s-success/30 bg-s-success/10 px-3 py-2 text-[12px] text-s-secondary">
        No blocking database findings detected.
      </div>
    );
  }

  return (
    <div>
      <SectionLabel>Findings</SectionLabel>
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {findings.map((finding) => (
          <div key={`${finding.id}-${finding.statement ?? ''}`} className="rounded-md border border-s-border bg-s-base p-3">
            <div className="flex items-center gap-2 min-w-0">
              <SeverityBadge level={finding.severity} />
              <span className="truncate text-[12.5px] font-medium text-s-primary">{finding.title}</span>
              {finding.blocksProduction && (
                <span className="ml-auto rounded border border-s-critical/30 bg-s-critical/10 px-1.5 py-0.5 text-[9px] font-mono uppercase text-s-critical">
                  blocks prod
                </span>
              )}
            </div>
            <div className="mt-2 text-[11.5px] leading-relaxed text-s-secondary">{finding.detail}</div>
            {finding.statement && (
              <pre className="mt-2 overflow-x-auto rounded border border-s-border bg-s-subtle px-2 py-1.5 text-[10.5px] text-s-muted">
                {finding.statement}
              </pre>
            )}
            <div className="mt-2 text-[11.5px] leading-relaxed text-s-primary">{finding.recommendation}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PipelineStages({ review }: { review?: DatabaseReviewResult }) {
  const stages = review?.pipelineStages ?? [];
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Agent pipeline" subtitle={review ? `${stages.length} enforced stages` : 'Run a review to generate stages'} />
      {stages.length === 0 ? (
        <EmptyState icon={<Database size={18} />} title="No pipeline yet" description="The database agents generate staged gates after review." />
      ) : (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
          {stages.map((stage) => (
            <div key={stage.order} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded border border-s-border bg-s-subtle font-mono text-[10px] text-s-muted">
                  {stage.order}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-medium text-s-primary">{stage.name}</div>
                  <div className="truncate font-mono text-[10px] text-s-muted">{stage.ownerAgent}</div>
                </div>
                {stage.required && <span className="ml-auto rounded border border-s-warning/30 bg-s-warning/10 px-1.5 py-0.5 text-[9px] font-mono uppercase text-s-warning">required</span>}
              </div>
              <TokenList values={stage.checks} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function PolicyPanel({ policies, isLoading }: { policies: Array<{ id: string; title: string; description: string; severity: DatabaseReviewResult['severity'] }>; isLoading: boolean }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Policy pack" subtitle="Stateful delivery safeguards" action={<ShieldCheck size={14} className="text-s-success" />} />
      <div className="p-4 space-y-2">
        {isLoading && <div className="text-[12px] text-s-muted">Loading policies...</div>}
        {policies.map((policy) => (
          <div key={policy.id} className="rounded-md border border-s-border bg-s-base p-3">
            <div className="flex items-center gap-2">
              <SeverityBadge level={policy.severity} />
              <span className="min-w-0 truncate text-[12.5px] font-medium text-s-primary">{policy.title}</span>
            </div>
            <div className="mt-2 text-[11.5px] leading-relaxed text-s-secondary">{policy.description}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-s-border bg-s-subtle px-3 py-2 text-[12px] text-s-primary">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-s-brand" />
      <span className="min-w-0 truncate">{label}</span>
    </label>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-[10px] font-mono uppercase tracking-wider text-s-muted">{children}</div>;
}

function TokenList({ values }: { values: string[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {values.slice(0, 5).map((value) => (
        <span key={value} className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono text-s-muted">
          {value}
        </span>
      ))}
    </div>
  );
}

function TwoColumnList({ title, values, icon }: { title: string; values: string[]; icon: ReactNode }) {
  const columns = useMemo(() => values.slice(0, 6), [values]);
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {columns.map((value) => (
          <div key={value} className="flex items-start gap-2 rounded-md border border-s-border bg-s-subtle px-3 py-2 text-[11.5px] leading-relaxed text-s-secondary">
            <span className="mt-0.5 shrink-0 text-s-brand">{icon}</span>
            <span>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
