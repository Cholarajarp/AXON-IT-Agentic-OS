import { nanoid } from 'nanoid';
import { DurableJsonStore } from '../services/durable-json-store.js';
import { SERVICE_CATALOG } from './catalog.js';
import type {
  AgenticBuildPlan,
  AppFeatureChip,
  BuilderApiEndpoint,
  BuilderDataEntity,
  BuilderMode,
  BlueprintBacklogItem,
  CostEstimate,
  GeneratedCodeFile,
  MlSystemPlan,
  ProductRequestInput,
  ProductQualityGate,
  RagSystemPlan,
  RiskLevel,
  ServiceBlueprint,
  ServiceCatalogTemplate,
  ServiceCategory,
  TraceabilityItem,
  UiUxBlueprint,
} from './types.js';

const blueprintStore = new DurableJsonStore<ServiceBlueprint[]>('product-factory/blueprints.json', []);
const blueprints = new Map<string, ServiceBlueprint>(blueprintStore.read().map((blueprint) => [blueprint.id, normalizeBlueprint(blueprint)]));

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
    const builderMode = input.builderMode ?? inferBuilderMode(category, goal);
    const featureChips = inferFeatureChips(input, category, goal);
    const dataSensitivity = input.dataSensitivity ?? inferDataSensitivity(input, riskLevel);
    const acceptanceCriteria = unique([
      ...template.acceptanceCriteria,
      ...deriveAcceptanceCriteria(goal, category),
    ]);
    const backlog = buildBacklog(template, category, acceptanceCriteria);
    const traceability = buildTraceability(acceptanceCriteria, backlog);
    const timelineDays = input.timelineDays ?? adjustTimeline(template.baseTimelineDays, riskLevel, input);
    const enhancedPrompt = enhancePrompt(goal, input, builderMode, featureChips);
    const appMap = buildAppMap(input, category, builderMode, featureChips);
    const screens = buildScreens(input, category, appMap);
    const dataModel = buildDataModel(input, category, featureChips);
    const apiPlan = buildApiPlan(dataModel, featureChips);
    const authPlan = buildAuthPlan(input, featureChips);
    const aiPlan = buildAiPlan(input, category, featureChips);
    const designSystem = buildDesignSystem(input, builderMode);
    const deployTarget = input.deployTarget ?? inferDeployTarget(builderMode, featureChips);
    const uiUxBlueprint = buildUiUxBlueprint(input, category, builderMode, featureChips, appMap, screens, designSystem);
    const ragPlan = buildRagPlan(input, category, featureChips);
    const mlPlan = buildMlPlan(input, category, featureChips, dataSensitivity, riskLevel);
    const agenticBuildPlan = buildAgenticBuildPlan(input, builderMode, featureChips, uiUxBlueprint, ragPlan, mlPlan, riskLevel);
    const generatedFiles = buildGeneratedFiles(input, template, appMap, screens, dataModel, apiPlan, designSystem, uiUxBlueprint, ragPlan, mlPlan, agenticBuildPlan);
    const qualityGates = buildQualityGates(input, riskLevel, featureChips, generatedFiles, uiUxBlueprint, ragPlan, mlPlan, agenticBuildPlan);
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
      approvalRequired: riskLevel === 'high' || riskLevel === 'critical' || dataSensitivity === 'restricted' || cost.totalUsd > 10000,
      builder: {
        mode: builderMode,
        featureChips,
        designStyle: input.designStyle ?? inferDesignStyle(builderMode, category),
        dataSensitivity,
        deployTarget,
        promptQualityScore: scorePrompt(input, featureChips),
        enhancedPrompt,
        followUpQuestions: buildFollowUpQuestions(input, featureChips, riskLevel),
        competitorBaseline: buildCompetitorBaseline(featureChips, deployTarget),
      },
      appMap,
      screens,
      componentInventory: buildComponentInventory(screens, featureChips),
      dataModel,
      apiPlan,
      authPlan,
      aiPlan,
      designSystem,
      uiUxBlueprint,
      ragPlan,
      mlPlan,
      agenticBuildPlan,
      generatedFiles,
      qualityGates,
      deploymentPlan: buildDeploymentPlan(input, deployTarget, featureChips, riskLevel),
      previewSpec: buildPreviewSpec(screens, featureChips),
      ownership: {
        exportMode: 'repo-owned',
        lockInRisk: 'low',
        handoffArtifacts: ['source files', 'schema.sql', 'API contracts', 'test plan', 'deployment runbook'],
      },
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
    blueprint.deliveryBrief = buildDeliveryBrief(blueprint);
    blueprint.engineeringPlan = buildEngineeringPlan(blueprint);
    blueprints.set(blueprint.id, blueprint);
    persist();
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
    persist();
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
    persist();
    return updated;
  }

  markAgenticActivation(
    id: string,
    activation: NonNullable<ServiceBlueprint['agenticActivation']>
  ): ServiceBlueprint | undefined {
    const blueprint = blueprints.get(id);
    if (!blueprint) return undefined;
    const updated: ServiceBlueprint = {
      ...blueprint,
      agenticActivation: activation,
      status: 'executing',
    };
    blueprints.set(id, updated);
    persist();
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
  const attachmentText = (input.attachments ?? [])
    .map((attachment) => `${attachment.kind} ${attachment.name} ${attachment.summary}`)
    .join(' ');
  if (input.dataSensitivity === 'restricted') return 'critical';
  if (input.dataSensitivity === 'confidential') return 'high';
  if (compliance.some((item) => /hipaa|pci|rbi|sebi/i.test(item))) return 'critical';
  if (compliance.some((item) => /soc|iso|gdpr/i.test(item))) return 'high';
  if (constraints.some((item) => /production|customer data|payment|regulated|air.?gapped/i.test(item))) return 'high';
  if (/prod|production|customer data|pii|payment|regulated|secret|credential/i.test(attachmentText)) return 'high';
  return base;
}

