import { createHash } from 'node:crypto';
import type { ModelRequest, ModelResponse } from './types.js';

/**
 * Response cache for deterministic, cheap replay.
 *
 * Why this matters:
 *   - Agent retries should not double-bill the cost ledger.
 *   - Eval lab replays the same fixture set hundreds of times; we pay once.
 *   - In dev, the mock provider + cache = instant feedback.
 *
 * Semantics:
 *   - Cache key = sha256(provider? + model? + taskType + temperature + messages).
 *   - Temperature > 0 bypasses the cache by default (non-deterministic output).
 *   - TTL is a soft cap; entries are also evicted LRU-style beyond maxEntries.
 */

export interface CacheOptions {
  maxEntries?: number;
  ttlMs?: number;
}

interface Entry {
  response: ModelResponse;
  expiresAt: number;
}

export class ResponseCache {
  private store = new Map<string, Entry>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(options: CacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? 512;
    this.ttlMs = options.ttlMs ?? 15 * 60 * 1000;
  }

  keyFor(request: ModelRequest): string | null {
    // Non-deterministic requests are intentionally uncacheable.
    if ((request.temperature ?? 0) > 0) return null;

    const payload = JSON.stringify({
      model: request.model ?? null,
      taskType: request.taskType ?? null,
      messages: request.messages,
      maxTokens: request.maxTokens ?? null,
      sovereignMode: request.sovereignMode ?? false,
      sensitivityLevel: request.sensitivityLevel ?? null,
    });
    return createHash('sha256').update(payload).digest('hex');
  }

  get(request: ModelRequest): ModelResponse | null {
    const key = this.keyFor(request);
    if (!key) return null;

    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    // LRU refresh
    this.store.delete(key);
    this.store.set(key, entry);
    return { ...entry.response, cached: true };
  }

  set(request: ModelRequest, response: ModelResponse): void {
    const key = this.keyFor(request);
    if (!key) return;

    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }

    this.store.set(key, {
      response: { ...response, cached: false },
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}
