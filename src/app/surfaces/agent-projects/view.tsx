import { useMemo, useState } from 'react';
import {
  CalendarClock,
  GitBranch,
  Loader2,
  Network,
  Play,
  ShieldCheck,
} from 'lucide-react';
import { Button, Card, CardHeader, Kpi, PageHeader } from '../../components/ui/primitives';
import {
  AutonomyPanel,
  ExecutionFabricPanel,
  OperationsPanel,
  ProjectPanel,
  ReadinessEvidencePanel,
  RunPanel,
  RunPlanner,
  SchedulePanel,
  SelectField,
} from './panels';
import {
  useAgentProjectDeliveryJobs,
  useAgentProjectDeliveryJobEvents,
  useAgentProjectExecutionFabricJobs,
  useAgentProjectExecutionFabricJobEvents,
  useAgentProjectExecutionFabricPlans,
  useAgentProjectExecutions,
  useAgentProjectRuns,
  useAgentProjectSdkManifest,
  useAgentProjectSchedules,
  useAgentProjectTemplates,
  useAgentProjectWorkerStatus,
  useAgentProjectWorkspacePlans,
  useAgentProjects,
  useCreateAgentProject,
  useCreateAgentProjectDeliveryPack,
  useCreateAgentProjectExecutionFabricPlan,
  useCreateAgentProjectFromTemplate,
  useCreateAgentProjectRun,
  useCreateAgentProjectRunRecap,
  useCreateAgentProjectSchedule,
  useCreateAgentProjectRuntimeProfile,
  useCreateAgentProjectPullRequestPackage,
  useDispatchAgentProjectSchedules,
  useHeartbeatAgentProjectDeliveryJob,
  useHeartbeatAgentProjectExecutionFabricJob,
  useLaunchAgentProjectExecution,
  usePrepareAgentProjectWorkspacePlan,
  useQueueAgentProjectDeliveryJob,
  useRunAgentProjectDeliveryJob,
  useCancelAgentProjectDeliveryJob,
  useRetryAgentProjectDeliveryJob,
  useRunAgentProjectExecutionFabricJob,
  useRunAgentProjectHooks,
  useCreateAgentProjectBrowserEvidence,
  useRunAgentProjectExecutionCommand,
  useStartAgentProjectWorker,
  useStopAgentProjectWorker,
  useTickAgentProjectWorker,
  type AgentProjectAutonomyLevel,
  type AgentProjectDeliveryPack,
  type AgentProjectDeploymentProvider,
  type AgentProjectDispatchReport,
  type AgentProjectExecutionFabricJob,
  type AgentProjectExecutionFabricPlan,
  type AgentProjectExecutionProvider,
  type AgentProjectHookRun,
  type AgentProjectPullRequestPackage,
  type AgentProjectRun,
  type AgentProjectRunRecap,
  type AgentProjectRuntimeProfile,
  type AgentProjectSecurityPreset,
  type AgentProjectTargetEnvironment,
  type AgentProjectWorktreeMode,
} from '../../lib/queries';

