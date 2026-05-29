import { nanoid } from 'nanoid';
import { artifactService } from '../artifacts/index.js';
import { missionControl } from '../mission-control/index.js';
import { DurableJsonStore } from '../services/durable-json-store.js';
import { trustLedger } from '../trust-ledger/index.js';
import type {
  CmdbAssetSeed,
  ITGiantBenchmark,
  ITGiantReadinessReport,
  ManagedServiceAccount,
  ManagedServiceCapabilityBenchmark,
  ManagedServiceCoverage,
  ManagedServiceCriticality,
  ManagedServiceOfferLane,
  ManagedServiceInput,
  ManagedServiceTransformationRun,
  ManagedServiceTower,
  ManagedServiceTowerCategory,
} from './types.js';

const accounts = new Map<string, ManagedServiceAccount>();
const transformationStore = new DurableJsonStore<ManagedServiceTransformationRun[]>('managed-services/transformation-runs.json', []);

const giantBenchmarks: ITGiantBenchmark[] = [
  {
    id: 'tcs',
    name: 'TCS',
    currentEdge: 'Global managed services, sovereign cloud, MDR/SOC, SIAM, cloud migration factories, and decades-long enterprise relationships.',
    weakSpot: 'Large delivery models can be slower to repackage into productized, self-serve, evidence-native autonomous service loops.',
    axonCounter: 'Offer a software-native managed IT OS where every ticket, change, automation, cost decision, and customer report is generated with signed proof.',
    sourceUrl: 'https://www.tcs.com/who-we-are/newsroom/press-release/tcs-launches-sovereignsecure-cloud-europe',
    serviceSignals: ['Sovereign cloud', 'AI-led operations', 'global delivery', 'regulated-industry trust'],
  },
  {
    id: 'accenture',
    name: 'Accenture',
    currentEdge: 'Board-level consulting access, AI/cyber partnerships, secure agentic architecture, and broad reinvention services across industries.',
    weakSpot: 'High-touch consulting can be expensive and slow for customers who need repeatable execution, evidence, and automation from day one.',
    axonCounter: 'Turn transformation consulting into a repeatable operating product: diagnose, run missions, verify outcomes, and price by measurable service value.',
    sourceUrl: 'https://newsroom.accenture.com/news/2026/accenture-and-anthropic-team-to-help-organizations-secure-scale-ai-driven-cybersecurity-operations',
    serviceSignals: ['Agentic cybersecurity', 'secure AI', 'cloud/data partnerships', 'large-scale consulting'],
  },
  {
    id: 'infosys',
    name: 'Infosys',
    currentEdge: 'Topaz AI-first platform, composable agent fabric, transformation services, operations services, quality engineering, and cybersecurity.',
    weakSpot: 'Broad platform story still needs customer-visible proof loops that connect day-to-day tickets to financial and compliance outcomes.',
    axonCounter: 'Expose the operational proof layer directly to customers: every automation, quality gate, and SLA movement is inspectable.',
    sourceUrl: 'https://www.infosys.com/services/data-ai-topaz/overview.html',
    serviceSignals: ['Topaz AI', 'agent fabric', 'business process reimagination', 'quality engineering'],
  },
  {
    id: 'wipro',
    name: 'Wipro',
    currentEdge: 'CyberTransform, CyberShield, cloud/infrastructure security, partner-led MDR, and outcome-based cybersecurity platforms.',
    weakSpot: 'Security-heavy positioning can leave the full SDLC-to-managed-service handoff fragmented for smaller teams.',
    axonCounter: 'Bind security operations to build, database, release, support, and customer success in one managed-service loop.',
    sourceUrl: 'https://www.wipro.com/cybersecurity/services/cybersecurity-platforms/',
    serviceSignals: ['CyberTransform', 'CyberShield', 'MDR', 'zero trust partnerships'],
  },
  {
    id: 'hcltech',
    name: 'HCLTech',
    currentEdge: 'AI Force 2.0, engineering depth, cloud, software, cyber, and enterprise-grade agentic AI positioning.',
    weakSpot: 'Platform capabilities must still be translated into a unified commercial service with transparent runbooks and evidence.',
    axonCounter: 'Make the service factory explicit: account model, towers, runbooks, agents, artifacts, ledger, and value report are generated together.',
    sourceUrl: 'https://www.hcltech.com/press-releases/hcltech-launches-ai-force-20-deliver-enterprise-grade-agentic-ai',
    serviceSignals: ['AI Force', 'engineering services', 'agentic AI', 'managed cybersecurity'],
  },
  {
    id: 'cognizant',
    name: 'Cognizant',
    currentEdge: 'Secure AI Services, Neuro Cybersecurity, responsible AI governance, and Google Cloud agentic AI partnership.',
    weakSpot: 'Secure-AI packaging is strong, but customers also need everyday service management, release, cost, and customer delivery accountability.',
    axonCounter: 'Use secure AI as one tower inside a full IT-service software OS, not the whole service story.',
    sourceUrl: 'https://news.cognizant.com/2026-05-07-Cognizant-Launches-Secure-AI-Services-to-Help-Enterprises-Safely-Scale-Agentic-Systems',
    serviceSignals: ['Secure agent lifecycle', 'runtime telemetry', 'responsible AI governance', 'agentic AI operations'],
  },
  {
    id: 'capgemini',
    name: 'Capgemini',
    currentEdge: 'Sovereign AI/cloud partnerships, cybersecurity, managed hybrid cloud services, and large-scale transformation delivery.',
    weakSpot: 'Large-program delivery can be complex to buy and slow to adapt for software-first operators.',
    axonCounter: 'Package sovereign/cloud/security operations into modular lanes a customer can activate with immediate proof.',
    sourceUrl: 'https://www.capgemini.com/news/press-releases/capgemini-and-google-cloud-expand-strategic-partnership-to-accelerate-ai-adoption-at-scale-by-providing-trusted-and-secure-sovereign-solutions/',
    serviceSignals: ['Sovereign solutions', 'hyper-automated cloud ops', 'cyber resilience', 'managed hybrid cloud'],
  },
];

