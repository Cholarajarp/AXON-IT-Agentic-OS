import { nanoid } from 'nanoid';
import { modelFinOps } from '../model-finops/index.js';
import type { FinOpsTaskType, ModelFinOpsReport } from '../model-finops/types.js';
import type {
  AgenticMeshBlueprint,
  AgenticMeshInput,
  MeshAgentRole,
  MeshExecutionStage,
  MeshQualityLoop,
  MeshTaskEnvelope,
  MeshTopology,
} from './types.js';

const blueprints = new Map<string, AgenticMeshBlueprint>();

export class AgenticMeshService {
  listBlueprints(): AgenticMeshBlueprint[] {
    return Array.from(blueprints.values()).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }

  getBlueprint(id: string): AgenticMeshBlueprint | undefined {
    return blueprints.get(id);
  }

  createBlueprint(input: AgenticMeshInput): AgenticMeshBlueprint {
    const tenantId = input.tenantId ?? 'tenant_default';
    const mission = input.mission.trim();
    const regulated = Boolean(input.regulated || /enterprise|production|regulated|database|security|payment|pii/i.test(mission));
    const autonomyLevel = input.autonomyLevel ?? (regulated ? 'supervised' : 'autonomous');
    const topologies = chooseTopologies(mission, regulated, input.preferredTopologies);
    const finOps = modelFinOps.createReport({
      tenantId,
      mission,
      monthlyBudgetUsd: input.budgetUsd,
      sensitivityLevel: regulated ? 'confidential' : undefined,
      requiresSovereign: regulated,
      repeatedContext: true,
    });
    const agentRoles = buildAgentRoles(finOps);
    const stages = buildStages(mission, topologies, finOps);
    const taskEnvelopes = buildTaskEnvelopes(stages, regulated);
    const qualityLoops = buildQualityLoops(input.maxIterations ?? (regulated ? 3 : 2));
    const score = scoreMesh({ autonomyLevel, regulated, stages, finOps, qualityLoops });

    const blueprint: AgenticMeshBlueprint = {
      id: `mesh_${nanoid(10)}`,
      tenantId,
      mission,
      generatedAt: new Date().toISOString(),
      autonomyLevel,
      topologies,
      finOpsReportId: finOps.id,
      summary: `Agentic Mesh converts AXON roles into ${topologies.join(', ')} teams with A2A-style task envelopes, shared state, critic loops, human gates, and Model FinOps budgets.`,
      agentRoles,
      stages,
      taskEnvelopes,
      qualityLoops,
      sharedState: [
        { key: 'mission.intent', ownerAgent: 'IntentAgent', retention: 'mission', purpose: 'Canonical user need, constraints, risks, and inferred task types.' },
        { key: 'mission.plan', ownerAgent: 'AgenticCoordinatorAgent', retention: 'mission', purpose: 'Execution graph, dependencies, agent assignments, and handoff contracts.' },
        { key: 'workspace.claims', ownerAgent: 'EngineeringAgent', retention: 'release', purpose: 'Owned files, generated artifacts, test commands, and change scope.' },
        { key: 'quality.findings', ownerAgent: 'CriticAgent', retention: 'release', purpose: 'Critic results, unresolved blockers, accepted risks, and rework reasons.' },
        { key: 'release.evidence', ownerAgent: 'ReleaseAgent', retention: 'audit', purpose: 'Browser QA, security, database, sandbox, deployment, and customer proof.' },
        { key: 'finops.budget', ownerAgent: 'FinOpsAgent', retention: 'audit', purpose: 'Planned versus actual model spend, cache hits, and escalation decisions.' },
      ],
      humanGates: buildHumanGates(regulated, autonomyLevel),
      operatingRules: [
        'Never run every agent by default: route only the agents needed by task type, risk, and evidence gaps.',
        'Use parallel fan-out for independent discovery, then synthesize through one coordinator-owned plan.',
        'Use loop-critic only around high-risk or failed-quality work to prevent multi-agent cost explosion.',
        'Store every handoff in the blackboard and every release-impacting decision in the Trust Ledger.',
        'Require a budget and policy decision before premium, production, database, or restricted-data actions.',
      ],
      score,
      nextActions: [
        'Wire Mission Control runs to request an Agentic Mesh blueprint before creating the sandbox and release mission.',
        'Persist mesh envelopes in Agent Blackboard so parallel agents can claim work without file conflicts.',
        'Emit FinOps route decisions into Trust Ledger for auditable cost and provider governance.',
        'Add real worker adapters for parallel stages once the sandbox provider supports isolated concurrent sessions.',
      ],
    };

    blueprints.set(blueprint.id, blueprint);
    return blueprint;
  }
}

