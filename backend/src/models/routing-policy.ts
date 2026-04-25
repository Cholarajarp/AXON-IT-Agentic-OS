import type { ModelRequest, Provider, ProviderHealth, SelectionCriteria } from './types.js';

const DEEP_REASONING_PATTERN = /research|analysis|architecture|plan|blueprint|strategy|design/i;
const OPERATIONAL_PATTERN = /triage|summary|classification|status|incident|health|runbook/i;
const ENTERPRISE_PATTERN = /enterprise|regulated|regulatory|audit|governance|policy|security|compliance|restricted|confidential|sovereign|private|internal/i;

export function buildSelectionCriteria(request: ModelRequest): SelectionCriteria {
  return {
    taskType: request.taskType,
    sensitivityLevel: request.sensitivityLevel,
    costBudget: request.costBudget,
    contextLength: estimateTokens(request.messages.map((message) => message.content).join(' ')),
    sovereignMode: request.sovereignMode,
    preferredProvider: request.preferredProvider,
  };
}

export function selectBestProvider(
  request: ModelRequest,
  criteria: SelectionCriteria,
  providers: Map<string, Provider>,
  health: Map<string, ProviderHealth>,
): Provider | null {
  const candidates: Array<{ provider: Provider; score: number }> = [];
  const promptTokens = estimateTokens(request.messages.map((message) => message.content).join(' '));
  const profile = buildRequestProfile(criteria);

  for (const [name, provider] of providers) {
    const providerHealth = health.get(name);
    if (!providerHealth) continue;
    if (!isEligibleProvider(provider, providerHealth, criteria, promptTokens, profile.requiresSovereignBoundary)) continue;

    const estimatedCost = provider.estimateCost(request);
    if (criteria.costBudget !== undefined && estimatedCost > criteria.costBudget) continue;

    candidates.push({
      provider,
      score: scoreProvider(name, provider, providerHealth, criteria, profile, estimatedCost),
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].provider;
}

function isEligibleProvider(
  provider: Provider,
  health: ProviderHealth,
  criteria: SelectionCriteria,
  promptTokens: number,
  requiresSovereignBoundary: boolean,
) {
  if (!health.healthy) return false;
  if (health.cooldownUntil && Date.now() < health.cooldownUntil) return false;
  if (requiresSovereignBoundary && !provider.config.sovereign) return false;
  if (criteria.contextLength && criteria.contextLength > provider.config.maxContextLength) return false;
  return promptTokens <= provider.config.maxContextLength;
}

function scoreProvider(
  name: string,
  provider: Provider,
  health: ProviderHealth,
  criteria: SelectionCriteria,
  profile: ReturnType<typeof buildRequestProfile>,
  estimatedCost: number,
) {
  let score = 100;

  if (criteria.preferredProvider === name) score += 50;
  if (profile.isDeepReasoningTask) {
    score += provider.config.maxContextLength >= 200000 ? 18 : 0;
    score += provider.config.sovereign ? 4 : 0;
  }
  if (profile.isOperationalTask) {
    score += provider.config.supportsStreaming ? 8 : 0;
    score += provider.config.costPerOutputToken <= 0.00004 ? 10 : 0;
  }
  if (profile.isEnterpriseTask) score += enterpriseScore(name, provider);
  if (profile.requiresSovereignBoundary) score += sovereignBoundaryScore(name, provider);
  if (criteria.contextLength && criteria.contextLength > 50000) {
    score += provider.config.maxContextLength > 100000 ? 12 : 0;
  }
  if (health.avgLatencyMs > 0 && criteria.latencyTarget) {
    score -= Math.max(0, (health.avgLatencyMs - criteria.latencyTarget) / 10);
  }
  score -= health.consecutiveFailures * 25;
  score -= estimatedCost * (profile.requiresSovereignBoundary || profile.isEnterpriseTask ? 250 : 1000);
  if (provider.config.costPerOutputToken < 0.00005) score += 10;
  if (provider.config.sovereign && (criteria.sovereignMode || criteria.sensitivityLevel !== 'public')) score += 10;

  return score;
}

function buildRequestProfile(criteria: SelectionCriteria) {
  const taskType = criteria.taskType ?? '';
  return {
    isDeepReasoningTask: DEEP_REASONING_PATTERN.test(taskType),
    isOperationalTask: OPERATIONAL_PATTERN.test(taskType),
    isEnterpriseTask: ENTERPRISE_PATTERN.test(taskType),
    requiresSovereignBoundary:
      criteria.sovereignMode ||
      criteria.sensitivityLevel === 'restricted' ||
      criteria.sensitivityLevel === 'confidential',
  };
}

function enterpriseScore(name: string, provider: Provider) {
  let score = provider.config.sovereign ? 14 : 0;
  if (name === 'bedrock' || name === 'vertexai') score += 26;
  if (name === 'ollama') score += 8;
  return score;
}

function sovereignBoundaryScore(name: string, provider: Provider) {
  if (name === 'bedrock' || name === 'vertexai') return 40;
  if (name === 'ollama') return 10;
  return provider.config.sovereign ? 18 : 0;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
