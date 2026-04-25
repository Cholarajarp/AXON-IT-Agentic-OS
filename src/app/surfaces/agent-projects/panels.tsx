import type { ReactNode } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  GitBranch,
  Loader2,
  Mic,
  Network,
  Play,
  ShieldCheck,
  Sparkles,
  Video,
} from 'lucide-react';
import { Button, Card, CardHeader, EmptyState, SeverityBadge } from '../../components/ui/primitives';
import type {
  AgentProject,
  AgentProjectAutonomyLevel,
  AgentProjectDeliveryJob,
  AgentProjectDeliveryPack,
  AgentProjectDeploymentProvider,
  AgentProjectDispatchReport,
  AgentProjectExecution,
  AgentProjectExecutionFabricJob,
  AgentProjectExecutionFabricPlan,
  AgentProjectExecutionProvider,
  AgentProjectHookRun,
  AgentProjectOperationEventTail,
  AgentProjectPullRequestPackage,
  AgentProjectRun,
  AgentProjectRunRecap,
  AgentProjectRuntimeProfile,
  AgentProjectSdkManifest,
  AgentProjectTargetEnvironment,
  AgentProjectTemplate,
  AgentProjectWorkspacePlan,
  AgentProjectWorkerStatus,
} from '../../lib/queries';
export function RunPlanner({
  prompt,
  setPrompt,
  voiceMode,
  setVoiceMode,
  schedule,
  setSchedule,
  busy,
  onPlan,
  onSchedule,
}: {
  prompt: string;
  setPrompt: (value: string) => void;
  voiceMode: boolean;
  setVoiceMode: (value: boolean) => void;
  schedule: string;
  setSchedule: (value: string) => void;
  busy: boolean;
  onPlan: () => void;
  onSchedule: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Slash-command run" subtitle="/goal, /grill-me, /schedule, /browser" action={<Sparkles size={14} className="text-s-brand" />} />
      <div className="p-4 space-y-4">
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={8} placeholder="/goal describe the real outcome, files, acceptance criteria, browser proof, tests, and release target" className="w-full resize-none rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] leading-relaxed text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_180px] gap-3">
          <label className="block">
            <span className="label-mono mb-1.5 block">Schedule</span>
            <input value={schedule} onChange={(event) => setSchedule(event.target.value)} placeholder="daily 09:00 or weekly monday 10:00" className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand" />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-md border border-s-border bg-s-base px-3 py-2 mt-5 lg:mt-[22px]">
            <span className="flex items-center gap-2 text-[12.5px] text-s-primary"><Mic size={13} /> Voice cleanup</span>
            <input type="checkbox" checked={voiceMode} onChange={(event) => setVoiceMode(event.target.checked)} className="h-4 w-4 accent-s-brand" />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button variant="secondary" icon={<CalendarClock size={13} />} onClick={onSchedule} disabled={busy || prompt.trim().length < 3 || schedule.trim().length < 3}>
            Create schedule
          </Button>
          <Button variant="primary" icon={busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} onClick={onPlan} disabled={busy || prompt.trim().length < 3}>
            Plan now
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['/goal run until finished', '/grill-me ask alignment questions', '/schedule recurring autonomy', '/browser force browser evidence'].map((item) => <Token key={item}>{item}</Token>)}
        </div>
      </div>
    </Card>
  );
}

