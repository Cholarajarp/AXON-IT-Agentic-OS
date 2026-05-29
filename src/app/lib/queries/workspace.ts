import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { fetchAPI } from '../api-client';
import { defaultQueryOptions } from '../query-options';
import { queryKeys } from '../query-keys';
import type {
  AgentInstance,
  AgentPipelineProbeInput,
  AgentPipelineProbeResult,
  Alert,
  Approval,
  AuditEntryRecord,
  AuditVerificationResult,
  CostBudgetPolicy,
  CostExportPackage,
  CostLedgerEntry,
  CostLedgerInput,
  CostSummary,
  DAGResponse,
  Evidence,
  EvidenceExportPackage,
  EvidenceInput,
  ExecutiveMetrics,
  Incident,
  IntegrationConfigInput,
  IntegrationStatus,
  MemoryRecord,
  ModelCatalogResponse,
  ModelEvaluationReport,
  ModelEvaluationRunResponse,
  ModelRuntimeStatus,
  OrchestratorStatus,
  PipelineStep,
  PlatformHealth,
  Policy,
  PolicyDecisionRecord,
  PolicyInput,
  PolicySimulationInput,
  PolicySimulationResult,
  ProviderConfigInput,
  ProviderRuntimeHealth,
  PublicProviderConfig,
  ReleaseEnvironment,
  SkillPack,
  SkillPackInput,
  SubmitGoalPayload,
  TrustLedgerExport,
  TrustLedgerVerification,
  TrustRecord,
  TrustRecordKind,
  TrustRisk,
  Workflow,
  WorkspaceSettings,
  WorkspaceSettingsUpdate
} from './contracts';

export function useModelCatalog(options?: Partial<UseQueryOptions<ModelCatalogResponse>>) {
  return useQuery({
    queryKey: queryKeys.modelCatalog,
    queryFn: () => fetchAPI<ModelCatalogResponse>('/models/catalog'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useModelRuntimeStatus(options?: Partial<UseQueryOptions<ModelRuntimeStatus>>) {
  return useQuery({
    queryKey: queryKeys.modelRuntimeStatus,
    queryFn: () => fetchAPI<ModelRuntimeStatus>('/orchestrator/models'),
    refetchInterval: 15000,
    ...defaultQueryOptions,
    ...options,
  });
}

export function useModelProviderConfig(options?: Partial<UseQueryOptions<{ providers: PublicProviderConfig[] }>>) {
  return useQuery({
    queryKey: queryKeys.modelProviderConfig,
    queryFn: () => fetchAPI<{ providers: PublicProviderConfig[] }>('/models/config'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useWorkspaceSettings(options?: Partial<UseQueryOptions<WorkspaceSettings>>) {
  return useQuery({
    queryKey: queryKeys.workspaceSettings,
    queryFn: () => fetchAPI<WorkspaceSettings>('/settings'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function usePlatformHealth(options?: Partial<UseQueryOptions<PlatformHealth>>) {
  return useQuery({
    queryKey: queryKeys.platformHealth,
    queryFn: () => fetchAPI<PlatformHealth>('/health'),
    refetchInterval: 30000,
    ...defaultQueryOptions,
    ...options,
  });
}

export function useIntegrations(options?: Partial<UseQueryOptions<IntegrationStatus[]>>) {
  return useQuery({
    queryKey: queryKeys.integrations,
    queryFn: () => fetchAPI<IntegrationStatus[]>('/integrations'),
    refetchInterval: 30000,
    ...defaultQueryOptions,
    ...options,
  });
}

export function useConfigureIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: IntegrationConfigInput) =>
      fetchAPI<{ success: boolean; type: string }>('/integrations/configure', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations });
    },
  });
}

export function useModelEvaluationReport(options?: Partial<UseQueryOptions<ModelEvaluationReport>>) {
  return useQuery({
    queryKey: queryKeys.modelEvaluations,
    queryFn: () => fetchAPI<ModelEvaluationReport>('/models/evaluations'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useRunModelEvaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { includeAdversarial?: boolean; tenantId?: string } = {}) =>
      fetchAPI<ModelEvaluationRunResponse>('/models/evaluations/run', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.modelEvaluations });
      queryClient.invalidateQueries({ queryKey: queryKeys.modelRuntimeStatus });
    },
  });
}

export function useSaveWorkspaceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkspaceSettingsUpdate) =>
      fetchAPI<WorkspaceSettings>('/settings', {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaceSettings });
    },
  });
}

