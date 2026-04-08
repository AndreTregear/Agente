/**
 * BullMQ queue for scrape jobs.
 * Queue name: 'yaya-scraper'
 */

import { Queue, Worker, type Job, type WorkerOptions } from 'bullmq';
import IORedis from 'ioredis';
import type { ScrapeRequest, ScrapeResult } from './types.js';

export const SCRAPER_QUEUE_NAME = 'yaya-scraper';
const SCRAPER_CONCURRENCY = Number(process.env.SCRAPER_CONCURRENCY) || 5;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redisConnection: any = null;

function getRedis(): any {
  if (!redisConnection) {
    const RedisConstructor = (IORedis as any).default || IORedis;
    redisConnection = new RedisConstructor(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }
  return redisConnection;
}

let scraperQueue: Queue<ScrapeRequest, ScrapeResult> | null = null;

/**
 * Get or create the scraper BullMQ queue (producer side).
 */
export function getScraperQueue(): Queue<ScrapeRequest, ScrapeResult> {
  if (!scraperQueue) {
    scraperQueue = new Queue<ScrapeRequest, ScrapeResult>(SCRAPER_QUEUE_NAME, {
      connection: getRedis() as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return scraperQueue;
}

/**
 * Enqueue a scrape request.
 * Returns the BullMQ Job so callers can await the result.
 */
export async function enqueueScrape(
  request: ScrapeRequest,
): Promise<Job<ScrapeRequest, ScrapeResult>> {
  const queue = getScraperQueue();
  return queue.add('scrape', request, {
    priority: request.priority ?? 5,
  });
}

/**
 * Create a BullMQ Worker that processes scrape jobs.
 * The processor function receives a Job and should return a ScrapeResult.
 */
export function createScrapeWorker(
  processor: (job: Job<ScrapeRequest, ScrapeResult>) => Promise<ScrapeResult>,
  options?: Partial<WorkerOptions>,
): Worker<ScrapeRequest, ScrapeResult> {
  return new Worker<ScrapeRequest, ScrapeResult>(
    SCRAPER_QUEUE_NAME,
    processor,
    {
      connection: getRedis() as any,
      concurrency: SCRAPER_CONCURRENCY,
      ...options,
    },
  );
}

/**
 * Close queue and Redis connections.
 */
export async function closeQueue(): Promise<void> {
  if (scraperQueue) {
    await scraperQueue.close();
    scraperQueue = null;
  }
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
}