export function AutonomyPanel({
  run,
  workspacePlan,
  execution,
  dispatchReport,
  autonomyLevel,
  setAutonomyLevel,
  createSandbox,
  setCreateSandbox,
  previewUrl,
  setPreviewUrl,
  busy,
  onPrepare,
  onLaunch,
  onDispatch,
  onRunCommand,
  onBrowserEvidence,
}: {
  run: AgentProjectRun | null;
  workspacePlan: AgentProjectWorkspacePlan | null;
  execution: AgentProjectExecution | null;
  dispatchReport: AgentProjectDispatchReport | null;
  autonomyLevel: AgentProjectAutonomyLevel;
  setAutonomyLevel: (value: AgentProjectAutonomyLevel) => void;
  createSandbox: boolean;
  setCreateSandbox: (value: boolean) => void;
  previewUrl: string;
  setPreviewUrl: (value: string) => void;
  busy: boolean;
  onPrepare: () => void;
  onLaunch: () => void;
  onDispatch: () => void;
  onRunCommand: () => void;
  onBrowserEvidence: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Autonomy runtime" subtitle="Dispatch schedules, prepare worktrees, launch execution envelopes, and keep the proof trail visible" action={<ShieldCheck size={14} className="text-s-success" />} />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-3">
          <SelectField label="Autonomy" value={autonomyLevel} onChange={(value) => setAutonomyLevel(value as AgentProjectAutonomyLevel)} options={['manual', 'supervised', 'autonomous', 'production-autopilot']} />
          <label className="flex items-center justify-between gap-3 rounded-md border border-s-border bg-s-base px-3 py-2 mt-5 lg:mt-[22px]">
            <span className="text-[12.5px] text-s-primary">Create local sandbox session</span>
            <input type="checkbox" checked={createSandbox} onChange={(event) => setCreateSandbox(event.target.checked)} className="h-4 w-4 accent-s-brand" />
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Button variant="secondary" icon={<GitBranch size={13} />} onClick={onPrepare} disabled={busy || !run}>
            Prepare workspace
          </Button>
          <Button variant="secondary" icon={<CalendarClock size={13} />} onClick={onDispatch} disabled={busy}>
            Dispatch due
          </Button>
          <Button variant="primary" icon={busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} onClick={onLaunch} disabled={busy || !run}>
            Launch envelope
          </Button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_170px_190px] gap-2">
          <label className="block">
            <span className="label-mono mb-1.5 block">Preview URL</span>
            <input value={previewUrl} onChange={(event) => setPreviewUrl(event.target.value)} placeholder="https://preview.customer-domain.com" className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none placeholder:text-s-muted focus:border-s-brand" />
          </label>
          <Button variant="secondary" icon={<Play size={13} />} onClick={onRunCommand} disabled={busy || !execution} className="mt-5 lg:mt-[22px]">
            Run safe command
          </Button>
          <Button variant="secondary" icon={<Video size={13} />} onClick={onBrowserEvidence} disabled={busy || !execution} className="mt-5 lg:mt-[22px]">
            Browser evidence
          </Button>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <Metric label="Run status" value={run?.status ?? 'no run'} />
          <Metric label="Workspace" value={workspacePlan?.worktreePath ?? 'not prepared'} />
          <Metric label="Execution" value={execution ? `${execution.status}/${execution.autonomyLevel}` : 'not launched'} />
        </div>
        {workspacePlan && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <MiniList title="Workspace commands" items={workspacePlan.commands.map((item) => `${item.requiresApproval ? 'approval ' : ''}${item.label}: ${item.command}`)} icon={<GitBranch size={12} className="text-s-info" />} />
            <MiniList title="File claims" items={workspacePlan.fileClaims.map((claim) => `${claim.ownerAgent}: ${claim.path}`)} icon={<Network size={12} className="text-s-brand" />} />
          </div>
        )}
        {execution && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <MiniList title="Execution gates" items={execution.gates.map((gate) => `${gate.status}: ${gate.title}`)} icon={<ShieldCheck size={12} className="text-s-success" />} />
            <MiniList title="Execution evidence" items={[...execution.evidence, execution.browserQaReportId ? `browser QA ${execution.browserQaReportId}` : 'browser QA not attached']} icon={<CheckCircle2 size={12} className="text-s-success" />} />
          </div>
        )}
        {execution?.commandRuns.length ? (
          <MiniList title="Command runs" items={execution.commandRuns.map((item) => `${item.status}: ${item.label} (${item.durationMs}ms)`)} icon={<Play size={12} className="text-s-info" />} />
        ) : null}
        {dispatchReport && (
          <MiniList
            title="Last dispatch"
            items={[
              `due=${dispatchReport.dueCount}`,
              `runs=${dispatchReport.createdRunIds.length}`,
              `executions=${dispatchReport.launchedExecutionIds.length}`,
              dispatchReport.nextWakeAt ? `next=${new Date(dispatchReport.nextWakeAt).toLocaleString()}` : 'next wake not scheduled',
            ]}
            icon={<CalendarClock size={12} className="text-s-warning" />}
          />
        )}
      </div>
    </Card>
  );
}