export function useSaveModelProviderConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProviderConfigInput) =>
      fetchAPI<{ provider: PublicProviderConfig; providers: string[]; health: ProviderRuntimeHealth[] }>('/models/config', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.modelProviderConfig });
      queryClient.invalidateQueries({ queryKey: queryKeys.modelRuntimeStatus });
    },
  });
}

export function useSkills(options?: Partial<UseQueryOptions<{ skills: SkillPack[] }>>) {
  return useQuery({
    queryKey: queryKeys.skills,
    queryFn: () => fetchAPI<{ skills: SkillPack[] }>('/skills'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useSaveSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SkillPackInput) =>
      fetchAPI<SkillPack>(input.id ? `/skills/${encodeURIComponent(input.id)}` : '/skills', {
        method: input.id ? 'PATCH' : 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skills });
    },
  });
}

export function useSetSkillEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; enabled: boolean }) =>
      fetchAPI<SkillPack>(`/skills/${encodeURIComponent(input.id)}/enabled`, {
        method: 'POST',
        body: JSON.stringify({ enabled: input.enabled }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skills });
    },
  });
}

export function useDeleteSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchAPI<{ removed: boolean; id: string }>(`/skills/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skills });
    },
  });
}

// Workflows

export function useWorkflows(options?: Partial<UseQueryOptions<Workflow[]>>) {
  return useQuery({
    queryKey: queryKeys.workflows,
    queryFn: () => fetchAPI<Workflow[]>('/workflows'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useWorkflow(id: string, options?: Partial<UseQueryOptions<Workflow>>) {
  return useQuery({
    queryKey: queryKeys.workflow(id),
    queryFn: () => fetchAPI<Workflow>(`/workflows/${id}`),
    enabled: !!id,
    ...defaultQueryOptions,
    ...options,
  });
}

export function useSubmitGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitGoalPayload) => {
      return fetchAPI<Workflow>('/workflows', { method: 'POST', body: JSON.stringify(input) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows });
    },
  });
}

export function useKillWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      return fetchAPI<void>(`/workflows/${id}/cancel`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows });
    },
  });
}

// Agents

export function useAgents(options?: Partial<UseQueryOptions<AgentInstance[]>>) {
  return useQuery({
    queryKey: queryKeys.agents,
    queryFn: () => fetchAPI<AgentInstance[]>('/agents'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useAgent(id: string, options?: Partial<UseQueryOptions<AgentInstance>>) {
  return useQuery({
    queryKey: queryKeys.agent(id),
    queryFn: () => fetchAPI<AgentInstance>(`/agents/${id}`),
    enabled: !!id,
    ...defaultQueryOptions,
    ...options,
  });
}

// Approvals

export function useApprovals(options?: Partial<UseQueryOptions<Approval[]>>) {
  return useQuery({
    queryKey: queryKeys.approvals,
    queryFn: () => fetchAPI<Approval[]>('/approvals'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useResolveApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' }) => {
      return fetchAPI<void>(`/approvals/${id}`, { method: 'PATCH', body: JSON.stringify({ decision }) });
    },
    onMutate: async ({ id, decision }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.approvals });
      const previous = queryClient.getQueryData<Approval[]>(queryKeys.approvals);
      queryClient.setQueryData<Approval[]>(queryKeys.approvals, (old) =>
        old?.map((a) => (a.id === id ? { ...a, status: decision } : a))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.approvals, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows });
    },
  });
}

// Policies

export function usePolicies(options?: Partial<UseQueryOptions<Policy[]>>) {
  return useQuery({
    queryKey: queryKeys.policies,
    queryFn: () => fetchAPI<Policy[]>('/policies'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function usePolicy(id: string, options?: Partial<UseQueryOptions<Policy>>) {
  return useQuery({
    queryKey: queryKeys.policy(id),
    queryFn: () => fetchAPI<Policy>(`/policies/${id}`),
    enabled: !!id,
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreatePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PolicyInput) =>
      fetchAPI<Policy>('/policies', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.policies });
    },
  });
}

export function useUpdatePolicyStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Policy['status'] }) =>
      fetchAPI<Policy>(`/policies/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_policy, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.policies });
      queryClient.invalidateQueries({ queryKey: queryKeys.policy(variables.id) });
    },
  });
}

