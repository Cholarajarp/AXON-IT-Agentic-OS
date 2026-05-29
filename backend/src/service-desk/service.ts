import { nanoid } from 'nanoid';
import { artifactService } from '../artifacts/index.js';
import { DurableJsonStore } from '../services/durable-json-store.js';
import { trustLedger } from '../trust-ledger/index.js';
import type {
  ConfigurationItemType,
  ServiceCriticality,
  ServiceDeskActivationResult,
  ServiceDeskEvidenceInput,
  ServiceDeskInput,
  ServiceDeskTicket,
  ServiceOperationsDashboard,
  ServiceOperationsKernel,
  ServiceRequestCategory,
  ServiceRequestPriority,
  ServiceRequestStatus,
} from './types.js';

const ticketStore = new DurableJsonStore<ServiceDeskTicket[]>('service-desk/tickets.json', []);
const tickets = new Map<string, ServiceDeskTicket>(ticketStore.read().map((ticket) => [ticket.id, normalizeTicket(ticket)]));

export class ServiceDeskService {
  createTicket(input: ServiceDeskInput): ServiceDeskTicket {
    const category = classify(input.request);
    const priority = prioritize(input, category);
    const now = new Date().toISOString();
    const tenantId = input.tenantId ?? 'tenant_default';
    const system = input.system?.trim() || inferSystem(input.request);
    const customerName = inferCustomerName(input.requester, tenantId);
    const sla = buildSla(priority);
    const evidenceRequired = buildEvidence(category, priority);
    const ticket: ServiceDeskTicket = {
      id: `it_${nanoid(10)}`,
      tenantId,
      requester: input.requester?.trim() || 'Requester',
      title: input.title?.trim() || titleFromRequest(input.request, category),
      request: input.request,
      category,
      priority,
      status: 'triaged',
      system,
      affectedUsers: input.affectedUsers ?? inferAffectedUsers(priority),
      sla,
      assignedAgents: assignAgents(category, priority),
      approvalRequired: requiresApproval(category, priority),
      approvals: buildApprovals(category, priority, input.compliance ?? []),
      runbook: buildRunbook(category, priority),
      customerUpdates: buildCustomerUpdates(category, priority, input.requester ?? 'Requester'),
      risks: buildRisks(category, priority),
      evidenceRequired,
      evidenceProvided: [
        evidenceItem('intake', 'intake summary', 'IntentAgent', 'satisfied', now),
        evidenceItem('triage', 'triage decision', 'PMOAgent', 'satisfied', now),
        evidenceItem('triage', 'owner assignment', 'PMOAgent', 'satisfied', now),
        evidenceItem('response', 'customer update', 'CustomerSuccessAgent', 'satisfied', now),
      ],
      automationPlan: buildAutomationPlan(category, priority),
      kernel: buildKernel({
        category,
        priority,
        now,
        tenantId,
        system,
        customerName,
        requester: input.requester ?? 'Requester',
        affectedUsers: input.affectedUsers ?? inferAffectedUsers(priority),
        compliance: input.compliance ?? [],
        evidenceRequired,
        evidenceProvided: ['intake summary', 'triage decision', 'owner assignment', 'customer update'],
      }),
      linkedArtifacts: [],
      trustRecordIds: [],
      createdAt: now,
      updatedAt: now,
    };

    tickets.set(ticket.id, ticket);
    persist();
    return ticket;
  }

