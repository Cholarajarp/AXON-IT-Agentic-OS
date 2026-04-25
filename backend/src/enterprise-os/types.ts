export type EnterpriseGateStatus = 'pass' | 'warn' | 'block' | 'todo';

export interface EnterpriseCapability {
  id: string;
  name: string;
  category: 'build' | 'agent' | 'preview' | 'data' | 'security' | 'ops' | 'enterprise';
  description: string;
  axonStatus: 'live' | 'partial' | 'planned';
  marketPressure: string[];
  proof: string[];
}

export interface MarketSignal {
  name: string;
  positioning: string;
  strengths: string[];
  axonResponse: string[];
  sourceUrl: string;
}

export interface EnterpriseGate {
  id: string;
  title: string;
  status: EnterpriseGateStatus;
  owner: string;
  whyItMatters: string;
  evidence: string[];
  nextAction: string;
}

export interface EnterpriseReadiness {
  score: number;
  status: 'not-ready' | 'builder-ready' | 'enterprise-ready';
  summary: string;
  gates: EnterpriseGate[];
  missing: string[];
  launchSequence: Array<{
    order: number;
    name: string;
    agent: string;
    output: string;
  }>;
}
