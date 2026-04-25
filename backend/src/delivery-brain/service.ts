import { nanoid } from 'nanoid';
import type { DeliveryBrainDossier, DeliveryBrainInput } from './types.js';

const dossiers = new Map<string, DeliveryBrainDossier>();

const sourceSignals: DeliveryBrainDossier['sourceSignals'] = [
  {
    name: 'Google Vertex AI Agent Builder',
    url: 'https://cloud.google.com/products/agent-builder',
    takeaway: 'Enterprise agents need design, scale, and govern layers: managed runtime, memory/context, evaluation, sandboxing, identity, observability, registry, and audit trail.',
    appliedTo: ['agent runtime', 'governance', 'observability', 'evaluation'],
  },
  {
    name: 'NIST AI Risk Management Framework',
    url: 'https://www.nist.gov/itl/ai-risk-management-framework',
    takeaway: 'Trustworthy AI systems should manage risk through Govern, Map, Measure, and Manage activities.',
    appliedTo: ['risk management', 'release gates', 'AI governance'],
  },
  {
    name: 'OWASP Top 10 for LLM Applications',
    url: 'https://owasp.org/www-project-top-10-for-large-language-model-applications',
    takeaway: 'LLM applications require controls for prompt injection, sensitive information disclosure, insecure output handling, excessive agency, vector weaknesses, and unbounded consumption.',
    appliedTo: ['agent security', 'tool policy', 'RAG safety', 'cost controls'],
  },
  {
    name: 'CNCF cloud native ecosystem',
    url: 'https://www.cncf.io/',
    takeaway: 'Enterprise platforms should use cloud-native patterns around containers, Kubernetes, service networking, observability, and resilient operations.',
    appliedTo: ['deployment', 'observability', 'platform operations'],
  },
  {
    name: 'GitHub Skills',
    url: 'https://github.com/skills',
    takeaway: 'Continuous learning can be represented as task-specific, practice-driven learning paths that produce evidence of skill acquisition.',
    appliedTo: ['skill academy', 'agent growth', 'developer workflow'],
  },
];

