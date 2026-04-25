import { nanoid } from 'nanoid';
import { missionControl } from '../mission-control/index.js';
import { productFactory } from '../product-factory/index.js';
import { modelFinOps } from '../model-finops/index.js';
import { agenticMesh } from '../agentic-mesh/index.js';
import { apiForge } from '../api-forge/index.js';
import { customerDelivery } from '../customer-delivery/index.js';
import { releaseCommand } from '../release-command/index.js';
import { browserQa } from '../browser-qa/index.js';
import { trustLedger } from '../trust-ledger/index.js';
import { agentBlackboard } from '../agent-blackboard/index.js';
import { artifactService } from '../artifacts/index.js';
import { productionRuntime } from '../production-runtime/index.js';
import type {
  ProductionActivationResult,
  ProductionCapability,
  ProductionReadinessInput,
  ProductionReadinessReport,
  ProductionServiceOffer,
} from './types.js';

const reports = new Map<string, ProductionReadinessReport>();
const activations = new Map<string, ProductionActivationResult>();

export class ProductionReadinessService {
  listReports(): ProductionReadinessReport[] {
    return Array.from(reports.values()).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }

  getReport(id: string): ProductionReadinessReport | undefined {
    return reports.get(id);
  }

  listActivations(): ProductionActivationResult[] {
    return Array.from(activations.values()).sort((a, b) => b.id.localeCompare(a.id));
  }

  async createReport(input: ProductionReadinessInput = {}): Promise<ProductionReadinessReport> {
    const tenantId = input.tenantId ?? 'tenant_default';
    const mission = input.mission?.trim() || 'Activate AXON as a production-ready AI IT agentic OS for product and service delivery.';
    const runtime = await productionRuntime.status();
    const capabilities = buildCapabilities(tenantId);
    const serviceOffers = buildServiceOffers(capabilities);
    const capabilityBlockers = capabilities.flatMap((capability) =>
      capability.level === 'production-blocked' || capability.status === 'inactive'
        ? [`${capability.name}: ${capability.gaps[0] ?? 'activation required'}`]
        : [],
    );
    const blockers = [...capabilityBlockers, ...runtime.blockers.map((blocker) => `Runtime: ${blocker}`)];
    const score = Math.round(capabilities.reduce((sum, capability) => {
      const statusScore = capability.status === 'active' ? 100 : capability.status === 'partial' ? 60 : 0;
      const levelPenalty = capability.level === 'prototype' ? 20 : capability.level === 'production-blocked' ? 45 : 0;
      return sum + Math.max(0, statusScore - levelPenalty);
    }, 0) / capabilities.length);
    const status = blockers.length > 0 || !runtime.productionReady
      ? score >= 70 && runtime.blockers.length === 0 ? 'pilot-ready' : 'blocked'
      : 'production-loop-ready';

    const report: ProductionReadinessReport = {
      id: `prod_${nanoid(10)}`,
      tenantId,
      generatedAt: new Date().toISOString(),
      mission,
      status,
      score,
      summary: status === 'production-loop-ready'
        ? 'AXON has an active production delivery loop with evidence across intake, agent mesh, FinOps, data, API, QA, security, release, and customer handoff.'
        : 'AXON has strong activated services, but some production adapters or evidence gates still need work before broad customer launch.',
      capabilities,
      serviceOffers,
      blockers,
      nextActions: [
        'Use Production Readiness activation to create one full Mission Control run before selling any service.',
        'Treat production-loop-ready as externally claimable only when runtime gates pass: database, artifacts, signing, deployment, browser worker, and secrets.',
        'Attach Trust Ledger export packs to customer-ready releases.',
        'Prioritize inactive or production-blocked capabilities before adding new surface area.',
      ],
      runtime: {
        status: runtime.status,
        score: runtime.score,
        productionReady: runtime.productionReady,
        blockers: runtime.blockers,
      },
      activationFlow: [
        { order: 1, stage: 'Intake', service: 'Product Factory', evidence: ['approved blueprint', 'scope/non-goals', 'cost estimate'] },
        { order: 2, stage: 'Plan', service: 'Agentic Mesh + Model FinOps', evidence: ['mesh blueprint', 'model route', 'cache policy', 'agent budgets'] },
        { order: 3, stage: 'Build', service: 'Sandbox Kernel + Code/Tools', evidence: ['command evidence', 'checkpoint', 'file claims'] },
        { order: 4, stage: 'Validate', service: 'Database Pipeline + API Forge + Preview QA + Security Center', evidence: ['database review', 'API package', 'browser QA', 'security scan'] },
        { order: 5, stage: 'Release', service: 'Release Command + Trust Ledger', evidence: ['release manifest', 'policy decision', 'signed records'] },
        { order: 6, stage: 'Deliver', service: 'Customer Delivery', evidence: ['customer report', 'SLA', 'feedback backlog', 'margin model'] },
      ],
    };

    reports.set(report.id, report);
    return report;
  }

