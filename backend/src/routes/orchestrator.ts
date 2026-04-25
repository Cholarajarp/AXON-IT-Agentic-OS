import type { FastifyInstance, FastifyRequest } from 'fastify';
import { scheduler } from '../orchestrator/scheduler.js';
import { planner } from '../orchestrator/planner.js';
import { agentRegistry } from '../agents/registry.js';
import { modelRouter } from '../models/router.js';

export async function registerOrchestratorRoutes(app: FastifyInstance) {
  // POST /orchestrator/execute — submit a goal for execution
  app.post('/orchestrator/execute', async (req: FastifyRequest<{
    Body: { workflowId: string; goal: string; domain: string[]; budget?: number };
  }>, reply) => {
    const { workflowId, goal, domain, budget = 10 } = req.body;
    const dag = await scheduler.submitWorkflow(workflowId, goal, domain, budget);
    return reply.status(202).send({
      workflowId,
      dagId: dag.id,
      tasks: dag.nodes.length,
      message: 'Workflow execution started',
    });
  });

  // GET /orchestrator/dag/:workflowId — get current DAG state
  app.get('/orchestrator/dag/:workflowId', async (req: FastifyRequest<{ Params: { workflowId: string } }>, reply) => {
    const dag = scheduler.getDAG(req.params.workflowId);
    if (!dag) return reply.status(404).send({ message: 'No active DAG for this workflow' });
    return {
      ...dag,
      progress: planner.getProgress(dag),
      isComplete: planner.isComplete(dag),
    };
  });

  // POST /orchestrator/cancel/:workflowId
  app.post('/orchestrator/cancel/:workflowId', async (req: FastifyRequest<{ Params: { workflowId: string } }>) => {
    scheduler.cancelWorkflow(req.params.workflowId);
    return { success: true, message: 'Workflow cancelled' };
  });

  // POST /orchestrator/approve — resolve an approval
  app.post('/orchestrator/approve', async (req: FastifyRequest<{
    Body: { workflowId: string; taskId: string; approved: boolean };
  }>) => {
    const { workflowId, taskId, approved } = req.body;
    await scheduler.resolveApproval(workflowId, taskId, approved);
    return { success: true, approved };
  });

  // GET /orchestrator/status — scheduler status
  app.get('/orchestrator/status', async () => {
    return scheduler.getStatus();
  });

  // GET /orchestrator/plan — preview DAG without executing
  app.post('/orchestrator/plan', async (req: FastifyRequest<{
    Body: { goal: string; domain: string[] };
  }>) => {
    const { goal, domain } = req.body;
    const dag = planner.plan({ workflowId: 'preview', goal, domain });
    return {
      goalType: planner.classifyGoal(goal),
      tasks: dag.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        description: n.description,
        agent: n.agent,
        dependsOn: n.dependsOn,
        approvalRequired: n.approvalRequired,
        timeoutMs: n.timeoutMs,
      })),
      estimatedDuration: dag.nodes.reduce((sum, n) => sum + n.timeoutMs, 0),
    };
  });

  // GET /orchestrator/agents — list all registered agents
  app.get('/orchestrator/agents', async () => {
    return agentRegistry.list();
  });

  // GET /orchestrator/agents/:name/metrics
  app.get('/orchestrator/agents/:name/metrics', async (req: FastifyRequest<{ Params: { name: string } }>, reply) => {
    const metrics = agentRegistry.getMetrics(req.params.name);
    if (!metrics) return reply.status(404).send({ message: 'Agent not found' });
    return { name: req.params.name, ...metrics };
  });

  // GET /orchestrator/models — model router status
  app.get('/orchestrator/models', async () => {
    await modelRouter.checkAllHealth();
    return {
      providers: modelRouter.getProviders(),
      health: modelRouter.getHealth(),
    };
  });

  // POST /orchestrator/models/invoke — direct model invocation
  app.post('/orchestrator/models/invoke', async (req: FastifyRequest<{
    Body: { messages: Array<{ role: string; content: string }>; model?: string; temperature?: number; maxTokens?: number };
  }>) => {
    const { messages, model, temperature, maxTokens } = req.body;
    const response = await modelRouter.invoke({
      messages: messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
      model,
      temperature,
      maxTokens,
    });
    return response;
  });
}
