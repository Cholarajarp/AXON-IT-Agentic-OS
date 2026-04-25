import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { toolRegistry } from '../tools/registry.js';
import { executeTool, TOOL_PIPELINE_STEPS } from '../tools/runtime.js';

/**
 * /api/v1/tools
 *
 * Public surface:
 *   GET  /tools/registry     list of registered tools and their definitions
 *   GET  /tools/pipeline     the 13-step tool enforcement pipeline
 *   GET  /tools/stats        execution stats (in-memory)
 *   POST /tools/execute      routed + policy-enforced + audited tool call
 *
 * This is the ONLY path that should be used to run tools. The bare
 * toolRegistry.execute() is kept internal for backwards compatibility but
 * will be removed once all call sites migrate.
 */

const executeSchema = z.object({
  toolName: z.string().min(1),
  parameters: z.record(z.unknown()).default({}),
  workflowId: z.string().min(1),
  taskId: z.string().min(1),
  agentId: z.string().min(1),
  tenantId: z.string().min(1),
  sensitivityLevel: z.enum(['public', 'internal', 'confidential', 'restricted']).optional(),
  sovereignMode: z.boolean().optional(),
  approvalApproved: z.boolean().optional(),
  allowedHosts: z.array(z.string()).optional(),
});

export async function registerToolRoutes(app: FastifyInstance) {
  app.get('/tools/registry', async () => ({
    tools: toolRegistry.list(),
  }));

  app.get('/tools/pipeline', async () => ({
    steps: TOOL_PIPELINE_STEPS,
    total: TOOL_PIPELINE_STEPS.length,
  }));

  app.get('/tools/stats', async () => toolRegistry.getStats());

  app.post('/tools/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = executeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid tool execute payload',
        issues: parsed.error.issues,
      });
    }

    const result = await executeTool(parsed.data);
    const statusCode = result.success ? 200 : result.aborted ? 403 : 502;
    return reply.status(statusCode).send(result);
  });
}
