import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';
import type {
  FinOpsAgentBudget,
  FinOpsCachePlan,
  FinOpsModelChoice,
  FinOpsQualityGuardrail,
  FinOpsRouteStep,
  FinOpsStrategy,
  FinOpsTaskType,
  ModelFinOpsInput,
  ModelFinOpsReport,
} from './types.js';

const reports = new Map<string, ModelFinOpsReport>();

const MODEL_CHOICES: FinOpsModelChoice[] = [
  model('localMock', 'mock-small', 'local', 0, 0, 1_000_000, false, true, ['triage', 'planning', 'customer-report']),
  model('ollama', 'qwen2.5-coder:14b', 'local', 0, 0, 128_000, false, true, ['triage', 'coding', 'review']),
  model('vllm', 'deepseek-coder-v3-local', 'sovereign', 0.00005, 0.00015, 128_000, false, true, ['coding', 'review', 'database']),
  model('google', 'gemini-2.5-flash', 'economy', 0.0003, 0.0025, 1_000_000, true, false, ['triage', 'planning', 'browser-qa', 'release', 'customer-report']),
  model('google', 'gemini-2.5-pro', 'premium', 0.00125, 0.01, 1_000_000, true, false, ['planning', 'coding', 'review', 'security', 'database']),
  model('vertexai', 'gemini-2.5-flash', 'sovereign', 0.0003, 0.0025, 1_000_000, true, true, ['triage', 'planning', 'browser-qa', 'release']),
  model('vertexai', 'gemini-2.5-pro', 'sovereign', 0.00125, 0.01, 1_000_000, true, true, ['planning', 'coding', 'security', 'database']),
  model('openai', 'gpt-4.1-mini', 'balanced', 0.0004, 0.0016, 1_000_000, false, false, ['triage', 'planning', 'coding', 'review']),
  model('openai', 'gpt-4.1', 'premium', 0.002, 0.008, 1_000_000, false, false, ['coding', 'review', 'security']),
  model('anthropic', 'claude-sonnet-4.5', 'premium', 0.003, 0.015, 200_000, false, false, ['planning', 'coding', 'review', 'security']),
  model('bedrock', 'claude-sonnet-bedrock', 'sovereign', 0.003, 0.015, 200_000, false, true, ['planning', 'coding', 'review', 'security', 'database']),
];

const TASK_PROFILES: Record<FinOpsTaskType, {
  purpose: string;
  inputMultiplier: number;
  outputMultiplier: number;
  strategy: FinOpsStrategy;
  accuracyCritical: boolean;
}> = {
  triage: {
    purpose: 'Classify request, risk, domain, and required agent topology before spending premium tokens.',
    inputMultiplier: 0.45,
    outputMultiplier: 0.35,
    strategy: 'small-model-first',
    accuracyCritical: false,
  },
  planning: {
    purpose: 'Create system design, work breakdown, evidence requirements, and costed execution lanes.',
    inputMultiplier: 0.9,
    outputMultiplier: 0.8,
    strategy: 'cache-first',
    accuracyCritical: true,
  },
  coding: {
    purpose: 'Generate or modify implementation with tests, file claims, and sandbox-ready commands.',
    inputMultiplier: 1,
    outputMultiplier: 1,
    strategy: 'cascade',
    accuracyCritical: true,
  },
  review: {
    purpose: 'Critique outputs only where risk, diff size, security, or low confidence requires it.',
    inputMultiplier: 0.7,
    outputMultiplier: 0.45,
    strategy: 'critic-only-on-risk',
    accuracyCritical: true,
  },
  security: {
    purpose: 'Threat-model, scan, and verify safe changes before release exposure.',
    inputMultiplier: 0.85,
    outputMultiplier: 0.6,
    strategy: 'critic-only-on-risk',
    accuracyCritical: true,
  },
  database: {
    purpose: 'Design migration, lock-risk review, rollback, and data quality gates.',
    inputMultiplier: 0.8,
    outputMultiplier: 0.65,
    strategy: 'critic-only-on-risk',
    accuracyCritical: true,
  },
  'browser-qa': {
    purpose: 'Generate preview journeys, accessibility checks, screenshots, and fix-loop tickets.',
    inputMultiplier: 0.55,
    outputMultiplier: 0.5,
    strategy: 'batch',
    accuracyCritical: false,
  },
  release: {
    purpose: 'Score release evidence, deployment gates, rollback readiness, and customer exposure.',
    inputMultiplier: 0.6,
    outputMultiplier: 0.45,
    strategy: 'cache-first',
    accuracyCritical: true,
  },
  'customer-report': {
    purpose: 'Package executive/customer updates with evidence and commercial margin visibility.',
    inputMultiplier: 0.5,
    outputMultiplier: 0.5,
    strategy: 'batch',
    accuracyCritical: false,
  },
};

