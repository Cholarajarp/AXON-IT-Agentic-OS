import { nanoid } from 'nanoid';
import type {
  AgentProject,
  AgentProjectFileClaim,
  AgentProjectRun,
  AgentProjectSlashCommand,
  AgentProjectSubagent,
  AgentProjectTaskGroup,
} from './types.js';

interface PromptInput {
  text: string;
}

interface RunPlanningContext {
  project: AgentProject;
  prompt: string;
  command: AgentProjectSlashCommand;
}

interface TaskGroupPlanningContext extends RunPlanningContext {
  subagents: AgentProjectSubagent[];
}

interface RunSummaryContext {
  command: AgentProjectSlashCommand;
  project: AgentProject;
  subagents: AgentProjectSubagent[];
}

interface RunNextActionsContext {
  status: AgentProjectRun['status'];
  command: AgentProjectSlashCommand;
  project: AgentProject;
}

interface SubagentSpec {
  name: string;
  mission: string;
  expectedArtifacts: string[];
  budgetUsd: number;
}

interface TaskGroupSpec {
  id: string;
  title: string;
  ownerAgent: string;
  objective: string;
  dependsOn: string[];
  artifacts: string[];
  reviewRequired: boolean;
}

const BASE_SUBAGENT_SPECS: SubagentSpec[] = [
  { name: 'PlannerAgent', mission: 'Break objective into task groups and artifact review gates.', expectedArtifacts: ['implementation plan', 'risk list'], budgetUsd: 0.2 },
  { name: 'RepoMapperAgent', mission: 'Map folders, dependencies, ownership, and likely edit zones.', expectedArtifacts: ['repo map', 'context pack'], budgetUsd: 0.15 },
  { name: 'ImplementerAgent', mission: 'Make bounded changes inside claimed files or worktree.', expectedArtifacts: ['diff artifact', 'test output'], budgetUsd: 0.6 },
  { name: 'CriticAgent', mission: 'Review output against acceptance, security, and cost gates.', expectedArtifacts: ['review memo', 'fix list'], budgetUsd: 0.25 },
];

const CONDITIONAL_SUBAGENT_SPECS: Array<{
  matches: (context: RunPlanningContext) => boolean;
  spec: SubagentSpec;
}> = [
  {
    matches: ({ prompt }) => /database|schema|migration|sql/i.test(prompt),
    spec: { name: 'DatabaseSafetyAgent', mission: 'Validate migrations, rollback, locks, and data quality.', expectedArtifacts: ['database review'], budgetUsd: 0.25 },
  },
  {
    matches: ({ prompt }) => /deploy|release|kubernetes|cloud|production/i.test(prompt),
    spec: { name: 'SREReleaseAgent', mission: 'Prepare deploy, rollback, SLO, and runtime checks.', expectedArtifacts: ['deployment plan', 'runbook'], budgetUsd: 0.35 },
  },
  {
    matches: ({ prompt }) => /security|secret|auth|compliance|soc|iso/i.test(prompt),
    spec: { name: 'SecurityAgent', mission: 'Threat model and scan risky changes before release.', expectedArtifacts: ['security report'], budgetUsd: 0.25 },
  },
  {
    matches: ({ command, prompt }) => command === 'browser' || /ui|browser|preview|playwright|chrome/i.test(prompt),
    spec: { name: 'BrowserQAAgent', mission: 'Use browser lane for UX, console, network, video, and accessibility evidence.', expectedArtifacts: ['browser recording', 'screenshot', 'trace'], budgetUsd: 0.3 },
  },
  {
    matches: ({ project }) => project.reviewPolicy === 'request-review',
    spec: { name: 'ArtifactReviewAgent', mission: 'Prepare review checkpoints and inline feedback targets.', expectedArtifacts: ['review checklist'], budgetUsd: 0.1 },
  },
];

export function parseSlashCommand(input: PromptInput): AgentProjectSlashCommand {
  const match = input.text.trim().match(/^\/(goal|grill-me|schedule|browser)\b/i);
  return match ? (match[1].toLowerCase() as AgentProjectSlashCommand) : 'none';
}

