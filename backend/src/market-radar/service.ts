import { nanoid } from 'nanoid';
import { artifactService } from '../artifacts/index.js';
import { missionControl } from '../mission-control/index.js';
import { DurableJsonStore } from '../services/durable-json-store.js';
import { trustLedger } from '../trust-ledger/index.js';
import type {
  CapabilityArea,
  CapabilityGap,
  CompetitiveBenchmarkReport,
  CompetitiveCapability,
  CompetitorProfile,
  MarketBuildPack,
  MoatActivationRun,
  MoatLane,
  MarketRadarInput,
  MarketRadarLaunch,
  MarketRadarReport,
  MarketSignal,
} from './types.js';

const reports = new Map<string, MarketRadarReport>();
const activationStore = new DurableJsonStore<MoatActivationRun[]>('market-radar/moat-activation-runs.json', []);

const competitorProfiles: CompetitorProfile[] = [
  {
    id: 'servicenow-ai-platform',
    name: 'ServiceNow AI Platform',
    category: 'itsm-ai',
    currentEdge: 'Deep ITSM/ITOM workflow footprint, AI Control Tower positioning, Workflow Data Fabric, and enterprise agent interoperability with Google Cloud.',
    weakSpot: 'Strong inside the ServiceNow estate, but less natural for repo-native full SDLC, customer delivery packaging, and code-to-release evidence loops.',
    axonCounter: 'Unify SDLC, ITSM, database, browser QA, release, FinOps, and signed evidence as one delivery operating system.',
    sourceUrl: 'https://newsroom.servicenow.com/press-releases/details/2026/ServiceNow-and-Google-Cloud-unite-AI-agents-for-autonomous-enterprise-operations/default.aspx',
  },
  {
    id: 'atlassian-rovo-jsm',
    name: 'Atlassian Rovo and Jira Service Management',
    category: 'itsm-ai',
    currentEdge: 'Organizational knowledge search, chat, agents, Studio, and Jira Service Management incident/request workflows.',
    weakSpot: 'Excellent collaboration layer, but agent execution, release evidence, model FinOps, and autonomous implementation loops are not one integrated IT-service software OS.',
    axonCounter: 'Make every service request traceable to autonomous build, verification, rollback, customer report, and compliance artifacts.',
    sourceUrl: 'https://www.atlassian.com/software/rovo',
  },
  {
    id: 'github-copilot-coding-agent',
    name: 'GitHub Copilot Coding Agent',
    category: 'software-agent',
    currentEdge: 'Issue-to-PR coding inside GitHub with enterprise controls and GitHub Actions-backed environments.',
    weakSpot: 'Powerful for code contribution, but not broad enough alone for ITSM, managed services, compliance, progressive delivery, and customer-facing operations.',
    axonCounter: 'Treat GitHub as one entry point while AXON owns the full mission loop from idea to operated service.',
    sourceUrl: 'https://github.com/newsroom/press-releases/coding-agent-for-github-copilot',
  },
  {
    id: 'ibm-agentic-governance',
    name: 'IBM Agentic AI Governance',
    category: 'governance',
    currentEdge: 'Clear enterprise playbook around model evaluations, responsible AI checks, runtime policy, observability, and incident response.',
    weakSpot: 'Governance guidance is not itself a production execution layer for building and operating software.',
    axonCounter: 'Turn governance into mandatory runtime gates, signed trust ledger records, and launch blockers attached to every mission.',
    sourceUrl: 'https://www.ibm.com/think/insights/agentic-ai-governance-playbook',
  },
  {
    id: 'agent-observability-market',
    name: 'Agent Observability Vendors',
    category: 'observability',
    currentEdge: 'Fast-moving focus on traces, forensic visibility, agent behavior monitoring, and machine-consumable operations data.',
    weakSpot: 'Observability alone lacks autonomous repair authority, product context, release control, and customer delivery accountability.',
    axonCounter: 'Use observability as agent fuel: every trace becomes policy evidence, a repair mission, or a regression eval.',
    sourceUrl: 'https://www.techradar.com/pro/observability-was-built-for-humans-ai-agents-need-something-different',
  },
];

