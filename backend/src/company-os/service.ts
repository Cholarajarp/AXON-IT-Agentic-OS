import { nanoid } from 'nanoid';
import { autonomousWorkforce } from '../autonomous-workforce/index.js';
import { managedServices } from '../managed-services/index.js';
import { missionControl } from '../mission-control/index.js';
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
        title: 'Launch autonomous IT service software command center',
        request: `Stand up ${companyName} command center for building and operating enterprise IT service software with ${targetAgentCount.toLocaleString()} AI agents, policy, evidence, budget, and customer escalation controls.`,
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
      axonIntegration: buildAxonIntegration(productBlueprint.id, controlPlane.id, skillPlan.id, managedService.id, initialTickets.map((ticket) => ticket.id)),
      enterpriseScore: buildEnterpriseScore(regulated, cloudProviders.length, compliance.length),
      knowledgeFabric: buildKnowledgeFabric(regulated, compliance),
      integrationFabric: buildIntegrationFabric(cloudProviders, compliance),
      valueStreams: buildValueStreams(mode),
      governanceControls: buildGovernanceControls(regulated, compliance),
      decisionRights: buildDecisionRights(regulated),
      operatingCadence: buildOperatingCadence(regulated),
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

  async activateMission(id: string): Promise<CompanyOperatingMission | undefined> {
    const mission = missions.get(id);
    if (!mission) return undefined;

    const run = await missionControl.createRun({
      blueprintId: mission.productBlueprint.id,
      tenantId: mission.tenantId,
      customerName: mission.companyName,
      mission: buildMissionControlActivationPrompt(mission),
      environment: 'staging',
      regulated: mission.decisionRights.some((item) => item.autonomy === 'human-approval'),
      budgetUsd: mission.economics.monthlyBudgetUsd,
      timelineDays: 60,
      compliance: mission.governanceControls.map((control) => control.framework),
      integrations: mission.integrationFabric.map((integration) => integration.system),
      htmlSnapshot: buildCompanyOsHtmlSnapshot(mission),
    });

    const updated: CompanyOperatingMission = {
      ...mission,
      axonIntegration: {
        ...mission.axonIntegration,
        status: run.status === 'blocked' ? 'blocked' : 'activated',
        missionControlRunId: run.id,
        agenticMeshBlueprintId: run.agenticMeshBlueprintId,
        releaseMissionId: run.releaseMissionId,
        browserQaReportId: run.browserQaReportId,
        blackboardId: run.blackboardId,
        trustRecordIds: run.trustRecordIds,
        score: run.score,
        activatedAt: new Date().toISOString(),
      },
      enterpriseScore: {
        ...mission.enterpriseScore,
        overall: run.status === 'blocked' ? Math.min(mission.enterpriseScore.overall, run.score) : Math.max(mission.enterpriseScore.overall, run.score),
        gaps: run.status === 'blocked'
          ? [...mission.enterpriseScore.gaps, 'Mission Control release gate has an active blocker']
          : mission.enterpriseScore.gaps.filter((gap) => gap !== 'Mission Control activation pending'),
      },
    };

    missions.set(id, updated);
    return updated;
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
  return `${companyName} is configured as a ${mode} enterprise IT service software operating model with ${agents.toLocaleString()} AI agents, 24x7 delivery, governed autonomy, continuous learning, customer trust workflows, and cost-controlled execution.`;
}

function buildAxonIntegration(
  productBlueprintId: string,
  workforceControlPlaneId: string,
  skillPlanId: string,
  managedServiceAccountId: string,
  serviceDeskTicketIds: string[]
): CompanyOperatingMission['axonIntegration'] {
  return {
    status: 'planned',
    connectedSurfaces: [
      'Build Studio',
      'Mission Control',
      'Agentic Mesh',
      'Autonomous Workforce',
      'Managed Services',
      'Service Desk',
      'Skill Academy',
      'Release Command',
      'Trust Ledger',
      'Preview QA',
      'Security Center',
    ],
    productBlueprintId,
    workforceControlPlaneId,
    skillPlanId,
    managedServiceAccountId,
    serviceDeskTicketIds,
    trustRecordIds: [],
  };
}

