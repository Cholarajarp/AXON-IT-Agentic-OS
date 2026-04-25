export const defaultQueryOptions = {
  retry: 2,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  staleTime: 30000,
  refetchOnWindowFocus: true,
};
