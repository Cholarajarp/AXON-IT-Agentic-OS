import { useState, type ReactNode } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Headphones,
  Loader2,
  MessageSquare,
  PlayCircle,
  RefreshCw,
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
  useCreateServiceDeskTicket,
  useServiceDeskTickets,
  useUpdateServiceDeskStatus,
  type ServiceDeskTicket,
  type ServiceRequestStatus,
} from '../lib/queries';
import { useRouting } from '../lib/useRouting';

function parseList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function ServiceDesk() {
  const tickets = useServiceDeskTickets();
  const createTicket = useCreateServiceDeskTicket();
  const updateStatus = useUpdateServiceDeskStatus();
  const { setRoute } = useRouting();
  const [requester, setRequester] = useState('');
  const [request, setRequest] = useState('');
  const [system, setSystem] = useState('');
  const [affectedUsers, setAffectedUsers] = useState(0);
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [compliance, setCompliance] = useState('');
  const [selected, setSelected] = useState<ServiceDeskTicket | null>(null);

  const list = tickets.data?.tickets ?? [];
  const active = list.filter((ticket) => ticket.status !== 'resolved').length;
  const p0 = list.filter((ticket) => ticket.priority === 'P0').length;
  const approvalCount = list.filter((ticket) => ticket.approvalRequired).length;

  const create = async () => {
    const ticket = await createTicket.mutateAsync({
      requester,
      request,
      system,
      affectedUsers,
      urgency,
      compliance: parseList(compliance),
    });
    setSelected(ticket);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Service Desk"
        description="Real IT intake, SLA triage, approvals, runbooks, and customer updates"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<ShieldCheck size={13} />} onClick={() => setRoute('enterprise')}>
              Enterprise OS
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
        <Kpi label="Tickets" value={String(list.length)} hint={`${active} active`} />
        <Kpi label="P0" value={String(p0)} hint="Executive escalation" />
        <Kpi label="Approvals" value={String(approvalCount)} hint="Human gates" />
        <Kpi label="Agents" value={String(new Set(list.flatMap((ticket) => ticket.assignedAgents)).size)} hint="Active IT roles" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="New request" subtitle="Submit anything IT would normally handle" action={<Headphones size={14} className="text-s-brand" />} />
          <div className="p-4 space-y-4">
            <Field label="Requester" value={requester} onChange={setRequester} placeholder="Requester name or team" />
            <label className="block">
              <span className="label-mono mb-1.5 block">Request</span>
              <textarea
                value={request}
                onChange={(event) => setRequest(event.target.value)}
                rows={6}
                placeholder="Describe the incident, request, affected users, urgency, observed symptoms, and required evidence."
                className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="System" value={system} onChange={setSystem} placeholder="Production API, billing DB, mobile app" />
              <label className="block">
                <span className="label-mono mb-1.5 block">Urgency</span>
                <select value={urgency} onChange={(event) => setUrgency(event.target.value as typeof urgency)} className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand">
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
                  onChange={(event) => setAffectedUsers(Number(event.target.value))}
                  className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand"
                />
              </label>
              <Field label="Compliance" value={compliance} onChange={setCompliance} placeholder="SOC 2, PCI DSS, HIPAA" />
            </div>
            <Button
              variant="primary"
              icon={createTicket.isPending ? <Loader2 size={13} className="animate-spin" /> : <PlayCircle size={13} />}
              onClick={create}
              disabled={createTicket.isPending || request.trim().length < 8}
              className="w-full justify-center"
            >
              {createTicket.isPending ? 'Triaging request' : 'Triage like real IT'}
            </Button>
          </div>
        </Card>

        <TicketQueue
          tickets={list}
          selectedId={selected?.id}
          isLoading={tickets.isLoading}
          onSelect={setSelected}
          onRefresh={() => tickets.refetch()}
        />
      </div>

      <TicketDetail
        ticket={selected ?? list[0] ?? null}
        onStatus={(id, status) => updateStatus.mutate({ id, status })}
        isUpdating={updateStatus.isPending}
      />
    </div>
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
        title="Ticket queue"
        subtitle={`${tickets.length} request${tickets.length === 1 ? '' : 's'}`}
        action={<Button size="sm" variant="ghost" icon={<RefreshCw size={12} />} onClick={onRefresh}>Refresh</Button>}
      />
      {isLoading ? (
        <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Loading tickets" />
      ) : tickets.length === 0 ? (
        <EmptyState icon={<ClipboardList size={18} />} title="No service tickets yet" description="Submit a request to see autonomous IT triage." />
      ) : (
        <div className="divide-y divide-s-border max-h-[620px] overflow-y-auto">
          {tickets.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => onSelect(ticket)}
              className={`w-full p-4 text-left ${selectedId === ticket.id ? 'bg-s-brand/5' : 'hover:bg-s-hover'}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <SeverityBadge level={ticket.priority} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{ticket.title}</span>
                <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono uppercase text-s-muted">
                  {ticket.status}
                </span>
              </div>
              <div className="mt-1 text-[12px] leading-relaxed text-s-secondary line-clamp-2">{ticket.request}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Token>{ticket.category}</Token>
                <Token>{ticket.system}</Token>
                <Token>{ticket.affectedUsers} users</Token>
                {ticket.approvalRequired && <Token>approval</Token>}
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function TicketDetail({ ticket, isUpdating, onStatus }: { ticket: ServiceDeskTicket | null; isUpdating: boolean; onStatus: (id: string, status: ServiceRequestStatus) => void }) {
  if (!ticket) {
    return (
      <Card>
        <EmptyState icon={<Headphones size={18} />} title="No ticket selected" description="Triage a request to generate SLA, runbook, agents, approvals, and evidence." />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
      <Card className="overflow-hidden">
        <CardHeader
          title={ticket.title}
          subtitle={`${ticket.category} · ${ticket.system} · ${ticket.requester}`}
          action={<SeverityBadge level={ticket.priority} />}
        />
        <div className="p-4 space-y-4">
          <div className="rounded-md border border-s-border bg-s-base p-3">
            <div className="label-mono mb-2">Automation plan</div>
            <div className="text-[12.5px] leading-relaxed text-s-secondary">{ticket.automationPlan}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Mini label="Response SLA" value={`${ticket.sla.responseMinutes}m`} />
            <Mini label="Resolution SLA" value={`${ticket.sla.resolutionHours}h`} />
            <Mini label="Agents" value={String(ticket.assignedAgents.length)} />
          </div>

          <div>
            <SectionTitle>Runbook</SectionTitle>
            <div className="space-y-2">
              {ticket.runbook.map((step) => (
                <div key={step.step} className="rounded-md border border-s-border bg-s-base p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded border border-s-brand/30 bg-s-brand/10 font-mono text-[10px] text-s-brand">{step.step}</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-s-muted">{step.ownerAgent}</span>
                  </div>
                  <div className="mt-2 text-[12.5px] leading-relaxed text-s-primary">{step.action}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{step.evidence.map((item) => <Token key={item}>{item}</Token>)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(['approved', 'executing', 'resolved'] as ServiceRequestStatus[]).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={status === 'resolved' ? 'success' : 'secondary'}
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
        <SidePanel title="Assigned agents" items={ticket.assignedAgents} />
        <SidePanel title="Evidence required" items={ticket.evidenceRequired} />
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
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-s-border bg-s-base p-3">
      <div className="label-mono mb-1">{label}</div>
      <div className="font-mono text-[18px] text-s-primary">{value}</div>
    </div>
  );
}

function SidePanel({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title={title} subtitle={`${items.length} item${items.length === 1 ? '' : 's'}`} />
      <div className="p-4 flex flex-wrap gap-1.5">
        {items.map((item) => <Token key={item}>{item}</Token>)}
      </div>
    </Card>
  );
}

function Token({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[10px] font-mono text-s-muted">
      {children}
    </span>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="mb-2 label-mono">{children}</div>;
}
