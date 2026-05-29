import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import websocket from '@fastify/websocket';
import { checkConnection, closeConnection } from './db/connection.js';
import { registerWorkflowRoutes } from './routes/workflows.js';
import { registerAgentRoutes } from './routes/agents.js';
import { registerApprovalRoutes } from './routes/approvals.js';
import { registerAlertRoutes } from './routes/alerts.js';
import { registerIncidentRoutes } from './routes/incidents.js';
import { registerPolicyRoutes } from './routes/policies.js';
import { registerEvidenceRoutes } from './routes/evidence.js';
import { registerAuditRoutes } from './routes/audit.js';
import { registerMemoryRoutes } from './routes/memory.js';
import { registerCostRoutes } from './routes/cost.js';
import { registerExecutiveRoutes } from './routes/executive.js';
import { registerOrchestratorRoutes } from './routes/orchestrator.js';
import { registerStreamRoutes } from './routes/stream.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerModelRoutes } from './routes/models.js';
import { registerToolRoutes } from './routes/tools.js';
import { registerCodeIntelligenceRoutes } from './routes/code-intelligence.js';
import { registerProductFactoryRoutes } from './routes/product-factory.js';
import { registerSkillRoutes } from './routes/skills.js';
import { registerDatabasePipelineRoutes } from './routes/database-pipeline.js';
import { registerEnterpriseOsRoutes } from './routes/enterprise-os.js';
import { registerSecurityCenterRoutes } from './routes/security-center.js';
import { registerCheckpointRoutes } from './routes/checkpoints.js';
import { registerServiceDeskRoutes } from './routes/service-desk.js';
import { registerManagedServicesRoutes } from './routes/managed-services.js';
import { registerSkillAcademyRoutes } from './routes/skill-academy.js';
import { registerAutonomousWorkforceRoutes } from './routes/autonomous-workforce.js';
import { registerCompanyOsRoutes } from './routes/company-os.js';
import { registerDeliveryBrainRoutes } from './routes/delivery-brain.js';
import { registerStructureGuardianRoutes } from './routes/structure-guardian.js';
import { registerCustomerDeliveryRoutes } from './routes/customer-delivery.js';
import { registerApiForgeRoutes } from './routes/api-forge.js';
import { registerReleaseCommandRoutes } from './routes/release-command.js';
import { registerBrowserQaRoutes } from './routes/browser-qa.js';
import { registerSandboxKernelRoutes } from './routes/sandbox-kernel.js';
import { registerAgentBlackboardRoutes } from './routes/agent-blackboard.js';
import { registerMissionControlRoutes } from './routes/mission-control.js';
import { registerMarketRadarRoutes } from './routes/market-radar.js';
import { registerTrustLedgerRoutes } from './routes/trust-ledger.js';
import { registerModelFinOpsRoutes } from './routes/model-finops.js';
import { registerAgenticMeshRoutes } from './routes/agentic-mesh.js';
import { registerProductionReadinessRoutes } from './routes/production-readiness.js';
import { registerArtifactRoutes } from './routes/artifacts.js';
import { registerProductionRuntimeRoutes } from './routes/production-runtime.js';
import { registerAgentProjectRoutes } from './routes/agent-projects.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { auditChain } from './services/audit-chain.js';
import { registerWsGateway } from './ws/gateway.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const BODY_LIMIT_BYTES = parseInt(process.env.AXON_API_BODY_LIMIT_BYTES || '2097152', 10);

function serviceIndex() {
  return {
    name: 'AXON IT Agentic OS API',
    status: 'running',
    apiBase: '/api/v1',
    health: '/api/v1/health',
    liveness: '/api/v1/health/live',
    readiness: '/api/v1/health/ready',
    settings: '/api/v1/settings',
    agentProjects: '/api/v1/agent-projects/projects',
    productionReadiness: '/api/v1/production-readiness/reports',
    message: 'Backend is running. Use the /api/v1 routes for application data.',
  };
}

