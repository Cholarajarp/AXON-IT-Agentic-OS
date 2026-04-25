import { nanoid } from 'nanoid';
import { artifactService } from '../../artifacts/index.js';
import { trustLedger } from '../../trust-ledger/index.js';
import { slug } from '../execution-fabric-runtime.js';
import { buildSubagents } from '../run-planning.js';
import { projects, runtimeProfiles, runs } from '../state.js';
import type {
  AgentProject,
  AgentProjectPermission,
  AgentProjectRuntimeProfile,
  AgentProjectRuntimeProfileInput,
} from '../types.js';

export function listRuntimeProfiles(projectId?: string): AgentProjectRuntimeProfile[] {
  return Array.from(runtimeProfiles.values())
    .filter((profile) => !projectId || profile.projectId === projectId)
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}

export function createRuntimeProfile(input: AgentProjectRuntimeProfileInput): AgentProjectRuntimeProfile {
  const project = projects.get(input.projectId);
  if (!project) throw new Error('Agent project not found');
  const run = input.runId ? runs.get(input.runId) : undefined;
  if (input.runId && !run) throw new Error('Agent project run not found');

  const agentSources = run?.subagents.length
    ? run.subagents
    : buildSubagents({ project, prompt: project.objective, command: 'goal' });
  const agentFiles = agentSources.map((agent) => ({
    path: `.axon/agents/${slug(agent.name)}.md`,
    name: agent.name,
    prompt: [
      `# ${agent.name}`,
      '',
      `Mission: ${agent.mission}`,
      `Context policy: ${agent.contextPolicy}`,
      `Expected artifacts: ${agent.expectedArtifacts.join(', ')}`,
      '',
      'Operate inside declared AXON project folders, write evidence before risky mutation, and stop at unresolved gates.',
    ].join('\n'),
    tools: toolsForAgent(agent.name, project),
    modelPolicy: agent.budgetUsd <= 0.15 ? 'small-model-first; escalate on uncertainty' : 'quality-model allowed with FinOps budget evidence',
    permissions: permissionsForAgent(agent.name, project.permissions),
  }));
  const hookFiles = project.hooks
    .filter((hook) => hook.enabled)
    .map((hook) => ({
      path: `.axon/hooks/${hook.event}-${slug(hook.id)}.json`,
      hookId: hook.id,
      event: hook.event,
      action: hook.action,
      policy: hook.policy,
      blocking: ['before-tool-call', 'artifact-review', 'browser-session'].includes(hook.event),
    }));
  const profileContent = {
    project: project.name,
    runId: run?.id,
    agentFiles,
    hookFiles,
    mcpConfig: mcpConfigForProject(project),
    slashCommands: slashCommandProfiles(),
    settings: {
      securityPreset: project.securityPreset,
      worktreeMode: project.worktreeMode,
      reviewPolicy: project.reviewPolicy,
      skills: project.skills,
      folders: project.folders,
    },
  };
  const artifact = artifactService.put({
    tenantId: project.tenantId,
    kind: 'generic',
    name: `${slug(project.name)}-runtime-profile`,
    content: profileContent,
    metadata: { source: 'Agent Projects', projectId: project.id, runId: run?.id },
  });
  const profile: AgentProjectRuntimeProfile = {
    id: `rtp_${nanoid(10)}`,
    projectId: project.id,
    tenantId: project.tenantId,
    generatedAt: new Date().toISOString(),
    ...profileContent,
    artifactId: artifact.id,
  };
  runtimeProfiles.set(profile.id, profile);
  trustLedger.append({
    tenantId: project.tenantId,
    kind: 'policy-decision',
    actor: 'RuntimeProfileAgent',
    actorType: 'agent',
    subject: `Runtime profile ${profile.id}`,
    summary: `Generated ${agentFiles.length} project-local agent file(s), ${hookFiles.length} hook file(s), and ${profile.mcpConfig.servers.length} MCP server contract(s).`,
    risk: 'low',
    source: 'Agent Projects',
    artifacts: [artifact.uri],
    metadata: { projectId: project.id, runId: run?.id, runtimeProfileId: profile.id },
    controls: ['project-local-agent-definitions', 'hook-contracts', 'mcp-tool-governance'],
  });
  return profile;
}

function toolsForAgent(agentName: string, project: AgentProject): string[] {
  const base = ['read', 'search', 'artifact'];
  const lower = agentName.toLowerCase();
  if (project.permissions.some((permission) => permission.grant === 'write')) base.push('file-write');
  if (/engineer|sre|release|workspace|qa/i.test(agentName)) base.push('shell-supervised');
  if (/browser|qa|design|preview/i.test(lower)) base.push('browser');
  if (/database|migration|data/i.test(lower)) base.push('database-readonly', 'migration-review');
  if (/security|compliance/i.test(lower)) base.push('policy-scan', 'secret-scan');
  return Array.from(new Set(base));
}

function permissionsForAgent(agentName: string, permissions: AgentProjectPermission[]): AgentProjectPermission[] {
  if (/security|compliance/i.test(agentName)) {
    return permissions.filter((permission) => permission.grant !== 'secret' || permission.risk !== 'critical');
  }
  if (/qa|browser|review|critic/i.test(agentName)) {
    return permissions.filter((permission) => permission.grant !== 'secret');
  }
  return permissions;
}

function mcpConfigForProject(project: AgentProject): AgentProjectRuntimeProfile['mcpConfig'] {
  return {
    path: '.axon/mcp.json',
    servers: project.mcpServers.map((server) => ({
      name: server,
      transport: server.startsWith('http') ? 'http' : 'stdio',
      approvalRequired: /git|filesystem|database|browser|shell/i.test(server),
      tools: mcpToolsForServer(server),
    })),
  };
}

function mcpToolsForServer(server: string): string[] {
  if (/git/i.test(server)) return ['status', 'diff', 'branch', 'commit-request'];
  if (/filesystem|file/i.test(server)) return ['read', 'search', 'write-with-approval'];
  if (/browser/i.test(server)) return ['open', 'screenshot', 'trace', 'console'];
  if (/database/i.test(server)) return ['schema-read', 'query-readonly', 'migration-review'];
  return ['invoke', 'health'];
}

function slashCommandProfiles(): AgentProjectRuntimeProfile['slashCommands'] {
  return [
    { command: 'goal', description: 'Work until acceptance criteria pass or a blocker is artifacted.', promptTemplate: '/goal {outcome} with tests, browser proof, release pack, and customer handoff.' },
    { command: 'grill-me', description: 'Ask alignment questions before implementation.', promptTemplate: '/grill-me {idea} and find missing constraints, risks, and acceptance criteria.' },
    { command: 'schedule', description: 'Create recurring autonomous work with gates.', promptTemplate: '/schedule {cadence} {instruction} with artifact review and Trust Ledger evidence.' },
    { command: 'browser', description: 'Require browser evidence before release.', promptTemplate: '/browser verify {previewUrl} with screenshots, traces, accessibility, console, and network evidence.' },
  ];
}
