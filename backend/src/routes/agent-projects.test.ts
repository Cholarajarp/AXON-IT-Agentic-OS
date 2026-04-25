import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerAgentProjectRoutes } from './agent-projects.js';

describe('agent project routes', () => {
  it('creates a project, plans dynamic subagents, and schedules autonomous work', async () => {
    const app = Fastify();
    await app.register(registerAgentProjectRoutes);

    const projectResponse = await app.inject({
      method: 'POST',
      url: '/agent-projects/projects',
      payload: {
        name: 'AXON capability command center',
        objective: 'Beat agent-first developer platforms with project-scoped autonomous IT delivery.',
        folders: [
          { path: '.', type: 'git-checkout', writable: true, reason: 'Canonical root' },
          { path: 'backend', type: 'local-folder', writable: true, reason: 'API services' },
          { path: 'src', type: 'local-folder', writable: true, reason: 'Web command OS' },
        ],
        securityPreset: 'default',
        worktreeMode: 'new-worktree',
        reviewPolicy: 'request-review',
      },
    });

    expect(projectResponse.statusCode).toBe(201);
    const project = projectResponse.json();
    expect(project.id).toMatch(/^apj_/);
    expect(project.readiness.status).toBe('ready');

    const runResponse = await app.inject({
      method: 'POST',
      url: '/agent-projects/runs',
      payload: {
        projectId: project.id,
        prompt: '/browser verify the generated product preview and produce video evidence before release',
        mode: 'planning',
      },
    });

    expect(runResponse.statusCode).toBe(201);
    const run = runResponse.json();
    expect(run.command).toBe('browser');
    expect(run.subagents.some((agent: { name: string }) => agent.name === 'BrowserQAAgent')).toBe(true);
    expect(run.artifacts[0].sha256).toHaveLength(64);
    expect(run.status).toBe('review-required');

    const workspaceResponse = await app.inject({
      method: 'POST',
      url: `/agent-projects/runs/${run.id}/workspace-plan`,
    });
    expect(workspaceResponse.statusCode).toBe(201);
    expect(workspaceResponse.json().commands.some((item: { command: string }) => item.command.includes('git worktree add'))).toBe(true);

    const executionResponse = await app.inject({
      method: 'POST',
      url: '/agent-projects/executions',
      payload: {
        runId: run.id,
        autonomyLevel: 'supervised',
        createSandbox: false,
      },
    });
    expect(executionResponse.statusCode).toBe(201);
    const execution = executionResponse.json();
    expect(execution.blackboardId).toMatch(/^bb_/);
    expect(execution.workspacePlanId).toMatch(/^wsp_/);
    expect(execution.gates.length).toBeGreaterThanOrEqual(4);

    const commandResponse = await app.inject({
      method: 'POST',
      url: `/agent-projects/executions/${execution.id}/commands`,
      payload: {
        commandIndex: 0,
        timeoutMs: 20000,
      },
    });
    expect(commandResponse.statusCode).toBe(201);
    expect(commandResponse.json().status).toBe('passed');
    expect(commandResponse.json().artifactId).toMatch(/^art_/);

    const browserEvidenceResponse = await app.inject({
      method: 'POST',
      url: `/agent-projects/executions/${execution.id}/browser-evidence`,
      payload: {
        htmlSnapshot: '<!doctype html><html lang="en"><head><title>AXON Preview</title></head><body><main><h1>Preview</h1><button>Start</button></main></body></html>',
      },
    });
    expect(browserEvidenceResponse.statusCode).toBe(201);
    expect(browserEvidenceResponse.json().report.id).toMatch(/^qa_/);
    expect(browserEvidenceResponse.json().artifact.sha256).toHaveLength(64);

    const recapResponse = await app.inject({
      method: 'POST',
      url: `/agent-projects/runs/${run.id}/recap`,
    });
    expect(recapResponse.statusCode).toBe(201);
    expect(recapResponse.json().resumePrompt).toContain(run.id);

    const deliveryPackResponse = await app.inject({
      method: 'POST',
      url: `/agent-projects/executions/${execution.id}/delivery-pack`,
    });
    expect(deliveryPackResponse.statusCode).toBe(201);
    expect(deliveryPackResponse.json().artifactId).toMatch(/^art_/);

    const deliveryJobResponse = await app.inject({
      method: 'POST',
      url: '/agent-projects/delivery-jobs',
      payload: {
        runId: run.id,
        autonomyLevel: 'supervised',
        executeApprovedCommands: false,
        requireBrowserEvidence: true,
      },
    });
    expect(deliveryJobResponse.statusCode).toBe(201);
    const deliveryJob = deliveryJobResponse.json();
    expect(deliveryJob.id).toMatch(/^job_/);
    expect(deliveryJob.stages.map((stage: { id: string }) => stage.id)).toContain('delivery-pack');

    const runJobResponse = await app.inject({
      method: 'POST',
      url: `/agent-projects/delivery-jobs/${deliveryJob.id}/run`,
    });
    expect(runJobResponse.statusCode).toBe(201);
    expect(['completed', 'blocked']).toContain(runJobResponse.json().status);
    expect(runJobResponse.json().executionId).toMatch(/^apx_/);
    expect(runJobResponse.json().control.progress).toBeGreaterThan(0);

    const deliveryJobEventsResponse = await app.inject({
      method: 'GET',
      url: `/agent-projects/delivery-jobs/${deliveryJob.id}/events?limit=10`,
    });
    expect(deliveryJobEventsResponse.statusCode).toBe(200);
    expect(deliveryJobEventsResponse.json().events.length).toBeGreaterThan(0);
    expect(deliveryJobEventsResponse.json().control.lastEventId).toMatch(/^evt_/);

    const deliveryJobHeartbeatResponse = await app.inject({
      method: 'POST',
      url: `/agent-projects/delivery-jobs/${deliveryJob.id}/heartbeat`,
      payload: {
        leaseOwner: 'vitest-operator',
        progress: 80,
        stageId: 'commands',
        message: 'Route test heartbeat.',
      },
    });
    expect(deliveryJobHeartbeatResponse.statusCode).toBe(201);
    expect(deliveryJobHeartbeatResponse.json().control.heartbeatAt).toBeTruthy();

    const jobsResponse = await app.inject({ method: 'GET', url: `/agent-projects/delivery-jobs?runId=${run.id}` });
    expect(jobsResponse.statusCode).toBe(200);
    expect(jobsResponse.json().jobs.length).toBeGreaterThanOrEqual(1);

    const templatesResponse = await app.inject({ method: 'GET', url: '/agent-projects/templates' });
    expect(templatesResponse.statusCode).toBe(200);
    expect(templatesResponse.json().templates.length).toBeGreaterThanOrEqual(3);

    const sdkManifestResponse = await app.inject({ method: 'GET', url: '/agent-projects/sdk-manifest?apiBase=http://localhost:3001/api/v1' });
    expect(sdkManifestResponse.statusCode).toBe(200);
    expect(sdkManifestResponse.json().mcpTools.some((tool: { name: string }) => tool.name === 'agent_projects.launch')).toBe(true);

    const runtimeProfileResponse = await app.inject({
      method: 'POST',
      url: `/agent-projects/projects/${project.id}/runtime-profile`,
      payload: { runId: run.id },
    });
    expect(runtimeProfileResponse.statusCode).toBe(201);
    expect(runtimeProfileResponse.json().agentFiles.length).toBeGreaterThan(0);
    expect(runtimeProfileResponse.json().mcpConfig.path).toBe('.axon/mcp.json');

    const hookRunResponse = await app.inject({
      method: 'POST',
      url: '/agent-projects/hooks/run',
      payload: {
        projectId: project.id,
        runId: run.id,
        event: 'loop-stop',
        approved: true,
        payload: { previewUrl: 'http://localhost:5173' },
      },
    });
    expect(hookRunResponse.statusCode).toBe(201);
    expect(hookRunResponse.json().artifactId).toMatch(/^art_/);

    const prPackageResponse = await app.inject({
      method: 'POST',
      url: `/agent-projects/runs/${run.id}/pr-package`,
      payload: { executionId: execution.id },
    });
    expect(prPackageResponse.statusCode).toBe(201);
    expect(prPackageResponse.json().bodyMarkdown).toContain('Validation Evidence');

    const fabricPlanResponse = await app.inject({
      method: 'POST',
      url: '/agent-projects/execution-fabric/plans',
      payload: {
        runId: run.id,
        executionId: execution.id,
        provider: 'local-process',
        targetEnvironment: 'preview',
        maxCostUsd: 20,
      },
    });
    expect(fabricPlanResponse.statusCode).toBe(201);
    const fabricPlan = fabricPlanResponse.json();
    expect(fabricPlan.id).toMatch(/^xfp_/);
    expect(fabricPlan.costPolicy.modelFinOpsReportId).toMatch(/^finops_/);
    expect(fabricPlan.adapterManifest.kind).toBe('local-process-execution');

    const fabricRunResponse = await app.inject({
      method: 'POST',
      url: '/agent-projects/execution-fabric/jobs',
      payload: {
        planId: fabricPlan.id,
        dryRun: true,
      },
    });
    expect(fabricRunResponse.statusCode).toBe(201);
    expect(fabricRunResponse.json().status).toBe('completed');
    expect(fabricRunResponse.json().artifactId).toMatch(/^art_/);
    expect(fabricRunResponse.json().control.progress).toBe(100);

    const fabricEventsResponse = await app.inject({
      method: 'GET',
      url: `/agent-projects/execution-fabric/jobs/${fabricRunResponse.json().id}/events?limit=10`,
    });
    expect(fabricEventsResponse.statusCode).toBe(200);
    expect(fabricEventsResponse.json().events.length).toBeGreaterThan(0);

    const fabricHeartbeatResponse = await app.inject({
      method: 'POST',
      url: `/agent-projects/execution-fabric/jobs/${fabricRunResponse.json().id}/heartbeat`,
      payload: {
        leaseOwner: 'vitest-release',
        progress: 100,
        stageId: 'evidence',
        message: 'Fabric route test heartbeat.',
      },
    });
    expect(fabricHeartbeatResponse.statusCode).toBe(201);
    expect(fabricHeartbeatResponse.json().control.heartbeatAt).toBeTruthy();

    const githubFabricPlanResponse = await app.inject({
      method: 'POST',
      url: '/agent-projects/execution-fabric/plans',
      payload: {
        runId: run.id,
        provider: 'github-actions',
        targetEnvironment: 'staging',
        maxCostUsd: 30,
        requirePullRequest: true,
      },
    });
    expect(githubFabricPlanResponse.statusCode).toBe(201);
    const githubFabricPlan = githubFabricPlanResponse.json();
    expect(githubFabricPlan.adapterManifest.kind).toBe('github-actions-workflow');
    expect(githubFabricPlan.adapterManifest.requiredSecrets).toContain('GITHUB_TOKEN');

    const blockedLiveFabricResponse = await app.inject({
      method: 'POST',
      url: '/agent-projects/execution-fabric/jobs',
      payload: {
        planId: githubFabricPlan.id,
        dryRun: false,
        approved: true,
      },
    });
    expect(blockedLiveFabricResponse.statusCode).toBe(409);
    expect(blockedLiveFabricResponse.json().status).toBe('blocked');
    expect(blockedLiveFabricResponse.json().error).toContain('Missing required secret');

    const dockerFabricPlanResponse = await app.inject({
      method: 'POST',
      url: '/agent-projects/execution-fabric/plans',
      payload: {
        runId: run.id,
        provider: 'docker',
        targetEnvironment: 'preview',
        maxCostUsd: 20,
      },
    });
    expect(dockerFabricPlanResponse.statusCode).toBe(201);
    const previousDockerRun = process.env.AXON_ENABLE_DOCKER_RUN;
    delete process.env.AXON_ENABLE_DOCKER_RUN;
    const dockerBlockedResponse = await app.inject({
      method: 'POST',
      url: '/agent-projects/execution-fabric/jobs',
      payload: {
        planId: dockerFabricPlanResponse.json().id,
        dryRun: false,
        approved: true,
      },
    });
    if (previousDockerRun) process.env.AXON_ENABLE_DOCKER_RUN = previousDockerRun;
    expect(dockerBlockedResponse.statusCode).toBe(409);
    expect(dockerBlockedResponse.json().error).toContain('AXON_ENABLE_DOCKER_RUN');

    const fabricPlansResponse = await app.inject({ method: 'GET', url: `/agent-projects/execution-fabric/plans?runId=${run.id}` });
    expect(fabricPlansResponse.statusCode).toBe(200);
    expect(fabricPlansResponse.json().plans.length).toBeGreaterThanOrEqual(1);

    const scheduleResponse = await app.inject({
      method: 'POST',
      url: '/agent-projects/schedules',
      payload: {
        projectId: project.id,
        instruction: '/goal run one production readiness audit and open blockers',
        schedule: '2020-01-01T00:00:00.000Z',
      },
    });

    expect(scheduleResponse.statusCode).toBe(201);
    expect(scheduleResponse.json().command).toBe('goal');

    const dispatchResponse = await app.inject({
      method: 'POST',
      url: '/agent-projects/schedules/run-due',
      payload: {
        now: '2026-05-20T09:00:00.000Z',
        launch: true,
        createSandbox: false,
        autonomyLevel: 'supervised',
      },
    });
    expect(dispatchResponse.statusCode).toBe(201);
    expect(dispatchResponse.json().createdRunIds.length).toBe(1);
    expect(dispatchResponse.json().launchedExecutionIds.length).toBe(1);

    const workerStatusResponse = await app.inject({ method: 'GET', url: '/agent-projects/worker/status' });
    expect(workerStatusResponse.statusCode).toBe(200);
    expect(workerStatusResponse.json().running).toBe(false);

    const workerTickResponse = await app.inject({
      method: 'POST',
      url: '/agent-projects/worker/tick',
      payload: { now: '2026-05-20T09:01:00.000Z', launch: false },
    });
    expect(workerTickResponse.statusCode).toBe(201);

    const roadmap = await app.inject({ method: 'GET', url: '/agent-projects/capability-roadmap' });
    expect(roadmap.statusCode).toBe(200);
    expect(roadmap.json().readinessScore).toBeGreaterThan(0);
    expect(roadmap.json().capabilityMatrix.length).toBeGreaterThanOrEqual(8);

    await app.close();
  });
});
