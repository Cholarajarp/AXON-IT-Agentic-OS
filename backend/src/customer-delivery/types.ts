export type DeliveryPricingModel = 'fixed-scope' | 'subscription' | 'usage-based' | 'enterprise-managed-service';
export type DeliveryProjectStatus = 'discovery' | 'approved' | 'executing' | 'verifying' | 'delivered' | 'operating';
export type DeliveryMilestoneStatus = 'planned' | 'in-progress' | 'complete' | 'blocked';
export type FeedbackPriority = 'P0' | 'P1' | 'P2' | 'P3';

export interface CustomerDeliveryInput {
  tenantId?: string;
  customerName?: string;
  industry?: string;
  projectName?: string;
  request: string;
  pricingModel?: DeliveryPricingModel;
  budgetUsd?: number;
  timelineDays?: number;
  supportPlan?: 'starter' | 'business' | 'enterprise';
  compliance?: string[];
  targetUsers?: string[];
  integrations?: string[];
}

export interface CustomerAccount {
  id: string;
  tenantId: string;
  customerName: string;
  industry: string;
  health: 'green' | 'amber' | 'red';
  supportPlan: 'starter' | 'business' | 'enterprise';
  projects: CustomerProject[];
  commercialSummary: {
    annualContractValueUsd: number;
    projectedGrossMarginPercent: number;
    modelCostUsd: number;
    cloudCostUsd: number;
    humanReviewCostUsd: number;
    supportCostUsd: number;
  };
  renewalSignals: Array<{
    signal: string;
    level: 'positive' | 'watch' | 'risk';
    action: string;
  }>;
  createdAt: string;
}

export interface CustomerProject {
  id: string;
  name: string;
  request: string;
  pricingModel: DeliveryPricingModel;
  status: DeliveryProjectStatus;
  statementOfWork: {
    objective: string;
    scope: string[];
    outOfScope: string[];
    assumptions: string[];
    acceptanceCriteria: string[];
  };
  milestones: Array<{
    id: string;
    name: string;
    status: DeliveryMilestoneStatus;
    dueDay: number;
    ownerAgent: string;
    deliverables: string[];
    exitCriteria: string[];
  }>;
  sla: {
    responseMinutes: number;
    resolutionHours: number;
    coverage: '8x5' | '16x5' | '24x7';
    escalation: string[];
  };
  marginModel: {
    revenueUsd: number;
    deliveryCostUsd: number;
    modelCostUsd: number;
    cloudCostUsd: number;
    supportCostUsd: number;
    grossMarginPercent: number;
  };
  deliveryReport: DeliveryReport;
  feedbackBacklog: FeedbackBacklogItem[];
}

export interface DeliveryReport {
  id: string;
  status: 'draft' | 'ready-for-customer' | 'sent';
  executiveSummary: string;
  completedWork: string[];
  verificationEvidence: string[];
  deployLinks: Array<{ label: string; url: string; environment: 'preview' | 'staging' | 'production' }>;
  riskRegister: Array<{ risk: string; level: 'low' | 'medium' | 'high' | 'critical'; mitigation: string }>;
  nextRecommendations: string[];
  customerMessage: string;
  generatedAt: string;
}

export interface FeedbackBacklogItem {
  id: string;
  source: 'customer-feedback' | 'support-ticket' | 'incident' | 'usage-analytics' | 'delivery-review';
  priority: FeedbackPriority;
  title: string;
  description: string;
  ownerAgent: string;
  acceptanceCriteria: string[];
  revenueImpactUsd: number;
}
