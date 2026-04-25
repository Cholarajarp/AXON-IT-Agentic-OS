import type { FastifyInstance, FastifyRequest } from 'fastify';
import { sql } from '../db/connection.js';
import type { Workflow, SubmitGoalInput } from '../types/domain.js';
import { broadcastUpdate } from '../ws/gateway.js';

export async function registerWorkflowRoutes(app: FastifyInstance) {
  // GET /workflows
  app.get('/workflows', async () => {
    const rows = await sql`
      SELECT id, name, goal, state, step, agent, progress,
             started_at, cost, budget, domain, model_route, agent_flow, repository_url
      FROM workflows
      ORDER BY started_at DESC
    `;
    return rows.map(mapWorkflow);
  });

  // GET /workflows/:id
  app.get('/workflows/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = req.params;
    const [row] = await sql`
      SELECT id, name, goal, state, step, agent, progress,
             started_at, cost, budget, domain, model_route, agent_flow, repository_url
      FROM workflows WHERE id = ${id}
    `;
    if (!row) return reply.status(404).send({ message: 'Workflow not found' });
    return mapWorkflow(row);
  });

  // POST /workflows — submit a new goal
  app.post('/workflows', async (req: FastifyRequest<{ Body: SubmitGoalInput }>, reply) => {
    const { name, goal, domain, modelRoute, agentFlow, repositoryUrl } = req.body;
    if (!modelRoute?.provider || !modelRoute.model || !modelRoute.mode || !agentFlow) {
      return reply.status(400).send({ message: 'modelRoute and agentFlow are required' });
    }

    const step = `${agentFlow} planner routing to ${modelRoute.provider}/${modelRoute.model}`;
    const modelRouteJson = {
      provider: modelRoute.provider,
      model: modelRoute.model,
      mode: modelRoute.mode,
      maxCostUsd: modelRoute.maxCostUsd,
      requiresApproval: modelRoute.requiresApproval,
    };
    const [row] = await sql`
      INSERT INTO workflows (name, goal, domain, state, step, agent, budget, model_route, agent_flow, repository_url)
      VALUES (${name}, ${goal}, ${[domain]}, 'PENDING', ${step}, ${agentFlow}, ${modelRoute.maxCostUsd}, ${sql.json(modelRouteJson as Parameters<typeof sql.json>[0])}, ${agentFlow}, ${repositoryUrl || null})
      RETURNING id, name, goal, state, step, agent, progress, started_at, cost, budget, domain, model_route, agent_flow, repository_url
    `;
    const wf = mapWorkflow(row);
    broadcastUpdate('workflow:created', wf);
    return reply.status(201).send(wf);
  });

  // POST /workflows/:id/cancel
  app.post('/workflows/:id/cancel', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = req.params;
    const [row] = await sql`
      UPDATE workflows SET state = 'CANCELLED', updated_at = NOW()
      WHERE id = ${id} AND state NOT IN ('COMPLETE', 'CANCELLED')
      RETURNING id, state
    `;
    if (!row) return reply.status(404).send({ message: 'Workflow not found or already terminal' });
    broadcastUpdate('workflow:cancelled', { id });
    return { success: true, id };
  });
}

function mapWorkflow(row: Record<string, unknown>): Workflow {
  return {
    id: row.id as string,
    name: row.name as string,
    goal: row.goal as string,
    state: row.state as Workflow['state'],
    step: row.step as string,
    agent: row.agent as string,
    progress: Number(row.progress),
    startedAt: Number(row.started_at),
    cost: Number(row.cost),
    budget: Number(row.budget),
    domain: row.domain as string[],
    modelRoute: row.model_route as Workflow['modelRoute'],
    agentFlow: row.agent_flow as string,
    repositoryUrl: (row.repository_url as string) || undefined,
  };
}