const competitiveCapabilities: CompetitiveCapability[] = [
  capability(
    'agent-control-plane',
    'Agent control plane and governance',
    'governance',
    'Central agent inventory, identity, permissions, policy, audit, and enterprise-wide controls.',
    ['ServiceNow AI Control Tower', 'GitHub Copilot enterprise controls', 'IBM governance playbook'],
    ['Policies surface with create/simulate/deprecate', '13-step agent/tool enforcement pipeline', 'audit and trust ledger', 'settings provider controls'],
    86,
    95,
    'Unify agent identity, policy bundles, approvals, and runtime evidence into one control-plane screen.',
    'Ship Agent Control Plane: agent identity, scoped permissions, policy bundles, kill switch, and per-agent evidence ledger.',
    '/policies',
  ),
  capability(
    'repo-native-sdlc',
    'Repo-native SDLC execution',
    'agent-runtime',
    'Issue-to-PR style coding agents with isolated environments, tests, diffs, and review handoff.',
    ['GitHub Copilot Coding Agent', 'Codex', 'Claude Code', 'Cursor'],
    ['Agent Projects execution fabric', 'workspace commands', 'delivery packs', 'browser evidence hooks'],
    82,
    94,
    'Needs GitHub/IDE/CLI entry points and PR-native review packaging to match where engineers already work.',
    'Add GitHub issue/PR intake, CLI mission submit, PR package publishing, and IDE status contracts.',
    '/agent-projects',
  ),
  capability(
    'itsm-itom-resolution',
    'ITSM and ITOM autonomous resolution',
    'deployment',
    'Detect, resolve, prevent, and report IT incidents across service desk, operations, and change workflows.',
    ['ServiceNow', 'Jira Service Management with Rovo'],
    ['Service Desk', 'Managed Services', 'Incidents', 'SRE timeline', 'Mission Control handoffs'],
    78,
    94,
    'Incident-to-repair is present but needs closed-loop ticket creation, SLO burn, and auto-remediation evidence.',
    'Create SLO-driven incident autopilot: detect, create ticket, run repair mission, verify recovery, publish post-mortem.',
    '/incidents',
  ),
  capability(
    'interoperability',
    'Agent interoperability and tool ecosystem',
    'marketplace',
    'MCP/A2A-style agent discovery, tool connectors, secure handoffs, and long-running task envelopes.',
    ['ServiceNow plus Google Cloud', 'Atlassian Rovo Studio', 'GitHub Agent HQ ecosystem'],
    ['Integrations registry', 'Tools registry', 'Agentic Mesh blueprints', 'Agent Blackboard'],
    80,
    93,
    'Tools and mesh exist, but external agent cards, task envelopes, and connector marketplace packaging should be first-class.',
    'Ship agent cards, task-envelope API, connector certification, and MCP server packaging for every major module.',
    '/integrations',
  ),
  capability(
    'proof-ledger',
    'Signed proof, compliance, and customer evidence',
    'evidence',
    'Every autonomous action must leave reviewable, exportable, tamper-evident proof.',
    ['IBM governance patterns', 'GitHub enterprise audit controls', 'ServiceNow governance'],
    ['Trust Ledger', 'Evidence Explorer', 'Audit verification', 'Release Command reports', 'policy simulation'],
    90,
    97,
    'Strongest AXON wedge. Needs every mission subsystem to emit consistent evidence manifests by default.',
    'Make proof mandatory: every mission phase emits signed evidence, policy decision, artifact hash, and customer-readable summary.',
    '/trust-ledger',
  ),
  capability(
    'model-finops-routing',
    'Model FinOps, routing, and quality gates',
    'finops',
    'Provider routing, budget limits, context caching, eval gates, sovereign mode, and cost attribution.',
    ['Enterprise Copilot data residency', 'Vertex/Gemini enterprise context patterns', 'Agentic AI governance vendors'],
    ['Models route probe', 'Evaluation Lab', 'Cost ledger', 'Model FinOps reports', 'budget policy'],
    88,
    96,
    'Route policy exists, but the operator needs automatic premium escalation rules and margin guardrails by customer/project.',
    'Activate model autopilot: task routing, cache plan, budget hard stops, critic escalation, and margin protection.',
    '/agentic-finops',
  ),
  capability(
    'browser-release-ops',
    'Browser proof and progressive release operations',
    'browser-qa',
    'Real browser journeys, accessibility checks, deployment gates, canary rollout, rollback, and SLO verification.',
    ['AI app builders', 'deployment monitoring platforms', 'ITOM products'],
    ['Preview QA', 'Release Command', 'Production Readiness', 'Checkpoints', 'Database Pipeline'],
    79,
    95,
    'Preview QA and release plans need a tighter hard gate from browser proof to canary to rollback.',
    'Ship progressive delivery fabric: browser traces, canary gates, SLO burn, rollback command, and release blocker policy.',
    '/release-command',
  ),
  capability(
    'customer-delivery-os',
    'Customer delivery and managed-service packaging',
    'ux',
    'Outcome packaging, pricing, SLA, support plan, customer report, and renewal-ready evidence.',
    ['ServiceNow managed workflow ecosystem', 'Atlassian service management', 'AI software agencies'],
    ['Customer Delivery', 'Managed Services', 'Executive', 'Mission Control', 'Release Command'],
    84,
    94,
    'This is AXON-s strongest business wedge but needs pricing, SLA, and evidence to become a repeatable product line.',
    'Turn each mission into a customer delivery account with SLA, margin, proof pack, support runbook, and renewal actions.',
    '/customer-delivery',
  ),
];

const sourceSignals: MarketSignal[] = [
  signal('cloud-coding-agent', 'internal:reference/cloud-coding-agent', 'Cloud coding agents use repo access, PR creation, per-task sandbox containers, and parallel background work.', 'Make coding agents persistent, asynchronous, test-capable, and connected to Git workflows.', 'AXON must go beyond coding by connecting sandbox execution to product, database, QA, security, release, and customer delivery evidence.', ['sandbox', 'agent-runtime', 'evidence'], 94, 'recent'),
  signal('agent-safety-reference', 'internal:reference/agent-safety', 'Agent safety posture needs sandbox boundaries, protected paths, network controls, approvals, and telemetry.', 'Enterprise adoption depends on visible control boundaries and operational telemetry.', 'AXON needs signed evidence, policy decisions, network egress controls, and replayable command/browser traces.', ['sandbox', 'governance', 'security', 'evidence'], 96, 'today'),
  signal('terminal-agent-reference', 'internal:reference/terminal-agent', 'Terminal-native agents edit files, run commands, commit changes, use connectors, and support enterprise hosting.', 'Meet developers where they work while expanding through connectors and enterprise deployment modes.', 'AXON should expose CLI/IDE/GitHub entry points while keeping the web OS as mission command.', ['agent-runtime', 'marketplace', 'governance'], 92, 'recent'),
  signal('terminal-agent-reference', 'internal:reference/session-continuity', 'Modern coding agents emphasize recap/memory, connector helpers, hooks, telemetry controls, and large context for enterprise users.', 'Improve long-running session continuity and configurable governance.', 'AXON should add durable mission recaps, agent memory hygiene, and hook-based policy interception.', ['memory', 'marketplace', 'governance'], 88, 'today'),
  signal('browser-app-builder', 'internal:reference/browser-app-testing', 'App builders test web apps in a real browser, simulate users, analyze failures, and can fix issues.', 'Close the loop from app generation to self-validation and auto-repair.', 'AXON Preview QA must move from generated plans to real browser workers, videos, traces, and automatic fix loops.', ['browser-qa', 'agent-runtime', 'ux'], 95, 'today'),
  signal('deployment-monitoring-reference', 'internal:reference/deployment-monitoring', 'Deployment monitoring exposes uptime, geography, status, analytics, and agent-assisted downtime investigation.', 'Turn deployment operations into agent-addressable repair workflows.', 'AXON needs progressive delivery, uptime timelines, SLO burn alerts, and incident-to-fix Mission Control runs.', ['deployment', 'evidence', 'agent-runtime'], 89, 'recent'),
  signal('full-stack-builder', 'internal:reference/full-stack-builder', 'Full-stack AI app builders combine editable code, Git sync, deployment, security, and enterprise governance.', 'Own the natural-language-to-production app workflow for teams and enterprises.', 'AXON should position as full IT delivery OS: app build plus database reliability, managed services, release gates, and customer reports.', ['ux', 'deployment', 'governance'], 91, 'today'),
  signal('visual-builder', 'internal:reference/visual-builder', 'Live visual editing, themes, design tooling, and real-time preview make software creation accessible to non-technical users.', 'Make app iteration accessible to product/design teams, not only engineers.', 'AXON needs design-to-code controls, visual preview diffs, and generated UI quality gates.', ['ux', 'browser-qa'], 86, 'recent'),
  signal('background-agent', 'internal:reference/background-agent', 'Background agents run autonomously on repositories with Docker-aware environments and agent session management.', 'Make async agents a default part of the software workflow.', 'AXON should add background mission queues, Docker/Kubernetes providers, and multi-agent session search.', ['agent-runtime', 'sandbox'], 87, 'recent'),
  signal('async-engineering-agent', 'internal:reference/async-engineering-agent', 'Asynchronous engineering agents handle bug fixes, tests, version bumps, and feature building at multi-agent scale.', 'Normalize delegated software work as a background cloud workflow.', 'AXON must connect delegated work to enterprise release authority, customer impact, and ops handoff.', ['agent-runtime', 'sandbox', 'evidence'], 84, 'today'),
  signal('multi-agent-framework', 'internal:reference/multi-agent-framework', 'Multi-agent primitives include hierarchy, sequential pipelines, parallel fan-out/gather, generator-critic, and human-in-the-loop patterns.', 'Standardize composable multi-agent applications.', 'AXON should expose agent-team topology, shared state, review loops, and policy-gated human approvals as first-class product objects.', ['agent-runtime', 'governance'], 93, 'recent'),
  signal('agent-interoperability', 'internal:reference/agent-interoperability', 'Agent interoperability patterns emphasize secure collaboration, discovery, task lifecycle, long-running work, and enterprise boundaries.', 'Agents are becoming interoperable workers across enterprise systems rather than isolated prompt chains.', 'AXON needs A2A-style task envelopes, agent cards, scoped security context, and durable handoff state.', ['agent-runtime', 'governance', 'marketplace'], 92, 'today'),
  signal('context-cache-reference', 'internal:reference/context-cache', 'Context caching reuses repeated input tokens through implicit and explicit caching for cost and latency reduction.', 'The agent market is optimizing repetitive long-context workflows through cached prefixes and explicit cache handles.', 'AXON should turn repository maps, API specs, database schemas, policy packs, and product briefs into reusable cached context.', ['finops', 'memory', 'agent-runtime'], 91, 'today'),
  signal('context-cache-reference', 'internal:reference/sovereign-context-cache', 'Enterprise context caching targets repeated long-context workloads such as chatbots, document sets, repository analysis, and bug fixing.', 'Enterprise customers want lower cost while preserving secure cloud controls and auditability.', 'AXON should offer sovereign cache policy, token savings estimates, and FinOps evidence per mission.', ['finops', 'governance', 'evidence'], 90, 'today'),
  signal('general-autonomy-reference', 'internal:reference/general-autonomy', 'General autonomous agent experiences emphasize browser automation, replayable task execution, and broad work beyond code.', 'Compete for general-purpose work execution, not just developer coding.', 'AXON should combine browser operator, IT service delivery, and customer handoff in one OS.', ['browser-qa', 'ux', 'agent-runtime'], 78, 'recent'),
  signal('software-engineer-agent', 'internal:reference/software-engineer-agent', 'Autonomous software engineer positioning focuses on async software delivery and engineering tasks.', 'Sell outcomes instead of tooling.', 'AXON should sell productized IT outcomes with evidence, SLAs, margin, and customer delivery reports.', ['agent-runtime', 'deployment', 'evidence'], 82, 'today'),
];

