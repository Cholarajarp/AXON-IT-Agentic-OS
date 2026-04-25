import { nanoid } from 'nanoid';
import { artifactService } from '../../artifacts/index.js';
import { trustLedger } from '../../trust-ledger/index.js';
import { slug } from '../execution-fabric-runtime.js';
import type { PackagingRuntime } from './types.js';
import { executions, projects, pullRequestPackages, runs, workspacePlans } from '../state.js';
import type { AgentProjectPullRequestPackage, AgentProjectPullRequestPackageInput } from '../types.js';

export function createPullRequestPackage(
  input: AgentProjectPullRequestPackageInput,
  runtime: PackagingRuntime,
): AgentProjectPullRequestPackage {
  const run = runs.get(input.runId);
  if (!run) throw new Error('Agent project run not found');
  const project = projects.get(run.projectId);
  if (!project) throw new Error('Agent project not found');
  const execution = input.executionId
    ? executions.get(input.executionId)
    : runtime.listExecutions(run.id)[0];
  if (input.executionId && !execution) throw new Error('Agent project execution not found');
  const workspacePlan = execution
    ? workspacePlans.get(execution.workspacePlanId)
    : runtime.listWorkspacePlans(run.id)[0];

  const changedFiles = workspacePlan?.fileClaims.map((claim) => claim.path) ?? project.folders.map((folder) => `${folder.path}/**/*`);
  const testEvidence = execution?.commandRuns.map((commandRun) => `${commandRun.status}: ${commandRun.label} artifact=${commandRun.artifactId}`)
    ?? run.artifacts.map((artifact) => `planned artifact ${artifact.sha256}`);
  const browserEvidence = execution?.browserQaReportId ? [`Browser QA report ${execution.browserQaReportId}`] : run.browserPlan?.evidence ?? [];
  const riskNotes = [
    `securityPreset=${project.securityPreset}`,
    `reviewPolicy=${project.reviewPolicy}`,
    ...(execution?.gates.filter((gateItem) => gateItem.status !== 'pass').map((gateItem) => `${gateItem.status}: ${gateItem.title}`) ?? []),
  ];
  const title = `${project.name}: ${run.command} delivery`;
  const branchName = workspacePlan?.branchName ?? `axon/${slug(project.name)}/${run.id.slice(-6)}`;
  const bodyMarkdown = [
    `## ${title}`,
    '',
    run.summary,
    '',
    '### Scope',
    ...run.taskGroups.map((task) => `- ${task.title}: ${task.objective}`),
    '',
    '### Changed Files / Claims',
    ...changedFiles.map((file) => `- ${file}`),
    '',
    '### Validation Evidence',
    ...testEvidence.map((item) => `- ${item}`),
    '',
    '### Browser Evidence',
    ...(browserEvidence.length ? browserEvidence : ['- Browser evidence not attached yet.']).map((item) => item.startsWith('- ') ? item : `- ${item}`),
    '',
    '### Risk Notes',
    ...riskNotes.map((item) => `- ${item}`),
    '',
    '### Customer Handoff',
    `- Create delivery pack from execution ${execution?.id ?? 'after launch'}.`,
    '- Attach release notes, rollback plan, support SLA, and customer update.',
  ].join('\n');
  const artifact = artifactService.put({
    tenantId: project.tenantId,
    kind: 'release-pack',
    name: `${slug(project.name)}-pull-request-package`,
    content: { title, branchName, runId: run.id, executionId: execution?.id, changedFiles, testEvidence, browserEvidence, riskNotes, bodyMarkdown },
    metadata: { source: 'Agent Projects', projectId: project.id, runId: run.id, executionId: execution?.id },
  });
  const prPackage: AgentProjectPullRequestPackage = {
    id: `prp_${nanoid(10)}`,
    projectId: project.id,
    runId: run.id,
    executionId: execution?.id,
    tenantId: project.tenantId,
    title,
    branchName,
    summary: `PR package for ${project.name} with ${changedFiles.length} file claim(s), ${testEvidence.length} validation evidence item(s), and ${riskNotes.length} risk note(s).`,
    changedFiles,
    testEvidence,
    browserEvidence,
    riskNotes,
    bodyMarkdown,
    artifactId: artifact.id,
    createdAt: new Date().toISOString(),
  };
  pullRequestPackages.set(prPackage.id, prPackage);
  trustLedger.append({
    tenantId: project.tenantId,
    kind: 'release-manifest',
    actor: 'PullRequestPackageAgent',
    actorType: 'agent',
    subject: `PR package ${prPackage.id}`,
    summary: prPackage.summary,
    risk: riskNotes.some((item) => item.startsWith('block')) ? 'high' : 'medium',
    source: 'Agent Projects',
    artifacts: [artifact.uri],
    metadata: { projectId: project.id, runId: run.id, executionId: execution?.id, prPackageId: prPackage.id },
    controls: ['branch-handoff', 'validation-evidence', 'review-ready-pr-body'],
  });
  return prPackage;
}
