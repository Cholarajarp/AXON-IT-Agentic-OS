import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorBoundary } from 'react-error-boundary';
import App from './app/App.tsx';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-s-base px-6 py-12 text-s-primary">
      <div className="w-full max-w-xl rounded-lg border border-s-border bg-s-surface p-6">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <pre className="mt-4 max-h-64 overflow-auto rounded-md border border-s-border bg-s-subtle p-3 font-mono text-[12px] text-s-secondary">
        {error.message}
        </pre>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 h-11 rounded-md bg-s-brand px-4 text-[14px] font-semibold text-white hover:bg-s-brand-dim"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-s-base px-6 text-s-primary">
      <div className="w-full max-w-sm rounded-lg border border-s-border bg-s-surface p-5">
        <div className="h-4 w-32 animate-pulse rounded bg-s-subtle" />
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-s-subtle" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-s-subtle" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-s-subtle" />
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<LoadingFallback />}>
            <App />
          </Suspense>
        </BrowserRouter>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
