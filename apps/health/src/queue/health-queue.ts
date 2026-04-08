import { Queue, Worker, type Job } from 'bullmq';
import { getRedis } from './redis.js';
import { logger } from '../shared/logger.js';
import { QUEUE_CONCURRENCY } from '../config.js';
import { appBus } from '../shared/events.js';

const QUEUE_NAME = 'health-ai';

let queue: Queue | null = null;
let worker: Worker | null = null;

export function getHealthQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: getRedis() as any });
  }
  return queue;
}

/**
 * Process incoming health-related messages via the AI agent.
 */
async function processHealthMessage(job: Job): Promise<void> {
  const { tenantId, jid, body, pushName } = job.data;
  logger.info({ tenantId, jid, msgPreview: body.substring(0, 50) }, 'Processing health message');

  // Emit event for the message handler to pick up
  appBus.emit('ai-response-needed', { tenantId, jid, body, pushName });
}

export function startHealthWorker(): void {
  worker = new Worker(QUEUE_NAME, processHealthMessage, {
    connection: getRedis() as any,
    concurrency: QUEUE_CONCURRENCY,
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Health queue job failed');
  });

  logger.info('Health AI worker started');
}

export async function closeHealthQueue(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
}
