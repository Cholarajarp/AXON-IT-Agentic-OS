import { nanoid } from 'nanoid';
import type {
  LearningSource,
  LearningSourceInput,
  RoleSkillProfile,
  SkillDomain,
  TeamSkillPlan,
  TeamSkillPlanInput,
} from './types.js';

const sources = new Map<string, LearningSource>();
const plans = new Map<string, TeamSkillPlan>();

const roleCatalog: RoleSkillProfile[] = [
  {
    role: 'Product Strategist',
    mission: 'Convert business intent into scoped outcomes, acceptance criteria, and value metrics.',
    domains: ['product', 'customer-success'],
    requiredSkills: [
      { name: 'service blueprinting', domain: 'product', targetLevel: 4, evidence: ['PRD', 'scope boundaries', 'acceptance criteria'] },
      { name: 'customer journey mapping', domain: 'customer-success', targetLevel: 4, evidence: ['persona map', 'user flow', 'success metric'] },
      { name: 'value and cost framing', domain: 'finops', targetLevel: 3, evidence: ['ROI estimate', 'pricing model'] },
    ],
    tools: ['ProductFactory', 'ServiceDesk', 'ManagedServices', 'Analytics'],
    handoffs: ['Solution Architect', 'Delivery Manager', 'Customer Success Lead'],
  },
  {
    role: 'Solution Architect',
    mission: 'Design secure, scalable architecture and technical delivery contracts.',
    domains: ['architecture', 'security', 'database', 'devops'],
    requiredSkills: [
      { name: 'system design', domain: 'architecture', targetLevel: 5, evidence: ['architecture diagram', 'ADR', 'API contract'] },
      { name: 'threat modeling', domain: 'security', targetLevel: 4, evidence: ['trust boundary', 'risk register'] },
      { name: 'data modeling', domain: 'database', targetLevel: 4, evidence: ['schema plan', 'migration strategy'] },
    ],
    tools: ['ArchitectureCompiler', 'SecurityCenter', 'DatabasePipeline'],
    handoffs: ['Full Stack Engineer', 'Security Engineer', 'Database Reliability Engineer'],
  },
  {
    role: 'Full Stack Engineer',
    mission: 'Implement production code, tests, API contracts, and user-facing workflows.',
    domains: ['frontend', 'backend', 'qa'],
    requiredSkills: [
      { name: 'React application engineering', domain: 'frontend', targetLevel: 4, evidence: ['accessible UI', 'state management', 'responsive layout'] },
      { name: 'API engineering', domain: 'backend', targetLevel: 4, evidence: ['validated routes', 'typed schemas', 'error handling'] },
      { name: 'test-driven delivery', domain: 'qa', targetLevel: 4, evidence: ['unit tests', 'integration tests', 'regression tests'] },
    ],
    tools: ['CodeIntelligence', 'TestRunner', 'Preview'],
    handoffs: ['QA Engineer', 'Release Engineer'],
  },
  {
    role: 'Database Reliability Engineer',
    mission: 'Protect customer data with safe migrations, backups, performance, and quality gates.',
    domains: ['database', 'sre', 'security'],
    requiredSkills: [
      { name: 'expand-contract migrations', domain: 'database', targetLevel: 5, evidence: ['safe migration plan', 'rollback proof'] },
      { name: 'query and lock analysis', domain: 'database', targetLevel: 4, evidence: ['performance review', 'lock-risk finding'] },
      { name: 'backup and restore assurance', domain: 'sre', targetLevel: 4, evidence: ['restore drill', 'RTO/RPO evidence'] },
    ],
    tools: ['DatabasePipeline', 'Checkpoints', 'Observability'],
    handoffs: ['SRE', 'Security Engineer', 'Release Engineer'],
  },
  {
    role: 'Security and Compliance Engineer',
    mission: 'Enforce policy, protect secrets, block unsafe actions, and produce audit evidence.',
    domains: ['security', 'devops', 'customer-success'],
    requiredSkills: [
      { name: 'secure SDLC', domain: 'security', targetLevel: 5, evidence: ['security gate', 'dependency scan', 'remediation proof'] },
      { name: 'identity and least privilege', domain: 'security', targetLevel: 4, evidence: ['access review', 'role mapping'] },
      { name: 'compliance evidence packaging', domain: 'customer-success', targetLevel: 4, evidence: ['audit pack', 'control mapping'] },
    ],
    tools: ['SecurityCenter', 'PolicyEngine', 'Evidence'],
    handoffs: ['Release Engineer', 'Customer Success Lead'],
  },
  {
    role: 'SRE and Cloud Operations Engineer',
    mission: 'Run services with observability, incident response, capacity, and reliability automation.',
    domains: ['sre', 'devops', 'finops'],
    requiredSkills: [
      { name: 'incident command', domain: 'sre', targetLevel: 5, evidence: ['timeline', 'RCA', 'customer update'] },
      { name: 'observability engineering', domain: 'sre', targetLevel: 4, evidence: ['SLI/SLO', 'dashboard', 'alert'] },
      { name: 'cloud cost operations', domain: 'finops', targetLevel: 3, evidence: ['cost anomaly report', 'rightsizing action'] },
    ],
    tools: ['ServiceDesk', 'ManagedServices', 'CostCenter'],
    handoffs: ['Database Reliability Engineer', 'Release Engineer'],
  },
  {
    role: 'QA and Evaluation Engineer',
    mission: 'Verify software, AI outputs, browser flows, accessibility, and release quality.',
    domains: ['qa', 'frontend', 'data-ai'],
    requiredSkills: [
      { name: 'browser automation', domain: 'qa', targetLevel: 4, evidence: ['Playwright run', 'screenshot', 'trace'] },
      { name: 'prompt and model regression testing', domain: 'data-ai', targetLevel: 4, evidence: ['eval score', 'golden dataset'] },
      { name: 'accessibility validation', domain: 'frontend', targetLevel: 3, evidence: ['keyboard path', 'contrast result'] },
    ],
    tools: ['EvaluationLab', 'BrowserQA', 'SecurityCenter'],
    handoffs: ['Release Engineer', 'Full Stack Engineer'],
  },
  {
    role: 'Data and AI Engineer',
    mission: 'Build retrieval, model routing, evaluation, and cost-aware AI capabilities.',
    domains: ['data-ai', 'backend', 'finops'],
    requiredSkills: [
      { name: 'RAG pipeline design', domain: 'data-ai', targetLevel: 5, evidence: ['chunking strategy', 'retrieval trace'] },
      { name: 'model routing and fallback', domain: 'data-ai', targetLevel: 4, evidence: ['provider policy', 'latency/cost result'] },
      { name: 'AI cost optimization', domain: 'finops', targetLevel: 4, evidence: ['token budget', 'model mix report'] },
    ],
    tools: ['ModelRouter', 'Memory', 'EvaluationLab', 'CostCenter'],
    handoffs: ['Security Engineer', 'Product Strategist'],
  },
  {
    role: 'Delivery Manager',
    mission: 'Coordinate squads, approvals, dependencies, staffing, costs, and customer status.',
    domains: ['product', 'customer-success', 'finops'],
    requiredSkills: [
      { name: 'IT delivery governance', domain: 'product', targetLevel: 4, evidence: ['delivery plan', 'risk review'] },
      { name: 'SLA and escalation management', domain: 'customer-success', targetLevel: 4, evidence: ['SLA dashboard', 'escalation record'] },
      { name: 'margin-aware staffing', domain: 'finops', targetLevel: 4, evidence: ['cost plan', 'utilization view'] },
    ],
    tools: ['ManagedServices', 'ServiceDesk', 'ExecutiveDashboard'],
    handoffs: ['All delivery roles', 'Customer Success Lead'],
  },
];

