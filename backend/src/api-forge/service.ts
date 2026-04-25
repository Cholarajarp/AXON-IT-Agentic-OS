import { nanoid } from 'nanoid';
import type {
  ApiForgeAuthType,
  ApiForgeInput,
  ApiForgeReport,
  ApiForgeRiskLevel,
  ApiForgeTarget,
  ApiOperation,
} from './types.js';

const reports = new Map<string, ApiForgeReport>();

const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete']);

export class ApiForgeService {
  listReports(): ApiForgeReport[] {
    return Array.from(reports.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getReport(id: string): ApiForgeReport | undefined {
    return reports.get(id);
  }

  createReport(input: ApiForgeInput): ApiForgeReport {
    const spec = normalizeSpec(input);
    const name = input.name?.trim() || spec.info?.title || 'AXON Generated API';
    const packageName = sanitizePackageName(input.packageName || name);
    const baseUrl = input.baseUrl || inferBaseUrl(spec);
    const targets = input.targets?.length ? input.targets : defaultTargets();
    const operations = extractOperations(spec);
    const stats = buildStats(spec, operations);
    const auth = inferAuth(spec, input.authType);
    const contractScore = scoreContract(stats, auth.type);
    const status: ApiForgeReport['status'] =
      contractScore < 45 || operations.length === 0 ? 'blocked' : contractScore < 75 ? 'needs-review' : 'ready';

    const report: ApiForgeReport = {
      id: `api_${nanoid(10)}`,
      tenantId: input.tenantId ?? 'tenant_default',
      name,
      packageName,
      baseUrl,
      contractScore,
      status,
      summary: buildSummary(name, operations.length, targets, status),
      specStats: stats,
      auth,
      operations,
      sdkTargets: buildSdkTargets(targets, packageName),
      cliPlan: buildCliPlan(packageName, operations),
      mcpPlan: buildMcpPlan(packageName, operations, input.agentOptimized ?? true),
      docsSearchPlan: buildDocsSearchPlan(name, targets),
      qualityGates: buildQualityGates(stats, auth.type, operations),
      generatedArtifacts: buildArtifacts(packageName, baseUrl, targets, operations, auth.type),
      createdAt: new Date().toISOString(),
    };

    reports.set(report.id, report);
    return report;
  }
}

interface OpenApiLike {
  openapi?: string;
  swagger?: string;
  info?: { title?: string; version?: string };
  servers?: Array<{ url?: string }>;
  host?: string;
  basePath?: string;
  schemes?: string[];
  paths?: Record<string, Record<string, unknown>>;
  components?: {
    schemas?: Record<string, unknown>;
    securitySchemes?: Record<string, { type?: string; scheme?: string; in?: string; name?: string; flows?: unknown }>;
  };
  securityDefinitions?: Record<string, { type?: string; scheme?: string; in?: string; name?: string; flow?: string }>;
  security?: unknown[];
}

function normalizeSpec(input: ApiForgeInput): OpenApiLike {
  if (input.spec && typeof input.spec === 'object') return input.spec as OpenApiLike;
  if (!input.specText?.trim()) return emptySpec(input.name);
  try {
    return JSON.parse(input.specText) as OpenApiLike;
  } catch {
    return {
      info: { title: input.name || 'Unparsed API spec' },
      paths: {},
    };
  }
}

function emptySpec(name?: string): OpenApiLike {
  return {
    info: { title: name?.trim() || 'Unspecified API contract' },
    paths: {},
  };
}

function extractOperations(spec: OpenApiLike): ApiOperation[] {
  const operations: ApiOperation[] = [];
  for (const [routePath, pathItem] of Object.entries(spec.paths ?? {})) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const [method, rawOperation] of Object.entries(pathItem)) {
      if (!httpMethods.has(method.toLowerCase()) || !rawOperation || typeof rawOperation !== 'object') continue;
      const operation = rawOperation as {
        operationId?: string;
        summary?: string;
        description?: string;
        tags?: string[];
        parameters?: Array<{ name?: string; in?: string; required?: boolean }>;
      };
      const operationId = operation.operationId || `${method}_${routePath.replace(/[^a-zA-Z0-9]+/g, '_')}`;
      const summary = operation.summary || operation.description || `${method.toUpperCase()} ${routePath}`;
      operations.push({
        id: `op_${operations.length + 1}`,
        method: method.toUpperCase(),
        path: routePath,
        summary: summary.slice(0, 160),
        operationId,
        risk: riskFor(method, routePath, summary),
        tags: operation.tags ?? [],
        parameters: (operation.parameters ?? []).map((param) => ({
          name: param.name ?? 'unknown',
          in: param.in ?? 'query',
          required: Boolean(param.required),
        })),
      });
    }
  }
  return operations;
}

