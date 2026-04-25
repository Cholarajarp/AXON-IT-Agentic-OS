import { useState, type ReactNode } from 'react';
import {
  BookOpen,
  Bot,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Plus,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button, Card, CardHeader, EmptyState, Kpi, PageHeader, SeverityBadge } from '../components/ui/primitives';
import {
  useAddLearningSource,
  useCreateSkillAcademyPlan,
  useSkillAcademyPlans,
  useSkillAcademyRoles,
  useSkillAcademySources,
  type LearningSource,
  type LearningSourceType,
  type RoleSkillProfile,
  type SkillDomain,
  type TeamSkillPlan,
} from '../lib/queries';
import { useRouting } from '../lib/useRouting';

const domainOptions: SkillDomain[] = ['product', 'architecture', 'frontend', 'backend', 'database', 'devops', 'security', 'sre', 'qa', 'data-ai', 'finops', 'customer-success'];

function parseDomains(value: string): SkillDomain[] {
  const allowed = new Set(domainOptions);
  return value.split(',').map((item) => item.trim() as SkillDomain).filter((item) => allowed.has(item));
}

export function SkillAcademy() {
  const plans = useSkillAcademyPlans();
  const roles = useSkillAcademyRoles();
  const sources = useSkillAcademySources();
  const createPlan = useCreateSkillAcademyPlan();
  const addSource = useAddLearningSource();
  const { setRoute } = useRouting();
  const [objective, setObjective] = useState('');
  const [teamSize, setTeamSize] = useState(9);
  const [budgetUsdPerMonth, setBudgetUsdPerMonth] = useState(85000);
  const [deliveryMode, setDeliveryMode] = useState<TeamSkillPlan['deliveryMode']>('managed-service');
  const [currentMaturity, setCurrentMaturity] = useState<'starter' | 'growing' | 'enterprise'>('growing');
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceType, setSourceType] = useState<LearningSourceType>('github');
  const [sourceDomains, setSourceDomains] = useState('');
  const [selected, setSelected] = useState<TeamSkillPlan | null>(null);

  const list = plans.data?.plans ?? [];
  const current = selected ?? list[0] ?? null;
  const roleCount = current?.roles.length ?? roles.data?.roles.length ?? 0;
  const learningItems = current?.learningBacklog.length ?? 0;
  const sourceCount = sources.data?.sources.length ?? current?.sources.length ?? 0;

  const create = async () => {
    const plan = await createPlan.mutateAsync({
      objective,
      teamSize,
      budgetUsdPerMonth,
      deliveryMode,
      currentMaturity,
      sources: sourceUrl.trim()
        ? [{ title: sourceTitle, url: sourceUrl, type: sourceType, domains: parseDomains(sourceDomains) }]
        : [],
    });
    setSelected(plan);
  };

  const addLearningSource = async () => {
    await addSource.mutateAsync({
      title: sourceTitle,
      url: sourceUrl,
      type: sourceType,
      domains: parseDomains(sourceDomains),
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Skill Academy"
        description="Agent workforce planning: roles, current skills, open learning sources, practice tasks, validation evidence, and cost controls"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Users size={13} />} onClick={() => setRoute('managedServices')}>
              Managed Services
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={createPlan.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              onClick={create}
              disabled={createPlan.isPending || objective.trim().length < 12}
            >
              {createPlan.isPending ? 'Planning' : 'Plan workforce'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Agent roles" value={String(roleCount)} hint="People jobs as AI roles" />
        <Kpi label="Skill coverage" value={current ? `${current.skillCoverageScore}%` : '--'} hint="Ready-to-deliver score" />
        <Kpi label="Learning backlog" value={String(learningItems)} hint="Continuous improvement" />
        <Kpi label="Sources" value={String(sourceCount)} hint="Open/current resources" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="Workforce plan" subtitle="Tell AXON what product/team workflow to staff with AI agents" action={<GraduationCap size={14} className="text-s-brand" />} />
          <div className="p-4 space-y-4">
            <label className="block">
              <span className="label-mono mb-1.5 block">Objective</span>
              <textarea
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
                rows={6}
                placeholder="Describe the real product, team, capabilities, quality gaps, learning sources, and delivery goal."
                className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberField label="Team size" value={teamSize} onChange={setTeamSize} />
              <NumberField label="Budget / month" value={budgetUsdPerMonth} onChange={setBudgetUsdPerMonth} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="label-mono mb-1.5 block">Delivery mode</span>
                <select value={deliveryMode} onChange={(event) => setDeliveryMode(event.target.value as TeamSkillPlan['deliveryMode'])} className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand">
                  <option value="build">build</option>
                  <option value="operate">operate</option>
                  <option value="modernize">modernize</option>
                  <option value="managed-service">managed-service</option>
                </select>
              </label>
              <label className="block">
                <span className="label-mono mb-1.5 block">Current maturity</span>
                <select value={currentMaturity} onChange={(event) => setCurrentMaturity(event.target.value as typeof currentMaturity)} className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand">
                  <option value="starter">starter</option>
                  <option value="growing">growing</option>
                  <option value="enterprise">enterprise</option>
                </select>
              </label>
            </div>

            <div className="rounded-md border border-s-border bg-s-base p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[12.5px] font-medium text-s-primary">Add learning source</div>
                  <div className="text-[11px] text-s-muted">GitHub repos, standards, docs, courses, or internal runbooks</div>
                </div>
                <Button size="sm" variant="ghost" icon={addSource.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} onClick={addLearningSource} disabled={!sourceUrl.trim() || addSource.isPending}>
                  Add
                </Button>
              </div>
              <Field label="Title" value={sourceTitle} onChange={setSourceTitle} placeholder="Source title" />
              <Field label="URL" value={sourceUrl} onChange={setSourceUrl} placeholder="https://github.com/org/repo or docs URL" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="label-mono mb-1.5 block">Type</span>
                  <select value={sourceType} onChange={(event) => setSourceType(event.target.value as LearningSourceType)} className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand">
                    <option value="github">github</option>
                    <option value="documentation">documentation</option>
                    <option value="standard">standard</option>
                    <option value="course">course</option>
                    <option value="internal-runbook">internal-runbook</option>
                  </select>
                </label>
                <Field label="Domains" value={sourceDomains} onChange={setSourceDomains} placeholder="security, backend, sre" />
              </div>
            </div>

            <Button
              variant="primary"
              icon={createPlan.isPending ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
              onClick={create}
              disabled={createPlan.isPending || objective.trim().length < 12}
              className="w-full justify-center"
            >
              {createPlan.isPending ? 'Generating workforce plan' : 'Generate agent workforce'}
            </Button>
          </div>
        </Card>

        <PlanList plans={list} selectedId={current?.id} isLoading={plans.isLoading} onSelect={setSelected} onRefresh={() => plans.refetch()} />
      </div>

      <PlanDetail plan={current} fallbackRoles={roles.data?.roles ?? []} fallbackSources={sources.data?.sources ?? []} />
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

function PlanList({ plans, selectedId, isLoading, onSelect, onRefresh }: { plans: TeamSkillPlan[]; selectedId?: string; isLoading: boolean; onSelect: (plan: TeamSkillPlan) => void; onRefresh: () => void }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Workforce plans" subtitle={`${plans.length} plan${plans.length === 1 ? '' : 's'}`} action={<Button size="sm" variant="ghost" icon={<RefreshCw size={12} />} onClick={onRefresh}>Refresh</Button>} />
      {isLoading ? (
        <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Loading workforce plans" />
      ) : plans.length === 0 ? (
        <EmptyState icon={<GraduationCap size={18} />} title="No workforce plan yet" description="Generate a plan to map AI agents to real IT jobs, learning, evidence, and cost controls." />
      ) : (
        <div className="divide-y divide-s-border max-h-[620px] overflow-y-auto">
          {plans.map((plan) => (
            <button key={plan.id} onClick={() => onSelect(plan)} className={`w-full p-4 text-left ${selectedId === plan.id ? 'bg-s-brand/5' : 'hover:bg-s-hover'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="rounded border border-s-brand/30 bg-s-brand/10 px-1.5 py-0.5 text-[10px] font-mono uppercase text-s-brand">{plan.deliveryMode}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{plan.objective}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Token>{plan.roles.length} roles</Token>
                <Token>{plan.targetTeamSize} seats</Token>
                <Token>{plan.skillCoverageScore}% coverage</Token>
                <Token>${plan.monthlyCostUsd.toLocaleString()}/mo</Token>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function PlanDetail({ plan, fallbackRoles, fallbackSources }: { plan: TeamSkillPlan | null; fallbackRoles: RoleSkillProfile[]; fallbackSources: LearningSource[] }) {
  if (!plan) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
        <RoleCatalog roles={fallbackRoles} />
        <SourcePanel sources={fallbackSources} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
      <Card className="overflow-hidden">
        <CardHeader title="Agent workforce execution model" subtitle={`${plan.deliveryMode} · ${plan.targetTeamSize} seats · $${plan.monthlyCostUsd.toLocaleString()}/month`} action={<SeverityBadge level={plan.skillCoverageScore >= 80 ? 'LOW' : plan.skillCoverageScore >= 60 ? 'MEDIUM' : 'HIGH'} />} />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Mini label="Skill coverage" value={`${plan.skillCoverageScore}%`} />
            <Mini label="Productivity lift" value={`${plan.projectedProductivityLiftPercent}%`} />
            <Mini label="Learning items" value={String(plan.learningBacklog.length)} />
          </div>

          <div>
            <SectionTitle>AI agents doing people jobs</SectionTitle>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {plan.roles.map((role) => <RoleCard key={role.role} role={role} />)}
            </div>
          </div>

          <div>
            <SectionTitle>Squad workflows</SectionTitle>
            <div className="space-y-2">
              {plan.squads.map((squad) => (
                <div key={squad.name} className="rounded-md border border-s-border bg-s-base p-3">
                  <div className="flex items-center gap-2">
                    <Route size={13} className="text-s-brand" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{squad.name}</span>
                  </div>
                  <div className="mt-1 text-[12px] leading-relaxed text-s-secondary">{squad.mission}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{squad.workflow.map((step) => <Token key={step}>{step}</Token>)}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{squad.successMetrics.map((metric) => <Token key={metric}>{metric}</Token>)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4 min-w-0">
        <LearningBacklog plan={plan} />
        <CostControls plan={plan} />
        <SourcePanel sources={plan.sources} />
      </div>
    </div>
  );
}

function RoleCatalog({ roles }: { roles: RoleSkillProfile[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Role catalog" subtitle={`${roles.length} AI workforce roles`} action={<Bot size={14} className="text-s-brand" />} />
      {roles.length === 0 ? <EmptyState icon={<Bot size={18} />} title="Loading role catalog" /> : (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
          {roles.map((role) => <RoleCard key={role.role} role={role} />)}
        </div>
      )}
    </Card>
  );
}

function RoleCard({ role }: { role: RoleSkillProfile }) {
  return (
    <div className="rounded-md border border-s-border bg-s-base p-3">
      <div className="text-[13px] font-medium text-s-primary">{role.role}</div>
      <div className="mt-1 text-[12px] leading-relaxed text-s-secondary">{role.mission}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">{role.domains.map((domain) => <Token key={domain}>{domain}</Token>)}</div>
      <div className="mt-3 space-y-2">
        {role.requiredSkills.slice(0, 3).map((skill) => (
          <div key={skill.name} className="rounded border border-s-border bg-s-subtle p-2">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-s-primary">{skill.name}</span>
              <span className="font-mono text-[10px] text-s-muted">L{skill.targetLevel}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">{skill.evidence.map((item) => <Token key={item}>{item}</Token>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LearningBacklog({ plan }: { plan: TeamSkillPlan }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Learning backlog" subtitle="Skills agents apply to product work" action={<BookOpen size={14} className="text-s-brand" />} />
      <div className="p-4 space-y-2">
        {plan.learningBacklog.map((item) => (
          <div key={item.id} className="rounded-md border border-s-border bg-s-base p-3">
            <div className="flex items-center gap-2">
              <SeverityBadge level={item.priority} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-s-primary">{item.skill}</span>
              <Token>{item.domain}</Token>
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{item.reason}</div>
            <div className="mt-2 flex gap-2 text-[12px] leading-relaxed text-s-secondary">
              <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-s-success" />
              <span>{item.practiceTask}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">{item.validationEvidence.map((evidence) => <Token key={evidence}>{evidence}</Token>)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CostControls({ plan }: { plan: TeamSkillPlan }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Cost controls" subtitle="AI productivity without runaway spend" action={<ShieldCheck size={14} className="text-s-brand" />} />
      <div className="p-4 space-y-2">
        {plan.costControls.map((control) => (
          <div key={control.control} className="rounded-md border border-s-border bg-s-base p-3">
            <div className="font-mono text-[10px] text-s-muted">{control.owner}</div>
            <div className="mt-1 text-[12.5px] text-s-primary">{control.control}</div>
            <div className="mt-1 text-[12px] leading-relaxed text-s-secondary">{control.expectedImpact}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SourcePanel({ sources }: { sources: LearningSource[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Learning sources" subtitle={`${sources.length} reviewed resources`} action={<BookOpen size={14} className="text-s-brand" />} />
      {sources.length === 0 ? <EmptyState icon={<BookOpen size={18} />} title="No learning sources loaded" /> : (
        <div className="p-4 space-y-2">
          {sources.slice(0, 8).map((source) => (
            <div key={source.id} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-s-primary">{source.title}</span>
                <Token>{source.type}</Token>
              </div>
              <div className="mt-1 truncate font-mono text-[10px] text-s-muted">{source.url}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Token>{source.trust}</Token>
                <Token>{source.refreshCadenceDays}d refresh</Token>
                {source.domains.map((domain) => <Token key={domain}>{domain}</Token>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
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
