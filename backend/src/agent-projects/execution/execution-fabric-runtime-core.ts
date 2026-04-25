import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FinOpsTaskType } from '../../model-finops/index.js';
import { trimCommandOutput } from '../workspace-execution.js';
import type {
  AgentProject,
  AgentProjectDeploymentProvider,
  AgentProjectExecution,
  AgentProjectExecutionFabricGate,
  AgentProjectExecutionFabricPlan,
  AgentProjectExecutionFabricStage,
  AgentProjectExecutionProvider,
  AgentProjectPullRequestPackage,
  AgentProjectRun,
  AgentProjectTargetEnvironment,
  AgentProjectWorkspacePlan,
} from '../types.js';

export function chooseExecutionProvider(
  targetEnvironment: AgentProjectTargetEnvironment,
  run: AgentProjectRun
): AgentProjectExecutionProvider {
  if (targetEnvironment === 'production') return 'github-actions';
  if (/kubernetes|cluster|helm/i.test(run.normalizedPrompt)) return 'kubernetes';
  if (/remote|browser|preview|sandbox/i.test(run.normalizedPrompt)) return 'e2b';
  return 'local-process';
}

export function defaultExecutionBudget(
  targetEnvironment: AgentProjectTargetEnvironment,
  provider: AgentProjectExecutionProvider,
  requireDeployment: boolean
) {
  const environmentBase = targetEnvironment === 'production' ? 75 : targetEnvironment === 'staging' ? 25 : 8;
  const providerBase: Record<AgentProjectExecutionProvider, number> = {
    'local-process': 1,
    docker: 3,
    kubernetes: 14,
    'github-actions': 6,
    codespaces: 12,
    e2b: 10,
    daytona: 10,
    firecracker: 16,
  };
  return environmentBase + providerBase[provider] + (requireDeployment ? 12 : 0);
}

export function executionFabricTaskTypes(run: AgentProjectRun, requireDeployment: boolean): FinOpsTaskType[] {
  const tasks: FinOpsTaskType[] = ['triage', 'planning', 'coding', 'review'];
  if (run.browserPlan || /browser|ui|preview|accessibility/i.test(run.normalizedPrompt)) tasks.push('browser-qa');
  if (/security|auth|secret|compliance|soc/i.test(run.normalizedPrompt)) tasks.push('security');
  if (/database|migration|schema|sql|postgres|mysql/i.test(run.normalizedPrompt)) tasks.push('database');
  if (requireDeployment || /deploy|release|production|staging|rollback/i.test(run.normalizedPrompt)) tasks.push('release');
  tasks.push('customer-report');
  return Array.from(new Set(tasks));
}

export function estimateProviderRuntimeCost(
  provider: AgentProjectExecutionProvider,
  targetEnvironment: AgentProjectTargetEnvironment
) {
  const multiplier = targetEnvironment === 'production' ? 3 : targetEnvironment === 'staging' ? 1.7 : 1;
  const base: Record<AgentProjectExecutionProvider, number> = {
    'local-process': 0.05,
    docker: 0.25,
    kubernetes: 1.6,
    'github-actions': 0.8,
    codespaces: 1.8,
    e2b: 1.4,
    daytona: 1.4,
    firecracker: 2.5,
  };
  return base[provider] * multiplier;
}

export function estimateDeploymentCost(
  deploymentProvider: AgentProjectDeploymentProvider,
  targetEnvironment: AgentProjectTargetEnvironment
) {
  if (deploymentProvider === 'none') return 0;
  const multiplier = targetEnvironment === 'production' ? 2.5 : targetEnvironment === 'staging' ? 1.4 : 1;
  const base: Record<AgentProjectDeploymentProvider, number> = {
    none: 0,
    vercel: 0.4,
    railway: 0.5,
    fly: 0.6,
    render: 0.5,
    kubernetes: 1.3,
    'aws-ecs': 1.7,
    'gcp-cloud-run': 1.2,
    'azure-container-apps': 1.2,
  };
  return base[deploymentProvider] * multiplier;
}

