export type WorkflowState =
  | 'RUNNING'
  | 'COMPLETE'
  | 'FAILED'
  | 'PENDING'
  | 'AWAITING_APPROVAL'
  | 'BLOCKED'
  | 'CANCELLED';

export interface Workflow {
  id: string;
  name: string;
  goal: string;
  state: WorkflowState;
  step: string;
  agent: string;
  progress: number;
  startedAt: number;
  cost: number;
  budget: number;
  domain: string[];
  modelRoute?: ModelRoute;
  agentFlow?: string;
  repositoryUrl?: string;
}

export type AgentState = 'IDLE' | 'RUNNING' | 'ERROR';

export interface AgentInstance {
  id: string;
  type: string;
  version: string;
  state: AgentState;
  currentTask?: string;
  tokensUsed: number;
  confidence: number;
  completion: number;
  updatedAt: number;
}

export type BlastRadius = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Approval {
  id: string;
  title: string;
  workflowId: string;
  agentId: string;
  riskScore: number;
  blastRadius: BlastRadius;
  reversible: boolean;
  expiresAt: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  status: ApprovalStatus;
}

export type Severity = 'P0' | 'P1' | 'P2' | 'P3';

export interface Alert {
  id: string;
  severity: Severity;
  title: string;
  source: string;
  createdAt: number;
}

export type IncidentState = 'ACTIVE' | 'REMEDIATING' | 'RESOLVED' | 'POST_MORTEM';

export interface Incident {
  id: string;
  severity: Severity;
  title: string;
  affected: string[];
  state: IncidentState;
  startedAt: number;
  resolvedAt?: number;
}

export type PolicyType = 'Tool' | 'Data' | 'Approval' | 'Model' | 'Cost' | 'Environment';
export type PolicyStatus = 'ACTIVE' | 'DRAFT' | 'DEPRECATED';

export interface Policy {
  id: string;
  name: string;
  type: PolicyType;
  scope: string;
  version: string;
  status: PolicyStatus;
  updatedAt: number;
  violations7d: number;
}

export type EvidenceStatus = 'SATISFIED' | 'PARTIAL' | 'MISSING';

export interface Evidence {
  id: string;
  controlId: string;
  framework: string;
  description: string;
  status: EvidenceStatus;
  workflowId?: string;
  agentId?: string;
  generatedAt: number;
}

export interface CostSummary {
  totalSpend: number;
  avgPerWorkflow: number;
  mostExpensive: string;
  topModel: string;
  dailySpend: DailySpend[];
  domainBreakdown: DomainCost[];
  modelBreakdown: ModelCost[];
}

export interface DailySpend {
  date: string;
  anthropic: number;
  openai: number;
  gemini: number;
  local: number;
}

export interface DomainCost {
  domain: string;
  spend: number;
  color: string;
}

export interface ModelCost {
  model: string;
  tokens: number;
  cost: number;
}

export interface ExecutiveMetrics {
  featuresDelivered: number;
  costVsBaseline: number;
  complianceScore: number;
  autoResolved: number;
  weeklyVelocity: WeeklyVelocity[];
  risks: Risk[];
  insight: ExecutiveInsight;
}

export interface WeeklyVelocity {
  week: string;
  features: number;
  automated: number;
}

export interface Risk {
  id: string;
  title: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL';
  owner: string;
  status: string;
}

export interface ExecutiveInsight {
  headline: string;
  summary: string;
  wins: string[];
  attention: string[];
  signals: Array<{ label: string; value: string; tone: 'success' | 'warning' | 'critical' | 'neutral' }>;
}

export interface MemoryRecord {
  id: string;
  type: 'semantic' | 'episodic' | 'procedural';
  content: string;
  source: string;
  confidence: number;
  tags: string[];
  accessCount: number;
  lastAccessed: number;
  relatedWorkflows: string[];
  createdAt: number;
}

export interface ModelRoute {
  provider: 'anthropic' | 'openai' | 'google' | 'bedrock' | 'vertexai' | 'ollama' | 'local';
  model: string;
  mode: 'quality' | 'balanced' | 'fast' | 'sovereign';
  maxCostUsd: number;
  requiresApproval: boolean;
}

export interface SubmitGoalInput {
  name: string;
  goal: string;
  domain: string;
  modelRoute: ModelRoute;
  agentFlow: string;
  repositoryUrl?: string;
}
