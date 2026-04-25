import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { agentProjects } from '../agent-projects/index.js';

const folderSchema = z.object({
  path: z.string().min(1),
  type: z.enum(['local-folder', 'git-checkout', 'external-context']),
  writable: z.boolean(),
  reason: z.string().min(1),
});

const hookSchema = z.object({
  id: z.string().min(1),
  event: z.enum(['before-tool-call', 'after-model-response', 'artifact-review', 'loop-stop', 'browser-session']),
  action: z.string().min(1),
  policy: z.string().min(1),
  enabled: z.boolean(),
});

const permissionSchema = z.object({
  scope: z.string().min(1),
  grant: z.enum(['read', 'write', 'execute', 'browser', 'network', 'secret']),
  persistence: z.enum(['conversation', 'project']),
  risk: z.enum(['low', 'medium', 'high', 'critical']),
});

const projectSchema = z.object({
  tenantId: z.string().min(1).optional(),
  name: z.string().min(2),
  objective: z.string().min(8),
  folders: z.array(folderSchema).max(20).optional(),
  securityPreset: z.enum(['restricted', 'default', 'full-machine', 'unrestricted']).optional(),
  worktreeMode: z.enum(['local', 'new-worktree']).optional(),
  reviewPolicy: z.enum(['request-review', 'always-proceed']).optional(),
  skills: z.array(z.string().min(1)).max(30).optional(),
  mcpServers: z.array(z.string().min(1)).max(30).optional(),
  hooks: z.array(hookSchema).max(30).optional(),
  permissions: z.array(permissionSchema).max(50).optional(),
});

const templateProjectSchema = z.object({
  templateId: z.string().min(1),
  tenantId: z.string().min(1).optional(),
  name: z.string().min(2).optional(),
  objective: z.string().min(8).optional(),
});

const runSchema = z.object({
  projectId: z.string().min(1),
  prompt: z.string().min(3),
  mode: z.enum(['planning', 'fast']).optional(),
  voiceTranscript: z.string().min(1).optional(),
  requestedCommand: z.enum(['goal', 'grill-me', 'schedule', 'browser', 'none']).optional(),
});

const scheduleSchema = z.object({
  projectId: z.string().min(1),
  instruction: z.string().min(3),
  schedule: z.string().min(2),
  timezone: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });
const autonomyLevelSchema = z.enum(['manual', 'supervised', 'autonomous', 'production-autopilot']);
const launchSchema = z.object({
  runId: z.string().min(1),
  autonomyLevel: autonomyLevelSchema.optional(),
  createSandbox: z.boolean().optional(),
  requireHumanApproval: z.boolean().optional(),
  workspacePath: z.string().min(1).optional(),
});
const dispatchSchema = z.object({
  now: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  launch: z.boolean().optional(),
  createSandbox: z.boolean().optional(),
  autonomyLevel: autonomyLevelSchema.optional(),
});
const commandRunSchema = z.object({
  commandIndex: z.number().int().min(0).optional(),
  command: z.string().min(1).optional(),
  approved: z.boolean().optional(),
  timeoutMs: z.number().int().positive().max(120000).optional(),
}).refine((value) => value.commandIndex !== undefined || Boolean(value.command), {
  message: 'commandIndex or command is required',
});
const browserEvidenceSchema = z.object({
  targetUrl: z.string().url().optional(),
  htmlSnapshot: z.string().min(1).optional(),
});
const workerStartSchema = z.object({
  intervalMs: z.number().int().min(5000).max(3600000).optional(),
});
const deliveryJobSchema = z.object({
  runId: z.string().min(1),
  autonomyLevel: autonomyLevelSchema.optional(),
  createSandbox: z.boolean().optional(),
  requireHumanApproval: z.boolean().optional(),
  executeApprovedCommands: z.boolean().optional(),
  approvedCommandIndexes: z.array(z.number().int().min(0)).max(50).optional(),
  requireBrowserEvidence: z.boolean().optional(),
  previewUrl: z.string().url().optional(),
});
const runtimeProfileSchema = z.object({
  runId: z.string().min(1).optional(),
});
const hookRunSchema = z.object({
  projectId: z.string().min(1),
  runId: z.string().min(1).optional(),
  event: z.enum(['before-tool-call', 'after-model-response', 'artifact-review', 'loop-stop', 'browser-session']),
  approved: z.boolean().optional(),
  payload: z.record(z.unknown()).optional(),
});
const prPackageSchema = z.object({
  executionId: z.string().min(1).optional(),
});
const executionProviderSchema = z.enum(['local-process', 'docker', 'kubernetes', 'github-actions', 'codespaces', 'e2b', 'daytona', 'firecracker']);
const deploymentProviderSchema = z.enum(['none', 'vercel', 'railway', 'fly', 'render', 'kubernetes', 'aws-ecs', 'gcp-cloud-run', 'azure-container-apps']);
const targetEnvironmentSchema = z.enum(['preview', 'staging', 'production']);
const executionFabricPlanSchema = z.object({
  runId: z.string().min(1),
  executionId: z.string().min(1).optional(),
  provider: executionProviderSchema.optional(),
  deploymentProvider: deploymentProviderSchema.optional(),
  targetEnvironment: targetEnvironmentSchema.optional(),
  maxCostUsd: z.number().positive().max(100000).optional(),
  requirePullRequest: z.boolean().optional(),
  requireDeployment: z.boolean().optional(),
  allowNetwork: z.boolean().optional(),
});
const executionFabricJobSchema = z.object({
  planId: z.string().min(1),
  approved: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  providedSecrets: z.array(z.string().min(1)).max(50).optional(),
});
const operationEventTailQuerySchema = z.object({
  afterId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
const operationHeartbeatSchema = z.object({
  leaseOwner: z.string().min(1).optional(),
  progress: z.number().min(0).max(100).optional(),
  stageId: z.string().min(1).optional(),
  message: z.string().min(1).optional(),
});

export async function registerAgentProjectRoutes(app: FastifyInstance) {
  app.get('/agent-projects/templates', async () => ({ templates: agentProjects.listTemplates() }));

  app.post('/agent-projects/projects/from-template', async (request, reply) => {
    const parsed = templateProjectSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      return reply.status(201).send(agentProjects.createProjectFromTemplate(parsed.data));
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.get('/agent-projects/projects', async () => ({ projects: agentProjects.listProjects() }));

  app.post('/agent-projects/projects', async (request, reply) => {
    const parsed = projectSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(agentProjects.createProject(parsed.data));
  });

  app.get('/agent-projects/projects/:id', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const project = agentProjects.getProject(parsed.data.id);
    if (!project) return reply.status(404).send({ message: 'Agent project not found' });
    return project;
  });

  app.post('/agent-projects/projects/:id/runtime-profile', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);
    const parsed = runtimeProfileSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      return reply.status(201).send(agentProjects.createRuntimeProfile({ projectId: params.data.id, ...parsed.data }));
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.get('/agent-projects/runs', async (request) => {
    const query = request.query as { projectId?: string };
    return { runs: agentProjects.listRuns(query.projectId) };
  });

  app.post('/agent-projects/runs', async (request, reply) => {
    const parsed = runSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      return reply.status(201).send(agentProjects.createRun(parsed.data));
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.post('/agent-projects/runs/:id/workspace-plan', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      return reply.status(201).send(agentProjects.prepareWorkspacePlan(parsed.data.id));
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.post('/agent-projects/runs/:id/pr-package', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);
    const parsed = prPackageSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      return reply.status(201).send(agentProjects.createPullRequestPackage({ runId: params.data.id, ...parsed.data }));
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.post('/agent-projects/hooks/run', async (request, reply) => {
    const parsed = hookRunSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      const result = agentProjects.runHooks(parsed.data);
      return reply.status(result.status === 'blocked' ? 409 : 201).send(result);
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.get('/agent-projects/execution-fabric/plans', async (request) => {
    const query = request.query as { runId?: string };
    return { plans: agentProjects.listExecutionFabricPlans(query.runId) };
  });

  app.get('/agent-projects/execution-fabric/plans/:id', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const plan = agentProjects.getExecutionFabricPlan(parsed.data.id);
    if (!plan) return reply.status(404).send({ message: 'Execution fabric plan not found' });
    return plan;
  });

  app.post('/agent-projects/execution-fabric/plans', async (request, reply) => {
    const parsed = executionFabricPlanSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      return reply.status(201).send(agentProjects.createExecutionFabricPlan(parsed.data));
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.get('/agent-projects/execution-fabric/jobs', async (request) => {
    const query = request.query as { planId?: string };
    return { jobs: agentProjects.listExecutionFabricJobs(query.planId) };
  });

  app.get('/agent-projects/execution-fabric/jobs/:id/events', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);
    const query = operationEventTailQuerySchema.safeParse(request.query ?? {});
    if (!query.success) return validationError(reply, query.error.issues);
    const tail = agentProjects.tailExecutionFabricJobEvents(params.data.id, query.data.afterId, query.data.limit);
    if (!tail) return reply.status(404).send({ message: 'Execution fabric job not found' });
    return tail;
  });

  app.post('/agent-projects/execution-fabric/jobs/:id/heartbeat', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);
    const parsed = operationHeartbeatSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      return reply.status(201).send(agentProjects.heartbeatExecutionFabricJob(params.data.id, parsed.data));
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.post('/agent-projects/execution-fabric/jobs', async (request, reply) => {
    const parsed = executionFabricJobSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      const job = await agentProjects.runExecutionFabricJob(parsed.data);
      return reply.status(job.status === 'blocked' ? 409 : 201).send(job);
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.get('/agent-projects/schedules', async (request) => {
    const query = request.query as { projectId?: string };
    return { schedules: agentProjects.listSchedules(query.projectId) };
  });

  app.post('/agent-projects/schedules', async (request, reply) => {
    const parsed = scheduleSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      return reply.status(201).send(agentProjects.createSchedule(parsed.data));
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.post('/agent-projects/schedules/run-due', async (request, reply) => {
    const parsed = dispatchSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(await agentProjects.dispatchDueSchedules(parsed.data));
  });

  app.get('/agent-projects/worker/status', async () => agentProjects.workerStatus());

  app.post('/agent-projects/worker/tick', async (request, reply) => {
    const parsed = dispatchSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(await agentProjects.tickWorker(parsed.data));
  });

  app.post('/agent-projects/worker/start', async (request, reply) => {
    const parsed = workerStartSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return reply.status(201).send(agentProjects.startWorker(parsed.data));
  });

  app.post('/agent-projects/worker/stop', async () => agentProjects.stopWorker());

  app.get('/agent-projects/workspace-plans', async (request) => {
    const query = request.query as { runId?: string };
    return { workspacePlans: agentProjects.listWorkspacePlans(query.runId) };
  });

  app.get('/agent-projects/executions', async (request) => {
    const query = request.query as { runId?: string };
    return { executions: agentProjects.listExecutions(query.runId) };
  });

  app.get('/agent-projects/delivery-jobs', async (request) => {
    const query = request.query as { runId?: string };
    return { jobs: agentProjects.listDeliveryJobs(query.runId) };
  });

  app.get('/agent-projects/delivery-jobs/:id', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    const job = agentProjects.getDeliveryJob(parsed.data.id);
    if (!job) return reply.status(404).send({ message: 'Agent project delivery job not found' });
    return job;
  });

  app.get('/agent-projects/delivery-jobs/:id/events', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);
    const query = operationEventTailQuerySchema.safeParse(request.query ?? {});
    if (!query.success) return validationError(reply, query.error.issues);
    const tail = agentProjects.tailDeliveryJobEvents(params.data.id, query.data.afterId, query.data.limit);
    if (!tail) return reply.status(404).send({ message: 'Agent project delivery job not found' });
    return tail;
  });

  app.post('/agent-projects/delivery-jobs/:id/heartbeat', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);
    const parsed = operationHeartbeatSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      return reply.status(201).send(agentProjects.heartbeatDeliveryJob(params.data.id, parsed.data));
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.post('/agent-projects/delivery-jobs', async (request, reply) => {
    const parsed = deliveryJobSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      return reply.status(201).send(agentProjects.queueDeliveryJob(parsed.data));
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.post('/agent-projects/delivery-jobs/:id/run', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      return reply.status(201).send(await agentProjects.runDeliveryJob(parsed.data.id));
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.post('/agent-projects/delivery-jobs/:id/cancel', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      return agentProjects.cancelDeliveryJob(parsed.data.id);
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.post('/agent-projects/delivery-jobs/:id/retry', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      return agentProjects.retryDeliveryJob(parsed.data.id);
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.post('/agent-projects/executions', async (request, reply) => {
    const parsed = launchSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      return reply.status(201).send(await agentProjects.launchRun(parsed.data));
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.post('/agent-projects/executions/:id/commands', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);
    const parsed = commandRunSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      const result = await agentProjects.runExecutionCommand({ executionId: params.data.id, ...parsed.data });
      return reply.status(result.status === 'blocked' ? 409 : 201).send(result);
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.post('/agent-projects/executions/:id/browser-evidence', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);
    const parsed = browserEvidenceSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      return reply.status(201).send(await agentProjects.createBrowserEvidence({ executionId: params.data.id, ...parsed.data }));
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.post('/agent-projects/runs/:id/recap', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      return reply.status(201).send(agentProjects.createRunRecap(parsed.data.id));
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.post('/agent-projects/executions/:id/delivery-pack', async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    try {
      return reply.status(201).send(agentProjects.createDeliveryPack(parsed.data.id));
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.get('/agent-projects/sdk-manifest', async (request) => {
    const query = request.query as { apiBase?: string };
    return agentProjects.sdkManifest(query.apiBase);
  });

  app.get('/agent-projects/capability-roadmap', async () => agentProjects.capabilityRoadmap());
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid Agent Projects request',
    issues,
  });
}
