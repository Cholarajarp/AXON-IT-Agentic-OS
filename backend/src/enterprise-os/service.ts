import type {
  EnterpriseCapability,
  EnterpriseGate,
  EnterpriseReadiness,
  MarketSignal,
} from './types.js';

const capabilities: EnterpriseCapability[] = [
  {
    id: 'prompt-to-product',
    name: 'Prompt to product blueprint',
    category: 'build',
    description: 'Turn a natural language request into scope, backlog, architecture, estimate, evidence, and launch workflow.',
    axonStatus: 'live',
    marketPressure: ['Prompt-to-product speed', 'Visible planning', 'Customer-ready evidence'],
    proof: ['/build', '/blueprint', 'POST /api/v1/product-factory/blueprints'],
  },
  {
    id: 'live-product-preview',
    name: 'Live product preview',
    category: 'preview',
    description: 'Show a desktop/mobile product preview while the user reviews the generated build plan.',
    axonStatus: 'live',
    marketPressure: ['Live preview', 'Visual iteration', 'Design-to-code flow'],
    proof: ['/build iframe preview', 'desktop/mobile preview toggle'],
  },
  {
    id: 'multi-agent-delivery',
    name: 'Multi-agent delivery team',
    category: 'agent',
    description: 'Planner, architect, engineer, QA, security, database, release, SRE, compliance, and documentation agents.',
    axonStatus: 'live',
    marketPressure: ['Autonomous delegation', 'Parallel specialist work', 'Reviewable agent handoffs'],
    proof: ['/agents/registry', '/orchestrator/plan'],
  },
  {
    id: 'database-safety',
    name: 'Secure database pipeline',
    category: 'data',
    description: 'Review schema/data migrations for lock risk, destructive SQL, rollback gaps, and quality gates.',
    axonStatus: 'live',
    marketPressure: ['Database safety', 'Migration rollback', 'Production data protection'],
    proof: ['/database', 'POST /api/v1/database-pipeline/review'],
  },
  {
    id: 'security-center',
    name: 'Security and policy gates',
    category: 'security',
    description: 'Secrets handling, policy gates, approval requirements, audit evidence, and dependency/security review surfaces.',
    axonStatus: 'partial',
    marketPressure: ['Enterprise security', 'Policy gates', 'Audit exports'],
    proof: ['/policies', '/evidence', '/audit', '/settings provider keys'],
  },
  {
    id: 'provider-routing',
    name: 'Bring-your-own model providers',
    category: 'enterprise',
    description: 'Users can configure OpenAI, Anthropic, Bedrock, Google, Ollama, and custom local runtimes from the web UI.',
    axonStatus: 'live',
    marketPressure: ['Bring-your-own models', 'Cost routing', 'Sovereign provider support'],
    proof: ['/models', '/settings'],
  },
  {
    id: 'operations-control',
    name: 'Operations control plane',
    category: 'ops',
    description: 'Track workflows, DAGs, costs, incidents, evidence, alerts, tools, and launch status in one OS.',
    axonStatus: 'live',
    marketPressure: ['Session visibility', 'Operations telemetry', 'Evidence ledger'],
    proof: ['/command', '/workflows', '/dag', '/cost', '/incidents'],
  },
  {
    id: 'real-runtime-preview',
    name: 'Sandboxed real app runtime',
    category: 'preview',
    description: 'Generate files into an isolated workspace, run the app server, stream logs, and preview the real app URL.',
    axonStatus: 'planned',
    marketPressure: ['Real app runtime', 'Hosted preview', 'Runtime logs'],
    proof: ['planned: app workspace runner', 'planned: preview URL per workflow'],
  },
];

const marketSignals: MarketSignal[] = [
  {
    name: 'Autonomous workbench',
    positioning: 'Users expect decomposed tasks, tool execution, and a visible computer/session.',
    strengths: ['Autonomous task execution', 'Research and browsing', 'Tool use', 'Session visibility'],
    axonResponse: ['Enterprise agent team roles', 'Governed approvals', 'Audit evidence', 'IT/product delivery focus'],
    sourceUrl: 'internal:market-reference/autonomous-workbench',
  },
  {
    name: 'Prompt-to-app workspace',
    positioning: 'Users expect plan mode, app generation, testing, deployment, database support, and checkpoints.',
    strengths: ['Plain-language app creation', 'Plan mode', 'Testing and deployment', 'Database checkpoints'],
    axonResponse: ['Build Studio', 'Product Factory', 'Database Pipeline', 'Enterprise gates and BYO providers'],
    sourceUrl: 'internal:market-reference/prompt-to-app',
  },
  {
    name: 'Full-stack app builder',
    positioning: 'Users expect live preview, Git workflows, database integrations, and security/database scans.',
    strengths: ['Live preview', 'Security scans', 'RLS/database review', 'Dependency audit'],
    axonResponse: ['Live product preview', 'Database migration safety', 'Policy/evidence layer', 'No single backend lock-in'],
    sourceUrl: 'internal:market-reference/full-stack-builder',
  },
  {
    name: 'Developer coding agent',
    positioning: 'Users expect repo changes, tests, review loops, and IDE/CLI ergonomics.',
    strengths: ['Codebase editing', 'Test loops', 'Developer ergonomics', 'Model quality'],
    axonResponse: ['Code Intelligence', 'Tool policy pipeline', 'Provider routing', 'Product-to-ops workflow'],
    sourceUrl: 'internal:market-reference/coding-agent',
  },
];

export class EnterpriseOsService {
  listCapabilities() {
    return {
      capabilities,
      marketSignals,
      categories: ['build', 'agent', 'preview', 'data', 'security', 'ops', 'enterprise'],
    };
  }

