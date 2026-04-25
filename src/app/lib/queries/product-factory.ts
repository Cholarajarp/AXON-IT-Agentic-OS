import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { fetchAPI } from '../api-client';
import { defaultQueryOptions } from '../query-options';
import { queryKeys } from '../query-keys';
import type { ProductRequestInput, ServiceBlueprint, ServiceCatalogTemplate } from './contracts';

export function useProductCatalog(options?: Partial<UseQueryOptions<{ services: ServiceCatalogTemplate[] }>>) {
  return useQuery({
    queryKey: queryKeys.productCatalog,
    queryFn: () => fetchAPI<{ services: ServiceCatalogTemplate[] }>('/product-factory/catalog'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useProductBlueprints(options?: Partial<UseQueryOptions<{ blueprints: ServiceBlueprint[] }>>) {
  return useQuery({
    queryKey: queryKeys.productBlueprints,
    queryFn: () => fetchAPI<{ blueprints: ServiceBlueprint[] }>('/product-factory/blueprints'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateProductBlueprint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProductRequestInput) =>
      fetchAPI<ServiceBlueprint>('/product-factory/blueprints', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.productBlueprints });
      queryClient.setQueryData(queryKeys.productBlueprint(data.id), data);
    },
  });
}

export function useApproveProductBlueprint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchAPI<ServiceBlueprint>(`/product-factory/blueprints/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.productBlueprints });
      queryClient.setQueryData(queryKeys.productBlueprint(data.id), data);
    },
  });
}

export function useLaunchProductBlueprint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; workflowId?: string; budget?: number }) =>
      fetchAPI<{ blueprint: ServiceBlueprint; workflowId: string; dagId: string; tasks: number; message: string }>(
        `/product-factory/blueprints/${encodeURIComponent(input.id)}/execute`,
        {
          method: 'POST',
          body: JSON.stringify({ workflowId: input.workflowId, budget: input.budget }),
        },
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.productBlueprints });
      queryClient.invalidateQueries({ queryKey: queryKeys.orchestratorStatus });
      queryClient.setQueryData(queryKeys.productBlueprint(data.blueprint.id), data.blueprint);
    },
  });
}

/* ============================================================
 * Code Intelligence — workspace indexing and code navigation
 * ============================================================ */