export function normalizePrompt(input: PromptInput): string {
  return input.text
    .replace(/\b(um+|uh+|like|you know)\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

export function buildSubagents(context: RunPlanningContext): AgentProjectSubagent[] {
  const specs = [
    ...BASE_SUBAGENT_SPECS,
    ...CONDITIONAL_SUBAGENT_SPECS
      .filter((candidate) => candidate.matches(context))
      .map((candidate) => candidate.spec),
  ];
  return specs.map((spec) => subagent(spec));
}

export function buildTaskGroups(context: TaskGroupPlanningContext): AgentProjectTaskGroup[] {
  const specs: TaskGroupSpec[] = [
    {
      id: 'plan',
      title: 'Plan and scope',
      ownerAgent: 'PlannerAgent',
      objective: `Convert "${context.prompt}" into task groups, file claims, and acceptance criteria.`,
      dependsOn: [],
      artifacts: ['implementation plan'],
      reviewRequired: true,
    },
    {
      id: 'map',
      title: 'Map project context',
      ownerAgent: 'RepoMapperAgent',
      objective: `Use ${context.project.folders.length} scoped folder(s) and ${context.project.worktreeMode} mode.`,
      dependsOn: ['plan'],
      artifacts: ['repo map'],
      reviewRequired: false,
    },
    {
      id: 'build',
      title: 'Execute bounded work',
      ownerAgent: 'ImplementerAgent',
      objective: 'Apply changes only after ownership and policy checks.',
      dependsOn: ['plan', 'map'],
      artifacts: ['diff artifact', 'test output'],
      reviewRequired: context.project.reviewPolicy === 'request-review',
    },
    {
      id: 'verify',
      title: 'Verify and critique',
      ownerAgent: 'CriticAgent',
      objective: 'Run quality, security, browser, database, and release gates needed for the task.',
      dependsOn: ['build'],
      artifacts: ['review memo', 'evidence pack'],
      reviewRequired: true,
    },
  ];

  if (context.subagents.some((agent) => agent.name === 'BrowserQAAgent')) {
    specs.push({
      id: 'browser',
      title: 'Browser verification',
      ownerAgent: 'BrowserQAAgent',
      objective: 'Use explicit browser lane with DevTools evidence and video recording.',
      dependsOn: ['build'],
      artifacts: ['webm recording', 'screenshot', 'console log'],
      reviewRequired: true,
    });
  }
  if (context.command === 'goal') {
    specs.push({
      id: 'finish',
      title: 'Run until done',
      ownerAgent: 'DeliveryManagerAgent',
      objective: 'Continue until acceptance criteria are met or a blocker requires human decision.',
      dependsOn: ['verify'],
      artifacts: ['completion report'],
      reviewRequired: true,
    });
  }
  return specs.map((spec) => group(spec));
}

export function buildAlignmentQuestions(context: RunPlanningContext): string[] {
  return [
    `What is the customer-visible success criterion for "${context.prompt.replace(/^\/grill-me\s*/i, '')}"?`,
    `Which project folder is the primary write target: ${context.project.folders.map((folder) => folder.path).join(', ')}?`,
    'Should the agent optimize for fastest delivery, safest production readiness, or lowest model/API cost?',
    'Which artifacts must be reviewed before execution: plan, diff, browser recording, database review, or release pack?',
  ];
}

export function summarizeRun(context: RunSummaryContext): string {
  if (context.command === 'goal') return `Goal-mode run planned for ${context.project.name}; ${context.subagents.length} subagent(s) can continue until acceptance or policy blockers.`;
  if (context.command === 'grill-me') return `Alignment run prepared for ${context.project.name}; questions must be answered before implementation.`;
  if (context.command === 'browser') return `Browser-command run planned for ${context.project.name}; DevTools/video evidence is required.`;
  if (context.command === 'schedule') return `Scheduled-task command interpreted for ${context.project.name}; create a schedule to run it later.`;
  return `Planning run prepared for ${context.project.name}; artifact review and hooks decide execution safety.`;
}

export function nextActionsForRun(context: RunNextActionsContext): string[] {
  const actions = context.status === 'blocked'
    ? ['Fix project readiness blockers before execution.']
    : context.status === 'executing'
      ? ['Monitor the execution envelope.', 'Resolve blackboard blockers.', 'Attach verification artifacts before release.']
      : ['Review the generated plan artifact.', 'Approve file claims and command scopes.', 'Launch through Mission Control when customer delivery evidence is required.'];
  if (context.command === 'browser') actions.push('Attach real browser worker output before release.');
  if (context.project.worktreeMode === 'new-worktree') actions.push('Create a per-run Git worktree before applying changes.');
  return actions;
}

export function buildFileClaims(project: AgentProject, run: AgentProjectRun): AgentProjectFileClaim[] {
  const claims = project.folders
    .filter((folder) => folder.writable)
    .map((folder) => ({
      path: folder.path === '.' ? '**/*' : `${folder.path.replace(/\\/g, '/')}/**/*`,
      ownerAgent: run.subagents.find((agent) => agent.name === 'ImplementerAgent')?.name ?? 'ImplementerAgent',
      reason: `Writable project folder for ${run.command} run.`,
    }));

  if (run.browserPlan) {
    claims.push({
      path: 'browser-qa/**/*',
      ownerAgent: 'BrowserQAAgent',
      reason: 'Browser evidence, traces, screenshots, and accessibility notes.',
    });
  }
  if (/database|migration|schema|sql/i.test(run.normalizedPrompt)) {
    claims.push({
      path: 'backend/src/db/**/*',
      ownerAgent: 'DatabaseSafetyAgent',
      reason: 'Database migration and safety review ownership.',
    });
  }
  return dedupeClaims(claims);
}

function subagent(spec: SubagentSpec): AgentProjectSubagent {
  return {
    id: `sub_${nanoid(8)}`,
    name: spec.name,
    mission: spec.mission,
    contextPolicy: 'Use only project folders, explicit artifacts, and summarized memory relevant to the task.',
    canRunInParallel: !['PlannerAgent', 'CriticAgent', 'ArtifactReviewAgent'].includes(spec.name),
    expectedArtifacts: spec.expectedArtifacts,
    budgetUsd: spec.budgetUsd,
  };
}

function group(spec: TaskGroupSpec): AgentProjectTaskGroup {
  return {
    id: spec.id,
    title: spec.title,
    ownerAgent: spec.ownerAgent,
    objective: spec.objective,
    dependsOn: spec.dependsOn,
    artifacts: spec.artifacts,
    reviewRequired: spec.reviewRequired,
  };
}

function dedupeClaims(claims: AgentProjectFileClaim[]): AgentProjectFileClaim[] {
  const seen = new Set<string>();
  return claims.filter((claim) => {
    if (seen.has(claim.path)) return false;
    seen.add(claim.path);
    return true;
  });
}
