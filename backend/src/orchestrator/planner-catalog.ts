import { nanoid } from 'nanoid';
import type { PlannerOutput } from './types.js';

export type AgentCapabilities = Record<string, { handles: string[]; description: string }>;

export const AGENT_CAPABILITIES: AgentCapabilities = {
  IntentAgent: { handles: ['parse', 'classify', 'extract-requirements'], description: 'Parses user intent, classifies goal type, extracts structured requirements' },
  BusinessAnalystAgent: { handles: ['analyze-requirements', 'define-acceptance', 'stakeholder-map'], description: 'Analyzes business requirements, defines acceptance criteria, maps stakeholders' },
  DomainAgent: { handles: ['domain-model', 'entity-design', 'relationship-map'], description: 'Creates domain models, entity designs, and relationship mappings' },
  SolutionArchitectAgent: { handles: ['architecture', 'system-design', 'tech-selection', 'api-design'], description: 'Designs system architecture, selects technologies, designs APIs' },
  EngineeringAgent: { handles: ['implement', 'code', 'build', 'integrate', 'refactor'], description: 'Implements code, builds features, integrates systems' },
  QAAgent: { handles: ['test', 'validate', 'regression', 'coverage'], description: 'Writes tests, validates implementations, ensures coverage' },
  SecurityAgent: { handles: ['security-scan', 'vulnerability', 'compliance-check', 'threat-model'], description: 'Runs security scans, identifies vulnerabilities, models threats' },
  InfrastructureAgent: { handles: ['deploy', 'provision', 'configure', 'scale'], description: 'Provisions infrastructure, deploys services, configures systems' },
  ReleaseAgent: { handles: ['release', 'rollback', 'feature-flag', 'canary'], description: 'Manages releases, rollbacks, feature flags, canary deployments' },
  SREAgent: { handles: ['monitor', 'alert', 'incident-response', 'runbook'], description: 'Monitors services, manages alerts, executes runbooks' },
  ComplianceAgent: { handles: ['audit', 'evidence-collect', 'policy-enforce', 'report'], description: 'Collects audit evidence, enforces policies, generates compliance reports' },
  DocumentationAgent: { handles: ['document', 'api-docs', 'changelog', 'knowledge-base'], description: 'Writes documentation, API docs, changelogs, knowledge articles' },
  StackResearchAgent: { handles: ['research-stack', 'source-synthesis', 'architecture-comparison', 'trend-analysis'], description: 'Researches public source patterns, compares reference stacks, and synthesizes architecture guidance' },
  DatabaseArchitectAgent: { handles: ['schema-design', 'migration-plan', 'index-strategy', 'data-model-review'], description: 'Designs database schemas, migration plans, indexes, and compatibility strategy' },
  MigrationSafetyAgent: { handles: ['sql-review', 'lock-risk-analysis', 'rollback-review', 'approval-gate'], description: 'Reviews SQL migrations for lock risk, destructive operations, rollback gaps, and approval gates' },
  DataQualityAgent: { handles: ['data-validation', 'drift-detection', 'row-count-checks', 'quality-gates'], description: 'Defines data validation, drift detection, row-count checks, and migration quality gates' },
  FinOpsAgent: { handles: ['model-routing', 'budget-policy', 'context-cache', 'provider-failover', 'margin-guardrail'], description: 'Controls model budgets, routing, caching, provider escalation, and customer margin guardrails' },
  AgenticCoordinatorAgent: { handles: ['agent-topology', 'a2a-handoff', 'shared-state', 'parallel-fanout', 'loop-critic', 'human-gate'], description: 'Turns specialist roles into coordinated agentic teams with handoffs, state, and quality loops' },
  CriticAgent: { handles: ['critique', 'quality-gate', 'confidence-score', 'rework-request', 'hallucination-check'], description: 'Evaluates agent outputs, detects contradictions, and controls generator-critic loops' },
  PMOAgent: { handles: ['plan', 'estimate', 'track', 'resource-allocate'], description: 'Creates project plans, estimates effort, tracks progress' },
  ExecutiveInsightAgent: { handles: ['summarize', 'report-executive', 'trend-analysis', 'recommend'], description: 'Generates executive summaries, analyzes trends, makes recommendations' },
};

type TaskSeed = Omit<PlannerOutput['tasks'][number], 'id' | 'dependsOn'>;
type GoalTemplate = (goal: string) => PlannerOutput;

