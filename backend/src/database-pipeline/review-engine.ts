import { nanoid } from 'nanoid';
import type {
  DatabaseEngine,
  DatabaseEnvironment,
  DatabaseFinding,
  DatabasePipelineStage,
  DatabasePolicy,
  DatabaseReviewInput,
  DatabaseReviewResult,
  DatabaseRiskSeverity,
  MigrationType,
} from './types.js';

const DEFAULT_ENGINE: DatabaseEngine = 'postgresql';
const DEFAULT_ENVIRONMENT: DatabaseEnvironment = 'dev';
const DEFAULT_MIGRATION_TYPE: MigrationType = 'schema';

const GOOGLE_REFERENCES = [
  {
    title: 'Google Cloud database migration concepts and principles',
    url: 'https://cloud.google.com/architecture/database-migration-concepts-principles-part-2',
  },
  {
    title: 'Google Cloud migration plan validation and rollback strategy',
    url: 'https://docs.cloud.google.com/architecture/migration-to-google-cloud-best-practices',
  },
  {
    title: 'Google Cloud AI prompt and agent interaction protection',
    url: 'https://cloud.google.com/security/products/model-armor',
  },
];

const POLICIES: DatabasePolicy[] = [
  {
    id: 'db-prod-destructive-change-gate',
    title: 'Block destructive production database changes',
    description: 'DROP, TRUNCATE, unbounded DELETE/UPDATE, and contract-phase changes require manual approval and verified fallback.',
    severity: 'CRITICAL',
    enforcedEnvironments: ['production'],
  },
  {
    id: 'db-expand-contract-required',
    title: 'Use expand-contract for product schema evolution',
    description: 'Production schema changes must add first, backfill in batches, switch app traffic, then contract only after verification.',
    severity: 'HIGH',
    enforcedEnvironments: ['staging', 'production'],
  },
  {
    id: 'db-large-table-lock-budget',
    title: 'Protect large tables from blocking migrations',
    description: 'Large-table ALTER and index builds need lock analysis, online/concurrent strategy, timeout, and staged rollout evidence.',
    severity: 'HIGH',
    enforcedEnvironments: ['staging', 'production'],
  },
  {
    id: 'db-quality-gates-required',
    title: 'Require data quality gates',
    description: 'Migrations must ship row counts, checksums or sampled diffs, null checks, referential checks, and rollback/roll-forward evidence.',
    severity: 'MEDIUM',
    enforcedEnvironments: ['dev', 'staging', 'production'],
  },
];

export class DatabasePipelineService {
  listPolicies(): DatabasePolicy[] {
    return POLICIES;
  }