export function useSimulatePolicy() {
  return useMutation({
    mutationFn: (input: PolicySimulationInput) =>
      fetchAPI<PolicySimulationResult>('/policies/simulate', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

// Memory

export function useMemory(query: string, options?: Partial<UseQueryOptions<MemoryRecord[]>>) {
  return useQuery({
    queryKey: queryKeys.memory(query),
    queryFn: () => fetchAPI<MemoryRecord[]>(`/memory?q=${encodeURIComponent(query)}`),
    enabled: query.length > 0,
    ...defaultQueryOptions,
    ...options,
  });
}

export function useMemoryAll(options?: Partial<UseQueryOptions<MemoryRecord[]>>) {
  return useQuery({
    queryKey: queryKeys.memoryAll,
    queryFn: () => fetchAPI<MemoryRecord[]>('/memory'),
    ...defaultQueryOptions,
    ...options,
  });
}

// Audit

export function useAudit(options?: Partial<UseQueryOptions<AuditEntryRecord[]>>) {
  return useQuery({
    queryKey: queryKeys.audit,
    queryFn: () => fetchAPI<AuditEntryRecord[]>('/audit?limit=200'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useVerifyAudit() {
  return useMutation({
    mutationFn: (tenantId?: string) => {
      return fetchAPI<AuditVerificationResult>('/audit/verify', {
        method: 'POST',
        body: JSON.stringify({ tenantId }),
      });
    },
  });
}

export function useTrustLedgerRecords(options?: Partial<UseQueryOptions<{ records: TrustRecord[] }>>) {
  return useQuery({
    queryKey: queryKeys.trustLedgerRecords,
    queryFn: () => fetchAPI<{ records: TrustRecord[] }>('/trust-ledger/records?limit=200'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateTrustRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tenantId?: string;
      kind: TrustRecordKind;
      actor: string;
      actorType?: TrustRecord['actorType'];
      subject: string;
      summary: string;
      risk?: TrustRisk;
      source?: string;
      artifacts?: string[];
      metadata?: Record<string, unknown>;
      controls?: string[];
    }) =>
      fetchAPI<TrustRecord>('/trust-ledger/records', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.trustLedgerRecords }),
  });
}

export function useEvaluateTrustPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tenantId?: string;
      actor: string;
      action: string;
      resource: string;
      risk?: TrustRisk;
      environment?: ReleaseEnvironment;
      dataClass?: 'public' | 'internal' | 'confidential' | 'restricted';
      requestedScopes?: string[];
      hasApproval?: boolean;
    }) =>
      fetchAPI<PolicyDecisionRecord>('/trust-ledger/policy/decide', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.trustLedgerRecords }),
  });
}

export function useVerifyTrustLedger() {
  return useMutation({
    mutationFn: (tenantId?: string) =>
      fetchAPI<TrustLedgerVerification>('/trust-ledger/verify', {
        method: 'POST',
        body: JSON.stringify({ tenantId }),
      }),
  });
}

export function useExportTrustLedger() {
  return useMutation({
    mutationFn: (input: { tenantId?: string; format?: TrustLedgerExport['format'] } = {}) =>
      fetchAPI<TrustLedgerExport>('/trust-ledger/export', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

// Cost

export function useCost(options?: Partial<UseQueryOptions<CostSummary>>) {
  return useQuery({
    queryKey: queryKeys.cost,
    queryFn: () => fetchAPI<CostSummary>('/cost/summary'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useRecordCost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CostLedgerInput) =>
      fetchAPI<{ record: CostLedgerEntry; summary: CostSummary }>('/cost/ledger', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cost });
      queryClient.invalidateQueries({ queryKey: queryKeys.audit });
    },
  });
}

export function useUpdateCostBudgetPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Pick<CostBudgetPolicy, 'monthlyBudgetUsd' | 'warningThresholdPct' | 'hardStopThresholdPct'>) =>
      fetchAPI<CostBudgetPolicy>('/cost/budget-policy', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cost });
    },
  });
}