export function ExecutionFabricPanel({
  plan,
  job,
  eventTail,
  provider,
  setProvider,
  deploymentProvider,
  setDeploymentProvider,
  targetEnvironment,
  setTargetEnvironment,
  budget,
  setBudget,
  busy,
  hasRun,
  onPlan,
  onDryRun,
  onHeartbeat,
}: {
  plan: AgentProjectExecutionFabricPlan | null;
  job: AgentProjectExecutionFabricJob | null;
  eventTail: AgentProjectOperationEventTail | null;
  provider: AgentProjectExecutionProvider;
  setProvider: (value: AgentProjectExecutionProvider) => void;
  deploymentProvider: AgentProjectDeploymentProvider;
  setDeploymentProvider: (value: AgentProjectDeploymentProvider) => void;
  targetEnvironment: AgentProjectTargetEnvironment;
  setTargetEnvironment: (value: AgentProjectTargetEnvironment) => void;
  budget: string;
  setBudget: (value: string) => void;
  busy: boolean;
  hasRun: boolean;
  onPlan: () => void;
  onDryRun: () => void;
  onHeartbeat: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Execution fabric" subtitle="Provider sandbox, PR, deploy, cost, secret, and rollback gates for real delivery work" action={<Network size={14} className="text-s-info" />} />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_130px] gap-3">
          <SelectField label="Provider" value={provider} onChange={(value) => setProvider(value as AgentProjectExecutionProvider)} options={['local-process', 'github-actions', 'docker', 'kubernetes', 'codespaces', 'e2b', 'daytona', 'firecracker']} />
          <SelectField label="Deploy" value={deploymentProvider} onChange={(value) => setDeploymentProvider(value as AgentProjectDeploymentProvider)} options={['none', 'vercel', 'railway', 'fly', 'render', 'kubernetes', 'aws-ecs', 'gcp-cloud-run', 'azure-container-apps']} />
          <SelectField label="Environment" value={targetEnvironment} onChange={(value) => setTargetEnvironment(value as AgentProjectTargetEnvironment)} options={['preview', 'staging', 'production']} />
          <label className="block">
            <span className="label-mono mb-1.5 block">Budget</span>
            <input value={budget} onChange={(event) => setBudget(event.target.value)} inputMode="decimal" className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand" />
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Button variant="secondary" icon={<ShieldCheck size={13} />} onClick={onPlan} disabled={busy || !hasRun}>
            Build fabric plan
          </Button>
          <Button variant="primary" icon={busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} onClick={onDryRun} disabled={busy || !hasRun}>
            Dry-run fabric
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Metric label="Plan" value={plan ? plan.status : 'none'} />
          <Metric label="Estimated cost" value={plan ? `$${plan.estimatedCostUsd.toFixed(2)} / $${plan.maxCostUsd.toFixed(2)}` : '--'} />
          <Metric label="Secrets" value={plan ? String(plan.secretsRequired.length) : '0'} />
          <Metric label="Last job" value={job ? job.status : 'none'} />
        </div>
        {job && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Metric label="Provider run" value={job.providerRunUrl ?? job.providerRunId ?? 'not submitted'} />
            <Metric label="Deployment URL" value={job.deploymentUrl ?? 'not deployed'} />
            <Metric label="Fabric artifact" value={job.artifactId ?? 'pending'} />
          </div>
        )}
        {job && (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_160px] gap-3">
            <Metric label="Fabric progress" value={`${eventTail?.control.progress ?? job.control.progress}%`} />
            <Metric label="Heartbeat" value={job.control.heartbeatAt ? new Date(job.control.heartbeatAt).toLocaleTimeString() : 'none'} />
            <Metric label="Lease" value={job.control.leaseOwner ?? 'unassigned'} />
            <Button variant="secondary" icon={<CalendarClock size={13} />} onClick={onHeartbeat} disabled={busy || !job}>
              Heartbeat
            </Button>
          </div>
        )}
        {plan && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <MiniList title="Fabric gates" items={plan.gates.map((gateItem) => `${gateItem.status}: ${gateItem.title}`)} icon={<ShieldCheck size={12} className="text-s-success" />} />
            <MiniList title="Adapter manifest" items={[plan.adapterManifest.kind, plan.adapterManifest.entrypoint, ...plan.adapterManifest.files.map((file) => file.path)]} icon={<GitBranch size={12} className="text-s-info" />} />
            <MiniList title="Launch instructions" items={plan.launchInstructions} icon={<CheckCircle2 size={12} className="text-s-brand" />} />
          </div>
        )}
        {job && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <MiniList title="Fabric job stages" items={job.stages.map((stage) => `${stage.status}: ${stage.title}`)} icon={<Play size={12} className="text-s-info" />} />
            <MiniList title="Fabric events" items={(eventTail?.events ?? job.events).slice(0, 6).map((event) => `${event.progress ?? job.control.progress}% ${event.level}: ${event.message}`)} icon={<CheckCircle2 size={12} className="text-s-success" />} />
          </div>
        )}
      </div>
    </Card>
  );
}

