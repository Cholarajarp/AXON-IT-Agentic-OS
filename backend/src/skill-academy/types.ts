export type SkillDomain =
  | 'product'
  | 'architecture'
  | 'frontend'
  | 'backend'
  | 'database'
  | 'devops'
  | 'security'
  | 'sre'
  | 'qa'
  | 'data-ai'
  | 'finops'
  | 'customer-success';

export type LearningSourceType = 'github' | 'documentation' | 'standard' | 'course' | 'internal-runbook';
export type ProficiencyLevel = 1 | 2 | 3 | 4 | 5;

export interface LearningSourceInput {
  title?: string;
  url: string;
  type?: LearningSourceType;
  domains?: SkillDomain[];
  trust?: 'community' | 'vendor' | 'standard' | 'internal';
}

export interface LearningSource {
  id: string;
  title: string;
  url: string;
  type: LearningSourceType;
  trust: 'community' | 'vendor' | 'standard' | 'internal';
  domains: SkillDomain[];
  topics: string[];
  refreshCadenceDays: number;
  lastReviewedAt: string;
}

export interface RoleSkillProfile {
  role: string;
  mission: string;
  domains: SkillDomain[];
  requiredSkills: Array<{
    name: string;
    domain: SkillDomain;
    targetLevel: ProficiencyLevel;
    evidence: string[];
  }>;
  tools: string[];
  handoffs: string[];
}

export interface TeamSkillPlanInput {
  tenantId?: string;
  objective: string;
  teamSize?: number;
  budgetUsdPerMonth?: number;
  deliveryMode?: 'build' | 'operate' | 'modernize' | 'managed-service';
  currentMaturity?: 'starter' | 'growing' | 'enterprise';
  sources?: LearningSourceInput[];
}

export interface TeamSkillPlan {
  id: string;
  tenantId: string;
  objective: string;
  deliveryMode: 'build' | 'operate' | 'modernize' | 'managed-service';
  targetTeamSize: number;
  skillCoverageScore: number;
  monthlyCostUsd: number;
  projectedProductivityLiftPercent: number;
  roles: RoleSkillProfile[];
  squads: Array<{
    name: string;
    mission: string;
    roles: string[];
    workflow: string[];
    successMetrics: string[];
  }>;
  learningBacklog: Array<{
    id: string;
    skill: string;
    domain: SkillDomain;
    priority: 'P0' | 'P1' | 'P2';
    reason: string;
    sources: string[];
    practiceTask: string;
    validationEvidence: string[];
  }>;
  governance: Array<{
    ceremony: string;
    cadence: string;
    outputs: string[];
  }>;
  costControls: Array<{
    control: string;
    owner: string;
    expectedImpact: string;
  }>;
  sources: LearningSource[];
  createdAt: string;
}