export function requiredExecutionSecrets(
  provider: AgentProjectExecutionProvider,
  deploymentProvider: AgentProjectDeploymentProvider,
  requirePullRequest: boolean,
  requireDeployment: boolean
): AgentProjectExecutionFabricPlan['secretsRequired'] {
  const secrets: AgentProjectExecutionFabricPlan['secretsRequired'] = [];
  const add = (name: string, secretProvider: string, purpose: string, required = true) => {
    if (!secrets.some((secret) => secret.name === name)) {
      secrets.push({ name, provider: secretProvider, purpose, required });
    }
  };

  if (provider === 'github-actions' || provider === 'codespaces' || requirePullRequest) {
    add('GITHUB_TOKEN', 'github', 'Create branches, dispatch workflow runs, and open pull requests.');
    add('GITHUB_REPOSITORY', 'github', 'Resolve owner/repo for workflow and PR operations.', provider === 'github-actions');
  }
  if (provider === 'kubernetes') add('KUBECONFIG', 'kubernetes', 'Submit isolated Kubernetes jobs and read pod logs.');
  if (provider === 'e2b') add('E2B_API_KEY', 'e2b', 'Create remote code sandbox sessions.');
  if (provider === 'daytona') add('DAYTONA_API_KEY', 'daytona', 'Create managed development workspace sessions.');
  if (provider === 'firecracker') add('FIRECRACKER_SOCKET', 'firecracker', 'Submit microVM task through the local Firecracker controller.');

  if (requireDeployment) {
    if (deploymentProvider === 'vercel') add('VERCEL_DEPLOY_HOOK_URL', 'vercel', 'Trigger Vercel preview or production deploy hook.');
    if (deploymentProvider === 'railway') add('RAILWAY_DEPLOY_HOOK_URL', 'railway', 'Trigger Railway deployment hook.');
    if (deploymentProvider === 'fly') add('FLY_DEPLOY_HOOK_URL', 'fly', 'Trigger Fly.io deployment hook or automation bridge.');
    if (deploymentProvider === 'render') add('RENDER_DEPLOY_HOOK_URL', 'render', 'Trigger Render deploy hook and read deployment status.');
    if (deploymentProvider === 'kubernetes') add('KUBECONFIG', 'kubernetes', 'Apply manifests, rollout status, and rollback.');
    if (deploymentProvider === 'aws-ecs') add('AWS_ACCESS_KEY_ID', 'aws', 'Register ECS task definitions and update services.');
    if (deploymentProvider === 'aws-ecs') add('AWS_SECRET_ACCESS_KEY', 'aws', 'Authenticate ECS deployment operations.');
    if (deploymentProvider === 'gcp-cloud-run') add('GOOGLE_APPLICATION_CREDENTIALS', 'gcp', 'Deploy Cloud Run revisions and route traffic.');
    if (deploymentProvider === 'azure-container-apps') add('AZURE_CLIENT_ID', 'azure', 'Authenticate Azure Container Apps deployment.');
    if (deploymentProvider === 'azure-container-apps') add('AZURE_CLIENT_SECRET', 'azure', 'Authenticate Azure Container Apps deployment.');
    if (deploymentProvider === 'azure-container-apps') add('AZURE_TENANT_ID', 'azure', 'Authenticate Azure Container Apps deployment.');
  }
  return secrets;
}

export function buildAdapterManifest(input: {
  project: AgentProject;
  run: AgentProjectRun;
  workspacePlan: AgentProjectWorkspacePlan;
  provider: AgentProjectExecutionProvider;
  deploymentProvider: AgentProjectDeploymentProvider;
  targetEnvironment: AgentProjectTargetEnvironment;
  allowNetwork: boolean;
  requirePullRequest: boolean;
  requireDeployment: boolean;
}): AgentProjectExecutionFabricPlan['adapterManifest'] {
  const env = {
    AXON_PROJECT_ID: input.project.id,
    AXON_RUN_ID: input.run.id,
    AXON_TARGET_ENV: input.targetEnvironment,
    AXON_NETWORK: input.allowNetwork ? 'allowlisted' : 'offline',
  };
  const validationCommands = input.workspacePlan.commands
    .filter((commandItem) => commandItem.risk === 'low')
    .map((commandItem) => commandItem.command);
  const files: Array<{ path: string; content: string }> = [];
  let entrypoint = validationCommands[0] ?? 'git status --short';
  let kind = `${input.provider}-execution`;
  let unsupportedReason: string | undefined;

  if (input.provider === 'github-actions') {
    kind = 'github-actions-workflow';
    entrypoint = 'workflow_dispatch';
    files.push({
      path: '.github/workflows/axon-execution-fabric.yml',
      content: githubActionsWorkflow(input.project.name, validationCommands, input.requireDeployment, input.deploymentProvider),
    });
  } else if (input.provider === 'kubernetes') {
    entrypoint = 'kubectl apply -f deploy/axon-execution-job.yaml';
    files.push({
      path: 'deploy/axon-execution-job.yaml',
      content: kubernetesJobManifest(input.project.name, validationCommands),
    });
  } else if (input.provider === 'docker') {
    files.push({
      path: 'Dockerfile.axon-execution',
      content: [
        'FROM node:22-bookworm-slim',
        'WORKDIR /workspace',
        'COPY . .',
        'RUN npm ci && cd backend && npm ci',
        `CMD ["bash", "-lc", ${JSON.stringify(validationCommands.join(' && ') || 'git status --short')}]`,
      ].join('\n'),
    });
    entrypoint = 'docker build -f Dockerfile.axon-execution -t axon-execution . && docker run --rm axon-execution';
  } else if (input.provider !== 'local-process') {
    unsupportedReason = `${input.provider} provider contract is generated, but the live SDK client must be configured before remote submission.`;
    files.push({
      path: `.axon/providers/${input.provider}.json`,
      content: JSON.stringify({
        provider: input.provider,
        projectId: input.project.id,
        runId: input.run.id,
        commands: validationCommands,
        network: input.allowNetwork ? 'allowlisted' : 'offline',
        ttlMinutes: input.targetEnvironment === 'production' ? 240 : 90,
      }, null, 2),
    });
  }

  if (input.requireDeployment) {
    files.push({
      path: `.axon/deploy/${input.deploymentProvider}-${input.targetEnvironment}.json`,
      content: JSON.stringify({
        provider: input.deploymentProvider,
        environment: input.targetEnvironment,
        requiredEvidence: ['typecheck', 'tests', 'build', 'security scan', 'browser QA', 'rollback plan'],
        rollout: input.targetEnvironment === 'production' ? 'canary with rollback checkpoint' : 'preview deployment',
      }, null, 2),
    });
  }

  return {
    kind,
    entrypoint,
    environment: env,
    requiredSecrets: requiredExecutionSecrets(input.provider, input.deploymentProvider, input.requirePullRequest, input.requireDeployment)
      .filter((secret) => secret.required)
      .map((secret) => secret.name),
    files,
    unsupportedReason,
  };
}

