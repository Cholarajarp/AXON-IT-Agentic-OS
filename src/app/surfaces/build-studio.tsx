import { useMemo, useState, type ReactNode } from 'react';
import {
  Bot,
  Building2,
  CheckCircle2,
  Code2,
  Clipboard,
  Database,
  ExternalLink,
  Eye,
  FileCode2,
  GitBranch,
  Globe2,
  History,
  Layers3,
  Loader2,
  Monitor,
  PackageCheck,
  Play,
  Rocket,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TestTube2,
  Wand2,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Kpi,
  PageHeader,
  Tabs,
} from '../components/ui/primitives';
import {
  useActivateProductBlueprintAgenticLaunch,
  useApproveProductBlueprint,
  useCreateProductBlueprint,
  useLaunchProductBlueprint,
  useProductBlueprints,
  type AppFeatureChip,
  type BuilderMode,
  type ProductRequestInput,
  type ServiceBlueprint,
} from '../lib/queries';
import { useRouting } from '../lib/useRouting';

type PreviewMode = 'desktop' | 'mobile';
type StudioTab = 'preview' | 'blueprint' | 'design-ai' | 'code' | 'data' | 'quality';
type DesignStyle = NonNullable<ProductRequestInput['designStyle']>;
type DeployTarget = NonNullable<ProductRequestInput['deployTarget']>;

const featureChips: Array<{ id: AppFeatureChip; label: string; icon: ReactNode }> = [
  { id: 'auth', label: 'Auth', icon: <ShieldCheck size={12} /> },
  { id: 'database', label: 'Database', icon: <Database size={12} /> },
  { id: 'ai-chat', label: 'AI chat', icon: <Bot size={12} /> },
  { id: 'workflow', label: 'Workflow', icon: <GitBranch size={12} /> },
  { id: 'admin', label: 'Admin', icon: <Layers3 size={12} /> },
  { id: 'analytics', label: 'Analytics', icon: <TestTube2 size={12} /> },
  { id: 'payments', label: 'Payments', icon: <PackageCheck size={12} /> },
  { id: 'storage', label: 'Files', icon: <FileCode2 size={12} /> },
  { id: 'search', label: 'Search', icon: <Sparkles size={12} /> },
  { id: 'realtime', label: 'Realtime', icon: <Globe2 size={12} /> },
  { id: 'maps', label: 'Maps', icon: <Globe2 size={12} /> },
  { id: 'browser-qa', label: 'Browser QA', icon: <Eye size={12} /> },
  { id: 'deploy', label: 'Deploy', icon: <Rocket size={12} /> },
];

const modeOptions: Array<{ id: BuilderMode; label: string }> = [
  { id: 'saas-app', label: 'SaaS app' },
  { id: 'internal-tool', label: 'Internal tool' },
  { id: 'ai-agent', label: 'AI agent' },
  { id: 'workflow-automation', label: 'Workflow' },
  { id: 'api-service', label: 'API service' },
  { id: 'landing-to-app', label: 'Landing to app' },
];

type PromptStarter = {
  id: string;
  label: string;
  prompt: string;
  builderMode: BuilderMode;
  designStyle: DesignStyle;
  deployTarget: DeployTarget;
  chips: AppFeatureChip[];
  targetUsers: string;
  integrations: string;
  compliance: string;
  constraints: string;
  budgetUsd: string;
  timelineDays: string;
};

const promptStarters: PromptStarter[] = [
  {
    id: 'support-saas',
    label: 'Support SaaS',
    prompt: 'Build a production SaaS for IT support teams with AI ticket triage, customer portal, Slack alerts, SSO, PostgreSQL, admin analytics, Playwright QA, audit evidence, and Docker deployment.',
    builderMode: 'saas-app',
    designStyle: 'enterprise',
    deployTarget: 'docker-compose',
    chips: ['auth', 'database', 'ai-chat', 'workflow', 'admin', 'analytics', 'browser-qa', 'deploy'],
    targetUsers: 'Support agent, Customer admin, IT manager',
    integrations: 'Slack, GitHub, PostgreSQL',
    compliance: 'SOC 2',
    constraints: 'Production, customer data, tenant isolation, low latency',
    budgetUsd: '45000',
    timelineDays: '35',
  },
  {
    id: 'ops-console',
    label: 'Ops Console',
    prompt: 'Build an internal operations console for infrastructure change approvals with RBAC, deployment evidence, incident timeline, rollback checklist, service health dashboards, and Kubernetes release commands.',
    builderMode: 'internal-tool',
    designStyle: 'ops-console',
    deployTarget: 'kubernetes',
    chips: ['auth', 'database', 'workflow', 'admin', 'analytics', 'browser-qa', 'deploy'],
    targetUsers: 'SRE, Release manager, Platform admin',
    integrations: 'GitHub, Kubernetes, PagerDuty',
    compliance: 'ISO 27001',
    constraints: 'Production changes, approval gates, rollback required',
    budgetUsd: '65000',
    timelineDays: '45',
  },
  {
    id: 'api-platform',
    label: 'API Platform',
    prompt: 'Build a developer API service with tenant API keys, webhook replay, SDK examples, usage analytics, searchable docs, billing limits, audit logs, and Cloud Run deployment.',
    builderMode: 'api-service',
    designStyle: 'developer-tool',
    deployTarget: 'cloud-run',
    chips: ['auth', 'database', 'payments', 'analytics', 'search', 'browser-qa', 'deploy'],
    targetUsers: 'Developer, Platform owner, Finance admin',
    integrations: 'Stripe, GitHub, Webhooks',
    compliance: 'SOC 2, GDPR',
    constraints: 'Public API, rate limits, customer data',
    budgetUsd: '75000',
    timelineDays: '50',
  },
];

