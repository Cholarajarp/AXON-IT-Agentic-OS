import { nanoid } from 'nanoid';
import { artifactService } from '../../artifacts/index.js';
import { trustLedger } from '../../trust-ledger/index.js';
import { slug } from '../execution-fabric-runtime.js';
import type { PackagingRuntime } from './types.js';
import { projects, recaps, runs } from '../state.js';
import type { AgentProjectRunRecap } from '../types.js';

export function createRunRecap(runId: string, runtime: PackagingRuntime): AgentProjectRunRecap {
  const run = runs.get(runId);
  if (!run) throw new Error('Agent project run not found');
  const project = projects.get(run.projectId);
  if (!project) throw new Error('Agent project not found');

  const execution = runtime.listExecutions(run.id)[0];
  const openGates = execution?.gates
    .filter((item) => item.status !== 'pass')
    .map((item) => `${item.status}: ${item.title}`) ?? [];
  const artifacts = [
    ...run.artifacts.map((artifact) => artifact.uri),
    ...(execution ? [`execution artifact ${execution.artifactId}`] : []),
    ...(execution?.commandRuns.map((item) => `command artifact ${item.artifactId}`) ?? []),
    ...(execution?.browserQaReportId ? [`browser QA ${execution.browserQaReportId}`] : []),
  ];

  const recapContent = {
    project: project.name,
    runId: run.id,
    executionId: execution?.id,
    status: execution?.status ?? run.status,
    prompt: run.normalizedPrompt,
    openGates,
    artifacts,
    nextActions: run.nextActions,
    resumePrompt: `/goal resume ${run.id}: continue from recap, resolve open gates, attach evidence, and stop when release criteria pass.`,
  };
  const artifact = artifactService.put({
    tenantId: project.tenantId,
    kind: 'generic',
    name: `${slug(project.name)}-run-recap`,
    content: recapContent,
    metadata: { source: 'Agent Projects', projectId: project.id, runId: run.id, executionId: execution?.id },
  });
  const recap: AgentProjectRunRecap = {
    id: `recap_${nanoid(10)}`,
    projectId: project.id,
    runId: run.id,
    executionId: execution?.id,
    summary: `${project.name} run ${run.id} is ${execution?.status ?? run.status}; ${openGates.length} open gate(s), ${artifacts.length} artifact reference(s).`,
    decisions: [
      `command=/${run.command}`,
      `reviewPolicy=${project.reviewPolicy}`,
      `worktreeMode=${project.worktreeMode}`,
      `subagents=${run.subagents.length}`,
    ],
    openGates,
    artifacts,
    nextActions: run.nextActions,
    resumePrompt: recapContent.resumePrompt,
    artifactId: artifact.id,
    createdAt: new Date().toISOString(),
  };
  recaps.set(recap.id, recap);
  trustLedger.append({
    tenantId: project.tenantId,
    kind: 'command-evidence',
    actor: 'RecapAgent',
    actorType: 'agent',
    subject: `Run recap ${recap.id}`,
    summary: recap.summary,
    risk: openGates.some((item) => item.startsWith('block')) ? 'high' : 'low',
    source: 'Agent Projects',
    artifacts: [artifact.uri],
    metadata: { projectId: project.id, runId: run.id, executionId: execution?.id, recapId: recap.id },
    controls: ['cross-client-resume', 'decision-summary', 'artifact-continuity'],
  });
  return recap;
}