  async activate(input: ProductionReadinessInput = {}): Promise<ProductionActivationResult> {
    const tenantId = input.tenantId ?? 'tenant_default';
    const mission = input.mission?.trim() || 'Activate AXON as a production-ready AI IT agentic OS with product build, database safety, API connectors, QA, security, release, and customer delivery.';
    const run = await missionControl.createRun({
      tenantId,
      customerName: input.customerName ?? 'Production Customer',
      mission,
      environment: input.environment ?? 'staging',
      regulated: input.regulated ?? true,
      budgetUsd: 250_000,
      timelineDays: 45,
      compliance: ['SOC 2', 'ISO 27001'],
      integrations: ['GitHub', 'PostgreSQL', 'ServiceNow', 'Datadog', 'Slack'],
    });
    const artifact = artifactService.put({
      tenantId,
      kind: 'release-pack',
      name: 'production-readiness-activation-pack',
      content: {
        missionControlRunId: run.id,
        releaseMissionId: run.releaseMissionId,
        evidence: run.evidence,
        phases: run.phases,
        generatedAt: new Date().toISOString(),
      },
      metadata: { source: 'Production Readiness', mission },
    });
    trustLedger.append({
      tenantId,
      kind: 'release-manifest',
      actor: 'ProductionReadinessAgent',
      actorType: 'agent',
      subject: `Activation artifact ${artifact.id}`,
      summary: `Production readiness activation pack stored with sha256 ${artifact.sha256}.`,
      risk: 'medium',
      source: 'Artifact Store',
      artifacts: [artifact.uri],
      metadata: { artifactId: artifact.id, sha256: artifact.sha256, bytes: artifact.bytes },
    });
    const report = await this.createReport({ ...input, tenantId, mission });
    const activatedCapabilityIds = report.capabilities
      .filter((capability) => capability.status === 'active')
      .map((capability) => capability.id);
    const result: ProductionActivationResult = {
      id: `act_${nanoid(10)}`,
      tenantId,
      missionControlRunId: run.id,
      releaseMissionId: run.releaseMissionId,
      activatedCapabilityIds,
      report,
    };
    activations.set(result.id, result);
    return result;
  }
}

