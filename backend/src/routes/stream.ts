import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { scheduler } from '../orchestrator/scheduler.js';
import { runtimeEnforcer } from '../agents/runtime-enforcer.js';
import { toolRegistry } from '../tools/registry.js';
import { connectorRegistry } from '../integrations/connector-registry.js';
import type { ITSMTicket } from '../integrations/types.js';

export async function registerStreamRoutes(app: FastifyInstance) {
  // SSE — stream execution events for a workflow
  app.get('/stream/workflow/:workflowId', async (req: FastifyRequest<{ Params: { workflowId: string } }>, reply: FastifyReply) => {
    const { workflowId } = req.params;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const sendEvent = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent('connected', { workflowId, timestamp: Date.now() });

    const interval = setInterval(() => {
      const dag = scheduler.getDAG(workflowId);
      const context = scheduler.getContext(workflowId);
      if (dag) {
        const totalNodes = dag.nodes.length;
        const completedNodes = dag.nodes.filter((n) => n.state === 'COMPLETE').length;
        sendEvent('dag.update', {
          progress: totalNodes > 0 ? (completedNodes / totalNodes) * 100 : 100,
          nodes: dag.nodes.map((n) => ({ id: n.id, name: n.name, state: n.state, agent: n.agent })),
          cost: context?.costAccumulated || 0,
        });
      }
      sendEvent('heartbeat', { timestamp: Date.now() });
    }, 1000);

    req.raw.on('close', () => {
      clearInterval(interval);
    });
  });

  // Legacy tool routes are kept for internal debugging while the hardened
  // tool runtime owns the public /tools/* API surface.
  app.get('/legacy/tools', async () => {
    return toolRegistry.list();
  });

  app.post('/legacy/tools/execute', async (req: FastifyRequest<{
    Body: { toolName: string; parameters: Record<string, unknown>; workflowId?: string; taskId?: string };
  }>) => {
    const { toolName, parameters, workflowId = 'manual', taskId = 'manual' } = req.body;
    const result = await toolRegistry.execute({
      toolName,
      parameters,
      workflowId,
      taskId,
      agentId: 'manual',
      tenantId: 'default',
      sandboxed: true,
    });
    return result;
  });

  app.get('/legacy/tools/stats', async () => {
    return toolRegistry.getStats();
  });

  app.get('/legacy/tools/log', async (req: FastifyRequest<{ Querystring: { limit?: string } }>) => {
    const limit = parseInt(req.query.limit || '50', 10);
    return toolRegistry.getExecutionLog(limit);
  });

  // GET /runtime/steps — list runtime enforcer steps
  app.get('/runtime/steps', async () => {
    return runtimeEnforcer.getSteps();
  });

  // GET /integrations — list all connectors
  app.get('/integrations', async () => {
    return connectorRegistry.listConnectorStatus();
  });

  // GET /integrations/health — health check all connectors
  app.get('/integrations/health', async () => {
    return connectorRegistry.healthCheckAll();
  });

  // POST /integrations/configure — configure a connector
  app.post('/integrations/configure', async (req: FastifyRequest<{
    Body: { type: string; baseUrl: string; token?: string; enabled: boolean };
  }>, reply) => {
    const { type, baseUrl, token, enabled } = req.body;
    if (!connectorRegistry.isKnownType(type)) {
      return reply.status(400).send({ message: `Unsupported integration type: ${type}` });
    }
    const success = await connectorRegistry.configure({
      type,
      name: type,
      baseUrl,
      credentials: { type: 'token', token },
      enabled,
      tenantId: 'default',
    });
    return { success, type };
  });

  // GET /integrations/:type/tickets
  app.get('/integrations/:type/tickets', async (req: FastifyRequest<{ Params: { type: string } }>, reply) => {
    if (!connectorRegistry.isKnownType(req.params.type)) return reply.status(404).send({ message: 'Connector not found' });
    const connector = connectorRegistry.get(req.params.type);
    if (!connector) return reply.status(404).send({ message: 'Connector not found' });
    const tickets = await connector.listTickets();
    return tickets;
  });

  // POST /integrations/:type/tickets
  app.post('/integrations/:type/tickets', async (req: FastifyRequest<{
    Params: { type: string };
    Body: { title: string; description: string; priority?: string; type?: string };
  }>, reply) => {
    if (!connectorRegistry.isKnownType(req.params.type)) return reply.status(404).send({ message: 'Connector not found' });
    const connector = connectorRegistry.get(req.params.type);
    if (!connector) return reply.status(404).send({ message: 'Connector not found' });
    const ticket = await connector.createTicket(req.body as Partial<ITSMTicket>);
    return reply.status(201).send(ticket);
  });
}
