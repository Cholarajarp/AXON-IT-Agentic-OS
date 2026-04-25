import { nanoid } from 'nanoid';
import { artifactService } from '../artifacts/index.js';
import { trustLedger } from '../trust-ledger/index.js';
import {
  defaultHooks,
  normalizeFolders,
  normalizePermissions,
  projectTemplates,
  scoreProject,
} from './project-config.js';
import {
  buildAlignmentQuestions,
  buildSubagents,
  buildTaskGroups,
  nextActionsForRun,
  normalizePrompt,
  parseSlashCommand,
  summarizeRun,
} from './run-planning.js';
import { projects, runs, schedules } from './state.js';
import type {
  AgentProject,
  AgentProjectFromTemplateInput,
  AgentProjectInput,
  AgentProjectRun,
  AgentProjectRunInput,
  AgentProjectSchedule,
  AgentProjectScheduleInput,
  AgentProjectTemplate,
} from './types.js';

export function listTemplates(): AgentProjectTemplate[] {
  return projectTemplates();
}

export function createProjectFromTemplate(input: AgentProjectFromTemplateInput): AgentProject {
  const template = projectTemplates().find((item) => item.id === input.templateId);
  if (!template) throw new Error('Agent project template not found');

  return createProject({
    tenantId: input.tenantId,
    name: input.name?.trim() || template.name,
    objective: input.objective?.trim() || template.objective,
    folders: template.folders,
    securityPreset: template.securityPreset,
    worktreeMode: template.worktreeMode,
    reviewPolicy: template.reviewPolicy,
    skills: template.skills,
    mcpServers: template.mcpServers,
  });
}

