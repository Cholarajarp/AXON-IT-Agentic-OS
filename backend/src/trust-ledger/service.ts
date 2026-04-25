import { createHash, createHmac } from 'node:crypto';
import { nanoid } from 'nanoid';
import { DurableJsonStore } from '../services/durable-json-store.js';
import type {
  PolicyDecision,
  PolicyDecisionInput,
  PolicyDecisionRecord,
  TrustLedgerExport,
  TrustLedgerVerification,
  TrustRecord,
  TrustRecordInput,
  TrustRisk,
} from './types.js';

const ledgerStore = new DurableJsonStore<TrustRecord[]>('trust-ledger.json', []);
const records: TrustRecord[] = ledgerStore.read();
const signingKey = process.env.AXON_LEDGER_SIGNING_KEY ?? 'axon-local-dev-ledger-key';

const riskRank: Record<TrustRisk, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export class TrustLedgerService {
  listRecords(input: { tenantId?: string; limit?: number; kind?: string } = {}): TrustRecord[] {
    return records
      .filter((record) => !input.tenantId || record.tenantId === input.tenantId)
      .filter((record) => !input.kind || record.kind === input.kind)
      .slice(-(input.limit ?? 100))
      .reverse();
  }

  append(input: TrustRecordInput): TrustRecord {
    const previousHash = records.at(-1)?.hash ?? '0'.repeat(64);
    const recordBase = {
      id: `tr_${nanoid(10)}`,
      sequence: records.length + 1,
      tenantId: input.tenantId ?? 'tenant_default',
      kind: input.kind,
      actor: input.actor,
      actorType: input.actorType ?? 'agent',
      subject: input.subject,
      summary: input.summary,
      risk: input.risk ?? 'medium',
      source: input.source ?? 'AXON OS',
      artifacts: input.artifacts ?? [],
      metadata: input.metadata ?? {},
      controls: input.controls ?? controlsFor(input.kind, input.risk ?? 'medium'),
      timestamp: new Date().toISOString(),
      previousHash,
    };
    const hash = computeHash(recordBase);
    const signature = signHash(hash);
    const record: TrustRecord = { ...recordBase, hash, signature };
    records.push(record);
    ledgerStore.write(records);
    return record;
  }

  signingStatus(): {
    mode: 'development' | 'production';
    configured: boolean;
    kmsBacked: boolean;
    keyFingerprint: string;
    productionReady: boolean;
    warnings: string[];
  } {
    const configured = Boolean(process.env.AXON_LEDGER_SIGNING_KEY);
    const kmsBacked = Boolean(process.env.AXON_KMS_KEY_ID || process.env.AWS_KMS_KEY_ID || process.env.GCP_KMS_KEY_NAME || process.env.AZURE_KEY_VAULT_KEY_ID);
    const strongLocalKey = configured && signingKey.length >= 32 && signingKey !== 'axon-local-dev-ledger-key';
    const warnings: string[] = [];
    if (!configured) warnings.push('AXON_LEDGER_SIGNING_KEY is not set; local development key is in use.');
    if (!kmsBacked) warnings.push('KMS/HSM-backed signing is not configured for external production.');
    if (configured && signingKey.length < 32) warnings.push('Ledger signing key should be at least 32 characters.');
    return {
      mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      configured,
      kmsBacked,
      keyFingerprint: createHash('sha256').update(signingKey).digest('hex').slice(0, 12),
      productionReady: kmsBacked && strongLocalKey,
      warnings,
    };
  }

  evaluatePolicy(input: PolicyDecisionInput): PolicyDecisionRecord {
    const normalizedRisk = input.risk ?? inferRisk(input);
    const decision = decide(input, normalizedRisk);
    const reason = reasonFor(normalizedRisk, decision);
    const requiredApprovals = approvalsFor(input, normalizedRisk, decision);
    const record = this.append({
      tenantId: input.tenantId,
      kind: 'policy-decision',
      actor: input.actor,
      actorType: 'agent',
      subject: `${input.action} ${input.resource}`,
      summary: `${decision}: ${reason}`,
      risk: normalizedRisk,
      source: 'Trust Ledger policy evaluator',
      artifacts: requiredApprovals,
      metadata: {
        action: input.action,
        resource: input.resource,
        environment: input.environment ?? 'preview',
        dataClass: input.dataClass ?? 'internal',
        requestedScopes: input.requestedScopes ?? [],
        hasApproval: Boolean(input.hasApproval),
      },
      controls: ['SOC2-CC6.1', 'SOC2-CC7.2', 'ISO27001-A.5.15'],
    });
    return { id: `pd_${nanoid(10)}`, decision, reason, requiredApprovals, record };
  }

  verify(tenantId?: string): TrustLedgerVerification {
    const scoped = records.filter((record) => !tenantId || record.tenantId === tenantId);
    let previousHash = '0'.repeat(64);
    for (const record of scoped) {
      if (record.previousHash !== previousHash) {
        return {
          valid: false,
          totalRecords: scoped.length,
          headHash: scoped.at(-1)?.hash,
          brokenAtSequence: record.sequence,
          brokenRecordId: record.id,
        };
      }
      const { hash, signature, ...base } = record;
      if (computeHash(base) !== hash || signHash(hash) !== signature) {
        return {
          valid: false,
          totalRecords: scoped.length,
          headHash: scoped.at(-1)?.hash,
          brokenAtSequence: record.sequence,
          brokenRecordId: record.id,
        };
      }
      previousHash = record.hash;
    }
    return {
      valid: true,
      totalRecords: scoped.length,
      headHash: scoped.at(-1)?.hash,
    };
  }

  exportPack(input: { tenantId?: string; format?: TrustLedgerExport['format'] } = {}): TrustLedgerExport {
    const tenantId = input.tenantId ?? 'tenant_default';
    const format = input.format ?? 'release-pack';
    const scoped = this.listRecords({ tenantId, limit: 500 }).reverse();
    const controls = buildControls(scoped);
    return {
      id: `export_${nanoid(10)}`,
      generatedAt: new Date().toISOString(),
      tenantId,
      format,
      verification: this.verify(tenantId),
      controls,
      records: scoped,
    };
  }
}