export function buildExecutionFabricGates(input: {
  project: AgentProject;
  run: AgentProjectRun;
  execution?: AgentProjectExecution;
  provider: AgentProjectExecutionProvider;
  deploymentProvider: AgentProjectDeploymentProvider;
  targetEnvironment: AgentProjectTargetEnvironment;
  estimatedCostUsd: number;
  maxCostUsd: number;
  secretsRequired: AgentProjectExecutionFabricPlan['secretsRequired'];
  requirePullRequest: boolean;
  requireDeployment: boolean;
  allowNetwork: boolean;
}): AgentProjectExecutionFabricGate[] {
  const gates: AgentProjectExecutionFabricGate[] = [
    fabricGate(
      'project-readiness',
      'Project readiness allows provider execution',
      input.project.readiness.status === 'blocked' || input.project.securityPreset === 'unrestricted' ? 'block' : input.project.readiness.status === 'needs-review' ? 'warn' : 'pass',
      [`readiness=${input.project.readiness.status}`, `securityPreset=${input.project.securityPreset}`, ...input.project.readiness.blockers, ...input.project.readiness.warnings],
      'Fix project readiness blockers and avoid unrestricted mode before provider execution.'
    ),
    fabricGate(
      'budget-hard-stop',
      'Execution cost stays inside hard budget',
      input.estimatedCostUsd > input.maxCostUsd ? 'block' : input.estimatedCostUsd > input.maxCostUsd * 0.8 ? 'warn' : 'pass',
      [`estimatedCostUsd=${input.estimatedCostUsd}`, `maxCostUsd=${input.maxCostUsd}`],
      'Increase budget with approval or reduce provider/model/deployment scope.'
    ),
    fabricGate(
      'provider-adapter',
      'Provider adapter manifest is available',
      input.provider === 'local-process' ? 'pass' : 'warn',
      [`provider=${input.provider}`, input.provider === 'local-process' ? 'live local execution path enabled' : 'external provider client must be configured before live submission'],
      'Configure live provider credentials/client for remote execution.'
    ),
    fabricGate(
      'secrets',
      'Required provider secrets are declared',
      input.secretsRequired.length === 0 ? 'pass' : 'warn',
      input.secretsRequired.map((secret) => `${secret.name}: ${secret.purpose}`),
      'Add required secrets through Settings or environment before running a non-dry-run job.'
    ),
    fabricGate(
      'network',
      'Network posture is explicit',
      input.allowNetwork || input.provider === 'local-process' ? 'pass' : 'warn',
      [`allowNetwork=${input.allowNetwork}`, `provider=${input.provider}`],
      'Use offline mode for code-only validation, allowlisted mode for dependency install or browser/deploy flows.'
    ),
  ];

  if (input.requirePullRequest) {
    gates.push(fabricGate('pull-request', 'PR creation is part of the delivery path', 'warn', ['branch package and PR body required'], 'Approve GitHub PR creation after validation evidence exists.'));
  }
  if (input.run.browserPlan) {
    gates.push(fabricGate('browser-evidence', 'Browser evidence is required for this run', input.execution?.browserQaReportId ? 'pass' : 'warn', input.run.browserPlan.evidence, 'Attach browser QA report before customer or production handoff.'));
  }
  if (input.requireDeployment) {
    gates.push(fabricGate('deployment', 'Deployment provider has rollout and rollback gates', 'warn', [`deploymentProvider=${input.deploymentProvider}`, `target=${input.targetEnvironment}`], 'Run release gates and attach rollback checkpoint before live deployment.'));
  }
  if (input.targetEnvironment === 'production') {
    gates.push(fabricGate('production-approval', 'Production execution needs explicit human approval', 'warn', ['production target selected'], 'Approve cost, rollback, security, database, browser, and customer-impact gates.'));
  }
  return gates;
}