export const GOAL_TEMPLATES: Record<string, GoalTemplate> = {
  'stack-blueprint': (goal) => plan(`Turning blueprint goal: "${goal}" into a source-backed architecture and execution plan.`, [
    task('Parse blueprint intent', 'Extract architecture goals, constraints, and target outcomes', 'IntentAgent', { goal }, false, 30000),
    task('Research reference stacks', 'Compare public agentic platform patterns and current stack standards', 'StackResearchAgent', {}, false, 120000),
    task('Synthesize architecture', 'Convert research into an implementation-ready architecture and API plan', 'SolutionArchitectAgent', {}, false, 90000),
    task('Security review', 'Validate provider setup, policy boundaries, and execution risks', 'SecurityAgent', {}, false, 120000),
    task('Execution roadmap', 'Sequence workstreams, milestones, and delivery checkpoints', 'PMOAgent', {}, false, 60000),
    task('Delivery brief', 'Document the approved stack blueprint for the team', 'DocumentationAgent', {}, false, 60000),
  ]),

  'deploy-service': (goal) => plan(`Decomposing deployment goal: "${goal}" into infrastructure, build, test, deploy, and monitor stages.`, [
    task('Parse deployment intent', 'Extract service name, environment, and configuration from goal', 'IntentAgent', { goal }, false, 30000),
    task('Architecture review', 'Validate deployment architecture and dependencies', 'SolutionArchitectAgent', {}, false, 60000),
    task('Security scan', 'Run vulnerability scan on artifacts', 'SecurityAgent', {}, false, 120000),
    task('Provision infrastructure', 'Create or update infrastructure resources', 'InfrastructureAgent', {}, true, 300000),
    task('Deploy service', 'Deploy the service to target environment', 'ReleaseAgent', {}, true, 300000),
    task('Verify deployment', 'Run smoke tests and health checks', 'QAAgent', {}, false, 120000),
    task('Setup monitoring', 'Configure alerts and dashboards', 'SREAgent', {}, false, 60000),
  ]),

  'build-feature': (goal) => plan(`Decomposing feature goal: "${goal}" into analysis, design, implement, test, and release stages.`, [
    task('Parse requirements', 'Extract feature requirements and acceptance criteria', 'IntentAgent', { goal }, false, 30000),
    task('Business analysis', 'Define business value, user stories, and acceptance criteria', 'BusinessAnalystAgent', {}, false, 60000),
    task('Domain modeling', 'Design domain entities and relationships', 'DomainAgent', {}, false, 60000),
    task('Solution architecture', 'Design technical solution and API contracts', 'SolutionArchitectAgent', {}, false, 90000),
    task('Implementation', 'Build the feature code', 'EngineeringAgent', {}, false, 600000),
    task('Testing', 'Write and run unit/integration tests', 'QAAgent', {}, false, 300000),
    task('Security review', 'Scan for vulnerabilities and compliance issues', 'SecurityAgent', {}, false, 120000),
    task('Documentation', 'Write technical and user documentation', 'DocumentationAgent', {}, false, 60000),
    task('Release', 'Deploy feature behind feature flag', 'ReleaseAgent', {}, true, 180000),
  ]),

  'investigate-incident': (goal) => plan(`Decomposing incident investigation: "${goal}" into triage, analyze, remediate, and report stages.`, [
    task('Triage incident', 'Classify severity, affected services, and blast radius', 'SREAgent', { goal }, false, 30000),
    task('Root cause analysis', 'Investigate logs, metrics, and traces to find root cause', 'SREAgent', {}, false, 120000),
    task('Remediation plan', "Design fix and validate it won't cause regressions", 'EngineeringAgent', {}, true, 60000),
    task('Apply fix', 'Implement and deploy the fix', 'EngineeringAgent', {}, true, 300000),
    task('Verify resolution', 'Confirm the issue is resolved and services healthy', 'QAAgent', {}, false, 120000),
    task('Post-mortem report', 'Generate incident post-mortem with timeline and learnings', 'DocumentationAgent', {}, false, 60000),
  ]),

  'compliance-audit': (goal) => plan(`Decomposing compliance audit: "${goal}" into evidence collection, gap analysis, and reporting stages.`, [
    task('Parse audit scope', 'Identify frameworks, controls, and systems in scope', 'IntentAgent', { goal }, false, 30000),
    task('Collect evidence', 'Gather evidence artifacts from systems and logs', 'ComplianceAgent', {}, false, 300000),
    task('Gap analysis', 'Identify missing controls and non-compliant configurations', 'ComplianceAgent', {}, false, 120000),
    task('Remediation tasks', 'Create action items to close compliance gaps', 'SecurityAgent', {}, true, 120000),
    task('Executive report', 'Generate compliance summary for leadership', 'ExecutiveInsightAgent', {}, false, 60000),
  ]),

  'database-change': (goal) => plan(`Decomposing database delivery goal: "${goal}" into schema design, migration safety, data quality, approval, and rollout stages.`, [
    task('Parse database intent', 'Extract target engine, environment, tables, risk, and stateful rollout constraints', 'IntentAgent', { goal }, false, 30000),
    task('Design schema migration', 'Plan compatible schema evolution, indexes, and expand-contract rollout', 'DatabaseArchitectAgent', {}, false, 90000),
    task('Review SQL safety', 'Detect destructive statements, lock risk, rollback gaps, and production-blocking patterns', 'MigrationSafetyAgent', {}, true, 120000),
    task('Define data quality gates', 'Create row-count, checksum, null, drift, and referential-integrity checks', 'DataQualityAgent', {}, false, 90000),
    task('Security and access review', 'Verify least-privilege database access, secret handling, and audit evidence', 'SecurityAgent', {}, false, 90000),
    task('Controlled migration release', 'Run rollout behind gates with backup checkpoint, monitoring, and fallback owner', 'ReleaseAgent', {}, true, 300000),
    task('Observe database health', 'Monitor query latency, lock waits, replication lag, errors, and rollback triggers', 'SREAgent', {}, false, 120000),
  ]),

  'model-finops': (goal) => plan(`Decomposing cost-control goal: "${goal}" into model routing, cache policy, quality gates, and spend governance.`, [
    task('Classify cost drivers', 'Identify repeated context, premium-model pressure, risk, and expected run volume', 'IntentAgent', { goal }, false, 30000),
    task('Create model FinOps policy', 'Plan cache-first, small-model-first, cascade, and critic-only-on-risk routing', 'FinOpsAgent', {}, false, 60000),
    task('Design quality guardrails', 'Define tests, schemas, confidence scoring, and escalation triggers that preserve accuracy', 'CriticAgent', {}, false, 60000),
    task('Wire route to mission mesh', 'Attach budgets and model policies to agent topology and handoff envelopes', 'AgenticCoordinatorAgent', {}, false, 90000),
    task('Release cost evidence', 'Record planned versus actual cost, cache strategy, and provider decisions for audit', 'ReleaseAgent', {}, false, 60000),
  ]),

  'agentic-mesh': (goal) => plan(`Decomposing agentic OS goal: "${goal}" into topology, specialist teams, A2A-style handoffs, critic loops, and human gates.`, [
    task('Parse agentic mission', 'Extract goal, autonomy level, risk, needed specialists, and human gates', 'IntentAgent', { goal }, false, 30000),
    task('Design agent topology', 'Choose hierarchical, sequential, parallel fan-out, loop-critic, and human-gated patterns', 'AgenticCoordinatorAgent', {}, false, 90000),
    task('Assign cost-aware model routes', 'Attach cache, budget, local/sovereign, and escalation policies to each agent lane', 'FinOpsAgent', {}, false, 60000),
    task('Define critic loops', 'Create stop conditions, rework envelopes, and quality/evidence gates', 'CriticAgent', {}, false, 60000),
    task('Prepare execution and release evidence', 'Map mesh output to blackboard, sandbox, trust ledger, and release command evidence', 'ReleaseAgent', {}, true, 90000),
  ]),

  generic: (goal) => plan(`Generic decomposition for: "${goal}". Using standard analyze -> plan -> execute -> verify pipeline.`, [
    task('Analyze intent', 'Parse and classify the goal', 'IntentAgent', { goal }, false, 30000),
    task('Plan execution', 'Create detailed execution plan', 'PMOAgent', {}, false, 60000),
    task('Execute primary task', 'Perform the main work', 'EngineeringAgent', {}, false, 600000),
    task('Validate results', 'Verify the work meets requirements', 'QAAgent', {}, false, 120000),
    task('Document outcome', 'Record what was done and results', 'DocumentationAgent', {}, false, 60000),
  ]),
};

