import { useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileCheck2,
  GitBranch,
  Headphones,
  Loader2,
  MessageSquare,
  Network,
  PlayCircle,
  RadioTower,
  ReceiptText,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Target,
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
  useActivateServiceOperationsKernel,
  useAttachServiceDeskEvidence,
  useCreateServiceDeskTicket,
  useServiceDeskTickets,
  useServiceOperationsDashboard,
  useUpdateServiceDeskStatus,
  type ServiceDeskTicket,
  type ServiceLifecycleStageStatus,
  type ServiceOperationsDashboard,
  type ServiceRequestStatus,
} from '../lib/queries';
import { useRouting } from '../lib/useRouting';

function parseList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function ServiceDesk() {
  const tickets = useServiceDeskTickets();
  const dashboard = useServiceOperationsDashboard();
  const createTicket = useCreateServiceDeskTicket();
  const updateStatus = useUpdateServiceDeskStatus();
  const activateKernel = useActivateServiceOperationsKernel();
  const attachEvidence = useAttachServiceDeskEvidence();
  const { setRoute } = useRouting();
  const [requester, setRequester] = useState('');
  const [request, setRequest] = useState('');
  const [system, setSystem] = useState('');
  const [affectedUsers, setAffectedUsers] = useState(0);
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [compliance, setCompliance] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = tickets.data?.tickets ?? [];
  const selected = useMemo(
    () => list.find((ticket) => ticket.id === selectedId) ?? list[0] ?? null,
    [list, selectedId],
  );
  const active = dashboard.data?.activeTickets ?? list.filter((ticket) => !['resolved', 'closed'].includes(ticket.status)).length;
  const p0 = dashboard.data?.p0Tickets ?? list.filter((ticket) => ticket.priority === 'P0').length;

  const create = async () => {
    const ticket = await createTicket.mutateAsync({
      requester,
      request,
      system,
      affectedUsers,
      urgency,
      compliance: parseList(compliance),
    });
    setSelectedId(ticket.id);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Service Operations"
        description="Customer service lifecycle with SLA, CMDB, change, remediation, evidence, cost, and QBR control"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<ShieldCheck size={13} />} onClick={() => setRoute('managedServices')}>
              Managed Services
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={createTicket.isPending ? <Loader2 size={13} className="animate-spin" /> : <Headphones size={13} />}
              onClick={create}
              disabled={createTicket.isPending || request.trim().length < 8}
            >
              {createTicket.isPending ? 'Triaging' : 'Triage request'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Active" value={String(active)} hint={`${list.length} total`} />
        <Kpi label="Kernel Score" value={String(dashboard.data?.averageKernelScore ?? selected?.kernel.score ?? 0)} hint={dashboard.data ? 'portfolio average' : 'selected'} />
        <Kpi label="Evidence" value={`${dashboard.data?.averageEvidenceCoveragePct ?? selected?.kernel.evidencePack.coveragePct ?? 0}%`} hint="coverage" />
        <Kpi label="Risk" value={String(p0)} hint={`$${money(dashboard.data?.serviceCreditExposureUsd ?? selected?.kernel.financial.serviceCreditExposureUsd ?? 0)} credits`} />
      </div>

      <DashboardStrip dashboard={dashboard.data} />

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-4">
        <IntakePanel
          requester={requester}
          request={request}
          system={system}
          urgency={urgency}
          affectedUsers={affectedUsers}
          compliance={compliance}
          isPending={createTicket.isPending}
          onRequester={setRequester}
          onRequest={setRequest}
          onSystem={setSystem}
          onUrgency={setUrgency}
          onAffectedUsers={setAffectedUsers}
          onCompliance={setCompliance}
          onCreate={create}
        />
        <TicketQueue
          tickets={list}
          selectedId={selected?.id}
          isLoading={tickets.isLoading}
          onSelect={(ticket) => setSelectedId(ticket.id)}
          onRefresh={() => {
            tickets.refetch();
            dashboard.refetch();
          }}
        />
      </div>

      <TicketDetail
        ticket={selected}
        onStatus={(id, status) => updateStatus.mutate({ id, status })}
        onActivate={(id) => activateKernel.mutate({ id, operator: 'Operator', mode: 'supervised' })}
        onAttachEvidence={(id, stageId, evidence) => attachEvidence.mutate({ id, stageId, evidence, verifiedBy: 'Operator' })}
        isUpdating={updateStatus.isPending || activateKernel.isPending || attachEvidence.isPending}
      />
    </div>
  );
}

