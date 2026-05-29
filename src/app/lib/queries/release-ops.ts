import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { fetchAPI } from '../api-client';
import { defaultQueryOptions } from '../query-options';
import { queryKeys } from '../query-keys';
import type {
  AgenticMeshBlueprint,
  ApiForgeAuthType,
  ApiForgeReport,
  ApiForgeTarget,
  BrowserDeviceProfile,
  BrowserJourneyInput,
  BrowserQaReport,
  CompetitiveBenchmarkReport,
  FinOpsRisk,
  FinOpsSensitivity,
  FinOpsTaskType,
  MarketRadarLaunch,
  MarketRadarReport,
  MeshTopology,
  MissionControlRun,
  ModelFinOpsReport,
  MoatActivationRun,
  ProductionActivationResult,
  ProductionReadinessReport,
  ReleaseCommandMission,
  ReleaseEnvironment,
  ReleaseEvidenceSnapshot,
  ValidationEvidenceInput
} from './contracts';

export function useApiForgeReports(options?: Partial<UseQueryOptions<{ reports: ApiForgeReport[] }>>) {
  return useQuery({
    queryKey: queryKeys.apiForgeReports,
    queryFn: () => fetchAPI<{ reports: ApiForgeReport[] }>('/api-forge/reports'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateApiForgeReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name?: string;
      specText?: string;
      spec?: unknown;
      baseUrl?: string;
      targets?: ApiForgeTarget[];
      tenantId?: string;
      packageName?: string;
      authType?: ApiForgeAuthType;
      agentOptimized?: boolean;
    }) =>
      fetchAPI<ApiForgeReport>('/api-forge/reports', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiForgeReports });
      queryClient.setQueryData(queryKeys.apiForgeReport(data.id), data);
    },
  });
}

/* ============================================================
 * Browser QA — live preview, journey assertions, a11y, Playwright evidence
 * ============================================================ */

export function useBrowserQaReports(options?: Partial<UseQueryOptions<{ reports: BrowserQaReport[] }>>) {
  return useQuery({
    queryKey: queryKeys.browserQaReports,
    queryFn: () => fetchAPI<{ reports: BrowserQaReport[] }>('/browser-qa/reports'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateBrowserQaReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tenantId?: string;
      name?: string;
      releaseGoal?: string;
      targetUrl?: string;
      htmlSnapshot?: string;
      journeys?: BrowserJourneyInput[];
      deviceProfiles?: BrowserDeviceProfile[];
      validationEvidence?: ValidationEvidenceInput[];
    }) =>
      fetchAPI<BrowserQaReport>('/browser-qa/reports', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.browserQaReports });
      queryClient.setQueryData(queryKeys.browserQaReport(data.id), data);
    },
  });
}

/* ============================================================
 * Release Command — all-in-one launch gate and evidence manifest
 * ============================================================ */

export function useReleaseCommandMissions(options?: Partial<UseQueryOptions<{ missions: ReleaseCommandMission[] }>>) {
  return useQuery({
    queryKey: queryKeys.releaseCommandMissions,
    queryFn: () => fetchAPI<{ missions: ReleaseCommandMission[] }>('/release-command/missions'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateReleaseCommandMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tenantId?: string;
      productName?: string;
      releaseGoal: string;
      environment?: ReleaseEnvironment;
      regulated?: boolean;
      hasBlueprint?: boolean;
      hasPreview?: boolean;
      hasTests?: boolean;
      hasSecurityScan?: boolean;
      hasDatabaseReview?: boolean;
      hasCheckpoint?: boolean;
      hasRollbackPlan?: boolean;
      hasDeploymentPlan?: boolean;
      hasCustomerReport?: boolean;
      hasApiForgeConnectors?: boolean;
      slaMinutes?: number;
      evidenceArtifacts?: string[];
      openRisks?: string[];
    }) =>
      fetchAPI<ReleaseCommandMission>('/release-command/missions', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.releaseCommandMissions });
      queryClient.setQueryData(queryKeys.releaseCommandMission(data.id), data);
    },
  });
}

