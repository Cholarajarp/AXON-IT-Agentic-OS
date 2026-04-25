import { nanoid } from 'nanoid';
import { SERVICE_CATALOG } from './catalog.js';
import type {
  BlueprintBacklogItem,
  CostEstimate,
  ProductRequestInput,
  RiskLevel,
  ServiceBlueprint,
  ServiceCatalogTemplate,
  ServiceCategory,
  TraceabilityItem,
} from './types.js';

const blueprints = new Map<string, ServiceBlueprint>();

const CATEGORY_TERMS: Array<{ category: ServiceCategory; terms: string[] }> = [
  { category: 'application-build', terms: ['app', 'saas', 'mvp', 'product', 'portal', 'dashboard', 'build'] },
  { category: 'repo-modernization', terms: ['modernize', 'legacy', 'fix repo', 'broken build', 'upgrade dependencies', 'refactor'] },
  { category: 'deployment-ops', terms: ['deploy', 'kubernetes', 'aws', 'gcp', 'azure', 'operate', 'production'] },
  { category: 'automation', terms: ['automate', 'workflow', 'approval', 'manual process', 'back office'] },
  { category: 'integration', terms: ['integrate', 'connector', 'sync', 'jira', 'slack', 'servicenow', 'github'] },
  { category: 'data-ai-workflow', terms: ['rag', 'data', 'analytics', 'ai workflow', 'ml', 'model'] },
  { category: 'ops-remediation', terms: ['incident', 'outage', 'latency', 'sre', 'monitoring'] },
  { category: 'security-remediation', terms: ['security', 'vulnerability', 'soc', 'iso', 'compliance', 'audit'] },
  { category: 'support', terms: ['support', 'ticket', 'sla', 'helpdesk'] },
  { category: 'advisory', terms: ['strategy', 'roadmap', 'architecture review', 'consult'] },
];

export class ProductFactoryService {
  listCatalog(): ServiceCatalogTemplate[] {
    return SERVICE_CATALOG;
  }