export class ModelFinOpsService {
  listReports(): ModelFinOpsReport[] {
    return Array.from(reports.values()).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }

  getReport(id: string): ModelFinOpsReport | undefined {
    return reports.get(id);
  }

  createReport(input: ModelFinOpsInput): ModelFinOpsReport {
    const tenantId = input.tenantId ?? 'tenant_default';
    const mission = input.mission.trim();
    const taskTypes = dedupe(input.taskTypes?.length ? input.taskTypes : inferTaskTypes(mission));
    const expectedRuns = clamp(input.expectedRunsPerMonth ?? 120, 1, 100_000);
    const contextTokens = clamp(input.contextTokens ?? estimateContextTokens(mission, taskTypes), 512, 900_000);
    const outputTokens = clamp(input.outputTokens ?? estimateOutputTokens(taskTypes), 256, 64_000);
    const sensitivityLevel = input.sensitivityLevel ?? inferSensitivity(mission);
    const risk = input.risk ?? inferRisk(mission, taskTypes, sensitivityLevel);
    const requiresSovereign = Boolean(input.requiresSovereign || sensitivityLevel === 'confidential' || sensitivityLevel === 'restricted');
    const monthlyBudgetUsd = input.monthlyBudgetUsd ?? 2_500;
    const taskBudgetUsd = input.taskBudgetUsd ?? Math.max(0.25, monthlyBudgetUsd / Math.max(expectedRuns, 1));
    const route = taskTypes.map((taskType, index) => this.buildRouteStep({
      taskType,
      index,
      contextTokens,
      outputTokens,
      requiresSovereign,
      risk,
      providerPreference: input.providerPreference,
    }));
    const baselineRunCost = roundMoney(taskTypes.reduce((sum, taskType) => (
      sum + estimateCost(premiumBaseline(requiresSovereign), scaledInput(taskType, contextTokens), scaledOutput(taskType, outputTokens))
    ), 0) * (risk === 'low' ? 1.1 : 1.35));
    const optimizedRunCost = roundMoney(route.reduce((sum, step) => sum + step.estimatedCostUsd, 0));
    const cachePlan = buildCachePlan({
      mission,
      contextTokens,
      repeatedContext: input.repeatedContext ?? true,
      expectedRuns,
      route,
      baselineRunCost,
      optimizedRunCost,
    });
    const cacheAdjustedRunCost = roundMoney(Math.max(0, optimizedRunCost - cachePlan.estimatedMonthlySavingsUsd / expectedRuns));
    const optimizedMonthly = roundMoney(cacheAdjustedRunCost * expectedRuns);
    const baselineMonthly = roundMoney(baselineRunCost * expectedRuns);
    const savingsUsd = roundMoney(Math.max(0, baselineMonthly - optimizedMonthly));
    const savingsPercent = baselineMonthly > 0 ? Math.round((savingsUsd / baselineMonthly) * 100) : 0;
    const expectedQualityScore = Math.min(99, Math.max(
      input.qualityTarget ?? 92,
      86 + route.filter((step) => TASK_PROFILES[step.taskType].accuracyCritical).length * 2 + guardrailBoost(risk),
    ));

    const report: ModelFinOpsReport = {
      id: `finops_${nanoid(10)}`,
      tenantId,
      mission,
      generatedAt: new Date().toISOString(),
      taskTypes,
      risk,
      sensitivityLevel,
      summary: `FinOps Autopilot routes ${taskTypes.length} work type(s) through cache-first, small-model-first, cascade, and risk-triggered critic passes. Estimated savings: ${savingsPercent}% while holding quality near ${expectedQualityScore}%.`,
      baseline: {
        model: premiumBaseline(requiresSovereign).model,
        estimatedRunCostUsd: baselineRunCost,
        estimatedMonthlyCostUsd: baselineMonthly,
        policy: 'Premium model for every step, no reusable context cache, critic/review always on.',
      },
      optimized: {
        estimatedRunCostUsd: cacheAdjustedRunCost,
        estimatedMonthlyCostUsd: optimizedMonthly,
        savingsUsd,
        savingsPercent,
        expectedQualityScore,
        latencyPosture: route.some((step) => step.primary.tier === 'premium') ? 'balanced' : 'fast',
      },
      route,
      cachePlan,
      budgetPolicy: buildBudgetPolicy(monthlyBudgetUsd, taskBudgetUsd, risk),
      guardrails: buildGuardrails(risk, sensitivityLevel),
      agentBudgets: buildAgentBudgets(route, risk),
      nextActions: [
        'Pin large common context at the beginning of prompts to improve implicit cache hit rate.',
        'Create explicit cache handles for repository maps, API specs, database schemas, product briefs, and policy packs.',
        'Use cheap triage before premium reasoning, then escalate only on low confidence, high risk, or failed tests.',
        'Record planned versus actual model spend into the Cost dashboard and Trust Ledger for margin control.',
      ],
      sources: [
        {
          title: 'Google ADK multi-agent systems',
          url: 'https://adk.dev/agents/multi-agents/',
          signal: 'Use sequential, parallel, loop, review/critique, and human-gated patterns instead of one giant agent prompt.',
        },
        {
          title: 'Google Gemini API context caching',
          url: 'https://ai.google.dev/gemini-api/docs/caching',
          signal: 'Cache repeated input tokens and reuse them across requests to reduce repeated prompt cost.',
        },
        {
          title: 'Vertex AI context caching',
          url: 'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview',
          signal: 'Use implicit or explicit caches for repeated repository, document, and code-analysis contexts.',
        },
        {
          title: 'Google Agent2Agent protocol',
          url: 'https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/',
          signal: 'Represent agent collaboration with discoverable capabilities, task lifecycle, security, and long-running work.',
        },
      ],
    };

    reports.set(report.id, report);
    return report;
  }

