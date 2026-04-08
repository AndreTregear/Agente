import type { Job } from 'bullmq';
import { query } from '../db/pool.js';
import { QueueFactory, registerQueue } from '../queue/queue-factory.js';
import { logger } from '../shared/logger.js';

export const PARTITION_QUEUE_NAME = 'yaya:partitions';

const PARTITION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

const PARTITIONED_TABLES = [
  'wh_fact_interactions',
  'wh_fact_transactions',
  'wh_fact_ai_sessions',
];

/**
 * Ensure monthly partitions exist for the next N months.
 * Creates partitions like: wh_fact_interactions_2026_03
 */
export async function ensurePartitions(monthsAhead: number = 3): Promise<void> {
  const now = new Date();

  for (const table of PARTITIONED_TABLES) {
    for (let offset = -1; offset <= monthsAhead; offset++) {
      const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const nextDate = new Date(date.getFullYear(), date.getMonth() + 1, 1);

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const partitionName = `${table}_${year}_${month}`;

      const from = date.toISOString().split('T')[0];
      const to = nextDate.toISOString().split('T')[0];

      try {
        await query(
          `CREATE TABLE IF NOT EXISTS ${partitionName}
           PARTITION OF ${table}
           FOR VALUES FROM ('${from}') TO ('${to}')`,
        );
      } catch (err: unknown) {
        // Partition may already exist or overlap — safe to ignore
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('already exists') && !msg.includes('overlap')) {
          logger.warn({ table, partitionName, err }, 'Failed to create partition');
        }
      }
    }
  }

  logger.info({ tables: PARTITIONED_TABLES.length, monthsAhead }, 'Warehouse partitions verified');
}

// ── BullMQ-based Partition Scheduler ──

async function processPartitionJob(job: Job): Promise<void> {
  logger.info({ jobId: job.id }, 'Partition maintenance job triggered');
  await ensurePartitions();
}

const partitionQueueFactory = new QueueFactory({
  name: PARTITION_QUEUE_NAME,
  processor: processPartitionJob,
  concurrency: 1,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: { count: 30 },
    removeOnFail: { count: 100 },
  },
});

registerQueue(PARTITION_QUEUE_NAME, partitionQueueFactory);

/** Start partition maintenance as a BullMQ repeating job (every 24 hours). */
export async function startPartitionScheduler(): Promise<void> {
  const queue = partitionQueueFactory.getQueue();

  // Remove stale repeatable jobs from previous deploys
  const existing = await queue.getRepeatableJobs();
  for (const rj of existing) {
    await queue.removeRepeatableByKey(rj.key);
  }

  // Schedule repeating job (every 24 hours)
  await queue.add('partition-maintenance', {}, {
    repeat: { every: PARTITION_INTERVAL_MS },
    jobId: 'partition-repeatable',
  });

  const worker = partitionQueueFactory.getWorker();
  if (worker) {
    worker.on('completed', (job) => {
      if (job) logger.debug({ jobId: job.id }, 'Partition job completed');
    });
    worker.on('failed', (job, err) => {
      if (job) logger.error({ jobId: job.id, err }, 'Partition job failed');
    });
    worker.on('error', (err) => {
      logger.error({ err }, 'Partition queue worker error');
    });
  }

  logger.info({ intervalMs: PARTITION_INTERVAL_MS }, 'Partition scheduler started (BullMQ repeatable)');
}

export async function stopPartitionScheduler(): Promise<void> {
  await partitionQueueFactory.close();
  logger.info('Partition scheduler stopped');
}

// ── Legacy aliases for backward compatibility ──
export const startPartitionManager = startPartitionScheduler;
export const stopPartitionManager = stopPartitionScheduler;
