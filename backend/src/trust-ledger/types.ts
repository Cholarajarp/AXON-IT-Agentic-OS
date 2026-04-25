export type TrustRecordKind =
  | 'policy-decision'
  | 'command-evidence'
  | 'browser-artifact'
  | 'security-scan'
  | 'database-review'
  | 'release-manifest'
  | 'approval'
  | 'deployment'
  | 'cost'
  | 'customer-handoff'
  | 'market-signal';

export type TrustRisk = 'low' | 'medium' | 'high' | 'critical';
export type PolicyDecision = 'allow' | 'requires-approval' | 'block';

export interface TrustRecordInput {
  tenantId?: string;
  kind: TrustRecordKind;
  actor: string;
  actorType?: 'human' | 'agent' | 'system';
  subject: string;
  summary: string;
  risk?: TrustRisk;
  source?: string;
  artifacts?: string[];
  metadata?: Record<string, unknown>;
  controls?: string[];
}

export interface PolicyDecisionInput {
  tenantId?: string;
  actor: string;
  action: string;
  resource: string;
  risk?: TrustRisk;
  environment?: 'preview' | 'staging' | 'production';
  dataClass?: 'public' | 'internal' | 'confidential' | 'restricted';
  requestedScopes?: string[];
  hasApproval?: boolean;
}

export interface TrustRecord {
  id: string;
  sequence: number;
  tenantId: string;
  kind: TrustRecordKind;
  actor: string;
  actorType: 'human' | 'agent' | 'system';
  subject: string;
  summary: string;
  risk: TrustRisk;
  source: string;
  artifacts: string[];
  metadata: Record<string, unknown>;
  controls: string[];
  timestamp: string;
  previousHash: string;
  hash: string;
  signature: string;
}

export interface PolicyDecisionRecord {
  id: string;
  decision: PolicyDecision;
  reason: string;
  requiredApprovals: string[];
  record: TrustRecord;
}

export interface TrustLedgerVerification {
  valid: boolean;
  totalRecords: number;
  headHash?: string;
  brokenAtSequence?: number;
  brokenRecordId?: string;
}

export interface TrustLedgerExport {
  id: string;
  generatedAt: string;
  tenantId: string;
  format: 'soc2-lite' | 'iso27001-lite' | 'release-pack';
  verification: TrustLedgerVerification;
  controls: Array<{
    controlId: string;
    title: string;
    recordIds: string[];
    status: 'satisfied' | 'partial' | 'missing';
  }>;
  records: TrustRecord[];
}