  private buildRouteStep(input: {
    taskType: FinOpsTaskType;
    index: number;
    contextTokens: number;
    outputTokens: number;
    requiresSovereign: boolean;
    risk: ModelFinOpsReport['risk'];
    providerPreference?: ModelFinOpsInput['providerPreference'];
  }): FinOpsRouteStep {
    const profile = TASK_PROFILES[input.taskType];
    const primary = choosePrimary(input.taskType, input.requiresSovereign, input.risk, input.providerPreference);
    const fallback = chooseFallback(primary, input.taskType, input.requiresSovereign);
    const escalationTarget = chooseEscalation(input.requiresSovereign);
    const estimatedInputTokens = scaledInput(input.taskType, input.contextTokens);
    const estimatedOutputTokens = scaledOutput(input.taskType, input.outputTokens);
    const baseCost = estimateCost(primary, estimatedInputTokens, estimatedOutputTokens);
    const fallbackReserve = estimateCost(fallback, Math.round(estimatedInputTokens * 0.25), Math.round(estimatedOutputTokens * 0.25));
    const criticReserve = profile.accuracyCritical && input.risk !== 'low'
      ? estimateCost(escalationTarget, Math.round(estimatedInputTokens * 0.35), Math.round(estimatedOutputTokens * 0.25))
      : 0;

    return {
      order: input.index + 1,
      taskType: input.taskType,
      purpose: profile.purpose,
      strategy: input.requiresSovereign && primary.sovereign && !primary.supportsContextCache
        ? 'sovereign-local'
        : profile.strategy,
      primary,
      fallback,
      escalation: {
        trigger: profile.accuracyCritical
          ? 'low confidence, failing tests, security/database risk, or release-blocking evidence gap'
          : 'user-visible contradiction, missing source, or repeated failure',
        target: escalationTarget,
        maxExtraPasses: input.risk === 'critical' ? 2 : 1,
      },
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCostUsd: roundMoney(baseCost + fallbackReserve * 0.18 + criticReserve * 0.35),
      qualityGate: qualityGateFor(input.taskType),
      cachePolicy: primary.supportsContextCache
        ? 'cache reusable system prompt, repo map, docs, schemas, API specs, policies, and product brief'
        : 'use response cache, retrieval snippets, summarized memory, and local artifact reuse',
    };
  }
}

