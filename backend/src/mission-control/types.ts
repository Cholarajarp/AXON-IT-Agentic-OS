export type MissionControlStatus = 'ready' | 'needs-review' | 'blocked';
export type MissionPhaseStatus = 'pass' | 'warn' | 'block';

export interface MissionControlInput {
  tenantId?: string;
  customerName?: string;
  mission: string;
  previewUrl?: string;
  htmlSnapshot?: string;
  environment?: 'preview' | 'staging' | 'production';
  regulated?: boolean;
  budgetUsd?: number;
  timelineDays?: number;
  compliance?: string[];
  integrations?: string[];
}

export interface MissionControlPhase {
  order: number;
  name: string;
  ownerAgent: string;
  status: MissionPhaseStatus;
  evidence: string[];
  nextAction: string;
}

export interface MissionControlRun {
  id: string;
  tenantId: string;
  mission: string;
  status: MissionControlStatus;
  score: number;
  summary: string;
  blueprintId: string;
  finOpsReportId: string;
  agenticMeshBlueprintId: string;
  databaseReviewId: string;
  apiForgeReportId: string;
  customerAccountId: string;
  customerReportId: string;
  sandboxSessionId: string;
  browserQaReportId: string;
  blackboardId: string;
  releaseMissionId: string;
  trustRecordIds: string[];
  phases: MissionControlPhase[];
  agentTeam: string[];
  evidence: string[];
  nextActions: string[];
  createdAt: string;
}