function buildEnterpriseScore(regulated: boolean, cloudProviderCount: number, complianceCount: number): CompanyOperatingMission['enterpriseScore'] {
  const operatingModel = 92;
  const integration = Math.min(96, 72 + cloudProviderCount * 4 + complianceCount * 3);
  const governance = regulated ? 94 : 82;
  const knowledge = 88;
  const automation = 91;
  const customerTrust = 90;
  const overall = Math.round((operatingModel + integration + governance + knowledge + automation + customerTrust) / 6);
  return {
    overall,
    operatingModel,
    integration,
    governance,
    knowledge,
    automation,
    customerTrust,
    gaps: ['Mission Control activation pending', 'Live identity connector health not yet verified', 'Production observability ingest not yet attached'],
  };
}

function buildKnowledgeFabric(regulated: boolean, compliance: string[]): CompanyOperatingMission['knowledgeFabric'] {
  return {
    permissionModel: 'source-system ACLs are preserved before retrieval, generation, action, and citation',
    citationPolicy: 'every answer and decision must cite the source item, owner, freshness, and permission boundary',
    freshnessSla: regulated ? 'regulated systems use federated real-time retrieval or 15-minute indexed sync' : 'business systems sync every 60 minutes with real-time fetch for incidents',
    retrievalModes: ['semantic search', 'keyword fallback', 'structured filters', 'federated MCP fetch', 'event-stream context'],
    sources: [
      { system: 'Microsoft 365 / Google Workspace', data: 'documents, meetings, mail, calendar, policies', syncMode: regulated ? 'federated-realtime' : 'synced-index', owner: 'Knowledge Operations', accessControl: 'tenant, group, document ACL' },
      { system: 'Jira / Linear / Azure DevOps', data: 'work items, releases, risks, dependencies', syncMode: 'synced-index', owner: 'Delivery Operations', accessControl: 'project permissions' },
      { system: 'ServiceNow / Zendesk / Service Desk', data: 'requests, incidents, changes, assets, SLAs', syncMode: 'event-stream', owner: 'Service Operations', accessControl: 'requester, assignment group, service owner' },
      { system: 'GitHub / GitLab', data: 'repositories, pull requests, checks, code owners, security alerts', syncMode: 'federated-realtime', owner: 'Engineering Platform', accessControl: 'repo permissions and CODEOWNERS' },
      { system: 'Datadog / Grafana / CloudWatch', data: 'metrics, logs, traces, SLOs, incidents', syncMode: 'event-stream', owner: 'SRE', accessControl: 'service ownership and incident role' },
      { system: 'GRC evidence vault', data: `${compliance.join(', ') || 'SOC 2'} controls, approvals, audit artifacts`, syncMode: 'synced-index', owner: 'Security and Compliance', accessControl: 'control owner and auditor role' },
    ],
  };
}