function model(
  provider: FinOpsModelChoice['provider'],
  name: string,
  tier: FinOpsModelChoice['tier'],
  inputUsdPer1K: number,
  outputUsdPer1K: number,
  maxContextTokens: number,
  supportsContextCache: boolean,
  sovereign: boolean,
  bestFor: FinOpsTaskType[],
): FinOpsModelChoice {
  return { provider, model: name, tier, inputUsdPer1K, outputUsdPer1K, maxContextTokens, supportsContextCache, sovereign, bestFor };
}

function inferTaskTypes(mission: string): FinOpsTaskType[] {
  const lower = mission.toLowerCase();
  const tasks: FinOpsTaskType[] = ['triage', 'planning'];
  if (/build|code|implement|feature|app|web|api|fix/.test(lower)) tasks.push('coding', 'review');
  if (/security|soc|iso|compliance|secret|auth|policy/.test(lower)) tasks.push('security');
  if (/database|sql|postgres|mysql|schema|migration|data/.test(lower)) tasks.push('database');
  if (/browser|preview|ui|ux|playwright|accessibility|visual builder|app builder/.test(lower)) tasks.push('browser-qa');
  if (/deploy|release|production|staging|rollback|slo|canary/.test(lower)) tasks.push('release');
  if (/customer|client|report|sow|handoff|invoice|pricing/.test(lower)) tasks.push('customer-report');
  return dedupe(tasks);
}

function inferSensitivity(mission: string): ModelFinOpsReport['sensitivityLevel'] {
  const lower = mission.toLowerCase();
  if (/restricted|secret|credential|payment|bank|health|pii/.test(lower)) return 'restricted';
  if (/confidential|enterprise|customer data|source code|database|production/.test(lower)) return 'confidential';
  if (/internal|staging|private/.test(lower)) return 'internal';
  return 'public';
}

function inferRisk(
  mission: string,
  taskTypes: FinOpsTaskType[],
  sensitivity: ModelFinOpsReport['sensitivityLevel'],
): ModelFinOpsReport['risk'] {
  const lower = mission.toLowerCase();
  if (sensitivity === 'restricted' || /production|payment|delete|drop|credential|regulated/.test(lower)) return 'critical';
  if (sensitivity === 'confidential' || taskTypes.includes('security') || taskTypes.includes('database')) return 'high';
  if (taskTypes.includes('coding') || taskTypes.includes('release')) return 'medium';
  return 'low';
}

function choosePrimary(
  taskType: FinOpsTaskType,
  requiresSovereign: boolean,
  risk: ModelFinOpsReport['risk'],
  providerPreference?: ModelFinOpsInput['providerPreference'],
): FinOpsModelChoice {
  const candidates = MODEL_CHOICES
    .filter((choice) => choice.bestFor.includes(taskType))
    .filter((choice) => !requiresSovereign || choice.sovereign)
    .filter((choice) => !providerPreference?.length || providerPreference.includes(choice.provider as NonNullable<ModelFinOpsInput['providerPreference']>[number]));
  const pool = candidates.length ? candidates : MODEL_CHOICES.filter((choice) => choice.bestFor.includes(taskType));
  const sorted = [...pool].sort((a, b) => {
    if (risk === 'critical' || risk === 'high') {
      return qualityRank(b) - qualityRank(a) || costRank(a) - costRank(b);
    }
    return costRank(a) - costRank(b) || qualityRank(b) - qualityRank(a);
  });
  return sorted[0] ?? MODEL_CHOICES[0]!;
}

function chooseFallback(primary: FinOpsModelChoice, taskType: FinOpsTaskType, requiresSovereign: boolean): FinOpsModelChoice {
  const fallback = MODEL_CHOICES
    .filter((choice) => choice.model !== primary.model)
    .filter((choice) => choice.bestFor.includes(taskType))
    .filter((choice) => !requiresSovereign || choice.sovereign)
    .sort((a, b) => costRank(a) - costRank(b))[0];
  return fallback ?? primary;
}

function chooseEscalation(requiresSovereign: boolean): FinOpsModelChoice {
  return (requiresSovereign
    ? MODEL_CHOICES.find((choice) => choice.provider === 'bedrock' && choice.model.includes('claude'))
    : MODEL_CHOICES.find((choice) => choice.provider === 'anthropic' && choice.model.includes('sonnet')))
    ?? MODEL_CHOICES.find((choice) => choice.tier === 'premium')
    ?? MODEL_CHOICES[0]!;
}

function premiumBaseline(requiresSovereign: boolean): FinOpsModelChoice {
  return chooseEscalation(requiresSovereign);
}

