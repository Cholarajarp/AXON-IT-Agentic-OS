import { nanoid } from 'nanoid';
import { missionControl } from '../mission-control/index.js';
import type {
  CapabilityArea,
  CapabilityGap,
  MarketBuildPack,
  MarketRadarInput,
  MarketRadarLaunch,
  MarketRadarReport,
  MarketSignal,
} from './types.js';

const reports = new Map<string, MarketRadarReport>();

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
    userBenefit: 'Users get a real IT-company workflow: planner, researchers, builders, critics, database, security, SRE, release, and customer agents working with clear ownership.',
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
      summary: `AXON should win by becoming the integrated IT company OS: build apps, verify them, secure data, deploy safely, operate services, and package customer-ready proof from one mission loop.`,
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
