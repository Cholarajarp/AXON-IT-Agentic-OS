import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { fetchAPI } from '../api-client';
import { defaultQueryOptions } from '../query-options';
import { queryKeys } from '../query-keys';
import type {
  CheckpointScope,
  CompanyMissionMode,
  CompanyOperatingMission,
  CustomerAccount,
  DeliveryBrainDossier,
  DeliveryPricingModel,
  DeliveryReport,
  EnterpriseCapability,
  EnterpriseMarketSignal,
  EnterpriseReadiness,
  LearningSource,
  LearningSourceType,
  ManagedServiceAccount,
  ManagedServiceCoverage,
  ManagedServiceTower,
  ProjectCheckpoint,
  RoleSkillProfile,
  RollbackPreview,
  SecurityScanResult,
  ServiceDeskTicket,
  ServiceRequestStatus,
  SkillDomain,
  StructureScanResult,
  TeamSkillPlan,
  WorkMode,
  WorkforceControlPlane
} from './contracts';

export function useEnterpriseCapabilities(options?: Partial<UseQueryOptions<{ capabilities: EnterpriseCapability[]; marketSignals: EnterpriseMarketSignal[]; categories: string[] }>>) {
  return useQuery({
    queryKey: queryKeys.enterpriseCapabilities,
    queryFn: () => fetchAPI<{ capabilities: EnterpriseCapability[]; marketSignals: EnterpriseMarketSignal[]; categories: string[] }>('/enterprise-os/capabilities'),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useEnterpriseReadiness() {
  return useMutation({
    mutationFn: (input: Partial<{
      hasBlueprint: boolean;
      hasPreview: boolean;
      hasProvider: boolean;
      hasDatabaseReview: boolean;
      hasSecurityReview: boolean;
      hasDeploymentPlan: boolean;
      hasEvidence: boolean;
    }> = {}) =>
      fetchAPI<EnterpriseReadiness>('/enterprise-os/readiness', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

/* ============================================================
 * Security Center — publish safety scans
 * ============================================================ */

export function useRunSecurityScan() {
  return useMutation({
    mutationFn: (input: { maxFiles?: number } = {}) =>
      fetchAPI<SecurityScanResult>('/security-center/scan', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

/* ============================================================
 * Checkpoints — build snapshots and rollback previews
 * ============================================================ */

export function useCheckpoints(options?: Partial<UseQueryOptions<{ checkpoints: ProjectCheckpoint[] }>>) {
  return useQuery({
    queryKey: queryKeys.checkpoints,
    queryFn: () => fetchAPI<{ checkpoints: ProjectCheckpoint[] }>('/checkpoints'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateCheckpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      description?: string;
      scope?: CheckpointScope;
      workflowId?: string;
      blueprintId?: string;
      includePaths?: string[];
      metadata?: Record<string, unknown>;
    }) =>
      fetchAPI<ProjectCheckpoint>('/checkpoints', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.checkpoints }),
  });
}

export function usePreviewRollback() {
  return useMutation({
    mutationFn: (id: string) =>
      fetchAPI<RollbackPreview>(`/checkpoints/${encodeURIComponent(id)}/preview-rollback`, {
        method: 'POST',
      }),
  });
}

export function useMarkCheckpointRestored() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchAPI<ProjectCheckpoint>(`/checkpoints/${encodeURIComponent(id)}/mark-restored`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checkpoints });
      queryClient.setQueryData(queryKeys.checkpoint(data.id), data);
    },
  });
}

/* ============================================================
 * Service Desk — IT request intake and autonomous triage
 * ============================================================ */

export function useServiceDeskTickets(options?: Partial<UseQueryOptions<{ tickets: ServiceDeskTicket[] }>>) {
  return useQuery({
    queryKey: queryKeys.serviceDeskTickets,
    queryFn: () => fetchAPI<{ tickets: ServiceDeskTicket[] }>('/service-desk/tickets'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateServiceDeskTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      requester?: string;
      tenantId?: string;
      title?: string;
      request: string;
      affectedUsers?: number;
      system?: string;
      urgency?: 'low' | 'medium' | 'high' | 'critical';
      compliance?: string[];
    }) =>
      fetchAPI<ServiceDeskTicket>('/service-desk/tickets', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.serviceDeskTickets }),
  });
}

export function useUpdateServiceDeskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: ServiceRequestStatus }) =>
      fetchAPI<ServiceDeskTicket>(`/service-desk/tickets/${encodeURIComponent(input.id)}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: input.status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.serviceDeskTickets }),
  });
}

/* ============================================================
 * Managed Services — real IT operating model and CMDB seed
 * ============================================================ */

export function useManagedServiceCatalog(options?: Partial<UseQueryOptions<{ towers: Omit<ManagedServiceTower, 'id' | 'coverage' | 'criticality' | 'sla'>[] }>>) {
  return useQuery({
    queryKey: queryKeys.managedServiceCatalog,
    queryFn: () => fetchAPI<{ towers: Omit<ManagedServiceTower, 'id' | 'coverage' | 'criticality' | 'sla'>[] }>('/managed-services/catalog'),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useManagedServiceAccounts(options?: Partial<UseQueryOptions<{ accounts: ManagedServiceAccount[] }>>) {
  return useQuery({
    queryKey: queryKeys.managedServiceAccounts,
    queryFn: () => fetchAPI<{ accounts: ManagedServiceAccount[] }>('/managed-services/accounts'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateManagedServiceAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      customerName?: string;
      tenantId?: string;
      industry?: string;
      objective: string;
      appCount?: number;
      users?: number;
      cloudProviders?: string[];
      environments?: string[];
      compliance?: string[];
      painPoints?: string[];
      coverage?: ManagedServiceCoverage;
    }) =>
      fetchAPI<ManagedServiceAccount>('/managed-services/accounts', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.managedServiceAccounts });
      queryClient.setQueryData(queryKeys.managedServiceAccount(data.id), data);
    },
  });
}

/* ============================================================
 * Skill Academy — agent workforce, roles, and continuous learning
 * ============================================================ */

export function useSkillAcademyRoles(options?: Partial<UseQueryOptions<{ roles: RoleSkillProfile[] }>>) {
  return useQuery({
    queryKey: queryKeys.skillAcademyRoles,
    queryFn: () => fetchAPI<{ roles: RoleSkillProfile[] }>('/skill-academy/roles'),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useSkillAcademySources(options?: Partial<UseQueryOptions<{ sources: LearningSource[] }>>) {
  return useQuery({
    queryKey: queryKeys.skillAcademySources,
    queryFn: () => fetchAPI<{ sources: LearningSource[] }>('/skill-academy/sources'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useSkillAcademyPlans(options?: Partial<UseQueryOptions<{ plans: TeamSkillPlan[] }>>) {
  return useQuery({
    queryKey: queryKeys.skillAcademyPlans,
    queryFn: () => fetchAPI<{ plans: TeamSkillPlan[] }>('/skill-academy/plans'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateSkillAcademyPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tenantId?: string;
      objective: string;
      teamSize?: number;
      budgetUsdPerMonth?: number;
      deliveryMode?: TeamSkillPlan['deliveryMode'];
      currentMaturity?: 'starter' | 'growing' | 'enterprise';
      sources?: Array<{
        title?: string;
        url: string;
        type?: LearningSourceType;
        domains?: SkillDomain[];
        trust?: LearningSource['trust'];
      }>;
    }) =>
      fetchAPI<TeamSkillPlan>('/skill-academy/plans', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skillAcademyPlans });
      queryClient.invalidateQueries({ queryKey: queryKeys.skillAcademySources });
    },
  });
}

export function useAddLearningSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title?: string;
      url: string;
      type?: LearningSourceType;
      domains?: SkillDomain[];
      trust?: LearningSource['trust'];
    }) =>
      fetchAPI<LearningSource>('/skill-academy/sources', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.skillAcademySources }),
  });
}

/* ============================================================
 * Autonomous Workforce — 200k-agent control plane
 * ============================================================ */

export function useAutonomousWorkforcePlanes(options?: Partial<UseQueryOptions<{ controlPlanes: WorkforceControlPlane[] }>>) {
  return useQuery({
    queryKey: queryKeys.autonomousWorkforcePlanes,
    queryFn: () => fetchAPI<{ controlPlanes: WorkforceControlPlane[] }>('/autonomous-workforce/control-planes'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateAutonomousWorkforcePlane() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tenantId?: string;
      mission: string;
      targetAgentCount?: number;
      workMode?: WorkMode;
      monthlyBudgetUsd?: number;
      riskTolerance?: 'low' | 'medium' | 'high';
      regulated?: boolean;
      regions?: string[];
      customerSegments?: string[];
    }) =>
      fetchAPI<WorkforceControlPlane>('/autonomous-workforce/control-planes', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.autonomousWorkforcePlanes }),
  });
}

/* ============================================================
 * Company OS — integrated IT-company operating mission
 * ============================================================ */

export function useCompanyOsMissions(options?: Partial<UseQueryOptions<{ missions: CompanyOperatingMission[] }>>) {
  return useQuery({
    queryKey: queryKeys.companyOsMissions,
    queryFn: () => fetchAPI<{ missions: CompanyOperatingMission[] }>('/company-os/missions'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateCompanyOsMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tenantId?: string;
      companyName?: string;
      mission: string;
      mode?: CompanyMissionMode;
      targetAgentCount?: number;
      monthlyBudgetUsd?: number;
      regulated?: boolean;
      customerSegments?: string[];
      regions?: string[];
      cloudProviders?: string[];
      compliance?: string[];
    }) =>
      fetchAPI<CompanyOperatingMission>('/company-os/missions', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companyOsMissions });
      queryClient.invalidateQueries({ queryKey: queryKeys.autonomousWorkforcePlanes });
      queryClient.invalidateQueries({ queryKey: queryKeys.skillAcademyPlans });
      queryClient.invalidateQueries({ queryKey: queryKeys.managedServiceAccounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.productBlueprints });
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceDeskTickets });
    },
  });
}

/* ============================================================
 * Delivery Brain — source-backed enterprise product reasoning
 * ============================================================ */

export function useDeliveryBrainDossiers(options?: Partial<UseQueryOptions<{ dossiers: DeliveryBrainDossier[] }>>) {
  return useQuery({
    queryKey: queryKeys.deliveryBrainDossiers,
    queryFn: () => fetchAPI<{ dossiers: DeliveryBrainDossier[] }>('/delivery-brain/dossiers'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateDeliveryBrainDossier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tenantId?: string;
      mission: string;
      customerType?: string;
      regulated?: boolean;
      budgetUsd?: number;
      deadlineDays?: number;
      existingAnswers?: Record<string, string>;
    }) =>
      fetchAPI<DeliveryBrainDossier>('/delivery-brain/dossiers', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.deliveryBrainDossiers }),
  });
}

/* ============================================================
 * Structure Guardian — canonical source tree and cleanup policy
 * ============================================================ */

export function useRunStructureGuardianScan() {
  return useMutation({
    mutationFn: (input: { workspacePath?: string; includeNested?: boolean } = {}) =>
      fetchAPI<StructureScanResult>('/structure-guardian/scan', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

/* ============================================================
 * Customer Delivery — SOW, milestones, margin, reports, feedback
 * ============================================================ */

export function useCustomerDeliveryAccounts(options?: Partial<UseQueryOptions<{ accounts: CustomerAccount[] }>>) {
  return useQuery({
    queryKey: queryKeys.customerDeliveryAccounts,
    queryFn: () => fetchAPI<{ accounts: CustomerAccount[] }>('/customer-delivery/accounts'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateCustomerDeliveryAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tenantId?: string;
      customerName?: string;
      industry?: string;
      projectName?: string;
      request: string;
      pricingModel?: DeliveryPricingModel;
      budgetUsd?: number;
      timelineDays?: number;
      supportPlan?: CustomerAccount['supportPlan'];
      compliance?: string[];
      targetUsers?: string[];
      integrations?: string[];
    }) =>
      fetchAPI<CustomerAccount>('/customer-delivery/accounts', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customerDeliveryAccounts });
      queryClient.setQueryData(queryKeys.customerDeliveryAccount(data.id), data);
    },
  });
}

export function useGenerateCustomerDeliveryReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { accountId: string; projectId: string }) =>
      fetchAPI<DeliveryReport>(
        `/customer-delivery/accounts/${encodeURIComponent(input.accountId)}/projects/${encodeURIComponent(input.projectId)}/report`,
        { method: 'POST' },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.customerDeliveryAccounts }),
  });
}

/* ============================================================
 * API Forge — OpenAPI to SDKs, CLIs, MCP, docs-search, gates
 * ============================================================ */