function buildIntegrationFabric(cloudProviders: string[], compliance: string[]): CompanyOperatingMission['integrationFabric'] {
  return [
    { system: 'Okta / Entra ID', domain: 'identity', connectorType: 'identity', dataPolicy: 'SCIM, SAML/OIDC, least-privilege groups, access reviews', actionsEnabled: ['provision user', 'request access', 'revoke entitlement', 'start access review'], evidence: ['identity event', 'approval record', 'entitlement diff'] },
    { system: 'Microsoft 365 / Google Workspace', domain: 'knowledge', connectorType: 'federated', dataPolicy: 'permission-trimmed retrieval with citations and no cross-tenant indexing by default', actionsEnabled: ['search policy', 'draft update', 'summarize meeting', 'create task'], evidence: ['source citation', 'ACL proof', 'freshness timestamp'] },
    { system: 'Jira / Linear / Azure DevOps', domain: 'work', connectorType: 'workflow', dataPolicy: 'project-scoped write actions with reviewer approval for priority and scope changes', actionsEnabled: ['create issue', 'update status', 'link evidence', 'generate release notes'], evidence: ['work item', 'status transition', 'reviewer'] },
    { system: 'GitHub / GitLab', domain: 'engineering', connectorType: 'mcp', dataPolicy: 'branch-protected edits, CODEOWNERS review, signed release evidence', actionsEnabled: ['open PR', 'read checks', 'request review', 'attach test logs'], evidence: ['commit sha', 'check run', 'PR review'] },
    { system: 'ServiceNow / Zendesk', domain: 'service', connectorType: 'event', dataPolicy: 'ITIL-aligned ticket, incident, problem, and change state machines', actionsEnabled: ['triage request', 'create incident', 'propose change', 'publish customer update'], evidence: ['ticket timeline', 'SLA clock', 'change approval'] },
    { system: 'Datadog / Grafana / PagerDuty', domain: 'observability', connectorType: 'event', dataPolicy: 'service-owner scoped telemetry with incident write approvals', actionsEnabled: ['detect SLO breach', 'open incident', 'run playbook', 'attach RCA'], evidence: ['metric window', 'trace link', 'incident timeline'] },
    { system: cloudProviders.join(' / ') || 'AWS / Azure / GCP', domain: 'security', connectorType: 'workflow', dataPolicy: 'cloud account scoped by environment, region, and change class', actionsEnabled: ['inspect resource', 'plan deployment', 'verify backup', 'prepare rollback'], evidence: ['cloud account', 'region', 'change ticket'] },
    { system: 'Billing / CRM / Customer portal', domain: 'customer', connectorType: 'synced', dataPolicy: 'customer context visible only to account and delivery roles', actionsEnabled: ['prepare QBR', 'update delivery report', 'forecast renewal risk'], evidence: ['account plan', 'delivery report', 'customer approval'] },
    { system: 'GRC platform', domain: 'finance', connectorType: 'synced', dataPolicy: `${compliance.join(', ') || 'SOC 2'} control mapping with immutable evidence`, actionsEnabled: ['map control', 'collect audit artifact', 'open remediation'], evidence: ['control id', 'owner attestation', 'audit artifact'] },
  ];
}

function buildValueStreams(mode: CompanyMissionMode): CompanyOperatingMission['valueStreams'] {
  return [
    {
      name: 'Idea to production software',
      objective: 'Turn business intent into shipped, secure, observable software with evidence.',
      intakeChannels: ['Build Studio', 'customer portal', 'Slack/Teams', 'service desk'],
      systemsOfRecord: ['Product Factory', 'GitHub', 'Mission Control', 'Release Command'],
      automationLoop: ['observe', 'triage', 'plan', 'act', 'verify', 'learn'],
      humanGates: ['scope approval', 'security exception', 'production deployment'],
      kpis: ['lead time', 'deployment success rate', 'escaped defects', 'cost per accepted outcome'],
      axonSurfaces: ['Build Studio', 'Mission Control', 'Preview QA', 'Trust Ledger'],
    },
    {
      name: 'Employee request to resolved service',
      objective: 'Resolve employee and customer requests through AI front door, governed workflow, and clean handoff.',
      intakeChannels: ['portal', 'Slack/Teams', 'email', 'voice'],
      systemsOfRecord: ['Service Desk', 'Managed Services', 'Knowledge Fabric'],
      automationLoop: ['observe', 'triage', 'act', 'verify', 'learn'],
      humanGates: ['policy exception', 'privileged access', 'customer-impacting incident'],
      kpis: ['first-contact resolution', 'MTTR', 'SLA attainment', 'deflection quality'],
      axonSurfaces: ['Service Desk', 'Managed Services', 'Customer Delivery'],
    },
    {
      name: mode === 'modernize' ? 'Legacy estate to modern platform' : 'Signal to autonomous improvement',
      objective: mode === 'modernize'
        ? 'Modernize legacy systems safely with dependency maps, migration waves, rollback, and service continuity.'
        : 'Convert telemetry, tickets, and customer feedback into repeatable automations and product improvements.',
      intakeChannels: ['observability', 'incident review', 'customer feedback', 'portfolio review'],
      systemsOfRecord: ['Delivery Brain', 'Database Pipeline', 'Agentic Mesh', 'Autonomous Workforce'],
      automationLoop: ['observe', 'plan', 'act', 'verify', 'learn'],
      humanGates: ['data migration', 'architecture exception', 'budget exception'],
      kpis: ['automation reuse', 'risk reduction', 'unit cost reduction', 'customer trust score'],
      axonSurfaces: ['Delivery Brain', 'Database Pipeline', 'Autonomous Workforce', 'Agentic FinOps'],
    },
  ];
}