export function BuildStudio() {
  const [prompt, setPrompt] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [targetUsers, setTargetUsers] = useState('');
  const [integrations, setIntegrations] = useState('');
  const [compliance, setCompliance] = useState('');
  const [constraints, setConstraints] = useState('');
  const [budgetUsd, setBudgetUsd] = useState('');
  const [timelineDays, setTimelineDays] = useState('');
  const [builderMode, setBuilderMode] = useState<BuilderMode>('saas-app');
  const [designStyle, setDesignStyle] = useState<DesignStyle>('enterprise');
  const [deployTarget, setDeployTarget] = useState<DeployTarget>('docker-compose');
  const [selectedChips, setSelectedChips] = useState<AppFeatureChip[]>(['auth', 'database', 'browser-qa', 'deploy']);
  const [blueprint, setBlueprint] = useState<ServiceBlueprint | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop');
  const [activeTab, setActiveTab] = useState<StudioTab>('preview');
  const [selectedFile, setSelectedFile] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const blueprintsQuery = useProductBlueprints();
  const createBlueprint = useCreateProductBlueprint();
  const approveBlueprint = useApproveProductBlueprint();
  const launchBlueprint = useLaunchProductBlueprint();
  const activateAgenticLaunch = useActivateProductBlueprintAgenticLaunch();
  const { setRoute } = useRouting();

  const previewHtml = useMemo(() => buildPreviewHtml(blueprint, prompt, selectedChips), [blueprint, prompt, selectedChips]);
  const selectedCodeFile = blueprint?.generatedFiles.find((file) => file.path === selectedFile) ?? blueprint?.generatedFiles[0];
  const passedGates = blueprint?.qualityGates.filter((gate) => gate.status === 'pass').length ?? 0;
  const blockedGates = blueprint?.qualityGates.filter((gate) => gate.status === 'block').length ?? 0;
  const promptScore = blueprint?.builder.promptQualityScore ?? localPromptScore(prompt, selectedChips);
  const estimate = blueprint?.estimates.cost.totalUsd ?? 0;
  const recentBlueprints = blueprintsQuery.data?.blueprints.slice(0, 5) ?? [];

  const build = async () => {
    setFormError('');
    setNotice('');
    const parsedBudget = parseOptionalPositiveNumber(budgetUsd, 'Budget USD');
    const parsedTimeline = parseOptionalPositiveNumber(timelineDays, 'Timeline days', true);
    if (parsedBudget.error || parsedTimeline.error) {
      setFormError(parsedBudget.error ?? parsedTimeline.error ?? '');
      return;
    }
    try {
      const generated = await createBlueprint.mutateAsync({
        goal: prompt,
        customerName,
        builderMode,
        designStyle,
        deployTarget,
        featureChips: selectedChips,
        integrations: parseList(integrations),
        compliance: parseList(compliance),
        targetUsers: parseList(targetUsers),
        constraints: parseList(constraints),
        budgetUsd: parsedBudget.value,
        timelineDays: parsedTimeline.value,
      });
      setBlueprint(generated);
      setSelectedFile(generated.generatedFiles[0]?.path ?? '');
      setActiveTab('preview');
      setNotice(`Blueprint ${generated.id} generated and saved.`);
    } catch (error) {
      setFormError(toErrorMessage(error, 'Unable to generate the app system.'));
    }
  };

  const approve = async () => {
    if (!blueprint) return;
    setFormError('');
    setNotice('');
    try {
      const approved = await approveBlueprint.mutateAsync(blueprint.id);
      setBlueprint(approved);
      setNotice(`Blueprint ${approved.id} approved.`);
    } catch (error) {
      setFormError(toErrorMessage(error, 'Unable to approve the blueprint.'));
    }
  };

  const launch = async () => {
    if (!blueprint) return;
    setFormError('');
    setNotice('');
    try {
      const launched = await launchBlueprint.mutateAsync({ id: blueprint.id });
      setBlueprint(launched.blueprint);
      setRoute('workflows');
    } catch (error) {
      setFormError(toErrorMessage(error, 'Unable to launch the workflow.'));
    }
  };

  const activateAgentic = async () => {
    if (!blueprint) return;
    setFormError('');
    setNotice('');
    try {
      const activated = await activateAgenticLaunch.mutateAsync({
        id: blueprint.id,
        environment: blueprint.approvalRequired ? 'staging' : 'preview',
        autoApprove: true,
      });
      setBlueprint(activated.blueprint);
      setNotice(`Mission Control ${activated.missionControlRun.id} activated at ${activated.missionControlRun.score}%.`);
      setActiveTab('quality');
    } catch (error) {
      setFormError(toErrorMessage(error, 'Unable to activate the agentic launch.'));
    }
  };

  const openPreview = () => {
    const blob = new Blob([previewHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const toggleChip = (chip: AppFeatureChip) => {
    setSelectedChips((current) =>
      current.includes(chip) ? current.filter((item) => item !== chip) : [...current, chip],
    );
  };

  const applyStarter = (starter: PromptStarter) => {
    setPrompt(starter.prompt);
    setBuilderMode(starter.builderMode);
    setDesignStyle(starter.designStyle);
    setDeployTarget(starter.deployTarget);
    setSelectedChips(starter.chips);
    setTargetUsers(starter.targetUsers);
    setIntegrations(starter.integrations);
    setCompliance(starter.compliance);
    setConstraints(starter.constraints);
    setBudgetUsd(starter.budgetUsd);
    setTimelineDays(starter.timelineDays);
    setFormError('');
    setNotice(`${starter.label} starter loaded.`);
  };

  const selectBlueprint = (nextBlueprint: ServiceBlueprint) => {
    setBlueprint(nextBlueprint);
    setPrompt(nextBlueprint.goal);
    setCustomerName(nextBlueprint.customerName === 'Default customer' ? '' : nextBlueprint.customerName);
    setBuilderMode(nextBlueprint.builder.mode);
    setDesignStyle(nextBlueprint.builder.designStyle);
    setDeployTarget(nextBlueprint.builder.deployTarget);
    setSelectedChips(nextBlueprint.builder.featureChips);
    setSelectedFile(nextBlueprint.generatedFiles[0]?.path ?? '');
    setActiveTab('preview');
    setFormError('');
    setNotice(`Loaded ${nextBlueprint.id}.`);
  };

  const copySelectedFile = async () => {
    if (!selectedCodeFile) return;
    setFormError('');
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API is not available in this browser.');
      await navigator.clipboard.writeText(selectedCodeFile.content);
      setNotice(`${selectedCodeFile.path} copied.`);
    } catch (error) {
      setFormError(toErrorMessage(error, 'Unable to copy the generated file.'));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Build Studio"
        description="Prompt-to-product cockpit with app map, generated code, data/API design, QA gates, and deploy control"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Code2 size={13} />} onClick={() => setRoute('code')}>
              Code
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={createBlueprint.isPending ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
              onClick={build}
              disabled={createBlueprint.isPending || prompt.trim().length < 8}
            >
              {createBlueprint.isPending ? 'Generating' : 'Generate app'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Kpi label="Prompt" value={`${promptScore}%`} hint="specificity" trend={promptScore > 75 ? 'up' : 'flat'} />
        <Kpi label="Screens" value={String(blueprint?.screens.length ?? 0)} hint="generated routes" />
        <Kpi label="Code Files" value={String(blueprint?.generatedFiles.length ?? 0)} hint="portable package" />
        <Kpi label="Quality" value={blueprint ? `${passedGates}/${blueprint.qualityGates.length}` : '0/0'} hint={blockedGates ? `${blockedGates} blocked` : 'gates'} />
        <Kpi label="Estimate" value={estimate ? `$${estimate.toLocaleString('en-US')}` : '--'} hint="delivery cost" />
      </div>

      {(formError || notice) && (
        <InlineNotice tone={formError ? 'error' : 'success'} message={formError || notice} />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)] gap-4">
        <StudioInput
          prompt={prompt}
          customerName={customerName}
          targetUsers={targetUsers}
          integrations={integrations}
          compliance={compliance}
          constraints={constraints}
          budgetUsd={budgetUsd}
          timelineDays={timelineDays}
          builderMode={builderMode}
          designStyle={designStyle}
          deployTarget={deployTarget}
          selectedChips={selectedChips}
          isPending={createBlueprint.isPending}
          starters={promptStarters}
          recentBlueprints={recentBlueprints}
          activeBlueprintId={blueprint?.id}
          onPrompt={setPrompt}
          onCustomerName={setCustomerName}
          onTargetUsers={setTargetUsers}
          onIntegrations={setIntegrations}
          onCompliance={setCompliance}
          onConstraints={setConstraints}
          onBudgetUsd={setBudgetUsd}
          onTimelineDays={setTimelineDays}
          onBuilderMode={setBuilderMode}
          onDesignStyle={setDesignStyle}
          onDeployTarget={setDeployTarget}
          onToggleChip={toggleChip}
          onApplyStarter={applyStarter}
          onSelectBlueprint={selectBlueprint}
          onBuild={build}
        />

        <Card className="overflow-hidden min-w-0">
          <Tabs
            active={activeTab}
            onChange={(tab) => setActiveTab(tab as StudioTab)}
            tabs={[
              { id: 'preview', label: 'Preview' },
              { id: 'blueprint', label: 'Blueprint', count: blueprint?.screens.length },
              { id: 'design-ai', label: 'Design/AI', count: blueprint ? blueprint.agenticBuildPlan.team.length : undefined },
              { id: 'code', label: 'Code', count: blueprint?.generatedFiles.length },
              { id: 'data', label: 'Data/API', count: blueprint?.apiPlan.length },
              { id: 'quality', label: 'Quality', count: blueprint?.qualityGates.length },
            ]}
          />
          <div className="min-h-[720px]">
            {activeTab === 'preview' && (
              <PreviewTab
                blueprint={blueprint}
                previewHtml={previewHtml}
                previewMode={previewMode}
                onPreviewMode={setPreviewMode}
                onOpenPreview={openPreview}
              />
            )}
            {activeTab === 'blueprint' && <BlueprintTab blueprint={blueprint} />}
            {activeTab === 'design-ai' && <DesignAiTab blueprint={blueprint} />}
            {activeTab === 'code' && (
              <CodeTab
                blueprint={blueprint}
                selectedFile={selectedCodeFile}
                selectedPath={selectedCodeFile?.path ?? ''}
                onSelectFile={setSelectedFile}
                onCopyFile={copySelectedFile}
              />
            )}
            {activeTab === 'data' && <DataApiTab blueprint={blueprint} />}
            {activeTab === 'quality' && (
              <QualityTab
                blueprint={blueprint}
                isUpdating={approveBlueprint.isPending || launchBlueprint.isPending || activateAgenticLaunch.isPending}
                onApprove={approve}
                onLaunch={launch}
                onActivateAgentic={activateAgentic}
                onOpenMissionControl={() => setRoute('missionControl')}
                onOpenCompanyOs={() => setRoute('companyOs')}
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StudioInput({
  prompt,
  customerName,
  targetUsers,
  integrations,
  compliance,
  constraints,
  budgetUsd,
  timelineDays,
  builderMode,
  designStyle,
  deployTarget,
  selectedChips,
  isPending,
  starters,
  recentBlueprints,
  activeBlueprintId,
  onPrompt,
  onCustomerName,
  onTargetUsers,
  onIntegrations,
  onCompliance,
  onConstraints,
  onBudgetUsd,
  onTimelineDays,
  onBuilderMode,
  onDesignStyle,
  onDeployTarget,
  onToggleChip,
  onApplyStarter,
  onSelectBlueprint,
  onBuild,
}: {
  prompt: string;
  customerName: string;
  targetUsers: string;
  integrations: string;
  compliance: string;
  constraints: string;
  budgetUsd: string;
  timelineDays: string;
  builderMode: BuilderMode;
  designStyle: DesignStyle;
  deployTarget: DeployTarget;
  selectedChips: AppFeatureChip[];
  isPending: boolean;
  starters: PromptStarter[];
  recentBlueprints: ServiceBlueprint[];
  activeBlueprintId?: string;
  onPrompt: (value: string) => void;
  onCustomerName: (value: string) => void;
  onTargetUsers: (value: string) => void;
  onIntegrations: (value: string) => void;
  onCompliance: (value: string) => void;
  onConstraints: (value: string) => void;
  onBudgetUsd: (value: string) => void;
  onTimelineDays: (value: string) => void;
  onBuilderMode: (value: BuilderMode) => void;
  onDesignStyle: (value: DesignStyle) => void;
  onDeployTarget: (value: DeployTarget) => void;
  onToggleChip: (chip: AppFeatureChip) => void;
  onApplyStarter: (starter: PromptStarter) => void;
  onSelectBlueprint: (blueprint: ServiceBlueprint) => void;
  onBuild: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="App request" subtitle="Prompt, scope, delivery controls, and saved builds" action={<Sparkles size={14} className="text-s-brand" />} />
      <div className="p-4 space-y-4">
        <div>
          <div className="label-mono mb-2">Builder mode</div>
          <div className="grid grid-cols-2 gap-2">
            {modeOptions.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => onBuilderMode(mode.id)}
                className={`rounded-md border px-2.5 py-2 text-left text-[12px] transition-colors ${builderMode === mode.id ? 'border-s-brand/40 bg-s-brand/10 text-s-brand' : 'border-s-border bg-s-base text-s-secondary hover:text-s-primary'}`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="label-mono mb-2">Starters</div>
          <div className="grid grid-cols-1 gap-2">
            {starters.map((starter) => (
              <button
                key={starter.id}
                type="button"
                onClick={() => onApplyStarter(starter)}
                className="rounded-md border border-s-border bg-s-base px-3 py-2 text-left text-[12px] font-medium text-s-primary transition-colors hover:border-s-border-strong hover:bg-s-hover"
              >
                {starter.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="label-mono mb-1.5 block">What should AXON build?</span>
          <textarea
            value={prompt}
            onChange={(event) => onPrompt(event.target.value)}
            rows={7}
            placeholder="Build a production SaaS for support teams with AI triage, customer portal, Slack alerts, Stripe billing, admin analytics, PostgreSQL, SSO, tests, and deployment."
            className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand"
          />
        </label>

        <div>
          <div className="label-mono mb-2">Feature chips</div>
          <div className="flex flex-wrap gap-1.5">
            {featureChips.map((chip) => {
              const active = selectedChips.includes(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => onToggleChip(chip.id)}
                  className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium transition-colors ${active ? 'border-s-brand/40 bg-s-brand/10 text-s-brand' : 'border-s-border bg-s-base text-s-secondary hover:text-s-primary'}`}
                >
                  {chip.icon}
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <Field label="Customer" value={customerName} onChange={onCustomerName} placeholder="Customer or product owner" />
          <Field label="Target users" value={targetUsers} onChange={onTargetUsers} placeholder="Founder, admin, customer, support agent" />
          <Field label="Integrations" value={integrations} onChange={onIntegrations} placeholder="GitHub, Slack, Stripe, Supabase, Google Maps" />
          <Field label="Compliance" value={compliance} onChange={onCompliance} placeholder="SOC 2, HIPAA, PCI DSS" />
          <Field label="Constraints" value={constraints} onChange={onConstraints} placeholder="Production, customer data, mobile, low latency" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Design" value={designStyle} onChange={(value) => onDesignStyle(value as DesignStyle)} options={['enterprise', 'consumer', 'developer-tool', 'marketplace', 'ops-console']} />
          <SelectField label="Deploy" value={deployTarget} onChange={(value) => onDeployTarget(value as DeployTarget)} options={['docker-compose', 'vercel', 'replit', 'cloud-run', 'kubernetes', 'static']} />
          <Field label="Budget USD" value={budgetUsd} onChange={onBudgetUsd} placeholder="25000" />
          <Field label="Timeline days" value={timelineDays} onChange={onTimelineDays} placeholder="21" />
        </div>

        <Button
          variant="primary"
          icon={isPending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          onClick={onBuild}
          disabled={isPending || prompt.trim().length < 8}
          className="w-full justify-center"
        >
          {isPending ? 'Generating product system' : 'Generate complete app system'}
        </Button>

        {recentBlueprints.length > 0 && (
          <div>
            <div className="label-mono mb-2 flex items-center gap-1.5">
              <History size={12} />
              Recent builds
            </div>
            <div className="space-y-1.5">
              {recentBlueprints.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectBlueprint(item)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${activeBlueprintId === item.id ? 'border-s-brand/40 bg-s-brand/10' : 'border-s-border bg-s-base hover:bg-s-hover'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] font-medium text-s-primary">{item.templateName}</span>
                    <span className="shrink-0 font-mono text-[10px] uppercase text-s-muted">{item.status}</span>
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[10px] text-s-muted">{item.id} · {item.builder.promptQualityScore}%</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function PreviewTab({
  blueprint,
  previewHtml,
  previewMode,
  onPreviewMode,
  onOpenPreview,
}: {
  blueprint: ServiceBlueprint | null;
  previewHtml: string;
  previewMode: PreviewMode;
  onPreviewMode: (mode: PreviewMode) => void;
  onOpenPreview: () => void;
}) {
  return (
    <div className="bg-s-base p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-s-primary">{blueprint ? blueprint.templateName : 'Draft product preview'}</div>
          <div className="mt-0.5 truncate text-[11px] text-s-secondary">{blueprint ? blueprint.builder.enhancedPrompt : 'Generate once to turn the preview into a full app map.'}</div>
        </div>
        <div className="flex items-center gap-1">
          <IconButton active={previewMode === 'desktop'} label="Desktop preview" onClick={() => onPreviewMode('desktop')}><Monitor size={14} /></IconButton>
          <IconButton active={previewMode === 'mobile'} label="Mobile preview" onClick={() => onPreviewMode('mobile')}><Smartphone size={14} /></IconButton>
          <IconButton active={false} label="Open preview" onClick={onOpenPreview}><ExternalLink size={14} /></IconButton>
        </div>
      </div>
      <div className={`mx-auto overflow-hidden rounded-md border border-s-border bg-white shadow-sm ${previewMode === 'mobile' ? 'max-w-[390px]' : 'max-w-full'}`}>
        <iframe title="Generated product preview" srcDoc={previewHtml} className={`block w-full bg-white ${previewMode === 'mobile' ? 'h-[720px]' : 'h-[680px]'}`} sandbox="allow-scripts" />
      </div>
    </div>
  );
}

function BlueprintTab({ blueprint }: { blueprint: ServiceBlueprint | null }) {
  if (!blueprint) return <EmptyState icon={<Sparkles size={18} />} title="No blueprint yet" description="Generate an app to see routes, screens, roles, and competitor baseline." />;
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Mini label="Mode" value={blueprint.builder.mode} />
        <Mini label="Deploy" value={blueprint.builder.deployTarget} />
        <Mini label="Data" value={blueprint.builder.dataSensitivity} />
        <Mini label="Timeline" value={`${blueprint.estimates.timelineDays}d`} />
      </div>

      {blueprint.builder.followUpQuestions.length > 0 && (
        <Panel title="Decision questions" icon={<Sparkles size={13} className="text-s-brand" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {blueprint.builder.followUpQuestions.map((item) => (
              <div key={item.id} className="rounded-md border border-s-border bg-s-base p-3">
                <div className="text-[12.5px] font-medium text-s-primary">{item.question}</div>
                <div className="mt-1 text-[11.5px] leading-relaxed text-s-secondary">{item.whyItMatters}</div>
                <div className="mt-2"><Token>{item.defaultAnswer}</Token></div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="App map" icon={<Layers3 size={13} className="text-s-brand" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {blueprint.appMap.map((route) => (
            <div key={route.route} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-s-brand">{route.route}</span>
                <span className="truncate text-[12.5px] font-medium text-s-primary">{route.name}</span>
              </div>
              <div className="mt-1 text-[11.5px] leading-relaxed text-s-secondary">{route.purpose}</div>
              <div className="mt-2 flex flex-wrap gap-1">{route.primaryActions.map((item) => <Token key={item}>{item}</Token>)}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Screens" icon={<Monitor size={13} className="text-s-brand" />}>
        <div className="space-y-2">
          {blueprint.screens.map((screen) => (
            <div key={screen.id} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-s-primary">{screen.name}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-s-muted">{screen.route} · {screen.persona}</div>
                </div>
                <Token>{screen.states.length} states</Token>
              </div>
              <div className="mt-2 text-[12px] leading-relaxed text-s-secondary">{screen.layout}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Competitor baseline" icon={<TargetIcon />}>
        <div className="space-y-2">
          {blueprint.builder.competitorBaseline.map((item) => (
            <div key={item.platform} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="font-medium text-[12.5px] text-s-primary">{item.platform}</div>
              <div className="mt-1 text-[11.5px] text-s-secondary">{item.capability}</div>
              <div className="mt-2 text-[11.5px] leading-relaxed text-s-primary">{item.axonResponse}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function CodeTab({
  blueprint,
  selectedFile,
  selectedPath,
  onSelectFile,
  onCopyFile,
}: {
  blueprint: ServiceBlueprint | null;
  selectedFile?: ServiceBlueprint['generatedFiles'][number];
  selectedPath: string;
  onSelectFile: (path: string) => void;
  onCopyFile: () => void;
}) {
  if (!blueprint) return <EmptyState icon={<FileCode2 size={18} />} title="No generated files yet" description="Generate an app to inspect the source package." />;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] min-h-[720px]">
      <div className="border-r border-s-border bg-s-base p-3">
        <div className="label-mono mb-2">Generated files</div>
        <div className="space-y-1">
          {blueprint.generatedFiles.map((file) => (
            <button
              key={file.path}
              type="button"
              onClick={() => onSelectFile(file.path)}
              className={`w-full rounded-md border px-2 py-2 text-left transition-colors ${selectedPath === file.path ? 'border-s-brand/40 bg-s-brand/10 text-s-brand' : 'border-s-border bg-s-surface text-s-secondary hover:text-s-primary'}`}
            >
              <div className="truncate font-mono text-[11px]">{file.path}</div>
              <div className="mt-0.5 truncate text-[10px]">{file.language}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0 bg-s-base p-4">
        {selectedFile && (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-[12px] text-s-primary">{selectedFile.path}</div>
                <div className="mt-0.5 text-[11px] text-s-secondary">{selectedFile.purpose}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="secondary" size="sm" icon={<Clipboard size={13} />} onClick={onCopyFile}>
                  Copy
                </Button>
                <Token>{selectedFile.language}</Token>
              </div>
            </div>
            <pre className="max-h-[620px] overflow-auto rounded-md border border-s-border bg-[#0f172a] p-4 text-[12px] leading-relaxed text-slate-100"><code>{selectedFile.content}</code></pre>
          </>
        )}
      </div>
    </div>
  );
}

function DataApiTab({ blueprint }: { blueprint: ServiceBlueprint | null }) {
  if (!blueprint) return <EmptyState icon={<Database size={18} />} title="No data model yet" description="Generate an app to see schema, API, auth, and AI plans." />;
  return (
    <div className="p-4 space-y-4">
      <Panel title="Data model" icon={<Database size={13} className="text-s-brand" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {blueprint.dataModel.map((entity) => (
            <div key={entity.name} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="font-mono text-[12px] text-s-primary">{entity.name}</div>
              <div className="mt-1 text-[11.5px] leading-relaxed text-s-secondary">{entity.purpose}</div>
              <div className="mt-2 flex flex-wrap gap-1">{entity.fields.slice(0, 6).map((field) => <Token key={field.name}>{field.name}:{field.type}</Token>)}</div>
              <div className="mt-2 text-[11px] text-s-muted">{entity.rlsPolicy}</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="API plan" icon={<Globe2 size={13} className="text-s-brand" />}>
        <div className="space-y-1.5">
          {blueprint.apiPlan.map((endpoint) => (
            <div key={`${endpoint.method}-${endpoint.path}`} className="grid grid-cols-[72px_minmax(0,1fr)_80px] items-center gap-2 rounded-md border border-s-border bg-s-base px-3 py-2">
              <Token>{endpoint.method}</Token>
              <div className="min-w-0">
                <div className="truncate font-mono text-[12px] text-s-primary">{endpoint.path}</div>
                <div className="truncate text-[11px] text-s-secondary">{endpoint.purpose}</div>
              </div>
              <Token>{endpoint.auth}</Token>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Auth and AI" icon={<Bot size={13} className="text-s-brand" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ListBlock title={`Auth: ${blueprint.authPlan.provider}`} items={blueprint.authPlan.policies} />
          <ListBlock title={`AI: ${blueprint.aiPlan.modelRoute}`} items={[...blueprint.aiPlan.aiFeatures, ...blueprint.aiPlan.guardrails]} />
        </div>
      </Panel>
    </div>
  );
}

function DesignAiTab({ blueprint }: { blueprint: ServiceBlueprint | null }) {
  if (!blueprint) return <EmptyState icon={<Bot size={18} />} title="No design or AI plan yet" description="Generate an app to see UI/UX recipes, RAG, ML routing, and agent team workflow." />;
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Mini label="App type" value={blueprint.uiUxBlueprint.appType} />
        <Mini label="RAG" value={blueprint.ragPlan.enabled ? 'enabled' : 'off'} />
        <Mini label="ML" value={blueprint.mlPlan.enabled ? 'enabled' : 'helper'} />
        <Mini label="Agents" value={blueprint.agenticBuildPlan.operatingModel} />
      </div>

      <Panel title="UI/UX blueprint" icon={<Monitor size={13} className="text-s-brand" />}>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_.9fr] gap-3">
          <ListBlock title={blueprint.uiUxBlueprint.designBar} items={blueprint.uiUxBlueprint.visualRules} />
          <ListBlock title={blueprint.uiUxBlueprint.layoutSystem.navigation} items={[blueprint.uiUxBlueprint.layoutSystem.contentModel, ...blueprint.uiUxBlueprint.layoutSystem.responsiveRules]} />
        </div>
      </Panel>

      <Panel title="Screen recipes" icon={<Layers3 size={13} className="text-s-brand" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {blueprint.uiUxBlueprint.screenRecipes.map((recipe) => (
            <div key={recipe.screenId} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-[11px] text-s-brand">{recipe.route}</div>
                <Token>{recipe.pattern}</Token>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">{recipe.primaryComponents.slice(0, 5).map((item) => <Token key={item}>{item}</Token>)}</div>
              <div className="mt-2 text-[11.5px] leading-relaxed text-s-secondary">{recipe.loadingState}</div>
              <div className="mt-1 text-[11.5px] leading-relaxed text-s-secondary">{recipe.emptyState}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Component recipes" icon={<PackageCheck size={13} className="text-s-brand" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {blueprint.uiUxBlueprint.componentRecipes.map((component) => (
            <div key={component.name} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="text-[13px] font-medium text-s-primary">{component.name}</div>
              <div className="mt-1 text-[11.5px] leading-relaxed text-s-secondary">{component.purpose}</div>
              <div className="mt-2 flex flex-wrap gap-1">{component.states.slice(0, 5).map((state) => <Token key={state}>{state}</Token>)}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="RAG and ML architecture" icon={<Bot size={13} className="text-s-brand" />}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <ListBlock title={`RAG: ${blueprint.ragPlan.vectorStore}`} items={[...blueprint.ragPlan.useCases, ...blueprint.ragPlan.retrievalStrategy, blueprint.ragPlan.citationPolicy]} />
          <ListBlock title="Model routing and evals" items={[...blueprint.mlPlan.modelRoutes.map((route) => `${route.task}: ${route.route}`), ...blueprint.mlPlan.evaluationMetrics]} />
        </div>
      </Panel>

      <Panel title="Agentic delivery team" icon={<GitBranch size={13} className="text-s-brand" />}>
        <div className="space-y-2">
          {blueprint.agenticBuildPlan.team.map((member) => (
            <div key={member.role} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] font-medium text-s-primary">{member.role}</div>
                <Token>{member.qualityGate}</Token>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">{member.artifacts.map((artifact) => <Token key={artifact}>{artifact}</Token>)}</div>
              <div className="mt-2 text-[11.5px] leading-relaxed text-s-secondary">{member.responsibilities.join(' · ')}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function QualityTab({
  blueprint,
  isUpdating,
  onApprove,
  onLaunch,
  onActivateAgentic,
  onOpenMissionControl,
  onOpenCompanyOs,
}: {
  blueprint: ServiceBlueprint | null;
  isUpdating: boolean;
  onApprove: () => void;
  onLaunch: () => void;
  onActivateAgentic: () => void;
  onOpenMissionControl: () => void;
  onOpenCompanyOs: () => void;
}) {
  if (!blueprint) return <EmptyState icon={<TestTube2 size={18} />} title="No quality gates yet" description="Generate an app to see release proof and deployment gates." />;
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Mini label="Status" value={blueprint.status} />
        <Mini label="Approval" value={blueprint.approvalRequired ? 'required' : 'not needed'} />
        <Mini label="Lock-in risk" value={blueprint.ownership.lockInRisk} />
      </div>
      <Panel title="Quality gates" icon={<TestTube2 size={13} className="text-s-brand" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {blueprint.qualityGates.map((gate) => (
            <div key={gate.id} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 truncate text-[13px] font-medium text-s-primary">{gate.title}</div>
                <GateBadge status={gate.status} />
              </div>
              <div className="mt-2 font-mono text-[18px] text-s-primary">{gate.score}</div>
              <div className="mt-1 text-[11.5px] leading-relaxed text-s-secondary">{gate.nextAction}</div>
              <div className="mt-2 flex flex-wrap gap-1">{gate.evidence.slice(0, 4).map((item) => <Token key={item}>{item}</Token>)}</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Deployment plan" icon={<Rocket size={13} className="text-s-brand" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ListBlock title={`Target: ${blueprint.deploymentPlan.target}`} items={blueprint.deploymentPlan.commands} />
          <ListBlock title="Rollback and observability" items={[...blueprint.deploymentPlan.rollback, ...blueprint.deploymentPlan.observability]} />
        </div>
      </Panel>
      <Panel title="Agentic integration" icon={<GitBranch size={13} className="text-s-brand" />}>
        {blueprint.agenticActivation ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Mini label="Mission Control" value={blueprint.agenticActivation.missionControlRunId} />
            <Mini label="Score" value={`${blueprint.agenticActivation.score}%`} />
            <Mini label="Status" value={blueprint.agenticActivation.status} />
            <Mini label="Agentic Mesh" value={blueprint.agenticActivation.agenticMeshBlueprintId} />
            <Mini label="Release Command" value={blueprint.agenticActivation.releaseMissionId} />
            <Mini label="Browser QA" value={blueprint.agenticActivation.browserQaReportId} />
            <Mini label="Blackboard" value={blueprint.agenticActivation.blackboardId} />
            <Mini label="Trust records" value={String(blueprint.agenticActivation.trustRecordIds.length)} />
            <Mini label="Activated" value={new Date(blueprint.agenticActivation.activatedAt).toLocaleDateString()} />
          </div>
        ) : (
          <ListBlock
            title="Ready to activate Mission Control"
            items={[
              'Uses this exact Build Studio blueprint as source context',
              'Creates Agentic Mesh, Browser QA, Release Command, Blackboard, and Trust Ledger evidence',
              'Can be promoted into Company OS as the product value stream for a wider AXON operating mission',
              'Keeps generated UI/UX, RAG, ML, and agent roles attached to the launch package',
            ]}
          />
        )}
      </Panel>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          icon={isUpdating ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
          disabled={isUpdating || blueprint.status !== 'draft'}
          onClick={onApprove}
        >
          Approve plan
        </Button>
        <Button
          variant="primary"
          icon={isUpdating ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
          disabled={isUpdating || blueprint.status === 'draft' || blueprint.status === 'executing'}
          onClick={onLaunch}
        >
          Launch workflow
        </Button>
        <Button
          variant="secondary"
          icon={isUpdating ? <Loader2 size={13} className="animate-spin" /> : <GitBranch size={13} />}
          disabled={isUpdating}
          onClick={onActivateAgentic}
        >
          Activate Mission Control
        </Button>
        <Button
          variant="secondary"
          icon={<ExternalLink size={13} />}
          disabled={!blueprint.agenticActivation}
          onClick={onOpenMissionControl}
        >
          Open Mission Control
        </Button>
        <Button
          variant="secondary"
          icon={<Building2 size={13} />}
          onClick={onOpenCompanyOs}
        >
          Company OS
        </Button>
      </div>
    </div>
  );
}

function InlineNotice({ tone, message }: { tone: 'success' | 'error'; message: string }) {
  const className = tone === 'success'
    ? 'border-s-success/30 bg-s-success/10 text-s-success'
    : 'border-s-critical/30 bg-s-critical/10 text-s-critical';
  return (
    <div className={`rounded-md border px-3 py-2 text-[12px] font-medium ${className}`}>
      {message}
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

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 block">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-md border border-s-border bg-s-surface">
      <div className="flex items-center gap-2 border-b border-s-border px-3 py-2">
        {icon}
        <div className="text-[12.5px] font-medium text-s-primary">{title}</div>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-s-border bg-s-base p-3">
      <div className="mb-2 text-[12px] font-medium text-s-primary">{title}</div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2 text-[11.5px] leading-relaxed text-s-secondary">
            <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-s-success" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-s-border bg-s-base p-3 min-w-0">
      <div className="label-mono mb-1 truncate">{label}</div>
      <div className="truncate font-mono text-[16px] text-s-primary">{value}</div>
    </div>
  );
}

function IconButton({ active, label, children, onClick }: { active: boolean; label: string; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${active ? 'border-s-brand/40 bg-s-brand/10 text-s-brand' : 'border-s-border bg-s-surface text-s-secondary hover:text-s-primary'}`}
    >
      {children}
    </button>
  );
}

function GateBadge({ status }: { status: ServiceBlueprint['qualityGates'][number]['status'] }) {
  const tone = status === 'pass' ? 'border-s-success/30 bg-s-success/10 text-s-success' : status === 'block' ? 'border-s-critical/30 bg-s-critical/10 text-s-critical' : 'border-s-warning/30 bg-s-warning/10 text-s-warning';
  return <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase ${tone}`}>{status}</span>;
}

function Token({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[10px] font-mono text-s-muted">
      {children}
    </span>
  );
}

function TargetIcon() {
  return <PackageCheck size={13} className="text-s-brand" />;
}

function parseList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseOptionalPositiveNumber(value: string, label: string, integer = false): { value?: number; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) return {};
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return { error: `${label} must be a positive number.` };
  if (integer && !Number.isInteger(parsed)) return { error: `${label} must be a whole number.` };
  return { value: parsed };
}

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function localPromptScore(prompt: string, chips: AppFeatureChip[]) {
  return Math.min(100, Math.max(20, Math.floor(prompt.trim().length / 4) + chips.length * 4));
}

function buildPreviewHtml(blueprint: ServiceBlueprint | null, prompt: string, chips: AppFeatureChip[]) {
  const productName = blueprint?.templateName ?? inferProductName(prompt);
  const appMap = blueprint?.appMap ?? [
    { route: '/', name: 'Dashboard', purpose: 'Product overview and primary workflow', primaryActions: ['Create item', 'Review status'], dataNeeded: ['items'] },
    { route: '/work', name: 'Work queue', purpose: 'Track app records', primaryActions: ['Assign', 'Resolve'], dataNeeded: ['work_items'] },
    { route: '/reports', name: 'Reports', purpose: 'Review outcomes', primaryActions: ['Export'], dataNeeded: ['metrics'] },
  ];
  const gates = blueprint?.qualityGates ?? [
    { id: 'prompt', title: 'Prompt quality', status: 'warn' as const, score: localPromptScore(prompt, chips), evidence: chips, nextAction: 'Generate blueprint' },
    { id: 'code', title: 'Code package', status: 'warn' as const, score: 0, evidence: [], nextAction: 'Generate blueprint' },
  ];
  const palette = normalizePalette(blueprint?.designSystem.palette);
  const promptCopy = blueprint?.builder.enhancedPrompt ?? (prompt || 'Describe the app to generate a complete product system.');
  const metrics: Array<[string, string]> = [
    ['Screens', String(blueprint?.screens.length ?? appMap.length)],
    ['Files', String(blueprint?.generatedFiles.length ?? 0)],
    ['Gates', `${gates.filter((gate) => gate.status === 'pass').length}/${gates.length}`],
    ['Deploy', blueprint?.deploymentPlan.target ?? 'draft'],
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(productName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f8fb; color: #111827; }
    .shell { min-height: 100vh; display: grid; grid-template-columns: 240px 1fr; }
    aside { background: ${palette[0]}; color: white; padding: 22px 16px; }
    .brand { font-size: 18px; font-weight: 760; letter-spacing: 0; }
    .hint { margin-top: 6px; color: #aab5c8; font-size: 12px; line-height: 1.45; }
    nav { margin-top: 26px; display: grid; gap: 7px; }
    nav div { border-radius: 8px; padding: 10px 12px; color: #c9d2e3; font-size: 13px; }
    nav div:first-child { background: rgba(255,255,255,.13); color: #fff; }
    main { padding: 26px; min-width: 0; }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    h1 { margin: 0; font-size: clamp(26px, 4vw, 40px); line-height: 1.04; letter-spacing: 0; }
    .prompt { margin-top: 10px; max-width: 760px; color: #5d6677; font-size: 14px; line-height: 1.6; }
    .button { border: 0; border-radius: 8px; padding: 11px 14px; background: ${palette[1]}; color: white; font-weight: 700; white-space: nowrap; }
    .metrics { margin-top: 22px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .metric { background: white; border: 1px solid #e5e8ef; border-radius: 8px; padding: 14px; min-width: 0; }
    .metric span { color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    .metric strong { display: block; margin-top: 5px; font-size: 24px; }
    .grid { margin-top: 18px; display: grid; grid-template-columns: 1.2fr .8fr; gap: 16px; align-items: start; }
    .panel { background: white; border: 1px solid #e5e8ef; border-radius: 8px; overflow: hidden; }
    .panel h2 { margin: 0; padding: 16px 16px 0; font-size: 15px; }
    .routes { padding: 16px; display: grid; gap: 10px; }
    .route { border: 1px solid #e8ebf2; background: #fbfcff; border-radius: 8px; padding: 13px; }
    .route strong { display: block; font-size: 13px; }
    .route p { margin: 6px 0 0; color: #647084; font-size: 12px; line-height: 1.45; }
    .chips { margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap; }
    .chip { border-radius: 999px; background: #eef6ff; color: ${palette[1]}; padding: 4px 8px; font-size: 11px; font-weight: 700; }
    .gate { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 12px 16px; border-bottom: 1px solid #edf0f5; font-size: 13px; }
    .gate:last-child { border-bottom: 0; }
    .pass { color: ${palette[2]}; font-weight: 800; }
    .warn { color: ${palette[3]}; font-weight: 800; }
    .block { color: #dc2626; font-weight: 800; }
    @media (max-width: 760px) { .shell { grid-template-columns: 1fr; } aside { display: none; } main { padding: 18px; } header { flex-direction: column; } .metrics { grid-template-columns: repeat(2, 1fr); } .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="shell">
    <aside>
      <div class="brand">${escapeHtml(productName)}</div>
      <div class="hint">${escapeHtml(blueprint?.customerName ?? 'Draft workspace')}</div>
      <nav>${appMap.map((route) => `<div>${escapeHtml(route.name)}</div>`).join('')}</nav>
    </aside>
    <main>
      <header>
        <div>
          <h1>${escapeHtml(productName)}</h1>
          <div class="prompt">${escapeHtml(promptCopy)}</div>
          <div class="chips">${(blueprint?.builder.featureChips ?? chips).slice(0, 8).map((chip) => `<span class="chip">${escapeHtml(chip)}</span>`).join('')}</div>
        </div>
        <button class="button">Create record</button>
      </header>
      <section class="metrics">${metrics.map(([label, value]) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</section>
      <section class="grid">
        <div class="panel">
          <h2>Application map</h2>
          <div class="routes">${appMap.map((route) => `<div class="route"><strong>${escapeHtml(route.route)} · ${escapeHtml(route.name)}</strong><p>${escapeHtml(route.purpose)}</p><div class="chips">${route.primaryActions.slice(0, 3).map((action) => `<span class="chip">${escapeHtml(action)}</span>`).join('')}</div></div>`).join('')}</div>
        </div>
        <div class="panel">
          <h2>Quality gates</h2>
          ${gates.map((gate) => `<div class="gate"><span>${escapeHtml(gate.title)}</span><span class="${gate.status}">${gate.score}</span></div>`).join('')}
        </div>
      </section>
    </main>
  </div>
</body>
</html>`;
}

function normalizePalette(palette?: string[]) {
  const fallback = ['#111827', '#2563EB', '#10B981', '#F59E0B', '#F8FAFC'];
  return fallback.map((color, index) => palette?.[index] ?? color);
}

function inferProductName(prompt: string) {
  const clean = prompt.replace(/^build\s+(a|an|the)?\s*/i, '').replace(/\b(app|tool|platform|saas|mvp)\b/gi, '').trim();
  const words = clean.split(/\s+/).filter(Boolean).slice(0, 4).join(' ');
  return words ? titleCase(words.replace(/[.,;:]+$/g, '')) : 'Generated Product';
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