  review(input: DatabaseReviewInput): DatabaseReviewResult {
    const engine = input.engine ?? DEFAULT_ENGINE;
    const environment = input.environment ?? DEFAULT_ENVIRONMENT;
    const migrationType = input.migrationType ?? DEFAULT_MIGRATION_TYPE;
    const statements = splitStatements(input.sql);
    const normalized = statements.map((statement) => normalizeSql(statement));
    const findings: DatabaseFinding[] = [];
    const estimatedRows = input.estimatedRows ?? 0;
    const tableSizeGb = input.tableSizeGb ?? 0;
    const isLargeTable = estimatedRows >= 1_000_000 || tableSizeGb >= 10;
    const isProd = environment === 'production';

    normalized.forEach((statement, index) => {
      const original = statements[index] ?? statement;
      findings.push(...detectDestructiveFindings(statement, original, isProd));
      findings.push(...detectMutationFindings(statement, original, isProd, migrationType));
      findings.push(...detectLockFindings(statement, original, engine, isLargeTable));
      findings.push(...detectSchemaEvolutionFindings(statement, original, isProd || environment === 'staging'));
    });

    if ((isProd || environment === 'staging') && !input.hasRollbackPlan) {
      findings.push({
        id: 'db-missing-rollback-plan',
        severity: isProd ? 'CRITICAL' : 'HIGH',
        category: 'rollback',
        title: 'Rollback or roll-forward plan is missing',
        detail: 'Stateful changes need a tested fallback path before the application is switched to the new schema or data shape.',
        recommendation: 'Attach a rollback plan for reversible changes or a roll-forward repair plan for irreversible changes.',
        blocksProduction: isProd,
      });
    }

    if (isProd && !input.hasBackupCheckpoint) {
      findings.push({
        id: 'db-missing-backup-checkpoint',
        severity: 'HIGH',
        category: 'operational-readiness',
        title: 'Backup checkpoint is missing',
        detail: 'Production migrations need a restore point or verified snapshot before state is changed.',
        recommendation: 'Capture backup evidence, point-in-time recovery target, owner, and restore drill status.',
        blocksProduction: false,
      });
    }

    if (statements.length === 0) {
      findings.push({
        id: 'db-empty-sql',
        severity: 'MEDIUM',
        category: 'operational-readiness',
        title: 'No SQL statements found',
        detail: 'The review cannot certify a migration without SQL content.',
        recommendation: 'Paste the migration SQL or generated diff before requesting approval.',
        blocksProduction: false,
      });
    }

    const riskScore = computeRiskScore(findings, environment, isLargeTable);
    const severity = scoreToSeverity(riskScore, findings);
    const blocked = findings.some((finding) => finding.blocksProduction) && isProd;
    const approvalRequired = blocked || severity === 'HIGH' || severity === 'CRITICAL' || environment !== 'dev';
    const strategy = chooseStrategy(findings, migrationType, isLargeTable);

    return {
      id: `dbrev_${nanoid(10)}`,
      name: input.name?.trim() || 'Database migration review',
      engine,
      environment,
      migrationType,
      riskScore,
      severity,
      blocked,
      approvalRequired,
      statementCount: statements.length,
      summary: summarizeReview(severity, blocked, findings, environment),
      findings,
      safeMigrationPlan: buildSafeMigrationPlan(strategy),
      rollbackPlan: buildRollbackPlan(strategy, blocked),
      qualityGates: buildQualityGates(engine, migrationType),
      pipelineStages: buildPipelineStages(environment, strategy),
      agents: ['DatabaseArchitectAgent', 'MigrationSafetyAgent', 'DataQualityAgent', 'SecurityAgent', 'ReleaseAgent', 'SREAgent'],
      references: GOOGLE_REFERENCES,
      createdAt: new Date().toISOString(),
    };
  }
}

