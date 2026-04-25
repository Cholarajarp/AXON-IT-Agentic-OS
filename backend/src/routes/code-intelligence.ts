import type { FastifyInstance, FastifyReply } from 'fastify';
import path from 'node:path';
import { z } from 'zod';
import { createCodeIntelligenceEngine } from '../code-intelligence/index.js';

const engine = createCodeIntelligenceEngine();
const defaultWorkspaceId = 'local';

const indexSchema = z.object({
  workspacePath: z.string().min(1).optional(),
  workspaceId: z.string().min(1).default(defaultWorkspaceId),
});

const searchSchema = z.object({
  query: z.string().min(1),
  workspaceId: z.string().min(1).default(defaultWorkspaceId),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  fileTypes: z.array(z.string().min(1)).optional(),
  directories: z.array(z.string().min(1)).optional(),
  semantic: z.boolean().optional(),
});

const symbolQuerySchema = z.object({
  symbol: z.string().min(1),
  filePath: z.string().min(1),
  line: z.coerce.number().int().min(1).default(1),
  workspaceId: z.string().min(1).default(defaultWorkspaceId),
});

const fileQuerySchema = z.object({
  filePath: z.string().min(1),
  workspaceId: z.string().min(1).default(defaultWorkspaceId),
});

const statusQuerySchema = z.object({
  workspaceId: z.string().min(1).default(defaultWorkspaceId),
});

export async function registerCodeIntelligenceRoutes(app: FastifyInstance) {
  app.post('/code-intelligence/index', async (request, reply) => {
    const parsed = indexSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);

    const workspacePath = resolveWorkspacePath(parsed.data.workspacePath);
    const result = await engine.indexWorkspace(workspacePath, parsed.data.workspaceId);

    return {
      ...result,
      workspaceId: parsed.data.workspaceId,
      workspacePath,
    };
  });

  app.get('/code-intelligence/status', async (request, reply) => {
    const parsed = statusQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error.issues);

    return engine.getStatus(parsed.data.workspaceId);
  });

  app.post('/code-intelligence/search', async (request, reply) => {
    const parsed = searchSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);

    const { query, workspaceId, ...options } = parsed.data;
    return {
      query,
      workspaceId,
      results: await engine.searchCode(query, workspaceId, options),
    };
  });

  app.get('/code-intelligence/references', async (request, reply) => {
    const parsed = symbolQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error.issues);

    return {
      symbol: parsed.data.symbol,
      references: await engine.findReferences(
        parsed.data.symbol,
        parsed.data.filePath,
        parsed.data.line,
        parsed.data.workspaceId
      ),
    };
  });

  app.get('/code-intelligence/definition', async (request, reply) => {
    const parsed = symbolQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error.issues);

    return {
      symbol: parsed.data.symbol,
      definition: await engine.findDefinition(
        parsed.data.symbol,
        parsed.data.filePath,
        parsed.data.line,
        parsed.data.workspaceId
      ),
    };
  });

  app.get('/code-intelligence/symbols', async (request, reply) => {
    const parsed = fileQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error.issues);

    return engine.getSymbolGraph(parsed.data.filePath, parsed.data.workspaceId);
  });

  app.get('/code-intelligence/analyze', async (request, reply) => {
    const parsed = fileQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error.issues);

    return engine.analyzeFile(parsed.data.filePath, parsed.data.workspaceId);
  });

  app.get('/code-intelligence/patterns', async (request, reply) => {
    const parsed = statusQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error.issues);

    return {
      workspaceId: parsed.data.workspaceId,
      patterns: await engine.detectPatterns(parsed.data.workspaceId),
    };
  });

  app.get('/code-intelligence/unused', async (request, reply) => {
    const parsed = statusQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error.issues);

    return {
      workspaceId: parsed.data.workspaceId,
      unused: await engine.findUnusedCode(parsed.data.workspaceId),
    };
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    error: 'ValidationError',
    message: 'Invalid code intelligence request',
    issues,
  });
}

function resolveWorkspacePath(inputPath: string | undefined): string {
  const backendRoot = process.cwd();
  const defaultRoot =
    path.basename(backendRoot).toLowerCase() === 'backend'
      ? path.dirname(backendRoot)
      : backendRoot;
  const allowedRoot = path.resolve(process.env.AXON_WORKSPACE_ROOT || defaultRoot);
  const target = path.resolve(inputPath || allowedRoot);

  if (target !== allowedRoot && !target.startsWith(`${allowedRoot}${path.sep}`)) {
    throw new Error(`Workspace path must stay inside ${allowedRoot}`);
  }

  return target;
}
