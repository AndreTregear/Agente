/**
 * BullMQ queue/worker factory for Yaya Salud.
 * Generic pattern: create queues and workers with shared defaults.
 */

import { Queue, Worker, type Job, type JobsOptions, type WorkerOptions, type QueueOptions } from 'bullmq';
import { getRedis } from './redis.js';
import { QUEUE_CONCURRENCY, QUEUE_MAX_RETRIES } from '../config.js';
import { logger } from '../shared/logger.js';

const RETRY_DELAY_MS = 5_000;

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
    this.concurrency = options.concurrency ?? QUEUE_CONCURRENCY;
  }

  getQueue(): Queue {
    if (!this.queue) {
      this.queue = new Queue(this.name, {
        connection: getRedis() as any,
        defaultJobOptions: {
          attempts: QUEUE_MAX_RETRIES,
          backoff: { type: 'exponential', delay: RETRY_DELAY_MS },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
          ...this.defaultJobOptions,
        },
        ...this.queueOpts,
      });
      logger.debug({ queue: this.name }, 'Queue initialized');
    }
    return this.queue;
  }

  getWorker(): Worker | null {
    if (!this.processor) return null;
    if (!this.worker) {
      this.worker = new Worker(
        this.name,
        async (job) => {
          logger.info({ queue: this.name, jobId: job.id, attempt: job.attemptsMade + 1 }, 'Processing job');
          return this.processor!(job);
        },
        {
          connection: getRedis() as any,
          concurrency: this.concurrency,
          ...this.workerOpts,
        },
      );
      logger.info({ queue: this.name, concurrency: this.concurrency }, 'Worker initialized');
    }
    return this.worker;
  }

  async add(jobName: string, data: unknown, opts?: JobsOptions): Promise<Job> {
    return this.getQueue().add(jobName, data, opts);
  }

  async addBulk(jobs: { name: string; data: unknown; opts?: JobsOptions }[]): Promise<Job[]> {
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

// Global registry
const queueRegistry = new Map<string, QueueFactory>();

export function registerQueue(name: string, factory: QueueFactory): void {
  queueRegistry.set(name, factory);
}

export function getQueueFactory(name: string): QueueFactory | undefined {
  return queueRegistry.get(name);
}

export async function closeAllQueues(): Promise<void> {
  logger.info('Closing all queues...');
  for (const [name, factory] of queueRegistry) {
    await factory.close();
    logger.debug({ queue: name }, 'Queue closed');
  }
  queueRegistry.clear();
}