  listTickets(): ServiceDeskTicket[] {
    refreshSlaClocks();
    return Array.from(tickets.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getTicket(id: string): ServiceDeskTicket | undefined {
    const ticket = tickets.get(id);
    if (!ticket) return undefined;
    refreshTicket(ticket);
    persist();
    return ticket;
  }

  updateStatus(id: string, status: ServiceRequestStatus): ServiceDeskTicket | undefined {
    const ticket = tickets.get(id);
    if (!ticket) return undefined;
    ticket.status = status;
    applyStatusToLifecycle(ticket, status);
    refreshTicket(ticket);
    persist();
    return ticket;
  }

  activateKernel(id: string, input: { operator?: string; mode?: 'dry-run' | 'supervised' | 'execute' } = {}): ServiceDeskActivationResult | undefined {
    const ticket = tickets.get(id);
    if (!ticket) return undefined;

    const now = new Date().toISOString();
    const mode = input.mode ?? 'supervised';
    ticket.status = ticket.approvalRequired ? 'approved' : 'executing';
    applyStatusToLifecycle(ticket, ticket.status);
    ticket.kernel.remediation.mode = mode === 'execute' && !ticket.approvalRequired ? 'auto-remediation' : 'supervised-agent';
    ticket.kernel.incidentCommand.timeline.unshift({
      at: now,
      event: `Service Operations Kernel activated by ${input.operator ?? 'AXON operator'} in ${mode} mode`,
      evidence: ['kernel activation', 'lifecycle gates opened'],
    });
    ticket.evidenceProvided.unshift(evidenceItem('approval', `kernel activation ${mode}`, input.operator ?? 'AXON operator', 'satisfied', now));

    refreshTicket(ticket);
    const artifact = artifactService.put({
      tenantId: ticket.tenantId,
      kind: 'customer-report',
      name: `${ticket.id}-service-operations-kernel`,
      content: buildOperationsPack(ticket),
      metadata: {
        ticketId: ticket.id,
        priority: ticket.priority,
        category: ticket.category,
        service: ticket.kernel.service.name,
      },
    });
    const record = trustLedger.append({
      tenantId: ticket.tenantId,
      kind: ticket.category === 'deployment' || ticket.category === 'change' ? 'deployment' : 'customer-handoff',
      actor: input.operator ?? 'ServiceOperationsKernel',
      actorType: input.operator ? 'human' : 'agent',
      subject: `Service operations activation ${ticket.id}`,
      summary: `${ticket.priority} ${ticket.category} ticket activated with SLA, CMDB, change, remediation, evidence, and QBR controls.`,
      risk: riskFromPriority(ticket.priority),
      source: 'Service Desk',
      artifacts: [artifact.uri],
      metadata: {
        ticketId: ticket.id,
        serviceId: ticket.kernel.service.id,
        evidenceCoveragePct: ticket.kernel.evidencePack.coveragePct,
        serviceCreditExposureUsd: ticket.kernel.financial.serviceCreditExposureUsd,
      },
      controls: ['ISO20000-SMS', 'SOC2-CC7.2', 'SOC2-CC8.1', 'NIST-CSF-RS', 'NIST-AI-RMF-MANAGE'],
    });

    ticket.linkedArtifacts.unshift(artifact.id);
    ticket.trustRecordIds.unshift(record.id);
    ticket.kernel.evidencePack.artifactId = artifact.id;
    ticket.kernel.evidencePack.trustRecordId = record.id;
    ticket.kernel.evidencePack.ledgerControls = Array.from(new Set([...ticket.kernel.evidencePack.ledgerControls, ...record.controls]));
    ticket.updatedAt = now;
    refreshTicket(ticket);
    persist();

    return {
      ticket,
      artifactId: artifact.id,
      trustRecordId: record.id,
      nextActions: ticket.kernel.nextBestActions,
    };
  }

  attachEvidence(id: string, input: ServiceDeskEvidenceInput): ServiceDeskTicket | undefined {
    const ticket = tickets.get(id);
    if (!ticket) return undefined;
    const now = new Date().toISOString();
    ticket.evidenceProvided.unshift({
      id: `se_${nanoid(10)}`,
      stageId: input.stageId,
      evidence: input.evidence,
      artifactId: input.artifactId,
      verifiedBy: input.verifiedBy ?? 'ServiceOperationsAgent',
      status: input.status ?? 'satisfied',
      createdAt: now,
    });
    if (input.artifactId) ticket.linkedArtifacts.unshift(input.artifactId);
    const stage = input.stageId ? ticket.kernel.lifecycle.find((item) => item.id === input.stageId) : undefined;
    if (stage) {
      stage.evidenceProvided = Array.from(new Set([...stage.evidenceProvided, input.evidence]));
      if (stage.evidenceProvided.length >= stage.evidenceRequired.length && input.status !== 'blocked') {
        stage.status = 'completed';
        stage.completedAt = now;
        activateNextStage(ticket);
      }
      if (input.status === 'blocked') {
        stage.status = 'blocked';
        stage.blockers.unshift(input.evidence);
      }
    }
    refreshTicket(ticket);
    persist();
    return ticket;
  }

  dashboard(): ServiceOperationsDashboard {
    refreshSlaClocks();
    const all = Array.from(tickets.values());
    const active = all.filter((ticket) => !['resolved', 'closed'].includes(ticket.status));
    const topServiceMap = new Map<string, { service: string; tickets: number; highestPriority: ServiceRequestPriority; revenueAtRiskUsd: number }>();
    for (const ticket of all) {
      const service = ticket.kernel.service.name;
      const current = topServiceMap.get(service) ?? { service, tickets: 0, highestPriority: ticket.priority, revenueAtRiskUsd: 0 };
      current.tickets += 1;
      current.revenueAtRiskUsd += ticket.kernel.financial.estimatedRevenueAtRiskUsd;
      if (priorityRank(ticket.priority) > priorityRank(current.highestPriority)) current.highestPriority = ticket.priority;
      topServiceMap.set(service, current);
    }

    const avgScore = average(all.map((ticket) => ticket.kernel.score));
    const avgCoverage = average(all.map((ticket) => ticket.kernel.evidencePack.coveragePct));
    const completion = average(all.map((ticket) => lifecycleCompletion(ticket)));
    const gaps = Array.from(new Set(all.flatMap((ticket) => ticket.kernel.evidencePack.missing))).slice(0, 8);

    return {
      generatedAt: new Date().toISOString(),
      totalTickets: all.length,
      activeTickets: active.length,
      p0Tickets: all.filter((ticket) => ticket.priority === 'P0').length,
      breachedTickets: all.filter((ticket) => ticket.kernel.slaClock.state === 'breached').length,
      averageKernelScore: Math.round(avgScore),
      averageEvidenceCoveragePct: Math.round(avgCoverage),
      cmdbItems: all.reduce((sum, ticket) => sum + ticket.kernel.cmdb.length, 0),
      revenueAtRiskUsd: roundMoney(all.reduce((sum, ticket) => sum + ticket.kernel.financial.estimatedRevenueAtRiskUsd, 0)),
      serviceCreditExposureUsd: roundMoney(all.reduce((sum, ticket) => sum + ticket.kernel.financial.serviceCreditExposureUsd, 0)),
      lifecycleCompletionPct: Math.round(completion),
      topServices: Array.from(topServiceMap.values()).sort((a, b) => priorityRank(b.highestPriority) - priorityRank(a.highestPriority)).slice(0, 5),
      controlGaps: gaps,
      nextActions: buildDashboardActions(active, gaps),
    };
  }
}

function classify(request: string): ServiceRequestCategory {
  const lower = request.toLowerCase();
  if (/(outage|down|broken|500|latency|slow|incident|production issue|not working)/.test(lower)) return 'incident';
  if (/(access|permission|login|sso|account|role|invite|reset)/.test(lower)) return 'access';
  if (/(database|schema|migration|sql|postgres|mysql|rls|row level)/.test(lower)) return 'database';
  if (/(deploy|release|rollback|environment|staging|production deploy)/.test(lower)) return 'deployment';
  if (/(security|vulnerability|cve|secret|token|breach|audit|compliance)/.test(lower)) return 'security';
  if (/(change|approval|modify|configuration|config)/.test(lower)) return 'change';
  if (/(buy|purchase|procure|license|vendor|subscription)/.test(lower)) return 'procurement';
  if (/(build|create app|new product|mvp|portal|dashboard)/.test(lower)) return 'product-build';
  return 'support';
}

function prioritize(input: ServiceDeskInput, category: ServiceRequestCategory): ServiceRequestPriority {
  if (input.urgency === 'critical' || (input.affectedUsers ?? 0) >= 1000 || category === 'incident' && /prod|production|outage|down/i.test(input.request)) return 'P0';
  if (input.urgency === 'high' || (input.affectedUsers ?? 0) >= 100 || ['security', 'database', 'deployment'].includes(category)) return 'P1';
  if (input.urgency === 'medium' || ['access', 'change', 'product-build'].includes(category)) return 'P2';
  return 'P3';
}

function titleFromRequest(request: string, category: ServiceRequestCategory) {
  const first = request.replace(/\s+/g, ' ').trim().slice(0, 72);
  return first || `${category} request`;
}

function inferSystem(request: string) {
  const match = request.match(/\b(api|database|postgres|github|slack|jira|billing|auth|sso|production|staging|dashboard)\b/i);
  return match?.[0] ?? 'AXON workspace';
}

function inferCustomerName(requester: string | undefined, tenantId: string) {
  if (requester?.trim()) return `${requester.trim()} account`;
  return tenantId === 'tenant_default' ? 'Default enterprise account' : tenantId.replace(/[_-]/g, ' ');
}

function inferAffectedUsers(priority: ServiceRequestPriority) {
  if (priority === 'P0') return 500;
  if (priority === 'P1') return 100;
  if (priority === 'P2') return 10;
  return 1;
}

function buildSla(priority: ServiceRequestPriority): ServiceDeskTicket['sla'] {
  const table = {
    P0: { responseMinutes: 5, resolutionHours: 4, escalation: ['Incident commander', 'SRE lead', 'Executive sponsor'] },
    P1: { responseMinutes: 15, resolutionHours: 8, escalation: ['Service owner', 'SRE lead'] },
    P2: { responseMinutes: 60, resolutionHours: 48, escalation: ['Service owner'] },
    P3: { responseMinutes: 240, resolutionHours: 120, escalation: ['Queue owner'] },
  } satisfies Record<ServiceRequestPriority, ServiceDeskTicket['sla']>;
  return table[priority];
}

function assignAgents(category: ServiceRequestCategory, priority: ServiceRequestPriority) {
  const base = ['IntentAgent', 'PMOAgent'];
  const categoryAgents: Record<ServiceRequestCategory, string[]> = {
    incident: ['SREAgent', 'EngineeringAgent', 'DocumentationAgent'],
    access: ['SecurityAgent', 'ComplianceAgent'],
    change: ['SolutionArchitectAgent', 'SecurityAgent', 'ReleaseAgent'],
    deployment: ['ReleaseAgent', 'SREAgent', 'QAAgent'],
    security: ['SecurityAgent', 'ComplianceAgent', 'EngineeringAgent'],
    database: ['DatabaseArchitectAgent', 'MigrationSafetyAgent', 'DataQualityAgent'],
    procurement: ['BusinessAnalystAgent', 'ComplianceAgent'],
    support: ['DocumentationAgent', 'EngineeringAgent'],
    'product-build': ['BusinessAnalystAgent', 'SolutionArchitectAgent', 'EngineeringAgent', 'QAAgent'],
  };
  return priority === 'P0' ? [...base, ...categoryAgents[category], 'ExecutiveInsightAgent'] : [...base, ...categoryAgents[category]];
}

function requiresApproval(category: ServiceRequestCategory, priority: ServiceRequestPriority) {
  return priority === 'P0' || priority === 'P1' || ['change', 'deployment', 'database', 'security', 'procurement'].includes(category);
}

function buildApprovals(category: ServiceRequestCategory, priority: ServiceRequestPriority, compliance: string[]): ServiceDeskTicket['approvals'] {
  const approvals: ServiceDeskTicket['approvals'] = [];
  if (priority === 'P0' || priority === 'P1') approvals.push({ approver: 'Service owner', reason: `${priority} impact requires accountable owner approval` });
  if (category === 'database') approvals.push({ approver: 'Database owner', reason: 'Stateful change requires rollback and quality-gate approval' });
  if (category === 'security' || compliance.length > 0) approvals.push({ approver: 'Security/compliance owner', reason: `Compliance scope: ${compliance.join(', ') || 'security risk'}` });
  if (category === 'procurement') approvals.push({ approver: 'Finance owner', reason: 'Spend and vendor review required' });
  return approvals;
}

function buildRunbook(category: ServiceRequestCategory, priority: ServiceRequestPriority): ServiceDeskTicket['runbook'] {
  const common = [
    { step: 1, ownerAgent: 'IntentAgent', action: `Confirm request scope, impacted system, ${priority} urgency, and success criteria.`, evidence: ['intake summary'] },
    { step: 2, ownerAgent: 'PMOAgent', action: 'Assign SLA, owners, approvals, and next checkpoint.', evidence: ['triage record'] },
  ];
  const specific: Record<ServiceRequestCategory, ServiceDeskTicket['runbook']> = {
    incident: [
      { step: 3, ownerAgent: 'SREAgent', action: 'Check logs, metrics, traces, recent deploys, and dependency health.', evidence: ['incident timeline', 'dashboard snapshot'] },
      { step: 4, ownerAgent: 'EngineeringAgent', action: 'Apply reversible remediation and verify service health.', evidence: ['diff or command log', 'smoke test'] },
    ],
    access: [
      { step: 3, ownerAgent: 'SecurityAgent', action: 'Validate identity, role, approval, and least-privilege scope.', evidence: ['approval record', 'role mapping'] },
    ],
    change: [
      { step: 3, ownerAgent: 'SolutionArchitectAgent', action: 'Evaluate blast radius, rollback path, and compatibility.', evidence: ['change plan'] },
      { step: 4, ownerAgent: 'ReleaseAgent', action: 'Schedule and execute change behind gates.', evidence: ['release record'] },
    ],
    deployment: [
      { step: 3, ownerAgent: 'QAAgent', action: 'Run tests, dependency audit, and smoke checks before deploy.', evidence: ['test logs', 'build logs'] },
      { step: 4, ownerAgent: 'ReleaseAgent', action: 'Deploy with rollback owner and observe health.', evidence: ['deployment record', 'rollback plan'] },
    ],
    security: [
      { step: 3, ownerAgent: 'SecurityAgent', action: 'Run Security Center scan and classify vulnerabilities.', evidence: ['security scan report'] },
      { step: 4, ownerAgent: 'ComplianceAgent', action: 'Attach audit evidence and user notification decision.', evidence: ['audit evidence'] },
    ],
    database: [
      { step: 3, ownerAgent: 'MigrationSafetyAgent', action: 'Run Database Pipeline review and block unsafe SQL.', evidence: ['migration safety report'] },
      { step: 4, ownerAgent: 'DataQualityAgent', action: 'Create row-count, checksum, and rollback quality gates.', evidence: ['quality gate plan'] },
    ],
    procurement: [
      { step: 3, ownerAgent: 'BusinessAnalystAgent', action: 'Validate business value, vendor, cost, and alternatives.', evidence: ['vendor assessment'] },
    ],
    support: [
      { step: 3, ownerAgent: 'DocumentationAgent', action: 'Draft user-facing answer and escalation path.', evidence: ['support response'] },
    ],
    'product-build': [
      { step: 3, ownerAgent: 'BusinessAnalystAgent', action: 'Generate product blueprint and acceptance criteria.', evidence: ['blueprint'] },
      { step: 4, ownerAgent: 'EngineeringAgent', action: 'Build, test, and preview the product.', evidence: ['preview', 'test logs'] },
    ],
  };
  return [...common, ...specific[category]].map((item, index) => ({ ...item, step: index + 1 }));
}

function buildCustomerUpdates(category: ServiceRequestCategory, priority: ServiceRequestPriority, requester: string): ServiceDeskTicket['customerUpdates'] {
  return [
    {
      audience: 'requester',
      message: `Hi ${requester}, AXON triaged your ${category} request as ${priority}. We assigned SLA, CMDB context, owners, approvals, and evidence gates.`,
    },
    {
      audience: 'stakeholders',
      message: 'Stakeholders will receive updates when triage, approval, execution, verification, and prevention milestones complete.',
    },
    {
      audience: 'executive',
      message: priority === 'P0' ? 'Executive update required: P0 impact is under incident command with rollback-ready remediation.' : 'No executive escalation required yet.',
    },
  ];
}

function buildRisks(category: ServiceRequestCategory, priority: ServiceRequestPriority): ServiceDeskTicket['risks'] {
  const risks: ServiceDeskTicket['risks'] = [
    { level: priority === 'P0' ? 'critical' : priority === 'P1' ? 'high' : 'medium', description: 'Scope or impact may be incomplete at intake.', mitigation: 'Confirm affected systems, users, and success criteria before execution.' },
  ];
  if (category === 'database') risks.push({ level: 'high', description: 'Stateful change can cause data loss or downtime.', mitigation: 'Require backup, rollback, Database Pipeline review, and data quality gates.' });
  if (category === 'security') risks.push({ level: 'high', description: 'Security issue may expose data or credentials.', mitigation: 'Run Security Center and rotate exposed credentials if found.' });
  if (category === 'deployment' || category === 'change') risks.push({ level: 'high', description: 'Change can increase customer-facing failure rate.', mitigation: 'Use CAB approval, canary rollout, smoke tests, and rollback trigger.' });
  return risks;
}

function buildEvidence(category: ServiceRequestCategory, priority: ServiceRequestPriority) {
  const evidence = ['intake summary', 'triage decision', 'owner assignment', 'customer update'];
  if (priority === 'P0' || priority === 'P1') evidence.push('timeline', 'approval record', 'verification proof');
  if (category === 'database') evidence.push('database safety report', 'backup checkpoint', 'quality gates');
  if (category === 'security') evidence.push('security scan report', 'remediation proof');
  if (category === 'deployment' || category === 'change') evidence.push('build logs', 'smoke test', 'rollback plan');
  evidence.push('problem prevention action', 'QBR value note');
  return Array.from(new Set(evidence));
}

function buildAutomationPlan(category: ServiceRequestCategory, priority: ServiceRequestPriority) {
  return `AXON routes this ${category} request through ${priority} SLA gates, CMDB dependency checks, change controls, supervised agent remediation, Trust Ledger evidence, service-credit exposure, and QBR reporting before closure.`;
}

function buildKernel(input: {
  category: ServiceRequestCategory;
  priority: ServiceRequestPriority;
  now: string;
  tenantId: string;
  system: string;
  customerName: string;
  requester: string;
  affectedUsers: number;
  compliance: string[];
  evidenceRequired: string[];
  evidenceProvided: string[];
}): ServiceOperationsKernel {
  const criticality = criticalityFor(input.priority);
  const serviceId = `svc_${slug(input.system)}`;
  const contractCoverage = input.priority === 'P0' || input.compliance.length > 0 ? '24x7' : input.priority === 'P1' ? '16x5' : '8x5';
  const cmdb = buildCmdb(input.category, input.system, criticality);
  const responseMinutes = buildSla(input.priority).responseMinutes;
  const resolutionHours = buildSla(input.priority).resolutionHours;
  const lifecycle = buildLifecycle(input.priority, input.category, input.now, input.evidenceProvided);
  const financial = buildFinancial(input.priority, input.affectedUsers, contractCoverage);
  const score = scoreKernel(lifecycle, input.evidenceRequired, input.evidenceProvided, false, input.priority);
  return {
    customer: {
      id: `cust_${slug(input.customerName)}`,
      name: input.customerName,
      segment: input.compliance.length > 0 ? 'regulated-enterprise' : input.affectedUsers > 1000 ? 'enterprise' : input.affectedUsers > 100 ? 'mid-market' : 'internal',
      tier: input.priority === 'P0' ? 'mission-critical' : input.priority === 'P1' ? 'premium' : 'standard',
      region: 'global',
      serviceOwner: 'ServiceOwnerAgent',
      successManager: 'CustomerSuccessAgent',
    },
    contract: {
      id: `msa_${input.tenantId}`,
      name: `${input.customerName} managed service agreement`,
      coverage: contractCoverage,
      monthlyRecurringUsd: financial.monthlyRecurringUsd,
      serviceCreditRatePct: input.priority === 'P0' ? 10 : input.priority === 'P1' ? 5 : 2,
      renewalDate: addDays(input.now, 365),
      obligations: [
        'SLA response and resolution tracking',
        'Incident, problem, change, and evidence records',
        'Monthly service report and quarterly business review',
        ...input.compliance.map((item) => `${item} evidence retention`),
      ],
    },
    service: {
      id: serviceId,
      name: input.system,
      type: input.category,
      environment: /prod|production|api|database|billing|auth|sso/i.test(input.system) ? 'production' : 'staging',
      criticality,
      serviceWindow: contractCoverage,
      ownerAgent: ownerFor(input.category),
      serviceLevel: {
        availabilityTargetPct: input.priority === 'P0' ? 99.95 : input.priority === 'P1' ? 99.9 : 99.5,
        responseTargetMinutes: responseMinutes,
        resolutionTargetHours: resolutionHours,
        errorBudgetMinutesMonthly: input.priority === 'P0' ? 21.6 : input.priority === 'P1' ? 43.2 : 216,
      },
    },
    cmdb,
    serviceGraph: buildServiceGraph(cmdb),
    slaClock: buildSlaClock(input.now, responseMinutes, resolutionHours),
    lifecycle,
    incidentCommand: {
      commander: input.priority === 'P0' ? 'IncidentCommanderAgent' : 'ServiceOwnerAgent',
      severity: input.priority,
      bridge: input.priority === 'P0' ? `bridge://${input.tenantId}/${serviceId}/major-incident` : `thread://${input.tenantId}/${serviceId}/service-desk`,
      customerImpact: `${input.affectedUsers} user(s) potentially impacted by ${input.system}.`,
      blastRadius: cmdb.filter((item) => item.criticality === 'mission-critical' || item.health !== 'healthy').map((item) => item.name),
      stakeholderCadence: input.priority === 'P0' ? 'every 15 minutes until mitigated' : input.priority === 'P1' ? 'hourly until stable' : 'daily until resolved',
      timeline: [
        { at: input.now, event: 'Request opened and classified', evidence: ['intake summary'] },
        { at: input.now, event: `${input.priority} ${input.category} triage completed`, evidence: ['triage decision', 'owner assignment'] },
      ],
    },
    changeControl: buildChangeControl(input.category, input.priority, input.now),
    remediation: buildRemediation(input.category, input.priority),
    release: buildRelease(input.category, input.priority),
    problemManagement: buildProblemManagement(input.category, input.priority),
    financial,
    qbr: buildQbr(input.category, input.priority, input.system, financial),
    evidencePack: {
      coveragePct: evidenceCoverage(input.evidenceRequired, input.evidenceProvided),
      missing: missingEvidence(input.evidenceRequired, input.evidenceProvided),
      ledgerControls: ['ISO20000-SMS', 'SOC2-CC7.2', 'SOC2-CC8.1', 'NIST-CSF-RS'],
      exportReady: false,
    },
    integrations: buildIntegrations(input.category, input.priority, input.system, serviceId),
    automationSafety: buildAutomationSafety(input.category, input.priority),
    score,
    maturity: maturityFor(score),
    nextBestActions: nextActionsFor(lifecycle, input.evidenceRequired, input.evidenceProvided, input.priority),
  };
}

function buildCmdb(category: ServiceRequestCategory, system: string, criticality: ServiceCriticality): ServiceOperationsKernel['cmdb'] {
  const normalized = system || 'AXON workspace';
  const items: ServiceOperationsKernel['cmdb'] = [
    ci(`${normalized} service`, category === 'database' ? 'database' : 'application', criticality, ownerFor(category), category === 'security' ? 'at-risk' : category === 'incident' ? 'degraded' : 'unknown', ['api-gateway', 'identity-provider'], ['latency', 'errors', 'availability'], 'daily snapshot plus pre-change checkpoint', category === 'security' ? 'restricted' : 'confidential'),
    ci('api-gateway', 'api', criticality, 'SREAgent', category === 'incident' ? 'degraded' : 'healthy', ['identity-provider'], ['5xx-rate', 'p95-latency'], 'configuration export before change', 'internal'),
    ci('identity-provider', 'security-control', category === 'access' || category === 'security' ? 'mission-critical' : 'high', 'SecurityAgent', category === 'access' ? 'at-risk' : 'healthy', [], ['auth-failures', 'mfa-events'], 'daily config backup', 'restricted'),
  ];
  if (['database', 'deployment', 'product-build'].includes(category)) {
    items.push(ci('release-pipeline', 'pipeline', criticality, 'ReleaseAgent', category === 'deployment' ? 'at-risk' : 'healthy', [items[0].id], ['build-status', 'deploy-duration'], 'last successful artifact retained', 'internal'));
  }
  if (category === 'security') {
    items.push(ci('security-monitoring', 'security-control', 'mission-critical', 'SecurityAgent', 'at-risk', [items[0].id], ['critical-findings', 'secret-leaks'], 'SIEM export retained 1 year', 'restricted'));
  }
  return items;
}

function ci(
  name: string,
  type: ConfigurationItemType,
  criticality: ServiceCriticality,
  ownerAgent: string,
  health: ServiceOperationsKernel['cmdb'][number]['health'],
  dependencies: string[],
  monitors: string[],
  backupPolicy: string,
  dataClass: ServiceOperationsKernel['cmdb'][number]['dataClass'],
): ServiceOperationsKernel['cmdb'][number] {
  return {
    id: slug(name),
    name,
    type,
    criticality,
    ownerAgent,
    health,
    dependencies,
    monitors,
    backupPolicy,
    dataClass,
    rtoMinutes: criticality === 'mission-critical' ? 30 : criticality === 'high' ? 120 : 480,
    rpoMinutes: dataClass === 'restricted' || dataClass === 'confidential' ? 15 : 240,
  };
}

function buildServiceGraph(cmdb: ServiceOperationsKernel['cmdb']): ServiceOperationsKernel['serviceGraph'] {
  const graph: ServiceOperationsKernel['serviceGraph'] = [];
  for (const item of cmdb) {
    for (const dependency of item.dependencies) {
      graph.push({
        from: item.id,
        to: dependency,
        relationship: dependency.includes('security') || dependency.includes('identity') ? 'protects' : dependency.includes('pipeline') ? 'deploys' : 'depends-on',
        risk: item.health === 'degraded' ? 'critical' : item.health === 'at-risk' ? 'high' : item.criticality === 'mission-critical' ? 'medium' : 'low',
      });
    }
  }
  return graph;
}

function buildSlaClock(openedAt: string, responseMinutes: number, resolutionHours: number): ServiceOperationsKernel['slaClock'] {
  const now = Date.now();
  const opened = new Date(openedAt).getTime();
  const responseDue = opened + responseMinutes * 60_000;
  const resolutionDue = opened + resolutionHours * 60 * 60_000;
  const responseBreached = now > responseDue;
  const resolutionBreached = now > resolutionDue;
  const minutesToResponseDue = Math.ceil((responseDue - now) / 60_000);
  const minutesToResolutionDue = Math.ceil((resolutionDue - now) / 60_000);
  const elapsed = Math.max(now - opened, 1);
  const budget = Math.max(resolutionDue - opened, 1);
  const burnRate = Number(Math.min(9.99, elapsed / budget).toFixed(2));
  return {
    openedAt,
    responseDueAt: new Date(responseDue).toISOString(),
    resolutionDueAt: new Date(resolutionDue).toISOString(),
    responseBreached,
    resolutionBreached,
    minutesToResponseDue,
    minutesToResolutionDue,
    burnRate,
    state: resolutionBreached || responseBreached ? 'breached' : minutesToResolutionDue < resolutionHours * 60 * 0.25 ? 'at-risk' : 'inside-sla',
  };
}

function buildLifecycle(priority: ServiceRequestPriority, category: ServiceRequestCategory, now: string, evidenceProvided: string[]): ServiceOperationsKernel['lifecycle'] {
  const stage = (
    id: string,
    name: string,
    ownerAgent: string,
    offsetMinutes: number,
    required: string[],
    status: ServiceOperationsKernel['lifecycle'][number]['status'],
    nextAction: string,
  ): ServiceOperationsKernel['lifecycle'][number] => ({
    id,
    name,
    status,
    ownerAgent,
    dueAt: addMinutes(now, offsetMinutes),
    startedAt: ['intake', 'triage'].includes(id) ? now : undefined,
    completedAt: ['intake', 'triage'].includes(id) ? now : undefined,
    exitCriteria: required.map((item) => `Evidence attached: ${item}`),
    evidenceRequired: required,
    evidenceProvided: required.filter((item) => hasEvidence(evidenceProvided, item)),
    blockers: [],
    nextAction,
  });

  const sla = buildSla(priority);
  const approvalStatus = requiresApproval(category, priority) ? 'active' : 'completed';
  return [
    stage('intake', 'Intake and impact capture', 'IntentAgent', 5, ['intake summary'], 'completed', 'Confirm business impact if new symptoms appear.'),
    stage('triage', 'Priority, service, and owner triage', 'PMOAgent', sla.responseMinutes, ['triage decision', 'owner assignment'], 'completed', 'Assign service owner and update stakeholder thread.'),
    stage('response', 'SLA response and stakeholder update', 'ServiceOwnerAgent', sla.responseMinutes, ['customer update'], 'active', 'Send first customer update before response SLA.'),
    stage('approval', 'Approval and policy gate', 'SecurityAgent', Math.max(30, sla.responseMinutes + 15), ['approval record'], approvalStatus, approvalStatus === 'completed' ? 'No approval gate blocks low-risk execution.' : 'Collect service, security, or finance approval.'),
    stage('remediation', 'Remediation execution', ownerFor(category), Math.max(60, sla.resolutionHours * 30), categoryEvidence(category), 'pending', 'Run the safest reversible remediation.'),
    stage('change-control', 'Change and release control', 'ReleaseAgent', Math.max(90, sla.resolutionHours * 40), ['rollback plan', 'smoke test'], ['change', 'deployment', 'database'].includes(category) ? 'pending' : 'completed', 'Prepare CAB evidence and rollback trigger.'),
    stage('verification', 'Verification and recovery proof', 'QAAgent', sla.resolutionHours * 60, ['verification proof'], 'pending', 'Attach smoke, monitor, and customer validation evidence.'),
    stage('problem', 'Problem prevention and known error', 'ProblemManagerAgent', sla.resolutionHours * 80, ['problem prevention action'], 'pending', 'Create prevention backlog and known-error note.'),
    stage('handoff', 'Customer handoff and QBR capture', 'CustomerSuccessAgent', sla.resolutionHours * 90, ['QBR value note'], 'pending', 'Publish customer handoff and commercial impact note.'),
  ].map((item) => {
    if (item.evidenceProvided.length >= item.evidenceRequired.length) return { ...item, status: 'completed' as const, completedAt: item.completedAt ?? now };
    return item;
  });
}

function categoryEvidence(category: ServiceRequestCategory) {
  const map: Record<ServiceRequestCategory, string[]> = {
    incident: ['timeline', 'verification proof'],
    access: ['approval record', 'role mapping'],
    change: ['change plan', 'rollback plan'],
    deployment: ['build logs', 'smoke test', 'rollback plan'],
    security: ['security scan report', 'remediation proof'],
    database: ['database safety report', 'backup checkpoint', 'quality gates'],
    procurement: ['vendor assessment'],
    support: ['support response'],
    'product-build': ['blueprint', 'test logs'],
  };
  return map[category];
}

function buildChangeControl(category: ServiceRequestCategory, priority: ServiceRequestPriority, now: string): ServiceOperationsKernel['changeControl'] {
  const emergency = priority === 'P0' || category === 'incident';
  const changeLike = ['change', 'deployment', 'database', 'security'].includes(category);
  return {
    changeId: `chg_${nanoid(8)}`,
    type: emergency ? 'emergency' : changeLike ? 'normal' : 'standard',
    risk: riskFromPriority(priority),
    cabRequired: changeLike || priority === 'P0',
    approvals: [
      { approver: 'Service owner', status: priority === 'P0' ? 'pending' : 'approved', reason: 'Owns customer impact and SLA decision.' },
      ...(changeLike ? [{ approver: 'Release manager', status: 'pending' as const, reason: 'Approves rollout, rollback, and smoke evidence.' }] : []),
    ],
    deploymentWindow: emergency ? 'immediate emergency window' : `${addMinutes(now, 60)} to ${addMinutes(now, 180)}`,
    rollbackPlan: [
      'Create checkpoint before mutation',
      'Limit blast radius with canary or feature flag',
      'Rollback when smoke test, error budget, or customer monitor fails',
    ],
    policyDecision: priority === 'P0' || riskFromPriority(priority) === 'high' || riskFromPriority(priority) === 'critical' ? 'requires-approval' : 'allow',
  };
}

function buildRemediation(category: ServiceRequestCategory, priority: ServiceRequestPriority): ServiceOperationsKernel['remediation'] {
  const highRisk = priority === 'P0' || priority === 'P1';
  const baseActions: Record<ServiceRequestCategory, string[]> = {
    incident: ['Correlate recent changes with telemetry', 'Apply reversible mitigation', 'Verify customer-facing recovery'],
    access: ['Validate identity and business need', 'Apply least-privilege role', 'Notify requester and manager'],
    change: ['Prepare change plan', 'Run preflight checks', 'Execute approved change'],
    deployment: ['Run build and smoke checks', 'Deploy via guarded strategy', 'Watch release health'],
    security: ['Classify exposure', 'Patch or rotate affected control', 'Verify no recurrence'],
    database: ['Run migration safety review', 'Create backup checkpoint', 'Execute expand-contract or rollback-safe plan'],
    procurement: ['Compare vendor options', 'Validate contract and budget', 'Route approval'],
    support: ['Draft answer', 'Validate against knowledge base', 'Send update'],
    'product-build': ['Create blueprint', 'Build vertical slice', 'Attach QA evidence'],
  };
  return {
    mode: highRisk ? 'supervised-agent' : 'auto-remediation',
    actions: baseActions[category].map((action, index) => ({
      order: index + 1,
      action,
      ownerAgent: index === 0 ? ownerFor(category) : index === 1 ? 'QAAgent' : 'CustomerSuccessAgent',
      risk: index === 1 && highRisk ? 'high' : riskFromPriority(priority),
      reversible: !/(delete|drop|rotate|contract)/i.test(action),
    })),
    automations: ['SLA timer', 'Evidence manifest update', 'Customer update draft', 'Trust Ledger export pack'],
    safeguards: ['least-privilege tool scopes', 'approval before high-risk mutation', 'checkpoint before stateful change', 'rollback trigger'],
    approvalGates: highRisk ? ['service owner approval', 'security or release approval', 'customer-impact confirmation'] : ['sampled operator review'],
  };
}

function buildRelease(category: ServiceRequestCategory, priority: ServiceRequestPriority): ServiceOperationsKernel['release'] {
  const releaseNeeded = ['change', 'deployment', 'database', 'security', 'product-build'].includes(category);
  return {
    releaseId: `rel_${nanoid(8)}`,
    strategy: !releaseNeeded ? 'no-release' : priority === 'P0' ? 'rollback-only' : category === 'deployment' ? 'canary' : 'rolling',
    environments: releaseNeeded ? ['staging', 'production'] : ['service-desk'],
    smokeTests: ['health endpoint responds', 'primary customer journey passes', 'error rate below SLO threshold'],
    rollbackTrigger: 'Rollback if P95 latency, 5xx rate, smoke test, or customer validation breaches agreed threshold.',
    deploymentArtifacts: releaseNeeded ? ['build logs', 'smoke test', 'rollback plan'] : ['support response', 'customer update'],
  };
}

function buildProblemManagement(category: ServiceRequestCategory, priority: ServiceRequestPriority): ServiceOperationsKernel['problemManagement'] {
  const recurring = ['incident', 'database', 'security', 'deployment'].includes(category);
  return {
    problemId: `prb_${nanoid(8)}`,
    knownError: recurring ? `${category} recurrence possible until root cause is eliminated.` : 'No known recurring error yet.',
    rootCauseHypotheses: rootCauseFor(category),
    preventionBacklog: [
      { title: 'Add monitor or policy gate for the failure mode', ownerAgent: 'SREAgent', priority: priority === 'P0' ? 'P1' : 'P2' },
      { title: 'Document known error and customer workaround', ownerAgent: 'DocumentationAgent', priority: 'P2' },
    ],
    recurrenceRisk: priority === 'P0' ? 'high' : recurring ? 'medium' : 'low',
  };
}

function rootCauseFor(category: ServiceRequestCategory) {
  const map: Record<ServiceRequestCategory, string[]> = {
    incident: ['recent deployment regression', 'dependency outage', 'capacity saturation'],
    access: ['role mapping drift', 'identity provider policy mismatch'],
    change: ['configuration drift', 'insufficient blast-radius review'],
    deployment: ['pipeline quality gap', 'release environment drift'],
    security: ['unpatched dependency', 'excessive privilege', 'secret handling gap'],
    database: ['unsafe migration plan', 'missing index or lock contention', 'data contract drift'],
    procurement: ['unclear business owner', 'vendor risk not reviewed'],
    support: ['knowledge article missing or stale'],
    'product-build': ['requirements ambiguity', 'integration not verified'],
  };
  return map[category];
}

function buildFinancial(priority: ServiceRequestPriority, affectedUsers: number, coverage: ServiceOperationsKernel['contract']['coverage']): ServiceOperationsKernel['financial'] & { monthlyRecurringUsd: number } {
  const monthlyRecurringUsd = coverage === '24x7' ? 48000 : coverage === '16x5' ? 28000 : 12000;
  const impactMultiplier = { P0: 1.4, P1: 0.8, P2: 0.25, P3: 0.08 }[priority];
  const estimatedRevenueAtRiskUsd = roundMoney(Math.max(500, affectedUsers * 18 * impactMultiplier));
  const serviceCreditExposureUsd = roundMoney(monthlyRecurringUsd * ({ P0: 0.1, P1: 0.05, P2: 0.01, P3: 0.002 }[priority]));
  const engineeringCostUsd = roundMoney({ P0: 3600, P1: 1800, P2: 650, P3: 220 }[priority]);
  return {
    monthlyRecurringUsd,
    estimatedRevenueAtRiskUsd,
    serviceCreditExposureUsd,
    engineeringCostUsd,
    marginImpactUsd: roundMoney(serviceCreditExposureUsd + engineeringCostUsd),
    invoiceNote: priority === 'P0'
      ? 'Track service-credit exposure and executive RCA commitment.'
      : 'No invoice adjustment unless SLA breach is confirmed.',
  };
}

function buildQbr(category: ServiceRequestCategory, priority: ServiceRequestPriority, system: string, financial: ServiceOperationsKernel['financial']): ServiceOperationsKernel['qbr'] {
  return {
    narrative: `${priority} ${category} work on ${system} is tracked from intake to prevention with SLA, evidence, and commercial impact.`,
    valueMetrics: [
      { label: 'Revenue protected', value: `$${financial.estimatedRevenueAtRiskUsd.toLocaleString()}`, evidence: ['impact model', 'affected users'] },
      { label: 'Service credit exposure', value: `$${financial.serviceCreditExposureUsd.toLocaleString()}`, evidence: ['contract SLA'] },
      { label: 'Prevention backlog', value: '2 items', evidence: ['problem record'] },
    ],
    risksToReview: ['SLA misses', 'recurring incidents', 'approval latency', 'automation safety exceptions'],
    renewalSignals: priority === 'P0'
      ? ['Executive attention required', 'QBR must include RCA and prevention funding']
      : ['Operational transparency improved', 'Evidence coverage supports renewal confidence'],
  };
}

function buildIntegrations(category: ServiceRequestCategory, priority: ServiceRequestPriority, system: string, serviceId: string): ServiceOperationsKernel['integrations'] {
  const base: ServiceOperationsKernel['integrations'] = [
    { system: 'ServiceNow', action: 'Create or sync incident/change record', status: 'needs-config', payload: { serviceId, system, priority, category } },
    { system: 'Jira Service Management', action: 'Create service request with SLA fields', status: 'needs-config', payload: { serviceId, requestType: category } },
    { system: 'Slack', action: 'Open stakeholder channel and post customer-safe updates', status: 'planned', payload: { channel: `axon-${serviceId}` } },
    { system: 'GitHub', action: 'Open remediation issue or PR package', status: ['deployment', 'database', 'product-build'].includes(category) ? 'planned' : 'ready', payload: { labels: ['service-ops', priority, category] } },
  ];
  if (priority === 'P0' || category === 'incident') base.push({ system: 'PagerDuty', action: 'Trigger incident commander escalation', status: 'needs-config', payload: { severity: priority } });
  if (['incident', 'deployment', 'database'].includes(category)) base.push({ system: 'Datadog', action: 'Attach metrics, traces, logs, and monitor snapshot', status: 'needs-config', payload: { service: system } });
  return base;
}

function buildAutomationSafety(category: ServiceRequestCategory, priority: ServiceRequestPriority): ServiceOperationsKernel['automationSafety'] {
  const highRisk = priority === 'P0' || priority === 'P1' || ['database', 'security', 'deployment', 'change'].includes(category);
  return {
    maxAutonomy: highRisk ? 'execute-with-approval' : 'execute-low-risk',
    requireHumanApprovalFor: ['production mutation', 'credential rotation', 'data deletion', 'external customer notification', 'service credit commitment'],
    forbiddenActions: ['drop production data without approved rollback', 'silently change billing terms', 'disable security monitoring', 'execute unscoped admin action'],
    toolScopes: ['tickets:write', 'evidence:write', 'artifacts:write', highRisk ? 'production:approval-required' : 'low-risk:execute'],
  };
}

function refreshSlaClocks() {
  let changed = false;
  for (const ticket of tickets.values()) {
    const before = ticket.kernel.slaClock.state;
    refreshTicket(ticket);
    changed ||= before !== ticket.kernel.slaClock.state;
  }
  if (changed) persist();
}

function refreshTicket(ticket: ServiceDeskTicket) {
  ensureBaselineEvidence(ticket);
  ticket.kernel.slaClock = buildSlaClock(ticket.createdAt, ticket.sla.responseMinutes, ticket.sla.resolutionHours);
  const evidenceProvided = ticket.evidenceProvided.map((item) => item.evidence);
  for (const stage of ticket.kernel.lifecycle) {
    stage.evidenceProvided = Array.from(new Set([
      ...stage.evidenceProvided,
      ...stage.evidenceRequired.filter((item) => hasEvidence(evidenceProvided, item)),
    ]));
    if (stage.status !== 'completed' && stage.evidenceProvided.length >= stage.evidenceRequired.length) {
      stage.status = 'completed';
      stage.completedAt = stage.completedAt ?? new Date().toISOString();
    }
    if (stage.status !== 'completed' && Date.now() > new Date(stage.dueAt).getTime()) stage.status = 'breached';
  }
  ticket.kernel.evidencePack.coveragePct = evidenceCoverage(ticket.evidenceRequired, evidenceProvided);
  ticket.kernel.evidencePack.missing = missingEvidence(ticket.evidenceRequired, evidenceProvided);
  ticket.kernel.evidencePack.exportReady = ticket.kernel.evidencePack.missing.length === 0 && Boolean(ticket.kernel.evidencePack.trustRecordId);
  ticket.kernel.score = scoreKernel(ticket.kernel.lifecycle, ticket.evidenceRequired, evidenceProvided, Boolean(ticket.kernel.evidencePack.trustRecordId), ticket.priority);
  ticket.kernel.maturity = maturityFor(ticket.kernel.score);
  ticket.kernel.nextBestActions = nextActionsFor(ticket.kernel.lifecycle, ticket.evidenceRequired, evidenceProvided, ticket.priority);
  ticket.updatedAt = new Date().toISOString();
}

function ensureBaselineEvidence(ticket: ServiceDeskTicket) {
  const now = new Date().toISOString();
  const baseline = [
    { stageId: 'intake', evidence: 'intake summary', verifiedBy: 'IntentAgent' },
    { stageId: 'triage', evidence: 'triage decision', verifiedBy: 'PMOAgent' },
    { stageId: 'triage', evidence: 'owner assignment', verifiedBy: 'PMOAgent' },
    { stageId: 'response', evidence: 'customer update', verifiedBy: 'CustomerSuccessAgent' },
  ];
  for (const item of baseline) {
    if (!ticket.evidenceProvided.some((provided) => hasEvidence([provided.evidence], item.evidence))) {
      ticket.evidenceProvided.push(evidenceItem(item.stageId, item.evidence, item.verifiedBy, 'satisfied', now));
    }
  }
}

function applyStatusToLifecycle(ticket: ServiceDeskTicket, status: ServiceRequestStatus) {
  const now = new Date().toISOString();
  const complete = (ids: string[]) => {
    for (const id of ids) {
      const stage = ticket.kernel.lifecycle.find((item) => item.id === id);
      if (stage && stage.status !== 'completed') {
        stage.status = 'completed';
        stage.completedAt = now;
        stage.evidenceProvided = Array.from(new Set([...stage.evidenceProvided, ...stage.evidenceRequired.slice(0, 1)]));
      }
    }
  };
  if (status === 'approved') complete(['response', 'approval']);
  if (status === 'executing') {
    complete(['response', 'approval']);
    setActive(ticket, 'remediation');
  }
  if (status === 'monitoring') {
    complete(['response', 'approval', 'remediation', 'change-control']);
    setActive(ticket, 'verification');
  }
  if (status === 'resolved') {
    complete(['response', 'approval', 'remediation', 'change-control', 'verification', 'problem']);
    setActive(ticket, 'handoff');
  }
  if (status === 'closed') complete(ticket.kernel.lifecycle.map((item) => item.id));
}

function setActive(ticket: ServiceDeskTicket, id: string) {
  const stage = ticket.kernel.lifecycle.find((item) => item.id === id);
  if (!stage || stage.status === 'completed') return;
  stage.status = 'active';
  stage.startedAt = stage.startedAt ?? new Date().toISOString();
}

function activateNextStage(ticket: ServiceDeskTicket) {
  const next = ticket.kernel.lifecycle.find((stage) => stage.status === 'pending' || stage.status === 'breached');
  if (next) setActive(ticket, next.id);
}

function normalizeTicket(ticket: ServiceDeskTicket): ServiceDeskTicket {
  if (ticket.kernel && ticket.evidenceProvided) return ticket;
  const now = ticket.createdAt ?? new Date().toISOString();
  const evidenceRequired = ticket.evidenceRequired ?? buildEvidence(ticket.category, ticket.priority);
  return {
    ...ticket,
    status: ticket.status === 'resolved' ? 'resolved' : ticket.status,
    evidenceProvided: [
      evidenceItem('intake', 'intake summary', 'IntentAgent', 'satisfied', now),
      evidenceItem('triage', 'triage decision', 'PMOAgent', 'satisfied', now),
      evidenceItem('triage', 'owner assignment', 'PMOAgent', 'satisfied', now),
      evidenceItem('response', 'customer update', 'CustomerSuccessAgent', 'satisfied', now),
    ],
    kernel: buildKernel({
      category: ticket.category,
      priority: ticket.priority,
      now,
      tenantId: ticket.tenantId,
      system: ticket.system,
      customerName: inferCustomerName(ticket.requester, ticket.tenantId),
      requester: ticket.requester,
      affectedUsers: ticket.affectedUsers,
      compliance: [],
      evidenceRequired,
      evidenceProvided: ['intake summary', 'triage decision', 'owner assignment', 'customer update'],
    }),
    linkedArtifacts: [],
    trustRecordIds: [],
  };
}

function buildOperationsPack(ticket: ServiceDeskTicket) {
  return {
    ticketId: ticket.id,
    tenantId: ticket.tenantId,
    generatedAt: new Date().toISOString(),
    summary: {
      title: ticket.title,
      priority: ticket.priority,
      category: ticket.category,
      status: ticket.status,
      service: ticket.kernel.service,
      customer: ticket.kernel.customer,
      contract: ticket.kernel.contract,
    },
    sla: ticket.kernel.slaClock,
    cmdb: ticket.kernel.cmdb,
    serviceGraph: ticket.kernel.serviceGraph,
    lifecycle: ticket.kernel.lifecycle,
    changeControl: ticket.kernel.changeControl,
    remediation: ticket.kernel.remediation,
    release: ticket.kernel.release,
    problemManagement: ticket.kernel.problemManagement,
    financial: ticket.kernel.financial,
    qbr: ticket.kernel.qbr,
    evidencePack: ticket.kernel.evidencePack,
    integrations: ticket.kernel.integrations,
    automationSafety: ticket.kernel.automationSafety,
  };
}

function evidenceItem(stageId: string, evidence: string, verifiedBy: string, status: ServiceDeskTicket['evidenceProvided'][number]['status'], createdAt: string): ServiceDeskTicket['evidenceProvided'][number] {
  return {
    id: `se_${nanoid(10)}`,
    stageId,
    evidence,
    verifiedBy,
    status,
    createdAt,
  };
}

function evidenceCoverage(required: string[], provided: string[]) {
  if (required.length === 0) return 100;
  const covered = required.filter((item) => hasEvidence(provided, item)).length;
  return Math.round((covered / required.length) * 100);
}

function missingEvidence(required: string[], provided: string[]) {
  return required.filter((item) => !hasEvidence(provided, item));
}

function hasEvidence(provided: string[], required: string) {
  const target = required.toLowerCase();
  return provided.some((item) => {
    const value = item.toLowerCase();
    return value.includes(target) || target.includes(value);
  });
}

function scoreKernel(lifecycle: ServiceOperationsKernel['lifecycle'], required: string[], provided: string[], hasLedger: boolean, priority: ServiceRequestPriority) {
  const lifecycleScore = lifecycleCompletionFromStages(lifecycle) * 0.4;
  const evidenceScore = evidenceCoverage(required, provided) * 0.35;
  const ledgerScore = hasLedger ? 15 : 0;
  const priorityPenalty = priority === 'P0' ? 5 : priority === 'P1' ? 2 : 0;
  return Math.max(0, Math.min(100, Math.round(lifecycleScore + evidenceScore + ledgerScore + 10 - priorityPenalty)));
}

function lifecycleCompletion(ticket: ServiceDeskTicket) {
  return lifecycleCompletionFromStages(ticket.kernel.lifecycle);
}

function lifecycleCompletionFromStages(stages: ServiceOperationsKernel['lifecycle']) {
  if (stages.length === 0) return 100;
  return Math.round((stages.filter((stage) => stage.status === 'completed').length / stages.length) * 100);
}

function maturityFor(score: number): ServiceOperationsKernel['maturity'] {
  if (score >= 85) return 'enterprise-grade';
  if (score >= 65) return 'operational';
  if (score >= 40) return 'controlled';
  return 'intake-only';
}

function nextActionsFor(lifecycle: ServiceOperationsKernel['lifecycle'], required: string[], provided: string[], priority: ServiceRequestPriority) {
  const actions: string[] = [];
  const active = lifecycle.find((stage) => stage.status === 'active' || stage.status === 'blocked' || stage.status === 'breached');
  if (active) actions.push(`${active.name}: ${active.nextAction}`);
  const missing = missingEvidence(required, provided).slice(0, 3);
  if (missing.length) actions.push(`Attach evidence: ${missing.join(', ')}`);
  if (priority === 'P0') actions.push('Keep executive and customer updates on the incident cadence.');
  actions.push('Update problem prevention backlog before closure.');
  return Array.from(new Set(actions)).slice(0, 5);
}

function buildDashboardActions(active: ServiceDeskTicket[], gaps: string[]) {
  const actions: string[] = [];
  const p0 = active.filter((ticket) => ticket.priority === 'P0').length;
  if (p0) actions.push(`Run incident command for ${p0} P0 ticket(s).`);
  const breached = active.filter((ticket) => ticket.kernel.slaClock.state === 'breached').length;
  if (breached) actions.push(`Escalate ${breached} breached SLA ticket(s).`);
  if (gaps.length) actions.push(`Close evidence gaps: ${gaps.slice(0, 3).join(', ')}.`);
  if (!actions.length) actions.push('Keep lifecycle evidence and QBR notes current.');
  return actions;
}

function priorityRank(priority: ServiceRequestPriority) {
  return { P0: 4, P1: 3, P2: 2, P3: 1 }[priority];
}

function riskFromPriority(priority: ServiceRequestPriority): 'low' | 'medium' | 'high' | 'critical' {
  if (priority === 'P0') return 'critical';
  if (priority === 'P1') return 'high';
  if (priority === 'P2') return 'medium';
  return 'low';
}

function criticalityFor(priority: ServiceRequestPriority): ServiceCriticality {
  if (priority === 'P0') return 'mission-critical';
  if (priority === 'P1') return 'high';
  if (priority === 'P2') return 'medium';
  return 'low';
}

function ownerFor(category: ServiceRequestCategory) {
  const map: Record<ServiceRequestCategory, string> = {
    incident: 'SREAgent',
    access: 'SecurityAgent',
    change: 'SolutionArchitectAgent',
    deployment: 'ReleaseAgent',
    security: 'SecurityAgent',
    database: 'DatabaseArchitectAgent',
    procurement: 'BusinessAnalystAgent',
    support: 'DocumentationAgent',
    'product-build': 'EngineeringAgent',
  };
  return map[category];
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'service';
}

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function addDays(iso: string, days: number) {
  return new Date(new Date(iso).getTime() + days * 24 * 60 * 60_000).toISOString();
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function persist() {
  ticketStore.write(Array.from(tickets.values()));
}

export const serviceDesk = new ServiceDeskService();