export function classifyGoalType(goal: string): string {
  const lower = goal.toLowerCase();
  if (includesAny(lower, ['finops', 'cost', 'budget', 'cache', 'cheap', 'api cost', 'model routing'])) return 'model-finops';
  if (includesAny(lower, ['agentic', 'multi-agent', 'agent mesh', 'a2a', 'adk', 'agent team'])) return 'agentic-mesh';
  if (includesAny(lower, ['database', 'schema', 'migration', 'sql', 'postgres', 'mysql'])) return 'database-change';
  if (includesAny(lower, ['stack', 'blueprint', 'architecture', 'provider', 'routing', 'design system', 'reference stack', 'enterprise'])) return 'stack-blueprint';
  if (includesAny(lower, ['deploy', 'rollout', 'release to'])) return 'deploy-service';
  if (includesAny(lower, ['build', 'implement', 'create', 'add feature'])) return 'build-feature';
  if (includesAny(lower, ['incident', 'outage', 'investigate', 'debug'])) return 'investigate-incident';
  if (includesAny(lower, ['audit', 'compliance', 'soc', 'iso'])) return 'compliance-audit';
  return 'generic';
}

function plan(reasoning: string, tasks: TaskSeed[]): PlannerOutput {
  return {
    reasoning,
    tasks: tasks.map((item) => ({
      id: nanoid(8),
      dependsOn: [],
      ...item,
    })),
  };
}

function task(
  name: string,
  description: string,
  agent: string,
  input: Record<string, unknown>,
  approvalRequired: boolean,
  timeoutMs: number,
): TaskSeed {
  return { name, description, agent, input, approvalRequired, timeoutMs };
}

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}