function buildGovernanceControls(regulated: boolean, compliance: string[]): CompanyOperatingMission['governanceControls'] {
  const frameworks = compliance.length ? compliance : ['SOC 2'];
  return [
    { control: 'Permission-trimmed retrieval and action', framework: 'Zero Trust / least privilege', enforcement: 'source ACL check before every retrieval and connector action', owner: 'Identity Platform', evidence: ['principal', 'resource ACL', 'decision log'], blocksWhen: 'caller lacks source-system access or action scope' },
    { control: 'Human approval for high-risk actions', framework: regulated ? frameworks.join(' + ') : 'internal risk policy', enforcement: 'approval gate before destructive, regulated, financial, or customer-impacting changes', owner: 'Risk and Compliance', evidence: ['approval id', 'risk score', 'rollback plan'], blocksWhen: 'approval is missing, expired, or mismatched to change scope' },
    { control: 'AI output grounding and citation', framework: 'NIST AI RMF', enforcement: 'answers, plans, and customer updates require source citation and freshness metadata', owner: 'AI Governance', evidence: ['retrieval trace', 'citation list', 'confidence score'], blocksWhen: 'unsupported answer is used for a decision or customer commitment' },
    { control: 'Release evidence chain', framework: 'SOC 2 change management', enforcement: 'release requires blueprint, tests, security scan, preview QA, rollback, customer report, and ledger record', owner: 'Release Command', evidence: ['release gate', 'trust record', 'test log'], blocksWhen: 'any required evidence is absent or blocked' },
    { control: 'Model and tool cost control', framework: 'FinOps', enforcement: 'budget-aware routing, retry limits, cache policy, and escalation for spend anomalies', owner: 'Model FinOps', evidence: ['route decision', 'cost ledger', 'budget variance'], blocksWhen: 'task exceeds budget or uses restricted provider' },
  ];
}

function buildDecisionRights(regulated: boolean): CompanyOperatingMission['decisionRights'] {
  return [
    { decision: 'Answer knowledge question', owner: 'Knowledge Agent', autonomy: 'autonomous', policy: 'allowed when answer is permission-trimmed and cited', escalation: 'missing source or low confidence', evidence: ['citations', 'retrieval trace'] },
    { decision: 'Create or update work item', owner: 'Delivery Agent', autonomy: 'supervised', policy: 'allowed inside project scope with audit trail', escalation: 'priority, budget, or scope change', evidence: ['work item diff', 'owner'] },
    { decision: 'Open pull request', owner: 'Engineering Agent', autonomy: 'supervised', policy: 'allowed on feature branch with tests and CODEOWNERS routing', escalation: 'security-sensitive file or failing check', evidence: ['branch', 'diff', 'checks'] },
    { decision: 'Run production change', owner: 'Release Manager', autonomy: 'human-approval', policy: 'requires release score, rollback, customer impact, and approver', escalation: 'any release gate block', evidence: ['release command', 'approval', 'rollback'] },
    { decision: 'Grant privileged access', owner: 'Identity Governance', autonomy: 'human-approval', policy: regulated ? 'time-bound access with manager and control-owner approval' : 'time-bound approval with owner review', escalation: 'privileged, regulated, or break-glass request', evidence: ['request', 'approval', 'expiration'] },
  ];
}

