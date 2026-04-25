export type RuntimeGateStatus = 'pass' | 'warn' | 'block';
export type RuntimeReadinessStatus = 'development-only' | 'pilot-ready' | 'production-ready' | 'blocked';

export interface RuntimeGate {
  id: string;
  title: string;
  status: RuntimeGateStatus;
  owner: string;
  whyItMatters: string;
  evidence: string[];
  nextAction: string;
}

export interface ProductionRuntimeStatus {
  id: string;
  generatedAt: string;
  status: RuntimeReadinessStatus;
  score: number;
  productionReady: boolean;
  summary: string;
  gates: RuntimeGate[];
  blockers: string[];
}