const capabilityBenchmarks: Array<Omit<ManagedServiceCapabilityBenchmark, 'score' | 'axonProof'>> = [
  {
    id: 'sovereign-cloud-assurance',
    title: 'Sovereign cloud and regulatory assurance',
    marketBar: 'Risk-based sovereignty across legal, operational, data, technical, AI, and supply-chain controls.',
    competitorLeaders: ['TCS', 'Capgemini', 'Accenture Federal'],
    requiredTowerCategories: ['sovereign-cloud', 'cloud-ops', 'security-ops', 'service-integration'],
    targetScore: 96,
    gap: 'AXON needs explicit workload sovereignty classification, residency controls, exit plans, and regulator-ready evidence.',
    improvementMove: 'Add sovereign workload classifier, regional control matrix, DORA/NIS2/GDPR evidence pack, and exit-plan runbook.',
    commercialImpact: 'Unlock regulated public sector, finance, healthcare, and EU enterprise buyers.',
  },
  {
    id: 'managed-cyber-resilience',
    title: 'Managed cyber resilience and MDR',
    marketBar: '24x7 MDR/XDR, threat hunting, attack surface management, incident response, and remediation evidence.',
    competitorLeaders: ['TCS', 'Wipro', 'Cognizant', 'HCLTech'],
    requiredTowerCategories: ['security-ops', 'service-integration', 'cloud-ops'],
    targetScore: 95,
    gap: 'Security scans exist, but AXON needs security operations as a contracted managed service with detection, response, and recovery loops.',
    improvementMove: 'Create MDR lane with detection sources, MITRE mapping, threat hunting queue, incident runbooks, and signed remediation proof.',
    commercialImpact: 'Turn security from a release gate into recurring managed revenue.',
  },
  {
    id: 'siam-vendor-governance',
    title: 'SIAM and vendor orchestration',
    marketBar: 'Service integration, vendor governance, operational accountability, CAB control, SLA credits, and multi-sourcing visibility.',
    competitorLeaders: ['TCS', 'Capgemini', 'Deloitte'],
    requiredTowerCategories: ['service-integration', 'cloud-ops', 'devops', 'finops'],
    targetScore: 94,
    gap: 'AXON has internal towers, but not a strong SIAM layer for suppliers, contracts, OLAs, and customer governance.',
    improvementMove: 'Add SIAM control plane: vendor registry, OLA/SLA matrix, responsibility model, escalation policy, and monthly value review.',
    commercialImpact: 'Make AXON credible for enterprises with multi-vendor estates.',
  },
  {
    id: 'zero-ops-ai-runbooks',
    title: 'AI Zero-Ops and self-healing runbooks',
    marketBar: 'Predictive operations, self-healing, automated runbooks, change risk scoring, and service restoration proof.',
    competitorLeaders: ['TCS ignio / Zero Ops', 'Infosys Topaz', 'HCLTech AI Force'],
    requiredTowerCategories: ['application-support', 'devops', 'data-ai', 'quality-engineering'],
    targetScore: 96,
    gap: 'AXON can create plans and tickets, but needs closed-loop self-healing tied to SLO burn, rollback, and customer communications.',
    improvementMove: 'Ship Zero-Ops runbook engine: detect, classify, repair, verify, rollback if needed, and publish customer-facing RCA.',
    commercialImpact: 'Beats labor-heavy support by selling faster restoration and lower ticket volume.',
  },
  {
    id: 'enterprise-apps-erp',
    title: 'Enterprise apps, ERP, and SaaS operations',
    marketBar: 'SAP, Oracle, Salesforce, ServiceNow, Workday, integration, release, access, and process-support operations.',
    competitorLeaders: ['TCS', 'Accenture', 'Infosys', 'Cognizant'],
    requiredTowerCategories: ['enterprise-apps', 'database-ops', 'devops', 'business-process-ops'],
    targetScore: 92,
    gap: 'AXON is strong in custom software but thin on packaged enterprise applications that dominate large IT budgets.',
    improvementMove: 'Add enterprise-app tower with connector health, release calendar, access review, data reconciliation, and process KPIs.',
    commercialImpact: 'Expands from app-build teams into CIO/COO transformation budgets.',
  },
  {
    id: 'workplace-network-ops',
    title: 'Workplace, endpoint, and network operations',
    marketBar: 'End-user computing, IAM requests, endpoint health, network reliability, SD-WAN, collaboration tooling, and service desk integration.',
    competitorLeaders: ['TCS', 'HCLTech', 'Wipro', 'Capgemini'],
    requiredTowerCategories: ['workplace-ops', 'network-ops', 'security-ops', 'service-integration'],
    targetScore: 91,
    gap: 'AXON supports software delivery, but lacks workplace and network operations that are central to managed IT contracts.',
    improvementMove: 'Add workplace/network tower with device, identity, access, network monitor, knowledge article, and service desk automation.',
    commercialImpact: 'Lets AXON sell complete IT operations, not only application operations.',
  },
  {
    id: 'ot-iot-edge-ops',
    title: 'OT, IoT, and edge operations',
    marketBar: 'Industrial operations, IoT monitoring, asset safety, segmentation, incident response, and uptime assurance.',
    competitorLeaders: ['TCS', 'HCLTech', 'Wipro'],
    requiredTowerCategories: ['ot-iot-ops', 'network-ops', 'security-ops', 'cloud-ops'],
    targetScore: 90,
    gap: 'Manufacturing, logistics, energy, and utilities need OT/IoT service assurance beyond normal application support.',
    improvementMove: 'Add OT/IoT tower with critical asset inventory, segmentation checks, telemetry ingestion, and safety-aware incident workflows.',
    commercialImpact: 'Opens high-value industrial and infrastructure accounts.',
  },
  {
    id: 'business-process-ops',
    title: 'Business process operations and outcome SLAs',
    marketBar: 'Claims, finance ops, procurement, support, revenue operations, process mining, SLA, and business KPI ownership.',
    competitorLeaders: ['Accenture', 'Infosys', 'TCS', 'Cognizant'],
    requiredTowerCategories: ['business-process-ops', 'application-support', 'data-ai', 'finops'],
    targetScore: 93,
    gap: 'AXON is technology-led; giants win by owning business operations and value metrics, not just systems.',
    improvementMove: 'Create process-ops lane with workflow mining, exception queues, automation candidates, and outcome-based reporting.',
    commercialImpact: 'Moves AXON from tool/vendor spend into business outcome budgets.',
  },
  {
    id: 'value-contracting',
    title: 'Value contracting and board-ready proof',
    marketBar: 'Commercial model, SLA credits, value realization, automation savings, quarterly business reviews, and board metrics.',
    competitorLeaders: ['Accenture', 'TCS', 'Capgemini', 'Deloitte'],
    requiredTowerCategories: ['finops', 'service-integration', 'business-process-ops'],
    targetScore: 95,
    gap: 'AXON tracks cost and evidence, but needs contract-grade value realization and renewal packs.',
    improvementMove: 'Add commercial value ledger: baseline, committed SLA, automation deflection, savings realized, risk retired, renewal next actions.',
    commercialImpact: 'Makes AXON easier to buy as an outcome partner instead of another software dashboard.',
  },
];