export class DeliveryBrainService {
  listDossiers() {
    return Array.from(dossiers.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getDossier(id: string) {
    return dossiers.get(id);
  }

  createDossier(input: DeliveryBrainInput): DeliveryBrainDossier {
    const mission = input.mission.trim();
    const regulated = input.regulated ?? /soc|iso|pci|hipaa|bank|finance|health|government|enterprise/i.test(mission);
    const budget = input.budgetUsd ?? inferBudget(mission);
    const deadlineDays = input.deadlineDays ?? inferDeadline(mission);
    const wantsCompanyScale = /200,?000|it company|tcs|infosys|enterprise|massive|global/i.test(mission);
    const wantsBuild = /build|product|software|app|platform|code/i.test(mission);
    const wantsOperate = /operate|managed|service|sla|incident|support|cloud/i.test(mission);
    const wantsLearning = /learn|skill|github|open source|knowledge|improve/i.test(mission);

    const dossier: DeliveryBrainDossier = {
      id: `brain_${nanoid(10)}`,
      tenantId: input.tenantId ?? 'tenant_default',
      mission,
      inferredIntent: {
        problem: wantsCompanyScale
          ? 'Replace large IT-service-company delivery capacity with a governed AI workforce that can build, run, secure, improve, and report software outcomes.'
          : 'Turn a high-level product request into a build-ready enterprise software delivery system.',
        targetUsers: inferUsers(mission, input.customerType),
        desiredOutcomes: [
          'understand user intent once and avoid repetitive questioning',
          'generate build-ready product, architecture, security, UX, deployment, and operations plans',
          'execute through specialized AI agent roles with evidence gates',
          'show users how the product works, how secure it is, and what technology choices were made',
          'control model, cloud, and review cost per accepted outcome',
        ],
        nonGoals: [
          'unbounded autonomous production changes without policy and rollback gates',
          'fake human consciousness or emotional claims',
          'prototype-only workflows without tests, security, deployment, evidence, and customer reporting',
        ],
        assumptions: [
          wantsBuild ? 'software product delivery is part of the mission' : 'the mission may be operations-heavy, so product-building scope should remain explicit',
          regulated ? 'enterprise compliance is required' : 'baseline SOC 2-style controls are expected',
          wantsOperate ? '24x7 operations and SLA handling matter' : 'production readiness still requires runbooks and monitoring',
          wantsLearning ? 'agent skills must refresh from trusted external and internal sources' : 'skills should still be versioned and validated through practice tasks',
          'the platform should prefer inferred defaults and only ask blocker questions',
        ],
        blockerQuestions: buildBlockers(input.existingAnswers ?? {}, regulated),
        confidence: confidenceFor(mission, input.existingAnswers ?? {}),
        noRepeatPolicy: [
          'Persist previously answered customer context as scoped memory.',
          'Infer safe defaults for non-blocking details and display assumptions for correction.',
          'Ask only when missing data changes security, budget, data safety, or production action.',
          'Turn repeated clarification into reusable intake templates.',
        ],
      },
      sourceSignals,
      decisionTrace: buildDecisionTrace(regulated, wantsCompanyScale, wantsOperate, wantsLearning),
      enterpriseArchitecture: {
        frontend: ['React + TypeScript', 'route-level lazy loading', 'tanstack-query data layer', 'dense enterprise cockpit UI', 'Playwright-verified flows'],
        backend: ['Fastify + TypeScript', 'Zod request validation', 'service-per-capability modules', 'structured error handling', 'testable deterministic planners'],
        data: ['PostgreSQL for tenant data', 'Redis for queues/cache', 'pgvector or Qdrant for memory/RAG', 'audit chain for evidence', 'object storage for artifacts'],
        aiRuntime: ['model router across OpenAI/Anthropic/Bedrock/Vertex/local', 'role-based agent registry', 'tool permission policy', 'evaluation gates', 'memory with sensitivity labels'],
        infrastructure: ['Docker Compose for local', 'Kubernetes for enterprise runtime', 'Helm/Terraform for environments', 'blue-green or canary release', 'secrets manager integration'],
        observability: ['OpenTelemetry traces', 'Prometheus metrics', 'Grafana dashboards', 'structured logs', 'agent/tool/eval/cost telemetry'],
        integrations: ['GitHub', 'cloud providers', 'service desk', 'observability stack', 'database providers', 'model providers', 'customer communication channels'],
      },
      agentOperatingLoop: [
        { stage: 'observe', purpose: 'Read user mission, repo state, cloud state, tickets, incidents, docs, and prior memory.', agentResponsibilities: ['IntentAgent', 'ResearchAgent', 'CustomerSuccessAgent'], requiredEvidence: ['intake summary', 'source list', 'known context'] },
        { stage: 'plan', purpose: 'Create PRD, architecture, risk model, cost model, and execution DAG.', agentResponsibilities: ['ProductStrategist', 'SolutionArchitect', 'DeliveryManager'], requiredEvidence: ['blueprint', 'ADR', 'risk register', 'budget route'] },
        { stage: 'act', purpose: 'Implement code, database changes, infrastructure, tests, and documentation through scoped tools.', agentResponsibilities: ['EngineeringAgent', 'DatabaseReliabilityAgent', 'ReleaseAgent'], requiredEvidence: ['diff', 'migration review', 'tool logs'] },
        { stage: 'verify', purpose: 'Run typecheck, tests, security, database safety, browser QA, evals, and deployment smoke.', agentResponsibilities: ['QAAgent', 'SecurityAgent', 'SREAgent'], requiredEvidence: ['test logs', 'scan report', 'browser screenshot', 'rollback plan'] },
        { stage: 'learn', purpose: 'Convert outcomes, failures, feedback, and new sources into memory, skills, runbooks, and cheaper routes.', agentResponsibilities: ['SkillAcademyAgent', 'FinOpsAgent', 'ExecutiveInsightAgent'], requiredEvidence: ['learning item', 'runbook update', 'cost delta', 'customer report'] },
      ],
      securityAndGovernance: buildSecurityControls(regulated),
      uxAndProductExperience: buildUxModel(wantsCompanyScale),
      deliveryPlan: buildDeliveryPlan(deadlineDays, wantsCompanyScale),
      deploymentAndOperations: buildOpsModel(),
      costAndProductivity: {
        estimatedBuildUsd: Math.round(budget * 0.28),
        estimatedMonthlyRunUsd: Math.round(budget * 0.1),
        modelSpendPolicy: [
          'frontier models only for ambiguous architecture, security, complex coding, and final review',
          'fast/cheap models for classification, formatting, summaries, and deterministic transforms',
          'cache context, source summaries, and runbooks',
          'track cost per accepted outcome rather than token volume',
        ],
        productivityLevers: [
          'parallel specialized agents with ownership boundaries',
          'reusable blueprints and service-line templates',
          'automated quality gates before human review',
          'continuous learning from trusted sources and failures',
          'customer-ready evidence packages generated by default',
        ],
      },
      createdAt: new Date().toISOString(),
    };

    dossiers.set(dossier.id, dossier);
    return dossier;
  }
}

function inferBudget(mission: string) {
  const match = mission.match(/\$?(\d[\d,]*)\s*(k|m|million|thousand)?/i);
  if (!match) return /200,?000|global|enterprise/i.test(mission) ? 5000000 : 250000;
  const raw = Number(match[1].replace(/,/g, ''));
  const suffix = match[2]?.toLowerCase();
  if (suffix === 'm' || suffix === 'million') return raw * 1000000;
  if (suffix === 'k' || suffix === 'thousand') return raw * 1000;
  return raw;
}

function inferDeadline(mission: string) {
  const match = mission.match(/(\d+)\s*(days|weeks|months)/i);
  if (!match) return /mvp|fast|quick/i.test(mission) ? 30 : 90;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('week')) return value * 7;
  if (unit.startsWith('month')) return value * 30;
  return value;
}

function inferUsers(mission: string, customerType?: string) {
  const users = new Set<string>();
  if (customerType) users.add(customerType);
  if (/founder|startup/i.test(mission)) users.add('founders');
  if (/developer|coding|repo|software/i.test(mission)) users.add('software engineers');
  if (/it|managed|service|tcs|infosys/i.test(mission)) users.add('IT operations leaders');
  if (/security|compliance/i.test(mission)) users.add('security and compliance teams');
  if (/enterprise|global|200,?000/i.test(mission)) users.add('enterprise executives');
  return users.size ? Array.from(users) : ['product builders', 'engineering teams', 'operations teams'];
}

function buildBlockers(existingAnswers: Record<string, string>, regulated: boolean) {
  const blockers: string[] = [];
  if (!existingAnswers.dataResidency && regulated) blockers.push('Which data residency or compliance boundary cannot be inferred safely?');
  if (!existingAnswers.productionAccess) blockers.push('Can agents execute production-impacting actions, or only prepare reviewed plans?');
  if (!existingAnswers.customerPromise) blockers.push('What customer promise is non-negotiable: speed, cost, security, reliability, or customization?');
  return blockers.slice(0, 3);
}

function confidenceFor(mission: string, existingAnswers: Record<string, string>) {
  let confidence = 0.62;
  if (mission.length > 120) confidence += 0.12;
  if (/build|operate|security|database|cost|customer/i.test(mission)) confidence += 0.12;
  if (Object.keys(existingAnswers).length > 0) confidence += 0.08;
  return Math.min(0.9, Number(confidence.toFixed(2)));
}

function buildDecisionTrace(regulated: boolean, companyScale: boolean, operate: boolean, learning: boolean): DeliveryBrainDossier['decisionTrace'] {
  return [
    {
      decision: 'Top-level product shape',
      selected: companyScale ? 'Company OS + Delivery Brain' : 'Build Studio + Delivery Brain',
      rationale: 'The user needs an operating company, not a narrow chatbot or coding assistant.',
      alternatives: ['single chat agent', 'ticket-only system', 'IDE-only assistant'],
      risk: 'high',
      evidence: ['mission scope', 'service-line needs', 'Company OS composition'],
    },
    {
      decision: 'Autonomy model',
      selected: regulated ? 'supervised autonomy with production gates' : 'risk-tiered autonomy',
      rationale: 'Enterprise systems must separate low-risk automation from destructive or customer-impacting work.',
      alternatives: ['fully autonomous production execution', 'human-only approval for everything'],
      risk: regulated ? 'critical' : 'high',
      evidence: ['NIST Govern/Map/Measure/Manage', 'OWASP excessive agency controls'],
    },
    {
      decision: 'Agent learning model',
      selected: learning ? 'continuous source-backed learning backlog' : 'versioned skill plan with periodic refresh',
      rationale: 'Agents need current skills, but learning must produce practice evidence before increasing autonomy.',
      alternatives: ['static prompts', 'unverified web scraping'],
      risk: 'medium',
      evidence: ['GitHub Skills pattern', 'Skill Academy practice tasks'],
    },
    {
      decision: 'Operations model',
      selected: operate ? '24x7 managed service towers' : 'production-ready runbooks from day one',
      rationale: 'Enterprise products fail when delivery stops at code; operations, support, cost, and trust must be first-class.',
      alternatives: ['ship code only', 'manual ops outside platform'],
      risk: 'high',
      evidence: ['Managed Services towers', 'Service Desk SLA model'],
    },
  ];
}

function buildSecurityControls(regulated: boolean): DeliveryBrainDossier['securityAndGovernance'] {
  return [
    { control: 'Prompt and tool injection defense', mappedFramework: 'OWASP LLM01 / LLM05', blocksReleaseWhen: 'agent acts on untrusted instructions or unsanitized tool output', proof: ['tool policy decision', 'sanitized transcript', 'review log'] },
    { control: 'Sensitive information protection', mappedFramework: 'OWASP LLM02', blocksReleaseWhen: 'secrets or PII appear in prompts, logs, retrieval, or responses', proof: ['secret scan', 'redaction evidence', 'data classification'] },
    { control: 'Agent autonomy boundaries', mappedFramework: 'OWASP excessive agency / NIST Govern', blocksReleaseWhen: 'destructive actions lack approval, checkpoint, or rollback', proof: ['approval record', 'checkpoint', 'rollback preview'] },
    { control: 'AI risk lifecycle', mappedFramework: 'NIST AI RMF Govern/Map/Measure/Manage', blocksReleaseWhen: regulated ? 'risk mapping or measurement evidence is missing' : 'critical AI risk has no owner', proof: ['risk register', 'eval report', 'owner assignment'] },
    { control: 'Cloud-native release safety', mappedFramework: 'CNCF operational patterns', blocksReleaseWhen: 'deployment lacks health checks, observability, or rollback', proof: ['deployment manifest', 'health check', 'OpenTelemetry trace'] },
  ];
}

function buildUxModel(companyScale: boolean): DeliveryBrainDossier['uxAndProductExperience'] {
  return [
    { surface: 'Company OS', userNeed: 'understand the whole IT company in one place', designRule: 'show service lines, economics, command hierarchy, generated assets, and trust controls above the fold', successSignal: 'founder can explain the operating model in two minutes' },
    { surface: 'Delivery Brain', userNeed: 'trust that the system understood without repetitive questions', designRule: 'show inferred intent, assumptions, blocker questions, and decision trace', successSignal: 'user edits assumptions instead of retyping the mission' },
    { surface: 'Build Studio', userNeed: 'see the product being built and previewed', designRule: 'start with usable workflow, not a marketing page', successSignal: 'blueprint launches into executable workflow with preview' },
    { surface: 'Security/Database/Checkpoints', userNeed: 'know what can break and how it is controlled', designRule: 'make gates explicit and evidence-based', successSignal: 'release blocker is understandable and actionable' },
    { surface: companyScale ? 'Autonomous Workforce' : 'Skill Academy', userNeed: 'see agents as capable roles, not vague bots', designRule: 'map roles to decisions, tools, skills, quality gates, and growth loops', successSignal: 'operator can identify who owns every outcome' },
  ];
}

function buildDeliveryPlan(deadlineDays: number, companyScale: boolean): DeliveryBrainDossier['deliveryPlan'] {
  const slice = Math.max(5, Math.round(deadlineDays / 5));
  return [
    { phase: 'Understand and lock mission', durationDays: slice, owners: ['DeliveryBrainAgent', 'ProductStrategist'], outputs: ['intent model', 'assumptions', 'blocker questions', 'north-star metric'], exitCriteria: ['mission accepted', 'no unresolved blocker for build start'] },
    { phase: 'Design enterprise foundation', durationDays: slice, owners: ['SolutionArchitect', 'SecurityAgent', 'DataAIAgent'], outputs: ['architecture', 'security model', 'agent runtime plan'], exitCriteria: ['ADR approved', 'risk model complete', 'model route policy set'] },
    { phase: 'Build product and operating assets', durationDays: slice * 2, owners: ['EngineeringAgent', 'DatabaseReliabilityAgent', 'SREAgent'], outputs: ['code', 'APIs', 'database plan', 'deployment assets', 'runbooks'], exitCriteria: ['typecheck/lint/tests pass', 'security/database gates pass'] },
    { phase: 'Verify and launch', durationDays: slice, owners: ['QAAgent', 'ReleaseAgent', 'CustomerSuccessAgent'], outputs: ['browser QA', 'evals', 'deployment smoke', 'customer report'], exitCriteria: ['evidence package accepted', 'rollback ready', 'customer-facing explanation ready'] },
    { phase: companyScale ? 'Scale company OS' : 'Improve and automate', durationDays: slice, owners: ['AutonomousWorkforceAgent', 'SkillAcademyAgent', 'FinOpsAgent'], outputs: ['learning backlog', 'automation backlog', 'cost report'], exitCriteria: ['top recurring work automated', 'cost per outcome measured'] },
  ];
}

function buildOpsModel(): DeliveryBrainDossier['deploymentAndOperations'] {
  return [
    { capability: 'CI/CD', implementation: 'GitHub Actions/GitLab CI with install, typecheck, lint, tests, build, audit, package, deploy, rollback stages.', evidence: ['workflow logs', 'artifact hash', 'release notes'] },
    { capability: 'Runtime', implementation: 'Docker for local, Kubernetes for enterprise, secrets through vault/provider secret managers.', evidence: ['container image', 'K8s manifest', 'secret reference'] },
    { capability: 'Observability', implementation: 'OpenTelemetry traces, Prometheus metrics, Grafana dashboards, log aggregation, cost telemetry.', evidence: ['trace ID', 'dashboard link', 'alert rule'] },
    { capability: 'Recovery', implementation: 'checkpoint before risky change, rollback preview, backup/restore drill, incident playbook.', evidence: ['checkpoint hash', 'rollback plan', 'restore proof'] },
    { capability: 'Customer reporting', implementation: 'delivery reports with completed scope, verification evidence, cost, risk, and next recommendations.', evidence: ['customer report', 'audit trail', 'SLA summary'] },
  ];
}

export const deliveryBrain = new DeliveryBrainService();
