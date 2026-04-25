import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  Hash,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button, Card, CardHeader, EmptyState, Kpi, PageHeader, SeverityBadge } from '../components/ui/primitives';
import {
  useCreateTrustRecord,
  useEvaluateTrustPolicy,
  useExportTrustLedger,
  useTrustLedgerRecords,
  useVerifyTrustLedger,
  type TrustRecord,
  type TrustRecordKind,
  type TrustRisk,
} from '../lib/queries';

const kindOptions: TrustRecordKind[] = ['release-manifest', 'policy-decision', 'command-evidence', 'browser-artifact', 'security-scan', 'database-review', 'deployment', 'customer-handoff', 'market-signal'];
const riskOptions: TrustRisk[] = ['low', 'medium', 'high', 'critical'];

export function TrustLedger() {
  const recordsQuery = useTrustLedgerRecords();
  const createRecord = useCreateTrustRecord();
  const policy = useEvaluateTrustPolicy();
  const verify = useVerifyTrustLedger();
  const exportLedger = useExportTrustLedger();
  const [kind, setKind] = useState<TrustRecordKind>('release-manifest');
  const [risk, setRisk] = useState<TrustRisk>('medium');
  const [subject, setSubject] = useState('');
  const [summary, setSummary] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const records = recordsQuery.data?.records ?? [];
  const selected = records.find((record) => record.id === selectedId) ?? records[0] ?? null;
  const stats = useMemo(() => {
    const counts = { total: records.length, critical: 0, high: 0, signed: 0 };
    for (const record of records) {
      if (record.risk === 'critical') counts.critical += 1;
      if (record.risk === 'high') counts.high += 1;
      if (record.signature) counts.signed += 1;
    }
    return counts;
  }, [records]);

  useEffect(() => {
    if (recordsQuery.isSuccess && !verify.isPending) verify.mutate(undefined);
  }, [recordsQuery.dataUpdatedAt]);

  const append = async () => {
    await createRecord.mutateAsync({
      kind,
      risk,
      actor: 'Operator',
      actorType: 'human',
      subject,
      summary,
      source: 'Trust Ledger UI',
      artifacts: ['manual evidence note'],
      metadata: { createdFrom: 'trust-ledger-surface' },
    });
  };

  const decide = async () => {
    await policy.mutateAsync({
      actor: 'ReleaseAgent',
      action: 'deploy production',
      resource: subject,
      environment: 'production',
      dataClass: risk === 'critical' ? 'restricted' : 'confidential',
      risk,
      requestedScopes: ['deploy:write', 'release:approve'],
      hasApproval: false,
    });
  };

  const exportPack = async () => {
    const pack = await exportLedger.mutateAsync({ format: 'release-pack' });
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `axon-trust-ledger-${new Date().toISOString().slice(0, 19)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trust Ledger"
        description="Tamper-evident evidence, policy decisions, signatures, controls, and release export packs"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<ShieldCheck size={13} />} onClick={() => verify.mutate(undefined)} disabled={verify.isPending}>
              {verify.isPending ? 'Verifying' : 'Verify'}
            </Button>
            <Button variant="primary" size="sm" icon={<Download size={13} />} onClick={exportPack} disabled={exportLedger.isPending}>
              Export
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Records" value={String(stats.total)} hint="Signed evidence entries" />
        <Kpi label="Integrity" value={verify.data ? (verify.data.valid ? 'Valid' : 'Broken') : 'Checking'} hint={verify.data ? `${verify.data.totalRecords} checked` : 'Hash chain'} trend={verify.data?.valid ? 'up' : verify.data ? 'down' : 'flat'} />
        <Kpi label="High Risk" value={String(stats.high + stats.critical)} hint="Needs careful review" />
        <Kpi label="Signed" value={String(stats.signed)} hint="HMAC-backed local signatures" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="Create trust evidence" subtitle="Manual evidence or policy decision" action={<Hash size={14} className="text-s-brand" />} />
          <div className="p-4 space-y-4">
            <label className="block">
              <span className="label-mono mb-1.5 block">Kind</span>
              <select value={kind} onChange={(event) => setKind(event.target.value as TrustRecordKind)} className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand">
                {kindOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label-mono mb-1.5 block">Risk</span>
              <select value={risk} onChange={(event) => setRisk(event.target.value as TrustRisk)} className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand">
                {riskOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <Field label="Subject" value={subject} onChange={setSubject} placeholder="Release, deployment, policy decision, customer handoff" />
            <label className="block">
              <span className="label-mono mb-1.5 block">Summary</span>
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                rows={5}
                placeholder="Write the actual evidence summary and why it proves the decision."
                className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button variant="secondary" icon={policy.isPending ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} onClick={decide} disabled={policy.isPending || subject.trim().length < 3} className="justify-center">
                Policy decide
              </Button>
              <Button variant="primary" icon={createRecord.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} onClick={append} disabled={createRecord.isPending || subject.trim().length < 3 || summary.trim().length < 8} className="justify-center">
                Append record
              </Button>
            </div>
          </div>
        </Card>

        <RecordsPanel records={records} selectedId={selected?.id} isLoading={recordsQuery.isLoading} onSelect={setSelectedId} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
        <SelectedRecord record={selected} />
        <ControlPanel exportPack={exportLedger.data} verification={verify.data} />
      </div>
    </div>
  );
}

function RecordsPanel({ records, selectedId, isLoading, onSelect }: { records: TrustRecord[]; selectedId?: string; isLoading: boolean; onSelect: (id: string) => void }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Evidence chain" subtitle={`${records.length} record${records.length === 1 ? '' : 's'}`} />
      {isLoading ? (
        <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Loading trust records" />
      ) : records.length === 0 ? (
        <EmptyState icon={<FileCheck2 size={18} />} title="No trust records yet" description="Mission Control and manual policy decisions will append signed records here." />
      ) : (
        <div className="divide-y divide-s-border max-h-[620px] overflow-y-auto">
          {records.map((record) => (
            <button key={record.id} onClick={() => onSelect(record.id)} className={`w-full p-4 text-left ${record.id === selectedId ? 'bg-s-brand/5' : 'hover:bg-s-hover'}`}>
              <div className="flex items-center gap-2 min-w-0">
                {record.risk === 'critical' || record.risk === 'high' ? <AlertTriangle size={14} className="text-s-warning" /> : <CheckCircle2 size={14} className="text-s-success" />}
                <SeverityBadge level={record.risk.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{record.subject}</span>
                <span className="font-mono text-[10px] text-s-muted">#{record.sequence}</span>
              </div>
              <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{record.summary}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Token>{record.kind}</Token>
                <Token>{record.actor}</Token>
                <Token>{shortHash(record.hash)}</Token>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function SelectedRecord({ record }: { record: TrustRecord | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Record detail" subtitle={record ? `${record.kind} by ${record.actor}` : 'Select a record'} />
      {!record ? (
        <EmptyState icon={<Hash size={18} />} title="No record selected" />
      ) : (
        <div className="p-4 space-y-4">
          <div className="rounded-md border border-s-border bg-s-base p-4 text-[12px] leading-relaxed text-s-secondary">{record.summary}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Tile label="Hash" value={record.hash} />
            <Tile label="Signature" value={record.signature} />
            <Tile label="Previous" value={record.previousHash} />
            <Tile label="Source" value={record.source} />
          </div>
          <MiniList title="Artifacts" items={record.artifacts} icon={<FileCheck2 size={12} className="text-s-success" />} />
          <MiniList title="Controls" items={record.controls} icon={<ShieldCheck size={12} className="text-s-info" />} />
          <pre className="max-h-64 overflow-auto rounded-md border border-s-border bg-s-subtle p-3 text-[10px] text-s-muted">{JSON.stringify(record.metadata, null, 2)}</pre>
        </div>
      )}
    </Card>
  );
}

function ControlPanel({ exportPack, verification }: { exportPack?: { controls: Array<{ controlId: string; title: string; status: string; recordIds: string[] }> }; verification?: { valid: boolean; totalRecords: number; headHash?: string } }) {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader title="Verification" action={<ShieldCheck size={14} className={verification?.valid ? 'text-s-success' : 'text-s-warning'} />} />
        <div className="p-4 space-y-2 text-[12px] text-s-secondary">
          <Line icon={verification?.valid ? <CheckCircle2 size={12} className="text-s-success" /> : <AlertTriangle size={12} className="text-s-warning" />}>{verification ? `${verification.totalRecords} records checked` : 'Verification not run yet'}</Line>
          <Line icon={<Hash size={12} className="text-s-info" />}>{verification?.headHash ? shortHash(verification.headHash, 32) : 'No head hash yet'}</Line>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader title="Control export" subtitle={exportPack ? `${exportPack.controls.length} controls` : 'Export to populate'} action={<Download size={14} className="text-s-brand" />} />
        <div className="divide-y divide-s-border">
          {(exportPack?.controls ?? []).map((control) => (
            <div key={control.controlId} className="p-4">
              <div className="flex items-center gap-2">
                <Token>{control.controlId}</Token>
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-s-primary">{control.title}</span>
                <Token>{control.status}</Token>
              </div>
              <div className="mt-2 text-[11px] text-s-muted">{control.recordIds.length} record(s)</div>
            </div>
          ))}
          {!exportPack && <EmptyState icon={<Download size={18} />} title="No export pack yet" description="Use Export to generate a release control package." />}
        </div>
      </Card>
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

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-s-border bg-s-subtle p-3 min-w-0">
      <div className="label-mono mb-1">{label}</div>
      <div className="font-mono text-[10px] text-s-primary break-all">{value}</div>
    </div>
  );
}

function MiniList({ title, items, icon }: { title: string; items: string[]; icon: ReactNode }) {
  return (
    <div className="rounded-md border border-s-border bg-s-base p-3">
      <div className="label-mono mb-2">{title}</div>
      <div className="space-y-1.5">{items.length ? items.map((item) => <Line key={item} icon={icon}>{item}</Line>) : <Line icon={<Sparkles size={12} className="text-s-muted" />}>No items attached.</Line>}</div>
    </div>
  );
}

function Line({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <div className="flex items-start gap-2 text-[12px] leading-relaxed text-s-secondary"><span className="mt-0.5 shrink-0">{icon}</span><span>{children}</span></div>;
}

function Token({ children }: { children: ReactNode }) {
  return <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[10px] font-mono text-s-muted">{children}</span>;
}

function shortHash(hash: string, length = 12) {
  return hash.length <= length ? hash : `${hash.slice(0, length)}...`;
}
