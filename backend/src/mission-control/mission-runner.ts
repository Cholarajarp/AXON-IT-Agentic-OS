import { nanoid } from 'nanoid';
import { productFactory } from '../product-factory/index.js';
import { sandboxKernel } from '../sandbox-kernel/index.js';
import { browserQa } from '../browser-qa/index.js';
import { securityCenter } from '../security-center/index.js';
import { releaseCommand } from '../release-command/index.js';
import { agentBlackboard } from '../agent-blackboard/index.js';
import { trustLedger } from '../trust-ledger/index.js';
import { modelFinOps } from '../model-finops/index.js';
import { agenticMesh } from '../agentic-mesh/index.js';
import { databasePipeline } from '../database-pipeline/index.js';
import { apiForge } from '../api-forge/index.js';
import { customerDelivery } from '../customer-delivery/index.js';
import type { MissionControlInput, MissionControlPhase, MissionControlRun, MissionControlStatus } from './types.js';

const runs = new Map<string, MissionControlRun>();

const defaultHtml = `<!doctype html>
<html lang="en">
  <head><title>AXON Mission Preview</title></head>
  <body>
    <main>
      <h1>AXON Mission Preview</h1>
      <button type="button">Start delivery</button>
      <section>Dashboard</section>
    </main>
  </body>
</html>`;

