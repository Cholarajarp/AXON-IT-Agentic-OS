import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAPI, getApiBaseUrl } from '../api-client';
import { queryKeys } from '../query-keys';
import type { ModelInvokeRequest, ModelInvokeResponse } from './contracts';

export function useInvokeModel() {
  return useMutation({
    mutationFn: (request: ModelInvokeRequest) =>
      fetchAPI<ModelInvokeResponse>('/models/invoke', {
        method: 'POST',
        body: JSON.stringify(request),
      }),
  });
}

export function useRefreshModelHealth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchAPI<{ results: Array<{ name: string; healthy: boolean }>; timestamp: number }>(
        '/models/health/refresh',
        { method: 'POST' },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.modelRuntimeStatus });
    },
  });
}

/**
 * Stream a completion from POST /models/invoke/stream.
 *
 * Parses Server-Sent Events with the backend's event names:
 *   event: meta        — provider/model/cached flags
 *   event: chunk       — { delta: string }
 *   event: done        — final token + cost totals
 *   event: error       — aborts the stream
 *
 * Returns a cleanup function that aborts the underlying fetch.
 */

export function streamCompletion(
  request: ModelInvokeRequest,
  handlers: {
    onMeta?: (meta: { provider: string; model: string; cached: boolean }) => void;
    onChunk?: (delta: string) => void;
    onDone?: (summary: { tokensIn: number; tokensOut: number; cost: number; latencyMs: number }) => void;
    onError?: (message: string) => void;
  },
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/models/invoke/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => response.statusText);
        handlers.onError?.(text || `Stream failed: ${response.status}`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line.
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          parseFrame(frame, handlers);
          boundary = buffer.indexOf('\n\n');
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        handlers.onError?.((err as Error).message);
      }
    }
  })();

  return () => controller.abort();
}

function parseFrame(
  frame: string,
  handlers: Parameters<typeof streamCompletion>[1],
): void {
  let eventName = 'message';
  let dataLine = '';

  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLine += line.slice(5).trim();
  }

  if (!dataLine) return;

  let payload: unknown;
  try {
    payload = JSON.parse(dataLine);
  } catch {
    return;
  }

  switch (eventName) {
    case 'meta':
      handlers.onMeta?.(payload as { provider: string; model: string; cached: boolean });
      break;
    case 'chunk': {
      const d = payload as { delta?: string };
      if (typeof d.delta === 'string') handlers.onChunk?.(d.delta);
      break;
    }
    case 'done':
      handlers.onDone?.(payload as { tokensIn: number; tokensOut: number; cost: number; latencyMs: number });
      break;
    case 'error':
      handlers.onError?.((payload as { message?: string }).message ?? 'Stream error');
      break;
  }
}
