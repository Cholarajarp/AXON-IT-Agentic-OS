export type ServiceRequestCategory =
  | 'incident'
  | 'access'
  | 'change'
  | 'deployment'
  | 'security'
  | 'database'
  | 'procurement'
  | 'support'
  | 'product-build';

export type ServiceRequestPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type ServiceRequestStatus = 'intake' | 'triaged' | 'approved' | 'executing' | 'resolved';

export interface ServiceDeskInput {
  requester?: string;
  tenantId?: string;
  title?: string;
  request: string;
  affectedUsers?: number;
  system?: string;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  compliance?: string[];
}

export interface ServiceDeskTicket {
  id: string;
  tenantId: string;
  requester: string;
  title: string;
  request: string;
  category: ServiceRequestCategory;
  priority: ServiceRequestPriority;
  status: ServiceRequestStatus;
  system: string;
  affectedUsers: number;
  sla: {
    responseMinutes: number;
    resolutionHours: number;
    escalation: string[];
  };
  assignedAgents: string[];
  approvalRequired: boolean;
  approvals: Array<{
    approver: string;
    reason: string;
  }>;
  runbook: Array<{
    step: number;
    ownerAgent: string;
    action: string;
    evidence: string[];
  }>;
  customerUpdates: Array<{
    audience: 'requester' | 'stakeholders' | 'executive';
    message: string;
  }>;
  risks: Array<{
    level: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    mitigation: string;
  }>;
  evidenceRequired: string[];
  automationPlan: string;
  createdAt: string;
  updatedAt: string;
}