export function executionFabricStages(
  provider: AgentProjectExecutionProvider,
  deploymentProvider: AgentProjectDeploymentProvider,
  requirePullRequest: boolean,
  requireDeployment: boolean,
  gates: AgentProjectExecutionFabricGate[]
): AgentProjectExecutionFabricStage[] {
  const blocked = gates.some((gateItem) => gateItem.status === 'block');
  const stage = (
    id: string,
    title: string,
    stageProvider: string,
    action: string,
    status: AgentProjectExecutionFabricStage['status'] = blocked ? 'blocked' : 'planned',
    evidence: string[] = []
  ): AgentProjectExecutionFabricStage => ({ id, title, provider: stageProvider, action, status, evidence });
  const stages = [
    stage('preflight', 'Evaluate cost, policy, readiness, and rollout gates', 'axon', 'Validate execution fabric gates.'),
    stage('secrets', 'Resolve provider and deployment secrets', 'axon', 'Check runtime environment or provided secret handles.'),
    stage('manifest', 'Generate provider adapter manifest', provider, 'Create workflow, job, container, or sandbox launch contract.'),
    stage('provider-run', 'Submit or dry-run execution provider job', provider, 'Run safe validation path or remote sandbox task.'),
  ];
  if (requirePullRequest) stages.push(stage('pull-request', 'Prepare or create pull request', 'github', 'Create branch and PR package after validation evidence.'));
  if (requireDeployment) stages.push(stage('deploy', 'Deploy preview/staging/production release', deploymentProvider, 'Deploy through adapter with rollback checkpoint.'));
  stages.push(stage('evidence', 'Persist Trust Ledger and artifact evidence', 'axon', 'Attach run, provider, PR, deploy, and cost evidence.'));
  return stages;
}

export function executionFabricRollbackPlan(
  targetEnvironment: AgentProjectTargetEnvironment,
  deploymentProvider: AgentProjectDeploymentProvider
): string[] {
  const plan = [
    'Keep the original branch and workspace plan immutable until delivery evidence passes.',
    'Retain execution artifact, PR package, and validation outputs for diff review.',
    'Stop automation immediately if budget, security, database, or browser gates block.',
  ];
  if (deploymentProvider !== 'none') {
    plan.push(
      `Use ${deploymentProvider} previous release/revision as rollback target.`,
      targetEnvironment === 'production'
        ? 'Route traffic back to the previous stable revision before retrying production rollout.'
        : 'Delete or disable preview/staging environment if smoke tests fail.'
    );
  }
  return plan;
}

export function executionFabricLaunchInstructions(
  provider: AgentProjectExecutionProvider,
  deploymentProvider: AgentProjectDeploymentProvider,
  status: AgentProjectExecutionFabricPlan['status']
): string[] {
  const instructions = [
    `Review fabric plan status: ${status}.`,
    'Confirm required secrets are present and scoped to this project or environment.',
    'Run dry-run first to verify manifest, gates, PR body, and cost policy.',
  ];
  if (provider !== 'local-process') instructions.push(`Configure ${provider} client/SDK before live submission.`);
  if (deploymentProvider !== 'none') instructions.push(`Confirm ${deploymentProvider} rollback target and release environment before deploy.`);
  instructions.push('Run live fabric job only after approval and attach resulting artifact to delivery pack.');
  return instructions;
}

export function secretAvailable(name: string, providedSecrets?: string[]) {
  return Boolean(process.env[name] || providedSecrets?.includes(name));
}

interface ProviderActionResult {
  status: 'submitted' | 'blocked' | 'failed';
  externalId?: string;
  url?: string;
  evidence: string[];
  error?: string;
}

export async function submitProviderRun(plan: AgentProjectExecutionFabricPlan): Promise<ProviderActionResult> {
  if (plan.provider === 'github-actions') return dispatchGitHubActionsWorkflow(plan);
  if (plan.provider === 'docker') return runDockerProvider(plan);
  if (plan.provider === 'kubernetes') return runKubernetesProvider(plan);
  if (['e2b', 'daytona', 'firecracker', 'codespaces'].includes(plan.provider)) return submitRemoteSandboxProvider(plan);
  return {
    status: 'blocked',
    evidence: [
      `provider=${plan.provider}`,
      plan.adapterManifest.unsupportedReason ?? 'live provider client is not configured in this runtime',
      ...plan.adapterManifest.requiredSecrets.map((secret) => `requires ${secret}`),
    ],
    error: `${plan.provider} provider manifest is ready, but the live SDK/client bridge is not connected yet.`,
  };
}