const towerCatalog: Record<ManagedServiceTowerCategory, Omit<ManagedServiceTower, 'id' | 'coverage' | 'criticality' | 'sla'>> = {
  'cloud-ops': {
    name: 'Cloud Operations',
    category: 'cloud-ops',
    agents: ['SREAgent', 'CloudOpsAgent', 'FinOpsAgent', 'SecurityAgent'],
    services: ['provisioning', 'configuration lifecycle', 'monitoring', 'backup and restore', 'patching', 'disaster recovery'],
    runbooks: ['cloud health check', 'capacity event response', 'backup restore drill', 'DR failover rehearsal'],
    automations: ['tag drift repair', 'cost anomaly detection', 'self-healing restart', 'backup verification'],
    kpis: ['availability', 'MTTR', 'backup success rate', 'cloud spend variance'],
    evidence: ['monitoring snapshot', 'change record', 'backup proof', 'cost showback'],
  },
  'application-support': {
    name: 'Application Support and Maintenance',
    category: 'application-support',
    agents: ['EngineeringAgent', 'SREAgent', 'DocumentationAgent', 'QAAgent'],
    services: ['L2/L3 support', 'defect triage', 'minor enhancements', 'release readiness', 'knowledge articles'],
    runbooks: ['incident reproduction', 'release regression', 'hotfix validation', 'known-error update'],
    automations: ['duplicate ticket clustering', 'log summarization', 'test impact selection', 'release note drafting'],
    kpis: ['ticket aging', 'defect escape rate', 'change success rate', 'knowledge reuse'],
    evidence: ['test logs', 'root cause summary', 'release notes', 'customer update'],
  },
  'database-ops': {
    name: 'Database and Data Reliability',
    category: 'database-ops',
    agents: ['DatabaseArchitectAgent', 'MigrationSafetyAgent', 'DataQualityAgent', 'SREAgent'],
    services: ['schema governance', 'migration safety', 'performance review', 'backup policy', 'data quality gates'],
    runbooks: ['expand-contract migration', 'slow query response', 'point-in-time recovery', 'data reconciliation'],
    automations: ['unsafe SQL blocker', 'row-count checks', 'checksum validation', 'index recommendation'],
    kpis: ['migration success rate', 'query latency', 'restore time', 'data quality score'],
    evidence: ['database safety report', 'rollback plan', 'quality gate output', 'restore proof'],
  },
  'security-ops': {
    name: 'Security Operations and Compliance',
    category: 'security-ops',
    agents: ['SecurityAgent', 'ComplianceAgent', 'AuditAgent', 'PolicyAgent'],
    services: ['secret scanning', 'vulnerability triage', 'policy compliance', 'access review', 'audit evidence'],
    runbooks: ['credential exposure response', 'critical CVE handling', 'access certification', 'security exception review'],
    automations: ['secret redaction', 'dependency risk scoring', 'least-privilege recommendation', 'evidence packaging'],
    kpis: ['critical exposure age', 'policy pass rate', 'access review closure', 'audit evidence completeness'],
    evidence: ['security scan', 'approval record', 'access review', 'remediation proof'],
  },
  devops: {
    name: 'DevOps and Release Engineering',
    category: 'devops',
    agents: ['ReleaseAgent', 'QAAgent', 'SREAgent', 'ToolRuntimeAgent'],
    services: ['CI/CD operations', 'environment management', 'deployment gates', 'rollback readiness', 'tool execution'],
    runbooks: ['failed deployment response', 'environment drift repair', 'rollback execution', 'release freeze exception'],
    automations: ['pipeline policy checks', 'preview environment creation', 'rollback preview', 'release evidence capture'],
    kpis: ['deployment frequency', 'lead time', 'rollback rate', 'pipeline pass rate'],
    evidence: ['build logs', 'deployment record', 'smoke test', 'rollback checkpoint'],
  },
  'data-ai': {
    name: 'Data and AI Platform Operations',
    category: 'data-ai',
    agents: ['DataQualityAgent', 'ModelRouterAgent', 'EvaluationAgent', 'CostAgent'],
    services: ['model routing', 'RAG quality', 'evaluation regression', 'cost control', 'data pipeline monitoring'],
    runbooks: ['model degradation response', 'RAG freshness check', 'evaluation failure response', 'cost spike review'],
    automations: ['prompt regression tests', 'retrieval quality scoring', 'provider fallback', 'token budget enforcement'],
    kpis: ['answer quality', 'evaluation pass rate', 'cost per task', 'provider availability'],
    evidence: ['evaluation report', 'model route decision', 'retrieval trace', 'cost summary'],
  },
  'quality-engineering': {
    name: 'Quality Engineering',
    category: 'quality-engineering',
    agents: ['QAAgent', 'EvaluationAgent', 'SecurityAgent', 'AccessibilityAgent'],
    services: ['test strategy', 'E2E testing', 'accessibility checks', 'performance budgets', 'AI output validation'],
    runbooks: ['release test plan', 'flaky test triage', 'accessibility regression', 'load test review'],
    automations: ['test generation', 'visual smoke checks', 'quality gate summaries', 'prompt regression runs'],
    kpis: ['coverage', 'E2E pass rate', 'accessibility defects', 'performance budget pass rate'],
    evidence: ['test report', 'browser screenshot', 'accessibility notes', 'performance result'],
  },
  finops: {
    name: 'FinOps and Service Financial Management',
    category: 'finops',
    agents: ['FinOpsAgent', 'CostAgent', 'ExecutiveInsightAgent'],
    services: ['cost showback', 'budget alerts', 'resource rightsizing', 'model cost optimization', 'unit economics'],
    runbooks: ['monthly cost review', 'spend anomaly response', 'budget exception', 'capacity forecast'],
    automations: ['idle resource detection', 'model cost routing', 'budget guardrails', 'showback report generation'],
    kpis: ['monthly run cost', 'savings realized', 'budget variance', 'cost per workflow'],
    evidence: ['cost dashboard', 'optimization record', 'approval record', 'forecast'],
  },
  'service-integration': {
    name: 'SIAM and Vendor Governance',
    category: 'service-integration',
    agents: ['ServiceIntegrationAgent', 'PMOAgent', 'VendorManagerAgent', 'ExecutiveInsightAgent'],
    services: ['service integration', 'vendor governance', 'OLA/SLA matrix', 'CAB operations', 'service reporting', 'escalation ownership'],
    runbooks: ['vendor escalation', 'SLA breach review', 'major incident bridge', 'CAB exception', 'monthly value review'],
    automations: ['vendor ticket correlation', 'SLA credit calculation', 'RACI drift detection', 'executive pack generation'],
    kpis: ['SLA attainment', 'vendor aging', 'OLA breach rate', 'escalation time', 'QBR value accepted'],
    evidence: ['service review pack', 'vendor RACI', 'CAB decision', 'SLA credit record'],
  },
  'sovereign-cloud': {
    name: 'Sovereign Cloud Assurance',
    category: 'sovereign-cloud',
    agents: ['SovereigntyAgent', 'CloudOpsAgent', 'ComplianceAgent', 'SecurityAgent'],
    services: ['workload sovereignty classification', 'regional control mapping', 'data residency', 'metadata isolation', 'exit planning', 'sovereign AI controls'],
    runbooks: ['DORA/NIS2 evidence review', 'regional failover review', 'data residency exception', 'exit-plan rehearsal'],
    automations: ['control matrix generation', 'residency drift alert', 'lawful access risk flagging', 'sovereign evidence export'],
    kpis: ['sovereign workload coverage', 'control drift', 'residency exceptions', 'exit-plan readiness'],
    evidence: ['sovereignty matrix', 'data residency proof', 'regional operations record', 'exit-plan artifact'],
  },
  'network-ops': {
    name: 'Network and Connectivity Operations',
    category: 'network-ops',
    agents: ['NetworkOpsAgent', 'SREAgent', 'SecurityAgent'],
    services: ['WAN/LAN monitoring', 'SD-WAN operations', 'DNS/TLS health', 'firewall change review', 'capacity planning', 'network incident response'],
    runbooks: ['packet loss response', 'DNS outage response', 'firewall exception review', 'certificate expiry remediation'],
    automations: ['certificate renewal ticket', 'latency anomaly triage', 'network dependency map', 'firewall rule risk scoring'],
    kpis: ['network availability', 'packet loss', 'latency', 'change failure rate', 'certificate expiry risk'],
    evidence: ['network health snapshot', 'firewall approval', 'certificate proof', 'dependency map'],
  },
  'workplace-ops': {
    name: 'Workplace and End-User Computing',
    category: 'workplace-ops',
    agents: ['WorkplaceOpsAgent', 'IdentityAgent', 'ServiceDeskAgent', 'SecurityAgent'],
    services: ['device health', 'identity requests', 'collaboration tools', 'endpoint patching', 'knowledge articles', 'access fulfillment'],
    runbooks: ['employee onboarding', 'access request', 'endpoint compromise', 'collaboration outage', 'device patch exception'],
    automations: ['access request triage', 'device compliance check', 'knowledge article draft', 'license cleanup'],
    kpis: ['first-contact resolution', 'device compliance', 'access fulfillment time', 'knowledge deflection'],
    evidence: ['access approval', 'endpoint compliance record', 'knowledge article', 'request fulfillment log'],
  },
  'enterprise-apps': {
    name: 'Enterprise Apps and ERP Operations',
    category: 'enterprise-apps',
    agents: ['EnterpriseAppsAgent', 'IntegrationAgent', 'DatabaseArchitectAgent', 'QAAgent'],
    services: ['SAP/Oracle/Salesforce/ServiceNow operations', 'release calendar', 'integration health', 'access review', 'data reconciliation', 'business process support'],
    runbooks: ['ERP release cutover', 'integration failure response', 'master data reconciliation', 'access recertification'],
    automations: ['integration drift alert', 'ERP change impact summary', 'reconciliation checks', 'release calendar generation'],
    kpis: ['integration uptime', 'batch success rate', 'ERP defect aging', 'access review closure'],
    evidence: ['release calendar', 'integration health report', 'reconciliation proof', 'access review'],
  },
  'ot-iot-ops': {
    name: 'OT, IoT, and Edge Operations',
    category: 'ot-iot-ops',
    agents: ['EdgeOpsAgent', 'SecurityAgent', 'NetworkOpsAgent', 'SREAgent'],
    services: ['industrial asset inventory', 'IoT telemetry monitoring', 'edge health', 'segmentation review', 'safety-aware incident workflows'],
    runbooks: ['edge device outage', 'telemetry gap response', 'OT segmentation exception', 'industrial incident bridge'],
    automations: ['asset anomaly triage', 'segmentation drift alert', 'telemetry freshness check', 'safe-mode escalation'],
    kpis: ['edge uptime', 'telemetry freshness', 'segmentation compliance', 'critical asset incident rate'],
    evidence: ['OT asset inventory', 'telemetry report', 'segmentation proof', 'incident bridge record'],
  },
  'business-process-ops': {
    name: 'Business Process Operations',
    category: 'business-process-ops',
    agents: ['ProcessOpsAgent', 'DataQualityAgent', 'AutomationAgent', 'CustomerSuccessAgent'],
    services: ['process mining', 'exception queue ownership', 'claims/finance/procurement ops', 'automation discovery', 'outcome SLA reporting'],
    runbooks: ['process exception triage', 'manual queue spike', 'automation candidate review', 'business SLA breach'],
    automations: ['exception clustering', 'process bottleneck detection', 'automation ROI estimate', 'business KPI report'],
    kpis: ['process cycle time', 'exception rate', 'automation deflection', 'business SLA attainment'],
    evidence: ['process map', 'exception queue report', 'automation business case', 'outcome SLA pack'],
  },
};