export function useExportCost() {
  return useMutation({
    mutationFn: () =>
      fetchAPI<CostExportPackage>('/cost/export', {
        method: 'POST',
      }),
  });
}

// Incidents

export function useIncidents(options?: Partial<UseQueryOptions<Incident[]>>) {
  return useQuery({
    queryKey: queryKeys.incidents,
    queryFn: () => fetchAPI<Incident[]>('/incidents'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useResolveIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      return fetchAPI<void>(`/incidents/${id}/resolve`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.incidents });
    },
  });
}

// Evidence

export function useEvidence(options?: Partial<UseQueryOptions<Evidence[]>>) {
  return useQuery({
    queryKey: queryKeys.evidence,
    queryFn: () => fetchAPI<Evidence[]>('/evidence'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateEvidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EvidenceInput) =>
      fetchAPI<Evidence>('/evidence', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.evidence });
      queryClient.invalidateQueries({ queryKey: queryKeys.audit });
    },
  });
}

export function useExportEvidence() {
  return useMutation({
    mutationFn: () =>
      fetchAPI<EvidenceExportPackage>('/evidence/export', {
        method: 'POST',
      }),
  });
}

// Alerts

export function useAlerts(options?: Partial<UseQueryOptions<Alert[]>>) {
  return useQuery({
    queryKey: queryKeys.alerts,
    queryFn: () => fetchAPI<Alert[]>('/alerts'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      return fetchAPI<void>(`/alerts/${id}/acknowledge`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
    },
  });
}

// Executive

export function useExecutive(options?: Partial<UseQueryOptions<ExecutiveMetrics>>) {
  return useQuery({
    queryKey: queryKeys.executive,
    queryFn: () => fetchAPI<ExecutiveMetrics>('/executive/summary'),
    ...defaultQueryOptions,
    ...options,
  });
}

// Orchestrator — DAG & Agent Execution

export function useDAG(workflowId: string) {
  return useQuery({
    queryKey: queryKeys.dag(workflowId),
    queryFn: () => fetchAPI<DAGResponse>(`/orchestrator/dag/${workflowId}`),
    enabled: !!workflowId,
    refetchInterval: 2000,
    retry: false,
  });
}

export function useOrchestratorStatus() {
  return useQuery({
    queryKey: queryKeys.orchestratorStatus,
    queryFn: () => fetchAPI<OrchestratorStatus>('/orchestrator/status'),
    enabled: true,
    refetchInterval: 3000,
  });
}

export function useExecuteWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { workflowId: string; goal: string; domain: string[]; budget?: number }) =>
      fetchAPI<{ workflowId: string; dagId: string; tasks: number }>('/orchestrator/execute', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows });
      queryClient.invalidateQueries({ queryKey: queryKeys.orchestratorStatus });
    },
  });
}

export function usePlanPreview() {
  return useMutation({
    mutationFn: (input: { goal: string; domain: string[] }) =>
      fetchAPI<{ goalType: string; tasks: Array<{ id: string; name: string; description: string; agent: string; dependsOn: string[]; approvalRequired: boolean }>; estimatedDuration: number }>('/orchestrator/plan', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

/* ============================================================
 * Pipeline introspection (agent + tool 13-step enforcement)
 * ============================================================ */

export function useAgentPipeline(options?: Partial<UseQueryOptions<{ steps: PipelineStep[]; total: number }>>) {
  return useQuery({
    queryKey: queryKeys.agentPipeline,
    queryFn: () => fetchAPI<{ steps: PipelineStep[]; total: number }>('/agents/pipeline'),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useToolPipeline(options?: Partial<UseQueryOptions<{ steps: PipelineStep[]; total: number }>>) {
  return useQuery({
    queryKey: queryKeys.toolsPipeline,
    queryFn: () => fetchAPI<{ steps: PipelineStep[]; total: number }>('/tools/pipeline'),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useRunAgentPipelineProbe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AgentPipelineProbeInput = {}) =>
      fetchAPI<AgentPipelineProbeResult>('/agents/pipeline/probe', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentPipeline });
      queryClient.invalidateQueries({ queryKey: queryKeys.audit });
    },
  });
}

/* ============================================================
 * Tools — registry, stats, sandboxed execution
 * ============================================================ */
