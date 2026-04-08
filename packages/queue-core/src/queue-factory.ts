/**
 * BullMQ queue/worker factory with shared defaults.
 *
 * Consolidates the identical QueueFactory implementations from
 * packages/core and apps/health into a single reusable class.
 *
 * Features:
 * - Typed Queue and Worker creation
 * - Exponential backoff retries (configurable via QUEUE_MAX_RETRIES env)
 * - Auto-cleanup of completed/failed jobs
 * - Global registry for graceful shutdown
 * - Shared Redis connection from ./redis.ts
 */

import {
  Queue,
  Worker,
  type Job,
  type JobsOptions,
  type WorkerOptions,
  type QueueOptions,
} from 'bullmq';
import { getRedis } from './redis.js';

const RETRY_DELAY_MS = 5_000;

function getQueueConcurrency(): number {
  return Number(process.env.QUEUE_CONCURRENCY) || 5;
}

function getQueueMaxRetries(): number {
  return Number(process.env.QUEUE_MAX_RETRIES) || 3;
}

// ── Functional API ──────────────────────────────────────────────────────

/**
 * Create a BullMQ Queue with sensible defaults.
 * Uses the shared Redis connection and standard retry/cleanup config.
 */
export function createQueue<TData = unknown, TResult = unknown>(
  name: string,
  options?: Partial<QueueOptions> & { defaultJobOptions?: JobsOptions },
): Queue<TData, TResult> {
  const { defaultJobOptions, ...queueOpts } = options ?? {};

  const queue = new Queue<TData, TResult>(name, {
    connection: getRedis() as any,
    defaultJobOptions: {
      attempts: getQueueMaxRetries(),
      backoff: { type: 'exponential', delay: RETRY_DELAY_MS },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
      ...defaultJobOptions,
    },
    ...queueOpts,
  });

  return queue;
}

/**
 * Create a BullMQ Worker with sensible defaults.
 * Concurrency defaults to QUEUE_CONCURRENCY env var (default 5).
 */
export function createWorker<TData = unknown, TResult = unknown>(
  name: string,
  processor: (job: Job<TData, TResult>) => Promise<TResult>,
  options?: Partial<WorkerOptions>,
): Worker<TData, TResult> {
  const concurrency = options?.concurrency ?? getQueueConcurrency();

  const worker = new Worker<TData, TResult>(name, processor, {
    connection: getRedis() as any,
    concurrency,
    ...options,
  });

  return worker;
}

// ── Class-based API (backward-compatible) ───────────────────────────────

export interface QueueFactoryOptions {
  name: string;
  processor?: (job: Job) => Promise<unknown>;
  workerOptions?: Partial<WorkerOptions>;
  queueOptions?: Partial<QueueOptions>;
  defaultJobOptions?: JobsOptions;
  concurrency?: number;
}

export class QueueFactory {
  private name: string;
  private processor?: (job: Job) => Promise<unknown>;
  private workerOpts: Partial<WorkerOptions>;
  private queueOpts: Partial<QueueOptions>;
  private defaultJobOptions: JobsOptions;
  private concurrency: number;
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  constructor(options: QueueFactoryOptions) {
    this.name = options.name;
    this.processor = options.processor;
    this.workerOpts = options.workerOptions ?? {};
    this.queueOpts = options.queueOptions ?? {};
    this.defaultJobOptions = options.defaultJobOptions ?? {};
    this.concurrency = options.concurrency ?? getQueueConcurrency();
  }

  getQueue(): Queue {
    if (!this.queue) {
      this.queue = new Queue(this.name, {
        connection: getRedis() as any,
        defaultJobOptions: {
          attempts: getQueueMaxRetries(),
          backoff: { type: 'exponential', delay: RETRY_DELAY_MS },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
          ...this.defaultJobOptions,
        },
        ...this.queueOpts,
      });
    }
    return this.queue;
  }

  getWorker(): Worker | null {
    if (!this.processor) return null;
    if (!this.worker) {
      this.worker = new Worker(
        this.name,
        async (job) => this.processor!(job),
        {
          connection: getRedis() as any,
          concurrency: this.concurrency,
          ...this.workerOpts,
        },
      );
    }
    return this.worker;
  }

  async add(jobName: string, data: unknown, opts?: JobsOptions): Promise<Job> {
    return this.getQueue().add(jobName, data, opts);
  }

  async addBulk(
    jobs: { name: string; data: unknown; opts?: JobsOptions }[],
  ): Promise<Job[]> {
    return this.getQueue().addBulk(jobs);
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
  }
}

// ── Global Registry ─────────────────────────────────────────────────────

const queueRegistry = new Map<string, QueueFactory>();

export function registerQueue(name: string, factory: QueueFactory): void {
  queueRegistry.set(name, factory);
}

export function getQueueFactory(name: string): QueueFactory | undefined {
  return queueRegistry.get(name);
}

/**
 * Close all registered queues. Call during graceful shutdown.
 */
export async function closeAllQueues(): Promise<void> {
  for (const [, factory] of queueRegistry) {
    await factory.close();
  }
  queueRegistry.clear();
}
