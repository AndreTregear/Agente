/**
 * AI job queue for Yaya Salud.
 * Routes incoming WhatsApp messages through OpenClaw for AI processing.
 *
 * Adapted from yaya_platform:
 * - Health worker vs patient routing (instead of owner vs customer)
 * - No subscription checks (health service is free)
 * - Spanish error messages for health context
 */

import { DelayedError, type Job } from 'bullmq';
import { QueueFactory, registerQueue } from './queue-factory.js';
import { processWithOpenClaw, processHealthWorkerWithOpenClaw, isHealthWorker } from '../ai/openclaw-bridge.js';
import { acquireTenantSlot, releaseTenantSlot, checkAndIncrementRateLimit } from './rate-limiter.js';
import { appBus } from '../shared/events.js';
import { logger } from '../shared/logger.js';
import { QUEUE_CONCURRENCY } from '../config.js';
import { AI_QUEUE_NAME, type AIJobData, type AIJobResult } from './types.js';

const MAX_OFFLINE_DELAYS = 3;
const OFFLINE_DELAY_MS = 30_000;
const CONCURRENCY_DELAY_MS = 5_000;

/** Split long messages into chunks at word boundaries. */
function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf(' ', maxLen);
    if (splitAt <= 0) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  return chunks;
}

async function processAIJob(job: Job<AIJobData, AIJobResult>): Promise<AIJobResult> {
  const jobStartTime = Date.now();
  const { tenantId, jid, pushName, text, mediaUrl, fromHealthWorker } = job.data;
  const token = job.id;

  logger.info({ tenantId, jid, jobId: job.id, attempt: job.attemptsMade + 1, textLength: text.length, fromHealthWorker }, 'Processing AI job');

  // Connection-aware routing — delay if tenant's WhatsApp is offline
  // (For now, health platform doesn't have a tenant-manager bridge like yaya_platform.
  //  When Baileys provider is fully integrated, add connection checks here.)

  // Per-tenant rate limiting (skip for health workers)
  const isWorker = fromHealthWorker || isHealthWorker(jid);
  if (!isWorker) {
    const withinLimit = await checkAndIncrementRateLimit(tenantId);
    if (!withinLimit) {
      logger.warn({ tenantId, jid, jobId: job.id }, 'Rate limit exceeded for tenant');
      appBus.emit('ai-rate-limited', { tenantId, jid });
      return { reply: '', chunksSent: 0 };
    }
  }

  // Health worker routing (elevated context, like owner mode)
  if (isWorker) {
    logger.info({ tenantId, jid, jobId: job.id }, 'Routing health worker message to OpenClaw');

    try {
      const { reply } = await processHealthWorkerWithOpenClaw(tenantId, jid, text);

      if (reply) {
        const chunks = splitMessage(reply, 4000);
        // Emit chunks for delivery (WhatsApp send handled by message handler layer)
        for (const chunk of chunks) {
          appBus.emit('send-message', { tenantId, jid, text: chunk });
        }
        logger.info({ tenantId, jid, jobId: job.id, chunksSent: chunks.length }, 'Health worker agent replied');
        return { reply, chunksSent: chunks.length };
      }

      return { reply: '', chunksSent: 0 };
    } catch (error) {
      logger.error({ error, tenantId, jid, jobId: job.id, latencyMs: Date.now() - jobStartTime }, 'Health worker agent processing failed');
      return { reply: '', chunksSent: 0 };
    }
  }

  // Per-tenant concurrency
  const slotAcquired = await acquireTenantSlot(tenantId, job.id!);
  if (!slotAcquired) {
    await job.moveToDelayed(Date.now() + CONCURRENCY_DELAY_MS, token);
    logger.debug({ tenantId, jid, jobId: job.id }, 'Tenant concurrency limit reached, delaying job');
    throw new DelayedError();
  }

  try {
    let chunksSent = 0;
    const result = await processWithOpenClaw(
      tenantId, jid, text,
      async (chunk) => {
        const chunks = splitMessage(chunk, 4000);
        for (const c of chunks) {
          appBus.emit('send-message', { tenantId, jid, text: c });
          chunksSent++;
        }
      },
      pushName,
      mediaUrl,
    );

    if (result.reply) {
      appBus.emit('ai-job-completed', { tenantId, jid });
      logger.info({ tenantId, jid, jobId: job.id, chunksSent, latencyMs: Date.now() - jobStartTime }, `AI replied to ${pushName || jid}`);
      return { reply: result.reply, chunksSent };
    }

    return { reply: '', chunksSent: 0 };
  } catch (error) {
    logger.error({ error, tenantId, jid, jobId: job.id, latencyMs: Date.now() - jobStartTime }, 'AI processing failed');
    try {
      appBus.emit('send-message', { tenantId, jid, text: 'Lo siento, estoy teniendo dificultades técnicas. Por favor intenta de nuevo en un momento. 🙏' });
    } catch { /* best effort */ }
    throw error;
  } finally {
    await releaseTenantSlot(tenantId, job.id!);
  }
}

// Create and register the AI queue factory
const aiQueueFactory = new QueueFactory({
  name: AI_QUEUE_NAME,
  processor: processAIJob,
  concurrency: QUEUE_CONCURRENCY,
});

registerQueue(AI_QUEUE_NAME, aiQueueFactory);

// Export convenience functions
export const getAIQueue = () => aiQueueFactory.getQueue();

export async function enqueueAIJob(data: AIJobData): Promise<void> {
  const jobId = `health_${data.tenantId}_${data.jid}_${data.timestamp}`;
  await aiQueueFactory.add('process-ai', data, { jobId });
  appBus.emit('ai-job-enqueued', { tenantId: data.tenantId, jid: data.jid });
  logger.debug({ tenantId: data.tenantId, jid: data.jid, jobId }, 'AI job enqueued');
}

export function startAIWorker(): void {
  const worker = aiQueueFactory.getWorker();
  if (!worker) return;

  worker.on('completed', (job) => {
    if (job) logger.debug({ jobId: job.id, tenantId: job.data.tenantId }, 'AI job completed');
  });

  worker.on('failed', (job, err) => {
    if (!job) return;
    const isExhausted = job.attemptsMade >= (job.opts?.attempts ?? 3);
    if (isExhausted) {
      logger.error({ jobId: job.id, tenantId: job.data.tenantId, err, attempts: job.attemptsMade }, 'AI job moved to DLQ');
    } else {
      logger.warn({ jobId: job.id, tenantId: job.data.tenantId, err, attempt: job.attemptsMade }, 'AI job failed, will retry');
    }
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'AI queue worker error');
  });

  logger.info({ concurrency: QUEUE_CONCURRENCY }, 'AI queue worker started');
}

export async function closeAIQueue(): Promise<void> {
  await aiQueueFactory.close();
  logger.info('AI queue closed');
}
