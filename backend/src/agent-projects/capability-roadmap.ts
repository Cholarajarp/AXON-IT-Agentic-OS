import { nanoid } from 'nanoid';
import type { AgentProjectCapabilityLevel, AgentProjectCapabilityRoadmap } from './types.js';

export function buildCapabilityRoadmap(): AgentProjectCapabilityRoadmap {
  const capabilityMatrix = buildCapabilityMatrix();
  const readinessScore = Math.round(
    capabilityMatrix.reduce((sum, item) => sum + capabilityLevelScore(item.axonToday), 0) /
      capabilityMatrix.length
  );

  return {
    id: `roadmap_${nanoid(10)}`,
    generatedAt: new Date().toISOString(),
    position:
      'AXON should behave like an AI IT service delivery organization: scoped intake, governed agent teams, real execution evidence, release safety, customer handoff, and managed-service continuity.',
    readinessScore,
    capabilityMatrix,
    finalBuilds: buildFinalBuildItems(),
    nextNonNegotiables: [
      'Replace local JSON delivery-job persistence with PostgreSQL or BullMQ/Redis leases for multi-node production.',
      'Run approved commands inside Docker/OpenHands/E2B/Daytona sandbox adapters instead of the host shell.',
      'Attach real Playwright screenshots, videos, traces, console logs, network logs, and accessibility results to delivery jobs.',
      'Connect GitHub/Jira/Linear/ServiceNow so AXON can accept tickets and return PRs, evidence, SLA status, and customer updates.',
      'Add production deploy adapters for Vercel, Kubernetes, ECS, Cloud Run, Supabase, and staged rollback.',
    ],
    internalReferences: [
      'backend/src/agent-projects',
      'backend/src/production-runtime',
      'backend/src/database-pipeline',
      'backend/src/release-command',
      'backend/src/customer-delivery',
      'src/app/surfaces/agent-projects.tsx',
    ],
  };
}

function buildCapabilityMatrix(): AgentProjectCapabilityRoadmap['capabilityMatrix'] {
  return [
    roadmapItem('Requirements to customer delivery ownership', 'partial', 'native', 'P0', [
      'Agent Projects runs',
      'Delivery jobs',
      'Customer Delivery',
      'Release packs',
    ], 'Connect ticket intake, SOW approval, PR delivery, SLA handoff, and customer portal status.'),
    roadmapItem('Prompt-to-app builder speed', 'partial', 'native', 'P0', [
      'Product Factory',
      'Build Studio',
      'Preview QA',
    ], 'Create one guided app-builder flow with preview canvas, DB/auth choices, and one-click delivery job.'),
    roadmapItem('Cloud/hosted isolated execution', 'partial', 'native', 'P0', [
      'Execution envelopes',
      'Sandbox Kernel session option',
      'Command evidence',
      'Execution Fabric provider manifests',
      'Dry-run/live fabric jobs',
    ], 'Connect provider manifests to live GitHub Apps, Docker, Kubernetes, E2B, Daytona, Codespaces, and Firecracker SDK clients.'),
    roadmapItem('Database-safe production delivery', 'partial', 'native', 'P0', [
      'Database Pipeline',
      'Database architect agents',
      'Destructive-command risk classification',
    ], 'Add shadow DB migration rehearsal, dev/prod separation checks, RLS checks, rollback evidence, and hard destructive SQL approval gates.'),
    roadmapItem('Codebase intelligence and repo graph', 'partial', 'native', 'P1', [
      'Structural parser',
      'Symbol extraction',
      'Import/call graph edges',
    ], 'Persist code graph to Postgres/pgvector, add LSP/tree-sitter adapters, route/test ownership graph, and PR history retrieval.'),
    roadmapItem('Browser preview and proof', 'partial', 'native', 'P0', [
      'Browser QA reports',
      'Delivery-job browser stage',
      'Accessibility evidence',
    ], 'Attach real Playwright screenshots, videos, traces, console/network logs, and visual diff artifacts.'),
    roadmapItem('Managed services and SLA operations', 'partial', 'native', 'P1', [
      'Managed Services',
      'Service Desk',
      'Customer Delivery SLA model',
    ], 'Bind delivery packs to support contracts, incidents, runbooks, on-call, customer reports, renewals, and invoicing.'),
    roadmapItem('Enterprise governance and audit', 'partial', 'native', 'P0', [
      'Trust Ledger',
      'Artifact store',
      'Production Runtime gates',
      'Security Center',
    ], 'Add SSO/SAML/OIDC, KMS-backed signatures, object storage, tenant isolation tests, audit export, and DLP scanning.'),
    roadmapItem('Cost control and model routing', 'native', 'native', 'P1', [
      'Model FinOps',
      'Router cache/evals',
      'Budget gates',
    ], 'Enforce budgets at tool/runtime level and rank model routes by quality-per-dollar from real task results.'),
    roadmapItem('Deployment and rollback', 'partial', 'native', 'P0', [
      'Release Command',
      'Production Runtime deployment adapter gate',
      'Execution Fabric deploy adapter contracts',
      'Rollback instructions',
    ], 'Connect Vercel, Kubernetes, ECS, Cloud Run, Supabase, Railway/Fly adapters to live provider SDKs with health checks and rollback.'),
  ];
}