async function runDockerProvider(plan: AgentProjectExecutionFabricPlan): Promise<ProviderActionResult> {
  if (process.env.AXON_ENABLE_DOCKER_RUN !== 'true') {
    return {
      status: 'blocked',
      evidence: ['AXON_ENABLE_DOCKER_RUN is not true', 'docker provider is manifest-ready but local Docker execution is disabled'],
      error: 'Set AXON_ENABLE_DOCKER_RUN=true after reviewing the fabric plan to run Docker validation.',
    };
  }
  const root = resolveAxonRoot();
  const command = process.env.AXON_DOCKER_COMMAND || [
    'docker',
    'run',
    '--rm',
    '-e',
    'AXON_EXECUTION_FABRIC=1',
    '-v',
    `"${escapeShell(root)}:/workspace"`,
    '-w',
    '/workspace',
    'node:22-bookworm-slim',
    'bash',
    '-lc',
    JSON.stringify(providerValidationCommand(plan)),
  ].join(' ');
  const result = await runProviderShellCommand(command, root, Number(process.env.AXON_DOCKER_TIMEOUT_MS ?? 180_000));
  return {
    status: result.status,
    externalId: `docker_${plan.id}`,
    evidence: [
      `docker command ${result.status}`,
      `durationMs=${result.durationMs}`,
      `stdout=${result.stdout.slice(-1200) || '<empty>'}`,
      result.stderr ? `stderr=${result.stderr.slice(-1200)}` : 'stderr=<empty>',
    ],
    error: result.status === 'submitted' ? undefined : result.stderr || `Docker command exited ${result.exitCode ?? 'unknown'}`,
  };
}

async function runKubernetesProvider(plan: AgentProjectExecutionFabricPlan): Promise<ProviderActionResult> {
  if (process.env.AXON_ENABLE_KUBERNETES_RUN !== 'true') {
    return {
      status: 'blocked',
      evidence: ['AXON_ENABLE_KUBERNETES_RUN is not true', 'kubernetes provider is manifest-ready but cluster submission is disabled'],
      error: 'Set AXON_ENABLE_KUBERNETES_RUN=true and KUBECONFIG after reviewing the fabric plan.',
    };
  }
  if (!process.env.KUBECONFIG && !process.env.AXON_KUBECONFIG_IN_CLUSTER) {
    return {
      status: 'blocked',
      evidence: ['missing KUBECONFIG', 'AXON_KUBECONFIG_IN_CLUSTER is not set'],
      error: 'Kubernetes execution requires KUBECONFIG or an in-cluster service account.',
    };
  }
  const materialized = await materializeAdapterManifest(plan);
  const manifest = materialized.files.find((file) => file.endsWith('deploy/axon-execution-job.yaml') || file.endsWith('deploy\\axon-execution-job.yaml'));
  const manifestFile = plan.adapterManifest.files.find((file) => file.path === 'deploy/axon-execution-job.yaml');
  if (!manifest) {
    return {
      status: 'blocked',
      evidence: ['kubernetes manifest not found in adapter manifest'],
      error: 'Execution Fabric plan did not include deploy/axon-execution-job.yaml.',
    };
  }
  const namespace = process.env.AXON_KUBE_NAMESPACE || 'default';
  const apply = await runProviderShellCommand(`kubectl apply -n ${namespace} -f "${escapeShell(manifest)}"`, materialized.directory, 60_000);
  if (apply.status !== 'submitted') {
    return {
      status: apply.status,
      evidence: [`kubectl apply ${apply.status}`, apply.stdout.slice(-1200), apply.stderr.slice(-1200)],
      error: apply.stderr || 'kubectl apply failed',
    };
  }
  const jobName = kubernetesJobName(manifestFile?.content, `axon-${slug(plan.projectId)}-execution`);
  const wait = await runProviderShellCommand(`kubectl wait -n ${namespace} --for=condition=complete --timeout=180s job/${jobName}`, materialized.directory, 210_000);
  const logs = await runProviderShellCommand(`kubectl logs -n ${namespace} job/${jobName}`, materialized.directory, 60_000);
  await runProviderShellCommand(`kubectl delete -n ${namespace} job/${jobName} --ignore-not-found=true`, materialized.directory, 60_000);
  const status = wait.status === 'submitted' && logs.status === 'submitted' ? 'submitted' : wait.status === 'failed' || logs.status === 'failed' ? 'failed' : 'blocked';
  return {
    status,
    externalId: `kubernetes_${namespace}_${jobName}`,
    evidence: [
      `kubectl apply ${apply.status}`,
      `kubectl wait ${wait.status}`,
      `kubectl logs ${logs.status}`,
      logs.stdout.slice(-1800) || '<no logs>',
      logs.stderr.slice(-800) || '<no stderr>',
    ],
    error: status === 'submitted' ? undefined : wait.stderr || logs.stderr || 'Kubernetes job did not complete.',
  };
}