const seedSources: LearningSourceInput[] = [
  {
    title: 'SFIA AI and digital skills framework',
    url: 'https://sfia-online.org/en/tools-and-resources/ai-skills-framework',
    type: 'standard',
    trust: 'standard',
    domains: ['architecture', 'security', 'devops', 'data-ai'],
  },
  {
    title: 'GitHub Skills',
    url: 'https://github.com/skills',
    type: 'github',
    trust: 'vendor',
    domains: ['devops', 'backend', 'qa'],
  },
  {
    title: 'ITIL service management practices',
    url: 'https://www.axelos.com/certifications/itil-service-management',
    type: 'standard',
    trust: 'standard',
    domains: ['sre', 'customer-success', 'product'],
  },
];

export class SkillAcademyService {
  constructor() {
    seedSources.forEach((source) => {
      const normalized = normalizeSource(source);
      sources.set(normalized.id, normalized);
    });
  }

  listRoles() {
    return roleCatalog;
  }

  listSources() {
    return Array.from(sources.values()).sort((a, b) => a.title.localeCompare(b.title));
  }

  addSource(input: LearningSourceInput) {
    const source = normalizeSource(input);
    sources.set(source.id, source);
    return source;
  }

  listPlans() {
    return Array.from(plans.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  createPlan(input: TeamSkillPlanInput): TeamSkillPlan {
    const inlineSources = (input.sources ?? []).map(normalizeSource);
    inlineSources.forEach((source) => sources.set(source.id, source));
    const allSources = [...this.listSources(), ...inlineSources.filter((source) => !sources.has(source.id))];
    const deliveryMode = input.deliveryMode ?? inferDeliveryMode(input.objective);
    const selectedRoles = selectRoles(input.objective, deliveryMode);
    const targetTeamSize = Math.max(input.teamSize ?? selectedRoles.length, selectedRoles.length);
    const maturity = input.currentMaturity ?? 'growing';
    const gaps = buildLearningBacklog(selectedRoles, allSources, input.objective, maturity);
    const monthlyCostUsd = estimateMonthlyCost(selectedRoles.length, targetTeamSize, deliveryMode, input.budgetUsdPerMonth);

    const plan: TeamSkillPlan = {
      id: `skill_${nanoid(10)}`,
      tenantId: input.tenantId ?? 'tenant_default',
      objective: input.objective,
      deliveryMode,
      targetTeamSize,
      skillCoverageScore: Math.max(35, Math.min(92, 88 - gaps.filter((gap) => gap.priority === 'P0').length * 8 - gaps.filter((gap) => gap.priority === 'P1').length * 3)),
      monthlyCostUsd,
      projectedProductivityLiftPercent: Math.min(55, 18 + selectedRoles.length * 3 + allSources.filter((source) => source.type === 'github').length * 2),
      roles: selectedRoles,
      squads: buildSquads(selectedRoles, deliveryMode),
      learningBacklog: gaps,
      governance: buildGovernance(deliveryMode),
      costControls: buildCostControls(deliveryMode),
      sources: allSources,
      createdAt: new Date().toISOString(),
    };

    plans.set(plan.id, plan);
    return plan;
  }
}

function normalizeSource(input: LearningSourceInput): LearningSource {
  const type = input.type ?? inferSourceType(input.url);
  const domains = input.domains?.length ? input.domains : inferDomains(`${input.title ?? ''} ${input.url}`);
  const title = input.title?.trim() || titleFromUrl(input.url);
  return {
    id: stableSourceId(input.url),
    title,
    url: input.url,
    type,
    trust: input.trust ?? inferTrust(input.url, type),
    domains,
    topics: inferTopics(`${title} ${input.url}`),
    refreshCadenceDays: type === 'github' ? 14 : type === 'standard' ? 90 : 30,
    lastReviewedAt: new Date().toISOString(),
  };
}

function stableSourceId(url: string) {
  return `src_${Buffer.from(url.toLowerCase()).toString('base64url').slice(0, 16)}`;
}

function inferSourceType(url: string): LearningSource['type'] {
  if (/github\.com/i.test(url)) return 'github';
  if (/sfia|itil|nist|owasp|iso/i.test(url)) return 'standard';
  if (/docs|developer|learn/i.test(url)) return 'documentation';
  return 'course';
}

function inferTrust(url: string, type: LearningSource['type']): LearningSource['trust'] {
  if (type === 'standard') return 'standard';
  if (/github\.com\/skills|learn\.microsoft|docs\.github|docs\.aws|cloud\.google|learn\.microsoft/i.test(url)) return 'vendor';
  return type === 'internal-runbook' ? 'internal' : 'community';
}

function titleFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.split('/').filter(Boolean).slice(-2).join(' / ');
    return path ? `${parsed.hostname} / ${path}` : parsed.hostname;
  } catch {
    return url.slice(0, 80);
  }
}

