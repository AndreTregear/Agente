/**
 * Redis connection for swarm infrastructure.
 *
 * Provides a shared, lazy-initialized IORedis instance configured for
 * BullMQ compatibility. Mirrors the pattern from @yaya/queue-core.
 *
 * Configure via REDIS_URL env var (default: redis://localhost:6379).
 */

import IORedis from 'ioredis';

const DEFAULT_REDIS_URL = 'redis://localhost:6379';

let redis: IORedis.Redis | null = null;

/**
 * Get or create the shared Redis connection for swarm queues.
 * BullMQ requires maxRetriesPerRequest: null and enableReadyCheck: false.
 */
export function getConnection(): IORedis.Redis {
  if (!redis) {
    const url = process.env.REDIS_URL || DEFAULT_REDIS_URL;
    // Handle CJS/ESM interop — some bundlers wrap the default export
    const RedisConstructor = (IORedis as any).default || IORedis;
    redis = new RedisConstructor(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    }) as IORedis.Redis;

    redis.on('error', (err: Error) => {
      console.error('[swarm] Redis connection error:', err.message);
    });
  }
  return redis;
}

/**
 * Initialize with an external Redis connection (e.g. from @yaya/queue-core).
 * Call this before any swarm operations if you want to share a connection.
 */
export function setConnection(external: IORedis.Redis): void {
  redis = external;
}

/**
 * Close the Redis connection. Call during graceful shutdown.
 */
export async function closeConnection(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