async function submitRemoteSandboxProvider(plan: AgentProjectExecutionFabricPlan): Promise<ProviderActionResult> {
  const config = remoteSandboxConfig(plan.provider);
  if (!config?.url) {
    return {
      status: 'blocked',
      evidence: [
        `provider=${plan.provider}`,
        'remote sandbox bridge URL is not configured',
        `expected env ${remoteSandboxEnv(plan.provider).urlEnv}`,
      ],
      error: `Set ${remoteSandboxEnv(plan.provider).urlEnv} and provider API key to submit ${plan.provider} jobs.`,
    };
  }
  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'AXON-Execution-Fabric',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      source: 'AXON Execution Fabric',
      provider: plan.provider,
      planId: plan.id,
      runId: plan.runId,
      targetEnvironment: plan.targetEnvironment,
      commands: providerValidationCommand(plan),
      adapterManifest: plan.adapterManifest,
    }),
  });
  const payloadText = await response.text().catch(() => '');
  if (response.ok) {
    const payload = safeJson(payloadText) as { id?: string; url?: string; run_url?: string };
    return {
      status: 'submitted',
      externalId: payload.id ?? `${plan.provider}_${plan.id}`,
      url: payload.url ?? payload.run_url,
      evidence: [`${plan.provider} remote sandbox submitted`, `HTTP ${response.status}`, payloadText.slice(0, 1000)],
    };
  }
  return {
    status: response.status >= 500 ? 'failed' : 'blocked',
    evidence: [`${plan.provider} remote sandbox HTTP ${response.status}`, payloadText.slice(0, 1000)],
    error: `${plan.provider} remote sandbox submission failed with HTTP ${response.status}.`,
  };
}

async function dispatchGitHubActionsWorkflow(plan: AgentProjectExecutionFabricPlan): Promise<ProviderActionResult> {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const workflowId = process.env.AXON_GITHUB_WORKFLOW_ID || 'axon-execution-fabric.yml';
  const ref = process.env.AXON_GITHUB_REF || process.env.GITHUB_REF_NAME || 'main';
  if (!token || !repository) {
    return {
      status: 'blocked',
      evidence: ['missing GITHUB_TOKEN or GITHUB_REPOSITORY', `workflow=${workflowId}`, `ref=${ref}`],
      error: 'Set GITHUB_TOKEN and GITHUB_REPOSITORY to dispatch the Execution Fabric workflow.',
    };
  }
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) {
    return {
      status: 'blocked',
      evidence: [`invalid GITHUB_REPOSITORY=${repository}`],
      error: 'GITHUB_REPOSITORY must be in owner/repo format.',
    };
  }

  const response = await fetch(`https://api.github.com/repos/${repository}/actions/workflows/${encodeURIComponent(workflowId)}/dispatches`, {
    method: 'POST',
    headers: githubHeaders(token),
    body: JSON.stringify({
      ref,
      inputs: {
        axon_plan_id: plan.id,
        axon_run_id: plan.runId,
        axon_environment: plan.targetEnvironment,
      },
    }),
  });

  if (response.status === 204) {
    return {
      status: 'submitted',
      externalId: `${repository}:${workflowId}:${ref}`,
      url: `https://github.com/${repository}/actions/workflows/${workflowId}`,
      evidence: [`GitHub Actions workflow dispatched`, `repository=${repository}`, `workflow=${workflowId}`, `ref=${ref}`],
    };
  }

  const body = await response.text().catch(() => response.statusText);
  return {
    status: response.status >= 500 ? 'failed' : 'blocked',
    evidence: [`GitHub Actions dispatch HTTP ${response.status}`, body.slice(0, 500)],
    error: `GitHub Actions dispatch failed with HTTP ${response.status}.`,
  };
}

export async function submitGitHubPullRequest(prPackage: AgentProjectPullRequestPackage): Promise<ProviderActionResult> {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const head = process.env.AXON_GITHUB_HEAD_BRANCH || process.env.GITHUB_HEAD_REF || prPackage.branchName;
  const base = process.env.AXON_GITHUB_BASE_BRANCH || process.env.GITHUB_BASE_REF || 'main';
  if (!token || !repository) {
    return {
      status: 'blocked',
      evidence: ['missing GITHUB_TOKEN or GITHUB_REPOSITORY', `head=${head}`, `base=${base}`],
      error: 'Set GITHUB_TOKEN and GITHUB_REPOSITORY to create a live GitHub pull request.',
    };
  }
  if (!process.env.AXON_GITHUB_HEAD_BRANCH && !process.env.GITHUB_HEAD_REF) {
    return {
      status: 'blocked',
      evidence: [`planned branch=${head}`, 'live PR requires an existing remote branch'],
      error: 'Push or provide AXON_GITHUB_HEAD_BRANCH before live PR creation.',
    };
  }

  const response = await fetch(`https://api.github.com/repos/${repository}/pulls`, {
    method: 'POST',
    headers: githubHeaders(token),
    body: JSON.stringify({
      title: prPackage.title,
      head,
      base,
      body: prPackage.bodyMarkdown,
      draft: true,
      maintainer_can_modify: true,
    }),
  });
  const payloadText = await response.text().catch(() => '');
  if (response.status === 201) {
    const payload = safeJson(payloadText) as { number?: number; html_url?: string };
    return {
      status: 'submitted',
      externalId: payload.number ? `pr_${payload.number}` : undefined,
      url: payload.html_url,
      evidence: [`GitHub draft PR created`, `repository=${repository}`, `head=${head}`, `base=${base}`],
    };
  }
  return {
    status: response.status >= 500 ? 'failed' : 'blocked',
    evidence: [`GitHub PR create HTTP ${response.status}`, payloadText.slice(0, 500)],
    error: `GitHub PR creation failed with HTTP ${response.status}.`,
  };
}