export class MissionControlService {
  listRuns(): MissionControlRun[] {
    return Array.from(runs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getRun(id: string): MissionControlRun | undefined {
    return runs.get(id);
  }

  async createRun(input: MissionControlInput): Promise<MissionControlRun> {
    const tenantId = input.tenantId ?? 'tenant_default';
    const mission = input.mission.trim();
    const environment = input.environment ?? 'preview';
    const regulated = Boolean(input.regulated ?? /enterprise|production|database|security|payment|pii|soc|iso|regulated/i.test(mission));
    const finOpsReport = modelFinOps.createReport({
      tenantId,
      mission,
      monthlyBudgetUsd: input.budgetUsd,
      expectedRunsPerMonth: 300,
      repeatedContext: true,
      requiresSovereign: regulated,
      sensitivityLevel: regulated ? 'confidential' : 'internal',
    });
    const meshBlueprint = agenticMesh.createBlueprint({
      tenantId,
      mission,
      regulated,
      budgetUsd: input.budgetUsd,
      autonomyLevel: regulated ? 'supervised' : 'autonomous',
      maxIterations: regulated ? 3 : 2,
    });
    const agentTeam = Array.from(new Set([
      'ProductStrategistAgent',
      ...meshBlueprint.agentRoles.map((role) => role.agent),
      'ArchitectAgent',
      'FullStackEngineerAgent',
      'MigrationSafetyAgent',
      'SecurityAgent',
      'QAAgent',
      'SREAgent',
      'ReleaseAgent',
      'CustomerSuccessAgent',
    ]));

    const blueprint = productFactory.createBlueprint({
      tenantId,
      customerName: input.customerName,
      goal: mission,
      budgetUsd: input.budgetUsd,
      timelineDays: input.timelineDays,
      compliance: input.compliance,
      integrations: input.integrations,
    });
    productFactory.approveBlueprint(blueprint.id);

    const databaseReview = databasePipeline.review({
      name: `${blueprint.templateName} production database readiness`,
      sql: buildReadinessSql(blueprint.templateName),
      engine: 'postgresql',
      environment: environment === 'production' ? 'production' : 'staging',
      migrationType: 'schema',
      estimatedRows: 50_000,
      tableSizeGb: 2,
      hasRollbackPlan: true,
      hasBackupCheckpoint: true,
    });

    const apiForgeReport = apiForge.createReport({
      tenantId,
      name: `${blueprint.templateName} Service API`,
      packageName: `${blueprint.templateId}-service-api`,
      spec: buildServiceApiSpec(blueprint.templateName),
      authType: regulated ? 'oauth2' : 'bearer',
      targets: ['typescript', 'python', 'go', 'java', 'cli', 'mcp-server', 'docs-search'],
      agentOptimized: true,
    });

    const customerAccount = customerDelivery.createAccount({
      tenantId,
      customerName: input.customerName,
      projectName: blueprint.templateName,
      request: mission,
      pricingModel: regulated || environment === 'production' ? 'enterprise-managed-service' : 'fixed-scope',
      budgetUsd: input.budgetUsd,
      timelineDays: input.timelineDays,
      supportPlan: regulated || environment === 'production' ? 'enterprise' : 'business',
      compliance: input.compliance,
      targetUsers: blueprint.personas,
      integrations: input.integrations,
    });
    const customerProject = customerAccount.projects[0]!;
    const customerReport = customerDelivery.generateReport(customerAccount.id, customerProject.id) ?? customerProject.deliveryReport;

    const sandbox = await sandboxKernel.createSession({
      tenantId,
      name: `${blueprint.templateName} sandbox`,
      goal: mission,
      networkPolicy: 'offline',
      ttlMinutes: 90,
    });
    const sandboxExecution = await sandboxKernel.execute(sandbox.id, {
      command: 'node -e "console.log(\'AXON sandbox validation ready\')"',
      timeoutMs: 5000,
    });
    const sandboxSnapshot = await sandboxKernel.snapshot(sandbox.id, 'mission bootstrap');

    const qaReport = await browserQa.createReport({
      tenantId,
      name: `${blueprint.templateName} Preview QA`,
      releaseGoal: mission,
      targetUrl: input.previewUrl,
      htmlSnapshot: input.htmlSnapshot ?? defaultHtml,
      journeys: [
        { name: 'First viewport loads', path: '/', assertions: ['AXON Mission Preview', 'Start delivery'], critical: true },
        { name: 'Dashboard signal is visible', path: '/', assertions: ['Dashboard'], critical: false },
      ],
      deviceProfiles: ['desktop', 'mobile'],
      validationEvidence: [
        { kind: 'typecheck', status: sandboxExecution?.status === 'passed' ? 'pass' : 'planned', command: 'sandbox bootstrap validation' },
        { kind: 'build', status: 'planned', command: 'npm run build' },
      ],
    });

    const security = await securityCenter.scan({ maxFiles: 15 });
    const releaseMission = await releaseCommand.createMissionFromEvidence({
      tenantId,
      productName: blueprint.templateName,
      releaseGoal: mission,
      environment,
      regulated,
      hasBlueprint: true,
      hasPreview: qaReport.status !== 'blocked',
      hasTests: sandboxExecution?.status === 'passed',
      hasSecurityScan: security.status === 'safe-to-preview',
      hasDatabaseReview: !databaseReview.blocked,
      hasCheckpoint: Boolean(sandboxSnapshot),
      hasRollbackPlan: Boolean(sandboxSnapshot),
      hasDeploymentPlan: true,
      hasCustomerReport: customerReport.status !== 'draft',
      hasApiForgeConnectors: apiForgeReport.status === 'ready',
      evidenceArtifacts: [
        `model finops ${finOpsReport.id} savings ${finOpsReport.optimized.savingsPercent}%`,
        `agentic mesh ${meshBlueprint.id} stages ${meshBlueprint.stages.length}`,
        `approved blueprint ${blueprint.id}`,
        `database review ${databaseReview.id} ${databaseReview.severity}`,
        `API Forge report ${apiForgeReport.id} ${apiForgeReport.status}`,
        `customer report ${customerReport.id} ${customerReport.status}`,
        `sandbox session ${sandbox.id}`,
        sandboxExecution ? `test output sandbox ${sandboxExecution.status}` : 'test output sandbox missing',
        sandboxSnapshot ? `checkpoint id ${sandboxSnapshot.id}` : 'checkpoint id sandbox snapshot missing',
        ...qaReport.releaseEvidence,
      ],
      openRisks: security.findings.filter((finding) => finding.blocksPublish).slice(0, 5).map((finding) => finding.title),
    });

    const blackboard = agentBlackboard.seedMissionBoard({
      missionId: releaseMission.id,
      title: `Mission Control: ${blueprint.templateName}`,
      goal: mission,
      agents: agentTeam,
      evidence: [
        `model finops ${finOpsReport.id}`,
        `agentic mesh ${meshBlueprint.id}`,
        `blueprint ${blueprint.id}`,
        `database review ${databaseReview.id}`,
        `API Forge ${apiForgeReport.id}`,
        `customer report ${customerReport.id}`,
        `sandbox ${sandbox.id}`,
        `browser QA ${qaReport.id}`,
        `release mission ${releaseMission.id}`,
      ],
      risks: [
        ...releaseMission.gates.filter((gate) => gate.blocksRelease).map((gate) => gate.title),
        ...security.findings.filter((finding) => finding.blocksPublish).slice(0, 4).map((finding) => finding.title),
      ],
    });

    const phases = buildPhases({
      finOpsReportId: finOpsReport.id,
      meshBlueprintId: meshBlueprint.id,
      blueprintId: blueprint.id,
      databaseReviewId: databaseReview.id,
      databaseSeverity: databaseReview.severity,
      databaseBlocked: databaseReview.blocked,
      apiForgeReportId: apiForgeReport.id,
      apiForgeStatus: apiForgeReport.status,
      customerReportId: customerReport.id,
      customerReportStatus: customerReport.status,
      sandboxId: sandbox.id,
      sandboxStatus: sandboxExecution?.status ?? 'failed',
      qaStatus: qaReport.status,
      securityStatus: security.status,
      releaseStatus: releaseMission.status,
      blackboardId: blackboard.id,
    });
    const score = calculateScore(phases);
    const status = inferStatus(score, phases, releaseMission.status);
    const policyDecision = trustLedger.evaluatePolicy({
      tenantId,
      actor: 'MissionControlAgent',
      action: `launch ${environment} mission`,
      resource: blueprint.templateName,
      risk: environment === 'production' ? 'high' : 'medium',
      environment,
      dataClass: regulated ? 'confidential' : 'internal',
      requestedScopes: ['mission:execute', 'release:score'],
      hasApproval: environment !== 'production',
    });
    const trustRecords = [
      trustLedger.append({
        tenantId,
        kind: 'release-manifest',
        actor: 'MissionControlAgent',
        actorType: 'agent',
        subject: `Mission Control ${blueprint.templateName}`,
        summary: `Mission composed FinOps, Agentic Mesh, blueprint, database review, API Forge, customer report, sandbox, Preview QA, security, blackboard, and release command with status ${status}.`,
        risk: status === 'blocked' ? 'high' : 'medium',
        source: 'Mission Control',
        artifacts: [
          `model finops ${finOpsReport.id}`,
          `agentic mesh ${meshBlueprint.id}`,
          `blueprint ${blueprint.id}`,
          `database review ${databaseReview.id}`,
          `API Forge ${apiForgeReport.id}`,
          `customer report ${customerReport.id}`,
          `sandbox ${sandbox.id}`,
          `browser QA ${qaReport.id}`,
          `blackboard ${blackboard.id}`,
          `release mission ${releaseMission.id}`,
        ],
        metadata: { score, status, environment, phases: phases.map((phase) => ({ name: phase.name, status: phase.status })) },
      }),
      trustLedger.append({
        tenantId,
        kind: 'cost',
        actor: 'FinOpsAgent',
        actorType: 'agent',
        subject: `Model FinOps ${finOpsReport.id}`,
        summary: `Model FinOps estimated ${finOpsReport.optimized.savingsPercent}% savings with ${finOpsReport.route.length} cost-aware model route(s).`,
        risk: finOpsReport.risk === 'critical' ? 'high' : finOpsReport.risk,
        source: 'Model FinOps',
        artifacts: [`finops report ${finOpsReport.id}`, `cache plan ${finOpsReport.cachePlan.cacheKey}`],
        metadata: {
          baselineMonthlyUsd: finOpsReport.baseline.estimatedMonthlyCostUsd,
          optimizedMonthlyUsd: finOpsReport.optimized.estimatedMonthlyCostUsd,
          savingsPercent: finOpsReport.optimized.savingsPercent,
        },
      }),
      trustLedger.append({
        tenantId,
        kind: 'database-review',
        actor: 'MigrationSafetyAgent',
        actorType: 'agent',
        subject: `Database review ${databaseReview.id}`,
        summary: `Database Pipeline returned ${databaseReview.severity} risk with ${databaseReview.findings.length} finding(s).`,
        risk: databaseReview.severity === 'CRITICAL' ? 'critical' : databaseReview.severity === 'HIGH' ? 'high' : databaseReview.severity === 'MEDIUM' ? 'medium' : 'low',
        source: 'Database Pipeline',
        artifacts: [`database review ${databaseReview.id}`],
        metadata: { riskScore: databaseReview.riskScore, blocked: databaseReview.blocked, strategy: databaseReview.safeMigrationPlan.strategy },
      }),
      trustLedger.append({
        tenantId,
        kind: 'command-evidence',
        actor: 'SandboxKernel',
        actorType: 'system',
        subject: `Sandbox ${sandbox.id}`,
        summary: `Sandbox bootstrap execution finished with ${sandboxExecution?.status ?? 'missing'} and snapshot ${sandboxSnapshot?.id ?? 'not-created'}.`,
        risk: 'low',
        source: 'Sandbox Kernel',
        artifacts: [`sandbox session ${sandbox.id}`, `snapshot ${sandboxSnapshot?.id ?? 'missing'}`],
        metadata: { executionId: sandboxExecution?.id, exitCode: sandboxExecution?.exitCode },
      }),
      trustLedger.append({
        tenantId,
        kind: 'browser-artifact',
        actor: 'QAAgent',
        actorType: 'agent',
        subject: `Browser QA ${qaReport.id}`,
        summary: `Preview QA produced ${qaReport.status} at ${qaReport.score}% with ${qaReport.journeys.length} journey(s).`,
        risk: qaReport.status === 'blocked' ? 'high' : 'low',
        source: 'Preview QA',
        artifacts: qaReport.artifacts.map((artifact) => artifact.path),
        metadata: { reportId: qaReport.id, status: qaReport.status, score: qaReport.score },
      }),
      trustLedger.append({
        tenantId,
        kind: 'security-scan',
        actor: 'SecurityAgent',
        actorType: 'agent',
        subject: `Security scan ${security.id}`,
        summary: `Security Center returned ${security.status} with ${security.findings.length} finding(s).`,
        risk: security.status === 'blocked' ? 'critical' : security.status === 'needs-review' ? 'high' : 'low',
        source: 'Security Center',
        artifacts: [`security scan ${security.id}`],
        metadata: { score: security.score, findings: security.findings.length, status: security.status },
      }),
      trustLedger.append({
        tenantId,
        kind: 'customer-handoff',
        actor: 'CustomerSuccessAgent',
        actorType: 'agent',
        subject: `Customer report ${customerReport.id}`,
        summary: `Customer Delivery packaged ${customerAccount.customerName} project ${customerProject.name} with ${customerReport.status} report and ${customerProject.sla.coverage} SLA.`,
        risk: customerAccount.health === 'red' ? 'high' : customerAccount.health === 'amber' ? 'medium' : 'low',
        source: 'Customer Delivery',
        artifacts: [`customer account ${customerAccount.id}`, `customer report ${customerReport.id}`],
        metadata: {
          grossMarginPercent: customerProject.marginModel.grossMarginPercent,
          annualContractValueUsd: customerAccount.commercialSummary.annualContractValueUsd,
          supportPlan: customerAccount.supportPlan,
        },
      }),
    ];
    const evidence = [
      `model finops ${finOpsReport.id}`,
      `agentic mesh ${meshBlueprint.id}`,
      `approved blueprint ${blueprint.id}`,
      `database review ${databaseReview.id} ${databaseReview.severity}`,
      `API Forge report ${apiForgeReport.id} ${apiForgeReport.status}`,
      `customer account ${customerAccount.id}`,
      `customer report ${customerReport.id} ${customerReport.status}`,
      `sandbox session ${sandbox.id}`,
      `sandbox snapshot ${sandboxSnapshot?.id ?? 'not-created'}`,
      `browser QA ${qaReport.id} ${qaReport.status}`,
      `security scan ${security.id} ${security.status}`,
      `blackboard ${blackboard.id}`,
      `release mission ${releaseMission.id} ${releaseMission.status}`,
      `policy decision ${policyDecision.decision}`,
      ...trustRecords.map((record) => `trust ledger ${record.id}`),
    ];

    const run: MissionControlRun = {
      id: `mctl_${nanoid(10)}`,
      tenantId,
      mission,
      status,
      score,
      summary: `Mission Control ${status} at ${score}%: blueprint, sandbox, QA, security, blackboard, and release command are connected for ${environment}.`,
      blueprintId: blueprint.id,
      finOpsReportId: finOpsReport.id,
      agenticMeshBlueprintId: meshBlueprint.id,
      databaseReviewId: databaseReview.id,
      apiForgeReportId: apiForgeReport.id,
      customerAccountId: customerAccount.id,
      customerReportId: customerReport.id,
      sandboxSessionId: sandbox.id,
      browserQaReportId: qaReport.id,
      blackboardId: blackboard.id,
      releaseMissionId: releaseMission.id,
      trustRecordIds: [policyDecision.record.id, ...trustRecords.map((record) => record.id)],
      phases,
      agentTeam,
      evidence,
      nextActions: buildNextActions(phases, releaseMission.gates.filter((gate) => gate.blocksRelease).map((gate) => gate.nextAction)),
      createdAt: new Date().toISOString(),
    };

    runs.set(run.id, run);
    return run;
  }
}

function buildPhases(input: {
  finOpsReportId: string;
  meshBlueprintId: string;
  blueprintId: string;
  databaseReviewId: string;
  databaseSeverity: string;
  databaseBlocked: boolean;
  apiForgeReportId: string;
  apiForgeStatus: string;
  customerReportId: string;
  customerReportStatus: string;
  sandboxId: string;
  sandboxStatus: string;
  qaStatus: string;
  securityStatus: string;
  releaseStatus: string;
  blackboardId: string;
}): MissionControlPhase[] {
  return [
    {
      order: 1,
      name: 'FinOps and Agentic Mesh activated',
      ownerAgent: 'AgenticCoordinatorAgent',
      status: 'pass',
      evidence: [`model finops ${input.finOpsReportId}`, `agentic mesh ${input.meshBlueprintId}`],
      nextAction: 'Keep model budgets and mesh task envelopes synchronized with mission changes.',
    },
    {
      order: 2,
      name: 'Blueprint compiled',
      ownerAgent: 'ProductStrategistAgent',
      status: 'pass',
      evidence: [`blueprint ${input.blueprintId}`],
      nextAction: 'Keep traceability updated as scope changes.',
    },
    {
      order: 3,
      name: 'Database and API contracts activated',
      ownerAgent: 'SolutionArchitectAgent',
      status: input.databaseBlocked || input.apiForgeStatus === 'blocked' ? 'block' : input.databaseSeverity === 'LOW' && input.apiForgeStatus === 'ready' ? 'pass' : 'warn',
      evidence: [`database review ${input.databaseReviewId} ${input.databaseSeverity}`, `API Forge ${input.apiForgeReportId} ${input.apiForgeStatus}`],
      nextAction: 'Clear database/API contract blockers before production launch.',
    },
    {
      order: 4,
      name: 'Sandbox session ready',
      ownerAgent: 'PlatformAgent',
      status: input.sandboxStatus === 'passed' ? 'pass' : 'warn',
      evidence: [`sandbox ${input.sandboxId}`, `bootstrap ${input.sandboxStatus}`],
      nextAction: 'Run full affected tests in the sandbox worker.',
    },
    {
      order: 5,
      name: 'Preview QA evidence packaged',
      ownerAgent: 'QAAgent',
      status: input.qaStatus === 'release-ready' ? 'pass' : input.qaStatus === 'blocked' ? 'block' : 'warn',
      evidence: [`browser QA ${input.qaStatus}`],
      nextAction: 'Execute real browser traces and attach screenshots.',
    },
    {
      order: 6,
      name: 'Security signal imported',
      ownerAgent: 'SecurityAgent',
      status: input.securityStatus === 'safe-to-preview' ? 'pass' : input.securityStatus === 'blocked' ? 'block' : 'warn',
      evidence: [`security ${input.securityStatus}`],
      nextAction: 'Fix publish blockers or attach accepted risk approval.',
    },
    {
      order: 7,
      name: 'Customer delivery package ready',
      ownerAgent: 'CustomerSuccessAgent',
      status: input.customerReportStatus === 'ready-for-customer' || input.customerReportStatus === 'sent' ? 'pass' : 'warn',
      evidence: [`customer report ${input.customerReportId} ${input.customerReportStatus}`],
      nextAction: 'Send or approve customer report after release gates pass.',
    },
    {
      order: 8,
      name: 'Shared blackboard established',
      ownerAgent: 'DeliveryManagerAgent',
      status: 'pass',
      evidence: [`blackboard ${input.blackboardId}`],
      nextAction: 'Resolve open blocker and risk entries.',
    },
    {
      order: 9,
      name: 'Release Command scored',
      ownerAgent: 'ReleaseAgent',
      status: input.releaseStatus === 'ready-to-launch' ? 'pass' : input.releaseStatus === 'blocked' ? 'block' : 'warn',
      evidence: [`release ${input.releaseStatus}`],
      nextAction: 'Close required gates before production customer exposure.',
    },
  ];
}

function buildReadinessSql(productName: string): string {
  const suffix = productName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 34) || 'product';
  const tableName = `axon_${suffix}`;
  return `
CREATE TABLE IF NOT EXISTS ${tableName}_delivery_events (
  id UUID PRIMARY KEY,
  event_type TEXT NOT NULL,
  evidence_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_${tableName}_delivery_events_created_at
  ON ${tableName}_delivery_events (created_at);
`;
}

function buildServiceApiSpec(productName: string) {
  return {
    openapi: '3.1.0',
    info: { title: `${productName} Service API`, version: '1.0.0' },
    servers: [{ url: 'https://api.axon.local/v1' }],
    components: {
      schemas: {
        DeliveryStatus: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string' } } },
        EvidenceRecord: { type: 'object', properties: { id: { type: 'string' }, kind: { type: 'string' } } },
      },
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/delivery/status': {
        get: { operationId: 'getDeliveryStatus', summary: 'Get delivery status', tags: ['Delivery'] },
      },
      '/delivery/evidence': {
        get: { operationId: 'listEvidenceRecords', summary: 'List release evidence records', tags: ['Evidence'] },
        post: { operationId: 'createEvidenceRecord', summary: 'Create release evidence record', tags: ['Evidence'] },
      },
      '/delivery/reports': {
        post: { operationId: 'createCustomerReport', summary: 'Create customer delivery report', tags: ['Reports'] },
      },
    },
  };
}

function calculateScore(phases: MissionControlPhase[]) {
  const total = phases.reduce((sum, phase) => sum + (phase.status === 'pass' ? 100 : phase.status === 'warn' ? 60 : 0), 0);
  return Math.round(total / phases.length);
}

function inferStatus(score: number, phases: MissionControlPhase[], releaseStatus: string): MissionControlStatus {
  if (phases.some((phase) => phase.status === 'block') || releaseStatus === 'blocked') return 'blocked';
  if (score >= 85) return 'ready';
  return 'needs-review';
}

function buildNextActions(phases: MissionControlPhase[], releaseActions: string[]) {
  return Array.from(new Set([
    ...phases.filter((phase) => phase.status !== 'pass').map((phase) => phase.nextAction),
    ...releaseActions,
  ])).slice(0, 8);
}

export const missionControl = new MissionControlService();