const buildPackCatalog: MarketBuildPack[] = [
  {
    id: 'real-browser-worker',
    name: 'Real Browser Worker and Auto-Fix Loop',
    status: 'ready-for-mission-control',
    urgency: 'P0',
    whyNow: 'Modern app builders make browser self-testing central. AXON already has Preview QA plans; the next moat is real execution plus auto-fix loops.',
    userBenefit: 'Users see proof that their app works, with screenshots, traces, accessibility findings, and automatic repair tickets.',
    moat: 'Browser evidence becomes release evidence, customer evidence, and agent learning data.',
    modules: ['Preview QA', 'Sandbox Kernel', 'Mission Control', 'Release Command', 'Service Desk'],
    ownerAgents: ['QAAgent', 'BrowserAgent', 'FullStackEngineerAgent', 'ReleaseAgent'],
    features: ['Playwright worker adapter', 'screenshots/videos/traces', 'console/network log capture', 'axe-core scan', 'failed-journey auto-fix mission'],
    acceptanceCriteria: ['Run a browser journey in sandbox', 'Attach trace artifact to Release Command', 'Create Service Desk ticket for failed journey', 'Block production release on critical accessibility or journey failure'],
    evidence: ['Playwright trace', 'screenshot manifest', 'accessibility report', 'auto-fix ticket'],
    missionPrompt: 'Build real Browser Worker execution for Preview QA with Playwright traces, screenshots, accessibility scan, console/network logs, and auto-fix tickets connected to Release Command.',
    impactScore: 98,
  },
  {
    id: 'policy-evidence-ledger',
    name: 'Signed Policy and Evidence Ledger',
    status: 'ready-for-mission-control',
    urgency: 'P0',
    whyNow: 'Enterprise coding agents emphasize sandbox boundaries, protected paths, telemetry, and approvals. AXON must make trust auditable.',
    userBenefit: 'Enterprise users can prove who did what, why it was allowed, what changed, and whether it passed gates.',
    moat: 'Tamper-evident delivery records across code, database, browser, security, deployment, and customer handoff.',
    modules: ['Security Center', 'Release Command', 'Sandbox Kernel', 'Agent Blackboard', 'Audit Trail'],
    ownerAgents: ['SecurityAgent', 'ComplianceAgent', 'ReleaseAgent', 'SREAgent'],
    features: ['hash-chained evidence records', 'policy decision capture', 'approval artifacts', 'secret-safe redaction', 'SOC2/ISO export pack'],
    acceptanceCriteria: ['Every mission phase emits an evidence record', 'Evidence chain verifies hashes', 'Release Command shows signed manifest', 'Compliance export includes commands, scans, approvals, and artifacts'],
    evidence: ['signed manifest', 'policy decision log', 'approval record', 'hash chain verification'],
    missionPrompt: 'Build a signed evidence ledger for AXON that records policy decisions, command outputs, browser artifacts, security scans, approvals, and release manifests with hash-chain verification.',
    impactScore: 97,
  },
  {
    id: 'github-ide-mobile-entrypoints',
    name: 'GitHub, IDE, CLI, and Mobile Delegation Entry Points',
    status: 'recommended',
    urgency: 'P1',
    whyNow: 'Agent delegation is moving into GitHub, IDEs, terminals, web, and phones.',
    userBenefit: 'Users can start and review AXON work wherever the request appears: issue, PR, terminal, IDE, or phone.',
    moat: 'AXON keeps one evidence-backed OS while client surfaces fragment across the market.',
    modules: ['Mission Control', 'Service Desk', 'Agent Blackboard', 'Integrations', 'Audit Trail'],
    ownerAgents: ['IntegrationAgent', 'PlatformAgent', 'DeliveryManagerAgent'],
    features: ['GitHub issue/PR mention intake', 'CLI client', 'VS Code panel', 'mobile-safe status summaries', 'cross-client session resume'],
    acceptanceCriteria: ['Create Mission Control run from GitHub issue payload', 'CLI can submit mission and stream status', 'Blackboard recap works across clients', 'Audit records external trigger source'],
    evidence: ['GitHub webhook event', 'CLI transcript', 'session recap', 'audit trigger record'],
    missionPrompt: 'Build AXON cross-client delegation: GitHub issue/PR intake, CLI mission submission, IDE status panel contract, and mobile-safe mission summaries connected to Mission Control.',
    impactScore: 91,
  },
  {
    id: 'progressive-delivery-fabric',
    name: 'Progressive Delivery and SRE Fabric',
    status: 'ready-for-mission-control',
    urgency: 'P1',
    whyNow: 'Modern cloud platforms are turning deployment monitoring into agent-repair workflows, while SRE practice emphasizes reproducible release engineering and canaries.',
    userBenefit: 'Users get preview, staging, canary, rollback, uptime, SLO, and incident repair from one release workflow.',
    moat: 'AXON becomes an operator, not only a builder.',
    modules: ['Release Command', 'Managed Services', 'Mission Control', 'Service Desk', 'Cost'],
    ownerAgents: ['SREAgent', 'ReleaseAgent', 'FinOpsAgent', 'IncidentAgent'],
    features: ['Docker/Kubernetes/Helm assets', 'canary stages', 'SLO burn alerts', 'deployment event timeline', 'auto rollback decision gate'],
    acceptanceCriteria: ['Generate deploy plan from release mission', 'Canary gate blocks on failed health', 'SLO monitor links to incident ticket', 'Rollback plan has owner and command evidence'],
    evidence: ['deployment plan', 'canary checklist', 'SLO report', 'rollback manifest'],
    missionPrompt: 'Build progressive delivery fabric for AXON with Docker/Kubernetes/Helm generation, canary stages, SLO monitors, deployment event timeline, and rollback gates.',
    impactScore: 94,
  },
  {
    id: 'visual-design-to-code',
    name: 'Visual Design-to-Code Control Plane',
    status: 'recommended',
    urgency: 'P2',
    whyNow: 'App builders win non-technical users through live preview, visual edits, themes, and design guidance.',
    userBenefit: 'Product, design, and founders can steer UI without learning the codebase.',
    moat: 'AXON can combine visual control with enterprise evidence and accessibility gates.',
    modules: ['Build Studio', 'Preview QA', 'Product Factory', 'Design System'],
    ownerAgents: ['UXAgent', 'FrontendAgent', 'QAAgent'],
    features: ['theme tokens', 'visual diff plan', 'component inventory', 'accessibility-aware design gates', 'copy/layout edit queue'],
    acceptanceCriteria: ['Generate theme tokens from request', 'Preview QA checks visual/accessibility gates', 'Design changes become traceable backlog items'],
    evidence: ['theme manifest', 'visual diff checklist', 'a11y report'],
    missionPrompt: 'Build visual design-to-code controls for AXON with theme tokens, component inventory, visual diff plans, and accessibility-aware preview gates.',
    impactScore: 83,
  },
  {
    id: 'model-finops-autopilot',
    name: 'Model FinOps and Routing Autopilot',
    status: 'ready-for-mission-control',
    urgency: 'P0',
    whyNow: 'Enterprise agent adoption is constrained by model cost, latency, privacy, and reliability, while Gemini/Vertex context caching makes repeated long-context work cheaper when designed correctly.',
    userBenefit: 'Users get faster and cheaper delivery with explicit budget, provider failover, and quality gates.',
    moat: 'AXON can sell managed IT outcomes with cost discipline instead of opaque token burn.',
    modules: ['Models', 'Cost', 'Mission Control', 'Release Command', 'Trust Ledger'],
    ownerAgents: ['FinOpsAgent', 'ModelRouterAgent', 'DeliveryManagerAgent', 'CriticAgent'],
    features: ['task-based model routing', 'context cache planner', 'budget burn alerts', 'small-model-first cascade', 'risk-triggered critic passes', 'provider failover', 'margin guardrails by customer project'],
    acceptanceCriteria: ['Every mission records estimated and actual model cost', 'Budget breach blocks optional agents', 'Context cache policy is generated for repeated repository/API/database context', 'Provider failover respects sovereign constraints', 'Quality gates decide when to escalate to premium models'],
    evidence: ['model route record', 'cost forecast', 'cache key plan', 'budget alert', 'margin report'],
    missionPrompt: 'Build Model FinOps autopilot for AXON with task-based routing, context cache planning, budget alerts, provider failover, risk-triggered critic passes, and customer margin guardrails.',
    impactScore: 96,
  },
  {
    id: 'agentic-mesh-os',
    name: 'Agentic Mesh Operating System',
    status: 'ready-for-mission-control',
    urgency: 'P0',
    whyNow: 'Enterprise agent platforms are converging on coordinated agent teams with explicit communication protocols, not one monolithic agent.',
    userBenefit: 'Users get a real IT-service software workflow: planner, researchers, builders, critics, database, security, SRE, release, and customer agents working with clear ownership.',
    moat: 'AXON can own the whole delivery operating model: topology, handoffs, shared state, cost budgets, critic loops, human gates, and signed evidence.',
    modules: ['Agentic Mesh', 'Agent Blackboard', 'Mission Control', 'Trust Ledger', 'Model FinOps'],
    ownerAgents: ['AgenticCoordinatorAgent', 'FinOpsAgent', 'CriticAgent', 'ReleaseAgent'],
    features: ['ADK-style topology planner', 'A2A-style task envelopes', 'parallel fan-out/gather', 'loop-critic rework policy', 'shared state channels', 'human-gated approvals'],
    acceptanceCriteria: ['Generate mesh blueprint from any mission', 'Attach FinOps report to the blueprint', 'Every handoff has sender, receiver, task, artifacts, status, and security context', 'High-risk work gets critic loops and human gates'],
    evidence: ['mesh blueprint', 'task envelopes', 'quality loop plan', 'FinOps report', 'human gate list'],
    missionPrompt: 'Build Agentic Mesh OS for AXON with topology planning, A2A-style task envelopes, shared state, FinOps budgets, critic loops, and human-gated enterprise approvals.',
    impactScore: 97,
  },
];