function costRank(choice: FinOpsModelChoice): number {
  return choice.inputUsdPer1K + choice.outputUsdPer1K;
}

function qualityRank(choice: FinOpsModelChoice): number {
  return { local: 60, economy: 72, balanced: 82, premium: 94, sovereign: choice.model.includes('pro') || choice.model.includes('claude') ? 93 : 78 }[choice.tier];
}

function estimateCost(choice: FinOpsModelChoice, inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1000) * choice.inputUsdPer1K + (outputTokens / 1000) * choice.outputUsdPer1K;
}

function scaledInput(taskType: FinOpsTaskType, contextTokens: number): number {
  return Math.round(contextTokens * TASK_PROFILES[taskType].inputMultiplier);
}

function scaledOutput(taskType: FinOpsTaskType, outputTokens: number): number {
  return Math.round(outputTokens * TASK_PROFILES[taskType].outputMultiplier);
}

function estimateContextTokens(mission: string, taskTypes: FinOpsTaskType[]): number {
  const base = Math.ceil(mission.length / 4) + 8_000;
  return base + taskTypes.length * 2_500;
}

function estimateOutputTokens(taskTypes: FinOpsTaskType[]): number {
  return 1_800 + taskTypes.length * 700;
}

function buildCachePlan(input: {
  mission: string;
  contextTokens: number;
  repeatedContext: boolean;
  expectedRuns: number;
  route: FinOpsRouteStep[];
  baselineRunCost: number;
  optimizedRunCost: number;
}): FinOpsCachePlan {
  const cacheableProvider = input.route.find((step) => step.primary.supportsContextCache)?.primary.provider ?? 'google';
  const prefixTokens = Math.round(input.contextTokens * 0.68);
  const expectedHitRate = input.repeatedContext ? 0.72 : 0.28;
  const discount = cacheableProvider === 'vertexai' || cacheableProvider === 'google' ? 90 : 55;
  const monthlyReusableInputCost = Math.max(0, input.baselineRunCost - input.optimizedRunCost) * input.expectedRuns * 0.35;
  const estimatedMonthlySavingsUsd = roundMoney(monthlyReusableInputCost * expectedHitRate * (discount / 100));
  const cacheKey = createHash('sha256').update(`${input.mission}:${prefixTokens}:${cacheableProvider}`).digest('hex').slice(0, 16);

  return {
    enabled: prefixTokens >= 2_048,
    cacheKey: `ctx_${cacheKey}`,
    provider: cacheableProvider,
    prefixTokens,
    ttlMinutes: input.expectedRuns > 500 ? 1_440 : 240,
    expectedHitRate,
    cachedTokenDiscountPercent: discount,
    estimatedMonthlySavingsUsd,
    cacheableBlocks: [
      'AXON system and safety instructions',
      'repository map and affected files',
      'API/OpenAPI specs and SDK docs',
      'database schema, migrations, and policies',
      'customer product brief and acceptance criteria',
      'security and release gate checklist',
    ],
  };
}

function buildBudgetPolicy(monthlyBudgetUsd: number, taskBudgetUsd: number, risk: ModelFinOpsReport['risk']) {
  return {
    monthlyBudgetUsd,
    taskBudgetUsd,
    hardStopUsd: roundMoney(monthlyBudgetUsd * 1.1),
    warnAtPercent: 80,
    maxPremiumPasses: risk === 'critical' ? 3 : risk === 'high' ? 2 : 1,
    maxCriticPasses: risk === 'low' ? 0 : risk === 'medium' ? 1 : 2,
    rules: [
      'Block optional research agents once budget warning is reached.',
      'Require approval before premium models run after hard-stop threshold.',
      'Prefer local/sovereign models for confidential source code and database context.',
      'Batch customer reports, browser summaries, and release recaps into one low-cost generation pass.',
    ],
  };
}