function buildCapabilities(tenantId: string): ProductionCapability[] {
  const latestRun = missionControl.listRuns().find((run) => run.tenantId === tenantId);
  const blueprints = productFactory.listBlueprints().filter((blueprint) => blueprint.tenantId === tenantId);
  const finOpsReports = modelFinOps.listReports().filter((report) => report.tenantId === tenantId);
  const meshBlueprints = agenticMesh.listBlueprints().filter((blueprint) => blueprint.tenantId === tenantId);
  const apiReports = apiForge.listReports().filter((report) => report.tenantId === tenantId);
  const customerAccounts = customerDelivery.listAccounts().filter((account) => account.tenantId === tenantId);
  const releaseMissions = releaseCommand.listMissions().filter((mission) => mission.tenantId === tenantId);
  const qaReports = browserQa.listReports().filter((report) => report.tenantId === tenantId);
  const trustRecords = trustLedger.listRecords({ tenantId, limit: 500 });
  const boards = agentBlackboard.listBoards().filter((board) => board.tenantId === tenantId);

  return [
    capability({
      id: 'product-factory',
      name: 'Product Factory intake',
      category: 'intake',
      ownerAgent: 'ProductStrategistAgent',
      routeOrSurface: '/build, /product-factory',
      productionUse: 'Converts customer requests into scoped product/service blueprints.',
      evidence: blueprints.map((blueprint) => `blueprint ${blueprint.id} ${blueprint.status}`),
      active: blueprints.some((blueprint) => ['approved', 'ready-for-execution', 'executing'].includes(blueprint.status)),
      gaps: ['Connect contract approval and signature workflow for external customers.'],
    }),
    capability({
      id: 'agentic-mesh',
      name: 'Agentic Mesh team planner',
      category: 'agentic',
      ownerAgent: 'AgenticCoordinatorAgent',
      routeOrSurface: '/agentic-finops, /agentic-mesh',
      productionUse: 'Creates topology, task envelopes, shared state, critic loops, and human gates.',
      evidence: meshBlueprints.map((blueprint) => `mesh ${blueprint.id} ${blueprint.topologies.join('+')}`),
      active: meshBlueprints.length > 0 || Boolean(latestRun?.agenticMeshBlueprintId),
      gaps: ['Persist task envelopes and execute parallel workers through isolated runtime sessions.'],
    }),
    capability({
      id: 'model-finops',
      name: 'Model FinOps routing',
      category: 'agentic',
      ownerAgent: 'FinOpsAgent',
      routeOrSurface: '/agentic-finops, /models, /cost',
      productionUse: 'Controls API spend with cache-first routes, budgets, and escalation gates.',
      evidence: finOpsReports.map((report) => `finops ${report.id} savings ${report.optimized.savingsPercent}%`),
      active: finOpsReports.length > 0 || Boolean(latestRun?.finOpsReportId),
      gaps: ['Record actual provider/cache hit metrics for every live model invocation.'],
    }),
    capability({
      id: 'sandbox-kernel',
      name: 'Sandbox execution kernel',
      category: 'engineering',
      ownerAgent: 'PlatformAgent',
      routeOrSurface: '/mission-control, /terminal',
      productionUse: 'Executes gated commands and captures snapshots before release.',
      evidence: latestRun ? [`sandbox ${latestRun.sandboxSessionId}`] : [],
      active: Boolean(latestRun?.sandboxSessionId),
      gaps: ['Add Docker/Kubernetes/E2B providers and artifact storage for long-running customer work.'],
    }),
    capability({
      id: 'database-pipeline',
      name: 'Database Pipeline',
      category: 'data',
      ownerAgent: 'MigrationSafetyAgent',
      routeOrSurface: '/database',
      productionUse: 'Blocks unsafe schema/data changes and produces rollout/rollback quality gates.',
      evidence: latestRun?.databaseReviewId ? [`database review ${latestRun.databaseReviewId}`] : [],
      active: Boolean(latestRun?.databaseReviewId || trustRecords.some((record) => record.kind === 'database-review')),
      gaps: ['Persist reviews and connect to live database migration execution telemetry.'],
    }),
    capability({
      id: 'api-forge',
      name: 'API Forge connectors',
      category: 'engineering',
      ownerAgent: 'IntegrationAgent',
      routeOrSurface: '/api-forge',
      productionUse: 'Generates typed SDK/CLI/MCP/doc-search plans for product and customer APIs.',
      evidence: apiReports.map((report) => `API Forge ${report.id} ${report.status}`),
      active: apiReports.some((report) => report.status === 'ready') || Boolean(latestRun?.apiForgeReportId),
      gaps: ['Write generated packages to a workspace and publish signed artifacts.'],
    }),
    capability({
      id: 'preview-qa',
      name: 'Preview QA',
      category: 'engineering',
      ownerAgent: 'QAAgent',
      routeOrSurface: '/preview-qa',
      productionUse: 'Packages browser journeys, accessibility findings, and Playwright evidence.',
      evidence: qaReports.map((report) => `browser QA ${report.id} ${report.status}`),
      active: qaReports.length > 0 || Boolean(latestRun?.browserQaReportId),
      gaps: ['Replace synthetic trace plans with real Playwright execution videos and screenshots.'],
    }),
    capability({
      id: 'security-center',
      name: 'Security Center',
      category: 'security',
      ownerAgent: 'SecurityAgent',
      routeOrSurface: '/security',
      productionUse: 'Scans secrets, dependencies, unsafe code, database risks, and publish blockers.',
      evidence: trustRecords.filter((record) => record.kind === 'security-scan').map((record) => `security scan ${record.subject}`),
      active: trustRecords.some((record) => record.kind === 'security-scan'),
      gaps: ['Add SAST/DAST provider integrations and auto-fix pull request generation.'],
    }),
    capability({
      id: 'release-command',
      name: 'Release Command',
      category: 'release',
      ownerAgent: 'ReleaseAgent',
      routeOrSurface: '/release-command',
      productionUse: 'Scores product, test, security, database, deployment, customer, connector, and evidence gates.',
      evidence: releaseMissions.map((mission) => `release ${mission.id} ${mission.status}`),
      active: releaseMissions.length > 0 || Boolean(latestRun?.releaseMissionId),
      gaps: ['Connect real deployment adapters for canary, rollback, and health checks.'],
    }),
    capability({
      id: 'trust-ledger',
      name: 'Trust Ledger',
      category: 'governance',
      ownerAgent: 'ComplianceAgent',
      routeOrSurface: '/trust-ledger',
      productionUse: 'Creates signed, hash-chained release, policy, cost, database, browser, security, and customer records.',
      evidence: [`${trustRecords.length} trust record(s)`],
      active: trustRecords.length >= 5,
      gaps: ['Move signing key to KMS/HSM and persist ledger records in durable storage.'],
    }),
    capability({
      id: 'agent-blackboard',
      name: 'Agent Blackboard',
      category: 'agentic',
      ownerAgent: 'DeliveryManagerAgent',
      routeOrSurface: '/mission-control, /agent-blackboard',
      productionUse: 'Shares decisions, risks, evidence, and file claims across agent teams.',
      evidence: boards.map((board) => `blackboard ${board.id}`),
      active: boards.length > 0 || Boolean(latestRun?.blackboardId),
      gaps: ['Persist blackboard entries and enforce file-claim conflict checks inside workers.'],
    }),
    capability({
      id: 'customer-delivery',
      name: 'Customer Delivery',
      category: 'customer',
      ownerAgent: 'CustomerSuccessAgent',
      routeOrSurface: '/customer-delivery',
      productionUse: 'Packages SOW, milestones, SLA, margin, delivery report, and feedback backlog.',
      evidence: customerAccounts.flatMap((account) => account.projects.map((project) => `customer ${account.id} report ${project.deliveryReport.status}`)),
      active: customerAccounts.some((account) => account.projects.some((project) => project.deliveryReport.status !== 'draft')) || Boolean(latestRun?.customerReportId),
      gaps: ['Integrate billing/CRM and send customer reports through approved communication channels.'],
    }),
  ];
}