export function OperationsPanel({
  templates,
  worker,
  sdkManifest,
  job,
  jobEventTail,
  latestRecap,
  latestPack,
  latestRuntimeProfile,
  latestHookRun,
  latestPrPackage,
  latestFabricPlan,
  latestFabricJob,
  busy,
  hasProject,
  hasRun,
  hasExecution,
  onTemplate,
  onTickWorker,
  onStartWorker,
  onStopWorker,
  onQueueJob,
  onRunJob,
  onHeartbeatJob,
  onCancelJob,
  onRetryJob,
  onRuntimeProfile,
  onRunHooks,
  onPrPackage,
  onRecap,
  onDeliveryPack,
}: {
  templates: AgentProjectTemplate[];
  worker: AgentProjectWorkerStatus | null;
  sdkManifest: AgentProjectSdkManifest | null;
  job: AgentProjectDeliveryJob | null;
  jobEventTail: AgentProjectOperationEventTail | null;
  latestRecap: AgentProjectRunRecap | null;
  latestPack: AgentProjectDeliveryPack | null;
  latestRuntimeProfile: AgentProjectRuntimeProfile | null;
  latestHookRun: AgentProjectHookRun | null;
  latestPrPackage: AgentProjectPullRequestPackage | null;
  latestFabricPlan: AgentProjectExecutionFabricPlan | null;
  latestFabricJob: AgentProjectExecutionFabricJob | null;
  busy: boolean;
  hasProject: boolean;
  hasRun: boolean;
  hasExecution: boolean;
  onTemplate: (templateId: string) => void;
  onTickWorker: () => void;
  onStartWorker: () => void;
  onStopWorker: () => void;
  onQueueJob: () => void;
  onRunJob: () => void;
  onHeartbeatJob: () => void;
  onCancelJob: () => void;
  onRetryJob: () => void;
  onRuntimeProfile: () => void;
  onRunHooks: () => void;
  onPrPackage: () => void;
  onRecap: () => void;
  onDeliveryPack: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Operator continuity" subtitle="Templates, worker control, recaps, delivery packs, and SDK/MCP contract" action={<Sparkles size={14} className="text-s-brand" />} />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Metric label="Worker" value={worker?.running ? 'running' : 'stopped'} />
          <Metric label="Ticks" value={String(worker?.tickCount ?? 0)} />
          <Metric label="SDK endpoints" value={String(sdkManifest?.endpoints.length ?? 0)} />
          <Metric label="Delivery job" value={job?.status ?? 'none'} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Button variant="secondary" icon={<CalendarClock size={13} />} onClick={onTickWorker} disabled={busy}>
            Tick worker
          </Button>
          <Button variant="secondary" icon={<Play size={13} />} onClick={onStartWorker} disabled={busy || worker?.running}>
            Start worker
          </Button>
          <Button variant="secondary" icon={<ShieldCheck size={13} />} onClick={onStopWorker} disabled={busy || !worker?.running}>
            Stop worker
          </Button>
          <Button variant="primary" icon={<CheckCircle2 size={13} />} onClick={onDeliveryPack} disabled={busy || !hasExecution}>
            Delivery pack
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <Button variant="secondary" icon={<Network size={13} />} onClick={onQueueJob} disabled={busy || !hasRun}>
            Queue job
          </Button>
          <Button variant="primary" icon={<Play size={13} />} onClick={onRunJob} disabled={busy || !hasRun}>
            Run job
          </Button>
          <Button variant="secondary" icon={<CalendarClock size={13} />} onClick={onHeartbeatJob} disabled={busy || !job}>
            Heartbeat
          </Button>
          <Button variant="secondary" icon={<ShieldCheck size={13} />} onClick={onCancelJob} disabled={busy || !job || job.status === 'completed' || job.status === 'cancelled'}>
            Cancel job
          </Button>
          <Button variant="secondary" icon={<CalendarClock size={13} />} onClick={onRetryJob} disabled={busy || !job || job.status === 'running'}>
            Retry job
          </Button>
        </div>
        {job && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Metric label="Job progress" value={`${jobEventTail?.control.progress ?? job.control.progress}%`} />
            <Metric label="Attempts" value={`${job.control.attempts}/${job.control.maxAttempts}`} />
            <Metric label="Heartbeat" value={job.control.heartbeatAt ? new Date(job.control.heartbeatAt).toLocaleTimeString() : 'none'} />
            <Metric label="Lease" value={job.control.leaseOwner ?? 'unassigned'} />
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Button variant="secondary" icon={<Sparkles size={13} />} onClick={onRuntimeProfile} disabled={busy || !hasProject}>
            Agent files
          </Button>
          <Button variant="secondary" icon={<ShieldCheck size={13} />} onClick={onRunHooks} disabled={busy || !hasProject}>
            Run hooks
          </Button>
          <Button variant="secondary" icon={<GitBranch size={13} />} onClick={onPrPackage} disabled={busy || !hasRun}>
            PR package
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {templates.slice(0, 3).map((template) => (
            <Button key={template.id} variant="secondary" icon={<Sparkles size={13} />} onClick={() => onTemplate(template.id)} disabled={busy}>
              {template.name}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Button variant="secondary" icon={<CheckCircle2 size={13} />} onClick={onRecap} disabled={busy || !hasRun}>
            Generate recap
          </Button>
          <Button variant="secondary" icon={<Network size={13} />} onClick={onDeliveryPack} disabled={busy || !hasExecution}>
            Package handoff
          </Button>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <MiniList title="Templates" items={templates.map((template) => `${template.name}: ${template.skills.slice(0, 3).join(', ')}`)} icon={<Sparkles size={12} className="text-s-brand" />} />
          <MiniList title="Durable job stages" items={job?.stages.map((stage) => `${stage.status}: ${stage.title}`) ?? ['queue a job to create IT delivery stages']} icon={<Network size={12} className="text-s-info" />} />
          <MiniList
            title="Latest continuity"
            items={[
              latestRecap ? latestRecap.summary : 'No recap generated this session',
              latestPack ? latestPack.summary : 'No delivery pack generated this session',
              latestRuntimeProfile ? `${latestRuntimeProfile.agentFiles.length} agent file(s), ${latestRuntimeProfile.hookFiles.length} hook file(s)` : 'No runtime profile generated',
              latestHookRun ? `${latestHookRun.status}: ${latestHookRun.results.length} hook result(s)` : 'No hook runtime evidence',
              latestPrPackage ? latestPrPackage.summary : 'No PR package generated',
              latestFabricPlan ? `${latestFabricPlan.provider}/${latestFabricPlan.deploymentProvider}: ${latestFabricPlan.status}` : 'No execution fabric plan',
              latestFabricJob ? `${latestFabricJob.status}: $${latestFabricJob.costSpentUsd.toFixed(2)} spent` : 'No execution fabric job',
              (jobEventTail?.events ?? job?.events ?? []).slice(0, 3).map((event) => `${event.progress ?? job?.control.progress ?? 0}% ${event.level}: ${event.message}`).join(' | ') || 'No durable job event yet',
              worker?.nextWakeAt ? `next wake ${new Date(worker.nextWakeAt).toLocaleString()}` : 'no next wake scheduled',
            ]}
            icon={<CheckCircle2 size={12} className="text-s-success" />}
          />
        </div>
      </div>
    </Card>
  );
}

export function ProjectPanel({ project }: { project: AgentProject | null }) {
  if (!project) return <Card><EmptyState icon={<Network size={18} />} title="No agent project yet" description="Create a project to scope folders, permissions, hooks, and worktree behavior." /></Card>;
  return (
    <Card className="overflow-hidden">
      <CardHeader title={project.name} subtitle={project.objective} action={<SeverityBadge level={project.readiness.status === 'ready' ? 'LOW' : project.readiness.status === 'needs-review' ? 'MEDIUM' : 'HIGH'} />} />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Metric label="Security" value={project.securityPreset} />
          <Metric label="Worktree" value={project.worktreeMode} />
          <Metric label="Review" value={project.reviewPolicy} />
        </div>
        <MiniList title="Folders" items={project.folders.map((folder) => `${folder.path} ${folder.writable ? 'write' : 'read'}`)} icon={<GitBranch size={12} className="text-s-info" />} />
        <MiniList title="Hooks" items={project.hooks.filter((hook) => hook.enabled).map((hook) => `${hook.event}: ${hook.policy}`)} icon={<ShieldCheck size={12} className="text-s-success" />} />
      </div>
    </Card>
  );
}

export function RunPanel({ run }: { run: AgentProjectRun | null }) {
  if (!run) return <Card><EmptyState icon={<Play size={18} />} title="No agent run yet" description="Plan a slash-command run to create subagents, artifacts, and review gates." /></Card>;
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Latest run" subtitle={run.summary} action={<SeverityBadge level={run.status === 'blocked' ? 'HIGH' : run.status === 'review-required' ? 'MEDIUM' : 'LOW'} />} />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Metric label="Command" value={`/${run.command}`} />
          <Metric label="Mode" value={run.mode} />
          <Metric label="Subagents" value={String(run.subagents.length)} />
          <Metric label="Artifacts" value={String(run.artifacts.length)} />
        </div>
        {run.browserPlan && <MiniList title="Browser evidence" items={run.browserPlan.evidence} icon={<Video size={12} className="text-s-brand" />} />}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <MiniList title="Dynamic subagents" items={run.subagents.map((agent) => `${agent.name}: ${agent.expectedArtifacts.join(', ')}`)} icon={<Network size={12} className="text-s-info" />} />
          <MiniList title="Task groups" items={run.taskGroups.map((group) => `${group.title}: ${group.ownerAgent}`)} icon={<CheckCircle2 size={12} className="text-s-success" />} />
        </div>
        {run.questions.length > 0 && <MiniList title="Alignment questions" items={run.questions} icon={<Sparkles size={12} className="text-s-warning" />} />}
        <MiniList title="Next actions" items={run.nextActions} icon={<CheckCircle2 size={12} className="text-s-success" />} />
      </div>
    </Card>
  );
}

export function SchedulePanel({ schedules }: { schedules: Array<{ id: string; instruction: string; schedule: string; nextRunAt: string; command: string; enabled: boolean; runCount?: number; lastRunAt?: string }> }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Scheduled tasks" subtitle={`${schedules.length} autonomous timer(s)`} action={<CalendarClock size={14} className="text-s-brand" />} />
      <div className="divide-y divide-s-border">
        {schedules.map((schedule) => (
          <div key={schedule.id} className="p-4">
            <div className="flex items-center gap-2">
              <SeverityBadge level={schedule.enabled ? 'LOW' : 'MEDIUM'} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-s-primary">{schedule.instruction}</span>
              <Token>/{schedule.command}</Token>
            </div>
            <div className="mt-2 text-[12px] text-s-secondary">{schedule.schedule} {'->'} {new Date(schedule.nextRunAt).toLocaleString()}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Token>{schedule.runCount ?? 0} run(s)</Token>
              {schedule.lastRunAt && <Token>last {new Date(schedule.lastRunAt).toLocaleString()}</Token>}
            </div>
          </div>
        ))}
        {schedules.length === 0 && <EmptyState icon={<CalendarClock size={18} />} title="No scheduled tasks" />}
      </div>
    </Card>
  );
}

export function ReadinessEvidencePanel({
  project,
  job,
  fabricJob,
}: {
  project: AgentProject | null;
  job: AgentProjectDeliveryJob | null;
  fabricJob: AgentProjectExecutionFabricJob | null;
}) {
  const items = [
    project ? `Project readiness ${project.readiness.score}%: ${project.readiness.status}` : 'Create a project to calculate readiness',
    job ? `Delivery job ${job.status}, progress ${job.control.progress}%` : 'Queue a delivery job for execution evidence',
    fabricJob ? `Execution fabric ${fabricJob.status}, progress ${fabricJob.control.progress}%` : 'Run Execution Fabric for provider evidence',
    project?.readiness.blockers[0] ?? 'No project readiness blocker reported',
  ];
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Readiness Evidence" subtitle="Live project, delivery-job, and execution-fabric proof" action={<Sparkles size={14} className="text-s-brand" />} />
      <div className="p-4">
        <MiniList title="Current proof" items={items} icon={<CheckCircle2 size={12} className="text-s-success" />} />
      </div>
    </Card>
  );
}

export function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 block">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-s-border bg-s-base px-3 py-2 text-[13px] text-s-primary outline-none focus:border-s-brand">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-s-border bg-s-base p-3">
      <div className="label-mono mb-1">{label}</div>
      <div className="truncate font-mono text-[11px] text-s-primary">{value}</div>
    </div>
  );
}

function MiniList({ title, items, icon }: { title: string; items: string[]; icon: ReactNode }) {
  return (
    <div className="rounded-md border border-s-border bg-s-base p-3">
      <div className="label-mono mb-2">{title}</div>
      <div className="space-y-1.5">{items.slice(0, 6).map((item) => <Line key={item} icon={icon}>{item}</Line>)}</div>
    </div>
  );
}

function Line({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[12px] leading-relaxed text-s-secondary">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function Token({ children }: { children: ReactNode }) {
  return <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[10px] font-mono text-s-muted">{children}</span>;
}