export function useCollectReleaseEvidence() {
  return useMutation({
    mutationFn: (input: {
      releaseGoal: string;
      environment?: ReleaseEnvironment;
      regulated?: boolean;
      slaMinutes?: number;
    }) =>
      fetchAPI<ReleaseEvidenceSnapshot>('/release-command/evidence-snapshot', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

export function useCreateAutoReleaseCommandMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tenantId?: string;
      productName?: string;
      releaseGoal: string;
      environment?: ReleaseEnvironment;
      regulated?: boolean;
      slaMinutes?: number;
      evidenceArtifacts?: string[];
      openRisks?: string[];
    }) =>
      fetchAPI<ReleaseCommandMission>('/release-command/missions/auto', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.releaseCommandMissions });
      queryClient.setQueryData(queryKeys.releaseCommandMission(data.id), data);
    },
  });
}

/* ============================================================
 * Mission Control — autonomous build/verify/release loop
 * ============================================================ */

export function useMissionControlRuns(options?: Partial<UseQueryOptions<{ runs: MissionControlRun[] }>>) {
  return useQuery({
    queryKey: queryKeys.missionControlRuns,
    queryFn: () => fetchAPI<{ runs: MissionControlRun[] }>('/mission-control/runs'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateMissionControlRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tenantId?: string;
      customerName?: string;
      mission: string;
      previewUrl?: string;
      htmlSnapshot?: string;
      environment?: ReleaseEnvironment;
      regulated?: boolean;
      budgetUsd?: number;
      timelineDays?: number;
      compliance?: string[];
      integrations?: string[];
    }) =>
      fetchAPI<MissionControlRun>('/mission-control/runs', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.missionControlRuns });
      queryClient.invalidateQueries({ queryKey: queryKeys.releaseCommandMissions });
      queryClient.invalidateQueries({ queryKey: queryKeys.browserQaReports });
      queryClient.invalidateQueries({ queryKey: queryKeys.productBlueprints });
      queryClient.setQueryData(queryKeys.missionControlRun(data.id), data);
    },
  });
}

/* ============================================================
 * Market Radar — market signal to build-pack compiler
 * ============================================================ */

export function useCompetitiveBenchmark(options?: Partial<UseQueryOptions<CompetitiveBenchmarkReport>>) {
  return useQuery({
    queryKey: queryKeys.competitiveBenchmark,
    queryFn: () => fetchAPI<CompetitiveBenchmarkReport>('/market-radar/competitive-benchmark'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useMoatActivationRuns(options?: Partial<UseQueryOptions<{ runs: MoatActivationRun[] }>>) {
  return useQuery({
    queryKey: queryKeys.moatActivationRuns,
    queryFn: () => fetchAPI<{ runs: MoatActivationRun[] }>('/market-radar/moat-activation-runs'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateMoatActivationRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { tactic?: string; maxMissions?: number; tenantId?: string } = {}) =>
      fetchAPI<MoatActivationRun>('/market-radar/moat-activation-runs', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.moatActivationRuns });
      queryClient.invalidateQueries({ queryKey: queryKeys.missionControlRuns });
      queryClient.invalidateQueries({ queryKey: queryKeys.marketRadarReports });
    },
  });
}

export function useMarketRadarReports(options?: Partial<UseQueryOptions<{ reports: MarketRadarReport[] }>>) {
  return useQuery({
    queryKey: queryKeys.marketRadarReports,
    queryFn: () => fetchAPI<{ reports: MarketRadarReport[] }>('/market-radar/reports'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateMarketRadarReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      focus?: string;
      tenantId?: string;
      targetUser?: string;
      includeMoonshots?: boolean;
      observedSignals?: Array<{ source: string; capability: string; sourceUrl?: string }>;
    }) =>
      fetchAPI<MarketRadarReport>('/market-radar/reports', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketRadarReports });
      queryClient.setQueryData(queryKeys.marketRadarReport(data.id), data);
    },
  });
}

export function useLaunchMarketBuildPack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { reportId: string; buildPackId: string }) =>
      fetchAPI<MarketRadarLaunch>(`/market-radar/reports/${encodeURIComponent(input.reportId)}/launch`, {
        method: 'POST',
        body: JSON.stringify({ buildPackId: input.buildPackId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.missionControlRuns });
      queryClient.invalidateQueries({ queryKey: queryKeys.marketRadarReports });
    },
  });
}

/* ============================================================
 * Model FinOps — cache-first routing, model budgets, quality gates
 * ============================================================ */