function chooseTopologies(mission: string, regulated: boolean, preferredTopologies?: MeshTopology[]): MeshTopology[] {
  if (preferredTopologies?.length) return Array.from(new Set(preferredTopologies));
  const lower = mission.toLowerCase();
  const topologies: MeshTopology[] = ['hierarchical', 'sequential-pipeline'];
  if (/research|market|compare|audit|browser|security|database|multi|team|enterprise|it company/.test(lower)) topologies.push('parallel-fanout');
  if (regulated || /quality|review|critic|fix|test|secure|database|production|release/.test(lower)) topologies.push('loop-critic');
  if (regulated || /production|regulated|customer|security|database|payment|pii|delete|deploy/.test(lower)) topologies.push('human-gated');
  return Array.from(new Set(topologies));
}

function buildAgentRoles(finOps: ModelFinOpsReport): MeshAgentRole[] {
  const taskTypes = new Set<FinOpsTaskType>(finOps.taskTypes);
  const roles: MeshAgentRole[] = [
    role('AgenticCoordinatorAgent', 'coordinator', ['Own team topology', 'Dispatch A2A envelopes', 'Resolve dependency conflicts', 'Summarize shared state'], ['mission.intent', 'finops.budget'], ['mission.plan', 'handoff.contracts'], 'cache-first planning model, premium only for high-risk synthesis', false),
    role('IntentAgent', 'planner', ['Classify task type', 'Extract constraints', 'Detect risk and missing information'], ['user.request'], ['mission.intent'], 'small-model-first; no premium pass unless confidence is low', false),
    role('PMOAgent', 'planner', ['Estimate milestones', 'Sequence delivery', 'Track critical path'], ['mission.intent'], ['delivery.plan'], 'economy/balanced planning model', false),
    role('FinOpsAgent', 'operator', ['Set model budget', 'Choose cache policy', 'Approve provider escalation', 'Track planned versus actual spend'], ['mission.plan', 'model.routes'], ['finops.budget', 'budget.gates'], 'local or economy first; premium only for escalation decisions', false),
    role('SolutionArchitectAgent', 'planner', ['System design', 'API/data boundaries', 'non-functional requirements'], ['mission.intent', 'research.findings'], ['architecture.plan'], 'balanced/premium depending on risk and cache hit', false),
    role('EngineeringAgent', 'builder', ['Implement changes', 'Run commands', 'Attach diffs and tests'], ['architecture.plan', 'workspace.claims'], ['implementation.artifacts'], 'cascade from coder-small/local to premium on failed tests', true),
    role('QAAgent', 'critic', ['Unit/integration/browser quality gates', 'Regression evidence', 'Bug reproduction'], ['implementation.artifacts'], ['quality.findings', 'browser.evidence'], 'batch browser summaries on economy model', true),
    role('CriticAgent', 'critic', ['Cross-check claims', 'Find contradictions', 'Request rework', 'Stop loops when evidence passes'], ['implementation.artifacts', 'quality.findings'], ['critic.decision'], 'critic-only-on-risk premium or sovereign model', false),
    role('ReleaseAgent', 'operator', ['Release gates', 'rollback plan', 'deployment readiness'], ['release.evidence'], ['release.manifest'], 'cache-first release scoring', false),
    role('CustomerSuccessAgent', 'customer', ['Customer report', 'SOW evidence', 'handoff summary'], ['release.manifest'], ['customer.report'], 'batched customer-report route', true),
  ];

  if (taskTypes.has('security')) {
    roles.push(role('SecurityAgent', 'critic', ['Threat model', 'secret scan', 'policy enforcement'], ['architecture.plan', 'implementation.artifacts'], ['security.findings'], 'sovereign/premium critic for high-risk findings', true));
  }
  if (taskTypes.has('database')) {
    roles.push(role('DatabaseArchitectAgent', 'planner', ['Schema design', 'migration plan', 'index strategy'], ['mission.intent', 'architecture.plan'], ['database.plan'], 'sovereign database route with critic escalation', true));
    roles.push(role('MigrationSafetyAgent', 'critic', ['Lock-risk analysis', 'rollback validation', 'approval gate'], ['database.plan'], ['database.safety'], 'critic-only-on-risk route', true));
    roles.push(role('DataQualityAgent', 'critic', ['Row counts', 'checksums', 'drift checks', 'data quality gates'], ['database.plan'], ['database.quality'], 'economy route with deterministic checks first', true));
  }
  if (taskTypes.has('browser-qa')) {
    roles.push(role('BrowserAgent', 'critic', ['Preview journey execution', 'screenshot/trace capture', 'console/network inspection'], ['preview.url', 'browser.spec'], ['browser.evidence'], 'batch browser analysis route', true));
  }

  return roles;
}

