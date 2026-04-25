export type BlackboardStatus = 'active' | 'blocked' | 'resolved' | 'archived';
export type BlackboardEntryKind = 'finding' | 'decision' | 'blocker' | 'artifact' | 'risk' | 'next-action' | 'ownership';
export type BlackboardEntrySeverity = 'low' | 'medium' | 'high' | 'critical';
export type BlackboardEntryStatus = 'open' | 'accepted' | 'resolved' | 'superseded';

export interface BlackboardInput {
  tenantId?: string;
  missionId?: string;
  title: string;
  goal: string;
  ownerAgent?: string;
}

export interface BlackboardEntryInput {
  kind: BlackboardEntryKind;
  title: string;
  detail: string;
  agent: string;
  severity?: BlackboardEntrySeverity;
  status?: BlackboardEntryStatus;
  evidence?: string[];
  relatedFiles?: string[];
}

export interface FileOwnershipInput {
  filePath: string;
  agent: string;
  reason: string;
}

export interface BlackboardEntry {
  id: string;
  kind: BlackboardEntryKind;
  title: string;
  detail: string;
  agent: string;
  severity: BlackboardEntrySeverity;
  status: BlackboardEntryStatus;
  evidence: string[];
  relatedFiles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FileOwnership {
  filePath: string;
  agent: string;
  reason: string;
  claimedAt: string;
}

export interface AgentBlackboard {
  id: string;
  tenantId: string;
  missionId: string;
  title: string;
  goal: string;
  ownerAgent: string;
  status: BlackboardStatus;
  entries: BlackboardEntry[];
  fileOwnership: FileOwnership[];
  decisionSummary: string;
  riskSummary: string;
  openBlockers: number;
  nextActions: string[];
  evidence: string[];
  createdAt: string;
  updatedAt: string;
}
