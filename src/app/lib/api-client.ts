import { createClientId } from './ids';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
const DEFAULT_TIMEOUT_MS = Number.parseInt(import.meta.env.VITE_API_TIMEOUT_MS ?? '30000', 10);

export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly endpoint: string,
    readonly requestId: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface FetchApiOptions extends RequestInit {
  timeoutMs?: number;
}

export async function fetchAPI<T>(endpoint: string, options: FetchApiOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers: initHeaders, signal, ...init } = options;
  const controller = new AbortController();
  const requestId = createRequestId();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort(signal?.reason);

  if (signal) {
    if (signal.aborted) abortFromCaller();
    else signal.addEventListener('abort', abortFromCaller, { once: true });
  }

  const headers = new Headers(initHeaders);
  const hasBody = init.body !== undefined && init.body !== null;
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (hasBody && !isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (!headers.has('X-Request-Id')) headers.set('X-Request-Id', requestId);

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      credentials: 'include',
      ...init,
      headers,
      signal: controller.signal,
    });

    if (response.status === 204) return undefined as T;

    const payload = await readResponsePayload(response);
    if (!response.ok) {
      const message = typeof payload === 'object' && payload && 'message' in payload
        ? String((payload as { message?: unknown }).message)
        : response.statusText || 'API request failed';
      throw new ApiError(message, response.status, endpoint, requestId, payload);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(`API request timed out after ${timeoutMs}ms`, 408, endpoint, requestId);
    }
    throw new ApiError(error instanceof Error ? error.message : 'Network request failed', 0, endpoint, requestId);
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

export function getApiBaseUrl() {
  return API_BASE;
}

async function readResponsePayload(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return response.json();
  const text = await response.text();
  return text ? { message: text } : {};
}

function createRequestId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : createClientId('req');
}