function capability(input: Omit<ProductionCapability, 'status' | 'level' | 'activationAction'> & { active: boolean }): ProductionCapability {
  const status = input.active ? 'active' : input.evidence.length > 0 ? 'partial' : 'inactive';
  const level = status === 'inactive'
    ? 'production-blocked'
    : input.gaps.length > 0
      ? 'production-loop'
      : 'production-loop';
  return {
    id: input.id,
    name: input.name,
    category: input.category,
    status,
    level,
    ownerAgent: input.ownerAgent,
    routeOrSurface: input.routeOrSurface,
    productionUse: input.productionUse,
    evidence: input.evidence.length ? input.evidence : ['not activated in current tenant'],
    gaps: input.gaps,
    activationAction: status === 'active'
      ? 'Keep attached to Mission Control and Trust Ledger evidence.'
      : 'Run Production Readiness activation to create connected Mission Control evidence.',
  };
}

function buildServiceOffers(capabilities: ProductionCapability[]): ProductionServiceOffer[] {
  const active = new Set(capabilities.filter((capability) => capability.status === 'active').map((capability) => capability.id));
  return [
    offer('saas-mvp-delivery', 'Production SaaS MVP Delivery', 'fixed-scope', ['product-factory', 'agentic-mesh', 'model-finops', 'sandbox-kernel', 'preview-qa', 'security-center', 'release-command', 'customer-delivery'], active),
    offer('database-safe-modernization', 'Database-Safe App Modernization', 'fixed-scope', ['product-factory', 'database-pipeline', 'security-center', 'release-command', 'trust-ledger', 'customer-delivery'], active),
    offer('managed-ai-it-ops', 'Managed AI IT Operations', 'enterprise-managed-service', ['agentic-mesh', 'model-finops', 'release-command', 'trust-ledger', 'agent-blackboard', 'customer-delivery'], active),
    offer('api-agent-enablement', 'API and Agent Connector Enablement', 'usage-based', ['api-forge', 'security-center', 'model-finops', 'trust-ledger', 'customer-delivery'], active),
  ];
}

function offer(
  id: string,
  name: string,
  priceModel: ProductionServiceOffer['priceModel'],
  includedCapabilities: string[],
  active: Set<string>,
): ProductionServiceOffer {
  const blockers = includedCapabilities.filter((capability) => !active.has(capability));
  return {
    id,
    name,
    ready: blockers.length === 0,
    priceModel,
    includedCapabilities,
    requiredEvidence: ['approved scope', 'agent mesh', 'model budget', 'validation artifacts', 'release manifest', 'customer report'],
    blockers,
  };
}

export const productionReadiness = new ProductionReadinessService();
