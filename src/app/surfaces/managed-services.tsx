import { useState, type ReactNode } from 'react';
import {
  Award,
  Bot,
  Building2,
  CheckCircle2,
  ClipboardList,
  CloudCog,
  Coins,
  Database,
  Gauge,
  Loader2,
  Network,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Trophy,
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
  useCreateManagedServiceTransformationRun,
  useManagedServiceAccounts,
  useManagedServiceITGiantReadiness,
  useManagedServiceTransformationRuns,
  type ITGiantReadinessReport,
  type ManagedServiceAccount,
  type ManagedServiceCoverage,
  type ManagedServiceTransformationRun,
  type ManagedServiceTower,
} from '../lib/queries';
import { useRouting } from '../lib/useRouting';
import { useToast } from '../lib/toast';

function parseList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function ManagedServices() {
  const accounts = useManagedServiceAccounts();
  const createAccount = useCreateManagedServiceAccount();
  const createTransformation = useCreateManagedServiceTransformationRun();
  const { setRoute } = useRouting();
  const { toast } = useToast();
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
  const readiness = useManagedServiceITGiantReadiness(current?.id);
  const transformationRuns = useManagedServiceTransformationRuns();
  const latestTransformation = transformationRuns.data?.runs.find((run) => !current?.id || run.accountId === current.id) ?? transformationRuns.data?.runs[0] ?? null;
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

  const runTransformation = async () => {
    try {
      const run = await createTransformation.mutateAsync({
        accountId: current?.id,
        maxMissions: 3,
        tactic: 'Close IT giant service gaps with mission-backed managed-service offers, signed proof, and commercial value metrics.',
      });
      toast({ kind: 'success', title: 'Transformation sprint created', description: `${run.missionControlRuns.length} Mission Control runs created.` });
    } catch (error) {
      toast({ kind: 'error', title: 'Transformation sprint failed', description: error instanceof Error ? error.message : 'Unable to create sprint.' });
    }
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

      <ITGiantReadinessPanel
        report={readiness.data ?? null}
        run={latestTransformation}
        busy={createTransformation.isPending}
        onRunTransformation={runTransformation}
        onOpenMissions={() => setRoute('missionControl')}
      />

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

function ITGiantReadinessPanel({
  report,
  run,
  busy,
  onRunTransformation,
  onOpenMissions,
}: {
  report: ITGiantReadinessReport | null;
  run: ManagedServiceTransformationRun | null;
  busy: boolean;
  onRunTransformation: () => void;
  onOpenMissions: () => void;
}) {
  const topCapabilities = report?.capabilities.slice(0, 5) ?? [];
  const topGaps = report?.serviceGaps.slice(0, 4) ?? [];

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="IT giant readiness"
        subtitle={report ? `${report.status.replace('-', ' ')} · benchmarked against TCS, Accenture, Infosys, Wipro, HCLTech, Cognizant, Capgemini` : 'Loading service benchmark'}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Rocket size={13} />} onClick={onOpenMissions}>
              Missions
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={busy ? <Loader2 size={13} className="animate-spin" /> : <Trophy size={13} />}
              onClick={onRunTransformation}
              disabled={busy || !report}
            >
              {busy ? 'Creating' : 'Run service sprint'}
            </Button>
          </div>
        }
      />
      {report ? (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-[210px_minmax(0,1fr)] gap-4">
            <div className="rounded-md border border-s-border bg-s-base p-4">
              <div className="label-mono mb-2">AXON challenger score</div>
              <div className="flex items-end gap-2">
                <div className="font-mono text-[34px] leading-none text-s-primary">{report.score}%</div>
                <Gauge size={18} className="mb-1 text-s-brand" />
              </div>
              <div className="mt-2 h-2 rounded-full bg-s-subtle overflow-hidden">
                <div className="h-full rounded-full bg-s-brand" style={{ width: `${report.score}%` }} />
              </div>
              <div className="mt-2 text-[11.5px] leading-relaxed text-s-secondary">Target: 92%+ for giant-grade managed service credibility.</div>
            </div>
            <div className="rounded-md border border-s-brand/30 bg-s-brand/10 p-4 text-[12.5px] leading-relaxed text-s-primary">
              {report.thesis}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_410px] gap-4">
            <div className="rounded-md border border-s-border bg-s-base overflow-hidden">
              <div className="border-b border-s-border px-3 py-2 label-mono">Service-line gap board</div>
              <div className="divide-y divide-s-border">
                {topCapabilities.map((capability) => (
                  <div key={capability.id} className="p-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{capability.title}</span>
                      <span className="font-mono text-[11px] text-s-muted">{capability.score}/{capability.targetScore}</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-s-subtle overflow-hidden">
                      <div className="h-full rounded-full bg-s-brand" style={{ width: `${capability.score}%` }} />
                    </div>
                    <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{capability.improvementMove}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">{capability.requiredTowerCategories.map((tower) => <Token key={tower}>{tower}</Token>)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-s-border bg-s-base overflow-hidden">
              <div className="border-b border-s-border px-3 py-2 label-mono">Missing or weak service lanes</div>
              <div className="divide-y divide-s-border">
                {topGaps.map((gap) => (
                  <div key={gap.id} className="p-3">
                    <div className="flex items-center gap-2">
                      <Token>{gap.severity}</Token>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-s-primary">{gap.ownerTower}</span>
                    </div>
                    <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{gap.fix}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_410px] gap-4">
            <div className="rounded-md border border-s-border bg-s-base overflow-hidden">
              <div className="border-b border-s-border px-3 py-2 label-mono">Competitor counter-position</div>
              <div className="divide-y divide-s-border">
                {report.competitors.slice(0, 5).map((competitor) => (
                  <div key={competitor.id} className="p-3">
                    <div className="flex items-center gap-2">
                      <Award size={13} className="text-s-brand" />
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-s-primary">{competitor.name}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-1 lg:grid-cols-3 gap-2">
                      <CounterBox title="Their edge">{competitor.currentEdge}</CounterBox>
                      <CounterBox title="Their gap">{competitor.weakSpot}</CounterBox>
                      <CounterBox title="AXON counter">{competitor.axonCounter}</CounterBox>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <TransformationRunPanel run={run} />
          </div>
        </div>
      ) : (
        <EmptyState icon={<Trophy size={18} />} title="Loading IT giant benchmark" />
      )}
    </Card>
  );
}

function TransformationRunPanel({ run }: { run: ManagedServiceTransformationRun | null }) {
  if (!run) {
    return (
      <div className="rounded-md border border-s-border bg-s-base overflow-hidden">
        <div className="border-b border-s-border px-3 py-2 label-mono">Latest transformation sprint</div>
        <EmptyState icon={<Rocket size={18} />} title="No service sprint yet" description="Create a sprint to turn weak service lanes into Mission Control work, proof artifacts, and commercial packaging." />
      </div>
    );
  }

  return (
    <div className="rounded-md border border-s-border bg-s-base overflow-hidden">
      <div className="border-b border-s-border px-3 py-2 label-mono">Latest transformation sprint</div>
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2 min-w-0">
          <Token>{run.status}</Token>
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-s-primary">{run.id}</span>
          <span className="font-mono text-[11px] text-s-muted">{run.progress.score}%</span>
        </div>
        <div className="rounded-md border border-s-border bg-s-subtle p-2">
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="text-s-secondary">Stage gates</span>
            <span className="font-mono text-s-primary">{run.progress.completedGates}/{run.progress.totalGates}</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-s-base overflow-hidden">
            <div className="h-full rounded-full bg-s-brand" style={{ width: `${run.progress.score}%` }} />
          </div>
        </div>
        <div className="rounded-md border border-s-brand/30 bg-s-brand/10 p-2">
          <div className="text-[12px] font-medium text-s-primary">{run.commercialPack.offerName}</div>
          <div className="mt-1 text-[11.5px] leading-relaxed text-s-secondary">{run.commercialPack.buyerPromise}</div>
        </div>
        <div className="space-y-2">
          {run.missionControlRuns.map((mission) => (
            <div key={mission.missionControlRunId} className="rounded-md border border-s-border bg-s-subtle p-2">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-s-primary">{mission.capabilityTitle}</span>
                <span className="font-mono text-[10px] text-s-muted">{mission.score}</span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-s-muted">{mission.missionControlRunId}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="label-mono mb-2">Proof artifacts</div>
          <div className="space-y-1.5">
            {run.proofArtifacts.map((artifact) => (
              <div key={artifact.id} className="rounded-md border border-s-border bg-s-subtle p-2">
                <div className="flex items-center gap-2">
                  <Token>{artifact.kind}</Token>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-s-primary">{artifact.name}</span>
                </div>
                <div className="mt-1 truncate font-mono text-[9.5px] text-s-muted">{artifact.sha256}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CounterBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-s-border bg-s-subtle p-2">
      <div className="label-mono mb-1">{title}</div>
      <div className="text-[11.5px] leading-relaxed text-s-secondary">{children}</div>
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