async function main() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    bodyLimit: BODY_LIMIT_BYTES,
  });

  // Plugins
  await app.register(cors, {
    origin: parseCorsOrigin(process.env.CORS_ORIGIN),
    credentials: true,
  });
  await app.register(helmet, {
    contentSecurityPolicy:
      process.env.NODE_ENV === 'production'
        ? {
            directives: {
              defaultSrc: ["'self'"],
              baseUri: ["'self'"],
              frameAncestors: ["'none'"],
              objectSrc: ["'none'"],
            },
          }
        : false,
  });
  await app.register(compress);
  await app.register(websocket);

  app.get('/', async () => serviceIndex());

  // API Routes — all prefixed under /api/v1
  await app.register(
    async (api) => {
      api.get('/', async () => serviceIndex());
      await api.register(registerHealthRoutes);
      await api.register(registerWorkflowRoutes);
      await api.register(registerAgentRoutes);
      await api.register(registerApprovalRoutes);
      await api.register(registerAlertRoutes);
      await api.register(registerIncidentRoutes);
      await api.register(registerPolicyRoutes);
      await api.register(registerEvidenceRoutes);
      await api.register(registerAuditRoutes);
      await api.register(registerMemoryRoutes);
      await api.register(registerCostRoutes);
      await api.register(registerExecutiveRoutes);
      await api.register(registerOrchestratorRoutes);
      await api.register(registerStreamRoutes);
      await api.register(registerModelRoutes);
      await api.register(registerToolRoutes);
      await api.register(registerCodeIntelligenceRoutes);
      await api.register(registerProductFactoryRoutes);
      await api.register(registerSkillRoutes);
      await api.register(registerDatabasePipelineRoutes);
      await api.register(registerEnterpriseOsRoutes);
      await api.register(registerSecurityCenterRoutes);
      await api.register(registerCheckpointRoutes);
      await api.register(registerServiceDeskRoutes);
      await api.register(registerManagedServicesRoutes);
      await api.register(registerSkillAcademyRoutes);
      await api.register(registerAutonomousWorkforceRoutes);
      await api.register(registerCompanyOsRoutes);
      await api.register(registerDeliveryBrainRoutes);
      await api.register(registerStructureGuardianRoutes);
      await api.register(registerCustomerDeliveryRoutes);
      await api.register(registerApiForgeRoutes);
      await api.register(registerReleaseCommandRoutes);
      await api.register(registerBrowserQaRoutes);
      await api.register(registerSandboxKernelRoutes);
      await api.register(registerAgentBlackboardRoutes);
      await api.register(registerMissionControlRoutes);
      await api.register(registerMarketRadarRoutes);
      await api.register(registerTrustLedgerRoutes);
      await api.register(registerModelFinOpsRoutes);
      await api.register(registerAgenticMeshRoutes);
      await api.register(registerProductionReadinessRoutes);
      await api.register(registerArtifactRoutes);
      await api.register(registerProductionRuntimeRoutes);
      await api.register(registerAgentProjectRoutes);
      await api.register(registerSettingsRoutes);
    },
    { prefix: '/api/v1' }
  );

  // WebSocket gateway
  await app.register(registerWsGateway);

  // Global error handler
  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      error: error.name || 'InternalServerError',
      message: error.message || 'An unexpected error occurred',
      statusCode,
    });
  });

  // Check DB connection
  const dbConnected = await checkConnection();
  if (!dbConnected) {
    app.log.warn('Database connection failed — running in degraded mode (in-memory fallback)');
  } else {
    app.log.info('Database connected');
    try {
      const hydratedEntries = await auditChain.hydrate();
      app.log.info({ hydratedEntries }, 'Audit chain hydrated from database');
    } catch (error) {
      app.log.warn(
        { error },
        'Failed to hydrate audit chain from database; continuing with in-memory state'
      );
    }
  }

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info('Shutting down...');
    await app.close();
    await closeConnection();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`AXON IT Agentic AI OS API running at http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});

function parseCorsOrigin(value?: string) {
  const configured = value || 'http://localhost:5173';
  const origins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
}