function role(
  agent: string,
  meshRole: MeshAgentRole['role'],
  responsibilities: string[],
  inputChannels: string[],
  outputChannels: string[],
  modelPolicy: string,
  canRunInParallel: boolean,
): MeshAgentRole {
  return { agent, role: meshRole, responsibilities, inputChannels, outputChannels, modelPolicy, canRunInParallel };
}

function buildStages(mission: string, topologies: MeshTopology[], finOps: ModelFinOpsReport): MeshExecutionStage[] {
  const hasParallel = topologies.includes('parallel-fanout');
  const hasLoop = topologies.includes('loop-critic');
  const hasHumanGate = topologies.includes('human-gated');
  const needsDatabase = finOps.taskTypes.includes('database');
  const needsSecurity = finOps.taskTypes.includes('security');
  const needsBrowser = finOps.taskTypes.includes('browser-qa');

  const stages: MeshExecutionStage[] = [
    stage(1, 'Mission intake and risk routing', 'hierarchical', 'IntentAgent', ['IntentAgent', 'FinOpsAgent'], [], `Classify "${mission.slice(0, 120)}" into scope, risk, budget, model routes, and topology.`, ['mission.intent', 'finops.budget'], 'intent schema and budget policy validate', 'local/economy triage before premium reasoning', 'ask human only when required constraints are missing', ['intent.json', 'budget-policy.json']),
    stage(2, 'Parallel discovery and constraints', hasParallel ? 'parallel-fanout' : 'sequential-pipeline', 'AgenticCoordinatorAgent', discoveryAgents({ needsDatabase, needsSecurity, needsBrowser }), [1], 'Collect independent product, architecture, database, security, QA, and market signals concurrently.', ['research.findings', 'architecture.constraints'], 'all critical constraints have source/evidence', 'batch independent summaries and cache shared context', 'missing lane becomes a tracked risk, not a silent skip', ['discovery-brief.md', 'risk-register.json']),
    stage(3, 'Synthesis and execution plan', 'sequential-pipeline', 'SolutionArchitectAgent', ['AgenticCoordinatorAgent', 'SolutionArchitectAgent', 'PMOAgent'], [2], 'Synthesize one implementation plan, file ownership map, tests, release gates, and customer evidence contract.', ['mission.plan', 'workspace.claims'], 'plan has owners, dependencies, gates, and acceptance criteria', 'reuse cached discovery context', 'block execution when file ownership conflicts remain', ['execution-plan.md', 'file-claims.json']),
    stage(4, 'Build and verify loop', hasLoop ? 'loop-critic' : 'sequential-pipeline', 'EngineeringAgent', buildAgents({ needsDatabase, needsSecurity, needsBrowser }), [3], 'Implement, test, review, repair, and stop only when evidence gates pass.', ['implementation.artifacts', 'quality.findings'], 'tests, security, database, and browser gates pass or become accepted risks', 'small/local coder first, critic only on risk/failure', 'open a rework envelope and cap iterations through FinOps budget', ['diff-summary.md', 'test-results.json', 'critic-decision.json']),
    stage(5, 'Release and customer proof', hasHumanGate ? 'human-gated' : 'sequential-pipeline', 'ReleaseAgent', ['ReleaseAgent', 'SREAgent', 'CustomerSuccessAgent', 'ComplianceAgent'], [4], 'Package release score, rollback, SLA, trust evidence, and customer-readable delivery proof.', ['release.evidence', 'customer.report'], 'Release Command is ready or blocked with explicit reason', 'batch report generation and reuse release cache', 'human approval required for production, restricted data, or unresolved critical risk', ['release-manifest.json', 'customer-report.md']),
  ];

  return stages;
}

function discoveryAgents(options: { needsDatabase: boolean; needsSecurity: boolean; needsBrowser: boolean }): string[] {
  return [
    'BusinessAnalystAgent',
    'StackResearchAgent',
    'SolutionArchitectAgent',
    ...(options.needsDatabase ? ['DatabaseArchitectAgent'] : []),
    ...(options.needsSecurity ? ['SecurityAgent'] : []),
    ...(options.needsBrowser ? ['QAAgent', 'BrowserAgent'] : []),
    'FinOpsAgent',
  ];
}

function buildAgents(options: { needsDatabase: boolean; needsSecurity: boolean; needsBrowser: boolean }): string[] {
  return [
    'EngineeringAgent',
    'QAAgent',
    'CriticAgent',
    ...(options.needsDatabase ? ['MigrationSafetyAgent', 'DataQualityAgent'] : []),
    ...(options.needsSecurity ? ['SecurityAgent'] : []),
    ...(options.needsBrowser ? ['BrowserAgent'] : []),
  ];
}