export function useModelFinOpsReports(options?: Partial<UseQueryOptions<{ reports: ModelFinOpsReport[] }>>) {
  return useQuery({
    queryKey: queryKeys.modelFinOpsReports,
    queryFn: () => fetchAPI<{ reports: ModelFinOpsReport[] }>('/model-finops/reports'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateModelFinOpsReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tenantId?: string;
      mission: string;
      taskTypes?: FinOpsTaskType[];
      monthlyBudgetUsd?: number;
      taskBudgetUsd?: number;
      expectedRunsPerMonth?: number;
      contextTokens?: number;
      outputTokens?: number;
      qualityTarget?: number;
      sensitivityLevel?: FinOpsSensitivity;
      risk?: FinOpsRisk;
      requiresSovereign?: boolean;
      repeatedContext?: boolean;
      providerPreference?: Array<'anthropic' | 'openai' | 'google' | 'vertexai' | 'bedrock' | 'ollama' | 'vllm' | 'localMock'>;
    }) =>
      fetchAPI<ModelFinOpsReport>('/model-finops/reports', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.modelFinOpsReports });
      queryClient.setQueryData(queryKeys.modelFinOpsReport(data.id), data);
    },
  });
}

/* ============================================================
 * Agentic Mesh — topology, A2A-style envelopes, shared state, loops
 * ============================================================ */

export function useAgenticMeshBlueprints(options?: Partial<UseQueryOptions<{ blueprints: AgenticMeshBlueprint[] }>>) {
  return useQuery({
    queryKey: queryKeys.agenticMeshBlueprints,
    queryFn: () => fetchAPI<{ blueprints: AgenticMeshBlueprint[] }>('/agentic-mesh/blueprints'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateAgenticMeshBlueprint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tenantId?: string;
      mission: string;
      goal?: string;
      regulated?: boolean;
      maxIterations?: number;
      autonomyLevel?: 'assistive' | 'supervised' | 'autonomous';
      budgetUsd?: number;
      preferredTopologies?: MeshTopology[];
    }) =>
      fetchAPI<AgenticMeshBlueprint>('/agentic-mesh/blueprints', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agenticMeshBlueprints });
      queryClient.invalidateQueries({ queryKey: queryKeys.modelFinOpsReports });
      queryClient.setQueryData(queryKeys.agenticMeshBlueprint(data.id), data);
    },
  });
}

/* ============================================================
 * Production Readiness — activate all services into one delivery loop
 * ============================================================ */

export function useProductionReadinessReports(options?: Partial<UseQueryOptions<{ reports: ProductionReadinessReport[] }>>) {
  return useQuery({
    queryKey: queryKeys.productionReadinessReports,
    queryFn: () => fetchAPI<{ reports: ProductionReadinessReport[] }>('/production-readiness/reports'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateProductionReadinessReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tenantId?: string;
      mission?: string;
      environment?: ReleaseEnvironment;
      regulated?: boolean;
      customerName?: string;
    }) =>
      fetchAPI<ProductionReadinessReport>('/production-readiness/reports', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.productionReadinessReports }),
  });
}

export function useProductionReadinessActivations(options?: Partial<UseQueryOptions<{ activations: ProductionActivationResult[] }>>) {
  return useQuery({
    queryKey: queryKeys.productionReadinessActivations,
    queryFn: () => fetchAPI<{ activations: ProductionActivationResult[] }>('/production-readiness/activations'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useActivateProductionReadiness() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tenantId?: string;
      mission?: string;
      environment?: ReleaseEnvironment;
      regulated?: boolean;
      customerName?: string;
    }) =>
      fetchAPI<ProductionActivationResult>('/production-readiness/activate', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.productionReadinessReports });
      queryClient.invalidateQueries({ queryKey: queryKeys.productionReadinessActivations });
      queryClient.invalidateQueries({ queryKey: queryKeys.missionControlRuns });
      queryClient.invalidateQueries({ queryKey: queryKeys.releaseCommandMissions });
      queryClient.invalidateQueries({ queryKey: queryKeys.customerDeliveryAccounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.apiForgeReports });
      queryClient.invalidateQueries({ queryKey: queryKeys.modelFinOpsReports });
      queryClient.invalidateQueries({ queryKey: queryKeys.agenticMeshBlueprints });
    },
  });
}

/* ============================================================
 * Model router — direct invocation and streaming completion
 * ============================================================ */
