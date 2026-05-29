export type ReferenceSourceId =
  | 'cloud-coding-agent'
  | 'agent-safety-reference'
  | 'terminal-agent-reference'
  | 'browser-app-builder'
  | 'deployment-monitoring-reference'
  | 'full-stack-builder'
  | 'visual-builder'
  | 'background-agent'
  | 'async-engineering-agent'
  | 'multi-agent-framework'
  | 'agent-interoperability'
  | 'context-cache-reference'
  | 'general-autonomy-reference'
  | 'software-engineer-agent';
export type CapabilityArea = 'sandbox' | 'agent-runtime' | 'browser-qa' | 'deployment' | 'governance' | 'security' | 'marketplace' | 'ux' | 'memory' | 'finops' | 'evidence';
export type BuildPackUrgency = 'P0' | 'P1' | 'P2' | 'P3';
export type BuildPackStatus = 'recommended' | 'ready-for-mission-control' | 'planned';

export interface MarketRadarInput {
  focus?: string;
  tenantId?: string;
  targetUser?: string;
  includeMoonshots?: boolean;
  observedSignals?: Array<{
    source: string;
    capability: string;
    sourceUrl?: string;
  }>;
}

export interface MarketSignal {
  id: string;
  source: ReferenceSourceId | string;
  sourceUrl: string;
  observedCapability: string;
  strategicIntent: string;
  axonResponse: string;
  areas: CapabilityArea[];
  confidence: number;
  freshness: 'today' | 'recent' | 'evergreen';
}

export interface CapabilityGap {
  id: string;
  title: string;
  area: CapabilityArea;
  urgency: BuildPackUrgency;
  sourcePatterns: string[];
  userBenefit: string;
  currentAxonProof: string[];
  missing: string[];
  buildPackId: string;
}

export interface MarketBuildPack {
  id: string;
  name: string;
  status: BuildPackStatus;
  urgency: BuildPackUrgency;
  whyNow: string;
  userBenefit: string;
  moat: string;
  modules: string[];
  ownerAgents: string[];
  features: string[];
  acceptanceCriteria: string[];
  evidence: string[];
  missionPrompt: string;
  impactScore: number;
}

export interface MarketRadarReport {
  id: string;
  tenantId: string;
  focus: string;
  targetUser: string;
  generatedAt: string;
  marketThesis: string;
  summary: string;
  moatScore: number;
  signals: MarketSignal[];
  gaps: CapabilityGap[];
  buildPacks: MarketBuildPack[];
  recommendedSequence: Array<{
    order: number;
    buildPackId: string;
    rationale: string;
  }>;
  referenceCoverage: Array<{
    source: string;
    signals: number;
    axonResponse: string;
  }>;
}

export interface MarketRadarLaunch {
  reportId: string;
  buildPackId: string;
  missionControlRunId: string;
  releaseMissionId: string;
  status: string;
  score: number;
}

export type CompetitorCategory =
  | 'itsm-ai'
  | 'software-agent'
  | 'agent-platform'
  | 'governance'
  | 'observability';

export interface CompetitorProfile {
  id: string;
  name: string;
  category: CompetitorCategory;
  currentEdge: string;
  weakSpot: string;
  axonCounter: string;
  sourceUrl: string;
}

export interface CompetitiveCapability {
  id: string;
  title: string;
  area: CapabilityArea;
  marketBar: string;
  competitorLeaders: string[];
  axonProof: string[];
  score: number;
  targetScore: number;
  gap: string;
  nextMove: string;
  route: string;
}

export interface MoatLane {
  id: string;
  title: string;
  winCondition: string;
  proof: string[];
  ownerModules: string[];
  riskIfIgnored: string;
  score: number;
}

export interface CompetitiveBenchmarkReport {
  id: string;
  generatedAt: string;
  thesis: string;
  sourceWindow: string;
  overallScore: number;
  competitors: CompetitorProfile[];
  capabilities: CompetitiveCapability[];
  moatLanes: MoatLane[];
  topMoves: Array<{
    order: number;
    capabilityId: string;
    move: string;
    expectedLift: number;
  }>;
  sourceNotes: string[];
}

export interface MoatActivationRun {
  id: string;
  reportId: string;
  generatedAt: string;
  status: 'created' | 'in-progress';
  progress: {
    score: number;
    completedGates: number;
    totalGates: number;
  };
  summary: string;
  tactic: string;
  stageGates: Array<{
    id: string;
    title: string;
    ownerAgent: string;
    status: 'pass' | 'warn' | 'block' | 'pending';
    score: number;
    evidence: string[];
    nextAction: string;
  }>;
  proofArtifacts: Array<{
    id: string;
    name: string;
    kind: string;
    uri: string;
    sha256: string;
    source: string;
  }>;
  riskRegister: Array<{
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    mitigation: string;
    ownerAgent: string;
  }>;
  missionControlRuns: Array<{
    capabilityId: string;
    capabilityTitle: string;
    missionControlRunId: string;
    releaseMissionId: string;
    status: string;
    score: number;
    proof: string[];
  }>;
  nextReviewAt: string;
}
