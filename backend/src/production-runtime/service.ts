import { nanoid } from 'nanoid';
import { checkConnection } from '../db/connection.js';
import { artifactService } from '../artifacts/index.js';
import { trustLedger } from '../trust-ledger/index.js';
import type { ProductionRuntimeStatus, RuntimeGate } from './types.js';

export class ProductionRuntimeService {
  async status(): Promise<ProductionRuntimeStatus> {
    const databaseConnected = await checkConnection();
    const artifactHealth = artifactService.health();
    const signing = trustLedger.signingStatus();
    const deploymentAdapter = process.env.AXON_DEPLOYMENT_ADAPTER ?? 'local-dry-run';
    const browserWorkerEnabled = process.env.AXON_BROWSER_WORKER_ENABLED === '1' || process.env.AXON_BROWSER_WORKER === 'playwright';
    const secretManagerConfigured = Boolean(process.env.AXON_CONFIG_SECRET || process.env.AWS_SECRETS_MANAGER_SECRET_ID || process.env.GCP_SECRET_MANAGER_PROJECT || process.env.AZURE_KEY_VAULT_URL);
    const externalArtifactStore = artifactHealth.driver === 's3-compatible' && Boolean(process.env.AXON_S3_BUCKET);

    const gates: RuntimeGate[] = [
      gate({
        id: 'database',
        pass: databaseConnected,
        block: true,
        title: 'PostgreSQL persistence is reachable',
        owner: 'PlatformAgent',
        whyItMatters: 'Production work cannot rely on in-memory state. Missions, evidence, costs, users, and configuration need durable storage.',
        evidence: [databaseConnected ? 'database health check passed' : 'database health check failed'],
        nextAction: 'Run docker compose up -d, set DATABASE_URL, and run npm run db:migrate.',
      }),
      gate({
        id: 'artifact-storage',
        pass: artifactHealth.writable,
        block: true,
        warn: !externalArtifactStore,
        title: 'Artifact storage is writable and production-suitable',
        owner: 'ReleaseAgent',
        whyItMatters: 'Screenshots, traces, release packs, generated API packages, and customer reports need immutable artifact storage.',
        evidence: [`driver=${artifactHealth.driver}`, `root=${artifactHealth.root}`, ...artifactHealth.warnings],
        nextAction: 'Configure AXON_ARTIFACT_DRIVER=s3 with AXON_S3_BUCKET for multi-node production.',
      }),
      gate({
        id: 'ledger-signing',
        pass: signing.productionReady,
        block: true,
        warn: !signing.kmsBacked,
        title: 'Trust Ledger signing is not using the development key',
        owner: 'ComplianceAgent',
        whyItMatters: 'Customer and audit evidence must be tamper-evident and signed with a managed key posture.',
        evidence: [`fingerprint=${signing.keyFingerprint}`, ...signing.warnings],
        nextAction: 'Set AXON_LEDGER_SIGNING_KEY for pilot and AXON_KMS_KEY_ID or cloud KMS env vars for production.',
      }),
      gate({
        id: 'deployment-adapter',
        pass: deploymentAdapter !== 'local-dry-run',
        block: false,
        warn: true,
        title: 'Deployment adapter is configured',
        owner: 'SREAgent',
        whyItMatters: 'Production products need real deployment, canary, health checks, and rollback execution.',
        evidence: [`AXON_DEPLOYMENT_ADAPTER=${deploymentAdapter}`],
        nextAction: 'Set AXON_DEPLOYMENT_ADAPTER to kubernetes, vercel, aws-ecs, or another implemented adapter.',
      }),
      gate({
        id: 'browser-worker',
        pass: browserWorkerEnabled,
        block: false,
        warn: true,
        title: 'Real browser worker is enabled',
        owner: 'QAAgent',
        whyItMatters: 'Synthetic browser plans are useful, but production proof needs real Playwright screenshots, traces, videos, and console/network logs.',
        evidence: [browserWorkerEnabled ? 'browser worker enabled' : 'browser worker disabled'],
        nextAction: 'Set AXON_BROWSER_WORKER_ENABLED=1 and install browser dependencies for the worker environment.',
      }),
      gate({
        id: 'secret-manager',
        pass: secretManagerConfigured,
        block: false,
        warn: true,
        title: 'Secret management is configured',
        owner: 'SecurityAgent',
        whyItMatters: 'Provider keys, cloud credentials, customer API tokens, and signing secrets must not depend on local obfuscation.',
        evidence: [secretManagerConfigured ? 'secret manager or config secret configured' : 'secret manager not configured'],
        nextAction: 'Set AXON_CONFIG_SECRET for pilot and Vault/AWS/GCP/Azure secret manager env vars for production.',
      }),
    ];

    const blockers = gates.filter((item) => item.status === 'block').map((item) => item.title);
    const score = Math.round(gates.reduce((sum, item) => sum + (item.status === 'pass' ? 100 : item.status === 'warn' ? 60 : 0), 0) / gates.length);
    const productionReady = blockers.length === 0 && gates.every((item) => item.status === 'pass');
    const status = productionReady
      ? 'production-ready'
      : blockers.length > 0
        ? 'blocked'
        : score >= 70
          ? 'pilot-ready'
          : 'development-only';

    return {
      id: `runtime_${nanoid(10)}`,
      generatedAt: new Date().toISOString(),
      status,
      score,
      productionReady,
      summary: productionReady
        ? 'Runtime foundations are production-ready for external customer launches.'
        : 'Runtime foundations still have blockers or warnings. AXON can run controlled loops, but must not claim broad external production readiness yet.',
      gates,
      blockers,
    };
  }
}

function gate(input: {
  id: string;
  pass: boolean;
  block: boolean;
  warn?: boolean;
  title: string;
  owner: string;
  whyItMatters: string;
  evidence: string[];
  nextAction: string;
}): RuntimeGate {
  const status: RuntimeGate['status'] = input.pass
    ? input.warn
      ? 'warn'
      : 'pass'
    : input.block
      ? 'block'
      : 'warn';

  return {
    id: input.id,
    title: input.title,
    status,
    owner: input.owner,
    whyItMatters: input.whyItMatters,
    evidence: input.evidence,
    nextAction: input.nextAction,
  };
}

export const productionRuntime = new ProductionRuntimeService();