function decide(input: PolicyDecisionInput, risk: TrustRisk): PolicyDecision {
  const environment = input.environment ?? 'preview';
  const dataClass = input.dataClass ?? 'internal';
  const text = `${input.action} ${input.resource}`.toLowerCase();
  if (risk === 'critical') return input.hasApproval ? 'requires-approval' : 'block';
  if (/(delete|drop|destroy|rotate|deploy production|write secret|external transfer)/.test(text)) return input.hasApproval ? 'requires-approval' : 'block';
  if (environment === 'production' && ['high', 'critical'].includes(risk)) return input.hasApproval ? 'requires-approval' : 'block';
  if (dataClass === 'restricted' && !input.hasApproval) return 'requires-approval';
  if ((input.requestedScopes ?? []).some((scope) => /admin|write|delete|secret|billing/i.test(scope)) && !input.hasApproval) return 'requires-approval';
  return risk === 'high' ? 'requires-approval' : 'allow';
}

function inferRisk(input: PolicyDecisionInput): TrustRisk {
  const text = `${input.action} ${input.resource} ${(input.requestedScopes ?? []).join(' ')}`.toLowerCase();
  if (/(delete|drop|destroy|secret|production|billing|admin|credential)/.test(text)) return 'critical';
  if (/(write|deploy|migration|database|external|token)/.test(text)) return 'high';
  if (/(read|list|preview|test)/.test(text)) return 'low';
  return 'medium';
}

function reasonFor(risk: TrustRisk, decision: PolicyDecision) {
  if (decision === 'block') return `${risk} risk action requires explicit approval and safer execution evidence before it can run.`;
  if (decision === 'requires-approval') return `${risk} risk action can proceed only with approval, evidence capture, and release traceability.`;
  return `${risk} risk action is inside the current policy boundary.`;
}

function approvalsFor(input: PolicyDecisionInput, risk: TrustRisk, decision: PolicyDecision) {
  if (decision === 'allow') return [];
  const approvals = ['DeliveryManagerAgent'];
  if (riskRank[risk] >= riskRank.high) approvals.push('SecurityAgent');
  if ((input.environment ?? 'preview') === 'production') approvals.push('ReleaseAgent');
  if ((input.dataClass ?? 'internal') === 'restricted') approvals.push('ComplianceAgent');
  return Array.from(new Set(approvals));
}

function controlsFor(kind: TrustRecordInput['kind'], risk: TrustRisk) {
  const base = ['SOC2-CC7.2', 'ISO27001-A.8.15'];
  if (kind === 'policy-decision') base.push('SOC2-CC6.1', 'ISO27001-A.5.15');
  if (kind === 'security-scan') base.push('SOC2-CC7.1', 'ISO27001-A.8.8');
  if (kind === 'release-manifest' || kind === 'deployment') base.push('SOC2-CC8.1', 'ISO27001-A.8.32');
  if (kind === 'database-review') base.push('SOC2-CC6.6', 'ISO27001-A.8.12');
  if (riskRank[risk] >= riskRank.high) base.push('SOC2-CC3.2');
  return Array.from(new Set(base));
}

function buildControls(scoped: TrustRecord[]): TrustLedgerExport['controls'] {
  const required = [
    { controlId: 'SOC2-CC6.1', title: 'Logical access and approvals' },
    { controlId: 'SOC2-CC7.2', title: 'Security event monitoring' },
    { controlId: 'SOC2-CC8.1', title: 'Change management evidence' },
    { controlId: 'ISO27001-A.5.15', title: 'Access control policy' },
    { controlId: 'ISO27001-A.8.15', title: 'Logging' },
  ];
  return required.map((control) => {
    const recordIds = scoped.filter((record) => record.controls.includes(control.controlId)).map((record) => record.id);
    return {
      ...control,
      recordIds,
      status: recordIds.length >= 2 ? 'satisfied' : recordIds.length === 1 ? 'partial' : 'missing',
    };
  });
}

function computeHash(record: Omit<TrustRecord, 'hash' | 'signature'>) {
  return createHash('sha256')
    .update(JSON.stringify({
      id: record.id,
      sequence: record.sequence,
      tenantId: record.tenantId,
      kind: record.kind,
      actor: record.actor,
      actorType: record.actorType,
      subject: record.subject,
      summary: record.summary,
      risk: record.risk,
      source: record.source,
      artifacts: record.artifacts,
      metadata: record.metadata,
      controls: record.controls,
      timestamp: record.timestamp,
      previousHash: record.previousHash,
    }))
    .digest('hex');
}

function signHash(hash: string) {
  return createHmac('sha256', signingKey).update(hash).digest('hex');
}

export const trustLedger = new TrustLedgerService();