function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let quote: "'" | '"' | '$$' | null = null;

  for (let index = 0; index < sql.length; index++) {
    const char = sql[index]!;
    const next = sql.slice(index, index + 2);

    if (!quote && next === '--') {
      const end = sql.indexOf('\n', index);
      if (end === -1) break;
      index = end;
      continue;
    }

    if (!quote && next === '/*') {
      const end = sql.indexOf('*/', index + 2);
      index = end === -1 ? sql.length : end + 1;
      continue;
    }

    if (!quote && next === '$$') {
      quote = '$$';
      current += next;
      index++;
      continue;
    }
    if (quote === '$$' && next === '$$') {
      quote = null;
      current += next;
      index++;
      continue;
    }
    if (quote !== '$$' && (char === "'" || char === '"')) {
      quote = quote === char ? null : quote ?? char;
    }

    if (!quote && char === ';') {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
      continue;
    }
    current += char;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

function normalizeSql(statement: string): string {
  return statement.replace(/\s+/g, ' ').trim().toLowerCase();
}

function detectDestructiveFindings(statement: string, original: string, isProd: boolean): DatabaseFinding[] {
  const findings: DatabaseFinding[] = [];
  const destructivePatterns: Array<[RegExp, string, string]> = [
    [/^drop\s+(table|schema|database)\b/, 'Database object drop detected', 'Move this to a contract phase after reads/writes no longer depend on the object.'],
    [/^truncate\s+table\b/, 'TRUNCATE detected', 'Replace with bounded archival/delete batches and a restore-tested backup checkpoint.'],
    [/^alter\s+table\b.+\bdrop\s+column\b/, 'Column drop detected', 'Use expand-contract: stop writes, verify no reads, then drop in a later release.'],
    [/^alter\s+table\b.+\brename\s+(column|to)\b/, 'Rename detected', 'Prefer additive columns plus dual-write/backfill to avoid breaking deployed app versions.'],
  ];

  for (const [pattern, title, recommendation] of destructivePatterns) {
    if (pattern.test(statement)) {
      findings.push({
        id: `db-${slug(title)}`,
        severity: isProd ? 'CRITICAL' : 'HIGH',
        category: 'destructive-change',
        title,
        detail: 'This migration can remove or break state that live product traffic may still depend on.',
        statement: original,
        recommendation,
        blocksProduction: isProd,
      });
    }
  }

  return findings;
}

function detectMutationFindings(
  statement: string,
  original: string,
  isProd: boolean,
  migrationType: MigrationType,
): DatabaseFinding[] {
  const findings: DatabaseFinding[] = [];
  if (/^delete\s+from\b/.test(statement) && !/\bwhere\b/.test(statement)) {
    findings.push({
      id: 'db-unbounded-delete',
      severity: isProd ? 'CRITICAL' : 'HIGH',
      category: 'destructive-change',
      title: 'Unbounded DELETE detected',
      detail: 'DELETE without WHERE can erase full tables and can create replication lag or long locks.',
      statement: original,
      recommendation: 'Use scoped predicates, dry-run row counts, batch limits, and archive/restore evidence.',
      blocksProduction: isProd,
    });
  }

  if (/^update\b/.test(statement) && !/\bwhere\b/.test(statement)) {
    findings.push({
      id: 'db-unbounded-update',
      severity: isProd ? 'CRITICAL' : 'HIGH',
      category: 'data-quality',
      title: 'Unbounded UPDATE detected',
      detail: 'UPDATE without WHERE can rewrite every row, inflate WAL/binlog volume, and damage production data.',
      statement: original,
      recommendation: 'Use a deterministic predicate, bounded batches, checkpoint table, and pre/post row-count validation.',
      blocksProduction: isProd,
    });
  }

  if (migrationType === 'data' && !/\blimit\b|\bwhere\b/.test(statement) && /^(insert|update|delete)\b/.test(statement)) {
    findings.push({
      id: 'db-data-change-missing-scope',
      severity: 'HIGH',
      category: 'data-quality',
      title: 'Data migration lacks explicit scope',
      detail: 'Data changes should state their target population so operators can compare expected and actual row counts.',
      statement: original,
      recommendation: 'Add WHERE filters, expected row counts, id ranges, or a checkpoint cursor.',
      blocksProduction: isProd,
    });
  }

  return findings;
}

function detectLockFindings(
  statement: string,
  original: string,
  engine: DatabaseEngine,
  isLargeTable: boolean,
): DatabaseFinding[] {
  const findings: DatabaseFinding[] = [];
  if (engine === 'postgresql' && /^create\s+index\b/.test(statement) && !/\bconcurrently\b/.test(statement)) {
    findings.push({
      id: 'db-postgres-index-without-concurrently',
      severity: isLargeTable ? 'HIGH' : 'MEDIUM',
      category: 'lock-risk',
      title: 'PostgreSQL index build is not concurrent',
      detail: 'A normal CREATE INDEX can block writes while the index is built.',
      statement: original,
      recommendation: 'Use CREATE INDEX CONCURRENTLY outside a transaction and add a statement timeout.',
      blocksProduction: false,
    });
  }

  if (/^alter\s+table\b/.test(statement) && isLargeTable) {
    findings.push({
      id: 'db-large-table-alter',
      severity: 'HIGH',
      category: 'lock-risk',
      title: 'Large-table ALTER requires lock budget',
      detail: 'ALTER TABLE on large tables can rewrite data or hold locks long enough to impact live traffic.',
      statement: original,
      recommendation: 'Run engine-specific online DDL, set lock timeout, rehearse in staging with production-sized data, and monitor replication lag.',
      blocksProduction: false,
    });
  }

  if (/^alter\s+table\b.+\bset\s+not\s+null\b/.test(statement)) {
    findings.push({
      id: 'db-set-not-null-validation',
      severity: isLargeTable ? 'HIGH' : 'MEDIUM',
      category: 'lock-risk',
      title: 'SET NOT NULL needs pre-validation',
      detail: 'Constraint validation can scan large tables and fail late if existing rows violate the rule.',
      statement: original,
      recommendation: 'Backfill nulls first, add a NOT VALID check where supported, validate separately, then set NOT NULL.',
      blocksProduction: false,
    });
  }

  return findings;
}

function detectSchemaEvolutionFindings(
  statement: string,
  original: string,
  enforceExpandContract: boolean,
): DatabaseFinding[] {
  if (!enforceExpandContract) return [];

  const findings: DatabaseFinding[] = [];
  if (/^alter\s+table\b.+\badd\s+column\b.+\bnot\s+null\b/.test(statement) && !/\bdefault\b/.test(statement)) {
    findings.push({
      id: 'db-add-not-null-without-default',
      severity: 'HIGH',
      category: 'operational-readiness',
      title: 'Required column added without compatibility phase',
      detail: 'Adding a NOT NULL column without a default can fail on existing rows and break older application versions.',
      statement: original,
      recommendation: 'Add the column nullable, deploy dual-write/backfill, validate, then enforce NOT NULL in a later release.',
      blocksProduction: false,
    });
  }

  if (/^alter\s+table\b.+\b(add|drop|rename|alter)\b/.test(statement)) {
    findings.push({
      id: 'db-expand-contract-review',
      severity: 'MEDIUM',
      category: 'operational-readiness',
      title: 'Schema change needs product compatibility review',
      detail: 'Application versions, background jobs, analytics, and rollback paths can observe different schemas during rollout.',
      statement: original,
      recommendation: 'Attach application compatibility notes, feature-flag plan, and verification queries.',
      blocksProduction: false,
    });
  }

  return findings;
}

function computeRiskScore(findings: DatabaseFinding[], environment: DatabaseEnvironment, isLargeTable: boolean): number {
  const weights: Record<DatabaseRiskSeverity, number> = {
    LOW: 8,
    MEDIUM: 18,
    HIGH: 32,
    CRITICAL: 50,
  };
  const environmentWeight = environment === 'production' ? 16 : environment === 'staging' ? 8 : 0;
  const largeTableWeight = isLargeTable ? 10 : 0;
  const score = findings.reduce((total, finding) => total + weights[finding.severity], environmentWeight + largeTableWeight);
  return Math.min(100, score);
}

function scoreToSeverity(score: number, findings: DatabaseFinding[]): DatabaseRiskSeverity {
  if (findings.some((finding) => finding.severity === 'CRITICAL') || score >= 80) return 'CRITICAL';
  if (findings.some((finding) => finding.severity === 'HIGH') || score >= 50) return 'HIGH';
  if (findings.some((finding) => finding.severity === 'MEDIUM') || score >= 20) return 'MEDIUM';
  return 'LOW';
}

function chooseStrategy(
  findings: DatabaseFinding[],
  migrationType: MigrationType,
  isLargeTable: boolean,
): DatabaseReviewResult['safeMigrationPlan']['strategy'] {
  if (findings.some((finding) => finding.blocksProduction || finding.severity === 'CRITICAL')) return 'manual-review';
  if (migrationType === 'data' || isLargeTable || findings.some((finding) => finding.category === 'data-quality')) return 'batch-data-change';
  if (findings.some((finding) => finding.category === 'destructive-change' || finding.category === 'operational-readiness')) return 'expand-contract';
  return 'direct';
}

function buildSafeMigrationPlan(strategy: DatabaseReviewResult['safeMigrationPlan']['strategy']): DatabaseReviewResult['safeMigrationPlan'] {
  const common = {
    strategy,
    phases: [
      {
        name: 'Expand',
        description: 'Add compatible schema objects first: nullable columns, new tables, compatible indexes, and dual-write code paths.',
        requiredEvidence: ['schema diff', 'application compatibility note', 'staging migration timing'],
      },
      {
        name: 'Backfill',
        description: 'Move or repair data in bounded batches with checkpoints, retries, and observable progress.',
        requiredEvidence: ['batch size', 'expected row count', 'checkpoint query', 'replication lag dashboard'],
      },
      {
        name: 'Switch',
        description: 'Shift reads and writes behind a feature flag or canary after quality gates pass.',
        requiredEvidence: ['canary result', 'error budget status', 'rollback or roll-forward owner'],
      },
      {
        name: 'Contract',
        description: 'Remove old columns, tables, or code only after traffic and analytics no longer depend on them.',
        requiredEvidence: ['usage scan', 'audit approval', 'post-migration validation report'],
      },
    ],
  };

  if (strategy === 'direct') {
    return {
      strategy,
      phases: [
        {
          name: 'Apply',
          description: 'Run the additive migration with statement timeout, lock timeout, and staging evidence.',
          requiredEvidence: ['SQL lint result', 'staging pass', 'backup checkpoint'],
        },
        {
          name: 'Verify',
          description: 'Run smoke checks, schema introspection, and data quality checks immediately after apply.',
          requiredEvidence: ['schema check', 'application smoke test', 'audit log entry'],
        },
      ],
    };
  }

  return common;
}

function buildRollbackPlan(strategy: DatabaseReviewResult['safeMigrationPlan']['strategy'], blocked: boolean): string[] {
  if (blocked) {
    return [
      'Do not run in production until destructive statements are moved behind a contract-phase approval.',
      'Create point-in-time restore evidence and owner assignment.',
      'Prefer roll-forward repair scripts when data loss would make rollback unsafe.',
    ];
  }

  if (strategy === 'direct') {
    return [
      'Keep a restore point before apply.',
      'Make application rollout independently reversible.',
      'Record exact migration version and verification query output.',
    ];
  }

  return [
    'Rollback app traffic first by disabling the feature flag or reverting the service release.',
    'Keep expanded schema objects in place until old and new versions are stable.',
    'Use checkpoint tables to resume or reverse batches without double-writing or skipping rows.',
    'Delay contract-phase drops until observability confirms zero live usage.',
  ];
}

function buildQualityGates(engine: DatabaseEngine, migrationType: MigrationType): string[] {
  const gates = [
    'SQL lint and policy review pass',
    'Staging migration timing captured with production-like row counts',
    'Pre/post row count comparison for every touched table',
    'Application smoke tests pass after migration',
    'Audit evidence attached to change record',
  ];

  if (engine === 'postgresql') gates.push('PostgreSQL lock_timeout and statement_timeout configured');
  if (migrationType === 'data') gates.push('Checksums or sampled diffs verify changed data');
  return gates;
}

function buildPipelineStages(
  environment: DatabaseEnvironment,
  strategy: DatabaseReviewResult['safeMigrationPlan']['strategy'],
): DatabasePipelineStage[] {
  const production = environment === 'production';
  return [
    {
      order: 1,
      name: 'Model schema impact',
      ownerAgent: 'DatabaseArchitectAgent',
      required: true,
      evidence: ['entity impact map', 'expand-contract classification'],
      checks: ['backward compatibility', 'API/job/analytics dependency scan'],
    },
    {
      order: 2,
      name: 'Review migration safety',
      ownerAgent: 'MigrationSafetyAgent',
      required: true,
      evidence: ['SQL lint result', 'lock analysis', 'rollback plan'],
      checks: ['destructive operation gate', 'large-table lock budget', 'approval status'],
    },
    {
      order: 3,
      name: 'Validate data quality',
      ownerAgent: 'DataQualityAgent',
      required: true,
      evidence: ['row counts', 'null checks', 'referential checks'],
      checks: ['pre/post comparison', 'batch checkpoint', 'drift detection'],
    },
    {
      order: 4,
      name: production ? 'Production approval' : 'Environment approval',
      ownerAgent: 'ComplianceAgent',
      required: production || strategy !== 'direct',
      evidence: ['change ticket', 'backup checkpoint', 'owner acknowledgement'],
      checks: ['least-privilege executor', 'maintenance window', 'fallback owner'],
    },
    {
      order: 5,
      name: 'Release and observe',
      ownerAgent: 'ReleaseAgent',
      required: true,
      evidence: ['canary result', 'dashboard link', 'post-migration report'],
      checks: ['error budget', 'replication lag', 'query latency'],
    },
  ];
}

function summarizeReview(
  severity: DatabaseRiskSeverity,
  blocked: boolean,
  findings: DatabaseFinding[],
  environment: DatabaseEnvironment,
): string {
  if (blocked) {
    return `Blocked for ${environment}: ${findings.filter((finding) => finding.blocksProduction).length} production-blocking database risk(s) found.`;
  }
  if (severity === 'LOW') return `Low-risk database change with ${findings.length} advisory finding(s).`;
  return `${severity.toLowerCase()} risk database change with ${findings.length} finding(s); approval and evidence gates are required.`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const databasePipeline = new DatabasePipelineService();
