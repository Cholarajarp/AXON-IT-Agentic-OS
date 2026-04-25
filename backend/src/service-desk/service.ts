import { nanoid } from 'nanoid';
import type {
  ServiceDeskInput,
  ServiceDeskTicket,
  ServiceRequestCategory,
  ServiceRequestPriority,
} from './types.js';

const tickets = new Map<string, ServiceDeskTicket>();

export class ServiceDeskService {
  createTicket(input: ServiceDeskInput): ServiceDeskTicket {
    const category = classify(input.request);
    const priority = prioritize(input, category);
    const now = new Date().toISOString();
    const ticket: ServiceDeskTicket = {
      id: `it_${nanoid(10)}`,
      tenantId: input.tenantId ?? 'tenant_default',
      requester: input.requester?.trim() || 'Requester',
      title: input.title?.trim() || titleFromRequest(input.request, category),
      request: input.request,
      category,
      priority,
      status: 'triaged',
      system: input.system?.trim() || inferSystem(input.request),
      affectedUsers: input.affectedUsers ?? inferAffectedUsers(priority),
      sla: buildSla(priority),
      assignedAgents: assignAgents(category, priority),
      approvalRequired: requiresApproval(category, priority),
      approvals: buildApprovals(category, priority, input.compliance ?? []),
      runbook: buildRunbook(category, priority),
      customerUpdates: buildCustomerUpdates(category, priority, input.requester ?? 'Requester'),
      risks: buildRisks(category, priority),
      evidenceRequired: buildEvidence(category, priority),
      automationPlan: buildAutomationPlan(category, priority),
      createdAt: now,
      updatedAt: now,
    };

    tickets.set(ticket.id, ticket);
    return ticket;
  }

  listTickets(): ServiceDeskTicket[] {
    return Array.from(tickets.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getTicket(id: string): ServiceDeskTicket | undefined {
    return tickets.get(id);
  }

  updateStatus(id: string, status: ServiceDeskTicket['status']): ServiceDeskTicket | undefined {
    const ticket = tickets.get(id);
    if (!ticket) return undefined;
    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    return ticket;
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
      message: `Hi ${requester}, AXON triaged your ${category} request as ${priority}. We assigned the right agents, SLA, approvals, and evidence gates.`,
    },
    {
      audience: 'stakeholders',
      message: `Stakeholders will receive updates when triage, approval, execution, and verification milestones complete.`,
    },
    {
      audience: 'executive',
      message: priority === 'P0' ? 'Executive update required: P0 impact is being managed with incident command and rollback-ready remediation.' : 'No executive escalation required yet.',
    },
  ];
}

function buildRisks(category: ServiceRequestCategory, priority: ServiceRequestPriority): ServiceDeskTicket['risks'] {
  const risks: ServiceDeskTicket['risks'] = [
    { level: priority === 'P0' ? 'critical' : priority === 'P1' ? 'high' : 'medium', description: 'Scope or impact may be incomplete at intake.', mitigation: 'Confirm affected systems, users, and success criteria before execution.' },
  ];
  if (category === 'database') risks.push({ level: 'high', description: 'Stateful change can cause data loss or downtime.', mitigation: 'Require backup, rollback, and Database Pipeline review.' });
  if (category === 'security') risks.push({ level: 'high', description: 'Security issue may expose data or credentials.', mitigation: 'Run Security Center and rotate exposed credentials if found.' });
  return risks;
}

function buildEvidence(category: ServiceRequestCategory, priority: ServiceRequestPriority) {
  const evidence = ['intake summary', 'triage decision', 'owner assignment', 'customer update'];
  if (priority === 'P0' || priority === 'P1') evidence.push('timeline', 'approval record', 'verification proof');
  if (category === 'database') evidence.push('database safety report', 'backup checkpoint', 'quality gates');
  if (category === 'security') evidence.push('security scan report', 'remediation proof');
  if (category === 'deployment') evidence.push('build logs', 'smoke test', 'rollback plan');
  return evidence;
}

function buildAutomationPlan(category: ServiceRequestCategory, priority: ServiceRequestPriority) {
  return `AXON will route this ${category} request through ${priority} SLA gates, require approvals where needed, create a checkpoint before risky action, execute with assigned agents, and attach evidence before resolution.`;
}

export const serviceDesk = new ServiceDeskService();