function buildStats(spec: OpenApiLike, operations: ApiOperation[]): ApiForgeReport['specStats'] {
  const missingOperationIds = operations.filter((operation) => /^GET_|^POST_|^PUT_|^PATCH_|^DELETE_/i.test(operation.operationId)).length;
  return {
    paths: Object.keys(spec.paths ?? {}).length,
    operations: operations.length,
    schemas: Object.keys(spec.components?.schemas ?? {}).length,
    missingOperationIds,
    destructiveOperations: operations.filter((operation) => ['high', 'critical'].includes(operation.risk)).length,
  };
}

function inferAuth(spec: OpenApiLike, provided?: ApiForgeAuthType): ApiForgeReport['auth'] {
  if (provided) {
    return {
      type: provided,
      source: 'provided',
      recommendation: authRecommendation(provided),
    };
  }

  const securitySchemes = Object.values(spec.components?.securitySchemes ?? spec.securityDefinitions ?? {});
  if (securitySchemes.length === 0) {
    return {
      type: 'unknown',
      source: 'missing',
      recommendation: 'Add OpenAPI securitySchemes so generated SDKs, CLI, and MCP server enforce auth consistently.',
    };
  }

  const first = securitySchemes[0]!;
  let type: ApiForgeAuthType = 'unknown';
  if (first.type === 'oauth2') type = 'oauth2';
  else if (first.type === 'apiKey') type = 'api-key';
  else if (first.scheme === 'bearer') type = 'bearer';
  else if (first.scheme === 'basic') type = 'basic';
  else if (first.type === 'http') type = 'bearer';

  return {
    type,
    source: 'inferred',
    recommendation: authRecommendation(type),
  };
}

function buildSdkTargets(targets: ApiForgeTarget[], packageName: string): ApiForgeReport['sdkTargets'] {
  const languages = targets.filter((target): target is Exclude<ApiForgeTarget, 'cli' | 'mcp-server' | 'docs-search'> =>
    ['typescript', 'python', 'go', 'java'].includes(target),
  );

  return languages.map((language) => ({
    language,
    packageName: language === 'python' ? packageName.replace(/-/g, '_') : packageName,
    nativePatterns: nativePatterns(language),
    generatedFiles: generatedFiles(language, packageName),
    testPlan: [
      'contract fixture tests from OpenAPI examples',
      'auth header injection tests',
      'retry and timeout tests',
      'pagination and idempotency tests where detected',
    ],
  }));
}

function buildCliPlan(packageName: string, operations: ApiOperation[]): ApiForgeReport['cliPlan'] {
  const commands = operations.slice(0, 12).map((operation) => ({
    command: `${packageName} ${operation.operationId.replace(/_/g, '-')}`,
    operationId: operation.operationId,
    description: operation.summary,
  }));
  return {
    packageName: `${packageName}-cli`,
    commands,
    safety: [
      'dry-run flag for POST/PATCH/PUT/DELETE commands',
      'JSON and table output modes',
      'tenant-scoped credentials from secrets manager',
      'rate-limit and retry visibility',
    ],
  };
}

