#!/usr/bin/env node
/**
 * Scraper Worker
 * BullMQ worker that processes scrape jobs from the 'yaya-scraper' queue.
 *
 * Runs OUTSIDE the NemoClaw sandbox — has internet access.
 *
 * Environment variables:
 *   REDIS_URL          — Redis connection string (default: redis://localhost:6379)
 *   DATABASE_URL       — PostgreSQL connection for cache
 *   SCRAPER_DATABASE_URL — PostgreSQL connection for cache (overrides DATABASE_URL)
 */

import pino from 'pino';
import type { Job } from 'bullmq';
import {
  createScrapeWorker,
  scrapeUrl,
  ensureCacheTable,
  closeQueue,
  closeCache,
  type ScrapeRequest,
  type ScrapeResult,
} from '@yaya/scraper';

const logger = pino({ name: 'scraper-worker' });

async function processJob(
  job: Job<ScrapeRequest, ScrapeResult>,
): Promise<ScrapeResult> {
  logger.info(
    { jobId: job.id, url: job.data.url, attempt: job.attemptsMade + 1 },
    'Processing scrape job',
  );

  const result = await scrapeUrl(job.data);

  // Attach jobId to result
  result.jobId = job.id;

  logger.info(
    {
      jobId: job.id,
      url: result.url,
      cached: result.cached,
      contentLen: result.content.length,
    },
    'Scrape job complete',
  );

  return result;
}

async function main(): Promise<void> {
  logger.info('Starting scraper worker...');

  // Ensure cache table exists
  try {
    await ensureCacheTable();
  } catch (err) {
    logger.warn(
      { err },
      'Could not ensure cache table — caching may be unavailable',
    );
  }

  // Create the worker
  const worker = createScrapeWorker(processJob);

  worker.on('completed', (job) => {
    logger.debug({ jobId: job?.id }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, err: err.message },
      'Job failed',
    );
  });

  worker.on('error', (err) => {
    logger.error({ err: err.message }, 'Worker error');
  });

  logger.info('Scraper worker running. Waiting for jobs...');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal');

    try {
      await worker.close();
      logger.info('Worker closed');
    } catch (err) {
      logger.error({ err }, 'Error closing worker');
    }

    try {
      await closeQueue();
      logger.info('Queue connections closed');
    } catch (err) {
      logger.error({ err }, 'Error closing queue');
    }

    try {
      await closeCache();
      logger.info('Cache pool closed');
    } catch (err) {
      logger.error({ err }, 'Error closing cache pool');
    }

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Scraper worker crashed');
  process.exit(1);
});
