/**
 * Per-tenant rate limiter and AI concurrency limiter for Yaya Salud.
 * Uses Redis sorted sets with Lua scripts for atomic operations.
 * Simplified from yaya_platform — uses env vars instead of settings-repo.
 */

import { getRedis } from './redis.js';
import { logger } from '../shared/logger.js';

// Defaults (override via env vars)
const DEFAULT_RATE_LIMIT = Number(process.env.HEALTH_RATE_LIMIT) || 30;
const DEFAULT_RATE_WINDOW_SEC = Number(process.env.HEALTH_RATE_WINDOW_SEC) || 60;
const DEFAULT_AI_CONCURRENCY = Number(process.env.HEALTH_AI_CONCURRENCY) || 5;
const CONCURRENCY_STALE_MS = 5 * 60 * 1000; // 5 min — auto-cleanup dead entries

/**
 * Check if a tenant is within their rate limit.
 * Returns true if allowed, false if rate-limited.
 * Atomically increments the counter if allowed.
 */
export async function checkAndIncrementRateLimit(tenantId: string): Promise<boolean> {
  const redis = getRedis();
  const limit = DEFAULT_RATE_LIMIT;
  const windowSec = DEFAULT_RATE_WINDOW_SEC;

  const key = `ratelimit:${tenantId}`;
  const now = Date.now();
  const windowStart = now - (windowSec * 1000);

  const luaScript = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local windowStart = tonumber(ARGV[2])
    local limit = tonumber(ARGV[3])
    local windowSec = tonumber(ARGV[4])

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

  const result = await redis.eval(luaScript, 1, key, now, windowStart, limit, windowSec);
  if (result === 0) {
    logger.warn({ tenantId, limit, windowSec }, 'Rate limit exceeded');
  }
  return result === 1;
}

/**
 * Get current rate limit usage for monitoring.
 */
export async function getRateLimitStatus(tenantId: string): Promise<{
  current: number;
  limit: number;
  windowSec: number;
}> {
  const redis = getRedis();
  const limit = DEFAULT_RATE_LIMIT;
  const windowSec = DEFAULT_RATE_WINDOW_SEC;

  const key = `ratelimit:${tenantId}`;
  const windowStart = Date.now() - (windowSec * 1000);

  await redis.zremrangebyscore(key, '-inf', windowStart);
  const current = await redis.zcard(key);

  return { current, limit, windowSec };
}

// ---- Per-Tenant AI Concurrency Limiter ----

/**
 * Try to acquire a concurrency slot for a tenant.
 * Returns true if a slot is available, false if at capacity.
 */
export async function acquireTenantSlot(tenantId: string, jobId: string): Promise<boolean> {
  const redis = getRedis();
  const limit = DEFAULT_AI_CONCURRENCY;
  const key = `concurrency:${tenantId}`;
  const now = Date.now();
  const staleThreshold = now - CONCURRENCY_STALE_MS;

  const luaScript = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local staleThreshold = tonumber(ARGV[2])
    local limit = tonumber(ARGV[3])
    local jobId = ARGV[4]

    -- Clean stale entries (dead jobs older than 5 min)
    redis.call('ZREMRANGEBYSCORE', key, '-inf', staleThreshold)

    local count = redis.call('ZCARD', key)

    if count < limit then
      redis.call('ZADD', key, now, jobId)
      redis.call('EXPIRE', key, 600)
      return 1
    else
      return 0
    end
  `;

  const result = await redis.eval(luaScript, 1, key, now, staleThreshold, limit, jobId);
  return result === 1;
}

/**
 * Release a concurrency slot after job completion.
 */
export async function releaseTenantSlot(tenantId: string, jobId: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.zrem(`concurrency:${tenantId}`, jobId);
  } catch {
    // Best-effort — stale entries auto-cleanup via Lua script
  }
}