function inferDomains(text: string): SkillDomain[] {
  const lower = text.toLowerCase();
  const domains = new Set<SkillDomain>();
  if (/product|prd|service|itil|customer|support/.test(lower)) domains.add('product');
  if (/architect|system|design|sld|adr/.test(lower)) domains.add('architecture');
  if (/react|ui|frontend|accessibility|css/.test(lower)) domains.add('frontend');
  if (/api|backend|node|fastify|python|java|go/.test(lower)) domains.add('backend');
  if (/database|postgres|sql|migration|data/.test(lower)) domains.add('database');
  if (/devops|ci|cd|github|actions|deploy|kubernetes|terraform/.test(lower)) domains.add('devops');
  if (/security|owasp|cve|secret|nist|zero trust/.test(lower)) domains.add('security');
  if (/sre|incident|observability|monitor|reliability|slo/.test(lower)) domains.add('sre');
  if (/qa|test|playwright|evaluation|quality/.test(lower)) domains.add('qa');
  if (/ai|llm|rag|model|prompt|embedding/.test(lower)) domains.add('data-ai');
  if (/cost|finops|budget|pricing/.test(lower)) domains.add('finops');
  if (/success|sla|account|training/.test(lower)) domains.add('customer-success');
  return domains.size ? Array.from(domains) : ['backend', 'devops'];
}

