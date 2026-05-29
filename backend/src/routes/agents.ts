import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { sql } from '../db/connection.js';
import type { AgentInstance } from '../types/domain.js';
import { PIPELINE_STEPS } from '../agents/pipeline.js';
import { agentRegistry } from '../agents/registry.js';
import { runtimeEnforcer } from '../agents/runtime-enforcer.js';
import { skillRegistry } from '../services/skill-registry.js';

const pipelineProbeSchema = z.object({
  workflowId: z.string().min(1).default('wf_pipeline_probe'),
  taskId: z.string().min(1).default('task_pipeline_probe'),
  taskName: z.string().min(1).default('PipelineProbeAgent'),
  description: z.string().min(1).default('Run a no-side-effect agent pipeline probe.'),
  tenantId: z.string().min(1).default('tenant_default'),
  input: z.record(z.unknown()).default({ probe: true }),
});

export async function registerAgentRoutes(app: FastifyInstance) {
  app.get('/agents', async () => {
    const rows = await sql`
      SELECT id, type, version, state, current_task,
             tokens_used, confidence, completion, updated_at
      FROM agents
      ORDER BY updated_at DESC
    `;
    return rows.map(mapAgent);
  });

  app.get('/agents/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = req.params;
    const [row] = await sql`
      SELECT id, type, version, state, current_task,
             tokens_used, confidence, completion, updated_at
      FROM agents WHERE id = ${id}
    `;
    if (!row) return reply.status(404).send({ message: 'Agent not found' });
    return mapAgent(row);
  });

  /**
   * Live agent fleet (from the in-process registry, not the DB).
   * The DB /agents endpoint above reflects persisted agent state machines,
   * while this one reports the 15 code-defined agents actually available
   * to the scheduler right now.
   */
  app.get('/agents/registry', async () => {
    const enabledSkills = (await skillRegistry.list()).filter((skill) => skill.enabled);
    const skillCapabilities = [...new Set(enabledSkills.flatMap((skill) => skill.capabilities))];
    return {
      agents: agentRegistry.list().map((agent) => ({
        ...agent,
        effectiveCapabilities: [...new Set([...agent.capabilities, ...skillCapabilities])],
      })),
      enabledSkills: enabledSkills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        capabilities: skill.capabilities,
        riskLevel: skill.riskLevel,
      })),
      metrics: Object.fromEntries(agentRegistry.getAllMetrics()),
    };
  });

  /**
   * The 13-step policy-bound runtime pipeline every agent execution flows through.
   * The UI renders this as the "governance spine" of the platform.
   */
  app.get('/agents/pipeline', async () => ({
    steps: PIPELINE_STEPS,
    total: PIPELINE_STEPS.length,
  }));

  app.post('/agents/pipeline/probe', async (request, reply) => {
    const parsed = pipelineProbeSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid agent pipeline probe',
        issues: parsed.error.issues,
      });
    }

    const { tenantId, ...input } = parsed.data;
    const result = await runtimeEnforcer.enforce({ ...input, signal: new AbortController().signal }, tenantId, { probe: true });
    return reply.status(result.aborted ? 409 : 201).send(result);
  });
}

function mapAgent(row: Record<string, unknown>): AgentInstance {
  return {
    id: row.id as string,
    type: row.type as string,
    version: row.version as string,
    state: row.state as AgentInstance['state'],
    currentTask: (row.current_task as string) || undefined,
    tokensUsed: Number(row.tokens_used),
    confidence: Number(row.confidence),
    completion: Number(row.completion),
    updatedAt: Number(row.updated_at),
  };
}
