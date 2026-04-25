import { useState, type ReactNode } from 'react';
import {
  BadgeDollarSign,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  Send,
  Sparkles,
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
  useCreateCustomerDeliveryAccount,
  useCustomerDeliveryAccounts,
  useGenerateCustomerDeliveryReport,
  type CustomerAccount,
  type CustomerProject,
  type DeliveryPricingModel,
} from '../lib/queries';
import { useRouting } from '../lib/useRouting';

function parseList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function money(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${value}`;
}

export function CustomerDelivery() {
  const accounts = useCustomerDeliveryAccounts();
  const createAccount = useCreateCustomerDeliveryAccount();
  const generateReport = useGenerateCustomerDeliveryReport();
  const { setRoute } = useRouting();

  const [customerName, setCustomerName] = useState('');
  const [industry, setIndustry] = useState('');
  const [projectName, setProjectName] = useState('');
  const [request, setRequest] = useState('');
  const [pricingModel, setPricingModel] = useState<DeliveryPricingModel>('enterprise-managed-service');
  const [budgetUsd, setBudgetUsd] = useState(900000);
  const [timelineDays, setTimelineDays] = useState(90);
  const [supportPlan, setSupportPlan] = useState<CustomerAccount['supportPlan']>('enterprise');
  const [compliance, setCompliance] = useState('');
  const [integrations, setIntegrations] = useState('');
  const [selected, setSelected] = useState<CustomerAccount | null>(null);

  const list = accounts.data?.accounts ?? [];
  const current = selected ?? list[0] ?? null;
  const project = current?.projects[0] ?? null;
  const milestonesDone = project?.milestones.filter((item) => item.status === 'complete').length ?? 0;
  const backlogValue = project?.feedbackBacklog.reduce((sum, item) => sum + item.revenueImpactUsd, 0) ?? 0;

  const create = async () => {
    const account = await createAccount.mutateAsync({
      customerName,
      industry,
      projectName,
      request,
      pricingModel,
      budgetUsd,
      timelineDays,
      supportPlan,
      compliance: parseList(compliance),
      integrations: parseList(integrations),
    });
    setSelected(account);
  };

  const generate = async () => {
    if (!current || !project) return;
    const report = await generateReport.mutateAsync({ accountId: current.id, projectId: project.id });
    setSelected((previous) => {
      if (!previous || previous.id !== current.id) return previous;
      return {
        ...previous,
        projects: previous.projects.map((item) =>
          item.id === project.id ? { ...item, status: 'delivered', deliveryReport: report } : item,
        ),
      };
    });
    await accounts.refetch();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customer Delivery"
        description="Commercial IT delivery: customer accounts, SOW, milestones, SLA, margin, reports, feedback, and renewal signals"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Building2 size={13} />} onClick={() => setRoute('managedServices')}>
              Managed Services
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={createAccount.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              onClick={create}
              disabled={createAccount.isPending || request.trim().length < 12}
            >
              {createAccount.isPending ? 'Packaging' : 'Create delivery'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="ACV" value={current ? money(current.commercialSummary.annualContractValueUsd) : '$0'} hint="Annualized customer value" />
        <Kpi label="Margin" value={current ? `${current.commercialSummary.projectedGrossMarginPercent}%` : '0%'} hint={current?.health ?? 'No account'} />
        <Kpi label="Milestones" value={project ? `${milestonesDone}/${project.milestones.length}` : '0/0'} hint="Delivery progress" />
        <Kpi label="Backlog Value" value={money(backlogValue)} hint="Feedback revenue impact" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="New customer delivery" subtitle="Turn a request into a commercial delivery package" action={<ClipboardList size={14} className="text-s-brand" />} />
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Customer" value={customerName} onChange={setCustomerName} placeholder="Customer legal name" />
              <Field label="Industry" value={industry} onChange={setIndustry} placeholder="Financial services, SaaS, healthcare" />
            </div>
            <Field label="Project" value={projectName} onChange={setProjectName} placeholder="Production portal, service desk, data migration" />
            <label className="block">
              <span className="label-mono mb-1.5 block">Request</span>
              <textarea
                value={request}
                onChange={(event) => setRequest(event.target.value)}
                rows={6}
                placeholder="Describe the actual customer outcome, systems, acceptance criteria, SLA, timeline, and constraints."
                className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField
                label="Pricing"
                value={pricingModel}
                onChange={(value) => setPricingModel(value as DeliveryPricingModel)}
                options={[
                  ['enterprise-managed-service', 'Enterprise managed'],
                  ['fixed-scope', 'Fixed scope'],
                  ['subscription', 'Subscription'],
                  ['usage-based', 'Usage based'],
                ]}
              />
              <SelectField
                label="Support"
                value={supportPlan}
                onChange={(value) => setSupportPlan(value as CustomerAccount['supportPlan'])}
                options={[
                  ['enterprise', 'Enterprise'],
                  ['business', 'Business'],
                  ['starter', 'Starter'],
                ]}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberField label="Budget USD" value={budgetUsd} onChange={setBudgetUsd} />
              <NumberField label="Timeline days" value={timelineDays} onChange={setTimelineDays} />
            </div>
            <Field label="Compliance" value={compliance} onChange={setCompliance} placeholder="SOC 2, PCI DSS, HIPAA" />
            <Field label="Integrations" value={integrations} onChange={setIntegrations} placeholder="ServiceNow, GitHub, PostgreSQL" />
            <Button
              variant="primary"
              icon={createAccount.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              onClick={create}
              disabled={createAccount.isPending || request.trim().length < 12}
              className="w-full justify-center"
            >
              {createAccount.isPending ? 'Creating package' : 'Create customer delivery package'}
            </Button>
          </div>
        </Card>

        <DeliveryDetail
          account={current}
          project={project}
          onGenerateReport={generate}
          generating={generateReport.isPending}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <MilestonesPanel project={project} />
        <ReportPanel project={project} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <FeedbackPanel project={project} />
        <RenewalPanel account={current} />
      </div>
    </div>
  );
}

function DeliveryDetail({
  account,
  project,
  onGenerateReport,
  generating,
}: {
  account: CustomerAccount | null;
  project: CustomerProject | null;
  onGenerateReport: () => void;
  generating: boolean;
}) {
  if (!account || !project) {
    return (
      <Card>
        <CardHeader title="Delivery package" subtitle="No package selected" />
        <EmptyState icon={<FileCheck2 size={18} />} title="Create a customer package" description="AXON will generate the SOW, commercial model, SLA, milestones, report, and feedback backlog." />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={account.customerName}
        subtitle={`${account.industry} • ${project.status} • ${project.pricingModel}`}
        action={
          <Button
            size="sm"
            variant="secondary"
            icon={generating ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            onClick={onGenerateReport}
            disabled={generating}
          >
            Report
          </Button>
        }
      />
      <div className="p-4 space-y-4">
        <div className="rounded-md border border-s-border bg-s-base p-4">
          <div className="flex items-center gap-2 text-[13px] font-medium text-s-primary">
            <Target size={14} className="text-s-brand" />
            {project.name}
          </div>
          <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">
            {project.statementOfWork.objective}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Mini label="Revenue" value={money(project.marginModel.revenueUsd)} />
          <Mini label="Gross margin" value={`${project.marginModel.grossMarginPercent}%`} />
          <Mini label="SLA" value={`${project.sla.responseMinutes}m / ${project.sla.resolutionHours}h`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ListBlock title="Scope" items={project.statementOfWork.scope} icon={<CheckCircle2 size={13} className="text-s-success" />} />
          <ListBlock title="Acceptance" items={project.statementOfWork.acceptanceCriteria} icon={<FileCheck2 size={13} className="text-s-info" />} />
        </div>
      </div>
    </Card>
  );
}

function MilestonesPanel({ project }: { project: CustomerProject | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Milestones" subtitle="SOW to delivery execution" />
      <div className="divide-y divide-s-border">
        {(project?.milestones ?? []).map((milestone) => (
          <div key={milestone.id} className="p-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-s-border bg-s-subtle font-mono text-[10px] text-s-primary">
                D{milestone.dueDay}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{milestone.name}</span>
              <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono uppercase text-s-muted">
                {milestone.status}
              </span>
            </div>
            <div className="mt-2 text-[12px] text-s-secondary">{milestone.ownerAgent}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {milestone.deliverables.map((item) => (
                <span key={item} className="rounded border border-s-border bg-s-base px-1.5 py-0.5 text-[9px] font-mono text-s-muted">
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
        {!project && <EmptyState icon={<ClipboardList size={18} />} title="No milestones yet" />}
      </div>
    </Card>
  );
}

function ReportPanel({ project }: { project: CustomerProject | null }) {
  const report = project?.deliveryReport;
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Delivery report" subtitle={report?.status ?? 'Draft package'} />
      {!report ? (
        <EmptyState icon={<FileCheck2 size={18} />} title="No report yet" />
      ) : (
        <div className="p-4 space-y-4">
          <div className="rounded-md border border-s-border bg-s-base p-3 text-[12px] leading-relaxed text-s-secondary">
            {report.executiveSummary}
          </div>
          <ListBlock title="Completed work" items={report.completedWork} icon={<CheckCircle2 size={13} className="text-s-success" />} />
          <ListBlock title="Verification evidence" items={report.verificationEvidence} icon={<FileCheck2 size={13} className="text-s-info" />} />
          <div className="space-y-2">
            <div className="label-mono">Risks</div>
            {report.riskRegister.map((risk) => (
              <div key={risk.risk} className="rounded-md border border-s-border bg-s-base p-3">
                <div className="flex items-center gap-2">
                  <SeverityBadge level={risk.level.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-s-primary">{risk.risk}</span>
                </div>
                <div className="mt-2 text-[12px] text-s-secondary">{risk.mitigation}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function FeedbackPanel({ project }: { project: CustomerProject | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Feedback backlog" subtitle="Customer success to next release" />
      <div className="divide-y divide-s-border">
        {(project?.feedbackBacklog ?? []).map((item) => (
          <div key={item.id} className="p-4">
            <div className="flex items-center gap-2 min-w-0">
              <SeverityBadge level={item.priority} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{item.title}</span>
              <span className="shrink-0 font-mono text-[11px] text-s-success">{money(item.revenueImpactUsd)}</span>
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{item.description}</div>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-s-muted">
              <MessageSquarePlus size={12} />
              {item.source} • {item.ownerAgent}
            </div>
          </div>
        ))}
        {!project && <EmptyState icon={<MessageSquarePlus size={18} />} title="No feedback backlog yet" />}
      </div>
    </Card>
  );
}

function RenewalPanel({ account }: { account: CustomerAccount | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Renewal signals" subtitle="Retention, upsell, and margin controls" />
      <div className="divide-y divide-s-border">
        {(account?.renewalSignals ?? []).map((signal) => (
          <div key={signal.signal} className="p-4">
            <div className="flex items-center gap-2 min-w-0">
              <BadgeDollarSign size={14} className={signal.level === 'positive' ? 'text-s-success' : signal.level === 'watch' ? 'text-s-warning' : 'text-s-critical'} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{signal.signal}</span>
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{signal.action}</div>
          </div>
        ))}
        {!account && <EmptyState icon={<RefreshCw size={18} />} title="No renewal signals yet" />}
      </div>
    </Card>
  );
}

function ListBlock({ title, items, icon }: { title: string; items: string[]; icon: ReactNode }) {
  return (
    <div className="rounded-md border border-s-border bg-s-base p-3">
      <div className="label-mono mb-2">{title}</div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2 text-[12px] leading-relaxed text-s-secondary">
            <span className="mt-0.5 shrink-0">{icon}</span>
            <span>{item}</span>
          </div>
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
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
      />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 block">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 block">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand"
      >
        {options.map(([id, labelText]) => (
          <option key={id} value={id}>{labelText}</option>
        ))}
      </select>
    </label>
  );
}
