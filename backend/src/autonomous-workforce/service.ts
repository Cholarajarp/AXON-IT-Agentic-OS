import { nanoid } from 'nanoid';
import type {
  AgentArchetype,
  AutonomyLevel,
  OrgUnit,
  WorkforceControlPlane,
  WorkforceDesignInput,
  WorkforceFunction,
  WorkMode,
} from './types.js';

const controlPlanes = new Map<string, WorkforceControlPlane>();

const functionWeights: Record<WorkforceFunction, number> = {
  strategy: 0.03,
  product: 0.07,
  architecture: 0.06,
  engineering: 0.24,
  database: 0.07,
  security: 0.09,
  sre: 0.12,
  qa: 0.1,
  'data-ai': 0.09,
  finops: 0.04,
  'customer-success': 0.06,
  delivery: 0.03,
};

const functionLabels: Record<WorkforceFunction, string> = {
  strategy: 'Strategy and Portfolio',
  product: 'Product and Requirements',
  architecture: 'Architecture and Design',
  engineering: 'Software Engineering',
  database: 'Database Reliability',
  security: 'Security and Compliance',
  sre: 'SRE and Cloud Operations',
  qa: 'Quality and Evaluation',
  'data-ai': 'Data and AI Platform',
  finops: 'FinOps and Unit Economics',
  'customer-success': 'Customer Success',
  delivery: 'Delivery Management',
};

