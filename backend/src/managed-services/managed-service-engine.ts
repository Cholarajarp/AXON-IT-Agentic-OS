import { nanoid } from 'nanoid';
import type {
  CmdbAssetSeed,
  ManagedServiceAccount,
  ManagedServiceCoverage,
  ManagedServiceCriticality,
  ManagedServiceInput,
  ManagedServiceTower,
  ManagedServiceTowerCategory,
} from './types.js';

const accounts = new Map<string, ManagedServiceAccount>();

const towerCatalog: Record<ManagedServiceTowerCategory, Omit<ManagedServiceTower, 'id' | 'coverage' | 'criticality' | 'sla'>> = {
  'cloud-ops': {
    name: 'Cloud Operations',
    category: 'cloud-ops',
    agents: ['SREAgent', 'CloudOpsAgent', 'FinOpsAgent', 'SecurityAgent'],
    services: ['provisioning', 'configuration lifecycle', 'monitoring', 'backup and restore', 'patching', 'disaster recovery'],
    runbooks: ['cloud health check', 'capacity event response', 'backup restore drill', 'DR failover rehearsal'],
    automations: ['tag drift repair', 'cost anomaly detection', 'self-healing restart', 'backup verification'],
    kpis: ['availability', 'MTTR', 'backup success rate', 'cloud spend variance'],
    evidence: ['monitoring snapshot', 'change record', 'backup proof', 'cost showback'],
  },
  'application-support': {
    name: 'Application Support and Maintenance',
    category: 'application-support',
    agents: ['EngineeringAgent', 'SREAgent', 'DocumentationAgent', 'QAAgent'],
    services: ['L2/L3 support', 'defect triage', 'minor enhancements', 'release readiness', 'knowledge articles'],
    runbooks: ['incident reproduction', 'release regression', 'hotfix validation', 'known-error update'],
    automations: ['duplicate ticket clustering', 'log summarization', 'test impact selection', 'release note drafting'],
    kpis: ['ticket aging', 'defect escape rate', 'change success rate', 'knowledge reuse'],
    evidence: ['test logs', 'root cause summary', 'release notes', 'customer update'],
  },
  'database-ops': {
    name: 'Database and Data Reliability',
    category: 'database-ops',
    agents: ['DatabaseArchitectAgent', 'MigrationSafetyAgent', 'DataQualityAgent', 'SREAgent'],
    services: ['schema governance', 'migration safety', 'performance review', 'backup policy', 'data quality gates'],
    runbooks: ['expand-contract migration', 'slow query response', 'point-in-time recovery', 'data reconciliation'],
    automations: ['unsafe SQL blocker', 'row-count checks', 'checksum validation', 'index recommendation'],
    kpis: ['migration success rate', 'query latency', 'restore time', 'data quality score'],
    evidence: ['database safety report', 'rollback plan', 'quality gate output', 'restore proof'],
  },
  'security-ops': {
    name: 'Security Operations and Compliance',
    category: 'security-ops',
    agents: ['SecurityAgent', 'ComplianceAgent', 'AuditAgent', 'PolicyAgent'],
    services: ['secret scanning', 'vulnerability triage', 'policy compliance', 'access review', 'audit evidence'],
    runbooks: ['credential exposure response', 'critical CVE handling', 'access certification', 'security exception review'],
    automations: ['secret redaction', 'dependency risk scoring', 'least-privilege recommendation', 'evidence packaging'],
    kpis: ['critical exposure age', 'policy pass rate', 'access review closure', 'audit evidence completeness'],
    evidence: ['security scan', 'approval record', 'access review', 'remediation proof'],
  },
  devops: {
    name: 'DevOps and Release Engineering',
    category: 'devops',
    agents: ['ReleaseAgent', 'QAAgent', 'SREAgent', 'ToolRuntimeAgent'],
    services: ['CI/CD operations', 'environment management', 'deployment gates', 'rollback readiness', 'tool execution'],
    runbooks: ['failed deployment response', 'environment drift repair', 'rollback execution', 'release freeze exception'],
    automations: ['pipeline policy checks', 'preview environment creation', 'rollback preview', 'release evidence capture'],
    kpis: ['deployment frequency', 'lead time', 'rollback rate', 'pipeline pass rate'],
    evidence: ['build logs', 'deployment record', 'smoke test', 'rollback checkpoint'],
  },
  'data-ai': {
    name: 'Data and AI Platform Operations',
    category: 'data-ai',
    agents: ['DataQualityAgent', 'ModelRouterAgent', 'EvaluationAgent', 'CostAgent'],
    services: ['model routing', 'RAG quality', 'evaluation regression', 'cost control', 'data pipeline monitoring'],
    runbooks: ['model degradation response', 'RAG freshness check', 'evaluation failure response', 'cost spike review'],
    automations: ['prompt regression tests', 'retrieval quality scoring', 'provider fallback', 'token budget enforcement'],
    kpis: ['answer quality', 'evaluation pass rate', 'cost per task', 'provider availability'],
    evidence: ['evaluation report', 'model route decision', 'retrieval trace', 'cost summary'],
  },
  'quality-engineering': {
    name: 'Quality Engineering',
    category: 'quality-engineering',
    agents: ['QAAgent', 'EvaluationAgent', 'SecurityAgent', 'AccessibilityAgent'],
    services: ['test strategy', 'E2E testing', 'accessibility checks', 'performance budgets', 'AI output validation'],
    runbooks: ['release test plan', 'flaky test triage', 'accessibility regression', 'load test review'],
    automations: ['test generation', 'visual smoke checks', 'quality gate summaries', 'prompt regression runs'],
    kpis: ['coverage', 'E2E pass rate', 'accessibility defects', 'performance budget pass rate'],
    evidence: ['test report', 'browser screenshot', 'accessibility notes', 'performance result'],
  },
  finops: {
    name: 'FinOps and Service Financial Management',
    category: 'finops',
    agents: ['FinOpsAgent', 'CostAgent', 'ExecutiveInsightAgent'],
    services: ['cost showback', 'budget alerts', 'resource rightsizing', 'model cost optimization', 'unit economics'],
    runbooks: ['monthly cost review', 'spend anomaly response', 'budget exception', 'capacity forecast'],
    automations: ['idle resource detection', 'model cost routing', 'budget guardrails', 'showback report generation'],
    kpis: ['monthly run cost', 'savings realized', 'budget variance', 'cost per workflow'],
    evidence: ['cost dashboard', 'optimization record', 'approval record', 'forecast'],
  },
};

