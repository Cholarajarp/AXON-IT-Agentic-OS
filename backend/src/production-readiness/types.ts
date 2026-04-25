export type ProductionCapabilityStatus = 'active' | 'partial' | 'inactive';
export type ProductionLevel = 'prototype' | 'pilot' | 'production-loop' | 'production-blocked';
export type ProductionReadinessStatus = 'blocked' | 'pilot-ready' | 'production-loop-ready';

export interface ProductionReadinessInput {
  tenantId?: string;
  mission?: string;
  environment?: 'preview' | 'staging' | 'production';
  regulated?: boolean;
  customerName?: string;
}

export interface ProductionCapability {
  id: string;
  name: string;
  category: 'intake' | 'agentic' | 'engineering' | 'data' | 'security' | 'release' | 'customer' | 'governance' | 'ops';
  status: ProductionCapabilityStatus;
  level: ProductionLevel;
  ownerAgent: string;
  routeOrSurface: string;
  productionUse: string;
  evidence: string[];
  gaps: string[];
  activationAction: string;
}

export interface ProductionServiceOffer {
  id: string;
  name: string;
  ready: boolean;
  priceModel: 'fixed-scope' | 'subscription' | 'usage-based' | 'enterprise-managed-service';
  includedCapabilities: string[];
  requiredEvidence: string[];
  blockers: string[];
}

export interface ProductionReadinessReport {
  id: string;
  tenantId: string;
  generatedAt: string;
  mission: string;
  status: ProductionReadinessStatus;
  score: number;
  summary: string;
  capabilities: ProductionCapability[];
  serviceOffers: ProductionServiceOffer[];
  blockers: string[];
  nextActions: string[];
  runtime: {
    status: string;
    score: number;
    productionReady: boolean;
    blockers: string[];
  };
  activationFlow: Array<{ order: number; stage: string; service: string; evidence: string[] }>;
}

export interface ProductionActivationResult {
  id: string;
  tenantId: string;
  missionControlRunId: string;
  releaseMissionId: string;
  activatedCapabilityIds: string[];
  report: ProductionReadinessReport;
}