export async function submitDeployment(plan: AgentProjectExecutionFabricPlan): Promise<ProviderActionResult> {
  const hook = deploymentHookFor(plan.deploymentProvider);
  if (!hook) {
    return {
      status: 'blocked',
      evidence: [`deploymentProvider=${plan.deploymentProvider}`, 'missing deploy hook URL or live SDK bridge'],
      error: `Set a deploy hook env var for ${plan.deploymentProvider}, or connect its live deployment adapter.`,
    };
  }
  const response = await fetch(hook.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'AXON-Execution-Fabric' },
    body: JSON.stringify({
      source: 'AXON Execution Fabric',
      planId: plan.id,
      runId: plan.runId,
      environment: plan.targetEnvironment,
      provider: plan.deploymentProvider,
    }),
  });
  const payloadText = await response.text().catch(() => '');
  if (response.ok) {
    const payload = safeJson(payloadText) as { url?: string; deploy_url?: string; id?: string };
    return {
      status: 'submitted',
      externalId: payload.id,
      url: payload.url ?? payload.deploy_url ?? hook.displayUrl,
      evidence: [`${plan.deploymentProvider} deployment hook submitted`, `HTTP ${response.status}`, `hook=${hook.name}`],
    };
  }
  return {
    status: response.status >= 500 ? 'failed' : 'blocked',
    evidence: [`${plan.deploymentProvider} deployment HTTP ${response.status}`, payloadText.slice(0, 500)],
    error: `${plan.deploymentProvider} deployment submission failed with HTTP ${response.status}.`,
  };
}

function deploymentHookFor(provider: AgentProjectDeploymentProvider): { name: string; url: string; displayUrl?: string } | undefined {
  const envByProvider: Partial<Record<AgentProjectDeploymentProvider, string>> = {
    vercel: 'VERCEL_DEPLOY_HOOK_URL',
    railway: 'RAILWAY_DEPLOY_HOOK_URL',
    fly: 'FLY_DEPLOY_HOOK_URL',
    render: 'RENDER_DEPLOY_HOOK_URL',
  };
  const envName = envByProvider[provider];
  const url = (envName && process.env[envName]) || process.env.AXON_DEPLOY_HOOK_URL;
  if (!url) return undefined;
  return { name: envName ?? 'AXON_DEPLOY_HOOK_URL', url, displayUrl: url.replace(/([?&](token|key|secret)=)[^&]+/gi, '$1***') };
}

async function materializeAdapterManifest(plan: AgentProjectExecutionFabricPlan): Promise<{ directory: string; files: string[] }> {
  const root = resolveAxonRoot();
  const directory = path.join(root, '.axon', 'execution-fabric', plan.id);
  await mkdir(directory, { recursive: true });
  const files: string[] = [];
  for (const file of plan.adapterManifest.files) {
    const target = path.resolve(directory, file.path);
    if (!target.startsWith(directory)) throw new Error(`Adapter manifest path escapes execution directory: ${file.path}`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content, 'utf8');
    files.push(target);
  }
  return { directory, files };
}

function providerValidationCommand(plan: AgentProjectExecutionFabricPlan): string {
  const override = process.env.AXON_PROVIDER_VALIDATION_COMMAND;
  if (override) return override;
  if (/npm run typecheck/.test(plan.adapterManifest.entrypoint)) return 'npm run typecheck';
  if (/git status/.test(plan.adapterManifest.entrypoint)) return 'git status --short';
  return 'git status --short && npm run typecheck';
}

function resolveAxonRoot() {
  const cwd = process.cwd();
  return path.basename(cwd) === 'backend' ? path.resolve(cwd, '..') : cwd;
}