export class ManagedServicesService {
  listCatalog() {
    return Object.values(towerCatalog);
  }

  listAccounts() {
    return Array.from(accounts.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  createAccount(input: ManagedServiceInput): ManagedServiceAccount {
    const appCount = clamp(input.appCount ?? inferAppCount(input.objective), 1, 500);
    const users = clamp(input.users ?? inferUsers(input.objective), 1, 100000);
    const coverage = input.coverage ?? inferCoverage(input.objective, appCount, users);
    const compliance = input.compliance ?? inferCompliance(input.objective);
    const categories = selectTowers(input.objective, compliance, input.cloudProviders ?? [], appCount);
    const criticality = inferCriticality(input.objective, users, compliance);
    const serviceTowers = categories.map((category) => buildTower(category, coverage, criticality));
    const account: ManagedServiceAccount = {
      id: `ms_${nanoid(10)}`,
      tenantId: input.tenantId ?? 'tenant_default',
      customerName: input.customerName?.trim() || 'Customer',
      industry: input.industry?.trim() || inferIndustry(input.objective),
      objective: input.objective,
      maturity: inferMaturity(input.objective, input.painPoints ?? []),
      coverage,
      serviceTowers,
      cmdbSeed: buildCmdbSeed(input, serviceTowers, criticality),
      deliveryPods: buildDeliveryPods(serviceTowers),
      transitionPlan: buildTransitionPlan(serviceTowers.length, criticality),
      aiOperatingModel: {
        llmRouting: ['Use provider routing by task criticality, data sensitivity, latency, and budget.', 'Prefer sovereign/local models for restricted customer data.', 'Fail over across configured OpenAI, Anthropic, Bedrock, Vertex, Ollama, or local providers.'],
        memory: ['Store customer preferences, runbook history, known errors, and architecture decisions as scoped long-term memory.', 'Separate tenant memories and require evidence links for operational decisions.'],
        guardrails: ['Block destructive tools without approval.', 'Run security and database gates before production action.', 'Redact secrets and PII in prompts, logs, and evidence.'],
        escalationPolicy: ['P1/P0 incidents page SRE, service owner, and executive sponsor.', 'Security and database work requires owner approval.', 'Low-confidence AI decisions become human review tasks.'],
      },
      governance: buildGovernance(compliance),
      financials: buildFinancials(appCount, users, serviceTowers.length, coverage, criticality),
      risks: buildRisks(input, serviceTowers.length, compliance),
      createdAt: new Date().toISOString(),
    };

    accounts.set(account.id, account);
    return account;
  }

  getAccount(id: string) {
    return accounts.get(id);
  }

  getITGiantReadiness(input: { accountId?: string } = {}): ITGiantReadinessReport {
    const account = input.accountId ? accounts.get(input.accountId) : undefined;
    const capabilities = buildReadinessCapabilities(account);
    const score = Math.round(capabilities.reduce((sum, capability) => sum + capability.score, 0) / Math.max(capabilities.length, 1));
    const serviceGaps = capabilities
      .filter((capability) => capability.score < capability.targetScore)
      .sort((a, b) => (b.targetScore - b.score) - (a.targetScore - a.score))
      .map((capability) => {
        const gap = capability.targetScore - capability.score;
        return {
          id: `gap_${capability.id}`,
          severity: gap >= 25 ? 'critical' as const : gap >= 14 ? 'high' as const : 'medium' as const,
          title: capability.gap,
          whyItMatters: capability.marketBar,
          fix: capability.improvementMove,
          ownerTower: capability.requiredTowerCategories[0],
        };
      });

    return {
      id: `itgiant_${account?.id ?? 'platform'}_${new Date().toISOString().slice(0, 10)}`,
      generatedAt: new Date().toISOString(),
      accountId: account?.id,
      customerName: account?.customerName,
      status: readinessStatus(score),
      score,
      thesis: account
        ? `${account.customerName} is strongest where AXON already has towers, agents, and evidence. To beat TCS/Accenture-style operators, it must close the remaining service-line gaps and package them as outcome-backed managed service lanes.`
        : 'AXON is ahead of traditional IT service firms in software-native autonomy and signed proof, but it must broaden service coverage into SIAM, sovereign cloud, workplace/network, enterprise apps, OT/IoT, and business-process operations to credibly challenge global IT giants.',
      competitors: giantBenchmarks,
      capabilities,
      serviceGaps,
      offerLanes: buildOfferLanes(capabilities),
      topMoves: capabilities
        .filter((capability) => capability.score < capability.targetScore)
        .sort((a, b) => (b.targetScore - b.score) - (a.targetScore - a.score))
        .slice(0, 6)
        .map((capability, index) => ({
          order: index + 1,
          capabilityId: capability.id,
          move: capability.improvementMove,
          expectedLift: capability.targetScore - capability.score,
        })),
      sourceNotes: [
        'TCS emphasizes sovereign cloud, AI-led operations, MDR, SIAM, and global managed-service delivery.',
        'Accenture emphasizes secure agentic AI, cybersecurity modernization, cloud/data partnerships, and board-level transformation.',
        'Infosys Topaz positions AI-first transformation, operations services, quality engineering, cybersecurity, and composable agent fabric.',
        'Wipro and Cognizant emphasize cyber-resilience, managed security, and secure agentic AI operations.',
        'HCLTech and Capgemini emphasize enterprise-grade agentic platforms, sovereign cloud, cybersecurity, and managed hybrid cloud operations.',
      ],
    };
  }

  listTransformationRuns(): ManagedServiceTransformationRun[] {
    return transformationStore.read().sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }

  async createTransformationRun(input: { accountId?: string; maxMissions?: number; tactic?: string; tenantId?: string } = {}): Promise<ManagedServiceTransformationRun> {
    const account = input.accountId ? accounts.get(input.accountId) : undefined;
    const report = this.getITGiantReadiness({ accountId: account?.id });
    const maxMissions = clamp(input.maxMissions ?? 3, 1, 6);
    const targets = report.capabilities
      .filter((capability) => capability.score < capability.targetScore)
      .sort((a, b) => (b.targetScore - b.score) - (a.targetScore - a.score))
      .slice(0, maxMissions);

    const missionControlRuns: ManagedServiceTransformationRun['missionControlRuns'] = [];
    for (const capability of targets) {
      const run = await missionControl.createRun({
        tenantId: input.tenantId ?? account?.tenantId ?? 'tenant_default',
        customerName: account?.customerName ?? 'AXON Managed Services',
        mission: `${capability.improvementMove}\n\nMarket bar: ${capability.marketBar}\nCurrent AXON proof: ${capability.axonProof.join('; ')}\nCommercial impact: ${capability.commercialImpact}`,
        environment: capability.targetScore >= 95 ? 'staging' : 'preview',
        regulated: true,
        budgetUsd: 9000,
        timelineDays: 30,
        compliance: ['SOC 2', 'ISO 27001', 'DORA', 'NIS2', 'GDPR'],
        integrations: ['ServiceNow', 'Jira Service Management', 'Datadog', 'PagerDuty', 'GitHub', 'Cloud provider'],
      });
      missionControlRuns.push({
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

    const stageGates = buildTransformationStageGates(targets, missionControlRuns);
    const riskRegister = buildTransformationRisks(targets);
    const completedGates = stageGates.filter((gate) => gate.status === 'pass').length;
    const progress = {
      completedGates,
      totalGates: stageGates.length,
      score: Math.round(stageGates.reduce((sum, gate) => sum + gate.score, 0) / Math.max(stageGates.length, 1)),
    };
    const commercialPack = buildCommercialPack(report, targets);
    const tactic = input.tactic?.trim() || 'Close IT-giant service-line gaps by turning missing service capabilities into mission-backed managed-service offers.';
    const artifact = artifactService.put({
      tenantId: input.tenantId ?? account?.tenantId ?? 'tenant_default',
      kind: 'release-pack',
      name: `IT giant service transformation ${report.id}`,
      content: {
        reportId: report.id,
        accountId: account?.id,
        tactic,
        benchmarkScore: report.score,
        competitors: report.competitors.map((competitor) => ({
          id: competitor.id,
          name: competitor.name,
          sourceUrl: competitor.sourceUrl,
          axonCounter: competitor.axonCounter,
        })),
        capabilities: targets.map((capability) => ({
          id: capability.id,
          title: capability.title,
          score: capability.score,
          targetScore: capability.targetScore,
          improvementMove: capability.improvementMove,
          commercialImpact: capability.commercialImpact,
        })),
        missionControlRuns,
        stageGates,
        riskRegister,
        commercialPack,
      },
      metadata: {
        accountId: account?.id,
        reportId: report.id,
        capabilityIds: targets.map((capability) => capability.id),
      },
    });
    const trustRecord = trustLedger.append({
      tenantId: input.tenantId ?? account?.tenantId ?? 'tenant_default',
      kind: 'customer-handoff',
      actor: 'ManagedServiceStrategistAgent',
      actorType: 'agent',
      subject: `IT giant service transformation ${report.id}`,
      summary: `Created ${missionControlRuns.length} managed-service transformation missions with ${stageGates.length} gates and ${riskRegister.length} risks.`,
      risk: targets.some((capability) => capability.targetScore >= 95) ? 'high' : 'medium',
      source: 'Managed Services IT giant readiness benchmark',
      artifacts: [artifact.id, ...missionControlRuns.flatMap((run) => [run.missionControlRunId, run.releaseMissionId])],
      metadata: {
        accountId: account?.id,
        reportId: report.id,
        benchmarkScore: report.score,
        transformationCapabilities: targets.map((capability) => capability.id),
      },
      controls: ['SOC2-CC7.2', 'SOC2-CC8.1', 'ISO27001-A.5.15', 'ISO27001-A.8.15'],
    });

    const transformation: ManagedServiceTransformationRun = {
      id: `mst_${nanoid(10)}`,
      reportId: report.id,
      accountId: account?.id,
      generatedAt: new Date().toISOString(),
      status: 'created',
      tactic,
      summary: `Created ${missionControlRuns.length} transformation mission${missionControlRuns.length === 1 ? '' : 's'} to close AXON's biggest IT-giant service gaps.`,
      progress,
      missionControlRuns,
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
      commercialPack,
      nextReviewAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    };

    transformationStore.write([transformation, ...transformationStore.read()].slice(0, 100));
    return transformation;
  }
}

function buildReadinessCapabilities(account?: ManagedServiceAccount): ManagedServiceCapabilityBenchmark[] {
  const towerCategories = new Set<ManagedServiceTowerCategory>(account?.serviceTowers.map((tower) => tower.category) ?? Object.keys(towerCatalog) as ManagedServiceTowerCategory[]);
  return capabilityBenchmarks.map((capability) => {
    const covered = capability.requiredTowerCategories.filter((category) => towerCategories.has(category)).length;
    const coverageRatio = covered / Math.max(capability.requiredTowerCategories.length, 1);
    const accountBoost = account ? Math.round(coverageRatio * 45) : Math.round(coverageRatio * 30);
    const evidenceBoost = account ? Math.min(10, account.serviceTowers.length) : 5;
    const score = clamp(42 + accountBoost + evidenceBoost, 35, capability.targetScore - 1);
    const proof = account
      ? account.serviceTowers
        .filter((tower) => capability.requiredTowerCategories.includes(tower.category))
        .flatMap((tower) => [tower.name, ...tower.evidence.slice(0, 2)])
      : capability.requiredTowerCategories
        .filter((category) => towerCategories.has(category))
        .map((category) => towerCatalog[category].name);
    return {
      ...capability,
      score,
      axonProof: proof.length ? Array.from(new Set(proof)).slice(0, 8) : ['Capability not yet represented as an AXON service tower.'],
    };
  }).sort((a, b) => (b.targetScore - b.score) - (a.targetScore - a.score));
}

function readinessStatus(score: number): ITGiantReadinessReport['status'] {
  if (score >= 92) return 'beyond-giants';
  if (score >= 84) return 'giant-grade';
  if (score >= 72) return 'credible-challenger';
  return 'behind-giants';
}

function buildOfferLanes(capabilities: ManagedServiceCapabilityBenchmark[]): ManagedServiceOfferLane[] {
  const scoreFor = (ids: string[]) => {
    const selected = capabilities.filter((capability) => ids.includes(capability.id));
    return Math.round(selected.reduce((sum, capability) => sum + capability.score, 0) / Math.max(selected.length, 1));
  };
  return [
    {
      id: 'regulated-ai-ops',
      title: 'Regulated AI Ops Managed Service',
      buyer: 'CIO, CISO, Chief Data Officer',
      winCondition: 'Operate AI, cloud, security, and compliance with signed evidence and region-aware controls.',
      requiredCapabilities: ['sovereign-cloud-assurance', 'managed-cyber-resilience', 'value-contracting'],
      proofRequired: ['sovereignty matrix', 'MDR runbook', 'Trust Ledger export', 'monthly risk-retired metric'],
      pricingModel: 'hybrid',
      score: scoreFor(['sovereign-cloud-assurance', 'managed-cyber-resilience', 'value-contracting']),
    },
    {
      id: 'zero-ops-application-factory',
      title: 'Zero-Ops Application Factory',
      buyer: 'CIO, VP Engineering, Head of Applications',
      winCondition: 'Reduce incident volume and change risk with AI-runbook restoration, release gates, and application support pods.',
      requiredCapabilities: ['zero-ops-ai-runbooks', 'enterprise-apps-erp', 'siam-vendor-governance'],
      proofRequired: ['incident deflection report', 'release gate evidence', 'SLA trend', 'automation ROI'],
      pricingModel: 'outcome-based',
      score: scoreFor(['zero-ops-ai-runbooks', 'enterprise-apps-erp', 'siam-vendor-governance']),
    },
    {
      id: 'complete-it-operations',
      title: 'Complete IT Operations Challenger Pack',
      buyer: 'CIO, COO, Managed Services Procurement',
      winCondition: 'Bundle apps, cloud, network, workplace, security, business process, and SIAM into one accountable operating model.',
      requiredCapabilities: ['workplace-network-ops', 'business-process-ops', 'managed-cyber-resilience', 'siam-vendor-governance'],
      proofRequired: ['CMDB seed', 'RACI matrix', 'service desk automation', 'QBR value report'],
      pricingModel: 'retainer',
      score: scoreFor(['workplace-network-ops', 'business-process-ops', 'managed-cyber-resilience', 'siam-vendor-governance']),
    },
  ];
}

function buildTransformationStageGates(
  capabilities: ManagedServiceCapabilityBenchmark[],
  missionRuns: ManagedServiceTransformationRun['missionControlRuns'],
): ManagedServiceTransformationRun['stageGates'] {
  return capabilities.flatMap((capability) => {
    const mission = missionRuns.find((run) => run.capabilityId === capability.id);
    const gap = capability.targetScore - capability.score;
    return [
      {
        id: `${capability.id}:service-line`,
        title: `${capability.title} service line packaged`,
        ownerAgent: 'ManagedServiceStrategistAgent',
        status: gap <= 12 ? 'warn' as const : 'block' as const,
        score: Math.max(45, 100 - gap * 2),
        evidence: [capability.marketBar, capability.commercialImpact],
        nextAction: capability.improvementMove,
      },
      {
        id: `${capability.id}:mission`,
        title: `${capability.title} implementation mission created`,
        ownerAgent: 'MissionControlAgent',
        status: mission ? 'pass' as const : 'block' as const,
        score: mission ? Math.max(75, mission.score) : 0,
        evidence: mission?.proof ?? ['Mission Control run missing'],
        nextAction: mission ? `Drive ${mission.missionControlRunId} until customer-ready evidence is attached.` : 'Create implementation mission.',
      },
      {
        id: `${capability.id}:commercial-proof`,
        title: `${capability.title} commercial proof ready`,
        ownerAgent: 'CustomerSuccessAgent',
        status: capability.score >= 80 ? 'pass' as const : 'warn' as const,
        score: Math.max(55, capability.score),
        evidence: capability.axonProof,
        nextAction: 'Attach baseline, target SLA, price model, value metric, and renewal proof to the offer lane.',
      },
    ];
  });
}

function buildTransformationRisks(capabilities: ManagedServiceCapabilityBenchmark[]): ManagedServiceTransformationRun['riskRegister'] {
  return capabilities.map((capability) => {
    const gap = capability.targetScore - capability.score;
    return {
      id: `risk_${capability.id}`,
      severity: gap >= 25 ? 'critical' as const : gap >= 14 ? 'high' as const : 'medium' as const,
      title: `${capability.title} gap can keep AXON below IT-giant buyer expectations.`,
      mitigation: capability.improvementMove,
      ownerAgent: ownerForTower(capability.requiredTowerCategories[0]),
    };
  });
}

function buildCommercialPack(
  report: ITGiantReadinessReport,
  capabilities: ManagedServiceCapabilityBenchmark[],
): ManagedServiceTransformationRun['commercialPack'] {
  const lane = report.offerLanes
    .slice()
    .sort((a, b) => {
      const aOverlap = a.requiredCapabilities.filter((id) => capabilities.some((capability) => capability.id === id)).length;
      const bOverlap = b.requiredCapabilities.filter((id) => capabilities.some((capability) => capability.id === id)).length;
      return bOverlap - aOverlap || a.score - b.score;
    })[0];
  return {
    offerName: lane?.title ?? 'IT Giant Challenger Managed Service',
    buyerPromise: lane?.winCondition ?? 'Deliver managed IT outcomes with autonomous execution, signed proof, and board-ready value reporting.',
    pricingModel: lane?.pricingModel ?? 'hybrid',
    boardMetrics: ['SLA attainment', 'MTTR reduction', 'automation deflection', 'risk retired', 'cost-to-serve', 'renewal value'],
    first90Days: [
      'Baseline service inventory, RACI, CMDB seed, and account risk register.',
      'Activate highest-gap service towers with Mission Control implementation runs.',
      'Publish signed evidence pack and monthly value report for buyer review.',
    ],
  };
}

function ownerForTower(category: ManagedServiceTowerCategory) {
  const owners: Record<ManagedServiceTowerCategory, string> = {
    'cloud-ops': 'CloudOpsAgent',
    'application-support': 'EngineeringAgent',
    'database-ops': 'DatabaseArchitectAgent',
    'security-ops': 'SecurityAgent',
    devops: 'ReleaseAgent',
    'data-ai': 'ModelRouterAgent',
    'quality-engineering': 'QAAgent',
    finops: 'FinOpsAgent',
    'service-integration': 'ServiceIntegrationAgent',
    'sovereign-cloud': 'SovereigntyAgent',
    'network-ops': 'NetworkOpsAgent',
    'workplace-ops': 'WorkplaceOpsAgent',
    'enterprise-apps': 'EnterpriseAppsAgent',
    'ot-iot-ops': 'EdgeOpsAgent',
    'business-process-ops': 'ProcessOpsAgent',
  };
  return owners[category];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function inferAppCount(objective: string) {
  const match = objective.match(/(\d+)\s*(apps|applications|services)/i);
  return match ? Number(match[1]) : 12;
}

function inferUsers(objective: string) {
  const match = objective.match(/(\d+)\s*(users|employees|customers)/i);
  return match ? Number(match[1]) : 1000;
}

function inferCoverage(objective: string, appCount: number, users: number): ManagedServiceCoverage {
  if (/24x7|always on|mission critical|global|production|banking|healthcare/i.test(objective) || appCount > 40 || users > 5000) return '24x7';
  if (/extended|16x5|multi-region|customer/i.test(objective)) return '16x5';
  return '8x5';
}

function inferCompliance(objective: string) {
  const found = ['SOC 2', 'ISO 27001', 'HIPAA', 'PCI DSS', 'GDPR'].filter((item) => objective.toLowerCase().includes(item.toLowerCase()));
  return found.length > 0 ? found : ['SOC 2'];
}

function inferIndustry(objective: string) {
  if (/bank|fintech|payment|insurance/i.test(objective)) return 'Financial services';
  if (/health|clinic|patient|hospital/i.test(objective)) return 'Healthcare';
  if (/retail|commerce|store|shop/i.test(objective)) return 'Retail';
  if (/manufactur|factory|supply/i.test(objective)) return 'Manufacturing';
  return 'Digital business';
}

function inferMaturity(objective: string, painPoints: string[]): ManagedServiceAccount['maturity'] {
  const text = `${objective} ${painPoints.join(' ')}`;
  if (/legacy|manual|handover|takeover|stabilize/i.test(text)) return 'transition';
  if (/outage|unstable|incident|sla breach/i.test(text)) return 'stabilize';
  if (/optimi[sz]e|cost|automation|finops/i.test(text)) return 'optimize';
  return 'transform';
}

function selectTowers(objective: string, compliance: string[], cloudProviders: string[], appCount: number): ManagedServiceTowerCategory[] {
  const text = `${objective} ${compliance.join(' ')} ${cloudProviders.join(' ')}`.toLowerCase();
  const selected = new Set<ManagedServiceTowerCategory>(['application-support', 'devops', 'security-ops', 'service-integration']);
  if (/cloud|aws|azure|gcp|kubernetes|serverless|infra|provision/i.test(text) || cloudProviders.length > 0) selected.add('cloud-ops');
  if (/sovereign|residency|regional|eu|dora|nis2|gdpr|public sector|government|regulated/i.test(text)) selected.add('sovereign-cloud');
  if (/database|postgres|mysql|sql|data|migration|backup|restore/i.test(text)) selected.add('database-ops');
  if (/ai|llm|rag|model|analytics|data pipeline/i.test(text)) selected.add('data-ai');
  if (/test|quality|validation|accessibility|performance/i.test(text) || appCount > 10) selected.add('quality-engineering');
  if (/cost|budget|showback|chargeback|finops|spend/i.test(text) || appCount > 20) selected.add('finops');
  if (/siam|vendor|multi-sourc|supplier|ola|service integration|itil|cab/i.test(text)) selected.add('service-integration');
  if (/network|wan|lan|sd-wan|sdwan|dns|certificate|firewall|connectivity/i.test(text)) selected.add('network-ops');
  if (/workplace|endpoint|device|desktop|laptop|identity|iam|access request|end-user|collaboration/i.test(text)) selected.add('workplace-ops');
  if (/sap|oracle|erp|salesforce|servicenow|workday|enterprise app|crm|hcm/i.test(text)) selected.add('enterprise-apps');
  if (/ot|iot|edge|factory|plant|scada|manufactur|industrial|logistics|utility|sensor/i.test(text)) selected.add('ot-iot-ops');
  if (/bpo|business process|claims|procurement|finance ops|back office|contact center|order management|process mining/i.test(text)) selected.add('business-process-ops');
  return Array.from(selected);
}

function inferCriticality(objective: string, users: number, compliance: string[]): ManagedServiceCriticality {
  if (/mission critical|banking|payment|health|production outage/i.test(objective) || users >= 10000 || compliance.includes('PCI DSS') || compliance.includes('HIPAA')) return 'mission-critical';
  if (/production|customer|revenue|regulated/i.test(objective) || users >= 1000) return 'high';
  if (users >= 100) return 'medium';
  return 'low';
}

function buildTower(category: ManagedServiceTowerCategory, coverage: ManagedServiceCoverage, criticality: ManagedServiceCriticality): ManagedServiceTower {
  const template = towerCatalog[category];
  return {
    id: `tower_${category}`,
    ...template,
    coverage,
    criticality,
    sla: buildSla(coverage, criticality),
  };
}

function buildSla(coverage: ManagedServiceCoverage, criticality: ManagedServiceCriticality): ManagedServiceTower['sla'] {
  const multiplier = coverage === '24x7' ? 1 : coverage === '16x5' ? 1.5 : 2;
  const criticalFactor = criticality === 'mission-critical' ? 0.75 : criticality === 'high' ? 1 : criticality === 'medium' ? 1.5 : 2;
  return {
    p1ResponseMinutes: Math.round(15 * multiplier * criticalFactor),
    p1ResolutionHours: Math.max(2, Math.round(4 * multiplier * criticalFactor)),
    p2ResponseMinutes: Math.round(30 * multiplier * criticalFactor),
    p2ResolutionHours: Math.max(4, Math.round(8 * multiplier * criticalFactor)),
  };
}

function buildCmdbSeed(input: ManagedServiceInput, towers: ManagedServiceTower[], criticality: ManagedServiceCriticality): CmdbAssetSeed[] {
  const providers = input.cloudProviders?.length ? input.cloudProviders : ['workspace cloud'];
  const envs = input.environments?.length ? input.environments : ['dev', 'staging', 'production'];
  const base: CmdbAssetSeed[] = [
    {
      id: 'ci_customer_portfolio',
      name: `${input.customerName ?? 'Customer'} application portfolio`,
      type: 'application',
      ownerAgent: 'ServiceCatalogAgent',
      criticality,
      dependencies: providers,
      monitors: ['availability', 'error rate', 'latency', 'ticket trend'],
      backupPolicy: 'Covered by tower-specific backup and rollback checkpoints',
    },
  ];

  providers.forEach((provider, index) => base.push({
    id: `ci_cloud_${index + 1}`,
    name: provider,
    type: 'cloud-account',
    ownerAgent: 'CloudOpsAgent',
    criticality,
    dependencies: envs,
    monitors: ['cost anomaly', 'policy drift', 'capacity', 'backup status'],
    backupPolicy: 'Infrastructure-as-code state and cloud backup policy review every sprint',
  }));

  if (towers.some((tower) => tower.category === 'database-ops')) {
    base.push({
      id: 'ci_primary_database',
      name: 'Primary operational database',
      type: 'database',
      ownerAgent: 'DatabaseArchitectAgent',
      criticality,
      dependencies: ['application portfolio', 'backup storage', 'migration pipeline'],
      monitors: ['replication lag', 'slow queries', 'lock waits', 'backup success'],
      backupPolicy: 'Point-in-time recovery, pre-migration checkpoint, restore drill evidence',
    });
  }

  if (towers.some((tower) => tower.category === 'data-ai')) {
    base.push({
      id: 'ci_model_gateway',
      name: 'AI model gateway',
      type: 'model-endpoint',
      ownerAgent: 'ModelRouterAgent',
      criticality: criticality === 'low' ? 'medium' : criticality,
      dependencies: ['provider keys', 'evaluation suite', 'tenant memory'],
      monitors: ['provider health', 'latency', 'cost', 'quality regression'],
      backupPolicy: 'Provider fallback and local model contingency',
    });
  }

  if (towers.some((tower) => tower.category === 'service-integration')) {
    base.push({
      id: 'ci_vendor_service_mesh',
      name: 'Vendor and service integration mesh',
      type: 'vendor-service',
      ownerAgent: 'ServiceIntegrationAgent',
      criticality,
      dependencies: ['service desk', 'change advisory board', 'SLA/OLA matrix'],
      monitors: ['vendor ticket aging', 'OLA breach', 'escalation latency', 'service credit exposure'],
      backupPolicy: 'Supplier RACI, escalation contacts, and governance evidence reviewed monthly',
    });
  }

  if (towers.some((tower) => tower.category === 'sovereign-cloud')) {
    base.push({
      id: 'ci_sovereign_control_plane',
      name: 'Sovereign workload control plane',
      type: 'security-control',
      ownerAgent: 'SovereigntyAgent',
      criticality,
      dependencies: providers,
      monitors: ['residency drift', 'regional control coverage', 'metadata isolation', 'exit-plan readiness'],
      backupPolicy: 'Regional evidence export and exit-plan rehearsal every quarter',
    });
  }

  if (towers.some((tower) => tower.category === 'network-ops')) {
    base.push({
      id: 'ci_network_fabric',
      name: 'Enterprise network fabric',
      type: 'network',
      ownerAgent: 'NetworkOpsAgent',
      criticality,
      dependencies: ['DNS', 'TLS certificates', 'firewalls', 'WAN links'],
      monitors: ['latency', 'packet loss', 'certificate expiry', 'firewall drift'],
      backupPolicy: 'Network configuration and certificate inventory checkpointed monthly',
    });
  }

  if (towers.some((tower) => tower.category === 'workplace-ops')) {
    base.push({
      id: 'ci_workplace_estate',
      name: 'Workplace device and identity estate',
      type: 'workplace',
      ownerAgent: 'WorkplaceOpsAgent',
      criticality,
      dependencies: ['identity provider', 'endpoint manager', 'collaboration suite'],
      monitors: ['device compliance', 'access request backlog', 'license utilization', 'endpoint risk'],
      backupPolicy: 'Access review, device compliance export, and critical knowledge articles retained monthly',
    });
  }

  if (towers.some((tower) => tower.category === 'enterprise-apps')) {
    base.push({
      id: 'ci_enterprise_apps',
      name: 'Enterprise application estate',
      type: 'erp-system',
      ownerAgent: 'EnterpriseAppsAgent',
      criticality,
      dependencies: ['identity provider', 'integration platform', 'operational database', 'release calendar'],
      monitors: ['batch success', 'integration uptime', 'access review closure', 'release defects'],
      backupPolicy: 'Release calendar, integration catalog, and master-data reconciliation proof retained each cycle',
    });
  }

  if (towers.some((tower) => tower.category === 'ot-iot-ops')) {
    base.push({
      id: 'ci_ot_iot_edge',
      name: 'OT, IoT, and edge asset estate',
      type: 'ot-system',
      ownerAgent: 'EdgeOpsAgent',
      criticality,
      dependencies: ['network fabric', 'edge gateways', 'telemetry stream', 'segmentation policy'],
      monitors: ['telemetry freshness', 'edge uptime', 'segmentation drift', 'critical asset alarms'],
      backupPolicy: 'Asset inventory, segmentation proof, and safe-mode runbooks retained every service cycle',
    });
  }

  if (towers.some((tower) => tower.category === 'business-process-ops')) {
    base.push({
      id: 'ci_business_process_lane',
      name: 'Business process operating lane',
      type: 'business-process',
      ownerAgent: 'ProcessOpsAgent',
      criticality,
      dependencies: ['case queue', 'automation backlog', 'business KPI dashboard'],
      monitors: ['cycle time', 'exception rate', 'business SLA', 'automation deflection'],
      backupPolicy: 'Process map, exception queue report, and value realization pack retained monthly',
    });
  }

  return base;
}

function buildDeliveryPods(towers: ManagedServiceTower[]) {
  const pods = [
    {
      name: 'Service Delivery Office',
      mission: 'Own SLA, governance, customer communication, prioritization, and evidence completeness.',
      agents: ['PMOAgent', 'ServiceCatalogAgent', 'ExecutiveInsightAgent'],
      ceremonies: ['daily service review', 'weekly SLA review', 'monthly business review'],
    },
    {
      name: 'Engineering and Reliability Pod',
      mission: 'Resolve incidents, deliver changes, maintain runbooks, and automate repeated work.',
      agents: Array.from(new Set(towers.flatMap((tower) => tower.agents))).slice(0, 10),
      ceremonies: ['incident review', 'change advisory', 'automation backlog grooming'],
    },
  ];
  if (towers.some((tower) => ['service-integration', 'sovereign-cloud', 'finops'].includes(tower.category))) {
    pods.push({
      name: 'Commercial and Governance Pod',
      mission: 'Own vendor governance, sovereign assurance, value realization, risk retirement, and QBR-ready proof.',
      agents: ['ServiceIntegrationAgent', 'SovereigntyAgent', 'FinOpsAgent', 'ComplianceAgent'],
      ceremonies: ['weekly vendor review', 'monthly compliance review', 'quarterly business review'],
    });
  }
  if (towers.some((tower) => ['workplace-ops', 'network-ops', 'enterprise-apps', 'ot-iot-ops', 'business-process-ops'].includes(tower.category))) {
    pods.push({
      name: 'Enterprise Operations Pod',
      mission: 'Run workplace, network, enterprise apps, OT/IoT, and process operations as accountable service lanes.',
      agents: ['WorkplaceOpsAgent', 'NetworkOpsAgent', 'EnterpriseAppsAgent', 'EdgeOpsAgent', 'ProcessOpsAgent'],
      ceremonies: ['daily operations bridge', 'major incident review', 'service improvement backlog'],
    });
  }
  return pods;
}

function buildTransitionPlan(towerCount: number, criticality: ManagedServiceCriticality) {
  const critical = criticality === 'mission-critical' || criticality === 'high';
  return [
    {
      phase: 'Discover and assess',
      durationDays: critical ? 10 : 5,
      outcomes: ['application inventory', 'dependency map', 'risk register', 'SLA baseline'],
      exitCriteria: ['CMDB seed approved', 'critical services tagged', 'access model verified'],
    },
    {
      phase: 'Takeover and stabilize',
      durationDays: critical ? 20 : 12,
      outcomes: ['runbooks onboarded', 'monitoring enabled', 'ticket routing live', 'backup proof captured'],
      exitCriteria: ['P1/P2 runbooks tested', 'support rota active', 'rollback checkpoints verified'],
    },
    {
      phase: 'Automate and optimize',
      durationDays: Math.max(15, towerCount * 4),
      outcomes: ['automation backlog', 'self-healing candidates', 'cost showback', 'quality gates'],
      exitCriteria: ['top recurring tickets automated', 'cost anomalies visible', 'governance dashboards live'],
    },
    {
      phase: 'Transform continuously',
      durationDays: 30,
      outcomes: ['modernization roadmap', 'AI assistant workflows', 'service maturity score', 'quarterly value report'],
      exitCriteria: ['business value accepted', 'new improvement epics funded', 'SLA improvement demonstrated'],
    },
  ];
}

function buildGovernance(compliance: string[]) {
  return [
    { forum: 'Daily operations review', cadence: 'daily', decisions: ['P0/P1 health', 'blocked tickets', 'change freeze exceptions'] },
    { forum: 'Change advisory board', cadence: 'twice weekly', decisions: ['production changes', 'database migrations', 'security exceptions'] },
    { forum: 'Monthly business review', cadence: 'monthly', decisions: ['SLA credits', 'cost showback', 'automation ROI', 'roadmap priorities'] },
    { forum: 'Compliance evidence review', cadence: compliance.length ? 'monthly' : 'quarterly', decisions: ['audit readiness', 'access recertification', 'control gaps'] },
    { forum: 'Vendor and value board', cadence: 'monthly', decisions: ['supplier performance', 'OLA breaches', 'risk retired', 'renewal actions'] },
  ];
}

function buildFinancials(appCount: number, users: number, towerCount: number, coverage: ManagedServiceCoverage, criticality: ManagedServiceCriticality) {
  const coverageFactor = coverage === '24x7' ? 1.8 : coverage === '16x5' ? 1.35 : 1;
  const criticalFactor = criticality === 'mission-critical' ? 1.6 : criticality === 'high' ? 1.25 : criticality === 'medium' ? 1 : 0.8;
  const monthly = Math.round((towerCount * 4500 + appCount * 250 + users * 1.2) * coverageFactor * criticalFactor);
  return {
    transitionCostUsd: Math.round(monthly * 1.7),
    monthlyRunCostUsd: monthly,
    projectedAutomationSavingsPercent: clamp(18 + towerCount * 3, 20, 45),
    confidence: 0.78,
  };
}

function buildRisks(input: ManagedServiceInput, towerCount: number, compliance: string[]) {
  const risks: ManagedServiceAccount['risks'] = [
    {
      level: 'high',
      description: 'Unknown dependencies can break SLA commitments during takeover.',
      mitigation: 'Require CMDB discovery, dependency mapping, and checkpoint-backed runbooks before steady state.',
    },
    {
      level: 'medium',
      description: 'Manual operating habits can slow automation adoption.',
      mitigation: 'Create an automation backlog from recurring tickets and track monthly deflection.',
    },
  ];

  if (compliance.length > 0) {
    risks.push({
      level: 'high',
      description: `Compliance scope (${compliance.join(', ')}) requires durable evidence and least-privilege controls.`,
      mitigation: 'Bind every change, incident, and access action to audit evidence and approval records.',
    });
  }

  if ((input.appCount ?? 0) > 50 || towerCount > 6) {
    risks.push({
      level: 'critical',
      description: 'Large portfolio scope can overload transition if everything moves at once.',
      mitigation: 'Wave the transition by service criticality and stabilize mission-critical systems first.',
    });
  }

  return risks;
}

export const managedServices = new ManagedServicesService();