function buildMcpPlan(packageName: string, operations: ApiOperation[], agentOptimized: boolean): ApiForgeReport['mcpPlan'] {
  const readOps = operations.filter((operation) => operation.risk === 'low').map((operation) => operation.operationId);
  const writeOps = operations.filter((operation) => operation.risk !== 'low').map((operation) => operation.operationId);
  const tools: ApiForgeReport['mcpPlan']['tools'] = [
    {
      name: 'docs_search',
      purpose: 'Search generated SDK docs and examples before calling the API.',
      operations: [],
      risk: 'low',
    },
    {
      name: agentOptimized ? 'sdk_execute' : 'api_read',
      purpose: agentOptimized
        ? 'Run typed SDK code in a sandbox with auth, retries, pagination, and output limits.'
        : 'Call read-only API operations as individual MCP tools.',
      operations: agentOptimized ? operations.map((operation) => operation.operationId).slice(0, 50) : readOps.slice(0, 50),
      risk: writeOps.length ? 'medium' : 'low',
    },
    {
      name: 'approval_required_mutation',
      purpose: 'Route destructive operations through approval, dry-run, and rollback evidence.',
      operations: writeOps.slice(0, 50),
      risk: writeOps.some((operationId) => operations.find((op) => op.operationId === operationId)?.risk === 'critical') ? 'critical' : 'high',
    },
  ];

  return {
    mode: agentOptimized ? 'code-mode' : operations.length > 20 ? 'hybrid' : 'endpoint-tools',
    packageName: `${packageName}-mcp-server`,
    tools: tools.filter((tool) => tool.operations.length > 0 || tool.name === 'docs_search'),
    sandboxPolicy: [
      'execute generated SDK code in isolated runtime',
      'redact secrets from logs and agent responses',
      'limit network egress to declared API base URL',
      'require approval for high-risk mutations',
    ],
    tokenEfficiency: agentOptimized
      ? 'Expose one SDK code tool plus docs search to avoid sending dozens of endpoint schemas into every prompt.'
      : 'Expose curated endpoint tools only for small APIs.',
  };
}

function buildDocsSearchPlan(name: string, targets: ApiForgeTarget[]): ApiForgeReport['docsSearchPlan'] {
  return {
    enabled: targets.includes('docs-search'),
    sources: [`${name} OpenAPI spec`, 'generated SDK README', 'operation examples', 'error and pagination guide'],
    chunking: 'chunk by operationId, schema, auth guide, pagination guide, and runnable examples',
    retrievalPolicy: [
      'prefer docs snippets over raw OpenAPI when agent writes code',
      'include auth and pagination examples with matching operation',
      'cite SDK version and spec hash in generated responses',
    ],
  };
}

function buildQualityGates(stats: ApiForgeReport['specStats'], authType: ApiForgeAuthType, operations: ApiOperation[]): ApiForgeReport['qualityGates'] {
  return [
    {
      id: 'operation-ids',
      title: 'Stable operation IDs',
      passed: stats.missingOperationIds === 0,
      evidence: [`${stats.missingOperationIds} generated fallback operation ID(s)`],
    },
    {
      id: 'auth-scheme',
      title: 'Authentication scheme declared',
      passed: authType !== 'unknown',
      evidence: [`auth=${authType}`],
    },
    {
      id: 'mutation-approval',
      title: 'Mutations routed through approval',
      passed: operations.filter((operation) => operation.risk !== 'low').length >= 0,
      evidence: [`${operations.filter((operation) => operation.risk !== 'low').length} mutation/destructive operation(s) classified`],
    },
    {
      id: 'schemas-present',
      title: 'Reusable schemas present',
      passed: stats.schemas > 0,
      evidence: [`${stats.schemas} schema component(s)`],
    },
  ];
}

function buildArtifacts(
  packageName: string,
  baseUrl: string,
  targets: ApiForgeTarget[],
  operations: ApiOperation[],
  authType: ApiForgeAuthType,
): ApiForgeReport['generatedArtifacts'] {
  const artifacts: ApiForgeReport['generatedArtifacts'] = [
    {
      path: `api-forge/${packageName}/axon-api-forge.config.json`,
      kind: 'config',
      contentPreview: JSON.stringify({ packageName, baseUrl, authType, operationCount: operations.length }, null, 2),
    },
  ];

  if (targets.includes('typescript')) {
    artifacts.push({
      path: `api-forge/${packageName}/typescript/src/client.ts`,
      kind: 'sdk',
      contentPreview: `export class ${toPascal(packageName)}Client {\n  constructor(private apiKey: string, private baseUrl = '${baseUrl}') {}\n  // typed resources, retries, pagination, and idempotency helpers generated here\n}`,
    });
  }
  if (targets.includes('python')) {
    artifacts.push({
      path: `api-forge/${packageName}/python/${packageName.replace(/-/g, '_')}/client.py`,
      kind: 'sdk',
      contentPreview: `class ${toPascal(packageName)}Client:\n    def __init__(self, api_key: str, base_url: str = '${baseUrl}'):\n        self.api_key = api_key\n        self.base_url = base_url`,
    });
  }
  if (targets.includes('mcp-server')) {
    artifacts.push({
      path: `api-forge/${packageName}/mcp-server/src/server.ts`,
      kind: 'mcp',
      contentPreview: `registerTool('sdk_execute', { description: 'Run typed ${packageName} SDK code in sandbox with docs_search support.' });`,
    });
  }
  if (targets.includes('cli')) {
    artifacts.push({
      path: `api-forge/${packageName}/cli/src/index.ts`,
      kind: 'cli',
      contentPreview: `program.name('${packageName}').description('Typed CLI generated from OpenAPI with dry-run safety for mutations.');`,
    });
  }

  return artifacts;
}

