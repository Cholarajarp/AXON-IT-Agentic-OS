import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { fetchAPI, getApiBaseUrl } from '../api-client';
import { defaultQueryOptions } from '../query-options';
import { queryKeys } from '../query-keys';
import type { ToolDefinition, ToolExecuteInput, ToolRuntimeResult, ToolStats } from './contracts';

export function useToolsRegistry(options?: Partial<UseQueryOptions<{ tools: ToolDefinition[] }>>) {
  return useQuery({
    queryKey: queryKeys.toolsRegistry,
    queryFn: () => fetchAPI<{ tools: ToolDefinition[] }>('/tools/registry'),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useToolsStats(options?: Partial<UseQueryOptions<ToolStats>>) {
  return useQuery({
    queryKey: queryKeys.toolsStats,
    queryFn: () => fetchAPI<ToolStats>('/tools/stats'),
    refetchInterval: 5000,
    ...defaultQueryOptions,
    ...options,
  });
}

export function useExecuteTool() {
  const queryClient = useQueryClient();
  return useMutation({
    // Accept 2xx (success) and 4xx/5xx (denied/failed) as structured results.
    // fetchAPI throws on !ok so we bypass it here and parse the body either way.
    mutationFn: async (input: ToolExecuteInput): Promise<ToolRuntimeResult> => {
      const response = await fetch(`${getApiBaseUrl()}/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = (await response.json()) as ToolRuntimeResult | { error: string; message: string };
      if ('error' in body && !('executionId' in body)) {
        throw new Error(body.message || body.error);
      }
      return body as ToolRuntimeResult;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.toolsStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.audit });
    },
  });
}

/* ============================================================
 * Product Factory — service catalog and blueprints
 * ============================================================ */