export function listProjects(): AgentProject[] {
  return Array.from(projects.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getProject(id: string): AgentProject | undefined {
  return projects.get(id);
}

export function createProject(input: AgentProjectInput): AgentProject {
  const tenantId = input.tenantId ?? 'tenant_default';
  const folders = normalizeFolders(input.folders);
  const securityPreset = input.securityPreset ?? 'default';
  const worktreeMode = input.worktreeMode ?? 'new-worktree';
  const reviewPolicy = input.reviewPolicy ?? 'request-review';
  const permissions = normalizePermissions(input.permissions, securityPreset);
  const hooks = input.hooks?.length ? input.hooks : defaultHooks();
  const readiness = scoreProject({
    folders,
    securityPreset,
    worktreeMode,
    reviewPolicy,
    hooks,
    permissions,
  });
  const now = new Date().toISOString();

  const project: AgentProject = {
    id: `apj_${nanoid(10)}`,
    tenantId,
    name: input.name.trim(),
    objective: input.objective.trim(),
    folders,
    securityPreset,
    worktreeMode,
    reviewPolicy,
    skills: input.skills?.length ? input.skills : ['repo-map', 'database-safety', 'browser-qa', 'release-evidence'],
    mcpServers: input.mcpServers?.length ? input.mcpServers : ['filesystem', 'git', 'browser', 'database-readonly'],
    hooks,
    permissions,
    readiness,
    createdAt: now,
    updatedAt: now,
  };

  projects.set(project.id, project);
  trustLedger.append({
    tenantId,
    kind: 'policy-decision',
    actor: 'AgentProjectsService',
    actorType: 'system',
    subject: `Project ${project.name}`,
    summary: `Agent project created with ${project.folders.length} folder(s), ${project.securityPreset} security, and ${project.worktreeMode} mode.`,
    risk: project.readiness.status === 'blocked' ? 'high' : project.securityPreset === 'unrestricted' ? 'critical' : 'medium',
    source: 'Agent Projects',
    metadata: { projectId: project.id, readiness: project.readiness },
  });
  return project;
}

export function listRuns(projectId?: string): AgentProjectRun[] {
  return Array.from(runs.values())
    .filter((run) => !projectId || run.projectId === projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createRun(input: AgentProjectRunInput): AgentProjectRun {
  const project = projects.get(input.projectId);
  if (!project) throw new Error('Agent project not found');

  const normalizedPrompt = normalizePrompt({ text: input.voiceTranscript || input.prompt });
  const command = input.requestedCommand && input.requestedCommand !== 'none'
    ? input.requestedCommand
    : parseSlashCommand({ text: normalizedPrompt });
  const mode = input.mode ?? (command === 'goal' || command === 'browser' ? 'planning' : 'fast');
  const planningContext = { project, prompt: normalizedPrompt, command };
  const subagents = buildSubagents(planningContext);
  const taskGroups = buildTaskGroups({ ...planningContext, subagents });
  const questions = command === 'grill-me' ? buildAlignmentQuestions(planningContext) : [];
  const browserPlan = command === 'browser' || /browser|ui|preview|chrome|playwright/i.test(normalizedPrompt)
    ? {
        enabled: true,
        command: '/browser',
        evidence: ['Chrome DevTools MCP trace', 'webm recording', 'console/network logs', 'screenshot diff', 'accessibility notes'],
      }
    : undefined;

  const planArtifact = artifactService.put({
    tenantId: project.tenantId,
    kind: 'generic',
    name: `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-agent-plan`,
    content: {
      project: project.name,
      command,
      normalizedPrompt,
      folders: project.folders,
      subagents,
      taskGroups,
      reviewPolicy: project.reviewPolicy,
      browserPlan,
    },
    metadata: { source: 'Agent Projects', projectId: project.id },
  });

  const status: AgentProjectRun['status'] = project.readiness.status === 'blocked'
    ? 'blocked'
    : project.reviewPolicy === 'request-review' || mode === 'planning'
      ? 'review-required'
      : 'ready-to-execute';

  const run: AgentProjectRun = {
    id: `apr_${nanoid(10)}`,
    projectId: project.id,
    tenantId: project.tenantId,
    command,
    mode,
    prompt: input.prompt,
    normalizedPrompt,
    status,
    summary: summarizeRun({ command, project, subagents }),
    subagents,
    taskGroups,
    artifacts: [{
      id: planArtifact.id,
      kind: planArtifact.kind,
      name: planArtifact.name,
      uri: planArtifact.uri,
      sha256: planArtifact.sha256,
      reviewRequired: project.reviewPolicy === 'request-review',
    }],
    questions,
    browserPlan,
    hookPipeline: project.hooks,
    nextActions: nextActionsForRun({ status, command, project }),
    createdAt: new Date().toISOString(),
  };

  runs.set(run.id, run);
  trustLedger.append({
    tenantId: project.tenantId,
    kind: 'command-evidence',
    actor: 'AgentCoordinatorAgent',
    actorType: 'agent',
    subject: `Agent project run ${run.id}`,
    summary: `Planned ${subagents.length} dynamic subagent(s) for ${command} command with artifact ${planArtifact.sha256}.`,
    risk: status === 'blocked' ? 'high' : browserPlan ? 'medium' : 'low',
    source: 'Agent Projects',
    artifacts: [planArtifact.uri],
    metadata: { projectId: project.id, runId: run.id, command, artifactId: planArtifact.id },
  });
  return run;
}

export function listSchedules(projectId?: string): AgentProjectSchedule[] {
  return Array.from(schedules.values())
    .filter((schedule) => !projectId || schedule.projectId === projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createSchedule(input: AgentProjectScheduleInput): AgentProjectSchedule {
  const project = projects.get(input.projectId);
  if (!project) throw new Error('Agent project not found');
  const command = parseSlashCommand({ text: input.instruction });
  const schedule: AgentProjectSchedule = {
    id: `aps_${nanoid(10)}`,
    projectId: project.id,
    tenantId: project.tenantId,
    instruction: input.instruction.trim(),
    schedule: input.schedule.trim(),
    timezone: input.timezone ?? 'Asia/Calcutta',
    enabled: input.enabled ?? true,
    nextRunAt: estimateNextRun(input.schedule),
    command: command === 'none' ? 'schedule' : command,
    autonomousPlan: [
      'Wake project-scoped agent with inherited permissions and hooks.',
      'Create planning artifact before any write or terminal execution.',
      'Run configured JSON hooks before tool calls and at loop stop.',
      'Attach release, browser, or research artifacts to Trust Ledger.',
    ],
    runCount: 0,
    createdAt: new Date().toISOString(),
  };
  schedules.set(schedule.id, schedule);
  trustLedger.append({
    tenantId: project.tenantId,
    kind: 'policy-decision',
    actor: 'SchedulerAgent',
    actorType: 'agent',
    subject: `Scheduled task ${schedule.id}`,
    summary: `Scheduled project task "${schedule.instruction}" on ${schedule.schedule}.`,
    risk: project.securityPreset === 'unrestricted' ? 'critical' : 'medium',
    source: 'Agent Projects',
    metadata: { projectId: project.id, scheduleId: schedule.id, nextRunAt: schedule.nextRunAt },
  });
  return schedule;
}

export function estimateNextRun(schedule: string, fromMs = Date.now()): string {
  const now = fromMs;
  if (/^\d{4}-\d{2}-\d{2}T/.test(schedule)) return new Date(schedule).toISOString();
  if (/hour/i.test(schedule)) return new Date(now + 60 * 60 * 1000).toISOString();
  if (/day|daily/i.test(schedule)) return new Date(now + 24 * 60 * 60 * 1000).toISOString();
  if (/week|weekly/i.test(schedule)) return new Date(now + 7 * 24 * 60 * 1000).toISOString();
  return new Date(now + 5 * 60 * 1000).toISOString();
}