function DashboardStrip({ dashboard }: { dashboard?: ServiceOperationsDashboard }) {
  if (!dashboard) {
    return (
      <Card>
        <div className="p-4 flex items-center gap-2 text-[12px] text-s-secondary">
          <Loader2 size={14} className="animate-spin text-s-brand" />
          Loading service operations dashboard
        </div>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
      <Card className="overflow-hidden">
        <CardHeader title="Portfolio control" subtitle={`${dashboard.cmdbItems} CMDB items, ${dashboard.lifecycleCompletionPct}% lifecycle completion`} action={<Activity size={14} className="text-s-brand" />} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
          <Mini label="Breached" value={String(dashboard.breachedTickets)} />
          <Mini label="Revenue risk" value={`$${money(dashboard.revenueAtRiskUsd)}`} />
          <Mini label="Service credits" value={`$${money(dashboard.serviceCreditExposureUsd)}`} />
          <Mini label="Controls" value={dashboard.controlGaps.length ? `${dashboard.controlGaps.length} gaps` : 'ready'} />
        </div>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader title="Next actions" subtitle={`${dashboard.nextActions.length} operating moves`} action={<Target size={14} className="text-s-brand" />} />
        <div className="p-4 space-y-2">
          {dashboard.nextActions.map((item) => <Line key={item} icon={<CheckCircle2 size={12} className="text-s-success" />}>{item}</Line>)}
        </div>
      </Card>
    </div>
  );
}

function IntakePanel({
  requester,
  request,
  system,
  urgency,
  affectedUsers,
  compliance,
  isPending,
  onRequester,
  onRequest,
  onSystem,
  onUrgency,
  onAffectedUsers,
  onCompliance,
  onCreate,
}: {
  requester: string;
  request: string;
  system: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  affectedUsers: number;
  compliance: string;
  isPending: boolean;
  onRequester: (value: string) => void;
  onRequest: (value: string) => void;
  onSystem: (value: string) => void;
  onUrgency: (value: 'low' | 'medium' | 'high' | 'critical') => void;
  onAffectedUsers: (value: number) => void;
  onCompliance: (value: string) => void;
  onCreate: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Service intake" subtitle="Customer, impact, SLA, and compliance" action={<Headphones size={14} className="text-s-brand" />} />
      <div className="p-4 space-y-4">
        <Field label="Requester" value={requester} onChange={onRequester} placeholder="Requester name or team" />
        <label className="block">
          <span className="label-mono mb-1.5 block">Request</span>
          <textarea
            value={request}
            onChange={(event) => onRequest(event.target.value)}
            rows={6}
            placeholder="Describe affected users, symptoms, urgency, system, requested change, and required proof."
            className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="System" value={system} onChange={onSystem} placeholder="Production API, billing DB, SSO" />
          <label className="block">
            <span className="label-mono mb-1.5 block">Urgency</span>
            <select value={urgency} onChange={(event) => onUrgency(event.target.value as typeof urgency)} className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="label-mono mb-1.5 block">Affected users</span>
            <input
              type="number"
              min={0}
              value={affectedUsers}
              onChange={(event) => onAffectedUsers(Number(event.target.value))}
              className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand"
            />
          </label>
          <Field label="Compliance" value={compliance} onChange={onCompliance} placeholder="SOC 2, PCI DSS, HIPAA" />
        </div>
        <Button
          variant="primary"
          icon={isPending ? <Loader2 size={13} className="animate-spin" /> : <PlayCircle size={13} />}
          onClick={onCreate}
          disabled={isPending || request.trim().length < 8}
          className="w-full justify-center"
        >
          {isPending ? 'Triaging request' : 'Create operations ticket'}
        </Button>
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

function TicketQueue({
  tickets,
  selectedId,
  isLoading,
  onSelect,
  onRefresh,
}: {
  tickets: ServiceDeskTicket[];
  selectedId?: string;
  isLoading: boolean;
  onSelect: (ticket: ServiceDeskTicket) => void;
  onRefresh: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Operations queue"
        subtitle={`${tickets.length} request${tickets.length === 1 ? '' : 's'}`}
        action={<Button size="sm" variant="ghost" icon={<RefreshCw size={12} />} onClick={onRefresh}>Refresh</Button>}
      />
      {isLoading ? (
        <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Loading tickets" />
      ) : tickets.length === 0 ? (
        <EmptyState icon={<ClipboardList size={18} />} title="No service tickets yet" description="Submit a request to generate service operations control." />
      ) : (
        <div className="divide-y divide-s-border max-h-[640px] overflow-y-auto">
          {tickets.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => onSelect(ticket)}
              className={`w-full p-4 text-left ${selectedId === ticket.id ? 'bg-s-brand/5' : 'hover:bg-s-hover'}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <SeverityBadge level={ticket.priority} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{ticket.title}</span>
                <StagePill status={ticket.status} />
              </div>
              <div className="mt-1 text-[12px] leading-relaxed text-s-secondary line-clamp-2">{ticket.request}</div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <QueueMetric label="Score" value={String(ticket.kernel.score)} />
                <QueueMetric label="Evidence" value={`${ticket.kernel.evidencePack.coveragePct}%`} />
                <QueueMetric label="SLA" value={ticket.kernel.slaClock.state} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Token>{ticket.category}</Token>
                <Token>{ticket.kernel.service.criticality}</Token>
                <Token>{ticket.kernel.contract.coverage}</Token>
                {ticket.kernel.evidencePack.trustRecordId && <Token>ledger</Token>}
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function TicketDetail({
  ticket,
  isUpdating,
  onStatus,
  onActivate,
  onAttachEvidence,
}: {
  ticket: ServiceDeskTicket | null;
  isUpdating: boolean;
  onStatus: (id: string, status: ServiceRequestStatus) => void;
  onActivate: (id: string) => void;
  onAttachEvidence: (id: string, stageId: string, evidence: string) => void;
}) {
  const [stageId, setStageId] = useState('verification');
  const [evidence, setEvidence] = useState('');

  if (!ticket) {
    return (
      <Card>
        <EmptyState icon={<Headphones size={18} />} title="No ticket selected" description="Triage a request to generate SLA, CMDB, runbooks, evidence, and QBR controls." />
      </Card>
    );
  }

  const attach = () => {
    if (!evidence.trim()) return;
    onAttachEvidence(ticket.id, stageId, evidence.trim());
    setEvidence('');
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
      <Card className="overflow-hidden">
        <CardHeader
          title={ticket.title}
          subtitle={`${ticket.kernel.customer.name} · ${ticket.kernel.service.name} · ${ticket.kernel.contract.coverage}`}
          action={<SeverityBadge level={ticket.priority} />}
        />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Mini label="Score" value={String(ticket.kernel.score)} />
            <Mini label="Maturity" value={ticket.kernel.maturity} />
            <Mini label="Response due" value={`${ticket.kernel.slaClock.minutesToResponseDue}m`} />
            <Mini label="Resolution due" value={`${Math.ceil(ticket.kernel.slaClock.minutesToResolutionDue / 60)}h`} />
            <Mini label="CMDB" value={String(ticket.kernel.cmdb.length)} />
          </div>

          <div className="rounded-md border border-s-border bg-s-base p-3">
            <div className="flex items-center gap-2">
              <RadioTower size={13} className="text-s-brand" />
              <div className="label-mono">Automation plan</div>
            </div>
            <div className="mt-2 text-[12.5px] leading-relaxed text-s-secondary">{ticket.automationPlan}</div>
          </div>

          <LifecyclePanel ticket={ticket} />
          <KernelPanels ticket={ticket} />

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              icon={isUpdating ? <Loader2 size={12} className="animate-spin" /> : <Rocket size={12} />}
              onClick={() => onActivate(ticket.id)}
              disabled={isUpdating}
            >
              Activate kernel
            </Button>
            {(['approved', 'executing', 'monitoring', 'resolved', 'closed'] as ServiceRequestStatus[]).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={status === 'closed' ? 'success' : 'secondary'}
                icon={isUpdating ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                onClick={() => onStatus(ticket.id, status)}
                disabled={isUpdating}
              >
                {status}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <div className="space-y-4 min-w-0">
        <EvidencePanel
          ticket={ticket}
          stageId={stageId}
          evidence={evidence}
          isUpdating={isUpdating}
          onStageId={setStageId}
          onEvidence={setEvidence}
          onAttach={attach}
        />
        <SidePanel title="Next actions" items={ticket.kernel.nextBestActions} icon={<Target size={14} className="text-s-brand" />} />
        <SidePanel title="Assigned agents" items={ticket.assignedAgents} icon={<Activity size={14} className="text-s-brand" />} />
        <CustomerUpdates ticket={ticket} />
      </div>
    </div>
  );
}

function LifecyclePanel({ ticket }: { ticket: ServiceDeskTicket }) {
  return (
    <div>
      <SectionTitle>Lifecycle command</SectionTitle>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {ticket.kernel.lifecycle.map((stage) => (
          <div key={stage.id} className="rounded-md border border-s-border bg-s-base p-3">
            <div className="flex items-center gap-2 min-w-0">
              <LifecycleIcon status={stage.status} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium text-s-primary">{stage.name}</div>
                <div className="truncate font-mono text-[10px] text-s-muted">{stage.ownerAgent}</div>
              </div>
              <StagePill status={stage.status} />
            </div>
            <div className="mt-2 text-[11.5px] leading-relaxed text-s-secondary">{stage.nextAction}</div>
            <div className="mt-2 flex flex-wrap gap-1">{stage.evidenceRequired.slice(0, 3).map((item) => <Token key={item}>{item}</Token>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KernelPanels({ ticket }: { ticket: ServiceDeskTicket }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-md border border-s-border bg-s-base p-3">
        <div className="flex items-center gap-2">
          <Network size={13} className="text-s-brand" />
          <SectionTitle>CMDB service graph</SectionTitle>
        </div>
        <div className="space-y-2">
          {ticket.kernel.cmdb.map((item) => (
            <div key={item.id} className="rounded border border-s-border bg-s-subtle p-2">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[12px] text-s-primary">{item.name}</span>
                <Token>{item.health}</Token>
              </div>
              <div className="mt-1 text-[11px] text-s-muted">{item.type} · {item.ownerAgent} · RTO {item.rtoMinutes}m</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-s-border bg-s-base p-3">
        <div className="flex items-center gap-2">
          <GitBranch size={13} className="text-s-brand" />
          <SectionTitle>Change and release</SectionTitle>
        </div>
        <Line icon={<ShieldCheck size={12} className="text-s-info" />}>CAB {ticket.kernel.changeControl.cabRequired ? 'required' : 'not required'} · {ticket.kernel.changeControl.policyDecision}</Line>
        <Line icon={<Rocket size={12} className="text-s-info" />}>{ticket.kernel.release.strategy} · {ticket.kernel.release.environments.join(', ')}</Line>
        <Line icon={<AlertTriangle size={12} className="text-s-warning" />}>{ticket.kernel.release.rollbackTrigger}</Line>
        <div className="mt-2 flex flex-wrap gap-1">{ticket.kernel.changeControl.rollbackPlan.map((item) => <Token key={item}>{item}</Token>)}</div>
      </div>

      <div className="rounded-md border border-s-border bg-s-base p-3">
        <div className="flex items-center gap-2">
          <ReceiptText size={13} className="text-s-brand" />
          <SectionTitle>Commercial exposure</SectionTitle>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Mini label="Revenue risk" value={`$${money(ticket.kernel.financial.estimatedRevenueAtRiskUsd)}`} />
          <Mini label="Credits" value={`$${money(ticket.kernel.financial.serviceCreditExposureUsd)}`} />
        </div>
        <div className="mt-2 text-[11.5px] leading-relaxed text-s-secondary">{ticket.kernel.financial.invoiceNote}</div>
      </div>

      <div className="rounded-md border border-s-border bg-s-base p-3">
        <div className="flex items-center gap-2">
          <FileCheck2 size={13} className="text-s-brand" />
          <SectionTitle>Problem and QBR</SectionTitle>
        </div>
        <Line icon={<Clock3 size={12} className="text-s-info" />}>{ticket.kernel.problemManagement.knownError}</Line>
        <Line icon={<MessageSquare size={12} className="text-s-info" />}>{ticket.kernel.qbr.narrative}</Line>
        <div className="mt-2 flex flex-wrap gap-1">{ticket.kernel.qbr.valueMetrics.map((item) => <Token key={item.label}>{item.label}: {item.value}</Token>)}</div>
      </div>
    </div>
  );
}

function EvidencePanel({
  ticket,
  stageId,
  evidence,
  isUpdating,
  onStageId,
  onEvidence,
  onAttach,
}: {
  ticket: ServiceDeskTicket;
  stageId: string;
  evidence: string;
  isUpdating: boolean;
  onStageId: (value: string) => void;
  onEvidence: (value: string) => void;
  onAttach: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Evidence pack" subtitle={`${ticket.kernel.evidencePack.coveragePct}% coverage`} action={<FileCheck2 size={14} className="text-s-brand" />} />
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Mini label="Artifacts" value={String(ticket.linkedArtifacts.length)} />
          <Mini label="Ledger" value={ticket.kernel.evidencePack.trustRecordId ? 'signed' : 'pending'} />
        </div>
        <label className="block">
          <span className="label-mono mb-1.5 block">Stage</span>
          <select value={stageId} onChange={(event) => onStageId(event.target.value)} className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand">
            {ticket.kernel.lifecycle.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label-mono mb-1.5 block">Evidence</span>
          <textarea
            value={evidence}
            onChange={(event) => onEvidence(event.target.value)}
            rows={4}
            placeholder="Attach verification proof, approval, logs, rollback result, customer update, or QBR note."
            className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[12.5px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
          />
        </label>
        <Button variant="primary" size="sm" icon={isUpdating ? <Loader2 size={12} className="animate-spin" /> : <FileCheck2 size={12} />} onClick={onAttach} disabled={isUpdating || evidence.trim().length < 3} className="w-full justify-center">
          Attach evidence
        </Button>
        {ticket.kernel.evidencePack.missing.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {ticket.kernel.evidencePack.missing.slice(0, 6).map((item) => <Token key={item}>{item}</Token>)}
          </div>
        )}
      </div>
    </Card>
  );
}

function CustomerUpdates({ ticket }: { ticket: ServiceDeskTicket }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Customer updates" subtitle={`${ticket.customerUpdates.length} messages`} action={<MessageSquare size={14} className="text-s-brand" />} />
      <div className="p-4 space-y-2">
        {ticket.customerUpdates.map((update) => (
          <div key={update.audience} className="rounded-md border border-s-border bg-s-base p-3">
            <div className="label-mono mb-1">{update.audience}</div>
            <div className="text-[12px] leading-relaxed text-s-secondary">{update.message}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-s-border bg-s-base p-3 min-w-0">
      <div className="label-mono mb-1 truncate">{label}</div>
      <div className="truncate font-mono text-[15px] text-s-primary">{value}</div>
    </div>
  );
}

function QueueMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-s-border bg-s-subtle px-2 py-1 min-w-0">
      <div className="label-mono truncate text-[9px]">{label}</div>
      <div className="truncate font-mono text-[11px] text-s-primary">{value}</div>
    </div>
  );
}

function SidePanel({ title, items, icon }: { title: string; items: string[]; icon?: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title={title} subtitle={`${items.length} item${items.length === 1 ? '' : 's'}`} action={icon} />
      <div className="p-4 flex flex-wrap gap-1.5">
        {items.map((item) => <Token key={item}>{item}</Token>)}
      </div>
    </Card>
  );
}

function LifecycleIcon({ status }: { status: ServiceLifecycleStageStatus }) {
  if (status === 'completed') return <CheckCircle2 size={14} className="text-s-success shrink-0" />;
  if (status === 'blocked' || status === 'breached') return <AlertTriangle size={14} className="text-s-warning shrink-0" />;
  if (status === 'active') return <Activity size={14} className="text-s-brand shrink-0" />;
  return <Clock3 size={14} className="text-s-muted shrink-0" />;
}

function StagePill({ status }: { status: string }) {
  const tone = status === 'completed' || status === 'closed' || status === 'resolved'
    ? 'border-s-success/30 bg-s-success/10 text-s-success'
    : status === 'blocked' || status === 'breached'
      ? 'border-s-warning/30 bg-s-warning/10 text-s-warning'
      : status === 'active' || status === 'executing' || status === 'monitoring'
        ? 'border-s-brand/30 bg-s-brand/10 text-s-brand'
        : 'border-s-border bg-s-subtle text-s-muted';
  return <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase ${tone}`}>{status}</span>;
}

function Token({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[10px] font-mono text-s-muted">
      {children}
    </span>
  );
}

function Line({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[12px] leading-relaxed text-s-secondary">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="mb-2 label-mono">{children}</div>;
}

function money(value: number) {
  return Math.round(value).toLocaleString();
}
