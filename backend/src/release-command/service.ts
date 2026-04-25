import { nanoid } from 'nanoid';
import { productFactory } from '../product-factory/index.js';
import { securityCenter } from '../security-center/index.js';
import { checkpointService } from '../checkpoints/index.js';
import { customerDelivery } from '../customer-delivery/index.js';
import { apiForge } from '../api-forge/index.js';
import { browserQa } from '../browser-qa/index.js';
import type {
  EvidenceManifestItem,
  ReleaseCommandInput,
  ReleaseEvidenceSnapshot,
  ReleaseCommandMission,
  ReleaseGate,
  ReleaseGateCategory,
  ReleaseGateStatus,
} from './types.js';

const missions = new Map<string, ReleaseCommandMission>();

export class ReleaseCommandService {
  listMissions(): ReleaseCommandMission[] {
    return Array.from(missions.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getMission(id: string): ReleaseCommandMission | undefined {
    return missions.get(id);
  }

  createMission(input: ReleaseCommandInput): ReleaseCommandMission {
    const environment = input.environment ?? 'production';
    const regulated = input.regulated ?? /soc|iso|pci|hipaa|bank|health|government|production|enterprise/i.test(input.releaseGoal);
    const productName = input.productName?.trim() || inferProductName(input.releaseGoal);
    const evidence = input.evidenceArtifacts ?? [];

    const gates = buildGates(input, environment, regulated, evidence);
    const manifest = buildEvidenceManifest(input, evidence, regulated);
    const score = calculateScore(gates);
    const blockers = gates.filter((gate) => gate.blocksRelease).length;
    const status: ReleaseCommandMission['status'] =
      blockers > 0 ? 'blocked' : score >= 85 ? 'ready-to-launch' : 'needs-review';

    const mission: ReleaseCommandMission = {
      id: `rel_${nanoid(10)}`,
      tenantId: input.tenantId ?? 'tenant_default',
      productName,
      releaseGoal: input.releaseGoal.trim(),
      environment,
      status,
      score,
      summary: buildSummary(productName, environment, status, blockers, score),
      gates,
      evidenceManifest: manifest,
      deploymentStages: buildDeploymentStages(environment, regulated),
      slaWatch: buildSlaWatch(input.slaMinutes, environment, regulated),
      faultRecovery: buildFaultRecovery(environment, regulated, input.openRisks ?? []),
      executiveBrief: buildExecutiveBrief(productName, status, score, blockers),
      createdAt: new Date().toISOString(),
    };

    missions.set(mission.id, mission);
    return mission;
  }

  async collectEvidence(input: Pick<ReleaseCommandInput, 'releaseGoal' | 'environment' | 'regulated' | 'slaMinutes'>): Promise<ReleaseEvidenceSnapshot> {
    checkpointService.seedIfEmpty();
    const releaseGoal = input.releaseGoal.trim();
    const blueprints = productFactory.listBlueprints();
    const approvedBlueprints = blueprints.filter((blueprint) => ['approved', 'ready-for-execution', 'executing'].includes(blueprint.status));
    const checkpoints = checkpointService.list();
    const apiForgeReports = apiForge.listReports();
    const readyApiForgeReports = apiForgeReports.filter((report) => report.status === 'ready');
    const browserQaReports = browserQa.listReports();
    const releaseReadyBrowserQaReports = browserQaReports.filter((report) => report.status === 'release-ready');
    const browserQaWithPassingValidation = browserQaReports.filter((report) =>
      report.validationEvidence.some((item) => item.status === 'pass' && ['typecheck', 'unit', 'integration', 'build', 'e2e'].includes(item.kind)),
    );
    const customerAccounts = customerDelivery.listAccounts();
    const customerReportsReady = customerAccounts.flatMap((account) => account.projects).filter((project) => project.deliveryReport.status !== 'draft');
    const security = await securityCenter.scan({ maxFiles: 15 });

    const hasDatabaseKeywords = /database|postgres|mysql|schema|migration|sql/i.test(releaseGoal);
    const hasConnectorKeywords = /api|integration|connector|sdk|mcp/i.test(releaseGoal);
    const evidenceArtifacts = [
      approvedBlueprints[0] ? `approved blueprint ${approvedBlueprints[0].id}` : blueprints[0] ? `blueprint ${blueprints[0].id}` : undefined,
      security ? `security scan ${security.id} ${security.status}` : undefined,
      security.status === 'safe-to-preview' ? 'dependency audit passed' : undefined,
      checkpoints[0] ? `checkpoint id ${checkpoints[0].id}` : undefined,
      checkpoints.find((checkpoint) => checkpoint.status === 'restore-previewed') ? 'rollback preview' : undefined,
      readyApiForgeReports[0] ? `API Forge report ${readyApiForgeReports[0].id}` : undefined,
      browserQaReports[0] ? `preview URL ${browserQaReports[0].preview.url ?? 'offline snapshot'}` : undefined,
      browserQaReports[0] ? `browser smoke result ${browserQaReports[0].status} score ${browserQaReports[0].score}%` : undefined,
      browserQaReports[0] ? `screenshot or trace plan ${browserQaReports[0].artifacts.find((artifact) => artifact.kind === 'playwright-spec')?.path ?? 'browser-qa/playwright/preview.spec.ts'}` : undefined,
      ...browserQaReports.slice(0, 2).flatMap((report) => report.releaseEvidence.filter((item) => item.startsWith('test output')).slice(0, 3)),
      customerReportsReady[0] ? `customer report ${customerReportsReady[0].deliveryReport.id}` : undefined,
    ].filter(Boolean) as string[];

    const inferredInput: Partial<ReleaseCommandInput> = {
      releaseGoal,
      environment: input.environment ?? 'production',
      regulated: input.regulated ?? /soc|iso|pci|hipaa|bank|health|government|production|enterprise/i.test(releaseGoal),
      slaMinutes: input.slaMinutes,
      hasBlueprint: blueprints.length > 0,
      hasPreview: releaseReadyBrowserQaReports.length > 0 || browserQaReports.some((report) => report.preview.reachable),
      hasTests: browserQaWithPassingValidation.length > 0,
      hasSecurityScan: security.status === 'safe-to-preview',
      hasDatabaseReview: !hasDatabaseKeywords,
      hasCheckpoint: checkpoints.length > 0,
      hasRollbackPlan: checkpoints.some((checkpoint) => checkpoint.status === 'restore-previewed'),
      hasDeploymentPlan: false,
      hasCustomerReport: customerReportsReady.length > 0,
      hasApiForgeConnectors: !hasConnectorKeywords || readyApiForgeReports.length > 0,
      evidenceArtifacts,
    };

    return {
      id: `snap_${nanoid(10)}`,
      releaseGoal,
      generatedAt: new Date().toISOString(),
      signals: {
        blueprints: blueprints.length,
        approvedBlueprints: approvedBlueprints.length,
        securityStatus: security.status,
        securityScore: security.score,
        securityFindings: security.findings.length,
        checkpoints: checkpoints.length,
        rollbackPreviews: checkpoints.filter((checkpoint) => checkpoint.status === 'restore-previewed').length,
        apiForgeReports: apiForgeReports.length,
        readyApiForgeReports: readyApiForgeReports.length,
        browserQaReports: browserQaReports.length,
        releaseReadyBrowserQaReports: releaseReadyBrowserQaReports.length,
        customerAccounts: customerAccounts.length,
        customerReportsReady: customerReportsReady.length,
      },
      inferredInput,
      evidenceArtifacts,
      gaps: buildEvidenceGaps(inferredInput, hasDatabaseKeywords, hasConnectorKeywords),
    };
  }

  async createMissionFromEvidence(input: ReleaseCommandInput): Promise<ReleaseCommandMission> {
    const snapshot = await this.collectEvidence(input);
    return this.createMission({
      ...snapshot.inferredInput,
      ...input,
      productName: input.productName,
      releaseGoal: input.releaseGoal,
      evidenceArtifacts: unique([...(input.evidenceArtifacts ?? []), ...snapshot.evidenceArtifacts]),
      openRisks: unique([
        ...(input.openRisks ?? []),
        ...snapshot.gaps.map((gap) => gap.title),
      ]).slice(0, 8),
    });
  }
}

function buildEvidenceGaps(input: Partial<ReleaseCommandInput>, needsDatabase: boolean, needsConnectors: boolean): ReleaseEvidenceSnapshot['gaps'] {
  const gaps: ReleaseEvidenceSnapshot['gaps'] = [];
  if (!input.hasBlueprint) gaps.push({ id: 'missing-blueprint', title: 'No Product Factory blueprint found', ownerAgent: 'ProductStrategistAgent', nextAction: 'Create or approve a blueprint.' });
  if (!input.hasTests) gaps.push({ id: 'missing-tests', title: 'No test/build evidence imported', ownerAgent: 'QAAgent', nextAction: 'Run validation and attach output.' });
  if (!input.hasSecurityScan) gaps.push({ id: 'missing-security', title: 'Security scan is not clean', ownerAgent: 'SecurityAgent', nextAction: 'Run Security Center and resolve blockers.' });
  if (needsDatabase && !input.hasDatabaseReview) gaps.push({ id: 'missing-database-review', title: 'Database release needs review evidence', ownerAgent: 'MigrationSafetyAgent', nextAction: 'Run Database Pipeline and attach review.' });
  if (!input.hasRollbackPlan) gaps.push({ id: 'missing-rollback-preview', title: 'Rollback preview not imported', ownerAgent: 'ReleaseAgent', nextAction: 'Preview rollback from a checkpoint.' });
  if (!input.hasDeploymentPlan) gaps.push({ id: 'missing-deployment-plan', title: 'Deployment runbook not imported', ownerAgent: 'SREAgent', nextAction: 'Create deployment plan and smoke checks.' });
  if (!input.hasCustomerReport) gaps.push({ id: 'missing-customer-report', title: 'Customer delivery report not ready', ownerAgent: 'CustomerSuccessAgent', nextAction: 'Generate Customer Delivery report.' });
  if (needsConnectors && !input.hasApiForgeConnectors) gaps.push({ id: 'missing-api-forge', title: 'API connector package not ready', ownerAgent: 'IntegrationAgent', nextAction: 'Run API Forge for required APIs.' });
  return gaps;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildGates(
  input: ReleaseCommandInput,
  environment: ReleaseCommandMission['environment'],
  regulated: boolean,
  evidence: string[],
): ReleaseGate[] {
  return [
    gate({
      id: 'blueprint',
      category: 'product',
      title: 'Blueprint and acceptance criteria approved',
      passed: input.hasBlueprint ?? true,
      warnOnly: false,
      ownerAgent: 'ProductStrategistAgent',
      whyItMatters: 'Release must trace to an accepted customer or product outcome.',
      evidenceRequired: ['approved blueprint', 'acceptance criteria', 'scope/non-goals'],
      evidence,
      nextAction: 'Generate or approve a Product Factory blueprint before launch.',
    }),
    gate({
      id: 'preview',
      category: 'product',
      title: 'User preview verified',
      passed: input.hasPreview ?? environment !== 'production',
      warnOnly: environment !== 'production',
      ownerAgent: 'QAAgent',
      whyItMatters: 'Users and operators need to see the product working before release.',
      evidenceRequired: ['preview URL', 'browser smoke result', 'screenshot or trace'],
      evidence,
      nextAction: 'Run preview smoke and attach browser evidence.',
    }),
    gate({
      id: 'tests',
      category: 'deployment',
      title: 'Tests and build passed',
      passed: input.hasTests ?? false,
      warnOnly: environment === 'preview',
      ownerAgent: 'QAAgent',
      whyItMatters: 'A launch without typecheck, tests, and build evidence is not repeatable.',
      evidenceRequired: ['typecheck output', 'test output', 'build artifact'],
      evidence,
      nextAction: 'Run typecheck, test, and build gates.',
    }),
    gate({
      id: 'security',
      category: 'security',
      title: 'Security scan cleared',
      passed: input.hasSecurityScan ?? false,
      warnOnly: environment === 'preview' && !regulated,
      ownerAgent: 'SecurityAgent',
      whyItMatters: 'Secrets, auth, dependency, and unsafe-output risks must be blocked before customer exposure.',
      evidenceRequired: ['Security Center scan', 'dependency audit', 'secret scan'],
      evidence,
      nextAction: 'Run Security Center and remediate blockers.',
    }),
    gate({
      id: 'database',
      category: 'database',
      title: 'Database changes reviewed',
      passed: input.hasDatabaseReview ?? !/database|postgres|mysql|schema|migration|sql/i.test(input.releaseGoal),
      warnOnly: environment !== 'production',
      ownerAgent: 'MigrationSafetyAgent',
      whyItMatters: 'Stateful release failures are expensive and hard to reverse.',
      evidenceRequired: ['Database Pipeline review', 'backup proof', 'data quality gates'],
      evidence,
      nextAction: 'Run Database Pipeline for every schema/data change.',
    }),
    gate({
      id: 'checkpoint',
      category: 'evidence',
      title: 'Checkpoint and rollback are ready',
      passed: Boolean(input.hasCheckpoint && input.hasRollbackPlan),
      warnOnly: environment === 'preview',
      ownerAgent: 'ReleaseAgent',
      whyItMatters: 'Autonomous changes need a known restore point and rollback owner.',
      evidenceRequired: ['checkpoint id', 'rollback preview', 'restore owner'],
      evidence,
      nextAction: 'Create checkpoint and rollback preview before risky release.',
    }),
    gate({
      id: 'deployment',
      category: 'deployment',
      title: 'Deployment plan and health checks ready',
      passed: input.hasDeploymentPlan ?? false,
      warnOnly: environment === 'preview',
      ownerAgent: 'SREAgent',
      whyItMatters: 'Release must define rollout, smoke test, monitoring, and rollback triggers.',
      evidenceRequired: ['deployment runbook', 'health check', 'smoke test'],
      evidence,
      nextAction: 'Create deployment runbook and endpoint smoke checks.',
    }),
    gate({
      id: 'customer-report',
      category: 'customer',
      title: 'Customer delivery report packaged',
      passed: input.hasCustomerReport ?? environment !== 'production',
      warnOnly: environment !== 'production',
      ownerAgent: 'CustomerSuccessAgent',
      whyItMatters: 'A real IT company ships explanation, risks, evidence, and next steps with the product.',
      evidenceRequired: ['customer report', 'known risks', 'next recommendations'],
      evidence,
      nextAction: 'Generate Customer Delivery report before handoff.',
    }),
    gate({
      id: 'api-connectors',
      category: 'ops',
      title: 'API connectors are agent-ready',
      passed: input.hasApiForgeConnectors ?? !/api|integration|connector|sdk|mcp/i.test(input.releaseGoal),
      warnOnly: true,
      ownerAgent: 'IntegrationAgent',
      whyItMatters: 'Agent OS capability depends on typed APIs, docs search, MCP tools, and connector safety.',
      evidenceRequired: ['API Forge report', 'MCP tool plan', 'auth policy'],
      evidence,
      nextAction: 'Run API Forge for customer or platform APIs.',
    }),
  ];
}

function gate(input: {
  id: string;
  category: ReleaseGateCategory;
  title: string;
  passed: boolean;
  warnOnly: boolean;
  ownerAgent: string;
  whyItMatters: string;
  evidenceRequired: string[];
  evidence: string[];
  nextAction: string;
}): ReleaseGate {
  const evidenceProvided = input.evidence.filter((item) =>
    input.evidenceRequired.some((required) => item.toLowerCase().includes(required.split(' ')[0]!.toLowerCase())),
  );
  const status: ReleaseGateStatus = input.passed ? 'pass' : input.warnOnly ? 'warn' : 'block';
  return {
    id: input.id,
    category: input.category,
    title: input.title,
    status,
    ownerAgent: input.ownerAgent,
    whyItMatters: input.whyItMatters,
    evidenceRequired: input.evidenceRequired,
    evidenceProvided,
    nextAction: input.nextAction,
    blocksRelease: status === 'block',
  };
}

function buildEvidenceManifest(input: ReleaseCommandInput, evidence: string[], regulated: boolean): EvidenceManifestItem[] {
  const items: Array<Omit<EvidenceManifestItem, 'id' | 'present'>> = [
    { kind: 'blueprint', title: 'Approved blueprint', required: true, source: 'Product Factory' },
    { kind: 'test', title: 'Typecheck, test, and build output', required: true, source: 'CI / local validation' },
    { kind: 'security', title: 'Security scan and dependency audit', required: true, source: 'Security Center' },
    { kind: 'database', title: 'Database safety review', required: /database|postgres|mysql|schema|migration|sql/i.test(input.releaseGoal), source: 'Database Pipeline' },
    { kind: 'checkpoint', title: 'Checkpoint and rollback preview', required: true, source: 'Checkpoints' },
    { kind: 'deployment', title: 'Deployment runbook and smoke test', required: true, source: 'Release/SRE' },
    { kind: 'customer-report', title: 'Customer delivery report', required: input.environment === 'production' || regulated, source: 'Customer Delivery' },
    { kind: 'connector', title: 'API Forge connector package', required: /api|integration|connector|sdk|mcp/i.test(input.releaseGoal), source: 'API Forge' },
    { kind: 'ops', title: 'SLO, monitors, and escalation', required: true, source: 'Managed Services / SRE' },
  ];

  return items.map((item) => ({
    id: `ev_${item.kind}`,
    ...item,
    present: evidence.some((artifact) => artifact.toLowerCase().includes(item.kind.replace('-', ' ')) || artifact.toLowerCase().includes(item.title.split(' ')[0]!.toLowerCase())),
  }));
}

function buildDeploymentStages(environment: ReleaseCommandMission['environment'], regulated: boolean): ReleaseCommandMission['deploymentStages'] {
  return [
    { order: 1, name: 'Freeze scope and artifacts', ownerAgent: 'ReleaseAgent', action: 'Lock blueprint, generated artifacts, package versions, and evidence manifest.', evidence: ['release manifest', 'artifact hashes'] },
    { order: 2, name: 'Run verification suite', ownerAgent: 'QAAgent', action: 'Run typecheck, unit/integration tests, security, database, and browser smoke gates.', evidence: ['test logs', 'scan reports'] },
    { order: 3, name: 'Prepare rollback', ownerAgent: 'SREAgent', action: 'Create checkpoint, rollback preview, database backup proof, and owner escalation path.', evidence: ['checkpoint', 'rollback preview'] },
    { order: 4, name: `${environment} rollout`, ownerAgent: 'ReleaseAgent', action: regulated ? 'Execute supervised rollout with approval and compliance observer.' : 'Execute rollout with automated smoke and health checks.', evidence: ['deploy log', 'health check'] },
    { order: 5, name: 'Customer and ops handoff', ownerAgent: 'CustomerSuccessAgent', action: 'Send delivery report, activate SLA monitors, and open feedback backlog.', evidence: ['customer report', 'SLA watch'] },
  ];
}

function buildSlaWatch(slaMinutes = 60, environment: ReleaseCommandMission['environment'], regulated: boolean): ReleaseCommandMission['slaWatch'] {
  return {
    responseMinutes: environment === 'production' ? slaMinutes : Math.max(240, slaMinutes),
    breachRisk: regulated && slaMinutes <= 15 ? 'medium' : environment === 'production' ? 'medium' : 'low',
    monitors: ['availability', 'p95 latency', 'error rate', 'database migration health', 'agent/tool failure rate', 'cost anomaly'],
    escalation: environment === 'production'
      ? ['SREAgent', 'ReleaseAgent', 'SecurityAgent', 'CustomerSuccessAgent', 'Executive sponsor']
      : ['SREAgent', 'ReleaseAgent'],
  };
}

function buildFaultRecovery(environment: ReleaseCommandMission['environment'], regulated: boolean, openRisks: string[]): ReleaseCommandMission['faultRecovery'] {
  const base = [
    { failureMode: 'Deployment health check fails', detection: 'Smoke test or p95/error-rate monitor breaches threshold.', recovery: 'Stop rollout, restore checkpoint, notify customer, attach incident evidence.', ownerAgent: 'SREAgent' },
    { failureMode: 'Security blocker discovered', detection: 'Security Center or dependency audit flags critical finding.', recovery: 'Block release, rotate affected secrets, patch dependency, rerun scan.', ownerAgent: 'SecurityAgent' },
    { failureMode: 'Database migration regression', detection: 'Row count, checksum, lock, or query latency gate fails.', recovery: 'Execute rollback plan or expand-contract recovery path from Database Pipeline.', ownerAgent: 'MigrationSafetyAgent' },
  ];
  if (regulated || environment === 'production') {
    base.push({ failureMode: 'Customer SLA breach', detection: 'Response or resolution timer exceeds support plan.', recovery: 'Escalate to incident command, send customer update, create postmortem action.', ownerAgent: 'CustomerSuccessAgent' });
  }
  for (const risk of openRisks.slice(0, 3)) {
    base.push({ failureMode: risk, detection: 'Manual risk owner or telemetry signal reports active risk.', recovery: 'Assign owner, define rollback, update customer report before release.', ownerAgent: 'PMOAgent' });
  }
  return base;
}

function calculateScore(gates: ReleaseGate[]) {
  const points = gates.reduce((total, gateItem) => {
    if (gateItem.status === 'pass') return total + 100;
    if (gateItem.status === 'warn') return total + 55;
    return total;
  }, 0);
  return Math.round(points / gates.length);
}

function buildSummary(productName: string, environment: ReleaseCommandMission['environment'], status: ReleaseCommandMission['status'], blockers: number, score: number) {
  if (status === 'ready-to-launch') return `${productName} is ready for ${environment} launch with release score ${score}%.`;
  if (status === 'blocked') return `${productName} is blocked for ${environment} launch by ${blockers} required gate(s). Release score: ${score}%.`;
  return `${productName} needs review before ${environment} launch. Release score: ${score}%.`;
}

function buildExecutiveBrief(productName: string, status: ReleaseCommandMission['status'], score: number, blockers: number) {
  return `${productName} release posture is ${status} at ${score}%. ${blockers} blocker(s) must be cleared before production customer exposure. AXON packaged gates, evidence, rollback, SLA watch, and fault recovery in one release command record.`;
}

function inferProductName(goal: string) {
  const clean = goal.replace(/\s+/g, ' ').trim();
  return clean.length > 54 ? `${clean.slice(0, 51)}...` : clean || 'AXON Release';
}

export const releaseCommand = new ReleaseCommandService();