function runProviderShellCommand(
  commandText: string,
  cwd: string,
  timeoutMs: number
): Promise<{ status: ProviderActionResult['status']; exitCode?: number; stdout: string; stderr: string; durationMs: number }> {
  return new Promise((resolve) => {
    const started = Date.now();
    let stdout = '';
    let stderr = '';
    let finished = false;
    const child = spawn(commandText, {
      cwd,
      shell: true,
      windowsHide: true,
      env: {
        ...process.env,
        AXON_EXECUTION_FABRIC_PROVIDER: '1',
      },
    });
    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill();
      resolve({
        status: 'failed',
        stdout,
        stderr: stderr || `Timed out after ${timeoutMs}ms`,
        durationMs: Math.max(1, Date.now() - started),
      });
    }, timeoutMs);
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout = trimCommandOutput(stdout + chunk.toString());
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = trimCommandOutput(stderr + chunk.toString());
    });
    child.on('error', (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve({
        status: 'failed',
        stdout,
        stderr: stderr || error.message,
        durationMs: Math.max(1, Date.now() - started),
      });
    });
    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve({
        status: code === 0 ? 'submitted' : 'failed',
        exitCode: code ?? undefined,
        stdout,
        stderr,
        durationMs: Math.max(1, Date.now() - started),
      });
    });
  });
}

function remoteSandboxConfig(provider: AgentProjectExecutionProvider): { url?: string; apiKey?: string } | undefined {
  const env = remoteSandboxEnv(provider);
  return {
    url: process.env[env.urlEnv],
    apiKey: env.keyEnv ? process.env[env.keyEnv] : undefined,
  };
}

function remoteSandboxEnv(provider: AgentProjectExecutionProvider): { urlEnv: string; keyEnv?: string } {
  if (provider === 'e2b') return { urlEnv: 'E2B_RUN_URL', keyEnv: 'E2B_API_KEY' };
  if (provider === 'daytona') return { urlEnv: 'DAYTONA_RUN_URL', keyEnv: 'DAYTONA_API_KEY' };
  if (provider === 'firecracker') return { urlEnv: 'FIRECRACKER_RUN_URL', keyEnv: 'FIRECRACKER_API_KEY' };
  if (provider === 'codespaces') return { urlEnv: 'CODESPACES_RUN_URL', keyEnv: 'GITHUB_TOKEN' };
  return { urlEnv: 'AXON_REMOTE_SANDBOX_RUN_URL', keyEnv: 'AXON_REMOTE_SANDBOX_API_KEY' };
}

function kubernetesJobName(content: string | undefined, fallback: string): string {
  const match = content?.match(/\n\s*name:\s*([a-z0-9.-]+)/i);
  return match?.[1] ?? fallback;
}

function escapeShell(value: string): string {
  return value.replace(/"/g, '\\"');
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'AXON-Execution-Fabric',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function fabricGate(
  id: string,
  title: string,
  status: AgentProjectExecutionFabricGate['status'],
  evidence: string[],
  nextAction: string
): AgentProjectExecutionFabricGate {
  return { id, title, status, evidence, nextAction };
}

function githubActionsWorkflow(
  projectName: string,
  validationCommands: string[],
  requireDeployment: boolean,
  deploymentProvider: AgentProjectDeploymentProvider
) {
  const commands = validationCommands.length ? validationCommands : ['git status --short', 'npm run typecheck'];
  return [
    `name: AXON Execution Fabric - ${projectName}`,
    'on:',
    '  workflow_dispatch:',
    'jobs:',
    '  validate:',
    '    runs-on: ubuntu-latest',
    '    timeout-minutes: 30',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: actions/setup-node@v4',
    '        with:',
    "          node-version: '22'",
    '      - name: Install frontend dependencies',
    '        run: npm ci',
    '      - name: Install backend dependencies',
    '        run: cd backend && npm ci',
    ...commands.flatMap((commandItem, index) => [
      `      - name: AXON validation ${index + 1}`,
      `        run: ${commandItem}`,
    ]),
    ...(requireDeployment ? [
      '      - name: Deployment gate',
      `        run: echo "Deployment provider ${deploymentProvider} requires AXON release approval before live deploy"`,
    ] : []),
  ].join('\n');
}

function kubernetesJobManifest(projectName: string, validationCommands: string[]) {
  const commandText = (validationCommands.length ? validationCommands : ['git status --short']).join(' && ');
  return [
    'apiVersion: batch/v1',
    'kind: Job',
    'metadata:',
    `  name: axon-${slug(projectName)}-execution`,
    'spec:',
    '  backoffLimit: 0',
    '  template:',
    '    spec:',
    '      restartPolicy: Never',
    '      containers:',
    '        - name: runner',
    '          image: node:22-bookworm-slim',
    '          workingDir: /workspace',
    '          command: ["bash", "-lc"]',
    `          args: [${JSON.stringify(commandText)}]`,
    '          resources:',
    '            requests:',
    '              cpu: "500m"',
    '              memory: "1Gi"',
    '            limits:',
    '              cpu: "2"',
    '              memory: "4Gi"',
  ].join('\n');
}

export function roundMoney(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'project';
}
