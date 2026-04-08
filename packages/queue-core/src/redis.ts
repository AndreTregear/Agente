/**
 * Redis connection singleton for BullMQ and rate limiting.
 *
 * Provides a shared, lazy-initialized IORedis instance configured for
 * BullMQ compatibility (maxRetriesPerRequest: null, enableReadyCheck: false).
 *
 * Configure via REDIS_URL env var (default: redis://localhost:6379).
 */

import IORedis from 'ioredis';

const DEFAULT_REDIS_URL = 'redis://localhost:6379';

// Use IORedis.Redis for proper typing; fall back to any for interop
type RedisInstance = IORedis.Redis;

let redis: RedisInstance | null = null;

/**
 * Get or create the shared Redis connection.
 * BullMQ requires maxRetriesPerRequest: null and enableReadyCheck: false.
 */
export function getRedis(): RedisInstance {
  if (!redis) {
    const url = process.env.REDIS_URL || DEFAULT_REDIS_URL;
    // Handle CJS/ESM interop — some bundlers wrap the default export
    const RedisConstructor = (IORedis as any).default || IORedis;
    redis = new RedisConstructor(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    }) as RedisInstance;

    redis.on('error', (err: Error) => {
      console.error('[queue-core] Redis connection error:', err.message);
    });
  }
  return redis;
}

/**
 * Alias for backward compatibility.
 */
export const getRedisConnection = getRedis;

/**
 * Gracefully close the Redis connection.
 * Call during process shutdown.
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