function stage(
  order: number,
  name: string,
  topology: MeshTopology,
  leadAgent: string,
  agents: string[],
  dependsOn: number[],
  objective: string,
  sharedStateKeys: string[],
  qualityGate: string,
  costControl: string,
  failurePolicy: string,
  expectedArtifacts: string[],
): MeshExecutionStage {
  return {
    order,
    name,
    topology,
    leadAgent,
    agents,
    objective,
    dependsOn,
    status: order === 1 ? 'ready' : 'planned',
    sharedStateKeys,
    qualityGate,
    costControl,
    failurePolicy,
    expectedArtifacts,
  };
}

function buildTaskEnvelopes(stages: MeshExecutionStage[], regulated: boolean): MeshTaskEnvelope[] {
  return stages.flatMap((stageItem) =>
    stageItem.agents
      .filter((agent) => agent !== stageItem.leadAgent)
      .slice(0, 6)
      .map((agent) => ({
        id: `env_${nanoid(8)}`,
        protocol: 'AXON-A2A' as const,
        senderAgent: stageItem.leadAgent,
        receiverAgent: agent,
        task: `${stageItem.name}: ${stageItem.objective}`,
        expectedArtifacts: stageItem.expectedArtifacts,
        status: stageItem.order === 1 ? 'delegated' as const : 'created' as const,
        securityContext: {
          tenantScoped: true,
          dataClass: regulated ? 'confidential' as const : 'internal' as const,
          requiredScopes: scopesFor(stageItem),
        },
      })),
  );
}

function scopesFor(stageItem: MeshExecutionStage): string[] {
  if (/release|customer/i.test(stageItem.name)) return ['release:read', 'evidence:write', 'customer-report:write'];
  if (/build/i.test(stageItem.name)) return ['workspace:read', 'workspace:write', 'sandbox:execute'];
  if (/discovery/i.test(stageItem.name)) return ['workspace:read', 'blackboard:write'];
  return ['mission:read', 'blackboard:write'];
}

function buildQualityLoops(maxIterations: number): MeshQualityLoop[] {
  return [
    {
      id: 'loop_generator_critic',
      trigger: 'implementation, database, security, browser, or release gate fails',
      generatorAgent: 'EngineeringAgent',
      criticAgent: 'CriticAgent',
      maxIterations,
      stopCondition: 'all blocking findings resolved, accepted risk recorded, or budget/human gate stops the loop',
      evidence: ['diff summary', 'test result', 'critic decision', 'rework envelope'],
    },
    {
      id: 'loop_release_readiness',
      trigger: 'Release Command score is below environment threshold',
      generatorAgent: 'ReleaseAgent',
      criticAgent: 'SREAgent',
      maxIterations: Math.max(1, maxIterations - 1),
      stopCondition: 'rollback, monitoring, SLA, and customer evidence are ready or production approval is blocked',
      evidence: ['release manifest', 'rollback plan', 'SLO watch', 'customer handoff'],
    },
  ];
}

function buildHumanGates(regulated: boolean, autonomyLevel: AgenticMeshInput['autonomyLevel']) {
  const gates = [
    {
      gate: 'Budget escalation',
      owner: 'FinOps owner',
      reason: 'Premium or sovereign model usage exceeds planned task budget.',
      unblockCondition: 'Approve extra pass, lower quality target, or reduce non-critical agents.',
    },
  ];

  if (regulated || autonomyLevel !== 'autonomous') {
    gates.push(
      {
        gate: 'Production or restricted-data action',
        owner: 'Security/Release approver',
        reason: 'Agents must not deploy production, mutate databases, or expose restricted context without explicit approval.',
        unblockCondition: 'Trust Ledger policy decision is allow and required approver is attached.',
      },
      {
        gate: 'Unresolved critical finding',
        owner: 'Engineering lead',
        reason: 'Critical security, database, browser, or release blocker remains open.',
        unblockCondition: 'Fix verified or accepted-risk record signed.',
      },
    );
  }

  return gates;
}

function scoreMesh(input: {
  autonomyLevel: AgenticMeshInput['autonomyLevel'];
  regulated: boolean;
  stages: MeshExecutionStage[];
  finOps: ModelFinOpsReport;
  qualityLoops: MeshQualityLoop[];
}) {
  const autonomyBase = input.autonomyLevel === 'autonomous' ? 90 : input.autonomyLevel === 'supervised' ? 78 : 65;
  const evidenceStages = input.stages.filter((stageItem) => stageItem.expectedArtifacts.length >= 2).length;
  return {
    autonomy: Math.min(98, autonomyBase + evidenceStages),
    reliability: Math.min(98, 80 + input.qualityLoops.length * 5 + (input.regulated ? 4 : 0)),
    costDiscipline: Math.min(99, 72 + Math.round(input.finOps.optimized.savingsPercent / 3)),
    enterpriseReadiness: Math.min(99, 78 + (input.regulated ? 8 : 3) + input.stages.filter((stageItem) => stageItem.topology === 'human-gated').length * 4),
  };
}

export const agenticMesh = new AgenticMeshService();