export function AgentProjects() {
  const projects = useAgentProjects();
  const runs = useAgentProjectRuns();
  const schedules = useAgentProjectSchedules();
  const templates = useAgentProjectTemplates();
  const workspacePlans = useAgentProjectWorkspacePlans();
  const executions = useAgentProjectExecutions();
  const deliveryJobs = useAgentProjectDeliveryJobs();
  const executionFabricPlans = useAgentProjectExecutionFabricPlans();
  const executionFabricJobs = useAgentProjectExecutionFabricJobs();
  const workerStatus = useAgentProjectWorkerStatus();
  const sdkManifest = useAgentProjectSdkManifest();
  const createProject = useCreateAgentProject();
  const createFromTemplate = useCreateAgentProjectFromTemplate();
  const createRun = useCreateAgentProjectRun();
  const createSchedule = useCreateAgentProjectSchedule();
  const createRuntimeProfile = useCreateAgentProjectRuntimeProfile();
  const createPrPackage = useCreateAgentProjectPullRequestPackage();
  const createExecutionFabricPlan = useCreateAgentProjectExecutionFabricPlan();
  const runExecutionFabricJob = useRunAgentProjectExecutionFabricJob();
  const prepareWorkspace = usePrepareAgentProjectWorkspacePlan();
  const launchExecution = useLaunchAgentProjectExecution();
  const queueDeliveryJob = useQueueAgentProjectDeliveryJob();
  const runDeliveryJob = useRunAgentProjectDeliveryJob();
  const cancelDeliveryJob = useCancelAgentProjectDeliveryJob();
  const retryDeliveryJob = useRetryAgentProjectDeliveryJob();
  const heartbeatDeliveryJob = useHeartbeatAgentProjectDeliveryJob();
  const heartbeatExecutionFabricJob = useHeartbeatAgentProjectExecutionFabricJob();
  const runHooks = useRunAgentProjectHooks();
  const dispatchSchedules = useDispatchAgentProjectSchedules();
  const runExecutionCommand = useRunAgentProjectExecutionCommand();
  const createBrowserEvidence = useCreateAgentProjectBrowserEvidence();
  const tickWorker = useTickAgentProjectWorker();
  const startWorker = useStartAgentProjectWorker();
  const stopWorker = useStopAgentProjectWorker();
  const createRecap = useCreateAgentProjectRunRecap();
  const createDeliveryPack = useCreateAgentProjectDeliveryPack();
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [foldersText, setFoldersText] = useState('.\nbackend\nsrc\ndocs');
  const [securityPreset, setSecurityPreset] = useState<AgentProjectSecurityPreset>('default');
  const [worktreeMode, setWorktreeMode] = useState<AgentProjectWorktreeMode>('new-worktree');
  const [prompt, setPrompt] = useState('');
  const [schedule, setSchedule] = useState('');
  const [voiceMode, setVoiceMode] = useState(false);
  const [createSandbox, setCreateSandbox] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [autonomyLevel, setAutonomyLevel] = useState<AgentProjectAutonomyLevel>('supervised');
  const [fabricProvider, setFabricProvider] = useState<AgentProjectExecutionProvider>('local-process');
  const [fabricDeploy, setFabricDeploy] = useState<AgentProjectDeploymentProvider>('none');
  const [fabricEnvironment, setFabricEnvironment] = useState<AgentProjectTargetEnvironment>('preview');
  const [fabricBudget, setFabricBudget] = useState('20');
  const [dispatchReport, setDispatchReport] = useState<AgentProjectDispatchReport | null>(null);
  const [latestRecap, setLatestRecap] = useState<AgentProjectRunRecap | null>(null);
  const [latestPack, setLatestPack] = useState<AgentProjectDeliveryPack | null>(null);
  const [latestRuntimeProfile, setLatestRuntimeProfile] = useState<AgentProjectRuntimeProfile | null>(null);
  const [latestHookRun, setLatestHookRun] = useState<AgentProjectHookRun | null>(null);
  const [latestPrPackage, setLatestPrPackage] = useState<AgentProjectPullRequestPackage | null>(null);
  const [latestFabricPlan, setLatestFabricPlan] = useState<AgentProjectExecutionFabricPlan | null>(null);
  const [latestFabricJob, setLatestFabricJob] = useState<AgentProjectExecutionFabricJob | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<AgentProjectRun | null>(null);

  const currentProject = useMemo(() => {
    const list = projects.data?.projects ?? [];
    return list.find((project) => project.id === selectedProjectId) ?? list[0] ?? null;
  }, [projects.data?.projects, selectedProjectId]);
  const currentRun = selectedRun ?? runs.data?.runs[0] ?? null;
  const currentWorkspacePlan = workspacePlans.data?.workspacePlans.find((plan) => plan.runId === currentRun?.id) ?? workspacePlans.data?.workspacePlans[0] ?? null;
  const currentExecution = executions.data?.executions.find((execution) => execution.runId === currentRun?.id) ?? executions.data?.executions[0] ?? null;
  const currentJob = deliveryJobs.data?.jobs.find((job) => job.runId === currentRun?.id) ?? deliveryJobs.data?.jobs[0] ?? null;
  const currentFabricPlan = latestFabricPlan ?? executionFabricPlans.data?.plans.find((plan) => plan.runId === currentRun?.id) ?? executionFabricPlans.data?.plans[0] ?? null;
  const currentFabricJob = latestFabricJob ?? executionFabricJobs.data?.jobs.find((job) => job.planId === currentFabricPlan?.id) ?? executionFabricJobs.data?.jobs[0] ?? null;
  const deliveryJobEvents = useAgentProjectDeliveryJobEvents(currentJob?.id);
  const fabricJobEvents = useAgentProjectExecutionFabricJobEvents(currentFabricJob?.id);
  const busy = createProject.isPending || createFromTemplate.isPending || createRun.isPending || createSchedule.isPending || createRuntimeProfile.isPending || createPrPackage.isPending || createExecutionFabricPlan.isPending || runExecutionFabricJob.isPending || runHooks.isPending || prepareWorkspace.isPending || launchExecution.isPending || queueDeliveryJob.isPending || runDeliveryJob.isPending || cancelDeliveryJob.isPending || retryDeliveryJob.isPending || heartbeatDeliveryJob.isPending || heartbeatExecutionFabricJob.isPending || dispatchSchedules.isPending || runExecutionCommand.isPending || createBrowserEvidence.isPending || tickWorker.isPending || startWorker.isPending || stopWorker.isPending || createRecap.isPending || createDeliveryPack.isPending;

  const saveProject = async () => {
    const project = await createProject.mutateAsync({
      name,
      objective,
      securityPreset,
      worktreeMode,
      reviewPolicy: 'request-review',
      folders: foldersText
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((path) => ({
          path,
          type: path === '.' ? 'git-checkout' as const : 'local-folder' as const,
          writable: !path.startsWith('legacy'),
          reason: path === '.' ? 'Canonical root project.' : `Scoped AXON folder ${path}.`,
        })),
    });
    setSelectedProjectId(project.id);
  };

  const planRun = async () => {
    const project = currentProject ?? await createProject.mutateAsync({
      name,
      objective,
      securityPreset,
      worktreeMode,
      reviewPolicy: 'request-review',
    });
    const run = await createRun.mutateAsync({
      projectId: project.id,
      prompt,
      mode: 'planning',
      voiceTranscript: voiceMode ? prompt : undefined,
    });
    setSelectedProjectId(project.id);
    setSelectedRun(run);
    return run;
  };

  const scheduleRun = async () => {
    const project = currentProject ?? await createProject.mutateAsync({
      name,
      objective,
      securityPreset,
      worktreeMode,
      reviewPolicy: 'request-review',
    });
    await createSchedule.mutateAsync({ projectId: project.id, instruction: prompt, schedule });
    setSelectedProjectId(project.id);
  };

  const prepareWorkspacePlan = async () => {
    const run = currentRun ?? await planRun();
    await prepareWorkspace.mutateAsync(run.id);
  };

  const launchCurrentRun = async () => {
    const run = currentRun ?? await planRun();
    const execution = await launchExecution.mutateAsync({
      runId: run.id,
      autonomyLevel,
      createSandbox,
      requireHumanApproval: autonomyLevel === 'manual' || autonomyLevel === 'production-autopilot',
    });
    setSelectedRun({ ...run, status: execution.status === 'blocked' ? 'review-required' : 'executing' });
  };

  const dispatchDueSchedules = async () => {
    const report = await dispatchSchedules.mutateAsync({
      now: new Date().toISOString(),
      launch: true,
      createSandbox,
      autonomyLevel,
      limit: 10,
    });
    setDispatchReport(report);
  };

  const runFirstWorkspaceCommand = async () => {
    if (!currentExecution) return;
    await runExecutionCommand.mutateAsync({
      executionId: currentExecution.id,
      commandIndex: 0,
      approved: false,
      timeoutMs: 60000,
    });
  };

  const attachBrowserEvidence = async () => {
    if (!currentExecution) return;
    await createBrowserEvidence.mutateAsync({
      executionId: currentExecution.id,
      targetUrl: previewUrl.trim() || undefined,
    });
  };

  const createTemplateProject = async (templateId: string) => {
    const project = await createFromTemplate.mutateAsync({ templateId });
    setSelectedProjectId(project.id);
    setName(project.name);
    setObjective(project.objective);
  };

  const tickScheduleWorker = async () => {
    const report = await tickWorker.mutateAsync({
      now: new Date().toISOString(),
      launch: true,
      createSandbox,
      autonomyLevel,
      limit: 10,
    });
    setDispatchReport(report);
  };

  const generateRecap = async () => {
    if (!currentRun) return;
    setLatestRecap(await createRecap.mutateAsync(currentRun.id));
  };

  const generateDeliveryPack = async () => {
    if (!currentExecution) return;
    setLatestPack(await createDeliveryPack.mutateAsync(currentExecution.id));
  };

  const queueCurrentDeliveryJob = async () => {
    const run = currentRun ?? await planRun();
    await queueDeliveryJob.mutateAsync({
      runId: run.id,
      autonomyLevel,
      createSandbox,
      executeApprovedCommands: false,
      requireBrowserEvidence: true,
      previewUrl: previewUrl.trim() || undefined,
    });
  };

  const runCurrentDeliveryJob = async () => {
    const job = currentJob ?? (currentRun ? await queueDeliveryJob.mutateAsync({
      runId: currentRun.id,
      autonomyLevel,
      createSandbox,
      executeApprovedCommands: false,
      requireBrowserEvidence: true,
      previewUrl: previewUrl.trim() || undefined,
    }) : null);
    if (!job) return;
    await runDeliveryJob.mutateAsync(job.id);
  };

  const heartbeatCurrentDeliveryJob = async () => {
    if (!currentJob) return;
    await heartbeatDeliveryJob.mutateAsync({
      jobId: currentJob.id,
      leaseOwner: 'WebOperator',
      progress: currentJob.control.progress,
      stageId: currentJob.stages.find((stage) => stage.status === 'running')?.id ?? 'operator-heartbeat',
      message: 'Operator heartbeat from AXON web console.',
    });
  };

  const generateRuntimeProfile = async () => {
    const project = currentProject ?? await createProject.mutateAsync({
      name,
      objective,
      securityPreset,
      worktreeMode,
      reviewPolicy: 'request-review',
    });
    setLatestRuntimeProfile(await createRuntimeProfile.mutateAsync({
      projectId: project.id,
      runId: currentRun?.id,
    }));
  };

  const runLoopStopHooks = async () => {
    if (!currentProject) return;
    setLatestHookRun(await runHooks.mutateAsync({
      projectId: currentProject.id,
      runId: currentRun?.id,
      event: 'loop-stop',
      approved: true,
      payload: { previewUrl, command: currentRun?.command },
    }));
  };

  const generatePrPackage = async () => {
    const run = currentRun ?? await planRun();
    setLatestPrPackage(await createPrPackage.mutateAsync({
      runId: run.id,
      executionId: currentExecution?.id,
    }));
  };

  const generateFabricPlan = async () => {
    const run = currentRun ?? await planRun();
    const plan = await createExecutionFabricPlan.mutateAsync({
      runId: run.id,
      executionId: currentExecution?.id,
      provider: fabricProvider,
      deploymentProvider: fabricDeploy,
      targetEnvironment: fabricEnvironment,
      maxCostUsd: Number(fabricBudget) || 20,
      requirePullRequest: fabricEnvironment !== 'preview',
      requireDeployment: fabricDeploy !== 'none',
      allowNetwork: fabricDeploy !== 'none' || fabricProvider !== 'local-process',
    });
    setLatestFabricPlan(plan);
  };

  const runFabricDryRun = async () => {
    const plan = currentFabricPlan ?? await createExecutionFabricPlan.mutateAsync({
      runId: (currentRun ?? await planRun()).id,
      executionId: currentExecution?.id,
      provider: fabricProvider,
      deploymentProvider: fabricDeploy,
      targetEnvironment: fabricEnvironment,
      maxCostUsd: Number(fabricBudget) || 20,
      requirePullRequest: fabricEnvironment !== 'preview',
      requireDeployment: fabricDeploy !== 'none',
      allowNetwork: fabricDeploy !== 'none' || fabricProvider !== 'local-process',
    });
    setLatestFabricPlan(plan);
    setLatestFabricJob(await runExecutionFabricJob.mutateAsync({
      planId: plan.id,
      dryRun: true,
      approved: false,
    }));
  };

  const heartbeatCurrentFabricJob = async () => {
    if (!currentFabricJob) return;
    await heartbeatExecutionFabricJob.mutateAsync({
      jobId: currentFabricJob.id,
      leaseOwner: 'WebOperator',
      progress: currentFabricJob.control.progress,
      stageId: currentFabricJob.stages.find((stage) => stage.status === 'running')?.id ?? 'operator-heartbeat',
      message: 'Execution fabric heartbeat from AXON web console.',
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Agent Projects"
        description="Project-scoped command center for dynamic subagents, schedules, slash commands, hooks, and artifact review"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<CalendarClock size={13} />} onClick={scheduleRun} disabled={busy || prompt.trim().length < 3 || schedule.trim().length < 3}>
              Schedule
            </Button>
            <Button variant="secondary" size="sm" icon={<GitBranch size={13} />} onClick={prepareWorkspacePlan} disabled={busy || prompt.trim().length < 3}>
              Workspace
            </Button>
            <Button variant="primary" size="sm" icon={busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} onClick={planRun} disabled={busy || prompt.trim().length < 3}>
              Plan run
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Projects" value={String(projects.data?.projects.length ?? 0)} hint="Scoped workspaces" />
        <Kpi label="Runs" value={String(runs.data?.runs.length ?? 0)} hint="Agent conversations" />
        <Kpi label="Schedules" value={String(schedules.data?.schedules.length ?? 0)} hint="Autonomous timers" />
        <Kpi label="Readiness" value={currentProject ? `${currentProject.readiness.score}%` : '--'} hint={currentProject?.readiness.status ?? 'No project'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[440px_minmax(0,1fr)] gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="Project scope" subtitle="Folders, permissions, worktree mode, and review policy" action={<Network size={14} className="text-s-brand" />} />
          <div className="p-4 space-y-4">
            <label className="block">
              <span className="label-mono mb-1.5 block">Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Project name tied to a real repository or customer delivery" className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand" />
            </label>
            <label className="block">
              <span className="label-mono mb-1.5 block">Objective</span>
              <textarea value={objective} onChange={(event) => setObjective(event.target.value)} rows={5} placeholder="Describe the real product outcome, repo scope, permissions, quality gates, and release expectation." className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand" />
            </label>
            <label className="block">
              <span className="label-mono mb-1.5 block">Folders</span>
              <textarea value={foldersText} onChange={(event) => setFoldersText(event.target.value)} rows={4} className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 font-mono text-[12px] leading-relaxed text-s-primary outline-none focus:border-s-brand" />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField label="Security" value={securityPreset} onChange={(value) => setSecurityPreset(value as AgentProjectSecurityPreset)} options={['restricted', 'default', 'full-machine', 'unrestricted']} />
              <SelectField label="Worktree" value={worktreeMode} onChange={(value) => setWorktreeMode(value as AgentProjectWorktreeMode)} options={['new-worktree', 'local']} />
            </div>
            <Button variant="secondary" icon={<ShieldCheck size={13} />} onClick={saveProject} disabled={busy || name.trim().length < 2} className="w-full justify-center">
              Save project
            </Button>
          </div>
        </Card>

        <RunPlanner
          prompt={prompt}
          setPrompt={setPrompt}
          voiceMode={voiceMode}
          setVoiceMode={setVoiceMode}
          schedule={schedule}
          setSchedule={setSchedule}
          busy={busy}
          onPlan={planRun}
          onSchedule={scheduleRun}
        />
      </div>

      <AutonomyPanel
        run={currentRun}
        workspacePlan={currentWorkspacePlan}
        execution={currentExecution}
        dispatchReport={dispatchReport}
        autonomyLevel={autonomyLevel}
        setAutonomyLevel={setAutonomyLevel}
        createSandbox={createSandbox}
        setCreateSandbox={setCreateSandbox}
        previewUrl={previewUrl}
        setPreviewUrl={setPreviewUrl}
        busy={busy}
        onPrepare={prepareWorkspacePlan}
        onLaunch={launchCurrentRun}
        onDispatch={dispatchDueSchedules}
        onRunCommand={runFirstWorkspaceCommand}
        onBrowserEvidence={attachBrowserEvidence}
      />

      <ExecutionFabricPanel
        plan={currentFabricPlan}
        job={currentFabricJob}
        eventTail={fabricJobEvents.data ?? null}
        provider={fabricProvider}
        setProvider={setFabricProvider}
        deploymentProvider={fabricDeploy}
        setDeploymentProvider={setFabricDeploy}
        targetEnvironment={fabricEnvironment}
        setTargetEnvironment={setFabricEnvironment}
        budget={fabricBudget}
        setBudget={setFabricBudget}
        busy={busy}
        hasRun={Boolean(currentRun)}
        onPlan={generateFabricPlan}
        onDryRun={runFabricDryRun}
        onHeartbeat={heartbeatCurrentFabricJob}
      />

      <OperationsPanel
        templates={templates.data?.templates ?? []}
        worker={workerStatus.data ?? null}
        sdkManifest={sdkManifest.data ?? null}
        job={currentJob}
        jobEventTail={deliveryJobEvents.data ?? null}
        latestRecap={latestRecap}
        latestPack={latestPack}
        latestRuntimeProfile={latestRuntimeProfile}
        latestHookRun={latestHookRun}
        latestPrPackage={latestPrPackage}
        latestFabricPlan={latestFabricPlan}
        latestFabricJob={latestFabricJob}
        busy={busy}
        hasProject={Boolean(currentProject)}
        hasRun={Boolean(currentRun)}
        hasExecution={Boolean(currentExecution)}
        onTemplate={createTemplateProject}
        onTickWorker={tickScheduleWorker}
        onStartWorker={() => startWorker.mutate({ intervalMs: 60000 })}
        onStopWorker={() => stopWorker.mutate()}
        onQueueJob={queueCurrentDeliveryJob}
        onRunJob={runCurrentDeliveryJob}
        onHeartbeatJob={heartbeatCurrentDeliveryJob}
        onCancelJob={() => currentJob && cancelDeliveryJob.mutate(currentJob.id)}
        onRetryJob={() => currentJob && retryDeliveryJob.mutate(currentJob.id)}
        onRuntimeProfile={generateRuntimeProfile}
        onRunHooks={runLoopStopHooks}
        onPrPackage={generatePrPackage}
        onRecap={generateRecap}
        onDeliveryPack={generateDeliveryPack}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
        <ProjectPanel project={currentProject} />
        <SchedulePanel schedules={schedules.data?.schedules ?? []} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
        <RunPanel run={currentRun} />
        <ReadinessEvidencePanel project={currentProject} job={currentJob} fabricJob={currentFabricJob} />
      </div>
    </div>
  );
}