  createBlueprint(input: ProductRequestInput): ServiceBlueprint {
    const goal = input.goal.trim();
    const category = classifyRequest(goal);
    const template = selectTemplate(category, goal);
    const riskLevel = computeRisk(template.defaultRisk, input);
    const cost = estimateCost(template, input, riskLevel);
    const acceptanceCriteria = unique([
      ...template.acceptanceCriteria,
      ...deriveAcceptanceCriteria(goal, category),
    ]);
    const backlog = buildBacklog(template, category, acceptanceCriteria);
    const traceability = buildTraceability(acceptanceCriteria, backlog);
    const timelineDays = input.timelineDays ?? adjustTimeline(template.baseTimelineDays, riskLevel, input);
    const blueprint: ServiceBlueprint = {
      id: `bp_${nanoid(10)}`,
      tenantId: input.tenantId || 'tenant_default',
      customerName: input.customerName || 'Default customer',
      category,
      templateId: template.id,
      templateName: template.name,
      goal,
      personas: derivePersonas(input, category),
      scope: deriveScope(template, category, input),
      nonGoals: deriveNonGoals(category),
      assumptions: deriveAssumptions(input, category),
      risks: deriveRisks(riskLevel, input, category),
      dependencies: deriveDependencies(input, category),
      acceptanceCriteria,
      backlog,
      architecture: buildArchitecture(category, input),
      estimates: {
        timelineDays,
        effortPersonDays: Math.ceil(timelineDays * (riskLevel === 'high' ? 1.6 : riskLevel === 'critical' ? 2.1 : 1.25)),
        cost,
      },
      evidenceRequirements: buildEvidenceRequirements(category, riskLevel),
      traceability,
      deliveryBrief: '',
      engineeringPlan: '',
      approvalRequired: riskLevel === 'high' || riskLevel === 'critical' || cost.totalUsd > 10000,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
    blueprint.deliveryBrief = buildDeliveryBrief(blueprint);
    blueprint.engineeringPlan = buildEngineeringPlan(blueprint);
    blueprints.set(blueprint.id, blueprint);
    return blueprint;
  }

  getBlueprint(id: string): ServiceBlueprint | undefined {
    return blueprints.get(id);
  }

  listBlueprints(): ServiceBlueprint[] {
    return [...blueprints.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  approveBlueprint(id: string): ServiceBlueprint | undefined {
    const blueprint = blueprints.get(id);
    if (!blueprint) return undefined;
    const status: ServiceBlueprint['status'] = blueprint.approvalRequired
      ? 'approved'
      : 'ready-for-execution';
    const updated = { ...blueprint, status };
    blueprints.set(id, updated);
    return updated;
  }

  markExecuting(
    id: string,
    execution: NonNullable<ServiceBlueprint['execution']>
  ): ServiceBlueprint | undefined {
    const blueprint = blueprints.get(id);
    if (!blueprint) return undefined;
    const updated: ServiceBlueprint = { ...blueprint, status: 'executing', execution };
    blueprints.set(id, updated);
    return updated;
  }
}

export const productFactory = new ProductFactoryService();

export function classifyRequest(goal: string): ServiceCategory {
  const lower = goal.toLowerCase();
  const scores = CATEGORY_TERMS.map(({ category, terms }) => ({
    category,
    score: terms.reduce((sum, term) => sum + (lower.includes(term) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score);
  return scores[0] && scores[0].score > 0 ? scores[0].category : 'advisory';
}

function selectTemplate(category: ServiceCategory, goal: string): ServiceCatalogTemplate {
  const direct = SERVICE_CATALOG.find((template) => template.category === category);
  if (direct) return direct;
  const lower = goal.toLowerCase();
  if (lower.includes('repo') || lower.includes('legacy')) return SERVICE_CATALOG[1]!;
  if (lower.includes('deploy') || lower.includes('operate')) return SERVICE_CATALOG[2]!;
  if (lower.includes('workflow') || lower.includes('automation')) return SERVICE_CATALOG[3]!;
  return SERVICE_CATALOG[0]!;
}

function computeRisk(base: RiskLevel, input: ProductRequestInput): RiskLevel {
  const compliance = input.compliance ?? [];
  const constraints = input.constraints ?? [];
  if (compliance.some((item) => /hipaa|pci|soc|iso|gdpr|rbi|sebi/i.test(item))) return 'high';
  if (constraints.some((item) => /production|customer data|payment|regulated|air.?gapped/i.test(item))) return 'high';
  return base;
}

function estimateCost(template: ServiceCatalogTemplate, input: ProductRequestInput, risk: RiskLevel): CostEstimate {
  const riskMultiplier = risk === 'critical' ? 1.8 : risk === 'high' ? 1.35 : risk === 'medium' ? 1.15 : 1;
  const integrationMultiplier = 1 + Math.min((input.integrations?.length ?? 0) * 0.08, 0.4);
  const implementationUsd = Math.round(template.basePriceUsd * riskMultiplier * integrationMultiplier);
  const infrastructureUsd = Math.round(implementationUsd * 0.08);
  const modelUsd = Math.round(implementationUsd * 0.04);
  const supportUsd = Math.round(implementationUsd * 0.12);
  const totalUsd = implementationUsd + infrastructureUsd + modelUsd + supportUsd;
  return {
    implementationUsd,
    modelUsd,
    infrastructureUsd,
    supportUsd,
    totalUsd: input.budgetUsd ? Math.min(totalUsd, Math.max(input.budgetUsd, implementationUsd)) : totalUsd,
    confidence: input.constraints?.length ? 0.74 : 0.82,
  };
}

function adjustTimeline(baseDays: number, risk: RiskLevel, input: ProductRequestInput): number {
  const riskDays = risk === 'high' ? 4 : risk === 'critical' ? 8 : risk === 'medium' ? 2 : 0;
  const integrationDays = Math.min(input.integrations?.length ?? 0, 5);
  return baseDays + riskDays + integrationDays;
}

function derivePersonas(input: ProductRequestInput, category: ServiceCategory): string[] {
  if (input.targetUsers?.length) return input.targetUsers;
  const defaults: Record<ServiceCategory, string[]> = {
    'application-build': ['Product owner', 'End user', 'Platform administrator'],
    'repo-modernization': ['Engineering manager', 'Maintainer', 'Reviewer'],
    'deployment-ops': ['SRE', 'Release manager', 'Service owner'],
    automation: ['Operations lead', 'Approver', 'Process operator'],
    integration: ['System owner', 'Operations analyst', 'Administrator'],
    'data-ai-workflow': ['Data analyst', 'AI operator', 'Business reviewer'],
    'ops-remediation': ['Incident commander', 'SRE', 'Affected user'],
    'security-remediation': ['Security engineer', 'Compliance owner', 'System owner'],
    support: ['Support agent', 'Customer success manager', 'End user'],
    advisory: ['Executive sponsor', 'Technical lead', 'Delivery lead'],
  };
  return defaults[category];
}

function deriveScope(template: ServiceCatalogTemplate, category: ServiceCategory, input: ProductRequestInput): string[] {
  const complianceScope = input.compliance?.length ? [`Compliance profile: ${input.compliance.join(', ')}`] : [];
  return unique([
    `Service category: ${category}`,
    ...template.deliverables,
    ...complianceScope,
    ...(input.integrations ?? []).map((integration) => `Connector setup: ${integration}`),
  ]);
}

function deriveNonGoals(category: ServiceCategory): string[] {
  const shared = ['Unapproved production writes', 'Credential collection in plain text', 'Undocumented manual handoffs'];
  if (category === 'application-build') return [...shared, 'Native mobile apps unless separately scoped'];
  if (category === 'deployment-ops') return [...shared, 'Cloud account creation without customer-owned credentials'];
  return shared;
}

function deriveAssumptions(input: ProductRequestInput, category: ServiceCategory): string[] {
  return [
    'Customer can provide repository, cloud, and connector access through governed secrets',
    'Human approval is available for medium and high-risk gates',
    `Initial delivery is optimized for ${category} and can expand after acceptance`,
    ...(input.constraints ?? []).map((constraint) => `Constraint accepted: ${constraint}`),
  ];
}

function deriveRisks(risk: RiskLevel, input: ProductRequestInput, category: ServiceCategory) {
  const risks = [
    {
      id: 'risk_scope',
      level: 'medium' as RiskLevel,
      description: 'Vague requirements can expand scope during implementation.',
      mitigation: 'Freeze acceptance criteria in the approved blueprint before execution.',
    },
    {
      id: 'risk_access',
      level: 'medium' as RiskLevel,
      description: 'Missing repository, cloud, or connector access can block delivery.',
      mitigation: 'Collect access checklist and validate permissions during discovery.',
    },
  ];
  if (risk === 'high' || risk === 'critical') {
    risks.push({
      id: 'risk_compliance',
      level: risk,
      description: 'Sensitive or regulated data may require stricter routing, audit, and retention controls.',
      mitigation: 'Use sovereign model routing, tenant-scoped audit logs, and explicit approval gates.',
    });
  }
  if (category === 'deployment-ops' || input.constraints?.some((item) => /production/i.test(item))) {
    risks.push({
      id: 'risk_production',
      level: 'high',
      description: 'Deployment changes can affect live services.',
      mitigation: 'Require smoke tests, rollback plan, and progressive rollout before production promotion.',
    });
  }
  return risks;
}

function deriveDependencies(input: ProductRequestInput, category: ServiceCategory): string[] {
  return unique([
    'Approved blueprint',
    'Repository or project workspace access',
    'Environment variable and secret inventory',
    ...(category === 'deployment-ops' ? ['Cloud account or Kubernetes cluster access'] : []),
    ...(input.integrations ?? []).map((integration) => `${integration} connector credentials`),
  ]);
}

function deriveAcceptanceCriteria(goal: string, category: ServiceCategory): string[] {
  return [
    `Delivery demonstrably satisfies: ${goal}`,
    'All generated artifacts include traceability back to acceptance criteria',
    category === 'deployment-ops'
      ? 'Deployment smoke tests pass and rollback instructions are verified'
      : 'Typecheck, tests, build, and dependency audit pass before handoff',
  ];
}

function buildBacklog(template: ServiceCatalogTemplate, category: ServiceCategory, acceptanceCriteria: string[]): BlueprintBacklogItem[] {
  const firstCriteria = acceptanceCriteria.slice(0, 3);
  return [
    {
      id: 'BL-001',
      title: 'Discovery and requirements freeze',
      ownerAgent: 'BusinessAnalystAgent',
      priority: 'P0',
      acceptanceCriteria: firstCriteria,
      dependencies: [],
    },
    {
      id: 'BL-002',
      title: 'Architecture, threat model, and delivery plan',
      ownerAgent: 'SolutionArchitectAgent',
      priority: 'P0',
      acceptanceCriteria: ['Architecture summary, APIs, data model, and risk register are created'],
      dependencies: ['BL-001'],
    },
    {
      id: 'BL-003',
      title: `Implement ${template.name}`,
      ownerAgent: category === 'deployment-ops' ? 'InfrastructureAgent' : 'EngineeringAgent',
      priority: 'P1',
      acceptanceCriteria: acceptanceCriteria.slice(-3),
      dependencies: ['BL-002'],
    },
    {
      id: 'BL-004',
      title: 'QA, security, evidence, and handoff',
      ownerAgent: 'QAAgent',
      priority: 'P1',
      acceptanceCriteria: ['Tests pass', 'Audit evidence is attached', 'Customer delivery brief is generated'],
      dependencies: ['BL-003'],
    },
  ];
}

function buildTraceability(criteria: string[], backlog: BlueprintBacklogItem[]): TraceabilityItem[] {
  return criteria.map((criterion, index) => ({
    requirementId: `REQ-${String(index + 1).padStart(3, '0')}`,
    acceptanceCriterion: criterion,
    backlogItemIds: unique(backlog
      .filter((item) => item.acceptanceCriteria.some((itemCriterion) => criterion.includes(itemCriterion) || itemCriterion.includes(criterion)))
      .map((item) => item.id)
      .concat(index < 2 ? ['BL-001'] : [])),
    evidenceRequired: ['test-result', 'diff-summary', 'delivery-note'],
  }));
}

function buildArchitecture(category: ServiceCategory, input: ProductRequestInput) {
  const stack = category === 'data-ai-workflow'
    ? ['React', 'Fastify', 'PostgreSQL', 'pgvector', 'Redis worker queue']
    : ['React', 'Fastify', 'PostgreSQL', 'Redis', 'Docker Compose'];
  return {
    summary: 'Modular web application and agent runtime with governed APIs, audit evidence, and deployable local-first infrastructure.',
    stack,
    apiContracts: ['POST /product-factory/blueprints', 'GET /product-factory/blueprints/:id', 'POST /orchestrator/execute'],
    dataModel: ['tenant', 'project', 'blueprint', 'backlog_item', 'evidence_artifact', ...(input.integrations ?? []).map((name) => `${name}_connection`)],
    threatModel: ['Prompt injection', 'secret leakage', 'cross-tenant data access', 'unsafe connector writes', 'unapproved deployment'],
  };
}

function buildEvidenceRequirements(category: ServiceCategory, risk: RiskLevel): string[] {
  return [
    'Approved blueprint snapshot',
    'Requirement-to-backlog traceability matrix',
    'Typecheck, test, build, and audit logs',
    'Security and dependency scan summary',
    ...(category === 'deployment-ops' ? ['Deployment smoke test evidence', 'Rollback plan'] : []),
    ...(risk === 'high' || risk === 'critical' ? ['Approval record', 'Data handling and model routing evidence'] : []),
  ];
}

function buildDeliveryBrief(blueprint: ServiceBlueprint): string {
  return [
    `${blueprint.templateName} for ${blueprint.customerName}`,
    `Goal: ${blueprint.goal}`,
    `Timeline: ${blueprint.estimates.timelineDays} days`,
    `Estimated cost: $${blueprint.estimates.cost.totalUsd.toLocaleString('en-US')}`,
    `Acceptance: ${blueprint.acceptanceCriteria.slice(0, 3).join('; ')}`,
  ].join('\n');
}

function buildEngineeringPlan(blueprint: ServiceBlueprint): string {
  return blueprint.backlog
    .map((item) => `${item.id} ${item.priority} ${item.ownerAgent}: ${item.title}`)
    .join('\n');
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