  readiness(input: {
    hasBlueprint?: boolean;
    hasPreview?: boolean;
    hasProvider?: boolean;
    hasDatabaseReview?: boolean;
    hasSecurityReview?: boolean;
    hasDeploymentPlan?: boolean;
    hasEvidence?: boolean;
  } = {}): EnterpriseReadiness {
    const gates: EnterpriseGate[] = [
      gate({
        id: 'blueprint',
        title: 'Product blueprint generated',
        pass: input.hasBlueprint ?? true,
        owner: 'BusinessAnalystAgent',
        whyItMatters: 'Users need scope, cost, backlog, and acceptance criteria before autonomous work begins.',
        evidence: ['blueprint snapshot', 'traceability matrix'],
        nextAction: 'Generate a blueprint in Build Studio.',
      }),
      gate({
        id: 'preview',
        title: 'Product preview available',
        pass: input.hasPreview ?? true,
        owner: 'BuildStudio',
        whyItMatters: 'Users understand outcomes faster when they can see the product, not only read agent logs.',
        evidence: ['desktop preview', 'mobile preview'],
        nextAction: 'Open Build Studio and inspect the preview.',
      }),
      gate({
        id: 'provider',
        title: 'Model provider configured',
        pass: input.hasProvider ?? false,
        owner: 'ModelRouter',
        whyItMatters: 'Enterprise customers need control over Anthropic, OpenAI, Bedrock, Google, local, or sovereign runtimes.',
        evidence: ['provider key config', 'health check'],
        nextAction: 'Add provider keys in Settings or Models.',
      }),
      gate({
        id: 'database',
        title: 'Database safety reviewed',
        pass: input.hasDatabaseReview ?? false,
        owner: 'MigrationSafetyAgent',
        whyItMatters: 'Most AI app builders fail at production data safety: unsafe migrations, missing RLS, and no rollback evidence.',
        evidence: ['migration review', 'rollback plan', 'quality gates'],
        nextAction: 'Run the Database Pipeline for schema/data changes.',
      }),
      gate({
        id: 'security',
        title: 'Security and dependency scan passed',
        pass: input.hasSecurityReview ?? false,
        owner: 'SecurityAgent',
        whyItMatters: 'Before publish, secrets, auth, dependencies, and data access must be reviewed.',
        evidence: ['secret scan', 'dependency audit', 'auth/RBAC review'],
        nextAction: 'Run security review and attach findings to Evidence.',
      }),
      gate({
        id: 'deployment',
        title: 'Deployment and rollback plan ready',
        pass: input.hasDeploymentPlan ?? false,
        owner: 'ReleaseAgent',
        whyItMatters: 'Enterprise delivery needs environment separation, rollout steps, monitoring, and rollback ownership.',
        evidence: ['deployment runbook', 'rollback owner', 'smoke test'],
        nextAction: 'Create deployment plan and approve launch workflow.',
      }),
      gate({
        id: 'evidence',
        title: 'Audit evidence attached',
        pass: input.hasEvidence ?? false,
        owner: 'ComplianceAgent',
        whyItMatters: 'Enterprise buyers need proof that autonomous work was reviewed, tested, and approved.',
        evidence: ['audit log', 'approval record', 'test/build output'],
        nextAction: 'Attach evidence before production launch.',
      }),
    ];

    const score = Math.round(
      gates.reduce((total, item) => total + (item.status === 'pass' ? 100 : item.status === 'warn' ? 50 : 0), 0) /
        gates.length,
    );
    const blockers = gates.filter((item) => item.status === 'block');
    const status = score >= 85 && blockers.length === 0 ? 'enterprise-ready' : score >= 25 ? 'builder-ready' : 'not-ready';

    return {
      score,
      status,
      summary:
        status === 'enterprise-ready'
          ? 'Ready for enterprise pilot launch with governed autonomy.'
          : status === 'builder-ready'
            ? 'Strong builder experience is ready; enterprise launch still needs provider, database, security, deployment, and evidence gates.'
            : 'Not ready for enterprise launch. Start with Build Studio, provider setup, and safety gates.',
      gates,
      missing: gates.filter((item) => item.status !== 'pass').map((item) => item.title),
      launchSequence: [
        { order: 1, name: 'Generate product plan', agent: 'BusinessAnalystAgent', output: 'approved blueprint' },
        { order: 2, name: 'Preview user experience', agent: 'BuildStudio', output: 'desktop/mobile preview' },
        { order: 3, name: 'Configure providers and secrets', agent: 'SecurityAgent', output: 'healthy routing' },
        { order: 4, name: 'Review database changes', agent: 'MigrationSafetyAgent', output: 'migration safety report' },
        { order: 5, name: 'Run tests and security scans', agent: 'QAAgent', output: 'release evidence' },
        { order: 6, name: 'Deploy with rollback', agent: 'ReleaseAgent', output: 'production launch record' },
        { order: 7, name: 'Observe and support', agent: 'SREAgent', output: 'health and incident dashboard' },
      ],
    };
  }
}

function gate(input: {
  id: string;
  title: string;
  pass: boolean;
  owner: string;
  whyItMatters: string;
  evidence: string[];
  nextAction: string;
}): EnterpriseGate {
  return {
    id: input.id,
    title: input.title,
    status: input.pass ? 'pass' : input.id === 'provider' || input.id === 'database' ? 'block' : 'todo',
    owner: input.owner,
    whyItMatters: input.whyItMatters,
    evidence: input.evidence,
    nextAction: input.nextAction,
  };
}

export const enterpriseOs = new EnterpriseOsService();
