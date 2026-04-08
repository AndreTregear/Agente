/**
 * @yaya/queue-core — Shared BullMQ queue infrastructure.
 *
 * Consolidates Redis connections, queue/worker factories, rate limiting,
 * and scheduled job helpers into a single reusable package.
 */

// ── Redis ───────────────────────────────────────────────────────────────
export { getRedis, getRedisConnection, closeRedis } from './redis.js';

// ── Queue Factory ───────────────────────────────────────────────────────
export {
  createQueue,
  createWorker,
  QueueFactory,
  registerQueue,
  getQueueFactory,
  closeAllQueues,
  type QueueFactoryOptions,
} from './queue-factory.js';

// ── Rate & Concurrency Limiting ─────────────────────────────────────────
export {
  createRateLimiter,
  createConcurrencyLimiter,
  type RateLimiter,
  type RateLimiterOptions,
  type ConcurrencyLimiter,
  type ConcurrencyLimiterOptions,
} from './rate-limiter.js';

// ── Scheduled / Repeating Jobs ──────────────────────────────────────────
export {
  scheduleRepeating,
  removeScheduled,
  listScheduled,
  type ScheduleOptions,
} from './scheduled.js';

// ── Re-export BullMQ types for convenience ──────────────────────────────
export type { Job, Queue, Worker, JobsOptions, WorkerOptions, QueueOptions } from 'bullmq';
