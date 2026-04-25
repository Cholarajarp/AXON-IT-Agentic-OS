import { nanoid } from 'nanoid';
import { autonomousWorkforce } from '../autonomous-workforce/index.js';
import { managedServices } from '../managed-services/index.js';
import { productFactory } from '../product-factory/index.js';
import { serviceDesk } from '../service-desk/index.js';
import { skillAcademy } from '../skill-academy/index.js';
import type { CompanyMissionInput, CompanyMissionMode, CompanyOperatingMission } from './types.js';

const missions = new Map<string, CompanyOperatingMission>();

export class CompanyOsService {
  listMissions() {
    return Array.from(missions.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getMission(id: string) {
    return missions.get(id);
  }

  createMission(input: CompanyMissionInput): CompanyOperatingMission {
    const mode = input.mode ?? inferMode(input.mission);
    const companyName = input.companyName?.trim() || 'AXON IT Agentic OS';
    const targetAgentCount = clamp(input.targetAgentCount ?? 200000, 1000, 200000);
    const monthlyBudgetUsd = input.monthlyBudgetUsd ?? Math.max(250000, targetAgentCount * 25);
    const tenantId = input.tenantId ?? 'tenant_default';
    const regulated = input.regulated ?? /bank|finance|health|insurance|government|pci|hipaa|soc|iso/i.test(input.mission);
    const compliance = input.compliance?.length ? input.compliance : regulated ? ['SOC 2', 'ISO 27001'] : ['SOC 2'];
    const cloudProviders = input.cloudProviders?.length ? input.cloudProviders : ['AWS', 'Azure', 'GCP'];

    const controlPlane = autonomousWorkforce.createControlPlane({
      tenantId,
      mission: input.mission,
      targetAgentCount,
      monthlyBudgetUsd,
      workMode: mode === 'managed-it' ? 'managed-service' : mode === 'modernize' ? 'transform' : 'build',
      regulated,
      riskTolerance: regulated ? 'low' : 'medium',
      regions: input.regions,
      customerSegments: input.customerSegments,
    });

    const skillPlan = skillAcademy.createPlan({
      tenantId,
      objective: input.mission,
      deliveryMode: mode === 'managed-it' ? 'managed-service' : mode === 'modernize' ? 'modernize' : 'build',
      teamSize: Math.min(200, Math.max(12, Math.ceil(targetAgentCount / 2500))),
      budgetUsdPerMonth: monthlyBudgetUsd,
      currentMaturity: 'enterprise',
      sources: [
        { title: 'GitHub Skills', url: 'https://github.com/skills', type: 'github', domains: ['devops', 'security', 'backend', 'qa'] },
        { title: 'SFIA AI skills framework', url: 'https://sfia-online.org/en/tools-and-resources/ai-skills-framework', type: 'standard', domains: ['architecture', 'security', 'data-ai'] },
      ],
    });

    const managedService = managedServices.createAccount({
      tenantId,
      customerName: companyName,
      objective: input.mission,
      appCount: Math.min(500, Math.max(12, Math.ceil(targetAgentCount / 1000))),
      users: Math.max(10000, targetAgentCount),
      cloudProviders,
      compliance,
      coverage: '24x7',
    });

    const productBlueprint = productFactory.createBlueprint({
      tenantId,
      customerName: companyName,
      goal: input.mission,
      budgetUsd: Math.max(50000, Math.round(monthlyBudgetUsd * 0.12)),
      timelineDays: mode === 'autonomous-factory' ? 45 : 60,
      compliance,
      targetUsers: input.customerSegments?.length ? input.customerSegments : ['enterprise operators', 'founders', 'engineering teams', 'IT service teams'],
      integrations: ['GitHub', 'cloud providers', 'service desk', 'observability', 'model providers'],
    });

    const initialTickets = [
      serviceDesk.createTicket({
        tenantId,
        requester: 'Company OS',
        title: 'Launch autonomous IT command center',
        request: `Stand up ${companyName} command center for ${targetAgentCount.toLocaleString()} AI agents with policy, evidence, budget, and customer escalation controls.`,
        urgency: 'critical',
        affectedUsers: targetAgentCount,
        system: 'company-os',
        compliance,
      }),
      serviceDesk.createTicket({
        tenantId,
        requester: 'Company OS',
        title: 'Create first delivery value stream',
        request: `Convert mission into build, verify, deploy, operate, learn, and improve workflows with squads and acceptance evidence.`,
        urgency: 'high',
        affectedUsers: Math.ceil(targetAgentCount / 10),
        system: 'delivery-mesh',
        compliance,
      }),
    ];

    const mission: CompanyOperatingMission = {
      id: `co_${nanoid(10)}`,
      tenantId,
      companyName,
      mission: input.mission,
      mode,
      executiveSummary: buildSummary(companyName, targetAgentCount, mode),
      northStarMetric: 'Accepted customer outcomes per dollar with evidence-backed quality',
      operatingPrinciples: [
        'Agents act only through role, skill, tool, policy, and evidence contracts.',
        'Every product outcome must connect requirement, code, test, security, deployment, support, cost, and customer proof.',
        'Scale autonomy only after repeated success under evaluation, fault recovery, and customer trust metrics.',
        'Use AI for every task where it increases speed or quality, but keep high-risk decisions gated.',
      ],
      controlPlane,
      skillPlan,
      managedService,
      productBlueprint,
      initialTickets,
      portfolio: buildPortfolio(mode),
      serviceLines: buildServiceLines(controlPlane.targetAgentCount),
      commandSystem: buildCommandSystem(regulated),
      economics: buildEconomics(monthlyBudgetUsd, controlPlane.economics.estimatedMonthlyRunUsd, targetAgentCount),
      riskAndFaultModel: buildRiskModel(regulated),
      customerTrustSystem: buildCustomerTrustSystem(),
      createdAt: new Date().toISOString(),
    };

    missions.set(mission.id, mission);
    return mission;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function inferMode(mission: string): CompanyMissionMode {
  if (/managed|service|sla|support|operate/i.test(mission)) return 'managed-it';
  if (/moderni[sz]e|legacy|migration|transform/i.test(mission)) return 'modernize';
  if (/factory|autonomous|200,?000|massive|scale/i.test(mission)) return 'autonomous-factory';
  return 'build-and-run';
}

function buildSummary(companyName: string, agents: number, mode: CompanyMissionMode) {
  return `${companyName} is configured as a ${mode} operating company with ${agents.toLocaleString()} AI agents, 24x7 service delivery, governed autonomy, continuous learning, customer trust workflows, and cost-controlled execution.`;
}

function buildPortfolio(mode: CompanyMissionMode): CompanyOperatingMission['portfolio'] {
  return [
    {
      horizon: '0-30 days',
      theme: 'Control and proof foundation',
      outcomes: ['command center live', 'role catalog live', 'provider keys configured', 'security/database gates active'],
      owner: 'Delivery Management Agent',
      proof: ['control plane', 'skill plan', 'audit log', 'first service tickets'],
    },
    {
      horizon: '31-90 days',
      theme: mode === 'modernize' ? 'Modernization waves' : 'Product and service factory',
      outcomes: ['first product blueprints executed', 'browser QA evidence', 'managed service towers live', 'customer reports generated'],
      owner: 'Product and Engineering Agents',
      proof: ['blueprints', 'test logs', 'deployment package', 'SLA dashboard'],
    },
    {
      horizon: '91-180 days',
      theme: 'Autonomy scale-up',
      outcomes: ['repeated work automated', 'eval gates active', 'cost per outcome reduced', 'incident playbooks validated'],
      owner: 'Autonomous Workforce Agent',
      proof: ['eval trend', 'automation backlog', 'cost report', 'RCA library'],
    },
    {
      horizon: '181-365 days',
      theme: 'IT-company-grade expansion',
      outcomes: ['multi-region delivery', 'partner marketplace', 'compliance packs', 'self-improving skill academy'],
      owner: 'Strategy and Portfolio Agent',
      proof: ['regional scorecards', 'marketplace catalog', 'audit packs', 'learning source graph'],
    },
  ];
}

function buildServiceLines(agentCount: number): CompanyOperatingMission['serviceLines'] {
  const lines = [
    ['AI Product Factory', 0.22, 'fixed scope + usage', ['PRD', 'architecture', 'code', 'tests', 'preview', 'deployment'], ['acceptance traceability', 'browser smoke', 'security scan']],
    ['Managed Cloud and SRE', 0.18, 'monthly subscription', ['SLOs', 'alerts', 'incidents', 'RCA', 'capacity', 'DR'], ['MTTR', 'availability', 'rollback evidence']],
    ['Secure Engineering', 0.16, 'subscription + project', ['secure code', 'policy gates', 'secret scanning', 'audit evidence'], ['OWASP checks', 'dependency audit', 'approval trail']],
    ['Database Reliability', 0.12, 'risk-based service', ['safe migrations', 'backup proof', 'data quality', 'performance review'], ['rollback plan', 'restore proof', 'quality gates']],
    ['Data and AI Platform', 0.14, 'usage + platform fee', ['model routing', 'RAG', 'evals', 'memory', 'cost control'], ['eval pass rate', 'cost per task', 'retrieval trace']],
    ['Customer Success and Support', 0.1, 'SLA subscription', ['onboarding', 'tickets', 'training', 'status reports'], ['SLA attainment', 'CSAT', 'knowledge reuse']],
    ['FinOps and Executive Insights', 0.08, 'savings share', ['cost showback', 'forecasting', 'margin', 'optimization'], ['budget variance', 'savings realized', 'unit economics']],
  ] as const;

  return lines.map(([name, ratio, revenueModel, deliveryOutputs, qualityBar]) => ({
    name,
    mission: `Deliver ${name.toLowerCase()} as a repeatable AI-powered service line.`,
    agentCapacity: Math.max(1, Math.round(agentCount * ratio)),
    revenueModel,
    deliveryOutputs: [...deliveryOutputs],
    qualityBar: [...qualityBar],
  }));
}

function buildCommandSystem(regulated: boolean): CompanyOperatingMission['commandSystem'] {
  return [
    {
      level: 'Executive command',
      owns: 'portfolio, budget, risk appetite, customer commitments',
      decisions: ['launch gates', 'budget exceptions', 'regulated autonomy limits'],
      escalation: 'customer trust incident, legal/compliance exposure, strategic tradeoff',
    },
    {
      level: 'Service-line command',
      owns: 'service P&L, staffing, SLAs, quality scorecards',
      decisions: ['capacity allocation', 'service priority', 'automation investment'],
      escalation: 'SLA breach, margin risk, repeated quality failure',
    },
    {
      level: 'Squad command',
      owns: 'delivery flow, tasks, tests, evidence, handoffs',
      decisions: ['task routing', 'implementation plan', 'verification path'],
      escalation: 'blocked dependency, unsafe change, low confidence',
    },
    {
      level: 'Agent self-management',
      owns: 'tool execution within permissions, memory use, source-backed decisions',
      decisions: ['low-risk reversible action', 'draft response', 'test selection'],
      escalation: regulated ? 'anything destructive, regulated, customer-impacting, or unsupported by evidence' : 'high-risk or low-confidence action',
    },
  ];
}

function buildEconomics(monthlyBudgetUsd: number, estimatedRunUsd: number, agentCount: number): CompanyOperatingMission['economics'] {
  const revenueCapacityUsd = Math.round(estimatedRunUsd * 2.4);
  const grossMarginPercent = Math.round(((revenueCapacityUsd - estimatedRunUsd) / revenueCapacityUsd) * 100);
  return {
    monthlyBudgetUsd,
    estimatedRunUsd,
    revenueCapacityUsd,
    grossMarginPercent,
    costPerOutcomeUsd: Math.max(12, Math.round(estimatedRunUsd / Math.max(1000, agentCount / 12))),
    savingsLevers: [
      'route model by risk and complexity',
      'convert recurring tickets into deterministic automation',
      'reuse evidence-backed runbooks',
      'cache customer context safely',
      'reserve human review for high-risk work only',
    ],
  };
}

function buildRiskModel(regulated: boolean): CompanyOperatingMission['riskAndFaultModel'] {
  return [
    { risk: 'agent produces unsupported work', earlySignal: 'missing source/test/evidence trace', prevention: 'require evidence contracts before acceptance', recovery: 'downgrade autonomy and create skill repair task' },
    { risk: 'unsafe production action', earlySignal: 'destructive command, database risk, policy block', prevention: 'checkpoint, approval, sandbox, and rollback preview', recovery: 'restore checkpoint, incident RCA, policy update' },
    { risk: 'cost exceeds value', earlySignal: 'frontier model overuse or retry loops', prevention: 'cost budgets and model route policy', recovery: 'route to cheaper model, cache context, review prompt/task design' },
    { risk: 'customer trust failure', earlySignal: 'SLA breach, vague update, repeated issue', prevention: 'customer empathy and update cadence templates', recovery: 'incident command, executive update, customer-facing RCA' },
    { risk: 'compliance drift', earlySignal: 'missing approval, audit gap, access mismatch', prevention: regulated ? 'mandatory compliance gates and monthly evidence review' : 'policy reminders and sampled reviews', recovery: 'freeze risky workflow, collect evidence, remediate control' },
  ];
}

function buildCustomerTrustSystem(): CompanyOperatingMission['customerTrustSystem'] {
  return [
    { moment: 'request intake', behavior: 'confirm outcome, urgency, impacted users, and next update time', evidence: ['ticket', 'SLA', 'owner'] },
    { moment: 'planning', behavior: 'show scope, non-goals, risks, cost, and acceptance criteria', evidence: ['blueprint', 'traceability', 'approval'] },
    { moment: 'execution', behavior: 'provide progress with proof, not vague confidence', evidence: ['diff', 'test log', 'checkpoint'] },
    { moment: 'incident', behavior: 'acknowledge impact, assign incident command, update on cadence', evidence: ['timeline', 'RCA', 'remediation proof'] },
    { moment: 'delivery close', behavior: 'package what changed, how verified, risks remaining, and next recommendations', evidence: ['delivery report', 'audit trail', 'cost summary'] },
  ];
}

export const companyOs = new CompanyOsService();
