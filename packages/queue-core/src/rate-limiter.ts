/**
 * Distributed rate limiter and concurrency limiter using Redis.
 *
 * Uses sorted sets with Lua scripts for atomic sliding-window operations.
 * Consolidates the duplicated implementations from packages/core and apps/health.
 *
 * Two patterns:
 * 1. Rate limiter  — sliding window counter (e.g., 30 req/min per tenant)
 * 2. Concurrency limiter — slot-based with auto-cleanup of stale entries
 *
 * Both are created via a factory function so callers can configure
 * prefix, limits, and windows without relying on hardcoded env vars.
 */

import { getRedis } from './redis.js';

// ── Types ───────────────────────────────────────────────────────────────

export interface RateLimiterOptions {
  /** Max requests allowed within the window */
  maxPerWindow: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Redis key prefix (e.g., "ratelimit", "scraper-domain") */
  prefix: string;
}

export interface RateLimiter {
  /**
   * Check if a key is within the rate limit WITHOUT consuming a slot.
   * Returns true if under the limit.
   */
  check(key: string): Promise<boolean>;
  /**
   * Atomically check and consume a slot. Returns true if allowed.
   */
  acquire(key: string): Promise<boolean>;
  /**
   * Get current usage for monitoring.
   */
  status(key: string): Promise<{ current: number; limit: number; windowMs: number }>;
}

export interface ConcurrencyLimiterOptions {
  /** Max concurrent slots */
  maxSlots: number;
  /** Time after which a slot is considered stale and auto-released (ms) */
  staleMs?: number;
  /** Redis key prefix (e.g., "concurrency") */
  prefix: string;
}

export interface ConcurrencyLimiter {
  /**
   * Try to acquire a concurrency slot. Returns true if a slot was acquired.
   */
  acquire(key: string, slotId: string): Promise<boolean>;
  /**
   * Release a concurrency slot after work is done.
   */
  release(key: string, slotId: string): Promise<void>;
}

// ── Lua Scripts ─────────────────────────────────────────────────────────

/**
 * Sliding window rate limit check + acquire.
 * KEYS[1] = sorted set key
 * ARGV[1] = now (ms)
 * ARGV[2] = windowStart (ms)
 * ARGV[3] = limit
 * ARGV[4] = windowSec (for EXPIRE)
 */
const RATE_LIMIT_LUA = `
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local windowStart = tonumber(ARGV[2])
  local limit = tonumber(ARGV[3])
  local windowSec = tonumber(ARGV[4])

  -- Remove entries outside the window
  redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

  local count = redis.call('ZCARD', key)

  if count < limit then
    redis.call('ZADD', key, now, now .. '-' .. math.random(1000000))
    redis.call('EXPIRE', key, windowSec + 1)
    return 1
  else
    return 0
  end
`;

/**
 * Concurrency slot acquire.
 * KEYS[1] = sorted set key
 * ARGV[1] = now (ms)
 * ARGV[2] = staleThreshold (ms)
 * ARGV[3] = limit
 * ARGV[4] = slotId
 */
const CONCURRENCY_ACQUIRE_LUA = `
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local staleThreshold = tonumber(ARGV[2])
  local limit = tonumber(ARGV[3])
  local slotId = ARGV[4]

  -- Clean stale entries (dead jobs)
  redis.call('ZREMRANGEBYSCORE', key, '-inf', staleThreshold)

  local count = redis.call('ZCARD', key)

  if count < limit then
    redis.call('ZADD', key, now, slotId)
    redis.call('EXPIRE', key, 600)
    return 1
  else
    return 0
  end
`;

// ── Factories ───────────────────────────────────────────────────────────

/**
 * Create a sliding-window rate limiter backed by Redis sorted sets.
 *
 * Usage:
 *   const limiter = createRateLimiter({ maxPerWindow: 30, windowMs: 60_000, prefix: 'ratelimit' });
 *   if (await limiter.acquire(tenantId)) { /* allowed * / }
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { maxPerWindow, windowMs, prefix } = options;
  const windowSec = Math.ceil(windowMs / 1000);

  function redisKey(key: string): string {
    return `${prefix}:${key}`;
  }

  return {
    async check(key: string): Promise<boolean> {
      const redis = getRedis();
      const rk = redisKey(key);
      const windowStart = Date.now() - windowMs;
      await redis.zremrangebyscore(rk, '-inf', windowStart);
      const count = await redis.zcard(rk);
      return count < maxPerWindow;
    },

    async acquire(key: string): Promise<boolean> {
      const redis = getRedis();
      const rk = redisKey(key);
      const now = Date.now();
      const windowStart = now - windowMs;
      const result = await redis.eval(
        RATE_LIMIT_LUA,
        1,
        rk,
        now,
        windowStart,
        maxPerWindow,
        windowSec,
      );
      return result === 1;
    },

    async status(key: string) {
      const redis = getRedis();
      const rk = redisKey(key);
      const windowStart = Date.now() - windowMs;
      await redis.zremrangebyscore(rk, '-inf', windowStart);
      const current = await redis.zcard(rk);
      return { current, limit: maxPerWindow, windowMs };
    },
  };
}

/**
 * Create a concurrency limiter backed by Redis sorted sets.
 * Stale entries are automatically cleaned up.
 *
 * Usage:
 *   const slots = createConcurrencyLimiter({ maxSlots: 5, prefix: 'concurrency' });
 *   if (await slots.acquire(tenantId, jobId)) {
 *     try { await doWork(); } finally { await slots.release(tenantId, jobId); }
 *   }
 */
export function createConcurrencyLimiter(
  options: ConcurrencyLimiterOptions,
): ConcurrencyLimiter {
  const { maxSlots, prefix } = options;
  const staleMs = options.staleMs ?? 5 * 60 * 1000; // 5 min default

  function redisKey(key: string): string {
    return `${prefix}:${key}`;
  }

  return {
    async acquire(key: string, slotId: string): Promise<boolean> {
      const redis = getRedis();
      const rk = redisKey(key);
      const now = Date.now();
      const staleThreshold = now - staleMs;
      const result = await redis.eval(
        CONCURRENCY_ACQUIRE_LUA,
        1,
        rk,
        now,
        staleThreshold,
        maxSlots,
        slotId,
      );
      return result === 1;
    },

    async release(key: string, slotId: string): Promise<void> {
      try {
        const redis = getRedis();
        await redis.zrem(redisKey(key), slotId);
      } catch {
        // Best-effort — stale entries auto-cleanup via Lua script
      }
    },
  };
}