function roadmapItem(
  capability: string,
  axonToday: AgentProjectCapabilityLevel,
  axonTarget: AgentProjectCapabilityLevel,
  priority: AgentProjectCapabilityRoadmap['capabilityMatrix'][number]['priority'],
  evidence: string[],
  nextBuild: string
): AgentProjectCapabilityRoadmap['capabilityMatrix'][number] {
  return {
    capability,
    axonToday,
    axonTarget,
    priority,
    evidence,
    nextBuild,
  };
}

function buildFinalBuildItems(): AgentProjectCapabilityRoadmap['finalBuilds'] {
  return [
    {
      priority: 'P0',
      capability: 'Durable delivery jobs',
      ownerAgent: 'DeliveryManagerAgent',
      status: 'implemented',
      shippedEvidence: [
        'GET/POST /agent-projects/delivery-jobs',
        'run/cancel/retry routes',
        'CLI jobs/queue-job/run-job/cancel-job/retry-job',
        'Agent Projects UI controls',
      ],
      remainingHardening: ['Move from durable JSON to PostgreSQL/BullMQ for multi-node production.'],
    },
    {
      priority: 'P0',
      capability: 'Capability roadmap',
      ownerAgent: 'ProductStrategyAgent',
      status: 'implemented',
      shippedEvidence: [
        'GET /agent-projects/capability-roadmap',
        'AXON-only readiness matrix',
        'Build priorities focused on product hardening',
      ],
      remainingHardening: ['Schedule reference refresh jobs and attach source snapshots as internal artifacts.'],
    },
    {
      priority: 'P1',
      capability: 'Structural code intelligence',
      ownerAgent: 'CodeIntelligenceAgent',
      status: 'implemented',
      shippedEvidence: ['structural parser nodes', 'symbol graph import/call edges', 'route and engine tests'],
      remainingHardening: ['Add tree-sitter/LSP adapters and persist graph in Postgres/pgvector.'],
    },
    {
      priority: 'P0',
      capability: 'Project-local runtime profile',
      ownerAgent: 'RuntimeProfileAgent',
      status: 'implemented',
      shippedEvidence: [
        'project-local agent file generation',
        'hook runtime evaluation',
        'MCP config contract',
        'PR package generation',
      ],
      remainingHardening: ['Write generated profiles into isolated worktrees and sync with real GitHub PR APIs.'],
    },
    {
      priority: 'P0',
      capability: 'Execution Fabric',
      ownerAgent: 'ExecutionFabricAgent',
      status: 'implemented',
      shippedEvidence: [
        'GET/POST /agent-projects/execution-fabric/plans',
        'GET/POST /agent-projects/execution-fabric/jobs',
        'provider adapter manifests for local, GitHub Actions, Docker, Kubernetes, and remote sandbox contracts',
        'FinOps cost hard stops, required secret gates, PR/deploy stages, rollback plan, UI and CLI controls',
      ],
      remainingHardening: ['Connect live GitHub App, E2B/Daytona, Docker/Kubernetes runners, and deployment provider SDK clients.'],
    },
    {
      priority: 'P0',
      capability: 'Sandbox/cloud execution adapters',
      ownerAgent: 'SandboxKernelAgent',
      status: 'next-hardening',
      shippedEvidence: ['execution envelope gate', 'sandbox session option', 'command artifacting', 'Execution Fabric provider contracts'],
      remainingHardening: ['Run remote providers through live SDK clients instead of adapter-ready manifests only.'],
    },
  ];
}

function capabilityLevelScore(level: AgentProjectCapabilityLevel): number {
  if (level === 'native') return 100;
  if (level === 'partial') return 60;
  if (level === 'external') return 40;
  return 0;
}