export class MarketRadarService {
  listReports(): MarketRadarReport[] {
    return Array.from(reports.values()).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }

  getCompetitiveBenchmark(): CompetitiveBenchmarkReport {
    const capabilities = competitiveCapabilities
      .map((item) => ({ ...item }))
      .sort((a, b) => (b.targetScore - b.score) - (a.targetScore - a.score));
    const moatLanes = buildMoatLanes(capabilities);
    const overallScore = Math.round(capabilities.reduce((sum, item) => sum + item.score, 0) / Math.max(capabilities.length, 1));
    return {
      id: `comp_${new Date().toISOString().slice(0, 10)}`,
      generatedAt: new Date().toISOString(),
      sourceWindow: 'Current public market scan on 2026-05-29 plus internal AXON capability inventory.',
      thesis: 'The market is converging on agent control planes, ITSM-native agents, coding agents, interoperability, observability, and governance. AXON can beat point competitors by becoming the evidence-backed IT-service software OS that builds, verifies, releases, operates, and packages customer proof in one loop.',
      overallScore,
      competitors: competitorProfiles,
      capabilities,
      moatLanes,
      topMoves: capabilities.slice(0, 5).map((capability, index) => ({
        order: index + 1,
        capabilityId: capability.id,
        move: capability.nextMove,
        expectedLift: capability.targetScore - capability.score,
      })),
      sourceNotes: [
        'ServiceNow and Google Cloud emphasize autonomous enterprise operations, shared governance, data fabric, and A2A/A2UI/MCP interoperability.',
        'Atlassian Rovo emphasizes organizational search, chat, agents, Studio, and Jira Service Management resolution workflows.',
        'GitHub Copilot Coding Agent emphasizes secure GitHub-native issue-to-PR execution with enterprise controls.',
        'IBM governance guidance emphasizes model evaluation, responsible AI checks, runtime policy, observability, and incident response.',
        'Agent observability coverage emphasizes forensic visibility because autonomous systems need machine-consumable operational traces.',
      ],
    };
  }