export class ManagedServicesService {
  listCatalog() {
    return Object.values(towerCatalog);
  }

  listAccounts() {
    return Array.from(accounts.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  createAccount(input: ManagedServiceInput): ManagedServiceAccount {
    const appCount = clamp(input.appCount ?? inferAppCount(input.objective), 1, 500);
    const users = clamp(input.users ?? inferUsers(input.objective), 1, 100000);
    const coverage = input.coverage ?? inferCoverage(input.objective, appCount, users);
    const compliance = input.compliance ?? inferCompliance(input.objective);
    const categories = selectTowers(input.objective, compliance, input.cloudProviders ?? [], appCount);
    const criticality = inferCriticality(input.objective, users, compliance);
    const serviceTowers = categories.map((category) => buildTower(category, coverage, criticality));
    const account: ManagedServiceAccount = {
      id: `ms_${nanoid(10)}`,
      tenantId: input.tenantId ?? 'tenant_default',
      customerName: input.customerName?.trim() || 'Customer',
      industry: input.industry?.trim() || inferIndustry(input.objective),
      objective: input.objective,
      maturity: inferMaturity(input.objective, input.painPoints ?? []),
      coverage,
      serviceTowers,
      cmdbSeed: buildCmdbSeed(input, serviceTowers, criticality),
      deliveryPods: buildDeliveryPods(serviceTowers),
      transitionPlan: buildTransitionPlan(serviceTowers.length, criticality),
      aiOperatingModel: {
        llmRouting: ['Use provider routing by task criticality, data sensitivity, latency, and budget.', 'Prefer sovereign/local models for restricted customer data.', 'Fail over across configured OpenAI, Anthropic, Bedrock, Vertex, Ollama, or local providers.'],
        memory: ['Store customer preferences, runbook history, known errors, and architecture decisions as scoped long-term memory.', 'Separate tenant memories and require evidence links for operational decisions.'],
        guardrails: ['Block destructive tools without approval.', 'Run security and database gates before production action.', 'Redact secrets and PII in prompts, logs, and evidence.'],
        escalationPolicy: ['P1/P0 incidents page SRE, service owner, and executive sponsor.', 'Security and database work requires owner approval.', 'Low-confidence AI decisions become human review tasks.'],
      },
      governance: buildGovernance(compliance),
      financials: buildFinancials(appCount, users, serviceTowers.length, coverage, criticality),
      risks: buildRisks(input, serviceTowers.length, compliance),
      createdAt: new Date().toISOString(),
    };

    accounts.set(account.id, account);
    return account;
  }

  getAccount(id: string) {
    return accounts.get(id);
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function inferAppCount(objective: string) {
  const match = objective.match(/(\d+)\s*(apps|applications|services)/i);
  return match ? Number(match[1]) : 12;
}

function inferUsers(objective: string) {
  const match = objective.match(/(\d+)\s*(users|employees|customers)/i);
  return match ? Number(match[1]) : 1000;
}

function inferCoverage(objective: string, appCount: number, users: number): ManagedServiceCoverage {
  if (/24x7|always on|mission critical|global|production|banking|healthcare/i.test(objective) || appCount > 40 || users > 5000) return '24x7';
  if (/extended|16x5|multi-region|customer/i.test(objective)) return '16x5';
  return '8x5';
}

function inferCompliance(objective: string) {
  const found = ['SOC 2', 'ISO 27001', 'HIPAA', 'PCI DSS', 'GDPR'].filter((item) => objective.toLowerCase().includes(item.toLowerCase()));
  return found.length > 0 ? found : ['SOC 2'];
}

function inferIndustry(objective: string) {
  if (/bank|fintech|payment|insurance/i.test(objective)) return 'Financial services';
  if (/health|clinic|patient|hospital/i.test(objective)) return 'Healthcare';
  if (/retail|commerce|store|shop/i.test(objective)) return 'Retail';
  if (/manufactur|factory|supply/i.test(objective)) return 'Manufacturing';
  return 'Digital business';
}

function inferMaturity(objective: string, painPoints: string[]): ManagedServiceAccount['maturity'] {
  const text = `${objective} ${painPoints.join(' ')}`;
  if (/legacy|manual|handover|takeover|stabilize/i.test(text)) return 'transition';
  if (/outage|unstable|incident|sla breach/i.test(text)) return 'stabilize';
  if (/optimi[sz]e|cost|automation|finops/i.test(text)) return 'optimize';
  return 'transform';
}

function selectTowers(objective: string, compliance: string[], cloudProviders: string[], appCount: number): ManagedServiceTowerCategory[] {
  const text = `${objective} ${compliance.join(' ')} ${cloudProviders.join(' ')}`.toLowerCase();
  const selected = new Set<ManagedServiceTowerCategory>(['application-support', 'devops', 'security-ops']);
  if (/cloud|aws|azure|gcp|kubernetes|serverless|infra|provision/i.test(text) || cloudProviders.length > 0) selected.add('cloud-ops');
  if (/database|postgres|mysql|sql|data|migration|backup|restore/i.test(text)) selected.add('database-ops');
  if (/ai|llm|rag|model|analytics|data pipeline/i.test(text)) selected.add('data-ai');
  if (/test|quality|validation|accessibility|performance/i.test(text) || appCount > 10) selected.add('quality-engineering');
  if (/cost|budget|showback|chargeback|finops|spend/i.test(text) || appCount > 20) selected.add('finops');
  return Array.from(selected);
}

function inferCriticality(objective: string, users: number, compliance: string[]): ManagedServiceCriticality {
  if (/mission critical|banking|payment|health|production outage/i.test(objective) || users >= 10000 || compliance.includes('PCI DSS') || compliance.includes('HIPAA')) return 'mission-critical';
  if (/production|customer|revenue|regulated/i.test(objective) || users >= 1000) return 'high';
  if (users >= 100) return 'medium';
  return 'low';
}

function buildTower(category: ManagedServiceTowerCategory, coverage: ManagedServiceCoverage, criticality: ManagedServiceCriticality): ManagedServiceTower {
  const template = towerCatalog[category];
  return {
    id: `tower_${category}`,
    ...template,
    coverage,
    criticality,
    sla: buildSla(coverage, criticality),
  };
}

function buildSla(coverage: ManagedServiceCoverage, criticality: ManagedServiceCriticality): ManagedServiceTower['sla'] {
  const multiplier = coverage === '24x7' ? 1 : coverage === '16x5' ? 1.5 : 2;
  const criticalFactor = criticality === 'mission-critical' ? 0.75 : criticality === 'high' ? 1 : criticality === 'medium' ? 1.5 : 2;
  return {
    p1ResponseMinutes: Math.round(15 * multiplier * criticalFactor),
    p1ResolutionHours: Math.max(2, Math.round(4 * multiplier * criticalFactor)),
    p2ResponseMinutes: Math.round(30 * multiplier * criticalFactor),
    p2ResolutionHours: Math.max(4, Math.round(8 * multiplier * criticalFactor)),
  };
}

function buildCmdbSeed(input: ManagedServiceInput, towers: ManagedServiceTower[], criticality: ManagedServiceCriticality): CmdbAssetSeed[] {
  const providers = input.cloudProviders?.length ? input.cloudProviders : ['workspace cloud'];
  const envs = input.environments?.length ? input.environments : ['dev', 'staging', 'production'];
  const base: CmdbAssetSeed[] = [
    {
      id: 'ci_customer_portfolio',
      name: `${input.customerName ?? 'Customer'} application portfolio`,
      type: 'application',
      ownerAgent: 'ServiceCatalogAgent',
      criticality,
      dependencies: providers,
      monitors: ['availability', 'error rate', 'latency', 'ticket trend'],
      backupPolicy: 'Covered by tower-specific backup and rollback checkpoints',
    },
  ];

  providers.forEach((provider, index) => base.push({
    id: `ci_cloud_${index + 1}`,
    name: provider,
    type: 'cloud-account',
    ownerAgent: 'CloudOpsAgent',
    criticality,
    dependencies: envs,
    monitors: ['cost anomaly', 'policy drift', 'capacity', 'backup status'],
    backupPolicy: 'Infrastructure-as-code state and cloud backup policy review every sprint',
  }));

  if (towers.some((tower) => tower.category === 'database-ops')) {
    base.push({
      id: 'ci_primary_database',
      name: 'Primary operational database',
      type: 'database',
      ownerAgent: 'DatabaseArchitectAgent',
      criticality,
      dependencies: ['application portfolio', 'backup storage', 'migration pipeline'],
      monitors: ['replication lag', 'slow queries', 'lock waits', 'backup success'],
      backupPolicy: 'Point-in-time recovery, pre-migration checkpoint, restore drill evidence',
    });
  }

  if (towers.some((tower) => tower.category === 'data-ai')) {
    base.push({
      id: 'ci_model_gateway',
      name: 'AI model gateway',
      type: 'model-endpoint',
      ownerAgent: 'ModelRouterAgent',
      criticality: criticality === 'low' ? 'medium' : criticality,
      dependencies: ['provider keys', 'evaluation suite', 'tenant memory'],
      monitors: ['provider health', 'latency', 'cost', 'quality regression'],
      backupPolicy: 'Provider fallback and local model contingency',
    });
  }

  return base;
}

function buildDeliveryPods(towers: ManagedServiceTower[]) {
  return [
    {
      name: 'Service Delivery Office',
      mission: 'Own SLA, governance, customer communication, prioritization, and evidence completeness.',
      agents: ['PMOAgent', 'ServiceCatalogAgent', 'ExecutiveInsightAgent'],
      ceremonies: ['daily service review', 'weekly SLA review', 'monthly business review'],
    },
    {
      name: 'Engineering and Reliability Pod',
      mission: 'Resolve incidents, deliver changes, maintain runbooks, and automate repeated work.',
      agents: Array.from(new Set(towers.flatMap((tower) => tower.agents))).slice(0, 10),
      ceremonies: ['incident review', 'change advisory', 'automation backlog grooming'],
    },
  ];
}

function buildTransitionPlan(towerCount: number, criticality: ManagedServiceCriticality) {
  const critical = criticality === 'mission-critical' || criticality === 'high';
  return [
    {
      phase: 'Discover and assess',
      durationDays: critical ? 10 : 5,
      outcomes: ['application inventory', 'dependency map', 'risk register', 'SLA baseline'],
      exitCriteria: ['CMDB seed approved', 'critical services tagged', 'access model verified'],
    },
    {
      phase: 'Takeover and stabilize',
      durationDays: critical ? 20 : 12,
      outcomes: ['runbooks onboarded', 'monitoring enabled', 'ticket routing live', 'backup proof captured'],
      exitCriteria: ['P1/P2 runbooks tested', 'support rota active', 'rollback checkpoints verified'],
    },
    {
      phase: 'Automate and optimize',
      durationDays: Math.max(15, towerCount * 4),
      outcomes: ['automation backlog', 'self-healing candidates', 'cost showback', 'quality gates'],
      exitCriteria: ['top recurring tickets automated', 'cost anomalies visible', 'governance dashboards live'],
    },
    {
      phase: 'Transform continuously',
      durationDays: 30,
      outcomes: ['modernization roadmap', 'AI assistant workflows', 'service maturity score', 'quarterly value report'],
      exitCriteria: ['business value accepted', 'new improvement epics funded', 'SLA improvement demonstrated'],
    },
  ];
}

function buildGovernance(compliance: string[]) {
  return [
    { forum: 'Daily operations review', cadence: 'daily', decisions: ['P0/P1 health', 'blocked tickets', 'change freeze exceptions'] },
    { forum: 'Change advisory board', cadence: 'twice weekly', decisions: ['production changes', 'database migrations', 'security exceptions'] },
    { forum: 'Monthly business review', cadence: 'monthly', decisions: ['SLA credits', 'cost showback', 'automation ROI', 'roadmap priorities'] },
    { forum: 'Compliance evidence review', cadence: compliance.length ? 'monthly' : 'quarterly', decisions: ['audit readiness', 'access recertification', 'control gaps'] },
  ];
}

function buildFinancials(appCount: number, users: number, towerCount: number, coverage: ManagedServiceCoverage, criticality: ManagedServiceCriticality) {
  const coverageFactor = coverage === '24x7' ? 1.8 : coverage === '16x5' ? 1.35 : 1;
  const criticalFactor = criticality === 'mission-critical' ? 1.6 : criticality === 'high' ? 1.25 : criticality === 'medium' ? 1 : 0.8;
  const monthly = Math.round((towerCount * 4500 + appCount * 250 + users * 1.2) * coverageFactor * criticalFactor);
  return {
    transitionCostUsd: Math.round(monthly * 1.7),
    monthlyRunCostUsd: monthly,
    projectedAutomationSavingsPercent: clamp(18 + towerCount * 3, 20, 45),
    confidence: 0.78,
  };
}

function buildRisks(input: ManagedServiceInput, towerCount: number, compliance: string[]) {
  const risks: ManagedServiceAccount['risks'] = [
    {
      level: 'high',
      description: 'Unknown dependencies can break SLA commitments during takeover.',
      mitigation: 'Require CMDB discovery, dependency mapping, and checkpoint-backed runbooks before steady state.',
    },
    {
      level: 'medium',
      description: 'Manual operating habits can slow automation adoption.',
      mitigation: 'Create an automation backlog from recurring tickets and track monthly deflection.',
    },
  ];

  if (compliance.length > 0) {
    risks.push({
      level: 'high',
      description: `Compliance scope (${compliance.join(', ')}) requires durable evidence and least-privilege controls.`,
      mitigation: 'Bind every change, incident, and access action to audit evidence and approval records.',
    });
  }

  if ((input.appCount ?? 0) > 50 || towerCount > 6) {
    risks.push({
      level: 'critical',
      description: 'Large portfolio scope can overload transition if everything moves at once.',
      mitigation: 'Wave the transition by service criticality and stabilize mission-critical systems first.',
    });
  }

  return risks;
}

export const managedServices = new ManagedServicesService();
