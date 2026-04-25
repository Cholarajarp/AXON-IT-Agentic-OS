import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { fetchAPI } from '../api-client';
import { defaultQueryOptions } from '../query-options';
import { queryKeys } from '../query-keys';
import type {
  CodeAnalysis,
  CodeIndexResult,
  CodeIndexStatus,
  CodePattern,
  CodeSearchResult,
  CodeSymbol,
  DatabasePolicy,
  DatabaseReviewInput,
  DatabaseReviewResult
} from './contracts';

export function useCodeIndexStatus(workspaceId = 'local', options?: Partial<UseQueryOptions<CodeIndexStatus>>) {
  return useQuery({
    queryKey: queryKeys.codeStatus(workspaceId),
    queryFn: () => fetchAPI<CodeIndexStatus>(`/code-intelligence/status?workspaceId=${encodeURIComponent(workspaceId)}`),
    refetchInterval: (query) => (query.state.data?.inProgress ? 1000 : false),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useIndexWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { workspaceId?: string; workspacePath?: string } = {}) =>
      fetchAPI<CodeIndexResult>('/code-intelligence/index', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: input.workspaceId ?? 'local', workspacePath: input.workspacePath }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.codeStatus(data.workspaceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.codePatterns(data.workspaceId) });
    },
  });
}

export function useSearchCode() {
  return useMutation({
    mutationFn: (input: {
      query: string;
      workspaceId?: string;
      limit?: number;
      offset?: number;
      fileTypes?: string[];
      directories?: string[];
      semantic?: boolean;
    }) =>
      fetchAPI<{ query: string; workspaceId: string; results: CodeSearchResult[] }>('/code-intelligence/search', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: 'local', limit: 30, ...input }),
      }),
  });
}

export function useCodeSymbols(workspaceId: string, filePath: string, options?: Partial<UseQueryOptions<{ symbols: CodeSymbol[]; edges: unknown[] }>>) {
  return useQuery({
    queryKey: queryKeys.codeSymbols(workspaceId, filePath),
    queryFn: () =>
      fetchAPI<{ symbols: CodeSymbol[]; edges: unknown[] }>(
        `/code-intelligence/symbols?workspaceId=${encodeURIComponent(workspaceId)}&filePath=${encodeURIComponent(filePath)}`,
      ),
    enabled: Boolean(workspaceId && filePath),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCodeAnalysis(workspaceId: string, filePath: string, options?: Partial<UseQueryOptions<CodeAnalysis>>) {
  return useQuery({
    queryKey: queryKeys.codeAnalysis(workspaceId, filePath),
    queryFn: () =>
      fetchAPI<CodeAnalysis>(
        `/code-intelligence/analyze?workspaceId=${encodeURIComponent(workspaceId)}&filePath=${encodeURIComponent(filePath)}`,
      ),
    enabled: Boolean(workspaceId && filePath),
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCodePatterns(workspaceId: string, options?: Partial<UseQueryOptions<{ workspaceId: string; patterns: CodePattern[] }>>) {
  return useQuery({
    queryKey: queryKeys.codePatterns(workspaceId),
    queryFn: () =>
      fetchAPI<{ workspaceId: string; patterns: CodePattern[] }>(
        `/code-intelligence/patterns?workspaceId=${encodeURIComponent(workspaceId)}`,
      ),
    enabled: Boolean(workspaceId),
    ...defaultQueryOptions,
    ...options,
  });
}

/* ============================================================
 * Database Pipeline — safe schema/data migrations
 * ============================================================ */

export function useDatabasePolicies(options?: Partial<UseQueryOptions<{ policies: DatabasePolicy[] }>>) {
  return useQuery({
    queryKey: queryKeys.databasePolicies,
    queryFn: () => fetchAPI<{ policies: DatabasePolicy[] }>('/database-pipeline/policies'),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useReviewDatabaseMigration() {
  return useMutation({
    mutationFn: (input: DatabaseReviewInput) =>
      fetchAPI<DatabaseReviewResult>('/database-pipeline/review', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

/* ============================================================
 * Enterprise OS — market-aware readiness and launch gates
 * ============================================================ */