function buildGuardrails(risk: ModelFinOpsReport['risk'], sensitivity: ModelFinOpsReport['sensitivityLevel']): FinOpsQualityGuardrail[] {
  const guardrails: FinOpsQualityGuardrail[] = [
    {
      id: 'eval-before-escalation',
      title: 'Evaluation before premium escalation',
      whyItPreservesAccuracy: 'Cheap model output must pass schema, tests, evidence, and confidence checks before avoiding premium review.',
      ownerAgent: 'CriticAgent',
      evidence: ['schema validation', 'test command result', 'confidence score', 'artifact diff'],
    },
    {
      id: 'retrieval-grounding',
      title: 'Ground every answer in workspace and source evidence',
      whyItPreservesAccuracy: 'Routing to smaller models is safe only when context is narrowed to relevant files, docs, policies, and previous decisions.',
      ownerAgent: 'AgenticCoordinatorAgent',
      evidence: ['retrieval hits', 'file claims', 'blackboard context summary'],
    },
    {
      id: 'risk-triggered-critic',
      title: 'Critic only when risk is real',
      whyItPreservesAccuracy: 'Security, database, production, low-confidence, and failed-test paths still receive premium or sovereign critic review.',
      ownerAgent: 'SecurityAgent',
      evidence: ['risk score', 'critic decision', 'release gate status'],
    },
  ];

  if (risk === 'critical' || sensitivity === 'restricted') {
    guardrails.push({
      id: 'sovereign-boundary',
      title: 'Sovereign execution boundary',
      whyItPreservesAccuracy: 'Restricted or regulated context stays on Bedrock, Vertex, vLLM, Ollama, or local mock routes with explicit policy evidence.',
      ownerAgent: 'FinOpsAgent',
      evidence: ['provider route', 'policy decision', 'data classification'],
    });
  }

  return guardrails;
}

function buildAgentBudgets(route: FinOpsRouteStep[], risk: ModelFinOpsReport['risk']): FinOpsAgentBudget[] {
  const routeByTask = new Map(route.map((step) => [step.taskType, step]));
  const agentMap: FinOpsAgentBudget[] = [
    budget('IntentAgent', ['triage'], 'small-model-first', routeByTask, risk),
    budget('AgenticCoordinatorAgent', ['planning'], 'cache-first', routeByTask, risk),
    budget('EngineeringAgent', ['coding'], 'cascade', routeByTask, risk),
    budget('CriticAgent', ['review', 'security', 'database'], 'critic-only-on-risk', routeByTask, risk),
    budget('QAAgent', ['browser-qa', 'review'], 'batch', routeByTask, risk),
    budget('ReleaseAgent', ['release'], 'cache-first', routeByTask, risk),
    budget('CustomerSuccessAgent', ['customer-report'], 'batch', routeByTask, risk),
    budget('FinOpsAgent', route.map((step) => step.taskType), 'cache-first', routeByTask, risk),
  ];
  return agentMap.filter((item) => item.allowedTaskTypes.some((taskType) => routeByTask.has(taskType)));
}

function budget(
  agent: string,
  allowedTaskTypes: FinOpsTaskType[],
  defaultStrategy: FinOpsStrategy,
  routeByTask: Map<FinOpsTaskType, FinOpsRouteStep>,
  risk: ModelFinOpsReport['risk'],
): FinOpsAgentBudget {
  const relevant = allowedTaskTypes.map((taskType) => routeByTask.get(taskType)).filter(Boolean) as FinOpsRouteStep[];
  const maxCostPerRunUsd = roundMoney(Math.max(...relevant.map((step) => step.estimatedCostUsd), 0.01) * (risk === 'critical' ? 1.8 : 1.25));
  return {
    agent,
    allowedTaskTypes,
    defaultStrategy,
    maxCostPerRunUsd,
    escalationModel: relevant[0]?.escalation.target.model ?? 'claude-sonnet-4.5',
    stopCondition: 'Stop when evidence, tests, schema, and confidence gates pass or when budget policy requires approval.',
  };
}

function qualityGateFor(taskType: FinOpsTaskType): string {
  const gates: Record<FinOpsTaskType, string> = {
    triage: 'intent schema validates and risk classification is explainable',
    planning: 'architecture has traceability, acceptance criteria, and release evidence',
    coding: 'affected tests pass and diff stays inside claimed files',
    review: 'critic findings are resolved or converted to accepted risk',
    security: 'no critical/high unapproved findings',
    database: 'rollback, lock-risk, backup, and data quality gates pass',
    'browser-qa': 'critical journeys, console, network, and accessibility checks pass',
    release: 'Release Command score passes required environment gates',
    'customer-report': 'report references evidence, scope, timeline, margin, and open risks',
  };
  return gates[taskType];
}

function guardrailBoost(risk: ModelFinOpsReport['risk']) {
  return { low: 1, medium: 3, high: 5, critical: 7 }[risk];
}

function dedupe<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundMoney(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export const modelFinOps = new ModelFinOpsService();