function estimateCost(template: ServiceCatalogTemplate, input: ProductRequestInput, risk: RiskLevel): CostEstimate {
  const riskMultiplier = risk === 'critical' ? 1.8 : risk === 'high' ? 1.35 : risk === 'medium' ? 1.15 : 1;
  const integrationMultiplier = 1 + Math.min((input.integrations?.length ?? 0) * 0.08, 0.4);
  const attachmentMultiplier = 1 + Math.min((input.attachments?.length ?? 0) * 0.04, 0.16);
  const implementationUsd = Math.round(template.basePriceUsd * riskMultiplier * integrationMultiplier * attachmentMultiplier);
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
  const attachmentDays = Math.min(input.attachments?.length ?? 0, 4);
  return baseDays + riskDays + integrationDays + attachmentDays;
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
  const attachmentScope = (input.attachments ?? []).map((attachment) => `Use ${attachment.kind} artifact "${attachment.name}": ${attachment.summary}`);
  return unique([
    `Service category: ${category}`,
    ...template.deliverables,
    ...complianceScope,
    ...attachmentScope,
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
  if (input.attachments?.length) {
    risks.push({
      id: 'risk_source_artifacts',
      level: risk === 'critical' ? 'critical' : 'medium',
      description: 'Imported screenshots, schemas, or API specs can contain stale assumptions or sensitive implementation details.',
      mitigation: 'Validate source artifacts against runtime behavior and redact secrets before storing generated evidence.',
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
    ...(input.attachments ?? []).map((attachment) => `${attachment.kind} artifact reviewed: ${attachment.name}`),
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
  const inferredChips = inferFeatureChips(input, category, input.goal);
  const ragEnabled = needsRag(input, category, inferredChips);
  const stack = category === 'data-ai-workflow'
    ? ['React', 'Fastify', 'PostgreSQL', 'pgvector', 'Redis worker queue']
    : ['React', 'Fastify', 'PostgreSQL', ...(ragEnabled ? ['pgvector'] : []), 'Redis', 'Docker Compose'];
  return {
    summary: 'Modular web application, UI/UX system, AI/ML agent runtime, governed APIs, audit evidence, and deployable local-first infrastructure.',
    stack,
    apiContracts: ['POST /product-factory/blueprints', 'GET /product-factory/blueprints/:id', 'POST /orchestrator/execute', ...(ragEnabled ? ['POST /api/v1/rag/ingest', 'POST /api/v1/rag/query'] : [])],
    dataModel: ['tenant', 'project', 'blueprint', 'backlog_item', 'evidence_artifact', ...(ragEnabled ? ['knowledge_document', 'knowledge_chunk'] : []), ...(input.integrations ?? []).map((name) => `${name}_connection`)],
    threatModel: ['Prompt injection', 'secret leakage', 'cross-tenant data access', 'unsafe connector writes', 'unapproved deployment', ...(ragEnabled ? ['poisoned retrieval source', 'uncited hallucination'] : [])],
  };
}

function inferBuilderMode(category: ServiceCategory, goal: string): BuilderMode {
  const lower = goal.toLowerCase();
  if (/(agent|chatbot|copilot|assistant|gemini|llm|ai)/.test(lower) || category === 'data-ai-workflow') return 'ai-agent';
  if (/(workflow|approval|automate|process)/.test(lower) || category === 'automation') return 'workflow-automation';
  if (/(api|sdk|webhook|service)/.test(lower) || category === 'integration') return 'api-service';
  if (/(landing|website|waitlist|marketing)/.test(lower)) return 'landing-to-app';
  if (/(internal|ops|admin|dashboard|back office)/.test(lower)) return 'internal-tool';
  return 'saas-app';
}

function inferFeatureChips(input: ProductRequestInput, category: ServiceCategory, goal: string): AppFeatureChip[] {
  const lower = `${goal} ${(input.integrations ?? []).join(' ')} ${(input.attachments ?? []).map((attachment) => `${attachment.kind} ${attachment.name} ${attachment.summary}`).join(' ')}`.toLowerCase();
  const chips = new Set<AppFeatureChip>(input.featureChips ?? []);
  chips.add('database');
  chips.add('browser-qa');
  chips.add('deploy');
  if (/(login|auth|sso|user|role|tenant)/.test(lower) || category === 'application-build') chips.add('auth');
  if (/(upload|file|image|asset|document)/.test(lower)) chips.add('storage');
  if (/(live|realtime|socket|collaborative|notification)/.test(lower)) chips.add('realtime');
  if (/(stripe|payment|billing|invoice|subscription)/.test(lower)) chips.add('payments');
  if (/(map|location|route|geo|address)/.test(lower)) chips.add('maps');
  if (/(email|invite|notification|digest)/.test(lower)) chips.add('email');
  if (/(ai|agent|chat|copilot|rag|assistant|gemini|llm)/.test(lower)) chips.add('ai-chat');
  if (/(vision|image|screenshot|photo|ocr)/.test(lower)) chips.add('vision');
  if (/(voice|audio|speech|call)/.test(lower)) chips.add('voice');
  if (/(admin|backoffice|settings|ops)/.test(lower)) chips.add('admin');
  if (/(analytics|metric|report|dashboard|kpi)/.test(lower)) chips.add('analytics');
  if (/(search|filter|discover|catalog)/.test(lower)) chips.add('search');
  if (/(workflow|approval|automation|ticket)/.test(lower) || category === 'automation') chips.add('workflow');
  if (/(mobile|iphone|android|responsive)/.test(lower)) chips.add('mobile');
  return Array.from(chips);
}

function enhancePrompt(inputGoal: string, input: ProductRequestInput, mode: BuilderMode, chips: AppFeatureChip[]) {
  const users = input.targetUsers?.length ? input.targetUsers.join(', ') : 'primary users and operators';
  const integrations = input.integrations?.length ? input.integrations.join(', ') : 'no external connectors yet';
  const compliance = input.compliance?.length ? input.compliance.join(', ') : 'standard SaaS security';
  const attachments = input.attachments?.length
    ? input.attachments.map((attachment) => `${attachment.kind}:${attachment.name} (${attachment.summary})`).join('; ')
    : 'none';
  return [
    `Build a ${mode} for ${users}.`,
    `Goal: ${inputGoal}`,
    `Feature chips: ${chips.join(', ')}.`,
    `Integrations: ${integrations}.`,
    `Compliance: ${compliance}.`,
    `Data sensitivity: ${input.dataSensitivity ?? 'internal'}.`,
    `Design: ${input.designStyle ?? 'auto'}; deploy target: ${input.deployTarget ?? 'auto'}.`,
    `Source artifacts: ${attachments}.`,
    `Deliver source-owned code, database schema, API contracts, preview, QA evidence, deployment plan, and rollback/checkpoint path.`,
  ].join(' ');
}

function buildAppMap(input: ProductRequestInput, category: ServiceCategory, mode: BuilderMode, chips: AppFeatureChip[]): ServiceBlueprint['appMap'] {
  const appName = productName(input.goal);
  const map: ServiceBlueprint['appMap'] = [
    { route: '/', name: `${appName} command`, purpose: 'Primary authenticated workspace and overview.', primaryActions: ['Review KPIs', 'Start core workflow', 'Open recent work'], dataNeeded: ['current_user', 'workspace_summary'] },
    { route: '/work', name: 'Work queue', purpose: 'Create, triage, and move work through the main lifecycle.', primaryActions: ['Create item', 'Assign owner', 'Change status'], dataNeeded: ['work_items', 'users', 'activity_log'] },
    { route: '/reports', name: 'Reports', purpose: 'Show outcome, quality, cost, and customer-ready evidence.', primaryActions: ['Filter metrics', 'Export report'], dataNeeded: ['events', 'metrics', 'evidence'] },
    { route: '/settings', name: 'Settings', purpose: 'Configure users, roles, integrations, and deployment settings.', primaryActions: ['Invite user', 'Configure connector', 'Rotate secret'], dataNeeded: ['roles', 'integrations', 'audit_log'] },
  ];
  if (chips.includes('ai-chat')) map.splice(2, 0, { route: '/assistant', name: 'AI assistant', purpose: 'Chat with grounded app context and execute safe actions.', primaryActions: ['Ask question', 'Draft action', 'Run approved tool'], dataNeeded: ['messages', 'memory', 'tool_runs'] });
  if (chips.includes('payments')) map.splice(2, 0, { route: '/billing', name: 'Billing', purpose: 'Manage plans, subscriptions, invoices, and usage limits.', primaryActions: ['Change plan', 'View invoice', 'Update payment method'], dataNeeded: ['plans', 'subscriptions', 'invoices'] });
  if (chips.includes('maps')) map.splice(2, 0, { route: '/map', name: 'Map explorer', purpose: 'Inspect location-aware records and geographic workflows.', primaryActions: ['Search area', 'Open marker', 'Create route'], dataNeeded: ['locations', 'map_layers'] });
  if (mode === 'api-service' || category === 'integration') map.push({ route: '/developer', name: 'Developer console', purpose: 'Manage API keys, webhooks, SDK examples, and logs.', primaryActions: ['Create key', 'Replay webhook', 'Copy SDK snippet'], dataNeeded: ['api_keys', 'webhooks', 'request_logs'] });
  return map;
}

function buildScreens(input: ProductRequestInput, category: ServiceCategory, appMap: ServiceBlueprint['appMap']): ServiceBlueprint['screens'] {
  const personas = derivePersonas(input, category);
  return appMap.map((route, index) => ({
    id: `screen_${String(index + 1).padStart(2, '0')}`,
    name: route.name,
    route: route.route,
    persona: personas[index % personas.length] ?? 'Operator',
    purpose: route.purpose,
    layout: index === 0 ? 'left navigation, KPI strip, work table, right action panel' : 'toolbar, dense data region, contextual detail panel',
    components: route.primaryActions.map((action) => `${action} control`).concat(['Status badge', 'Audit trail', 'Empty state']),
    interactions: route.primaryActions.map((action) => `${action} with optimistic UI and rollback message`),
    states: ['loading skeleton', 'empty state', 'validation error', 'permission denied', 'success toast'],
    acceptanceCriteria: [`${route.name} renders on desktop and mobile`, `Primary actions are keyboard reachable`, `All writes create audit evidence`],
  }));
}

function buildDataModel(input: ProductRequestInput, category: ServiceCategory, chips: AppFeatureChip[]): BuilderDataEntity[] {
  const sensitiveFields: Array<[string, string, boolean, boolean]> = input.dataSensitivity === 'confidential' || input.dataSensitivity === 'restricted'
    ? [['data_classification', 'text', true, false]]
    : [];
  const entities: BuilderDataEntity[] = [
    entity('users', 'Authenticated users and operators', [['id', 'uuid', true, false], ['email', 'text', true, true], ['role', 'text', true, false], ['created_at', 'timestamp', true, false]], ['users belong to tenants'], 'Users can read self; admins manage tenant users.'),
    entity('work_items', 'Primary workflow records', [['id', 'uuid', true, false], ['title', 'text', true, false], ['status', 'text', true, false], ['owner_id', 'uuid', false, false], ['priority', 'text', true, false], ...sensitiveFields], ['work_items owned by users', 'work_items produce evidence'], 'Tenant members read; assigned owners update; admins override.'),
    entity('evidence', 'Action proof and release artifacts', [['id', 'uuid', true, false], ['work_item_id', 'uuid', false, false], ['summary', 'text', true, false], ['artifact_uri', 'text', false, false]], ['evidence belongs to work_items'], 'Tenant members read; system and admins write.'),
  ];
  if (input.attachments?.length) entities.push(entity('source_artifacts', 'Imported specs, screenshots, schemas, and design references', [['id', 'uuid', true, false], ['name', 'text', true, false], ['kind', 'text', true, false], ['summary', 'text', true, false], ['source_hash', 'text', false, false]], ['source_artifacts inform generated screens, schema, and tests'], 'Tenant admins read and write source artifacts; generated evidence stores redacted summaries.'));
  if (chips.includes('payments')) entities.push(entity('subscriptions', 'Billing and plan state', [['id', 'uuid', true, false], ['customer_id', 'text', true, true], ['plan', 'text', true, false], ['status', 'text', true, false]], ['subscriptions map to tenants'], 'Admins read and update billing records.'));
  if (chips.includes('ai-chat')) entities.push(entity('assistant_messages', 'Grounded AI conversations', [['id', 'uuid', true, false], ['thread_id', 'uuid', true, false], ['role', 'text', true, false], ['content', 'text', true, false]], ['messages reference users and tool runs'], 'Thread members read; AI runtime writes with policy.'));
  if (needsRag(input, category, chips)) {
    entities.push(entity('knowledge_documents', 'Source documents indexed for grounded answers', [['id', 'uuid', true, false], ['source_uri', 'text', true, false], ['title', 'text', true, false], ['status', 'text', true, false], ['hash', 'text', true, false]], ['documents produce knowledge_chunks'], 'Tenant members read allowed documents; ingestion service writes.'));
    entities.push(entity('knowledge_chunks', 'Vector-searchable document chunks with citations', [['id', 'uuid', true, false], ['document_id', 'uuid', true, false], ['chunk_text', 'text', true, false], ['citation', 'text', true, false], ['embedding_ref', 'text', true, false]], ['chunks belong to knowledge_documents'], 'Tenant and permission filters apply before retrieval.'));
  }
  if (chips.includes('search')) entities.push(entity('search_documents', 'Searchable indexed records and generated snippets', [['id', 'uuid', true, false], ['record_type', 'text', true, false], ['record_id', 'uuid', true, false], ['title', 'text', true, false], ['snippet', 'text', false, false]], ['search_documents mirror tenant records'], 'Tenant members search only records they can read.'));
  if (chips.includes('storage')) entities.push(entity('files', 'Uploaded documents and media', [['id', 'uuid', true, false], ['name', 'text', true, false], ['bucket_path', 'text', true, false], ['content_type', 'text', true, false]], ['files attach to work_items'], 'Owner and tenant admins read; uploader writes.'));
  if (category === 'integration') entities.push(entity('webhook_events', 'Inbound and outbound integration events', [['id', 'uuid', true, false], ['provider', 'text', true, false], ['status', 'text', true, false], ['payload_hash', 'text', true, false]], ['webhook_events attach to audit log'], 'Service role writes; admins replay.'));
  return entities;
}

function entity(name: string, purpose: string, fields: Array<[string, string, boolean, boolean]>, relationships: string[], rlsPolicy: string): BuilderDataEntity {
  return { name, purpose, fields: fields.map(([fieldName, type, required, pii]) => ({ name: fieldName, type, required, pii })), relationships, rlsPolicy };
}

function buildApiPlan(dataModel: BuilderDataEntity[], chips: AppFeatureChip[]): BuilderApiEndpoint[] {
  const endpoints: BuilderApiEndpoint[] = dataModel.flatMap((entityItem) => [
    {
      method: 'GET' as const,
      path: `/api/v1/${entityItem.name}`,
      purpose: `List ${entityItem.name}`,
      auth: 'user' as const,
      requestSchema: ['query filters', 'pagination cursor'],
      responseSchema: [`${entityItem.name}[]`, 'nextCursor'],
      tests: ['returns tenant-scoped rows', 'rejects unauthenticated requests'],
    },
    {
      method: 'GET' as const,
      path: `/api/v1/${entityItem.name}/:id`,
      purpose: `Read one ${entityItem.name} record`,
      auth: 'user' as const,
      requestSchema: ['id'],
      responseSchema: [entityItem.name],
      tests: ['returns 404 for cross-tenant ids', 'redacts restricted fields for viewers'],
    },
    {
      method: 'POST' as const,
      path: `/api/v1/${entityItem.name}`,
      purpose: `Create ${entityItem.name} record`,
      auth: entityItem.name.includes('webhook') ? 'service' as const : 'user' as const,
      requestSchema: entityItem.fields.filter((field) => field.required).map((field) => field.name),
      responseSchema: [entityItem.name],
      tests: ['validates required fields', 'writes audit evidence'],
    },
    {
      method: 'PATCH' as const,
      path: `/api/v1/${entityItem.name}/:id`,
      purpose: `Update ${entityItem.name} record with optimistic concurrency`,
      auth: entityItem.name.includes('webhook') ? 'service' as const : 'user' as const,
      requestSchema: ['id', 'version', 'patch'],
      responseSchema: [entityItem.name, 'auditEventId'],
      tests: ['rejects stale version', 'rejects cross-tenant update', 'writes audit evidence'],
    },
  ]);
  if (chips.includes('ai-chat')) endpoints.push({
    method: 'POST',
    path: '/api/v1/assistant/respond',
    purpose: 'Run grounded AI response with policy checks',
    auth: 'user',
    requestSchema: ['threadId', 'message', 'toolScopes'],
    responseSchema: ['message', 'citations', 'toolPlan'],
    tests: ['blocks unsafe tool scope', 'returns cited answer'],
  });
  if (chips.includes('ai-chat') || chips.includes('workflow')) endpoints.push({
    method: 'POST',
    path: '/api/v1/agents/run',
    purpose: 'Run an agentic task through planner, executor, critic, and approval gates',
    auth: 'user',
    requestSchema: ['goal', 'toolScopes', 'approvalMode'],
    responseSchema: ['runId', 'plan', 'status', 'evidence'],
    tests: ['requires allowed tool scope', 'creates critic evidence', 'blocks unapproved mutation'],
  });
  if (chips.includes('ai-chat') || chips.includes('search') || dataModel.some((entityItem) => entityItem.name === 'knowledge_chunks')) {
    endpoints.push(
      {
        method: 'POST',
        path: '/api/v1/rag/ingest',
        purpose: 'Ingest and embed tenant-scoped source documents',
        auth: 'admin',
        requestSchema: ['sourceUri', 'sourceType', 'retentionPolicy'],
        responseSchema: ['documentId', 'chunkCount', 'status'],
        tests: ['redacts secrets before embedding', 'stores citation manifest'],
      },
      {
        method: 'POST',
        path: '/api/v1/rag/query',
        purpose: 'Retrieve grounded context with citations for AI responses',
        auth: 'user',
        requestSchema: ['query', 'filters', 'topK'],
        responseSchema: ['chunks', 'citations', 'confidence'],
        tests: ['filters by tenant and permission', 'returns citations for every chunk'],
      },
    );
  }
  return endpoints;
}

function buildAuthPlan(input: ProductRequestInput, chips: AppFeatureChip[]): ServiceBlueprint['authPlan'] {
  const sso = (input.compliance ?? []).some((item) => /soc|iso|hipaa|pci|gdpr/i.test(item));
  return {
    provider: sso ? 'oauth-sso' : chips.includes('auth') ? 'email-password' : 'magic-link',
    roles: [
      { role: 'owner', permissions: ['*'] },
      { role: 'admin', permissions: ['users:manage', 'work:write', 'reports:read'] },
      { role: 'member', permissions: ['work:write', 'reports:read'] },
      { role: 'viewer', permissions: ['work:read', 'reports:read'] },
    ],
    policies: ['tenant isolation on every query', 'admin-only billing and integration writes', 'service tokens cannot access user PII unless scoped'],
  };
}

function buildAiPlan(input: ProductRequestInput, category: ServiceCategory, chips: AppFeatureChip[]): ServiceBlueprint['aiPlan'] {
  const hasAi = chips.includes('ai-chat') || category === 'data-ai-workflow' || needsRag(input, category, chips);
  return {
    modelRoute: hasAi ? 'quality for generation, fast for UI helpers, sovereign for restricted data' : 'fast classification and copy assistance only',
    aiFeatures: hasAi ? ['grounded assistant', 'workflow drafting', 'summarization', 'action planning', ...(needsRag(input, category, chips) ? ['RAG retrieval with citations'] : [])] : ['field suggestions', 'summary generation'],
    guardrails: ['prompt injection scan', 'tool allowlist', 'PII redaction for logs', 'approval before mutations'],
    evals: ['golden prompt regression', 'tool safety eval', 'citation coverage check'],
    memory: hasAi ? ['tenant-scoped semantic memory', 'user preference memory', 'action history memory'] : ['recent activity context'],
  };
}

function buildDesignSystem(input: ProductRequestInput, mode: BuilderMode): ServiceBlueprint['designSystem'] {
  const style = input.designStyle ?? inferDesignStyle(mode, classifyRequest(input.goal));
  const palettes: Record<NonNullable<ProductRequestInput['designStyle']>, string[]> = {
    enterprise: ['#000000', '#007AFF', '#34C759', '#FF9500', '#F2F2F7'],
    consumer: ['#000000', '#007AFF', '#34C759', '#FF3B30', '#FFFFFF'],
    'developer-tool': ['#000000', '#0A84FF', '#30D158', '#BF5AF2', '#F2F2F7'],
    marketplace: ['#000000', '#007AFF', '#34C759', '#FF9500', '#FFFFFF'],
    'ops-console': ['#000000', '#0A84FF', '#30D158', '#FF9F0A', '#111111'],
  };
  return {
    palette: palettes[style],
    typography: ['system UI / SF Pro / Segoe UI', '11px metadata', '14-16px body and controls', '28-34px screen titles', 'SF Mono for ids and metrics'],
    spacing: '4px grid only: 4, 8, 12, 16, 20, 24, 32, 48',
    accessibility: ['WCAG AA contrast', 'visible focus states', 'keyboard navigation', 'screen-reader labels', '44px minimum touch targets', 'state is never color-only'],
    responsiveRules: ['single-column mobile', 'large title collapses to compact header', 'bottom actions become sticky on mobile', 'tables collapse into list rows', 'no clipped long labels'],
  };
}

function buildUiUxBlueprint(
  input: ProductRequestInput,
  category: ServiceCategory,
  mode: BuilderMode,
  chips: AppFeatureChip[],
  appMap: ServiceBlueprint['appMap'],
  screens: ServiceBlueprint['screens'],
  designSystem: ServiceBlueprint['designSystem'],
): UiUxBlueprint {
  const appType = inferAppType(input, category, mode, chips);
  const routeSummary = appMap.map((route) => `${route.route}:${route.name}`).join(', ');
  const visualRules = [
    'Use true black dark mode (#000000 base) and #111111 surfaces.',
    'Use 0.5px or 1px borders only; no decorative shadows.',
    'Use semantic color for state and primary actions only.',
    'Use 4px spacing grid only: 4, 8, 12, 16, 20, 24, 32, 48.',
    'Use system-level type scale: 11, 12, 14, 16, 20, 24, 28, 34.',
    'Build real loading, empty, validation, permission, and success states for every screen.',
  ];
  return {
    appType,
    designBar: 'GitHub Mobile / Microsoft Copilot / Linear quality bar with FRONTEND_DESIGN.md rules applied.',
    visualRules,
    tokenSystem: {
      light: {
        bgBase: '#F2F2F7',
        bgSurface: '#FFFFFF',
        bgElevated: '#FFFFFF',
        borderDefault: 'rgba(0,0,0,0.12)',
        textPrimary: '#000000',
        textSecondary: 'rgba(60,60,67,0.6)',
        accent: designSystem.palette[1] ?? '#007AFF',
        success: '#34C759',
        warning: '#FF9500',
        danger: '#FF3B30',
      },
      dark: {
        bgBase: '#000000',
        bgSurface: '#111111',
        bgElevated: '#1C1C1E',
        borderDefault: 'rgba(255,255,255,0.10)',
        textPrimary: '#FFFFFF',
        textSecondary: 'rgba(235,235,245,0.6)',
        accent: '#0A84FF',
        success: '#30D158',
        warning: '#FF9F0A',
        danger: '#FF453A',
      },
      typeScale: ['11px metadata', '12px captions', '14px body', '16px controls', '20px section', '24px modal', '28px screen title', '34px large title'],
      spacingScale: ['4px', '8px', '12px', '16px', '20px', '24px', '32px', '48px'],
      radiusScale: ['4px badges', '8px inputs', '12px rows/cards', '16px sheets', '20px panels', '999px pills'],
    },
    layoutSystem: {
      navigation: appType === 'mobile-app' ? 'large-title stack header with bottom tab bar' : 'left rail on desktop, compact top header on mobile',
      contentModel: `section list architecture with list rows as the atomic unit, covering routes ${routeSummary}`,
      responsiveRules: designSystem.responsiveRules,
    },
    screenRecipes: screens.map((screen, index) => ({
      screenId: screen.id,
      route: screen.route,
      pattern: index === 0 ? 'large title dashboard with KPI strip and primary list' : routePattern(screen.route),
      primaryComponents: unique(['NavigationHeader', 'FilterChipRow', 'ListRow', 'StatusBadge', ...screen.components.slice(0, 4)]),
      loadingState: `Skeleton rows shaped like ${screen.name} records, no spinner for list content.`,
      emptyState: `${screen.name} centered empty state with 64px icon, 18px title, 14px explanation, and one primary action.`,
      errorState: `${screen.name} inline validation plus permission-denied and integration-unavailable banners.`,
      accessibilityChecks: ['44px minimum touch targets', 'icon-only controls have aria-labels', 'state has text plus color', 'keyboard route is complete'],
    })),
    componentRecipes: buildComponentRecipes(chips),
    interactionRules: [
      'List rows use instant background flash with 150-200ms release.',
      'Buttons use scale(0.97) and opacity feedback.',
      'Tabs use 120ms cross-dissolve; stack pushes use 280ms translate animation.',
      'Chip selection animates border and semantic fill in 150ms.',
      'Respect prefers-reduced-motion with instant state changes.',
    ],
    performanceRules: [
      'Use stable ids for every list row and memoized row components.',
      'Lazy-load non-initial screens and heavy AI/admin surfaces.',
      'Specify image width and height to avoid layout shift.',
      'Keep generated component files under 200 lines or split them.',
    ],
    qualityChecks: [
      { id: 'true-black', title: 'True black dark mode and semantic colors', status: 'pass', evidence: ['dark.bgBase=#000000', 'tokens generated'] },
      { id: 'no-shadows', title: 'No decorative shadows', status: 'pass', evidence: ['component recipes use borders and fills only'] },
      { id: 'stateful-screens', title: 'Every screen has loading, empty, error, and success states', status: 'pass', evidence: screens.map((screen) => screen.id) },
      { id: 'a11y', title: 'Accessibility gates included', status: 'pass', evidence: ['44px touch targets', 'aria labels', 'non-color state'] },
    ],
  };
}

function buildRagPlan(input: ProductRequestInput, category: ServiceCategory, chips: AppFeatureChip[]): RagSystemPlan {
  const enabled = needsRag(input, category, chips);
  return {
    enabled,
    useCases: enabled
      ? ['grounded assistant answers', 'document and ticket search', 'workflow recommendation with citations', 'knowledge-base summarization']
      : ['not enabled for this build; can be activated by adding AI chat, search, docs, or RAG scope'],
    ingestionPipeline: enabled
      ? ['source connector pull', 'document parser', 'PII redaction', 'semantic chunker', 'embedding worker', 'vector upsert', 'citation manifest']
      : [],
    chunkingStrategy: enabled ? '600-900 token semantic chunks with 120-token overlap, headings preserved, tables normalized.' : 'none',
    embeddingModel: enabled ? 'text-embedding-3-large or local bge-large-en for sovereign deployments' : 'none',
    vectorStore: enabled ? 'PostgreSQL pgvector for source-owned default; Pinecone/Weaviate adapter when scale requires managed ANN.' : 'none',
    retrievalStrategy: enabled ? ['hybrid keyword + vector search', 'tenant and permission filters before ranking', 'rerank top 20 to top 6', 'return citations with chunk ids'] : [],
    citationPolicy: enabled ? 'Every answer that uses private knowledge must include source ids and refuse uncited factual claims.' : 'not applicable',
    evaluationPlan: enabled ? ['citation coverage', 'answer faithfulness', 'retrieval recall@10', 'prompt injection corpus', 'latency p95'] : [],
    safetyControls: enabled ? ['prompt injection scan', 'PII redaction before logs', 'tool allowlist', 'tenant-scoped vector filters', 'human approval for mutations'] : [],
  };
}

function buildMlPlan(
  input: ProductRequestInput,
  category: ServiceCategory,
  chips: AppFeatureChip[],
  dataSensitivity: NonNullable<ProductRequestInput['dataSensitivity']>,
  risk: RiskLevel,
): MlSystemPlan {
  const enabled = chips.includes('ai-chat') || chips.includes('vision') || chips.includes('voice') || category === 'data-ai-workflow' || needsRag(input, category, chips);
  const sovereign = dataSensitivity === 'restricted' || risk === 'critical';
  return {
    enabled,
    modelRoutes: enabled
      ? [
        { task: 'UI copy, field suggestions, and low-risk classification', route: 'fast', rationale: 'low cost and fast latency for reversible work' },
        { task: 'architecture generation, RAG answer synthesis, and code planning', route: sovereign ? 'sovereign' : 'quality', rationale: sovereign ? 'restricted data requires approved sovereign runtime' : 'higher quality for product-critical outputs' },
        { task: 'critic, security review, and release readiness evaluation', route: 'quality', rationale: 'quality gate decisions need stronger reasoning' },
      ]
      : [{ task: 'basic helper suggestions', route: 'fast', rationale: 'no AI-heavy workflow requested' }],
    dataPipelines: enabled ? ['event capture', 'redacted prompt/response logs', 'feedback labels', 'golden eval dataset', 'drift review'] : ['usage analytics only'],
    evaluationMetrics: enabled ? ['task success rate', 'groundedness', 'tool safety pass rate', 'cost per successful action', 'p95 latency'] : ['suggestion acceptance rate'],
    guardrails: ['structured output validation', 'unsafe action refusal', 'secret redaction', 'rate limits', 'approval gates for writes'],
    feedbackLoops: enabled ? ['thumbs-up/down labels', 'admin correction queue', 'weekly prompt regression', 'failed retrieval replay'] : ['manual product feedback'],
  };
}

function buildAgenticBuildPlan(
  input: ProductRequestInput,
  mode: BuilderMode,
  chips: AppFeatureChip[],
  uiUxBlueprint: UiUxBlueprint,
  ragPlan: RagSystemPlan,
  mlPlan: MlSystemPlan,
  risk: RiskLevel,
): AgenticBuildPlan {
  const operatingModel: AgenticBuildPlan['operatingModel'] = risk === 'high' || risk === 'critical'
    ? 'multi-agent-supervised'
    : mode === 'ai-agent' || chips.includes('ai-chat') || ragPlan.enabled
      ? 'multi-agent-autonomous'
      : 'multi-agent-supervised';
  return {
    operatingModel,
    team: [
      { role: 'Product Architect Agent', responsibilities: ['freeze requirements', 'derive personas', 'own acceptance criteria'], artifacts: ['product brief', 'traceability matrix'], qualityGate: 'prompt' },
      { role: 'UX Systems Agent', responsibilities: ['apply FRONTEND_DESIGN.md rules', 'design screen recipes', 'check accessibility'], artifacts: ['UI/UX blueprint', 'design tokens', 'screen state matrix'], qualityGate: 'ui-ux' },
      { role: 'Full-Stack Engineer Agent', responsibilities: ['generate app shell', 'API routes', 'tenant schema', 'tests'], artifacts: ['source files', 'schema.sql', 'route manifest'], qualityGate: 'code-package' },
      { role: 'AI/ML Engineer Agent', responsibilities: ['select model routes', 'build RAG plan', 'define evals'], artifacts: ['RAG pipeline', 'model route policy', 'eval plan'], qualityGate: mlPlan.enabled ? 'ai-ml' : 'prompt' },
      { role: 'Security and Release Agent', responsibilities: ['threat model', 'approval gates', 'deploy/rollback'], artifacts: ['release gates', 'deployment plan', 'audit evidence'], qualityGate: 'security' },
    ],
    workflow: [
      { phase: 'Discover', owner: 'Product Architect Agent', inputs: [input.goal], outputs: ['frozen scope', 'personas', 'acceptance tests'], doneWhen: ['prompt score >= 70', 'follow-up questions captured'] },
      { phase: 'Design', owner: 'UX Systems Agent', inputs: [uiUxBlueprint.designBar], outputs: ['tokens', 'screen recipes', 'component recipes'], doneWhen: ['design checks pass', 'states exist for every screen'] },
      { phase: 'Engineer', owner: 'Full-Stack Engineer Agent', inputs: ['app map', 'data model', 'API plan'], outputs: ['generated source package', 'tenant schema', 'route handlers'], doneWhen: ['typecheck/test/build commands defined'] },
      { phase: 'Intelligence', owner: 'AI/ML Engineer Agent', inputs: [ragPlan.enabled ? 'RAG scope' : 'AI helper scope'], outputs: ['model routes', 'guardrails', 'evals'], doneWhen: ['tool safety and citation gates are defined'] },
      { phase: 'Release', owner: 'Security and Release Agent', inputs: ['quality gates', 'deployment target'], outputs: ['approved release plan', 'rollback plan'], doneWhen: ['human gates cleared when required'] },
    ],
    collaborationProtocol: ['AXON-A2A task envelopes', 'shared blueprint state', 'critic loop before release', 'all artifacts linked to evidence requirements'],
    humanGates: risk === 'high' || risk === 'critical'
      ? ['approve restricted data handling', 'approve production deployment', 'approve AI tool mutation scopes']
      : ['approve blueprint before execution'],
    failureModes: [
      { mode: 'ambiguous requirements', detection: 'prompt score below 70 or missing personas', recovery: 'ask decision questions and block launch until resolved' },
      { mode: 'unsafe AI action', detection: 'tool safety eval or policy denial', recovery: 'require human approval and use read-only fallback' },
      { mode: 'bad UI state coverage', detection: 'missing loading/empty/error recipes', recovery: 'regenerate UI/UX blueprint before code handoff' },
      { mode: 'deployment regression', detection: 'browser QA or smoke test fails', recovery: 'rollback artifact and keep previous deployment active' },
    ],
  };
}

function needsRag(input: ProductRequestInput, category: ServiceCategory, chips: AppFeatureChip[]) {
  const text = `${input.goal} ${(input.attachments ?? []).map((attachment) => `${attachment.kind} ${attachment.summary}`).join(' ')}`.toLowerCase();
  return chips.includes('ai-chat') || chips.includes('search') || chips.includes('storage') || category === 'data-ai-workflow' || /\brag\b|knowledge|document|docs|retrieval|citation|semantic search|vector/.test(text);
}

function inferAppType(
  input: ProductRequestInput,
  category: ServiceCategory,
  mode: BuilderMode,
  chips: AppFeatureChip[],
): UiUxBlueprint['appType'] {
  const lower = input.goal.toLowerCase();
  if (mode === 'api-service') return 'api-service';
  if (mode === 'ai-agent' || lower.includes('agentic platform')) return 'agentic-platform';
  if (needsRag(input, category, chips)) return 'rag-agent';
  if (chips.includes('mobile') || /mobile|ios|android/.test(lower)) return 'mobile-app';
  if (/desktop|electron/.test(lower)) return 'desktop-app';
  return 'web-app';
}

function routePattern(route: string) {
  if (route === '/') return 'large-title command dashboard';
  if (/assistant|agent/i.test(route)) return 'agent session list with chat/detail split';
  if (/settings/i.test(route)) return 'sectioned settings list with disclosure rows and toggles';
  if (/report|analytics/i.test(route)) return 'metric sections with filter chips and export actions';
  if (/billing/i.test(route)) return 'settings-style subscription sections with status badges';
  return 'section list with filter chips, rows, and contextual detail panel';
}

function buildComponentRecipes(chips: AppFeatureChip[]): UiUxBlueprint['componentRecipes'] {
  const base: UiUxBlueprint['componentRecipes'] = [
    {
      name: 'NavigationHeader',
      purpose: 'Large title and compact title header with icon actions.',
      states: ['large title', 'collapsed', 'back navigation', 'action pending'],
      responsiveRules: ['44px compact height', '96px large-title mode', 'mobile action icons stay 44x44'],
      accessibility: ['icon actions include aria-labels', 'title remains screen-reader visible'],
    },
    {
      name: 'ListRow',
      purpose: 'Atomic row for records, sessions, tasks, notifications, and settings.',
      states: ['default', 'pressed overlay', 'selected', 'disabled', 'unread'],
      responsiveRules: ['64px minimum height', 'left icon 40px', 'separator inset at 68px', 'right meta truncates last'],
      accessibility: ['row has button role', 'title and subtitle combined in label', 'not color-only'],
    },
    {
      name: 'StatusBadge',
      purpose: 'Semantic state indicator for builds, issues, workflows, and releases.',
      states: ['open', 'pending', 'success', 'warning', 'failed', 'merged'],
      responsiveRules: ['pill radius 999px', '12px text', 'dot plus label'],
      accessibility: ['state text is visible', 'dot is decorative only'],
    },
    {
      name: 'FilterChipRow',
      purpose: 'Horizontal filtering for dense work queues and knowledge retrieval.',
      states: ['inactive', 'active', 'dropdown', 'overflow scroll'],
      responsiveRules: ['44px row height', '8px chip gaps', 'sticky under header'],
      accessibility: ['chip has pressed state', 'dropdown chips expose selected value'],
    },
  ];
  if (chips.includes('ai-chat')) {
    base.push({
      name: 'AgentSessionRow',
      purpose: 'AI/agent work session row with status, diff counters, and evidence.',
      states: ['planning', 'executing', 'needs approval', 'complete', 'blocked'],
      responsiveRules: ['full-width row, no decorative card nesting', 'status and diff wrap on mobile'],
      accessibility: ['agent status is text and badge', 'approval action is keyboard reachable'],
    });
  }
  if (chips.includes('search')) {
    base.push({
      name: 'CitationPanel',
      purpose: 'Shows grounded RAG sources, confidence, and retrieval trace.',
      states: ['loading skeleton', 'no citations', 'low confidence', 'cited answer'],
      responsiveRules: ['right panel on desktop', 'bottom sheet on mobile'],
      accessibility: ['citation links have source names', 'confidence is text not color only'],
    });
  }
  return base;
}

function buildGeneratedFiles(
  input: ProductRequestInput,
  template: ServiceCatalogTemplate,
  appMap: ServiceBlueprint['appMap'],
  screens: ServiceBlueprint['screens'],
  dataModel: BuilderDataEntity[],
  apiPlan: BuilderApiEndpoint[],
  designSystem: ServiceBlueprint['designSystem'],
  uiUxBlueprint: UiUxBlueprint,
  ragPlan: RagSystemPlan,
  mlPlan: MlSystemPlan,
  agenticBuildPlan: AgenticBuildPlan,
): GeneratedCodeFile[] {
  const name = productName(input.goal);
  return [
    {
      path: 'src/App.tsx',
      language: 'tsx',
      purpose: 'Primary React application shell with generated routes',
      content: buildReactAppFile(name, appMap, screens, uiUxBlueprint),
    },
    {
      path: 'src/screens/generated-screens.ts',
      language: 'ts',
      purpose: 'Screen metadata generated from product request',
      content: `export const screens = ${JSON.stringify(screens, null, 2)};\n`,
    },
    {
      path: 'db/schema.sql',
      language: 'sql',
      purpose: 'PostgreSQL schema with tenant-ready tables',
      content: buildSchemaSql(dataModel),
    },
    {
      path: 'src/api/routes.ts',
      language: 'ts',
      purpose: 'Fastify route manifest, tenant guard, and audit-ready handlers',
      content: buildApiRoutesFile(apiPlan),
    },
    {
      path: 'src/lib/release-gates.ts',
      language: 'ts',
      purpose: 'Executable release gate contract for CI and human approval',
      content: buildReleaseGatesFile(input, dataModel, apiPlan, uiUxBlueprint, ragPlan, mlPlan),
    },
    {
      path: 'src/theme/tokens.ts',
      language: 'ts',
      purpose: 'FRONTEND_DESIGN.md token system for web/mobile app UI',
      content: buildThemeTokensFile(uiUxBlueprint),
    },
    {
      path: 'src/components/generated-ui-recipes.ts',
      language: 'ts',
      purpose: 'Generated UI/UX recipes for screens, components, states, and accessibility',
      content: `export const uiUxBlueprint = ${JSON.stringify(uiUxBlueprint, null, 2)};\n`,
    },
    {
      path: 'ai/rag-pipeline.ts',
      language: 'ts',
      purpose: 'RAG ingestion, retrieval, citation, and evaluation plan',
      content: buildRagPipelineFile(ragPlan),
    },
    {
      path: 'ai/agentic-build-team.ts',
      language: 'ts',
      purpose: 'AI/ML software delivery team and agent workflow contract',
      content: buildAgenticTeamFile(agenticBuildPlan, mlPlan),
    },
    {
      path: 'tests/e2e/primary-flow.spec.ts',
      language: 'ts',
      purpose: 'Playwright smoke test skeleton for generated app flow and UI states',
      content: buildPlaywrightSpecFile(name, screens, uiUxBlueprint),
    },
    {
      path: 'design/tokens.json',
      language: 'json',
      purpose: 'Design token starter set',
      content: JSON.stringify({ product: name, palette: designSystem.palette, typography: designSystem.typography, frontendDesign: uiUxBlueprint.tokenSystem }, null, 2),
    },
    {
      path: 'README.generated.md',
      language: 'md',
      purpose: 'Builder handoff package',
      content: `# ${name}\n\nTemplate: ${template.name}\n\n${input.goal}\n\n## Generated system\n\n- UI/UX blueprint: FRONTEND_DESIGN.md tokens, screen recipes, component states, accessibility, and performance rules.\n- Full-stack package: React app shell, Fastify route manifest, PostgreSQL tenant schema, and release gates.\n- AI/ML package: ${mlPlan.enabled ? 'model routing, eval metrics, guardrails, and feedback loops' : 'basic helper policy'}.\n- RAG package: ${ragPlan.enabled ? 'ingestion, chunking, embeddings, retrieval, citations, and evals' : 'not enabled for this request'}.\n- Agentic delivery team: ${agenticBuildPlan.team.map((member) => member.role).join(', ')}.\n\n## Production checklist\n\n- Configure DATABASE_URL, SESSION_SECRET, AUDIT_SIGNING_KEY, and provider secrets.\n- Run db/schema.sql in a tenant-aware PostgreSQL database.\n- Register src/api/routes.ts in the Fastify server.\n- Run typecheck, unit tests, Playwright smoke tests, RAG evals when enabled, and dependency audit before launch.\n- Keep every release tied to src/lib/release-gates.ts evidence.\n\n## Run\n\nnpm install\nnpm run typecheck\nnpm run test\nnpm run build\n`,
    },
  ];
}

function buildReactAppFile(
  name: string,
  appMap: ServiceBlueprint['appMap'],
  screens: ServiceBlueprint['screens'],
  uiUxBlueprint: UiUxBlueprint,
): string {
  return `import { useMemo, useState } from 'react';

const appName = ${JSON.stringify(name)};
const routes = ${JSON.stringify(appMap, null, 2)} as const;
const screens = ${JSON.stringify(screens.map((screen) => ({
    name: screen.name,
    route: screen.route,
    persona: screen.persona,
    purpose: screen.purpose,
    layout: screen.layout,
    components: screen.components,
    interactions: screen.interactions,
    states: screen.states,
  })), null, 2)} as const;
const design = ${JSON.stringify({
    screenRecipes: uiUxBlueprint.screenRecipes,
    interactionRules: uiUxBlueprint.interactionRules,
  }, null, 2)} as const;
const css = ${JSON.stringify(buildGeneratedAppCss())};

type RoutePath = (typeof routes)[number]['route'];

export function App() {
  const [activeRoute, setActiveRoute] = useState<RoutePath>(routes[0]?.route ?? '/');
  const activeRouteSpec = routes.find((route) => route.route === activeRoute) ?? routes[0];
  const activeScreen = screens.find((screen) => screen.route === activeRoute);
  const metrics = useMemo(() => [
    { label: 'Actions', value: String(activeRouteSpec?.primaryActions.length ?? 0) },
    { label: 'Data sets', value: String(activeRouteSpec?.dataNeeded.length ?? 0) },
    { label: 'States', value: String(activeScreen?.states.length ?? 0) },
  ], [activeRouteSpec, activeScreen]);
  const activeRecipe = design.screenRecipes.find((recipe) => recipe.route === activeRoute);

  return (
    <div data-theme="dark" className="axon-app">
      <style>{css}</style>
      <aside className="sidebar" aria-label="Application routes">
        <div className="brand">{appName}</div>
        <nav className="nav">
          {routes.map((route) => (
            <button
              key={route.route}
              type="button"
              onClick={() => setActiveRoute(route.route)}
              className={route.route === activeRoute ? 'nav-item active' : 'nav-item'}
            >
              {route.name}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main">
        <header className="header">
          <div>
            <p className="eyebrow">{activeScreen?.persona ?? 'Operator'}</p>
            <h1>{activeRouteSpec?.name}</h1>
          </div>
          <button className="primary-button">
            {activeRouteSpec?.primaryActions[0] ?? 'Create record'}
          </button>
        </header>
        <section className="content">
          <div className="metric-grid">
            {metrics.map((metric) => (
              <div key={metric.label} className="metric-row">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
          <div className="workspace">
            <section className="surface">
              <h2>{activeRouteSpec?.purpose}</h2>
              <p className="body">{activeScreen?.layout}</p>
              <div className="filter-row" aria-label="Primary actions">
                {activeRouteSpec?.primaryActions.map((action) => (
                  <button key={action} className="filter-chip" type="button">
                    {action}
                  </button>
                ))}
              </div>
              <div className="list-section">
                {activeRouteSpec?.dataNeeded.map((item) => (
                  <button key={item} type="button" className="list-row">
                    <span className="row-icon" aria-hidden="true" />
                    <span className="row-content">
                      <span className="row-title">{item}</span>
                      <span className="row-subtitle">{activeRecipe?.pattern ?? 'Generated application state'}</span>
                    </span>
                    <span className="badge">Ready</span>
                  </button>
                ))}
              </div>
            </section>
            <section className="surface">
              <h2>State coverage</h2>
              <div className="state-list">
                {activeScreen?.states.map((state) => (
                  <div key={state} className="state-item">
                    <span className="state-dot" aria-hidden="true" />
                    <span>{state}</span>
                  </div>
                ))}
              </div>
              <div className="empty-state">
                <div className="empty-icon" aria-hidden="true" />
                <strong>{activeRecipe?.emptyState ?? 'No records yet'}</strong>
                <span>{activeRecipe?.loadingState ?? 'Skeleton rows replace spinners.'}</span>
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
`;
}

function buildGeneratedAppCss() {
  return [
    ':root { --bg-base:#F2F2F7; --bg-surface:#FFFFFF; --bg-elevated:#FFFFFF; --bg-overlay:rgba(0,0,0,0.04); --border-default:rgba(0,0,0,0.12); --border-subtle:rgba(0,0,0,0.08); --text-primary:#000000; --text-secondary:rgba(60,60,67,0.6); --text-tertiary:rgba(60,60,67,0.3); --color-accent:#007AFF; --fill-accent:rgba(0,122,255,0.10); --fill-neutral:rgba(0,0,0,0.05); }',
    '[data-theme="dark"] { --bg-base:#000000; --bg-surface:#111111; --bg-elevated:#1C1C1E; --bg-overlay:rgba(255,255,255,0.04); --border-default:rgba(255,255,255,0.10); --border-subtle:rgba(255,255,255,0.06); --text-primary:#FFFFFF; --text-secondary:rgba(235,235,245,0.6); --text-tertiary:rgba(235,235,245,0.3); --color-accent:#0A84FF; --fill-accent:rgba(10,132,255,0.15); --fill-neutral:rgba(255,255,255,0.08); }',
    '* { box-sizing:border-box; box-shadow:none; }',
    '.axon-app { min-height:100vh; display:grid; grid-template-columns:264px 1fr; background:var(--bg-base); color:var(--text-primary); font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",system-ui,sans-serif; }',
    '.sidebar { border-right:1px solid var(--border-subtle); background:var(--bg-surface); padding:20px 16px; }',
    '.brand { font-size:20px; line-height:1.2; font-weight:700; letter-spacing:-0.02em; }',
    '.nav { margin-top:24px; display:grid; gap:4px; }',
    '.nav-item { min-height:44px; border:0; border-radius:12px; background:transparent; color:var(--text-secondary); padding:0 12px; text-align:left; font-size:14px; font-weight:500; }',
    '.nav-item:hover { background:var(--bg-overlay); color:var(--text-primary); }',
    '.nav-item.active { background:var(--fill-accent); color:var(--color-accent); }',
    '.main { min-width:0; }',
    '.header { min-height:72px; display:flex; align-items:center; justify-content:space-between; gap:16px; border-bottom:1px solid var(--border-subtle); background:var(--bg-surface); padding:16px 20px; }',
    '.eyebrow { margin:0 0 4px; color:var(--text-secondary); font-size:12px; line-height:16px; }',
    'h1 { margin:0; font-size:34px; line-height:40px; letter-spacing:-0.02em; }',
    'h2 { margin:0; font-size:20px; line-height:26px; }',
    '.primary-button { min-height:48px; border:0; border-radius:12px; background:var(--color-accent); color:white; padding:0 24px; font-size:16px; font-weight:600; }',
    '.primary-button:active { transform:scale(.97); opacity:.9; }',
    '.content { padding:20px; display:grid; gap:16px; }',
    '.metric-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }',
    '.metric-row { min-height:64px; border:1px solid var(--border-default); border-radius:12px; background:var(--bg-surface); padding:12px 16px; }',
    '.metric-row span { display:block; color:var(--text-secondary); font-size:12px; line-height:16px; }',
    '.metric-row strong { display:block; margin-top:4px; font-size:28px; line-height:34px; }',
    '.workspace { display:grid; grid-template-columns:1.15fr .85fr; gap:16px; align-items:start; }',
    '.surface { border:1px solid var(--border-default); border-radius:12px; background:var(--bg-surface); padding:16px; overflow:hidden; }',
    '.body { color:var(--text-secondary); font-size:14px; line-height:20px; }',
    '.filter-row { display:flex; flex-wrap:wrap; gap:8px; margin-top:16px; }',
    '.filter-chip { min-height:36px; border:1px solid var(--border-default); border-radius:999px; background:transparent; color:var(--text-secondary); padding:0 14px; font-size:14px; }',
    '.filter-chip:hover { background:var(--bg-overlay); color:var(--text-primary); }',
    '.list-section { margin-top:16px; border:1px solid var(--border-default); border-radius:12px; overflow:hidden; }',
    '.list-row { width:100%; min-height:64px; display:flex; align-items:center; gap:12px; border:0; border-bottom:1px solid var(--border-subtle); background:var(--bg-surface); color:var(--text-primary); padding:12px 16px; text-align:left; }',
    '.list-row:last-child { border-bottom:0; }',
    '.list-row:hover { background:var(--bg-overlay); }',
    '.row-icon { width:40px; height:40px; border-radius:10px; background:var(--fill-neutral); }',
    '.row-content { flex:1; min-width:0; display:grid; gap:2px; }',
    '.row-title { font-size:15px; line-height:20px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
    '.row-subtitle { color:var(--text-secondary); font-size:13px; line-height:18px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
    '.badge { border-radius:999px; background:var(--fill-accent); color:var(--color-accent); padding:4px 10px; font-size:12px; font-weight:500; }',
    '.state-list { margin-top:12px; display:grid; gap:8px; }',
    '.state-item { display:flex; align-items:center; gap:8px; min-height:36px; color:var(--text-secondary); font-size:14px; }',
    '.state-dot { width:7px; height:7px; border-radius:999px; background:var(--color-accent); }',
    '.empty-state { margin-top:20px; display:grid; justify-items:center; gap:8px; padding:32px 16px; text-align:center; color:var(--text-secondary); }',
    '.empty-icon { width:64px; height:64px; border-radius:20px; background:var(--fill-neutral); }',
    '.empty-state strong { color:var(--text-primary); font-size:18px; line-height:24px; }',
    '.empty-state span { max-width:360px; font-size:14px; line-height:20px; }',
    '@media (max-width:860px) { .axon-app{grid-template-columns:1fr;} .sidebar{display:none;} .header{align-items:flex-start; flex-direction:column; padding:16px;} h1{font-size:28px; line-height:34px;} .content{padding:16px;} .metric-grid,.workspace{grid-template-columns:1fr;} }',
  ].join('\n');
}

function buildThemeTokensFile(uiUxBlueprint: UiUxBlueprint): string {
  return `export const lightTokens = ${JSON.stringify(uiUxBlueprint.tokenSystem.light, null, 2)} as const;

export const darkTokens = ${JSON.stringify(uiUxBlueprint.tokenSystem.dark, null, 2)} as const;

export const typeScale = ${JSON.stringify(uiUxBlueprint.tokenSystem.typeScale, null, 2)} as const;
export const spacingScale = ${JSON.stringify(uiUxBlueprint.tokenSystem.spacingScale, null, 2)} as const;
export const radiusScale = ${JSON.stringify(uiUxBlueprint.tokenSystem.radiusScale, null, 2)} as const;

export const frontendDesignRules = ${JSON.stringify(uiUxBlueprint.visualRules, null, 2)} as const;

export type ThemeTokens = typeof lightTokens;
`;
}

function buildRagPipelineFile(ragPlan: RagSystemPlan): string {
  return `export const ragPlan = ${JSON.stringify(ragPlan, null, 2)} as const;

export type RagSource = {
  id: string;
  tenantId: string;
  uri: string;
  content: string;
  metadata?: Record<string, string>;
};

export function planIngestion(source: RagSource) {
  if (!ragPlan.enabled) return { enabled: false, steps: [] };
  return {
    enabled: true,
    sourceId: source.id,
    tenantId: source.tenantId,
    steps: ragPlan.ingestionPipeline,
    chunkingStrategy: ragPlan.chunkingStrategy,
    safetyControls: ragPlan.safetyControls,
  };
}

export function assembleGroundedAnswer(input: { question: string; chunks: Array<{ id: string; text: string; citation: string }> }) {
  const citations = input.chunks.map((chunk) => chunk.citation);
  return {
    question: input.question,
    context: input.chunks.map((chunk) => chunk.text).join('\\n\\n'),
    citations,
    policy: ragPlan.citationPolicy,
  };
}
`;
}

function buildAgenticTeamFile(agenticBuildPlan: AgenticBuildPlan, mlPlan: MlSystemPlan): string {
  return `export const agenticBuildPlan = ${JSON.stringify(agenticBuildPlan, null, 2)} as const;
export const mlPlan = ${JSON.stringify(mlPlan, null, 2)} as const;

export type BuildPhase = (typeof agenticBuildPlan.workflow)[number]['phase'];

export function nextAgentForPhase(phase: BuildPhase) {
  const item = agenticBuildPlan.workflow.find((step) => step.phase === phase);
  if (!item) throw new Error('Unknown build phase: ' + phase);
  return {
    owner: item.owner,
    expectedOutputs: item.outputs,
    doneWhen: item.doneWhen,
  };
}

export function requiresHumanGate(riskSignal: string) {
  return agenticBuildPlan.humanGates.some((gate) => gate.toLowerCase().includes(riskSignal.toLowerCase()));
}
`;
}

function buildPlaywrightSpecFile(
  name: string,
  screens: ServiceBlueprint['screens'],
  uiUxBlueprint: UiUxBlueprint,
): string {
  const visibleScreens = screens.slice(0, 4).map((screen) => ({ name: screen.name, route: screen.route }));
  return `import { expect, test } from '@playwright/test';

// Design bar: ${uiUxBlueprint.designBar}

test.describe(${JSON.stringify(`${name} generated primary flow`)}, () => {
  test('renders generated routes and required UI states', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /${escapeRegExp(screens[0]?.name ?? name)}/i })).toBeVisible();

    for (const screen of ${JSON.stringify(visibleScreens, null, 2)}) {
      await expect(page.getByText(screen.name, { exact: false }).first()).toBeVisible();
    }
    await expect(page.locator('.list-row').first()).toBeVisible();
  });
});
`;
}

function buildSchemaSql(dataModel: BuilderDataEntity[]): string {
  const tables = dataModel.map((entityItem) => {
    const columns = [
      '  id UUID PRIMARY KEY DEFAULT gen_random_uuid()',
      '  tenant_id UUID NOT NULL',
      ...entityItem.fields
        .filter((field) => !['id', 'tenant_id', 'created_at', 'updated_at'].includes(field.name))
        .map((field) => `  ${field.name} ${sqlType(field.type)}${field.required ? ' NOT NULL' : ''}${field.pii ? ' /* PII: encrypt, mask, and redact from logs */' : ''}`),
      '  created_at TIMESTAMPTZ NOT NULL DEFAULT now()',
      '  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()',
    ];
    const piiComments = entityItem.fields
      .filter((field) => field.pii)
      .map((field) => `COMMENT ON COLUMN ${entityItem.name}.${field.name} IS 'PII: mask in exports, redact in logs, encrypt where supported';`);
    return [
      `CREATE TABLE IF NOT EXISTS ${entityItem.name} (`,
      columns.join(',\n'),
      ');',
      `CREATE INDEX IF NOT EXISTS idx_${entityItem.name}_tenant_created ON ${entityItem.name} (tenant_id, created_at DESC);`,
      `ALTER TABLE ${entityItem.name} ENABLE ROW LEVEL SECURITY;`,
      `CREATE POLICY ${entityItem.name}_tenant_isolation ON ${entityItem.name}`,
      "  USING (tenant_id::text = current_setting('app.tenant_id', true))",
      "  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));",
      ...piiComments,
    ].join('\n');
  });
  return ['CREATE EXTENSION IF NOT EXISTS pgcrypto;', ...tables].join('\n\n');
}

function buildApiRoutesFile(apiPlan: BuilderApiEndpoint[]): string {
  return `import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export const endpoints = ${JSON.stringify(apiPlan, null, 2)} as const;

type TenantRequest = FastifyRequest & {
  user?: { id: string; tenantId: string; role: 'owner' | 'admin' | 'member' | 'viewer' };
};

function requireTenant(request: TenantRequest, reply: FastifyReply) {
  const tenantId = request.user?.tenantId ?? request.headers['x-tenant-id'];
  if (!tenantId || Array.isArray(tenantId)) {
    reply.status(401).send({ error: 'TenantRequired', message: 'Authenticated tenant context is required.' });
    return undefined;
  }
  return tenantId;
}

export async function registerGeneratedRoutes(app: FastifyInstance) {
  for (const endpoint of endpoints) {
    app.route({
      method: endpoint.method,
      url: endpoint.path,
      preHandler: async (request, reply) => {
        if (!requireTenant(request as TenantRequest, reply)) return;
      },
      handler: async (request, reply) => {
        const tenantId = requireTenant(request as TenantRequest, reply);
        if (!tenantId) return;
        return reply.send({
          endpoint: endpoint.method + ' ' + endpoint.path,
          tenantId,
          schema: { request: endpoint.requestSchema, response: endpoint.responseSchema },
          evidence: {
            tests: endpoint.tests,
            auditRequired: endpoint.method !== 'GET',
          },
        });
      },
    });
  }
}
`;
}

function buildReleaseGatesFile(
  input: ProductRequestInput,
  dataModel: BuilderDataEntity[],
  apiPlan: BuilderApiEndpoint[],
  uiUxBlueprint: UiUxBlueprint,
  ragPlan: RagSystemPlan,
  mlPlan: MlSystemPlan,
): string {
  const gates = [
    { id: 'tenant-scope', required: true, evidence: ['tenant_id on every table', 'RLS enabled', 'cross-tenant API tests'] },
    { id: 'authz', required: true, evidence: ['role matrix', 'unauthenticated request tests', 'viewer redaction tests'] },
    { id: 'mutation-audit', required: true, evidence: ['POST/PATCH audit evidence', 'rollback path', 'idempotency checks'] },
    { id: 'ui-ux', required: true, evidence: ['FRONTEND_DESIGN.md tokens', 'screen recipes', 'loading/empty/error states', '44px touch targets'] },
    { id: 'browser-qa', required: true, evidence: ['desktop smoke', 'mobile smoke', 'error states'] },
    { id: 'data-safety', required: input.dataSensitivity === 'restricted' || input.dataSensitivity === 'confidential', evidence: ['PII redaction', 'retention policy', 'model routing policy'] },
    { id: 'rag-evals', required: ragPlan.enabled, evidence: ['citation coverage', 'retrieval recall@10', 'prompt injection corpus'] },
    { id: 'ai-ml', required: mlPlan.enabled, evidence: ['model route policy', 'tool safety eval', 'feedback loop'] },
  ];
  return `export const releaseGates = ${JSON.stringify(gates, null, 2)} as const;

export const generatedSurface = {
  tables: ${JSON.stringify(dataModel.map((entityItem) => entityItem.name), null, 2)},
  endpoints: ${JSON.stringify(apiPlan.map((endpoint) => `${endpoint.method} ${endpoint.path}`), null, 2)},
  appType: ${JSON.stringify(uiUxBlueprint.appType)},
  designBar: ${JSON.stringify(uiUxBlueprint.designBar)},
};

export function canRelease(results: Record<string, boolean>) {
  const missing = releaseGates.filter((gate) => gate.required && !results[gate.id]);
  return {
    ok: missing.length === 0,
    missing: missing.map((gate) => gate.id),
  };
}
`;
}

function buildQualityGates(
  input: ProductRequestInput,
  risk: RiskLevel,
  chips: AppFeatureChip[],
  files: GeneratedCodeFile[],
  uiUxBlueprint?: UiUxBlueprint,
  ragPlan?: RagSystemPlan,
  mlPlan?: MlSystemPlan,
  agenticBuildPlan?: AgenticBuildPlan,
): ProductQualityGate[] {
  const regulated = risk === 'high' || risk === 'critical' || input.dataSensitivity === 'restricted' || input.dataSensitivity === 'confidential';
  const gates: ProductQualityGate[] = [
    gate('prompt', 'Prompt has enough product detail', scorePrompt(input, chips) >= 70 ? 'pass' : 'warn', scorePrompt(input, chips), ['goal', 'users', 'features'], 'Add users, primary workflow, data, integrations, and success criteria.'),
    gate('code-package', 'Code package generated', files.length >= 9 ? 'pass' : 'block', files.length * 10, files.map((file) => file.path), 'Generate app shell, schema, API, design tokens, AI/RAG plans, tests, and README.'),
    gate('ui-ux', 'FRONTEND_DESIGN UI/UX blueprint generated', uiUxBlueprint ? 'pass' : 'block', uiUxBlueprint ? 94 : 0, uiUxBlueprint ? ['true black tokens', 'screen recipes', 'component states', ...uiUxBlueprint.qualityChecks.map((item) => item.id)] : [], 'Apply tokens, screen recipes, state coverage, accessibility, and performance rules.'),
    gate('database', 'Database and tenant model ready', chips.includes('database') ? 'pass' : 'warn', chips.includes('database') ? 90 : 50, ['schema.sql', 'RLS policy notes'], 'Keep every entity tenant-scoped before production.'),
    gate('security', 'Security and auth controls planned', chips.includes('auth') || regulated ? 'pass' : 'warn', regulated ? 90 : 72, ['auth plan', 'threat model'], 'Attach SSO/RBAC and secret handling before launch.'),
    gate('data-safety', 'Sensitive data handling planned', regulated ? 'pass' : 'warn', regulated ? 88 : 62, ['PII policy', 'tenant isolation', 'retention plan'], 'Confirm retention, redaction, and model routing before production data use.'),
    gate('ai-ml', 'AI/ML engineering plan ready', mlPlan?.enabled ? 'pass' : chips.includes('ai-chat') ? 'warn' : 'pass', mlPlan?.enabled ? 90 : 72, mlPlan ? [...mlPlan.evaluationMetrics.slice(0, 3), ...mlPlan.guardrails.slice(0, 2)] : [], 'Define model routes, evals, guardrails, and feedback loops.'),
    gate('rag-agent', 'RAG agent architecture ready', ragPlan?.enabled ? 'pass' : 'warn', ragPlan?.enabled ? 92 : 55, ragPlan?.enabled ? ['ingestion pipeline', 'chunking strategy', 'retrieval ranking', 'citation policy'] : ['RAG disabled for this request'], 'Enable RAG when the app needs grounded knowledge, retrieval, documents, or citations.'),
    gate('agentic-delivery', 'Agentic software team workflow ready', agenticBuildPlan ? 'pass' : 'warn', agenticBuildPlan ? 91 : 45, agenticBuildPlan ? agenticBuildPlan.team.map((member) => member.role) : [], 'Planner, UX, full-stack, AI/ML, security, and release agents must own artifacts and gates.'),
    gate('browser-qa', 'Browser QA path exists', chips.includes('browser-qa') ? 'pass' : 'warn', chips.includes('browser-qa') ? 86 : 45, ['primary flow', 'mobile states', 'error states'], 'Run Playwright preview checks before handoff.'),
    gate('deploy', 'Deploy and rollback plan exists', chips.includes('deploy') ? 'pass' : 'warn', chips.includes('deploy') ? 84 : 40, ['deployment target', 'rollback commands'], 'Connect target provider and smoke test.'),
  ];
  return gates;
}

function gate(id: string, title: string, status: ProductQualityGate['status'], score: number, evidence: string[], nextAction: string): ProductQualityGate {
  return { id, title, status, score: Math.max(0, Math.min(100, Math.round(score))), evidence, nextAction };
}

function buildDeploymentPlan(input: ProductRequestInput, target: NonNullable<ProductRequestInput['deployTarget']>, chips: AppFeatureChip[], risk: RiskLevel): ServiceBlueprint['deploymentPlan'] {
  const restricted = input.dataSensitivity === 'restricted' || risk === 'critical';
  const envVars = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'AUDIT_SIGNING_KEY',
    ...(restricted ? ['SOVEREIGN_MODEL_ENDPOINT', 'DATA_RETENTION_DAYS'] : []),
    ...(chips.includes('ai-chat') ? ['MODEL_PROVIDER', 'MODEL_API_KEY'] : []),
    ...(chips.includes('payments') ? ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] : []),
  ];
  return {
    target,
    environments: risk === 'high' || risk === 'critical' ? ['dev', 'staging', 'production'] : ['preview', 'production'],
    envVars,
    commands: ['npm install', 'npm run typecheck', 'npm test -- --run', 'npm run build', deployCommand(target)],
    rollback: ['Keep previous artifact', 'Run smoke test before promotion', 'Rollback deployment if health or primary flow fails'],
    observability: ['health endpoint', 'structured logs', 'error rate alert', 'p95 latency dashboard', ...(input.compliance?.length ? ['audit evidence export'] : [])],
  };
}

function buildPreviewSpec(screens: ServiceBlueprint['screens'], _chips: AppFeatureChip[]): ServiceBlueprint['previewSpec'] {
  return {
    status: 'interactive',
    primaryFlow: screens.slice(0, 4).map((screen) => `Open ${screen.name} and complete ${screen.interactions[0]}`),
    testUsers: ['owner@example.com', 'member@example.com', 'viewer@example.com'],
    emptyStates: screens.map((screen) => `${screen.name}: no records yet`),
    loadingStates: ['route skeleton', 'table skeleton', 'button pending state'],
    errorStates: ['validation error', 'permission denied', 'integration unavailable', 'AI/tool action blocked'],
  };
}

function buildComponentInventory(screens: ServiceBlueprint['screens'], chips: AppFeatureChip[]): ServiceBlueprint['componentInventory'] {
  const base = [
    { name: 'AppShell', kind: 'layout' as const, reusedFromSystem: true, notes: 'Sidebar, topbar, responsive content region.' },
    { name: 'CommandInput', kind: 'input' as const, reusedFromSystem: false, notes: 'Prompt and natural-language action input.' },
    { name: 'DataTable', kind: 'data-display' as const, reusedFromSystem: true, notes: 'Sortable, filterable dense table.' },
    { name: 'StatusToast', kind: 'feedback' as const, reusedFromSystem: true, notes: 'Success and error state feedback.' },
  ];
  if (chips.includes('ai-chat')) base.push({ name: 'AssistantPanel', kind: 'layout' as const, reusedFromSystem: false, notes: 'Grounded AI chat with tool plan preview.' });
  if (chips.includes('maps')) base.push({ name: 'MapCanvas', kind: 'data-display' as const, reusedFromSystem: false, notes: 'Map surface with marker inspector.' });
  return uniqueByName([...base, ...screens.slice(0, 3).map((screen) => ({ name: `${screen.name}View`, kind: 'layout' as const, reusedFromSystem: false, notes: screen.purpose }))]);
}

function buildFollowUpQuestions(input: ProductRequestInput, chips: AppFeatureChip[], risk: RiskLevel): ServiceBlueprint['builder']['followUpQuestions'] {
  const questions: ServiceBlueprint['builder']['followUpQuestions'] = [];
  if (!input.targetUsers?.length) questions.push({ id: 'users', question: 'Who are the primary users and admins?', whyItMatters: 'Personas determine navigation, roles, and acceptance tests.', defaultAnswer: 'Owner, operator, viewer' });
  if (!input.integrations?.length) questions.push({ id: 'integrations', question: 'Which systems should this connect to first?', whyItMatters: 'Connectors drive data model, secrets, and failure states.', defaultAnswer: 'GitHub, Slack, PostgreSQL' });
  if (chips.includes('payments')) questions.push({ id: 'billing', question: 'What plans, limits, and invoice events are required?', whyItMatters: 'Billing must be modeled before subscription launch.', defaultAnswer: 'Free, Pro, Enterprise with usage limits' });
  if (risk === 'high' || risk === 'critical') questions.push({ id: 'compliance', question: 'What data is restricted and who approves production writes?', whyItMatters: 'Regulated data requires routing, audit, and approval gates.', defaultAnswer: 'Admins approve restricted-data actions' });
  return questions.slice(0, 5);
}

function buildCompetitorBaseline(chips: AppFeatureChip[], target: NonNullable<ProductRequestInput['deployTarget']>): ServiceBlueprint['builder']['competitorBaseline'] {
  return [
    { platform: 'Lovable', capability: 'Chat-to-app, Supabase backend, GitHub/export/deploy flow', axonResponse: 'Generate app, DB, auth, API, evidence, and source-owned handoff without platform lock-in.' },
    { platform: 'Replit', capability: 'Agentic app creation, database integration, checkpoints, cloud deployment', axonResponse: `Create build plan, generated files, checkpoint/rollback plan, and ${target} deployment commands.` },
    { platform: 'Google AI Studio', capability: 'Build mode, AI chips, starter apps, Gemini feature experiments', axonResponse: `Feature chips enabled: ${chips.join(', ')} with enterprise quality gates and release proof.` },
  ];
}

function normalizeBlueprint(blueprint: ServiceBlueprint): ServiceBlueprint {
  const needsUpgrade =
    !blueprint.builder ||
    !blueprint.generatedFiles ||
    !blueprint.generatedFiles.some((file) => file.path === 'src/lib/release-gates.ts') ||
    !blueprint.apiPlan?.some((endpoint) => endpoint.method === 'PATCH') ||
    !blueprint.qualityGates?.some((gateItem) => gateItem.id === 'data-safety') ||
    !blueprint.uiUxBlueprint ||
    !blueprint.ragPlan ||
    !blueprint.mlPlan ||
    !blueprint.agenticBuildPlan;
  if (!needsUpgrade) return blueprint;
  const fallbackInput: ProductRequestInput = {
    goal: blueprint.goal,
    tenantId: blueprint.tenantId,
    customerName: blueprint.customerName,
    builderMode: blueprint.builder?.mode,
    featureChips: blueprint.builder?.featureChips,
    designStyle: blueprint.builder?.designStyle,
    dataSensitivity: blueprint.builder?.dataSensitivity,
    deployTarget: blueprint.builder?.deployTarget,
    integrations: blueprint.dependencies.filter((item) => /connector|integration|github|slack|jira|stripe/i.test(item)),
  };
  const mode = fallbackInput.builderMode ?? inferBuilderMode(blueprint.category, blueprint.goal);
  const chips = fallbackInput.featureChips ?? inferFeatureChips(fallbackInput, blueprint.category, blueprint.goal);
  const deployTarget = fallbackInput.deployTarget ?? inferDeployTarget(mode, chips);
  const appMap = buildAppMap(fallbackInput, blueprint.category, mode, chips);
  const screens = buildScreens(fallbackInput, blueprint.category, appMap);
  const dataModel = buildDataModel(fallbackInput, blueprint.category, chips);
  const apiPlan = buildApiPlan(dataModel, chips);
  const designSystem = buildDesignSystem(fallbackInput, mode);
  const uiUxBlueprint = buildUiUxBlueprint(fallbackInput, blueprint.category, mode, chips, appMap, screens, designSystem);
  const ragPlan = buildRagPlan(fallbackInput, blueprint.category, chips);
  const mlPlan = buildMlPlan(fallbackInput, blueprint.category, chips, fallbackInput.dataSensitivity ?? 'internal', 'medium');
  const agenticBuildPlan = buildAgenticBuildPlan(fallbackInput, mode, chips, uiUxBlueprint, ragPlan, mlPlan, 'medium');
  const files = buildGeneratedFiles(fallbackInput, { ...SERVICE_CATALOG[0]!, id: blueprint.templateId, name: blueprint.templateName, category: blueprint.category }, appMap, screens, dataModel, apiPlan, designSystem, uiUxBlueprint, ragPlan, mlPlan, agenticBuildPlan);
  return {
    ...blueprint,
    builder: {
      mode,
      featureChips: chips,
      designStyle: fallbackInput.designStyle ?? inferDesignStyle(mode, blueprint.category),
      dataSensitivity: fallbackInput.dataSensitivity ?? 'internal',
      deployTarget,
      promptQualityScore: scorePrompt(fallbackInput, chips),
      enhancedPrompt: enhancePrompt(blueprint.goal, fallbackInput, mode, chips),
      followUpQuestions: buildFollowUpQuestions(fallbackInput, chips, 'medium'),
      competitorBaseline: buildCompetitorBaseline(chips, deployTarget),
    },
    appMap,
    screens,
    componentInventory: buildComponentInventory(screens, chips),
    dataModel,
    apiPlan,
    authPlan: buildAuthPlan(fallbackInput, chips),
    aiPlan: buildAiPlan(fallbackInput, blueprint.category, chips),
    designSystem,
    uiUxBlueprint,
    ragPlan,
    mlPlan,
    agenticBuildPlan,
    generatedFiles: files,
    qualityGates: buildQualityGates(fallbackInput, 'medium', chips, files, uiUxBlueprint, ragPlan, mlPlan, agenticBuildPlan),
    deploymentPlan: buildDeploymentPlan(fallbackInput, deployTarget, chips, 'medium'),
    previewSpec: buildPreviewSpec(screens, chips),
    ownership: { exportMode: 'repo-owned', lockInRisk: 'low', handoffArtifacts: ['source files', 'schema.sql', 'API contracts', 'test plan'] },
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
    `Builder mode: ${blueprint.builder.mode}`,
    `Feature chips: ${blueprint.builder.featureChips.join(', ')}`,
    `Timeline: ${blueprint.estimates.timelineDays} days`,
    `Estimated cost: $${blueprint.estimates.cost.totalUsd.toLocaleString('en-US')}`,
    `Acceptance: ${blueprint.acceptanceCriteria.slice(0, 3).join('; ')}`,
    `Deployment: ${blueprint.deploymentPlan.target}`,
  ].join('\n');
}

function buildEngineeringPlan(blueprint: ServiceBlueprint): string {
  return [
    ...blueprint.backlog.map((item) => `${item.id} ${item.priority} ${item.ownerAgent}: ${item.title}`),
    `Screens: ${blueprint.screens.map((screen) => screen.route).join(', ')}`,
    `API: ${blueprint.apiPlan.map((endpoint) => `${endpoint.method} ${endpoint.path}`).join('; ')}`,
    `Quality gates: ${blueprint.qualityGates.map((gateItem) => `${gateItem.id}=${gateItem.status}`).join(', ')}`,
  ].join('\n');
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function uniqueByName<T extends { name: string }>(values: T[]): T[] {
  const map = new Map<string, T>();
  for (const value of values) map.set(value.name, value);
  return Array.from(map.values());
}

function scorePrompt(input: ProductRequestInput, chips: AppFeatureChip[]) {
  const goal = input.goal.trim();
  let score = Math.min(35, Math.floor(goal.length / 4));
  if (input.targetUsers?.length) score += 12;
  if (input.integrations?.length) score += 10;
  if (input.compliance?.length) score += 8;
  if (input.constraints?.length) score += 8;
  if (input.attachments?.length) score += Math.min(8, input.attachments.length * 4);
  if (input.designStyle) score += 3;
  if (input.deployTarget) score += 3;
  if (input.dataSensitivity) score += 4;
  if (input.budgetUsd) score += 5;
  if (input.timelineDays) score += 5;
  score += Math.min(17, chips.length * 2);
  return Math.max(20, Math.min(100, score));
}

function inferDeployTarget(mode: BuilderMode, chips: AppFeatureChip[]): NonNullable<ProductRequestInput['deployTarget']> {
  if (mode === 'landing-to-app') return 'vercel';
  if (mode === 'api-service') return 'cloud-run';
  if (chips.includes('realtime') || chips.includes('workflow')) return 'kubernetes';
  return 'docker-compose';
}

function inferDesignStyle(mode: BuilderMode, category: ServiceCategory): NonNullable<ProductRequestInput['designStyle']> {
  if (mode === 'internal-tool' || category === 'ops-remediation') return 'ops-console';
  if (mode === 'api-service') return 'developer-tool';
  if (mode === 'landing-to-app') return 'consumer';
  if (category === 'integration') return 'developer-tool';
  return 'enterprise';
}

function inferDataSensitivity(input: ProductRequestInput, risk: RiskLevel): NonNullable<ProductRequestInput['dataSensitivity']> {
  if (input.dataSensitivity) return input.dataSensitivity;
  if ((input.compliance ?? []).some((item) => /hipaa|pci|gdpr|rbi|sebi/i.test(item))) return 'restricted';
  if (risk === 'high' || risk === 'critical') return 'confidential';
  return 'internal';
}

function productName(goal: string) {
  const cleaned = goal
    .replace(/^build\s+(a|an|the)?\s*/i, '')
    .replace(/\b(app|application|tool|platform|saas|mvp)\b/gi, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ').filter(Boolean).slice(0, 4);
  return words.length ? words.map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' ') : 'Generated App';
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sqlType(type: string) {
  const map: Record<string, string> = {
    uuid: 'UUID',
    text: 'TEXT',
    timestamp: 'TIMESTAMPTZ',
    boolean: 'BOOLEAN',
    number: 'NUMERIC',
  };
  return map[type] ?? 'TEXT';
}

function deployCommand(target: NonNullable<ProductRequestInput['deployTarget']>) {
  const map: Record<NonNullable<ProductRequestInput['deployTarget']>, string> = {
    vercel: 'npx vercel deploy',
    replit: 'replit deploy',
    'cloud-run': 'gcloud run deploy',
    kubernetes: 'kubectl apply -f k8s/',
    'docker-compose': 'docker compose up -d',
    static: 'npm run build && npx serve dist',
  };
  return map[target];
}

function persist() {
  blueprintStore.write(Array.from(blueprints.values()));
}
