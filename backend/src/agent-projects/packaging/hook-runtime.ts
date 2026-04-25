import { nanoid } from 'nanoid';
import { artifactService } from '../../artifacts/index.js';
import { trustLedger } from '../../trust-ledger/index.js';
import { slug } from '../execution-fabric-runtime.js';
import { hookRuns, projects, runs } from '../state.js';
import type { AgentProject, AgentProjectHook, AgentProjectHookRun, AgentProjectHookRunInput } from '../types.js';

export function runHooks(input: AgentProjectHookRunInput): AgentProjectHookRun {
  const project = projects.get(input.projectId);
  if (!project) throw new Error('Agent project not found');
  const run = input.runId ? runs.get(input.runId) : undefined;
  if (input.runId && !run) throw new Error('Agent project run not found');

  const matchingHooks = project.hooks.filter((hook) => hook.enabled && hook.event === input.event);
  const results = matchingHooks.map((hook) => evaluateHook(hook, input, project));
  const status: AgentProjectHookRun['status'] = results.length === 0
    ? 'skipped'
    : results.some((result) => result.status === 'blocked')
      ? 'blocked'
      : results.some((result) => result.status === 'failed')
        ? 'failed'
        : 'passed';
  const artifact = artifactService.put({
    tenantId: project.tenantId,
    kind: 'generic',
    name: `${slug(project.name)}-${input.event}-hook-run`,
    content: { projectId: project.id, runId: run?.id, event: input.event, status, results, payload: input.payload ?? {} },
    metadata: { source: 'Agent Projects', projectId: project.id, runId: run?.id, event: input.event },
  });
  const hookRun: AgentProjectHookRun = {
    id: `hook_${nanoid(10)}`,
    projectId: project.id,
    runId: run?.id,
    tenantId: project.tenantId,
    event: input.event,
    status,
    results,
    artifactId: artifact.id,
    createdAt: new Date().toISOString(),
  };
  hookRuns.set(hookRun.id, hookRun);
  trustLedger.append({
    tenantId: project.tenantId,
    kind: 'policy-decision',
    actor: 'HookRuntimeAgent',
    actorType: 'agent',
    subject: `Hook run ${hookRun.id}`,
    summary: `Evaluated ${results.length} ${input.event} hook(s); status=${status}.`,
    risk: status === 'blocked' || status === 'failed' ? 'medium' : 'low',
    source: 'Agent Projects',
    artifacts: [artifact.uri],
    metadata: { projectId: project.id, runId: run?.id, hookRunId: hookRun.id, event: input.event },
    controls: ['hook-runtime-evidence', 'project-permission-policy', 'artifacted-hook-results'],
  });
  return hookRun;
}

function evaluateHook(
  hook: AgentProjectHook,
  input: AgentProjectHookRunInput,
  project: AgentProject,
): AgentProjectHookRun['results'][number] {
  const evidence = [
    `event=${hook.event}`,
    `policy=${hook.policy}`,
    `approved=${Boolean(input.approved)}`,
    `securityPreset=${project.securityPreset}`,
  ];
  const payloadText = JSON.stringify(input.payload ?? {}).toLowerCase();
  const riskyPayload = /rm\s+-rf|drop\s+table|delete\s+from|secret|password|token|prod|production/.test(payloadText);
  const approvalRequired = ['before-tool-call', 'artifact-review', 'browser-session'].includes(hook.event) || riskyPayload;

  if (project.securityPreset === 'unrestricted') {
    return {
      hookId: hook.id,
      action: hook.action,
      policy: hook.policy,
      status: 'blocked',
      evidence: [...evidence, 'blocked unrestricted project permissions'],
    };
  }
  if (approvalRequired && !input.approved) {
    return {
      hookId: hook.id,
      action: hook.action,
      policy: hook.policy,
      status: 'blocked',
      evidence: [...evidence, 'approval required before hook action can pass'],
    };
  }
  if (/browser|preview/i.test(hook.action) && !('previewUrl' in (input.payload ?? {}))) {
    return {
      hookId: hook.id,
      action: hook.action,
      policy: hook.policy,
      status: 'passed',
      evidence: [...evidence, 'browser hook passed as planning gate; preview URL can be attached later'],
    };
  }
  return {
    hookId: hook.id,
    action: hook.action,
    policy: hook.policy,
    status: 'passed',
    evidence: [...evidence, 'policy predicate passed'],
  };
}
