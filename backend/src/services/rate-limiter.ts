/**
 * Token-bucket rate limiter.
 *
 * Used by the agent runtime pipeline to cap how many executions a
 * (tenantId, agentName) pair can run in a rolling window. Pure in-memory;
 * a distributed deployment would swap this for Redis INCR with expiry.
 */

export interface RateLimitConfig {
  capacity: number;
  refillPerSecond: number;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillPerSecond: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private defaults: RateLimitConfig;

  constructor(defaults: RateLimitConfig = { capacity: 100, refillPerSecond: 100 / 60 }) {
    this.defaults = defaults;
  }

  /** Returns true if the request is allowed and decrements the bucket. */
  tryAcquire(key: string, config: RateLimitConfig = this.defaults): boolean {
    const bucket = this.getBucket(key, config);
    this.refill(bucket);
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  /** Introspection: how many tokens remain for a key, refilled to current time. */
  remaining(key: string, config: RateLimitConfig = this.defaults): number {
    const bucket = this.getBucket(key, config);
    this.refill(bucket);
    return Math.floor(bucket.tokens);
  }

  reset(key?: string) {
    if (key) this.buckets.delete(key);
    else this.buckets.clear();
  }

  private getBucket(key: string, config: RateLimitConfig): Bucket {
    let b = this.buckets.get(key);
    if (!b) {
      b = {
        tokens: config.capacity,
        lastRefill: Date.now(),
        capacity: config.capacity,
        refillPerSecond: config.refillPerSecond,
      };
      this.buckets.set(key, b);
    }
    return b;
  }

  private refill(bucket: Bucket) {
    const now = Date.now();
    const elapsedSec = (now - bucket.lastRefill) / 1000;
    if (elapsedSec <= 0) return;
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsedSec * bucket.refillPerSecond);
    bucket.lastRefill = now;
  }
}

export const rateLimiter = new RateLimiter();
