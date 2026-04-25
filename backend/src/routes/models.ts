import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { modelRouter } from '../models/router.js';
import { runEval } from '../models/eval.js';
import type { ModelRequest } from '../models/types.js';
import { modelProviderConfigStore } from '../services/model-provider-config.js';

/**
 * /api/v1/models
 *
 * Thin HTTP surface over ModelRouter. The UI uses:
 *   - GET  /models/catalog         static provider/model metadata for the Models page
 *   - GET  /models/providers       names of providers the router actually registered
 *   - GET  /models/health          live health snapshot (used by command center)
 *   - GET  /models/evaluations     deterministic router eval report for the Evaluation Lab
 *   - POST /models/health/refresh  actively re-checks every provider
 *   - POST /models/cache/clear     clears the router-level response cache
 *   - POST /models/invoke          single-shot completion, routed + cached + cost-logged
 *   - POST /models/invoke/stream   SSE stream of a completion (chunks the final content)
 *
 * All invocation paths share ModelRouter.invoke, so policy, failover, cache,
 * and cost-ledger writes are identical regardless of entry point.
 */

const modelCatalog = [
  {
    provider: 'anthropic',
    models: [
      { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', fit: 'Deep architecture, long codebase repair, critical reasoning', quality: 98, latency: 72, cost: 88, sovereign: false },
      { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', fit: 'Default SDLC agent, code review, planning, refactors', quality: 93, latency: 84, cost: 62, sovereign: false },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', fit: 'Fast triage, summaries, low-risk automation', quality: 82, latency: 96, cost: 25, sovereign: false },
    ],
  },
  {
    provider: 'openai',
    models: [
      { id: 'gpt-5.2', label: 'GPT-5.2', fit: 'Complex product engineering, tests, multi-file implementation', quality: 96, latency: 78, cost: 75, sovereign: false },
      { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', fit: 'Fast edits, classification, routine automation', quality: 84, latency: 94, cost: 30, sovereign: false },
    ],
  },
  {
    provider: 'google',
    models: [
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', fit: 'Large-context analysis, documents, multimodal workflows', quality: 91, latency: 80, cost: 55, sovereign: false },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', fit: 'Low-latency planning and summaries', quality: 80, latency: 97, cost: 22, sovereign: false },
    ],
  },
  {
    provider: 'vertexai',
    models: [
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro via Vertex AI', fit: 'GCP-bound large-context analysis and enterprise policy control', quality: 92, latency: 79, cost: 56, sovereign: true },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash via Vertex AI', fit: 'Fast routed planning and summaries inside GCP boundary', quality: 81, latency: 96, cost: 24, sovereign: true },
    ],
  },
  {
    provider: 'bedrock',
    models: [
      { id: 'claude-sonnet-bedrock', label: 'Claude Sonnet via Bedrock', fit: 'AWS-governed enterprise workloads', quality: 92, latency: 82, cost: 66, sovereign: true },
      { id: 'amazon-nova-pro', label: 'Amazon Nova Pro', fit: 'AWS-native automation and enterprise routing', quality: 84, latency: 88, cost: 40, sovereign: true },
    ],
  },
  {
    provider: 'vllm',
    models: [
      { id: 'mistral-large', label: 'Mistral Large via vLLM', fit: 'Private-VPC reasoning with full control plane', quality: 86, latency: 88, cost: 10, sovereign: true },
      { id: 'qwen2.5-coder-32b', label: 'Qwen 2.5 Coder via vLLM', fit: 'Sovereign code generation and repo edits', quality: 83, latency: 90, cost: 8, sovereign: true },
    ],
  },
  {
    provider: 'ollama',
    models: [
      { id: 'llama-3.1-70b', label: 'Llama 3.1 70B Local', fit: 'Private logs, sovereign analysis, offline fallback', quality: 78, latency: 90, cost: 5, sovereign: true },
      { id: 'qwen2.5-coder-32b', label: 'Qwen2.5 Coder 32B Local', fit: 'Local code edits and repo analysis', quality: 81, latency: 88, cost: 5, sovereign: true },
    ],
  },
  {
    provider: 'localMock',
    models: [
      { id: 'mock-small', label: 'Deterministic Mock', fit: 'Tests, eval lab replay, offline dev', quality: 50, latency: 99, cost: 0, sovereign: true },
    ],
  },
];

const agentFlows = [
  { id: 'AutonomousSDLC', label: 'Autonomous SDLC', agents: ['Intent', 'Architect', 'Engineering', 'QA', 'Security', 'Release'], risk: 'medium' },
  { id: 'RepoRepair', label: 'Repository Repair', agents: ['Codebase', 'Engineering', 'QA', 'Critic'], risk: 'medium' },
  { id: 'ProductionIncident', label: 'Production Incident', agents: ['SRE', 'Security', 'Infrastructure', 'Release'], risk: 'high' },
  { id: 'ComplianceEvidence', label: 'Compliance Evidence', agents: ['Compliance', 'Security', 'Documentation'], risk: 'low' },
  { id: 'BlueprintResearch', label: 'Blueprint Research', agents: ['StackResearch', 'Architect', 'Security', 'Documentation'], risk: 'medium' },
  { id: 'IdeaToApp', label: 'Idea to Deployed App', agents: ['Product', 'Architect', 'Engineering', 'Infrastructure', 'Release'], risk: 'high' },
];

const invokeSchema = z.object({
  model: z.string().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string().min(1),
      }),
    )
    .min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(32000).optional(),
  taskType: z.string().optional(),
  tenantId: z.string().optional(),
  sensitivityLevel: z.enum(['public', 'internal', 'confidential', 'restricted']).optional(),
  costBudget: z.number().nonnegative().optional(),
  sovereignMode: z.boolean().optional(),
  preferredProvider: z.string().optional(),
  bypassCache: z.boolean().optional(),
});

const providerConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'google', 'bedrock', 'ollama', 'vllm']),
  enabled: z.boolean().default(true),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  region: z.string().min(1).optional(),
  accessKeyId: z.string().min(1).optional(),
  secretAccessKey: z.string().min(1).optional(),
  sessionToken: z.string().min(1).optional(),
  modelIds: z.record(z.string()).optional(),
});

const providerParamsSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'google', 'bedrock', 'ollama', 'vllm', 'localMock']),
});

let hydrated = false;

export async function registerModelRoutes(app: FastifyInstance) {
  if (!hydrated) {
    hydrated = true;
    await modelRouter.hydrateConfiguredProviders(await modelProviderConfigStore.listPrivate());
  }

  app.get('/models/catalog', async () => ({
    modelCatalog,
    agentFlows,
    routingModes: [
      { id: 'quality', label: 'Highest quality', description: 'Use strongest available model and critic pass.' },
      { id: 'balanced', label: 'Balanced', description: 'Optimize for production-quality output at controlled cost.' },
      { id: 'fast', label: 'Fast', description: 'Prefer low-latency model routes for triage and routine tasks.' },
      { id: 'sovereign', label: 'Sovereign', description: 'Restrict routing to local or enterprise-boundary providers.' },
    ],
  }));

  app.get('/models/providers', async () => ({
    providers: modelRouter.getProviders(),
    cacheSize: modelRouter.getCacheSize(),
  }));

  app.get('/models/health', async () => ({
    health: modelRouter.getHealth(),
    timestamp: Date.now(),
  }));

  app.get('/models/evaluations', async () => {
    const report = await runEval();
    const health = modelRouter.getHealth();
    return {
      generatedAt: new Date().toISOString(),
      report,
      runtime: {
        providers: modelRouter.getProviders(),
        healthyProviders: health.filter((provider) => provider.healthy).length,
        health,
      },
      gates: [
        {
          id: 'router-regression',
          title: 'Router deterministic regression',
          status: report.failed === 0 ? 'pass' : 'fail',
          score: report.total === 0 ? 0 : Math.round((report.passed / report.total) * 100),
          evidence: [`${report.passed}/${report.total} cases passed`, `${report.durationMs}ms duration`],
        },
        {
          id: 'provider-health',
          title: 'Live provider health',
          status: health.some((provider) => provider.healthy) ? 'pass' : 'warn',
          score: health.length === 0 ? 0 : Math.round((health.filter((provider) => provider.healthy).length / health.length) * 100),
          evidence: health.map((provider) => `${provider.name}: ${provider.healthy ? 'healthy' : 'not healthy'}`),
        },
      ],
    };
  });

  app.get('/models/config', async () => ({
    providers: await modelProviderConfigStore.listPublic(),
  }));

  app.post('/models/config', async (request, reply) => {
    const parsed = providerConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid provider configuration',
        issues: parsed.error.issues,
      });
    }

    try {
      const saved = await modelProviderConfigStore.upsert(parsed.data);
      if (saved.enabled) {
        modelRouter.configureProvider(saved);
      } else {
        modelRouter.unregister(saved.provider);
      }

      return {
        provider: modelProviderConfigStore.toPublic(saved),
        providers: modelRouter.getProviders(),
        health: modelRouter.getHealth(),
      };
    } catch (err) {
      return reply.status(400).send({
        error: 'ProviderConfigError',
        message: (err as Error).message,
      });
    }
  });

  app.delete('/models/config/:provider', async (request, reply) => {
    const parsed = providerParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid provider name',
        issues: parsed.error.issues,
      });
    }
    if (parsed.data.provider === 'localMock') {
      return reply.status(400).send({ message: 'localMock cannot be removed' });
    }

    await modelProviderConfigStore.remove(parsed.data.provider);
    modelRouter.unregister(parsed.data.provider);
    return {
      removed: true,
      providers: modelRouter.getProviders(),
    };
  });

  app.post('/models/health/refresh', async () => {
    const results = await modelRouter.checkAllHealth();
    return {
      results: Array.from(results.entries()).map(([name, healthy]) => ({ name, healthy })),
      timestamp: Date.now(),
    };
  });

  app.post('/models/cache/clear', async () => {
    modelRouter.clearCache();
    return { cleared: true };
  });

  app.post('/models/invoke', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = invokeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid invoke payload',
        issues: parsed.error.issues,
      });
    }

    try {
      const response = await modelRouter.invoke(parsed.data as ModelRequest);
      return reply.send(response);
    } catch (err) {
      const message = (err as Error).message;
      const statusCode = message.includes('No healthy providers') ? 503 : 502;
      return reply.status(statusCode).send({
        error: 'ModelRouterError',
        message,
      });
    }
  });

  /**
   * SSE streaming endpoint.
   *
   * The router now asks providers to stream natively when they can. If a provider
   * does not expose streaming, the router falls back to chunking the final content
   * so the UI still gets a stable SSE contract.
   */
  app.post('/models/invoke/stream', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = invokeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid invoke payload',
        issues: parsed.error.issues,
      });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const response = await modelRouter.invokeStream(parsed.data as ModelRequest, {
        onMeta: (meta) => send('meta', meta),
        onChunk: (delta) => send('chunk', { delta }),
      });

      send('done', {
        tokensIn: response.tokensIn,
        tokensOut: response.tokensOut,
        cost: response.cost,
        latencyMs: response.latencyMs,
      });
    } catch (err) {
      send('error', { message: (err as Error).message });
    } finally {
      reply.raw.end();
    }

    return reply;
  });
}