function inferTopics(text: string) {
  const candidates = [
    'system design',
    'secure SDLC',
    'incident management',
    'change enablement',
    'GitHub Actions',
    'database migration',
    'RAG',
    'model routing',
    'FinOps',
    'Playwright',
    'accessibility',
    'SLA',
    'CMDB',
  ];
  const lower = text.toLowerCase();
  return candidates.filter((topic) => lower.includes(topic.toLowerCase())).slice(0, 6);
}

function inferDeliveryMode(objective: string): TeamSkillPlan['deliveryMode'] {
  if (/managed|operate|sla|support|itil|service desk/i.test(objective)) return 'managed-service';
  if (/moderni[sz]e|legacy|migration|refactor/i.test(objective)) return 'modernize';
  if (/incident|run|cloud|deploy|observability|sre/i.test(objective)) return 'operate';
  return 'build';
}

function selectRoles(objective: string, mode: TeamSkillPlan['deliveryMode']) {
  const lower = objective.toLowerCase();
  const selected = new Set<string>(['Product Strategist', 'Solution Architect', 'Full Stack Engineer', 'Delivery Manager']);
  if (mode !== 'build' || /cloud|incident|operate|sla|production|sre/.test(lower)) selected.add('SRE and Cloud Operations Engineer');
  if (/database|postgres|sql|migration|data/.test(lower)) selected.add('Database Reliability Engineer');
  if (/security|compliance|soc|pci|hipaa|iso|audit/.test(lower)) selected.add('Security and Compliance Engineer');
  if (/ai|llm|rag|model|automation|agent/.test(lower)) selected.add('Data and AI Engineer');
  if (/quality|test|browser|accessibility|release|enterprise/.test(lower) || mode !== 'operate') selected.add('QA and Evaluation Engineer');
  return roleCatalog.filter((role) => selected.has(role.role));
}

function buildLearningBacklog(roles: RoleSkillProfile[], sourcePool: LearningSource[], objective: string, maturity: TeamSkillPlanInput['currentMaturity']) {
  const objectiveDomains = inferDomains(objective);
  const sourceByDomain = new Map<SkillDomain, LearningSource[]>();
  sourcePool.forEach((source) => source.domains.forEach((domain) => sourceByDomain.set(domain, [...(sourceByDomain.get(domain) ?? []), source])));
  const currentLevel = maturity === 'enterprise' ? 4 : maturity === 'growing' ? 3 : 2;

  return roles
    .flatMap((role) => role.requiredSkills.map((skill) => ({ role, skill })))
    .filter(({ skill }) => skill.targetLevel > currentLevel || objectiveDomains.includes(skill.domain))
    .slice(0, 12)
    .map(({ role, skill }, index) => {
      const matchedSources = (sourceByDomain.get(skill.domain) ?? sourcePool.slice(0, 2)).slice(0, 3);
      return {
        id: `learn_${index + 1}`,
        skill: skill.name,
        domain: skill.domain,
        priority: (skill.targetLevel >= 5 ? 'P0' : skill.targetLevel >= 4 ? 'P1' : 'P2') as 'P0' | 'P1' | 'P2',
        reason: `${role.role} needs ${skill.name} at level ${skill.targetLevel} to deliver ${role.mission.toLowerCase()}`,
        sources: matchedSources.map((source) => source.title),
        practiceTask: buildPracticeTask(skill.name, skill.domain),
        validationEvidence: skill.evidence,
      };
    });
}

function buildPracticeTask(skill: string, domain: SkillDomain) {
  const tasks: Partial<Record<SkillDomain, string>> = {
    product: `Write a PRD and acceptance matrix for ${skill}.`,
    architecture: `Create an ADR, architecture diagram, and API contract proving ${skill}.`,
    frontend: `Build an accessible UI workflow and verify it with browser smoke checks.`,
    backend: `Implement typed API routes, validation, tests, and structured errors.`,
    database: `Review a production migration with rollback, backup, and quality gates.`,
    devops: `Create a gated CI/CD workflow with test, scan, build, and rollback evidence.`,
    security: `Threat-model a workflow and block unsafe paths with policy evidence.`,
    sre: `Run an incident simulation with timeline, SLA, RCA, and customer updates.`,
    qa: `Create unit, integration, browser, accessibility, and regression evidence.`,
    'data-ai': `Build an eval-backed AI workflow with routing, fallback, and cost controls.`,
    finops: `Produce a cost showback and optimization recommendation.`,
    'customer-success': `Package customer status, training, adoption, and SLA reporting.`,
  };
  return tasks[domain] ?? `Complete a practical task proving ${skill}.`;
}

