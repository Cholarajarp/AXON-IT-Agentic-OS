import { nanoid } from 'nanoid';
import { artifactService } from '../../artifacts/index.js';
import { trustLedger } from '../../trust-ledger/index.js';
import { slug } from '../execution-fabric-runtime.js';
import { deliveryPacks, executions, projects, runs } from '../state.js';
import type { AgentProjectDeliveryPack } from '../types.js';

export function createDeliveryPack(executionId: string): AgentProjectDeliveryPack {
  const execution = executions.get(executionId);
  if (!execution) throw new Error('Agent project execution not found');
  const run = runs.get(execution.runId);
  if (!run) throw new Error('Agent project run not found');
  const project = projects.get(execution.projectId);
  if (!project) throw new Error('Agent project not found');

  const blockingGates = execution.gates.filter((item) => item.status === 'block');
  const warningGates = execution.gates.filter((item) => item.status === 'warn');
  const commandEvidence = execution.commandRuns.map((item) => `${item.status}: ${item.label} artifact=${item.artifactId}`);
  const status: AgentProjectDeliveryPack['status'] = blockingGates.length
    ? 'blocked'
    : warningGates.length
      ? 'needs-review'
      : 'ready';
  const releaseChecklist = [
    `${execution.gates.filter((item) => item.status === 'pass').length}/${execution.gates.length} execution gate(s) passing`,
    execution.browserQaReportId ? `Browser QA attached: ${execution.browserQaReportId}` : 'Browser QA evidence missing',
    commandEvidence.length ? `${commandEvidence.length} command run(s) attached` : 'No command run evidence attached',
    'Trust Ledger records created for plan, execution, commands, and browser evidence where available',
    'Customer update ready for delivery handoff',
  ];
  const customerUpdate = status === 'ready'
    ? `${project.name} is ready for customer review with command evidence, browser evidence, and release gates attached.`
    : `${project.name} needs review before customer release: ${[...blockingGates, ...warningGates].map((item) => item.title).join('; ') || 'evidence incomplete'}.`;
  const artifact = artifactService.put({
    tenantId: execution.tenantId,
    kind: 'release-pack',
    name: `${slug(project.name)}-delivery-pack`,
    content: {
      project: project.name,
      runId: run.id,
      executionId: execution.id,
      status,
      releaseChecklist,
      commandEvidence,
      browserQaReportId: execution.browserQaReportId,
      customerUpdate,
    },
    metadata: { source: 'Agent Projects', projectId: project.id, runId: run.id, executionId: execution.id },
  });
  const pack: AgentProjectDeliveryPack = {
    id: `pack_${nanoid(10)}`,
    projectId: project.id,
    runId: run.id,
    executionId: execution.id,
    status,
    summary: `${project.name} delivery pack is ${status} with ${commandEvidence.length} command evidence item(s).`,
    commandEvidence,
    browserQaReportId: execution.browserQaReportId,
    releaseChecklist,
    customerUpdate,
    artifactId: artifact.id,
    createdAt: new Date().toISOString(),
  };
  deliveryPacks.set(pack.id, pack);
  trustLedger.append({
    tenantId: execution.tenantId,
    kind: 'release-manifest',
    actor: 'DeliveryPackAgent',
    actorType: 'agent',
    subject: `Delivery pack ${pack.id}`,
    summary: pack.summary,
    risk: status === 'blocked' ? 'high' : status === 'needs-review' ? 'medium' : 'low',
    source: 'Agent Projects',
    artifacts: [artifact.uri],
    metadata: { projectId: project.id, runId: run.id, executionId: execution.id, deliveryPackId: pack.id },
    controls: ['release-pack', 'customer-handoff', 'evidence-manifest'],
  });
  return pack;
}
