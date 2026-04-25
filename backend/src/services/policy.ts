/**
 * Policy service.
 *
 * Evaluates execution requests against policies stored in the `policies` table
 * (or an in-memory default set). Policies are intentionally small and
 * declarative for now; a future version will compile Rego/OPA bundles.
 *
 * Each policy is a predicate over an ExecutionRequest + tenant context.
 * Evaluation short-circuits on the first deny. Missing policies = allow.
 */

import { sql } from '../db/connection.js';

export type PolicyType = 'Tool' | 'Data' | 'Approval' | 'Model' | 'Cost' | 'Environment';

export interface PolicyRule {
  id: string;
  name: string;
  type: PolicyType;
  scope: string;
  status: 'ACTIVE' | 'DRAFT' | 'DEPRECATED';
  /**
   * Simple JSON predicate the service can evaluate without an engine.
   * Shape:
   *   { when: { agent?: string; tenantId?: string; sensitivityLevel?: string },
   *     deny?: string[] (reasons),
   *     require?: { approval?: boolean; sovereign?: boolean } }
   */
  rule: {
    when?: {
      agent?: string;
      tenantId?: string;
      sensitivityLevel?: 'public' | 'internal' | 'confidential' | 'restricted';
      sovereignOnly?: boolean;
    };
    deny?: string[];
    require?: {
      approval?: boolean;
      sovereign?: boolean;
    };
  };
}

export interface PolicyRequest {
  agent: string;
  tenantId: string;
  sensitivityLevel?: 'public' | 'internal' | 'confidential' | 'restricted';
  sovereignMode?: boolean;
  approvalApproved?: boolean;
}

export interface PolicyDecision {
  allowed: boolean;
  matched: string[];
  reasons: string[];
  requireApproval: boolean;
  requireSovereign: boolean;
}

const DEFAULT_POLICIES: PolicyRule[] = [
  {
    id: 'pol_default_restricted',
    name: 'Restricted data must route through sovereign providers',
    type: 'Data',
    scope: '*',
    status: 'ACTIVE',
    rule: {
      when: { sensitivityLevel: 'restricted' },
      require: { sovereign: true, approval: true },
    },
  },
  {
    id: 'pol_default_confidential',
    name: 'Confidential data requires sovereign routing',
    type: 'Data',
    scope: '*',
    status: 'ACTIVE',
    rule: {
      when: { sensitivityLevel: 'confidential' },
      require: { sovereign: true },
    },
  },
];

class PolicyService {
  private cache: PolicyRule[] | null = null;
  private cacheExpiresAt = 0;
  private readonly cacheTtlMs = 30_000;

  async load(): Promise<PolicyRule[]> {
    if (this.cache && Date.now() < this.cacheExpiresAt) return this.cache;

    const fromDb: PolicyRule[] = [];
    try {
      const rows = await sql`SELECT id, name, type, scope, status, rego_source FROM policies WHERE status = 'ACTIVE'`;
      for (const row of rows) {
        // rego_source is free-form for now; we try to parse as JSON.
        let rule: PolicyRule['rule'] = {};
        if (row.rego_source) {
          try {
            rule = JSON.parse(row.rego_source as string);
          } catch {
            rule = {};
          }
        }
        fromDb.push({
          id: row.id as string,
          name: row.name as string,
          type: row.type as PolicyType,
          scope: row.scope as string,
          status: row.status as PolicyRule['status'],
          rule,
        });
      }
    } catch {
      // DB may not be available; fall back to defaults.
    }

    this.cache = [...DEFAULT_POLICIES, ...fromDb];
    this.cacheExpiresAt = Date.now() + this.cacheTtlMs;
    return this.cache;
  }

  async evaluate(request: PolicyRequest): Promise<PolicyDecision> {
    const policies = await this.load();
    const matched: string[] = [];
    const reasons: string[] = [];
    let allowed = true;
    let requireApproval = false;
    let requireSovereign = false;

    for (const policy of policies) {
      if (!this.matches(policy, request)) continue;
      matched.push(policy.name);

      if (policy.rule.deny && policy.rule.deny.length > 0) {
        allowed = false;
        reasons.push(...policy.rule.deny);
      }
      if (policy.rule.require?.approval) {
        requireApproval = true;
        if (!request.approvalApproved) {
          allowed = false;
          reasons.push(`${policy.name}: approval required`);
        }
      }
      if (policy.rule.require?.sovereign) {
        requireSovereign = true;
        if (!request.sovereignMode) {
          allowed = false;
          reasons.push(`${policy.name}: sovereign mode required`);
        }
      }
    }

    return { allowed, matched, reasons, requireApproval, requireSovereign };
  }

  private matches(policy: PolicyRule, request: PolicyRequest): boolean {
    const when = policy.rule.when;
    if (!when) return true;
    if (when.agent && when.agent !== request.agent) return false;
    if (when.tenantId && when.tenantId !== request.tenantId) return false;
    if (when.sensitivityLevel && when.sensitivityLevel !== request.sensitivityLevel) return false;
    if (when.sovereignOnly && !request.sovereignMode) return false;
    return true;
  }

  invalidateCache() {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }
}

export const policyService = new PolicyService();