function buildSquads(roles: RoleSkillProfile[], mode: TeamSkillPlan['deliveryMode']): TeamSkillPlan['squads'] {
  const roleNames = roles.map((role) => role.role);
  const squads: TeamSkillPlan['squads'] = [
    {
      name: 'Discovery and Design Squad',
      mission: 'Turn business goals into plans, system design, costs, and acceptance gates.',
      roles: roleNames.filter((role) => ['Product Strategist', 'Solution Architect', 'Delivery Manager'].includes(role)),
      workflow: ['intake', 'scope', 'architecture', 'risk review', 'approval'],
      successMetrics: ['decision latency', 'scope stability', 'architecture approval rate'],
    },
    {
      name: 'Build and Verify Squad',
      mission: 'Ship production code, tests, database changes, security fixes, and release evidence.',
      roles: roleNames.filter((role) => !['Product Strategist', 'Delivery Manager'].includes(role)),
      workflow: ['implement', 'test', 'security gate', 'database gate', 'preview', 'release'],
      successMetrics: ['lead time', 'test pass rate', 'change failure rate'],
    },
  ];

  if (mode === 'managed-service' || mode === 'operate') {
    squads.push({
      name: 'Run and Improve Squad',
      mission: 'Operate SLAs, incidents, runbooks, cost controls, and continuous automation.',
      roles: roleNames.filter((role) => /SRE|Security|Database|Delivery|Data|QA/.test(role)),
      workflow: ['monitor', 'triage', 'resolve', 'RCA', 'automate', 'report'],
      successMetrics: ['MTTR', 'SLA attainment', 'automation deflection', 'monthly cost variance'],
    });
  }

  return squads;
}

function buildGovernance(mode: TeamSkillPlan['deliveryMode']) {
  return [
    { ceremony: 'Daily delivery standup', cadence: 'daily', outputs: ['blockers', 'handoffs', 'risk changes'] },
    { ceremony: 'Architecture and security review', cadence: mode === 'build' ? 'per milestone' : 'weekly', outputs: ['ADR updates', 'threat-model decisions', 'approval evidence'] },
    { ceremony: 'Learning calibration', cadence: 'weekly', outputs: ['skill gaps', 'practice evidence', 'new source review'] },
    { ceremony: 'Cost and productivity review', cadence: 'weekly', outputs: ['model spend', 'cloud spend', 'automation savings'] },
    { ceremony: 'Customer value review', cadence: 'monthly', outputs: ['SLA report', 'delivered value', 'next backlog'] },
  ];
}

function buildCostControls(mode: TeamSkillPlan['deliveryMode']) {
  return [
    { control: 'Route low-risk tasks to fast/low-cost models and reserve frontier models for architecture, security, and ambiguous coding.', owner: 'Data and AI Engineer', expectedImpact: 'Reduce model spend without lowering quality.' },
    { control: 'Use skill coverage score to decide where human review is required.', owner: 'Delivery Manager', expectedImpact: 'Avoid expensive review on well-governed repetitive work.' },
    { control: 'Convert recurring tickets into automation stories every week.', owner: mode === 'build' ? 'Product Strategist' : 'SRE and Cloud Operations Engineer', expectedImpact: 'Increase automation deflection and margin.' },
    { control: 'Attach evidence to every approval so repeated work can become a reusable runbook.', owner: 'Security and Compliance Engineer', expectedImpact: 'Lower audit and onboarding cost.' },
  ];
}

function estimateMonthlyCost(roleCount: number, targetTeamSize: number, mode: TeamSkillPlan['deliveryMode'], budget?: number) {
  const baseByMode = mode === 'managed-service' ? 5200 : mode === 'modernize' ? 6000 : mode === 'operate' ? 4800 : 5600;
  const estimated = Math.round((roleCount * baseByMode + Math.max(0, targetTeamSize - roleCount) * 2800) * 1.18);
  return budget ? Math.min(estimated, budget) : estimated;
}

export const skillAcademy = new SkillAcademyService();
