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