  listMoatActivationRuns(): MoatActivationRun[] {
    const normalized = activationStore.read().map((run) => normalizeMoatActivationRun(run));
    return normalized.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }

  getReport(id: string): MarketRadarReport | undefined {
    return reports.get(id);
  }

  createReport(input: MarketRadarInput = {}): MarketRadarReport {
    const focus = input.focus?.trim() || 'Build AXON into an enterprise AI IT agentic OS for coding, app building, browser proof, deployment, and managed IT services.';
    const targetUser = input.targetUser?.trim() || 'founders, enterprise IT leaders, product teams, agencies, and engineering teams';
    const observedSignals = (input.observedSignals ?? []).map((item, index): MarketSignal => ({
      id: `sig_custom_${index + 1}`,
      source: item.source,
      sourceUrl: item.sourceUrl ?? 'operator-observation',
      observedCapability: item.capability,
      strategicIntent: 'Operator-provided market signal.',
      axonResponse: 'Convert the signal into an evidence-backed AXON build pack.',
      areas: inferAreas(item.capability),
      confidence: 70,
      freshness: 'today',
    }));
    const signals = [...sourceSignals, ...observedSignals];
    const buildPacks = rankBuildPacks(focus, input.includeMoonshots ?? true);
    const gaps = buildGaps(signals, buildPacks);
    const moatScore = calculateMoatScore(buildPacks, gaps);

    const report: MarketRadarReport = {
      id: `radar_${nanoid(10)}`,
      tenantId: input.tenantId ?? 'tenant_default',
      focus,
      targetUser,
      generatedAt: new Date().toISOString(),
      marketThesis: 'The 2026 agent market is moving from chat to governed action: async agents, sandboxed execution, browser self-testing, connectors, enterprise security, deployment operations, and replayable evidence.',
      summary: `AXON should win by becoming the integrated IT-service software OS: build apps, verify them, secure data, deploy safely, operate services, and package customer-ready proof from one mission loop.`,
      moatScore,
      signals,
      gaps,
      buildPacks,
      recommendedSequence: buildPacks.slice(0, 5).map((pack, index) => ({
        order: index + 1,
        buildPackId: pack.id,
        rationale: `${pack.urgency} because ${pack.whyNow}`,
      })),
      referenceCoverage: coverage(signals),
    };

    reports.set(report.id, report);
    return report;
  }

  async launchBuildPack(reportId: string, buildPackId: string): Promise<MarketRadarLaunch | undefined> {
    const report = reports.get(reportId);
    if (!report) return undefined;
    const pack = report.buildPacks.find((item) => item.id === buildPackId);
    if (!pack) return undefined;
    const run = await missionControl.createRun({
      tenantId: report.tenantId,
      customerName: 'AXON Market Radar',
      mission: pack.missionPrompt,
      environment: pack.urgency === 'P0' ? 'preview' : 'staging',
      regulated: ['P0', 'P1'].includes(pack.urgency),
      compliance: ['SOC 2', 'ISO 27001'],
      integrations: pack.modules,
    });
    return {
      reportId,
      buildPackId,
      missionControlRunId: run.id,
      releaseMissionId: run.releaseMissionId,
      status: run.status,
      score: run.score,
    };
  }

