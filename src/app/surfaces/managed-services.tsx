import { useState, type ReactNode } from 'react';
import {
  Bot,
  Building2,
  CheckCircle2,
  ClipboardList,
  CloudCog,
  Coins,
  Database,
  Loader2,
  Network,
  RefreshCw,
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
} from '../components/ui/primitives';
import {
  useCreateManagedServiceAccount,
  useManagedServiceAccounts,
  type ManagedServiceAccount,
  type ManagedServiceCoverage,
  type ManagedServiceTower,
} from '../lib/queries';
import { useRouting } from '../lib/useRouting';

function parseList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function ManagedServices() {
  const accounts = useManagedServiceAccounts();
  const createAccount = useCreateManagedServiceAccount();
  const { setRoute } = useRouting();
  const [customerName, setCustomerName] = useState('');
  const [industry, setIndustry] = useState('');
  const [objective, setObjective] = useState('');
  const [appCount, setAppCount] = useState(45);
  const [users, setUsers] = useState(18000);
  const [cloudProviders, setCloudProviders] = useState('');
  const [compliance, setCompliance] = useState('');
  const [coverage, setCoverage] = useState<ManagedServiceCoverage>('24x7');
  const [selected, setSelected] = useState<ManagedServiceAccount | null>(null);

  const list = accounts.data?.accounts ?? [];
  const current = selected ?? list[0] ?? null;
  const totalTowers = current?.serviceTowers.length ?? 0;
  const monthly = current ? `$${Math.round(current.financials.monthlyRunCostUsd / 1000)}k` : '$0';
  const assets = current?.cmdbSeed.length ?? 0;
  const automations = current?.serviceTowers.reduce((sum, tower) => sum + tower.automations.length, 0) ?? 0;

  const create = async () => {
    const account = await createAccount.mutateAsync({
      customerName,
      industry,
      objective,
      appCount,
      users,
      cloudProviders: parseList(cloudProviders),
      compliance: parseList(compliance),
      coverage,
    });
    setSelected(account);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Managed Services"
        description="TCS/Infosys-style IT operating model: service towers, CMDB, SLAs, runbooks, governance, and AI automation"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<ClipboardList size={13} />} onClick={() => setRoute('serviceDesk')}>
              Service Desk
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={createAccount.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              onClick={create}
              disabled={createAccount.isPending || objective.trim().length < 12}
            >
              {createAccount.isPending ? 'Designing' : 'Design service'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Service towers" value={String(totalTowers)} hint="Delivery capabilities" />
        <Kpi label="CMDB seed" value={String(assets)} hint="Assets and dependencies" />
        <Kpi label="Automations" value={String(automations)} hint="AI/runbook candidates" />
        <Kpi label="Monthly run" value={monthly} hint="Estimated managed service" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="New managed service" subtitle="Describe the customer estate and target operating model" action={<Building2 size={14} className="text-s-brand" />} />
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Customer" value={customerName} onChange={setCustomerName} placeholder="Customer legal name" />
              <Field label="Industry" value={industry} onChange={setIndustry} placeholder="Banking, retail, SaaS, healthcare" />
            </div>
            <label className="block">
              <span className="label-mono mb-1.5 block">Objective</span>
              <textarea
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
                rows={6}
                placeholder="Describe the real application estate, cloud footprint, users, service windows, compliance obligations, and operational goals."
                className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <NumberField label="Apps" value={appCount} onChange={setAppCount} />
              <NumberField label="Users" value={users} onChange={setUsers} />
              <label className="block">
                <span className="label-mono mb-1.5 block">Coverage</span>
                <select value={coverage} onChange={(event) => setCoverage(event.target.value as ManagedServiceCoverage)} className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand">
                  <option value="8x5">8x5</option>
                  <option value="16x5">16x5</option>
                  <option value="24x7">24x7</option>
                </select>
              </label>
            </div>
            <Field label="Cloud providers" value={cloudProviders} onChange={setCloudProviders} placeholder="AWS, Azure, GCP" />
            <Field label="Compliance" value={compliance} onChange={setCompliance} placeholder="SOC 2, PCI DSS, ISO 27001" />
            <Button
              variant="primary"
              icon={createAccount.isPending ? <Loader2 size={13} className="animate-spin" /> : <CloudCog size={13} />}
              onClick={create}
              disabled={createAccount.isPending || objective.trim().length < 12}
              className="w-full justify-center"
            >
              {createAccount.isPending ? 'Generating model' : 'Generate managed IT model'}
            </Button>
          </div>
        </Card>

        <AccountList
          accounts={list}
          selectedId={current?.id}
          isLoading={accounts.isLoading}
          onSelect={setSelected}
          onRefresh={() => accounts.refetch()}
        />
      </div>

      <AccountDetail account={current} />
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
        min={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand"
      />
    </label>
  );
}

function AccountList({
  accounts,
  selectedId,
  isLoading,
  onSelect,
  onRefresh,
}: {
  accounts: ManagedServiceAccount[];
  selectedId?: string;
  isLoading: boolean;
  onSelect: (account: ManagedServiceAccount) => void;
  onRefresh: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Managed accounts"
        subtitle={`${accounts.length} operating model${accounts.length === 1 ? '' : 's'}`}
        action={<Button size="sm" variant="ghost" icon={<RefreshCw size={12} />} onClick={onRefresh}>Refresh</Button>}
      />
      {isLoading ? (
        <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Loading managed services" />
      ) : accounts.length === 0 ? (
        <EmptyState icon={<Building2 size={18} />} title="No managed service model yet" description="Generate a service model to create towers, CMDB, SLAs, governance, and delivery pods." />
      ) : (
        <div className="divide-y divide-s-border max-h-[620px] overflow-y-auto">
          {accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => onSelect(account)}
              className={`w-full p-4 text-left ${selectedId === account.id ? 'bg-s-brand/5' : 'hover:bg-s-hover'}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="rounded border border-s-brand/30 bg-s-brand/10 px-1.5 py-0.5 text-[10px] font-mono uppercase text-s-brand">
                  {account.coverage}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{account.customerName}</span>
                <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono uppercase text-s-muted">
                  {account.maturity}
                </span>
              </div>
              <div className="mt-1 text-[12px] leading-relaxed text-s-secondary">{account.objective}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Token>{account.industry}</Token>
                <Token>{account.serviceTowers.length} towers</Token>
                <Token>{account.cmdbSeed.length} assets</Token>
                <Token>${account.financials.monthlyRunCostUsd.toLocaleString()}/mo</Token>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function AccountDetail({ account }: { account: ManagedServiceAccount | null }) {
  if (!account) {
    return (
      <Card>
        <EmptyState icon={<CloudCog size={18} />} title="No managed service selected" description="Generate an operating model to see service towers, transition plan, CMDB seed, and AI governance." />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
      <Card className="overflow-hidden">
        <CardHeader
          title={`${account.customerName} managed IT model`}
          subtitle={`${account.industry} · ${account.coverage} · ${account.maturity}`}
          action={<Coins size={14} className="text-s-brand" />}
        />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Mini label="Transition" value={`$${account.financials.transitionCostUsd.toLocaleString()}`} />
            <Mini label="Monthly run" value={`$${account.financials.monthlyRunCostUsd.toLocaleString()}`} />
            <Mini label="Automation savings" value={`${account.financials.projectedAutomationSavingsPercent}%`} />
          </div>

          <div>
            <SectionTitle>Service towers</SectionTitle>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {account.serviceTowers.map((tower) => <TowerCard key={tower.id} tower={tower} />)}
            </div>
          </div>

          <div>
            <SectionTitle>Transition plan</SectionTitle>
            <div className="space-y-2">
              {account.transitionPlan.map((phase, index) => (
                <div key={phase.phase} className="rounded-md border border-s-border bg-s-base p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded border border-s-brand/30 bg-s-brand/10 font-mono text-[10px] text-s-brand">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{phase.phase}</span>
                    <span className="font-mono text-[11px] text-s-muted">{phase.durationDays}d</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{phase.outcomes.map((item) => <Token key={item}>{item}</Token>)}</div>
                  <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{phase.exitCriteria.join(' · ')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4 min-w-0">
        <SidePanel title="CMDB seed" icon={<Database size={14} className="text-s-brand" />}>
          {account.cmdbSeed.map((asset) => (
            <div key={asset.id} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-s-primary">{asset.name}</span>
                <Token>{asset.type}</Token>
              </div>
              <div className="mt-1 font-mono text-[10px] text-s-muted">{asset.ownerAgent} · {asset.criticality}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">{asset.monitors.map((monitor) => <Token key={monitor}>{monitor}</Token>)}</div>
            </div>
          ))}
        </SidePanel>

        <SidePanel title="Delivery pods" icon={<Bot size={14} className="text-s-brand" />}>
          {account.deliveryPods.map((pod) => (
            <div key={pod.name} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="text-[12.5px] font-medium text-s-primary">{pod.name}</div>
              <div className="mt-1 text-[12px] leading-relaxed text-s-secondary">{pod.mission}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">{pod.agents.map((agent) => <Token key={agent}>{agent}</Token>)}</div>
            </div>
          ))}
        </SidePanel>

        <SidePanel title="AI operating model" icon={<ShieldCheck size={14} className="text-s-brand" />}>
          <CompactList title="LLM routing" items={account.aiOperatingModel.llmRouting} />
          <CompactList title="Guardrails" items={account.aiOperatingModel.guardrails} />
          <CompactList title="Escalation" items={account.aiOperatingModel.escalationPolicy} />
        </SidePanel>

        <SidePanel title="Governance" icon={<Network size={14} className="text-s-brand" />}>
          {account.governance.map((forum) => (
            <div key={forum.forum} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-s-primary">{forum.forum}</span>
                <Token>{forum.cadence}</Token>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">{forum.decisions.map((decision) => <Token key={decision}>{decision}</Token>)}</div>
            </div>
          ))}
        </SidePanel>
      </div>
    </div>
  );
}

function TowerCard({ tower }: { tower: ManagedServiceTower }) {
  return (
    <div className="rounded-md border border-s-border bg-s-base p-3">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{tower.name}</span>
        <Token>{tower.criticality}</Token>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Mini label="P1 response" value={`${tower.sla.p1ResponseMinutes}m`} />
        <Mini label="P1 resolve" value={`${tower.sla.p1ResolutionHours}h`} />
      </div>
      <div className="mt-3">
        <div className="label-mono mb-1">Agents</div>
        <div className="flex flex-wrap gap-1.5">{tower.agents.map((agent) => <Token key={agent}>{agent}</Token>)}</div>
      </div>
      <div className="mt-3">
        <div className="label-mono mb-1">Automations</div>
        <div className="flex flex-wrap gap-1.5">{tower.automations.slice(0, 4).map((automation) => <Token key={automation}>{automation}</Token>)}</div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-s-border bg-s-subtle p-3">
      <div className="label-mono mb-1">{label}</div>
      <div className="font-mono text-[16px] text-s-primary">{value}</div>
    </div>
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

function CompactList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-s-border bg-s-base p-3">
      <div className="label-mono mb-2">{title}</div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item} className="flex gap-2 text-[12px] leading-relaxed text-s-secondary">
            <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-s-success" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
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