function buildOperatingCadence(regulated: boolean): CompanyOperatingMission['operatingCadence'] {
  return [
    { cadence: 'real-time', ritual: 'incident and release command', owners: ['SRE Agent', 'Release Agent', 'Security Agent'], inputs: ['telemetry', 'release gates', 'customer impact'], outputs: ['incident decision', 'rollback/continue', 'customer update'] },
    { cadence: 'daily', ritual: 'value-stream health review', owners: ['Service-line Command', 'Delivery Agent'], inputs: ['SLA', 'blocked work', 'cost anomalies', 'quality failures'], outputs: ['routing changes', 'risk escalations', 'automation candidates'] },
    { cadence: 'weekly', ritual: 'portfolio and product operating review', owners: ['Executive Command', 'Product Agent'], inputs: ['outcomes shipped', 'customer feedback', 'margin', 'delivery risks'], outputs: ['priority decisions', 'capacity allocation', 'new Build Studio briefs'] },
    { cadence: 'monthly', ritual: regulated ? 'control evidence and access review' : 'governance sampling review', owners: ['Compliance Owner', 'Identity Platform'], inputs: ['trust ledger', 'access changes', 'policy exceptions'], outputs: ['control attestations', 'remediation backlog', 'policy updates'] },
    { cadence: 'quarterly', ritual: 'Company OS strategy and market review', owners: ['Executive Command', 'Customer Success'], inputs: ['competitive gaps', 'unit economics', 'service-line performance'], outputs: ['roadmap', 'pricing shifts', 'service expansion'] },
  ];
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
      theme: 'Enterprise IT service software expansion',
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

function buildMissionControlActivationPrompt(mission: CompanyOperatingMission) {
  return [
    `Activate Company OS for ${mission.companyName}.`,
    `Mission: ${mission.mission}`,
    `North star: ${mission.northStarMetric}`,
    `AXON surfaces: ${mission.axonIntegration.connectedSurfaces.join(', ')}.`,
    `Value streams: ${mission.valueStreams.map((stream) => stream.name).join(', ')}.`,
    `Integrations: ${mission.integrationFabric.map((integration) => `${integration.system}:${integration.connectorType}`).join(', ')}.`,
    `Governance: ${mission.governanceControls.map((control) => `${control.control} via ${control.framework}`).join('; ')}.`,
    `Decision rights: ${mission.decisionRights.map((decision) => `${decision.decision}=${decision.autonomy}`).join(', ')}.`,
    `Evidence: product blueprint ${mission.productBlueprint.id}, workforce ${mission.controlPlane.id}, managed service ${mission.managedService.id}, service tickets ${mission.initialTickets.map((ticket) => ticket.id).join(', ')}.`,
  ].join(' ');
}

function buildCompanyOsHtmlSnapshot(mission: CompanyOperatingMission) {
  const valueStreams = mission.valueStreams.map((stream) => `<li>${escapeHtml(stream.name)} ${escapeHtml(stream.objective)}</li>`).join('');
  const controls = mission.governanceControls.map((control) => `<li>${escapeHtml(control.control)} ${escapeHtml(control.framework)}</li>`).join('');
  return `<!doctype html>
<html lang="en">
<head><title>AXON Mission Preview - ${escapeHtml(mission.companyName)}</title></head>
<body>
  <main>
    <p>AXON Mission Preview</p>
    <h1>${escapeHtml(mission.companyName)} Company OS</h1>
    <button type="button">Start delivery</button>
    <section>
      <h2>Dashboard</h2>
      <p>${escapeHtml(mission.executiveSummary)}</p>
      <p>Enterprise score ${mission.enterpriseScore.overall}</p>
    </section>
    <section><h2>Value streams</h2><ul>${valueStreams}</ul></section>
    <section><h2>Governance controls</h2><ul>${controls}</ul></section>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const companyOs = new CompanyOsService();