function scoreContract(stats: ApiForgeReport['specStats'], authType: ApiForgeAuthType) {
  let score = 45;
  if (stats.operations > 0) score += 20;
  if (stats.schemas > 0) score += 12;
  if (stats.missingOperationIds === 0) score += 12;
  else score -= Math.min(20, stats.missingOperationIds * 3);
  if (authType !== 'unknown') score += 11;
  return Math.max(0, Math.min(100, score));
}

function riskFor(method: string, routePath: string, summary: string): ApiForgeRiskLevel {
  const text = `${method} ${routePath} ${summary}`.toLowerCase();
  if (method.toLowerCase() === 'delete' || /(delete|revoke|disable|terminate|drop|purge)/.test(text)) return 'critical';
  if (['post', 'put', 'patch'].includes(method.toLowerCase()) || /(create|update|write|charge|payment|transfer|deploy)/.test(text)) return 'high';
  if (/(admin|secret|token|credential|user)/.test(text)) return 'medium';
  return 'low';
}

function inferBaseUrl(spec: OpenApiLike) {
  if (spec.servers?.[0]?.url) return spec.servers[0].url;
  if (spec.host) return `${spec.schemes?.[0] ?? 'https'}://${spec.host}${spec.basePath ?? ''}`;
  return 'https://api.customer-domain.com';
}

function nativePatterns(language: string) {
  const patterns: Record<string, string[]> = {
    typescript: ['resource classes', 'discriminated unions', 'async iterators for pagination', 'AbortSignal support'],
    python: ['sync and async clients', 'pydantic-style typed responses', 'context managers', 'iterator pagination'],
    go: ['context.Context propagation', 'typed request structs', 'retryable RoundTripper', 'idiomatic errors'],
    java: ['builder pattern', 'checked response types', 'OkHttp transport', 'pagination iterables'],
  };
  return patterns[language] ?? [];
}

function generatedFiles(language: string, packageName: string) {
  const files: Record<string, string[]> = {
    typescript: ['src/client.ts', 'src/resources/*.ts', 'src/pagination.ts', 'src/errors.ts', 'README.md'],
    python: [`${packageName.replace(/-/g, '_')}/client.py`, 'resources/*.py', 'pagination.py', 'errors.py', 'README.md'],
    go: ['client.go', 'resources/*.go', 'pagination.go', 'errors.go', 'README.md'],
    java: ['src/main/java/**/Client.java', 'resources/*.java', 'Pagination.java', 'ApiException.java', 'README.md'],
  };
  return files[language] ?? [];
}

function authRecommendation(type: ApiForgeAuthType) {
  const table: Record<ApiForgeAuthType, string> = {
    none: 'Use only for public read APIs. Mutating operations still need approval and rate limits.',
    'api-key': 'Store API keys in provider secrets, inject at runtime, and redact from logs.',
    bearer: 'Support bearer token refresh and tenant-scoped secret references.',
    basic: 'Prefer bearer or OAuth2 for production; if basic is required, store credentials in secrets manager.',
    oauth2: 'Generate token refresh, scope mapping, and MCP approval policy for privileged scopes.',
    unknown: 'Declare a security scheme before publishing SDK, CLI, or MCP server.',
  };
  return table[type];
}

function buildSummary(name: string, operationCount: number, targets: ApiForgeTarget[], status: ApiForgeReport['status']) {
  return `${name} API Forge package is ${status}: ${operationCount} operation(s) mapped into ${targets.join(', ')} with SDK, CLI, MCP, docs-search, and safety gates.`;
}

function defaultTargets(): ApiForgeTarget[] {
  return ['typescript', 'python', 'go', 'java', 'cli', 'mcp-server', 'docs-search'];
}

function sanitizePackageName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'axon-api';
}

function toPascal(value: string) {
  return value
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join('');
}

export const apiForge = new ApiForgeService();
