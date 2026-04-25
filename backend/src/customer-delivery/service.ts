import { nanoid } from 'nanoid';
import type {
  CustomerAccount,
  CustomerDeliveryInput,
  CustomerProject,
  DeliveryPricingModel,
  DeliveryReport,
  FeedbackBacklogItem,
} from './types.js';

const accounts = new Map<string, CustomerAccount>();

export class CustomerDeliveryService {
  listAccounts(): CustomerAccount[] {
    return Array.from(accounts.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getAccount(id: string): CustomerAccount | undefined {
    return accounts.get(id);
  }

  createAccount(input: CustomerDeliveryInput): CustomerAccount {
    const now = new Date().toISOString();
    const pricingModel = input.pricingModel ?? inferPricingModel(input.request);
    const budget = input.budgetUsd ?? inferBudget(input.request, pricingModel);
    const timelineDays = input.timelineDays ?? inferTimeline(input.request);
    const supportPlan = input.supportPlan ?? inferSupportPlan(input.request);
    const project = buildProject(input, pricingModel, budget, timelineDays, supportPlan);

    const account: CustomerAccount = {
      id: `cust_${nanoid(10)}`,
      tenantId: input.tenantId ?? 'tenant_default',
      customerName: input.customerName?.trim() || inferCustomerName(input.request),
      industry: input.industry?.trim() || inferIndustry(input.request),
      health: project.marginModel.grossMarginPercent >= 42 ? 'green' : project.marginModel.grossMarginPercent >= 28 ? 'amber' : 'red',
      supportPlan,
      projects: [project],
      commercialSummary: {
        annualContractValueUsd: annualizeRevenue(project.marginModel.revenueUsd, pricingModel),
        projectedGrossMarginPercent: project.marginModel.grossMarginPercent,
        modelCostUsd: project.marginModel.modelCostUsd,
        cloudCostUsd: project.marginModel.cloudCostUsd,
        humanReviewCostUsd: Math.round(project.marginModel.deliveryCostUsd * 0.22),
        supportCostUsd: project.marginModel.supportCostUsd,
      },
      renewalSignals: buildRenewalSignals(project),
      createdAt: now,
    };

    accounts.set(account.id, account);
    return account;
  }

  generateReport(accountId: string, projectId: string): DeliveryReport | undefined {
    const account = accounts.get(accountId);
    const project = account?.projects.find((item) => item.id === projectId);
    if (!project) return undefined;

    project.status = 'delivered';
    project.deliveryReport = {
      ...project.deliveryReport,
      status: 'ready-for-customer',
      generatedAt: new Date().toISOString(),
      executiveSummary: `${project.name} is packaged for customer delivery with scope, verification evidence, risks, costs, and next recommendations tied to the original request.`,
    };

    return project.deliveryReport;
  }
}

function buildProject(
  input: CustomerDeliveryInput,
  pricingModel: DeliveryPricingModel,
  budget: number,
  timelineDays: number,
  supportPlan: CustomerAccount['supportPlan'],
): CustomerProject {
  const request = input.request.trim();
  const projectName = input.projectName?.trim() || titleFromRequest(request);
  const regulated = /soc|iso|pci|hipaa|bank|finance|health|government|rbi|sebi/i.test(`${request} ${(input.compliance ?? []).join(' ')}`);
  const users = input.targetUsers?.length ? input.targetUsers : inferUsers(request);
  const integrations = input.integrations?.length ? input.integrations : inferIntegrations(request);
  const marginModel = buildMarginModel(budget, pricingModel, supportPlan, regulated);

  const project: CustomerProject = {
    id: `proj_${nanoid(10)}`,
    name: projectName,
    request,
    pricingModel,
    status: 'approved',
    statementOfWork: {
      objective: `Deliver ${projectName} for ${users.join(', ')} with measurable business acceptance and production support readiness.`,
      scope: [
        'requirements clarification and delivery blueprint',
        'secure product or service implementation plan',
        'database, security, QA, deployment, and operations gates',
        'customer-facing delivery report with evidence',
        'feedback-to-backlog loop after delivery',
        ...integrations.map((integration) => `${integration} integration plan`),
      ],
      outOfScope: [
        'unapproved production changes',
        'unbounded custom work outside SOW acceptance criteria',
        'customer credential custody without secrets-manager integration',
      ],
      assumptions: [
        regulated ? 'regulated delivery requires security and compliance evidence before launch' : 'baseline SOC 2-style controls are expected',
        'customer will approve scope before execution begins',
        'AXON agents can use configured model providers and connectors only within tenant policy',
      ],
      acceptanceCriteria: [
        'all milestones have evidence and accountable owner agents',
        'security/database/release gates pass or document accepted risk',
        'delivery report includes completed scope, verification, risks, deploy links, and recommendations',
        'support SLA and escalation are visible to customer and operators',
      ],
    },
    milestones: buildMilestones(timelineDays, regulated),
    sla: buildSla(supportPlan, regulated),
    marginModel,
    deliveryReport: buildDeliveryReport(projectName, request, regulated),
    feedbackBacklog: buildFeedbackBacklog(projectName, request, budget),
  };

  return project;
}

function buildMilestones(timelineDays: number, regulated: boolean): CustomerProject['milestones'] {
  const slice = Math.max(3, Math.round(timelineDays / 5));
  return [
    {
      id: `ms_${nanoid(8)}`,
      name: 'Discovery and SOW lock',
      status: 'complete',
      dueDay: slice,
      ownerAgent: 'CustomerSuccessAgent',
      deliverables: ['statement of work', 'acceptance criteria', 'risk assumptions'],
      exitCriteria: ['customer promise is explicit', 'scope and non-goals accepted'],
    },
    {
      id: `ms_${nanoid(8)}`,
      name: 'Architecture and delivery plan',
      status: 'in-progress',
      dueDay: slice * 2,
      ownerAgent: 'SolutionArchitectAgent',
      deliverables: ['architecture plan', 'data model', 'threat model', 'execution backlog'],
      exitCriteria: ['policy gates mapped', 'cost and timeline accepted'],
    },
    {
      id: `ms_${nanoid(8)}`,
      name: 'Build and verification',
      status: 'planned',
      dueDay: slice * 4,
      ownerAgent: 'EngineeringAgent',
      deliverables: ['implementation evidence', 'test logs', 'preview link', 'database review'],
      exitCriteria: ['typecheck/lint/tests pass', 'preview smoke verified'],
    },
    {
      id: `ms_${nanoid(8)}`,
      name: regulated ? 'Compliance release gate' : 'Release readiness gate',
      status: 'planned',
      dueDay: slice * 5,
      ownerAgent: regulated ? 'ComplianceAgent' : 'ReleaseAgent',
      deliverables: ['security scan', 'rollback plan', 'runbook', 'delivery report'],
      exitCriteria: ['customer report ready', 'support SLA activated'],
    },
  ];
}

function buildSla(supportPlan: CustomerAccount['supportPlan'], regulated: boolean): CustomerProject['sla'] {
  if (supportPlan === 'enterprise') {
    return {
      responseMinutes: regulated ? 5 : 15,
      resolutionHours: regulated ? 4 : 8,
      coverage: '24x7',
      escalation: ['Customer success lead', 'SRE lead', 'Security lead', 'Executive sponsor'],
    };
  }
  if (supportPlan === 'business') {
    return {
      responseMinutes: 60,
      resolutionHours: 24,
      coverage: '16x5',
      escalation: ['Customer success lead', 'Service owner'],
    };
  }
  return {
    responseMinutes: 240,
    resolutionHours: 72,
    coverage: '8x5',
    escalation: ['Support queue owner'],
  };
}

function buildMarginModel(
  budget: number,
  pricingModel: DeliveryPricingModel,
  supportPlan: CustomerAccount['supportPlan'],
  regulated: boolean,
): CustomerProject['marginModel'] {
  const deliveryMultiplier = pricingModel === 'enterprise-managed-service' ? 0.42 : pricingModel === 'subscription' ? 0.34 : 0.48;
  const modelCost = Math.round(budget * (regulated ? 0.08 : 0.05));
  const cloudCost = Math.round(budget * 0.07);
  const supportCost = Math.round(budget * (supportPlan === 'enterprise' ? 0.16 : supportPlan === 'business' ? 0.1 : 0.06));
  const deliveryCost = Math.round(budget * deliveryMultiplier);
  const totalCost = deliveryCost + modelCost + cloudCost + supportCost;
  return {
    revenueUsd: budget,
    deliveryCostUsd: deliveryCost,
    modelCostUsd: modelCost,
    cloudCostUsd: cloudCost,
    supportCostUsd: supportCost,
    grossMarginPercent: Math.max(0, Math.round(((budget - totalCost) / budget) * 100)),
  };
}

function buildDeliveryReport(projectName: string, request: string, regulated: boolean): DeliveryReport {
  return {
    id: `report_${nanoid(10)}`,
    status: 'draft',
    executiveSummary: `${projectName} has an initial customer delivery package generated from the request.`,
    completedWork: [
      'customer request translated into delivery scope',
      'SOW, milestones, SLA, and commercial model generated',
      'verification and evidence plan attached',
    ],
    verificationEvidence: [
      'requirements-to-acceptance trace',
      'security center scan required before release',
      'database pipeline review required for stateful changes',
      'checkpoint and rollback preview required before production action',
    ],
    deployLinks: [],
    riskRegister: [
      {
        risk: 'Scope drift can reduce delivery speed and margin.',
        level: 'medium',
        mitigation: 'Route new asks through feedback backlog and change approval.',
      },
      {
        risk: regulated ? 'Compliance evidence may block launch.' : 'Security evidence may be incomplete before launch.',
        level: regulated ? 'high' : 'medium',
        mitigation: 'Run security, database, checkpoint, and release gates before customer acceptance.',
      },
    ],
    nextRecommendations: [
      'approve SOW and milestone plan',
      'connect repository, cloud, issue tracker, and model providers',
      'publish real preview and staging URLs after deployment adapters complete',
      'run Build Studio blueprint and attach verification artifacts',
      'schedule customer delivery review and feedback capture',
    ],
    customerMessage: `AXON converted your request into a delivery-ready package: "${request.slice(0, 160)}${request.length > 160 ? '...' : ''}"`,
    generatedAt: new Date().toISOString(),
  };
}

function buildFeedbackBacklog(projectName: string, request: string, budget: number): FeedbackBacklogItem[] {
  return [
    {
      id: `fb_${nanoid(8)}`,
      source: 'delivery-review',
      priority: 'P1',
      title: `Confirm ${projectName} success metrics`,
      description: 'Capture customer acceptance signals, analytics needs, and reporting cadence before build completion.',
      ownerAgent: 'CustomerSuccessAgent',
      acceptanceCriteria: ['north-star metric recorded', 'customer owner assigned', 'reporting cadence accepted'],
      revenueImpactUsd: Math.round(budget * 0.08),
    },
    {
      id: `fb_${nanoid(8)}`,
      source: /incident|support|sla|operate/i.test(request) ? 'support-ticket' : 'customer-feedback',
      priority: 'P2',
      title: 'Convert post-delivery feedback into next release backlog',
      description: 'Turn customer comments, incidents, and usage signals into priced backlog items.',
      ownerAgent: 'ProductStrategistAgent',
      acceptanceCriteria: ['feedback source linked', 'priority assigned', 'estimated revenue or retention impact recorded'],
      revenueImpactUsd: Math.round(budget * 0.05),
    },
  ];
}

function buildRenewalSignals(project: CustomerProject): CustomerAccount['renewalSignals'] {
  return [
    {
      signal: project.marginModel.grossMarginPercent >= 35 ? 'Healthy projected margin' : 'Margin needs scope or automation control',
      level: project.marginModel.grossMarginPercent >= 35 ? 'positive' : 'watch',
      action: project.marginModel.grossMarginPercent >= 35 ? 'Package as repeatable service template.' : 'Increase automation and tighten change control.',
    },
    {
      signal: `${project.feedbackBacklog.length} feedback item(s) ready for next backlog`,
      level: 'positive',
      action: 'Review with customer after first delivery milestone.',
    },
    {
      signal: `${project.sla.coverage} support coverage committed`,
      level: project.sla.coverage === '24x7' ? 'positive' : 'watch',
      action: 'Align support plan with production criticality.',
    },
  ];
}

function inferPricingModel(request: string): DeliveryPricingModel {
  if (/managed|24x7|operate|sla|support|run/i.test(request)) return 'enterprise-managed-service';
  if (/monthly|subscription|retainer/i.test(request)) return 'subscription';
  if (/usage|per ticket|per workflow|automation/i.test(request)) return 'usage-based';
  return 'fixed-scope';
}

function inferBudget(request: string, pricingModel: DeliveryPricingModel) {
  const match = request.match(/\$?(\d[\d,]*)\s*(k|m|million|thousand)?/i);
  if (match) {
    const raw = Number(match[1].replace(/,/g, ''));
    const suffix = match[2]?.toLowerCase();
    if (suffix === 'm' || suffix === 'million') return raw * 1000000;
    if (suffix === 'k' || suffix === 'thousand') return raw * 1000;
    return raw;
  }
  if (pricingModel === 'enterprise-managed-service') return 750000;
  if (pricingModel === 'subscription') return 180000;
  if (pricingModel === 'usage-based') return 120000;
  return 250000;
}

function inferTimeline(request: string) {
  const match = request.match(/(\d+)\s*(days|weeks|months)/i);
  if (!match) return /mvp|urgent|fast|quick/i.test(request) ? 30 : 90;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('month')) return value * 30;
  if (unit.startsWith('week')) return value * 7;
  return value;
}

function inferSupportPlan(request: string): CustomerAccount['supportPlan'] {
  if (/enterprise|24x7|critical|regulated|bank|health|government/i.test(request)) return 'enterprise';
  if (/business|staging|team|department/i.test(request)) return 'business';
  return 'starter';
}

function inferCustomerName(request: string) {
  const match = request.match(/for\s+([A-Z][A-Za-z0-9&.\-\s]{2,40})(?:\s+to|\s+with|\s+that|,|$)/);
  return match?.[1].trim() || 'AXON Customer';
}

function inferIndustry(request: string) {
  if (/bank|finance|payment|insurance/i.test(request)) return 'Financial services';
  if (/health|patient|hospital|clinic/i.test(request)) return 'Healthcare';
  if (/retail|commerce|shop/i.test(request)) return 'Retail';
  if (/government|public sector/i.test(request)) return 'Public sector';
  if (/education|school|university/i.test(request)) return 'Education';
  return 'Technology';
}

function inferUsers(request: string) {
  const users = new Set<string>();
  if (/admin|operator/i.test(request)) users.add('operators');
  if (/customer|client|buyer/i.test(request)) users.add('customers');
  if (/developer|engineer/i.test(request)) users.add('engineering teams');
  if (/executive|manager|lead/i.test(request)) users.add('leaders');
  return users.size ? Array.from(users) : ['business users', 'operators'];
}

function inferIntegrations(request: string) {
  const integrations = ['GitHub', 'Slack', 'Jira', 'ServiceNow', 'Datadog', 'PostgreSQL', 'AWS', 'Azure', 'GCP'];
  return integrations.filter((item) => new RegExp(item, 'i').test(request));
}

function titleFromRequest(request: string) {
  const clean = request.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Customer Delivery Project';
  return clean.length > 64 ? `${clean.slice(0, 61)}...` : clean;
}

function annualizeRevenue(revenue: number, pricingModel: DeliveryPricingModel) {
  if (pricingModel === 'subscription' || pricingModel === 'enterprise-managed-service') return revenue * 12;
  return revenue;
}

export const customerDelivery = new CustomerDeliveryService();