export class AutonomousWorkforceService {
  listControlPlanes() {
    return Array.from(controlPlanes.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  createControlPlane(input: WorkforceDesignInput): WorkforceControlPlane {
    const targetAgentCount = clamp(input.targetAgentCount ?? inferAgentCount(input.mission), 25, 200000);
    const workMode = input.workMode ?? inferWorkMode(input.mission);
    const autonomyLevel = inferAutonomy(input.riskTolerance ?? 'medium', input.regulated ?? false, targetAgentCount);
    const monthlyBudgetUsd = input.monthlyBudgetUsd ?? estimateBudget(targetAgentCount, autonomyLevel, input.regulated ?? false);
    const orgUnits = buildOrgUnits(targetAgentCount, workMode);
    const archetypes = buildArchetypes(orgUnits, autonomyLevel, workMode, input.regulated ?? false);
    const plane: WorkforceControlPlane = {
      id: `aw_${nanoid(10)}`,
      tenantId: input.tenantId ?? 'tenant_default',
      mission: input.mission,
      targetAgentCount,
      workMode,
      autonomyLevel,
      orgUnits,
      archetypes,
      operatingSystem: {
        planning: [
          'Translate mission into portfolio outcomes, service objectives, acceptance gates, and economic constraints.',
          'Decompose work into squads with explicit owners, dependencies, risk class, and evidence required.',
          'Use architecture, security, database, and cost review before high-impact execution.',
        ],
        execution: [
          'Route work to agent archetypes by function, skill readiness, tool permission, and current load.',
          'Require checkpoint, test, security, database, and rollback evidence before production changes.',
          'Escalate ambiguous, destructive, customer-impacting, or regulated decisions to the right review tier.',
        ],
        memory: [
          'Store decisions, runbooks, incidents, customer preferences, known errors, and reusable delivery patterns per tenant.',
          'Decay stale memory and revalidate high-risk knowledge with source evidence before reuse.',
          'Prevent cross-tenant leakage through scoped retrieval, sensitivity labels, and audit logs.',
        ],
        feedback: [
          'Convert failed tests, incidents, customer feedback, cost spikes, and review comments into learning backlog items.',
          'Promote repeated successful work into reusable runbooks and lower-cost model paths.',
          'Demote unsafe or low-confidence behaviors until evaluation evidence recovers.',
        ],
        governance: [
          'Measure every agent by quality, speed, cost, evidence completeness, customer impact, and policy adherence.',
          'Separate maker, reviewer, release, and compliance responsibilities for risky work.',
          'Maintain executive dashboards for value delivered, risk, spend, SLA, and automation savings.',
        ],
      },
      faultManagement: buildFaultManagement(input.regulated ?? false),
      growthSystem: buildGrowthSystem(workMode),
      decisionPsychology: {
        incentives: [
          'Reward evidence-backed outcomes, not raw activity volume.',
          'Prefer reversible small changes over large risky changes.',
          'Favor customer value, maintainability, security, and cost control together.',
        ],
        antiPatterns: [
          'Do not hide uncertainty behind confident language.',
          'Do not optimize for passing a single test while breaking product intent.',
          'Do not use expensive models for routine work when a validated cheaper path exists.',
          'Do not proceed on destructive or regulated work without approval and rollback evidence.',
        ],
        calibration: [
          'Use confidence scoring tied to tests, sources, retrieval quality, and previous outcomes.',
          'Ask for human review when confidence is low, blast radius is high, or customer trust is at stake.',
          'Run post-action critique to update memory, skills, and policies.',
        ],
        customerEmpathy: [
          'Acknowledge customer impact before explaining internal mechanics.',
          'Communicate next update time, owner, action, and proof.',
          'Convert emotional feedback into concrete service quality signals without simulating human feelings.',
        ],
      },
      economics: buildEconomics(targetAgentCount, monthlyBudgetUsd, autonomyLevel),
      launchSequence: buildLaunchSequence(workMode, input.regulated ?? false),
      createdAt: new Date().toISOString(),
    };

    controlPlanes.set(plane.id, plane);
    return plane;
  }

  getControlPlane(id: string) {
    return controlPlanes.get(id);
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function inferAgentCount(mission: string) {
  const match = mission.match(/(\d[\d,]*)\s*(agents|people|employees|workers)/i);
  if (match) return Number(match[1].replace(/,/g, ''));
  if (/global|enterprise|fortune|large scale/i.test(mission)) return 50000;
  if (/startup|mvp|small/i.test(mission)) return 250;
  return 5000;
}

function inferWorkMode(mission: string): WorkMode {
  if (/managed|service desk|sla|operate|support|itil/i.test(mission)) return 'managed-service';
  if (/moderni[sz]e|legacy|migration|transform/i.test(mission)) return 'transform';
  if (/incident|sre|cloud|production|run/i.test(mission)) return 'operate';
  return 'build';
}

function inferAutonomy(riskTolerance: 'low' | 'medium' | 'high', regulated: boolean, agentCount: number): AutonomyLevel {
  if (regulated || riskTolerance === 'low') return 'supervised';
  if (agentCount >= 100000) return 'executive-review';
  if (riskTolerance === 'high') return 'autonomous';
  return 'supervised';
}

function estimateBudget(agentCount: number, autonomy: AutonomyLevel, regulated: boolean) {
  const base = autonomy === 'autonomous' ? 18 : autonomy === 'executive-review' ? 26 : autonomy === 'supervised' ? 32 : 42;
  return Math.round(agentCount * base * (regulated ? 1.25 : 1));
}

function buildOrgUnits(agentCount: number, mode: WorkMode): OrgUnit[] {
  const modeBoost: Partial<Record<WorkforceFunction, number>> =
    mode === 'operate' || mode === 'managed-service'
      ? { sre: 1.35, security: 1.15, 'customer-success': 1.25, delivery: 1.2 }
      : mode === 'transform'
        ? { architecture: 1.25, engineering: 1.15, database: 1.15, 'data-ai': 1.15 }
        : { product: 1.15, engineering: 1.2, qa: 1.1 };

  const raw = Object.entries(functionWeights).map(([fn, weight]) => ({
    fn: fn as WorkforceFunction,
    weight: weight * (modeBoost[fn as WorkforceFunction] ?? 1),
  }));
  const totalWeight = raw.reduce((sum, item) => sum + item.weight, 0);

  return raw.map(({ fn, weight }) => {
    const headcount = Math.max(1, Math.round((agentCount * weight) / totalWeight));
    return {
      id: `unit_${fn}`,
      name: functionLabels[fn],
      function: fn,
      headcount,
      leadArchetype: `${functionLabels[fn]} Lead Agent`,
      responsibilities: responsibilitiesFor(fn),
      interfaces: interfacesFor(fn),
    };
  });
}

function buildArchetypes(units: OrgUnit[], autonomy: AutonomyLevel, mode: WorkMode, regulated: boolean): AgentArchetype[] {
  return units.map((unit) => ({
    id: `arch_${unit.function}`,
    name: `${unit.name} Agent`,
    function: unit.function,
    headcount: unit.headcount,
    autonomyLevel: regulated && ['security', 'database', 'sre', 'delivery'].includes(unit.function) ? 'supervised' : autonomy,
    mission: missionFor(unit.function, mode),
    decisionRights: decisionRightsFor(unit.function, autonomy),
    tools: toolsFor(unit.function),
    knowledge: knowledgeFor(unit.function),
    behaviorModel: {
      principles: [
        'Be evidence-first.',
        'Prefer reversible action.',
        'State uncertainty clearly.',
        'Protect customer trust.',
        'Optimize quality, speed, security, and cost together.',
      ],
      communicationStyle: communicationFor(unit.function),
      uncertaintyRule: 'If evidence is incomplete, ask for review or gather more proof before acting.',
      empathyPattern: 'Summarize user impact, own the next action, provide a clear update time, and attach verification proof.',
      conflictRule: 'When goals conflict, escalate by customer impact, security risk, data safety, and financial exposure.',
    },
    qualityGates: gatesFor(unit.function),
    escalationTriggers: escalationFor(unit.function),
    growthPlan: growthFor(unit.function),
  }));
}

function responsibilitiesFor(fn: WorkforceFunction) {
  const map: Record<WorkforceFunction, string[]> = {
    strategy: ['portfolio priorities', 'market signals', 'executive tradeoffs'],
    product: ['requirements', 'acceptance criteria', 'customer journeys'],
    architecture: ['system design', 'ADRs', 'technical standards'],
    engineering: ['implementation', 'refactoring', 'testable code'],
    database: ['schema safety', 'data quality', 'backup and restore'],
    security: ['threat modeling', 'policy gates', 'audit evidence'],
    sre: ['availability', 'incident response', 'observability'],
    qa: ['test strategy', 'browser QA', 'AI evals'],
    'data-ai': ['RAG', 'model routing', 'prompt and eval quality'],
    finops: ['unit economics', 'budget controls', 'cost optimization'],
    'customer-success': ['onboarding', 'support quality', 'customer updates'],
    delivery: ['dependency management', 'SLA tracking', 'governance cadence'],
  };
  return map[fn];
}

function interfacesFor(fn: WorkforceFunction) {
  const common = ['Service Desk', 'Evidence', 'Audit Trail'];
  const map: Partial<Record<WorkforceFunction, string[]>> = {
    engineering: ['Code Intelligence', 'Build Studio', 'QA'],
    database: ['Database Pipeline', 'Checkpoints', 'Security'],
    security: ['Security Center', 'Policies', 'Approvals'],
    sre: ['Managed Services', 'Incidents', 'Cost'],
    'data-ai': ['Models', 'Memory', 'Evaluation Lab'],
    finops: ['Cost', 'Executive', 'Managed Services'],
  };
  return [...common, ...(map[fn] ?? ['Managed Services'])];
}

function missionFor(fn: WorkforceFunction, mode: WorkMode) {
  return `Deliver ${functionLabels[fn].toLowerCase()} outcomes for ${mode} work with validated evidence, safe autonomy, and cost-aware execution.`;
}

function decisionRightsFor(fn: WorkforceFunction, autonomy: AutonomyLevel) {
  const base = ['recommend plan', 'create tasks', 'draft evidence', 'request review'];
  const specialized: Partial<Record<WorkforceFunction, string>> = {
    database: 'block unsafe stateful data changes',
    security: 'block policy and credential risks',
    sre: 'activate incident command',
    finops: 'enforce budget route',
    qa: 'block release on failed quality gates',
    'data-ai': 'select model route within policy',
  };
  if (autonomy === 'assist') return base;
  const supervised = [...base, 'execute low-risk approved actions', 'update runbooks', specialized[fn]].filter(Boolean) as string[];
  if (autonomy === 'supervised') return supervised;
  const autonomous = [...supervised, 'execute reversible low-risk changes', 'route work to peer agents', 'open rollback preview'];
  if (autonomy === 'autonomous') return autonomous;
  return [...autonomous, 'prepare executive decision memo for high-risk work'];
}

function toolsFor(fn: WorkforceFunction) {
  const map: Record<WorkforceFunction, string[]> = {
    strategy: ['ExecutiveDashboard', 'MarketSignals', 'PortfolioPlanner'],
    product: ['ProductFactory', 'BuildStudio', 'ServiceDesk'],
    architecture: ['ArchitectureCompiler', 'CodeIntelligence', 'SecurityCenter'],
    engineering: ['CodeIntelligence', 'TestRunner', 'Preview', 'Git'],
    database: ['DatabasePipeline', 'Checkpoints', 'Observability'],
    security: ['SecurityCenter', 'PolicyEngine', 'Evidence'],
    sre: ['ServiceDesk', 'ManagedServices', 'IncidentConsole'],
    qa: ['EvaluationLab', 'Playwright', 'AccessibilityScanner'],
    'data-ai': ['ModelRouter', 'Memory', 'RAGPipeline', 'EvaluationLab'],
    finops: ['CostCenter', 'ModelRouter', 'CloudCost'],
    'customer-success': ['ServiceDesk', 'KnowledgeBase', 'StatusReports'],
    delivery: ['ManagedServices', 'SkillAcademy', 'WorkflowDAG'],
  };
  return map[fn];
}

function knowledgeFor(fn: WorkforceFunction) {
  return [
    `${functionLabels[fn]} runbooks`,
    'customer context',
    'policy constraints',
    'recent incidents and feedback',
    'validated open-source and vendor learning sources',
  ];
}

function communicationFor(fn: WorkforceFunction) {
  if (fn === 'customer-success') return 'clear, calm, customer-facing, next-action oriented';
  if (fn === 'security' || fn === 'database') return 'precise, risk-focused, evidence-heavy';
  if (fn === 'strategy' || fn === 'delivery') return 'executive, concise, tradeoff-aware';
  return 'technical, direct, test-and-evidence oriented';
}

function gatesFor(fn: WorkforceFunction) {
  const common = ['source evidence', 'acceptance criteria', 'audit log'];
  const map: Partial<Record<WorkforceFunction, string[]>> = {
    engineering: ['typecheck', 'lint', 'tests', 'browser smoke'],
    database: ['backup checkpoint', 'rollback plan', 'quality gates', 'lock-risk review'],
    security: ['secret scan', 'dependency scan', 'policy decision', 'approval record'],
    sre: ['SLO check', 'rollback proof', 'incident timeline'],
    qa: ['unit/integration tests', 'Playwright evidence', 'accessibility notes'],
    'data-ai': ['eval score', 'retrieval trace', 'cost budget', 'fallback route'],
    finops: ['budget check', 'unit cost', 'spend anomaly review'],
  };
  return [...common, ...(map[fn] ?? ['peer review'])];
}

function escalationFor(fn: WorkforceFunction) {
  return [
    'low confidence',
    'customer-impacting risk',
    'destructive action',
    'policy block',
    fn === 'database' ? 'stateful data change' : 'cross-functional conflict',
    fn === 'security' ? 'credential or compliance exposure' : 'budget or SLA breach',
  ];
}

function growthFor(fn: WorkforceFunction) {
  return [
    `Review top failed ${functionLabels[fn].toLowerCase()} tasks weekly.`,
    'Add new learning sources from trusted GitHub repositories, docs, and standards.',
    'Turn repeated successful work into reusable runbooks.',
    'Run evals before increasing autonomy level.',
  ];
}

function buildFaultManagement(regulated: boolean): WorkforceControlPlane['faultManagement'] {
  return [
    {
      fault: 'hallucinated or unsupported decision',
      detector: 'missing source evidence, failed verifier, or contradiction with policy memory',
      response: 'pause execution, downgrade confidence, request source-backed regeneration',
      recoveryEvidence: ['source trace', 'review note', 'updated memory'],
    },
    {
      fault: 'unsafe tool or destructive action',
      detector: 'policy engine, database pipeline, checkpoint diff, or command risk classifier',
      response: 'block action, create approval task, require rollback preview',
      recoveryEvidence: ['policy decision', 'approval record', 'rollback preview'],
    },
    {
      fault: 'cost runaway',
      detector: 'model spend anomaly, repeated retries, or inefficient model route',
      response: 'switch to cheaper model path, cap budget, require reviewer for frontier-model use',
      recoveryEvidence: ['cost delta', 'route decision', 'budget approval'],
    },
    {
      fault: 'customer trust incident',
      detector: 'SLA breach, negative feedback, repeated support escalation, or production outage',
      response: regulated ? 'activate incident command, compliance owner, and executive review' : 'activate incident command and customer update loop',
      recoveryEvidence: ['timeline', 'customer update', 'RCA', 'preventive action'],
    },
  ];
}

function buildGrowthSystem(mode: WorkMode): WorkforceControlPlane['growthSystem'] {
  return [
    { signal: 'new open-source pattern or GitHub resource', action: 'ingest as learning source, map to skills, create practice task', owner: 'Skill Academy', metric: 'validated skills added' },
    { signal: 'recurring ticket or incident', action: 'convert to automation backlog and runbook', owner: mode === 'build' ? 'Delivery Management Agent' : 'SRE Agent', metric: 'automation deflection' },
    { signal: 'failed test or eval regression', action: 'reduce autonomy for affected archetype and create repair task', owner: 'QA and Evaluation Agent', metric: 'eval recovery rate' },
    { signal: 'budget or latency spike', action: 're-route models and tune context strategy', owner: 'FinOps Agent', metric: 'cost per successful task' },
    { signal: 'customer feedback', action: 'update product requirements, empathy templates, and service playbooks', owner: 'Customer Success Agent', metric: 'customer satisfaction trend' },
  ];
}

function buildEconomics(agentCount: number, budget: number, autonomy: AutonomyLevel): WorkforceControlPlane['economics'] {
  const costPerAgentUsd = Number((budget / agentCount).toFixed(2));
  const efficiency = autonomy === 'autonomous' ? 4.2 : autonomy === 'executive-review' ? 3.2 : autonomy === 'supervised' ? 2.6 : 1.7;
  return {
    monthlyBudgetUsd: budget,
    estimatedMonthlyRunUsd: Math.round(budget * 0.92),
    costPerAgentUsd,
    automationCapacityHours: Math.round(agentCount * efficiency),
    humanReviewReserveUsd: Math.round(budget * 0.12),
    savingsControls: [
      'model route by risk and task complexity',
      'cache repeated context and runbooks',
      'convert repeated tickets to deterministic automation',
      'reserve human review for high-risk work',
      'measure cost per accepted outcome, not cost per token',
    ],
  };
}

function buildLaunchSequence(mode: WorkMode, regulated: boolean): WorkforceControlPlane['launchSequence'] {
  return [
    { order: 1, milestone: 'Define mission and control boundaries', owner: 'Strategy Agent', exitCriteria: ['mission approved', 'risk tolerance set', 'budget set'] },
    { order: 2, milestone: 'Deploy role catalog and skill sources', owner: 'Skill Academy', exitCriteria: ['roles mapped', 'learning sources trusted', 'practice tasks created'] },
    { order: 3, milestone: 'Enable governed tool access', owner: 'Security Agent', exitCriteria: ['policy gates active', 'audit logging active', 'approval paths tested'] },
    { order: 4, milestone: 'Run pilot squads', owner: 'Delivery Agent', exitCriteria: ['first workflows complete', 'evidence accepted', 'cost measured'] },
    { order: 5, milestone: mode === 'managed-service' ? 'Activate service towers' : 'Scale product delivery', owner: 'Managed Services Agent', exitCriteria: ['SLA dashboards live', 'fault playbooks tested', 'feedback loop active'] },
    { order: 6, milestone: regulated ? 'Compliance launch review' : 'Autonomy level review', owner: 'Executive Insight Agent', exitCriteria: ['risk accepted', 'customer report ready', 'autonomy limits approved'] },
  ];
}

export const autonomousWorkforce = new AutonomousWorkforceService();
