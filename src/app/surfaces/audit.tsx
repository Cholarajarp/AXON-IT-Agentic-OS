import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bot, Clock, Download, Filter, Hash, RefreshCw, Search, ShieldCheck, User } from 'lucide-react';
import { Button, Card, CardHeader, EmptyState, Kpi, PageHeader, SeverityBadge } from '../components/ui/primitives';
import { useAudit, useVerifyAudit, type AuditEntryRecord } from '../lib/queries';

type RiskFilter = 'all' | 'low' | 'medium' | 'high' | 'critical';
type ActorFilter = 'all' | 'human' | 'agent' | 'system';

export function Audit() {
  const auditQuery = useAudit();
  const verifyAudit = useVerifyAudit();
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [actorFilter, setActorFilter] = useState<ActorFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const entries = auditQuery.data ?? [];
  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (riskFilter !== 'all' && entry.riskLevel !== riskFilter) return false;
      if (actorFilter !== 'all' && entry.actorType !== actorFilter) return false;
      if (query.length > 0) {
        const haystack = [
          entry.action,
          entry.actor,
          entry.resource,
          JSON.stringify(entry.details),
          entry.hash,
          entry.previousHash,
        ].join(' ').toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [actorFilter, entries, riskFilter, search]);

  const stats = useMemo(() => {
    const counts = {
      total: entries.length,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
      human: 0,
      agent: 0,
      system: 0,
    };

    for (const entry of entries) {
      counts[entry.riskLevel] += 1;
      counts[entry.actorType] += 1;
    }

    return counts;
  }, [entries]);

  const selectedEntry = useMemo(
    () => filteredEntries.find((entry) => entry.id === selectedId) ?? filteredEntries[0] ?? null,
    [filteredEntries, selectedId],
  );

  useEffect(() => {
    if (auditQuery.isSuccess && !verifyAudit.isPending) {
      verifyAudit.mutate(undefined);
    }
  }, [auditQuery.dataUpdatedAt]);

  useEffect(() => {
    if (!selectedEntry && filteredEntries[0]) {
      setSelectedId(filteredEntries[0].id);
    }
  }, [filteredEntries, selectedEntry]);

  const exportAudit = () => {
    const payload = {
      verification: verifyAudit.data,
      entries: filteredEntries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `axon-audit-${new Date().toISOString().slice(0, 19)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const reverify = async () => {
    await verifyAudit.mutateAsync(undefined);
  };

  if (auditQuery.isLoading) {
    return (
      <div>
        <PageHeader title="Audit Trail" description="Immutable, hash-chained record of policy, workflow, model, and tool events" />
        <Card>
          <EmptyState title="Loading audit trail" description="Reading persisted audit_chain rows." icon={<RefreshCw size={18} className="animate-spin" />} />
        </Card>
      </div>
    );
  }

  if (auditQuery.isError) {
    return (
      <div>
        <PageHeader title="Audit Trail" description="Immutable, hash-chained record of policy, workflow, model, and tool events" />
        <Card>
          <EmptyState
            title="Audit trail unavailable"
            description={auditQuery.error instanceof Error ? auditQuery.error.message : 'The backend /audit endpoint is unreachable.'}
            icon={<AlertTriangle size={18} />}
            action={<Button variant="primary" size="sm" icon={<RefreshCw size={13} />} onClick={() => auditQuery.refetch()}>Retry</Button>}
          />
        </Card>
      </div>
    );
  }

  const integrityLabel = verifyAudit.data?.valid ? 'Valid' : verifyAudit.data ? 'Broken' : 'Checking';
  const integrityTone = verifyAudit.data?.valid ? 'up' : verifyAudit.data ? 'down' : 'flat';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Trail"
        description="A persisted hash chain you can inspect, filter, verify, and export from the UI."
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={13} />} onClick={() => auditQuery.refetch()}>
              Refresh
            </Button>
            <Button variant="secondary" size="sm" icon={<ShieldCheck size={13} />} onClick={reverify} disabled={verifyAudit.isPending}>
              {verifyAudit.isPending ? 'Verifying' : 'Verify chain'}
            </Button>
            <Button variant="primary" size="sm" icon={<Download size={13} />} onClick={exportAudit}>
              Export
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi label="Total Entries" value={String(stats.total)} hint="Persisted audit_chain rows" />
        <Kpi label="Chain Integrity" value={integrityLabel} trend={integrityTone} delta={verifyAudit.data ? `${verifyAudit.data.totalEntries} checked` : 'pending'} hint={verifyAudit.data?.brokenAtSequence ? `Broken at #${verifyAudit.data.brokenAtSequence}` : 'Hash-linked validation'} />
        <Kpi label="High Risk" value={String(stats.high + stats.critical)} trend={stats.high + stats.critical > 0 ? 'down' : 'up'} hint="Policy-sensitive events" />
        <Kpi label="Actors" value={String(stats.human + stats.agent + stats.system)} hint="Human, agent, and system events" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_420px] gap-4">
        <Card className="overflow-hidden">
          <CardHeader
            title="Event timeline"
            subtitle={`${filteredEntries.length} visible events`}
            action={<SeverityBadge level={(verifyAudit.data?.valid ? 'LOW' : 'HIGH') as 'LOW' | 'MEDIUM' | 'HIGH'} />}
          />

          <div className="border-b border-s-border p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <Search size={13} className="text-s-muted shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search actor, action, resource, hash..."
                className="w-full rounded-md border border-s-border bg-s-subtle px-3 py-1.5 text-[12px] text-s-primary outline-none focus:border-s-brand/50"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Filter size={13} className="text-s-muted" />
              <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as RiskFilter)} className="rounded-md border border-s-border bg-s-subtle px-2 py-1.5 text-[11px] text-s-primary">
                <option value="all">All risk</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <select value={actorFilter} onChange={(e) => setActorFilter(e.target.value as ActorFilter)} className="rounded-md border border-s-border bg-s-subtle px-2 py-1.5 text-[11px] text-s-primary">
                <option value="all">All actors</option>
                <option value="human">Human</option>
                <option value="agent">Agent</option>
                <option value="system">System</option>
              </select>
            </div>
          </div>

          <div className="divide-y divide-s-border max-h-[760px] overflow-y-auto">
            {filteredEntries.map((entry) => (
              <AuditRow
                key={entry.id}
                entry={entry}
                active={entry.id === selectedEntry?.id}
                onClick={() => setSelectedId(entry.id)}
              />
            ))}
            {filteredEntries.length === 0 && (
              <EmptyState
                title="No matching audit events"
                description="Clear the filters or search for a different action, hash, or actor."
                icon={<Clock size={18} />}
              />
            )}
          </div>
        </Card>

        <div className="space-y-4 min-w-0">
          <Card>
            <CardHeader
              title="Chain verification"
              subtitle="Verify persisted hashes against the canonical payload"
              action={<span className={`rounded border px-2 py-1 text-[10px] font-mono uppercase ${verifyAudit.data?.valid ? 'border-s-success/30 bg-s-success/10 text-s-success' : verifyAudit.data ? 'border-s-critical/30 bg-s-critical/10 text-s-critical' : 'border-s-border bg-s-subtle text-s-secondary'}`}>{verifyAudit.isPending ? 'checking' : verifyAudit.data?.valid ? 'valid' : verifyAudit.data ? 'broken' : 'idle'}</span>}
            />
            <div className="p-4 space-y-3">
              {verifyAudit.data ? (
                <>
                  <div className={`rounded-md border px-3 py-2 text-[12px] ${verifyAudit.data.valid ? 'border-s-success/30 bg-s-success/10 text-s-success' : 'border-s-critical/30 bg-s-critical/10 text-s-critical'}`}>
                    <div className="font-medium">{verifyAudit.data.valid ? 'Chain intact' : 'Chain broken'}</div>
                    <div className="mt-1 text-[11px] leading-relaxed">
                      {verifyAudit.data.valid
                        ? `${verifyAudit.data.totalEntries} entries verified from genesis to head.`
                        : `Mismatch at sequence ${verifyAudit.data.brokenAtSequence ?? '?'}${verifyAudit.data.brokenEntryId ? ` (${verifyAudit.data.brokenEntryId})` : ''}.`}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <HashStat label="Head hash" value={verifyAudit.data.headHash ?? '—'} />
                    <HashStat label="Tail hash" value={verifyAudit.data.tailHash ?? '—'} />
                  </div>
                </>
              ) : (
                <EmptyState title="Verification pending" description="Run integrity verification to validate the chain." icon={<ShieldCheck size={18} />} />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Ledger summary" subtitle="Quick integrity and distribution stats" />
            <div className="p-4 space-y-2 text-[12px] text-s-secondary">
              <SummaryLine label="Human actions" value={String(stats.human)} />
              <SummaryLine label="Agent actions" value={String(stats.agent)} />
              <SummaryLine label="System actions" value={String(stats.system)} />
              <SummaryLine label="Critical events" value={String(stats.critical)} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Selected entry" subtitle={selectedEntry ? `#${selectedEntry.sequence} ${selectedEntry.action}` : 'Pick a row on the left'} />
            <div className="p-4">
              {selectedEntry ? <AuditDetails entry={selectedEntry} /> : <EmptyState title="No entry selected" description="Click an event to inspect its hash, previous hash, and details." icon={<Hash size={18} />} />}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AuditRow({
  entry,
  active,
  onClick,
}: {
  entry: AuditEntryRecord;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = iconForEntry(entry);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 transition-colors ${active ? 'bg-s-brand/5 border-l-2 border-l-s-brand' : 'hover:bg-s-hover'}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className={`w-7 h-7 rounded-md border flex items-center justify-center shrink-0 ${toneClass(entry.riskLevel)}`}>
          <Icon size={13} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-s-primary truncate">{entry.action}</span>
            <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-s-secondary">#{entry.sequence}</span>
            <span className="rounded border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-s-secondary border-s-border bg-s-surface">{entry.riskLevel}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-s-secondary">
            <span className="flex items-center gap-1"><User size={10} /> {entry.actor}</span>
            <span className="flex items-center gap-1"><Clock size={10} /> {formatRelative(entry.timestamp)}</span>
            <span className="font-mono truncate">{entry.resource}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-mono text-s-muted">
            <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5">{shortHash(entry.hash)}</span>
            <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5">prev {shortHash(entry.previousHash)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function AuditDetails({ entry }: { entry: AuditEntryRecord }) {
  return (
    <div className="space-y-3 text-[11px]">
      <div className="grid grid-cols-2 gap-2">
        <DetailTile label="Actor" value={entry.actor} />
        <DetailTile label="Actor type" value={entry.actorType} />
        <DetailTile label="Resource" value={entry.resource} />
        <DetailTile label="Tenant" value={entry.tenantId} />
      </div>

      <div className="grid grid-cols-1 gap-2">
        <DetailTile label="Hash" value={entry.hash} mono />
        <DetailTile label="Previous hash" value={entry.previousHash} mono />
      </div>

      <div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-s-muted mb-1">Details</div>
        <pre className="rounded-md border border-s-border bg-s-base p-3 text-[11px] font-mono text-s-primary whitespace-pre-wrap break-words max-h-[220px] overflow-auto">
          {JSON.stringify(entry.details, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function DetailTile({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-s-border bg-s-subtle p-2 min-w-0">
      <div className="text-[9px] font-mono uppercase tracking-wider text-s-muted">{label}</div>
      <div className={`mt-1 truncate ${mono ? 'font-mono text-s-primary text-[10px]' : 'text-s-primary'}`}>{value}</div>
    </div>
  );
}

function HashStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-s-border bg-s-subtle p-2 min-w-0">
      <div className="text-[9px] font-mono uppercase tracking-wider text-s-muted">{label}</div>
      <div className="mt-1 font-mono text-[10px] text-s-primary break-all">{shortHash(value, 32)}</div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="font-mono text-s-primary">{value}</span>
    </div>
  );
}

function iconForEntry(entry: AuditEntryRecord) {
  if (entry.riskLevel === 'critical' || entry.riskLevel === 'high') return AlertTriangle;
  if (entry.actorType === 'system') return ShieldCheck;
  if (entry.actorType === 'agent') return Bot;
  return User;
}

function toneClass(riskLevel: AuditEntryRecord['riskLevel']) {
  switch (riskLevel) {
    case 'critical':
      return 'border-s-critical/30 bg-s-critical/10 text-s-critical';
    case 'high':
      return 'border-s-warning/30 bg-s-warning/10 text-s-warning';
    case 'medium':
      return 'border-s-info/30 bg-s-info/10 text-s-info';
    case 'low':
    default:
      return 'border-s-success/30 bg-s-success/10 text-s-success';
  }
}

function shortHash(hash: string, length = 12): string {
  if (!hash) return '—';
  return hash.length <= length ? hash : `${hash.slice(0, length)}…`;
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