  async createMoatActivationRun(input: { tactic?: string; maxMissions?: number; tenantId?: string } = {}): Promise<MoatActivationRun> {
    const benchmark = this.getCompetitiveBenchmark();
    const maxMissions = Math.max(1, Math.min(input.maxMissions ?? 3, 5));
    const capabilities = benchmark.capabilities
      .filter((capability) => capability.score < capability.targetScore)
      .slice(0, maxMissions);

    const missionRuns = [];
    for (const capability of capabilities) {
      const run = await missionControl.createRun({
        tenantId: input.tenantId ?? 'tenant_default',
        customerName: 'AXON Competitive Moat',
        mission: `${capability.nextMove}\n\nCompetitive bar: ${capability.marketBar}\nAXON proof today: ${capability.axonProof.join('; ')}\nAcceptance proof required: ${capability.gap}`,
        environment: capability.targetScore >= 95 ? 'staging' : 'preview',
        regulated: true,
        budgetUsd: 5000,
        timelineDays: capability.targetScore >= 95 ? 14 : 21,
        compliance: ['SOC 2', 'ISO 27001'],
        integrations: ['GitHub', 'Jira Service Management', 'ServiceNow', 'MCP', 'Slack'],
      });
      missionRuns.push({
        capabilityId: capability.id,
        capabilityTitle: capability.title,
        missionControlRunId: run.id,
        releaseMissionId: run.releaseMissionId,
        status: run.status,
        score: run.score,
        proof: [
          `Mission Control run ${run.id}`,
          `Release mission ${run.releaseMissionId}`,
          `FinOps report ${run.finOpsReportId}`,
          `Trust records ${run.trustRecordIds.length}`,
        ],
      });
    }

    const stageGates = buildActivationStageGates(capabilities, missionRuns);
    const riskRegister = buildActivationRisks(capabilities);
    const progress = {
      completedGates: stageGates.filter((gate) => gate.status === 'pass').length,
      totalGates: stageGates.length,
      score: Math.round(stageGates.reduce((sum, gate) => sum + gate.score, 0) / Math.max(stageGates.length, 1)),
    };
    const artifact = artifactService.put({
      tenantId: input.tenantId ?? 'tenant_default',
      kind: 'release-pack',
      name: `Competitive moat activation ${benchmark.id}`,
      content: {
        benchmarkId: benchmark.id,
        tactic: input.tactic?.trim() || 'Close the largest competitor gaps first while turning every improvement into customer-readable proof.',
        sourceWindow: benchmark.sourceWindow,
        competitors: benchmark.competitors.map((competitor) => ({
          id: competitor.id,
          name: competitor.name,
          sourceUrl: competitor.sourceUrl,
          axonCounter: competitor.axonCounter,
        })),
        capabilities: capabilities.map((capability) => ({
          id: capability.id,
          title: capability.title,
          marketBar: capability.marketBar,
          gap: capability.gap,
          nextMove: capability.nextMove,
        })),
        missionRuns,
        stageGates,
        riskRegister,
      },
      metadata: {
        benchmarkId: benchmark.id,
        capabilityIds: capabilities.map((capability) => capability.id),
      },
    });
    const trustRecord = trustLedger.append({
      tenantId: input.tenantId ?? 'tenant_default',
      kind: 'market-signal',
      actor: 'MarketRadarAgent',
      actorType: 'agent',
      subject: `Competitive moat activation ${benchmark.id}`,
      summary: `Created ${missionRuns.length} competitive moat mission runs with ${stageGates.length} stage gates and ${riskRegister.length} risks.`,
      risk: capabilities.some((capability) => capability.targetScore >= 95) ? 'high' : 'medium',
      source: 'Market Radar competitive benchmark',
      artifacts: [artifact.id, ...missionRuns.flatMap((run) => [run.missionControlRunId, run.releaseMissionId])],
      metadata: {
        benchmarkId: benchmark.id,
        overallScore: benchmark.overallScore,
        activationCapabilities: capabilities.map((capability) => capability.id),
      },
      controls: ['SOC2-CC7.2', 'SOC2-CC8.1', 'ISO27001-A.5.15'],
    });

    const activation: MoatActivationRun = {
      id: `moat_${nanoid(10)}`,
      reportId: benchmark.id,
      generatedAt: new Date().toISOString(),
      status: 'created',
      progress,
      tactic: input.tactic?.trim() || 'Close the largest competitor gaps first while turning every improvement into customer-readable proof.',
      summary: `Created ${missionRuns.length} Mission Control run${missionRuns.length === 1 ? '' : 's'} from the live competitive benchmark.`,
      stageGates,
      proofArtifacts: [
        {
          id: artifact.id,
          name: artifact.name,
          kind: artifact.kind,
          uri: artifact.uri,
          sha256: artifact.sha256,
          source: 'Artifact store',
        },
        {
          id: trustRecord.id,
          name: trustRecord.subject,
          kind: trustRecord.kind,
          uri: `trust-ledger://${trustRecord.id}`,
          sha256: trustRecord.hash,
          source: 'Trust Ledger',
        },
      ],
      riskRegister,
      missionControlRuns: missionRuns,
      nextReviewAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    activationStore.write([activation, ...activationStore.read().map((run) => normalizeMoatActivationRun(run))].slice(0, 100));
    return activation;
  }
}

function normalizeMoatActivationRun(run: MoatActivationRun): MoatActivationRun {
  const raw = run as Partial<MoatActivationRun>;
  const missionControlRuns = (raw.missionControlRuns ?? []).map((mission) => ({
    capabilityId: mission.capabilityId,
    capabilityTitle: mission.capabilityTitle,
    missionControlRunId: mission.missionControlRunId,
    releaseMissionId: mission.releaseMissionId,
    status: mission.status,
    score: typeof mission.score === 'number' ? mission.score : 0,
    proof: mission.proof ?? [
      `Mission Control run ${mission.missionControlRunId}`,
      `Release mission ${mission.releaseMissionId}`,
    ],
  }));
  const matchedCapabilities = missionControlRuns
    .map((mission) => competitiveCapabilities.find((capability) => capability.id === mission.capabilityId))
    .filter((capability): capability is CompetitiveCapability => Boolean(capability));
  const capabilities = matchedCapabilities.length ? matchedCapabilities : competitiveCapabilities.slice(0, Math.max(missionControlRuns.length, 1));
  const stageGates = raw.stageGates ?? buildActivationStageGates(capabilities, missionControlRuns);
  const completedGates = stageGates.filter((gate) => gate.status === 'pass').length;
  const totalGates = stageGates.length;
  const progress = raw.progress ?? {
    completedGates,
    totalGates,
    score: Math.round(stageGates.reduce((sum, gate) => sum + gate.score, 0) / Math.max(totalGates, 1)),
  };

  return {
    id: raw.id ?? `moat_${nanoid(10)}`,
    reportId: raw.reportId ?? 'comp_legacy',
    generatedAt: raw.generatedAt ?? new Date().toISOString(),
    status: raw.status ?? 'created',
    progress,
    tactic: raw.tactic ?? 'Legacy activation imported into the competitive moat command center.',
    summary: raw.summary ?? `Imported ${missionControlRuns.length} legacy Mission Control run${missionControlRuns.length === 1 ? '' : 's'}.`,
    stageGates,
    proofArtifacts: raw.proofArtifacts ?? [],
    riskRegister: raw.riskRegister ?? buildActivationRisks(capabilities),
    missionControlRuns,
    nextReviewAt: raw.nextReviewAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function capability(
  id: string,
  title: string,
  area: CapabilityArea,
  marketBar: string,
  competitorLeaders: string[],
  axonProof: string[],
  score: number,
  targetScore: number,
  gap: string,
  nextMove: string,
  route: string,
): CompetitiveCapability {
  return {
    id,
    title,
    area,
    marketBar,
    competitorLeaders,
    axonProof,
    score,
    targetScore,
    gap,
    nextMove,
    route,
  };
}

function buildMoatLanes(capabilities: CompetitiveCapability[]): MoatLane[] {
  return [
    {
      id: 'outcome-os',
      title: 'Outcome OS, not point agent',
      winCondition: 'AXON owns the whole path from request to operated service, not one assistant slot.',
      proof: ['Mission Control', 'Customer Delivery', 'Release Command', 'Managed Services'],
      ownerModules: ['Mission Control', 'Customer Delivery', 'Managed Services'],
      riskIfIgnored: 'Point competitors win a narrow workflow and reduce AXON to an orchestration dashboard.',
      score: averageScore(capabilities, ['customer-delivery-os', 'itsm-itom-resolution', 'browser-release-ops']),
    },
    {
      id: 'proof-ledger',
      title: 'Proof ledger as trust moat',
      winCondition: 'Every autonomous action produces signed, exportable evidence suitable for enterprise review.',
      proof: ['Trust Ledger', 'Evidence Explorer', 'Audit Trail', 'Policy simulation'],
      ownerModules: ['Trust Ledger', 'Evidence', 'Audit', 'Policies'],
      riskIfIgnored: 'Security buyers will reject autonomous work that cannot explain itself.',
      score: averageScore(capabilities, ['proof-ledger', 'agent-control-plane']),
    },
    {
      id: 'agentic-mesh',
      title: 'Agentic mesh with handoff contracts',
      winCondition: 'Specialist agents coordinate with explicit task envelopes, budgets, critic loops, and human gates.',
      proof: ['Agentic Mesh', 'Agent Blackboard', 'Pipeline', 'Models'],
      ownerModules: ['Agentic Mesh', 'Pipeline', 'Models', 'Memory'],
      riskIfIgnored: 'Single-agent experiences will look faster even if they fail on enterprise complexity.',
      score: averageScore(capabilities, ['interoperability', 'repo-native-sdlc', 'agent-control-plane']),
    },
    {
      id: 'cost-quality-autopilot',
      title: 'Cost-quality autopilot',
      winCondition: 'Every task is routed through cost, risk, quality, and sovereign constraints automatically.',
      proof: ['Model FinOps', 'Cost', 'Evaluation Lab', 'Models'],
      ownerModules: ['Agentic FinOps', 'Cost', 'Evaluations', 'Models'],
      riskIfIgnored: 'Enterprise pilots stall when token spend and quality variance become unpredictable.',
      score: averageScore(capabilities, ['model-finops-routing']),
    },
  ];
}

function averageScore(capabilities: CompetitiveCapability[], ids: string[]) {
  const selected = capabilities.filter((capability) => ids.includes(capability.id));
  return Math.round(selected.reduce((sum, capability) => sum + capability.score, 0) / Math.max(selected.length, 1));
}

function buildActivationStageGates(
  capabilities: CompetitiveCapability[],
  missionRuns: MoatActivationRun['missionControlRuns'],
): MoatActivationRun['stageGates'] {
  return capabilities.flatMap((capability) => {
    const mission = missionRuns.find((run) => run.capabilityId === capability.id);
    const gap = capability.targetScore - capability.score;
    return [
      {
        id: `${capability.id}:market-bar`,
        title: `${capability.title} market bar locked`,
        ownerAgent: 'MarketRadarAgent',
        status: 'pass' as const,
        score: 100,
        evidence: [capability.marketBar, ...capability.competitorLeaders],
        nextAction: 'Keep source notes fresh before the next competitive review.',
      },
      {
        id: `${capability.id}:execution`,
        title: `${capability.title} execution run created`,
        ownerAgent: 'MissionControlAgent',
        status: mission ? 'pass' as const : 'block' as const,
        score: mission ? Math.max(70, mission.score) : 0,
        evidence: mission?.proof ?? ['Mission Control run missing'],
        nextAction: mission ? `Drive ${mission.missionControlRunId} until release evidence is attached.` : 'Create a Mission Control run.',
      },
      {
        id: `${capability.id}:proof`,
        title: `${capability.title} proof package required`,
        ownerAgent: 'ComplianceAgent',
        status: gap <= 7 ? 'pass' as const : gap <= 14 ? 'warn' as const : 'block' as const,
        score: Math.max(50, 100 - gap * 3),
        evidence: capability.axonProof,
        nextAction: capability.gap,
      },
    ];
  });
}

function buildActivationRisks(capabilities: CompetitiveCapability[]): MoatActivationRun['riskRegister'] {
  return capabilities.map((capability) => {
    const gap = capability.targetScore - capability.score;
    return {
      id: `risk_${capability.id}`,
      severity: gap >= 16 ? 'critical' : gap >= 10 ? 'high' : gap >= 6 ? 'medium' : 'low',
      title: `${capability.title} gap could let point competitors win buyer mindshare.`,
      mitigation: capability.nextMove,
      ownerAgent: ownerForCapability(capability.area),
    };
  });
}

function ownerForCapability(area: CapabilityArea) {
  const owners: Record<CapabilityArea, string> = {
    sandbox: 'SandboxKernelAgent',
    'agent-runtime': 'AgenticCoordinatorAgent',
    'browser-qa': 'QAAgent',
    deployment: 'ReleaseAgent',
    governance: 'ComplianceAgent',
    security: 'SecurityAgent',
    marketplace: 'IntegrationAgent',
    ux: 'ProductStrategistAgent',
    memory: 'MemoryAgent',
    finops: 'FinOpsAgent',
    evidence: 'TrustLedgerAgent',
  };
  return owners[area];
}

function signal(
  source: MarketSignal['source'],
  sourceUrl: string,
  observedCapability: string,
  strategicIntent: string,
  axonResponse: string,
  areas: CapabilityArea[],
  confidence: number,
  freshness: MarketSignal['freshness'],
): MarketSignal {
  return {
    id: `sig_${source}_${sourceUrl.split('/').filter(Boolean).pop()?.replace(/[^a-z0-9]+/gi, '-').slice(0, 24) ?? nanoid(6)}`,
    source,
    sourceUrl,
    observedCapability,
    strategicIntent,
    axonResponse,
    areas,
    confidence,
    freshness,
  };
}

function rankBuildPacks(focus: string, includeMoonshots: boolean) {
  const lower = focus.toLowerCase();
  return buildPackCatalog
    .filter((pack) => includeMoonshots || pack.urgency !== 'P3')
    .map((pack) => {
      let boost = 0;
      if (/browser|preview|qa|app builder|visual/.test(lower) && pack.id === 'real-browser-worker') boost += 8;
      if (/security|evidence|enterprise|trust|compliance/.test(lower) && pack.id === 'policy-evidence-ledger') boost += 8;
      if (/deploy|operate|sre|it company|managed/.test(lower) && pack.id === 'progressive-delivery-fabric') boost += 8;
      if (/cost|budget|model|provider/.test(lower) && pack.id === 'model-finops-autopilot') boost += 8;
      return { ...pack, impactScore: Math.min(100, pack.impactScore + boost) };
    })
    .sort((a, b) => b.impactScore - a.impactScore || urgencyRank(a.urgency) - urgencyRank(b.urgency));
}

function buildGaps(signals: MarketSignal[], packs: MarketBuildPack[]): CapabilityGap[] {
  const areaToProof: Record<CapabilityArea, string[]> = {
    sandbox: ['Sandbox Kernel local-process adapter', 'risky command blocking', 'artifact snapshots'],
    'agent-runtime': ['Mission Control', 'Agent Blackboard', 'Autonomous Workforce'],
    'browser-qa': ['Preview QA report generation', 'Playwright spec artifact plan'],
    deployment: ['Release Command deployment stages', 'Managed Services operating model'],
    governance: ['Release gates', 'Security Center', 'Provider settings'],
    security: ['Security Center scan', 'Database Pipeline risk review'],
    marketplace: ['API Forge MCP/SDK plan', 'Integrations surface'],
    ux: ['Build Studio', 'Preview QA', 'Company OS'],
    memory: ['Memory surface', 'Agent Blackboard decision summaries'],
    finops: ['Cost dashboard', 'customer margin model'],
    evidence: ['Release Command evidence manifest', 'Browser QA evidence strings'],
  };

  const missingByArea: Record<CapabilityArea, string[]> = {
    sandbox: ['Docker/Kubernetes/E2B provider adapters', 'streaming logs', 'network egress allowlists'],
    'agent-runtime': ['background mission queue', 'auto-repair loops', 'multi-agent evaluation scorecards'],
    'browser-qa': ['real browser execution', 'videos/traces', 'auto-fix failed journeys'],
    deployment: ['canary rollout', 'SLO burn automation', 'rollback command execution'],
    governance: ['OPA/Rego policy engine', 'SSO/SCIM/RBAC', 'tenant-scoped approvals'],
    security: ['AI security fixer', 'SAST/DAST integrations', 'signed vulnerability remediation evidence'],
    marketplace: ['signed plugin registry', 'connector health/quota UI', 'external MCP client bridge'],
    ux: ['visual edit controls', 'design-to-code token compiler', 'mobile mission review'],
    memory: ['durable recap', 'retention/expiry policy', 'cross-client session resume'],
    finops: ['task-cost routing', 'provider failover', 'budget-driven agent throttling'],
    evidence: ['hash-chain signatures', 'artifact storage', 'compliance export packs'],
  };

  const areaCounts = signals.reduce((acc, signalItem) => {
    for (const area of signalItem.areas) acc.set(area, (acc.get(area) ?? 0) + 1);
    return acc;
  }, new Map<CapabilityArea, number>());

  return Array.from(areaCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([area, count]) => {
      const pack = packs.find((item) => item.features.some((feature) => inferAreas(feature).includes(area))) ?? packs[0]!;
      return {
        id: `gap_${area}`,
        title: `${area.replace('-', ' ')} gap from ${count} market signal(s)`,
        area,
        urgency: pack.urgency,
        sourcePatterns: signals.filter((signalItem) => signalItem.areas.includes(area)).map((signalItem) => String(signalItem.source)),
        userBenefit: benefitForArea(area),
        currentAxonProof: areaToProof[area],
        missing: missingByArea[area],
        buildPackId: pack.id,
      };
    });
}

function coverage(signals: MarketSignal[]) {
  const sources = Array.from(new Set(signals.map((item) => String(item.source))));
  return sources.map((source) => {
    const items = signals.filter((item) => String(item.source) === source);
    return {
      source,
      signals: items.length,
      axonResponse: items.map((item) => item.axonResponse).slice(0, 2).join(' '),
    };
  });
}

function calculateMoatScore(packs: MarketBuildPack[], gaps: CapabilityGap[]) {
  const topImpact = packs.slice(0, 3).reduce((sum, pack) => sum + pack.impactScore, 0) / 3;
  const p0Gaps = gaps.filter((gap) => gap.urgency === 'P0').length;
  return Math.max(0, Math.min(100, Math.round(topImpact - p0Gaps * 3)));
}

function inferAreas(text: string): CapabilityArea[] {
  const lower = text.toLowerCase();
  const areas: CapabilityArea[] = [];
  if (/sandbox|container|docker|kubernetes|vm|environment|command/.test(lower)) areas.push('sandbox');
  if (/agent|async|background|multi-agent|workflow|auto-fix|repair/.test(lower)) areas.push('agent-runtime');
  if (/browser|preview|playwright|screenshot|trace|visual|accessibility/.test(lower)) areas.push('browser-qa');
  if (/deploy|canary|rollback|slo|uptime|helm|terraform|release/.test(lower)) areas.push('deployment');
  if (/policy|governance|approval|rbac|sso|scim|enterprise|compliance/.test(lower)) areas.push('governance');
  if (/security|secret|vulnerability|sast|dast|protected/.test(lower)) areas.push('security');
  if (/mcp|connector|plugin|marketplace|api/.test(lower)) areas.push('marketplace');
  if (/design|visual|ux|mobile|ide|github|cli/.test(lower)) areas.push('ux');
  if (/memory|recap|session|context/.test(lower)) areas.push('memory');
  if (/cost|budget|finops|margin|provider|model/.test(lower)) areas.push('finops');
  if (/evidence|telemetry|audit|signed|trace|manifest/.test(lower)) areas.push('evidence');
  return areas.length ? Array.from(new Set(areas)) : ['agent-runtime'];
}

function benefitForArea(area: CapabilityArea) {
  const benefits: Record<CapabilityArea, string> = {
    sandbox: 'Users trust autonomous work because execution is isolated, bounded, replayable, and recoverable.',
    'agent-runtime': 'Users get finished outcomes instead of repeated prompting and manual coordination.',
    'browser-qa': 'Users can see and verify the app like a real customer before release.',
    deployment: 'Users move from generated code to operated software with rollback and uptime accountability.',
    governance: 'Enterprise admins can safely allow agents to work without losing control.',
    security: 'Security risks are found, fixed, and evidenced before customer exposure.',
    marketplace: 'Users can connect real business tools without custom integration projects.',
    ux: 'Non-technical teams can steer product quality, design, and delivery.',
    memory: 'Long-running work resumes with context, decisions, and constraints intact.',
    finops: 'Customers get predictable cost, provider flexibility, and better margins.',
    evidence: 'Every deliverable comes with proof suitable for review, audit, and customer handoff.',
  };
  return benefits[area];
}

function urgencyRank(urgency: MarketBuildPack['urgency']) {
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[urgency];
}

export const marketRadar = new MarketRadarService();
