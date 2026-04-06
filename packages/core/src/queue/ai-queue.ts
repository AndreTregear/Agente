/**
 * AI job queue for @yaya/core.
 * Routes incoming WhatsApp messages through OpenClaw for AI processing.
 * App-specific routing is handled via the pluggable context builder
 * and privileged user check in openclaw-bridge.
 */

import { DelayedError, type Job } from 'bullmq';
import { QueueFactory, registerQueue } from './queue-factory.js';
import { processWithOpenClaw, processPrivilegedWithOpenClaw, isPrivilegedUser } from '../ai/openclaw-bridge.js';
import { acquireTenantSlot, releaseTenantSlot, checkAndIncrementRateLimit } from './rate-limiter.js';
import { appBus } from '../shared/events.js';
import { logger } from '../shared/logger.js';
import { QUEUE_CONCURRENCY } from '../config.js';
import { AI_QUEUE_NAME, type AIJobData, type AIJobResult } from './types.js';

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
  const { tenantId, jid, pushName, text, mediaUrl, fromPrivilegedUser } = job.data;

  logger.info({ tenantId, jid, jobId: job.id, attempt: job.attemptsMade + 1, textLength: text.length, fromPrivilegedUser }, 'Processing AI job');

  // Per-tenant rate limiting (skip for privileged users)
  const privileged = fromPrivilegedUser || isPrivilegedUser(jid);
  if (!privileged) {
    const withinLimit = await checkAndIncrementRateLimit(tenantId);
    if (!withinLimit) {
      logger.warn({ tenantId, jid, jobId: job.id }, 'Rate limit exceeded for tenant');
      appBus.emit('ai-rate-limited', { tenantId, jid });
      return { reply: '', chunksSent: 0 };
    }
  }

  // Privileged user routing (elevated context)
  if (privileged) {
    logger.info({ tenantId, jid, jobId: job.id }, 'Routing privileged user message to OpenClaw');

    try {
      const { reply } = await processPrivilegedWithOpenClaw(tenantId, jid, text);

      if (reply) {
        const chunks = splitMessage(reply, 4000);
        for (const chunk of chunks) {
          appBus.emit('send-message', { tenantId, jid, text: chunk });
        }
        logger.info({ tenantId, jid, jobId: job.id, chunksSent: chunks.length }, 'Privileged user agent replied');
        return { reply, chunksSent: chunks.length };
      }

      return { reply: '', chunksSent: 0 };
    } catch (error) {
      logger.error({ error, tenantId, jid, jobId: job.id, latencyMs: Date.now() - jobStartTime }, 'Privileged user agent processing failed');
      return { reply: '', chunksSent: 0 };
    }
  }

  // Per-tenant concurrency
  const slotAcquired = await acquireTenantSlot(tenantId, job.id!);
  if (!slotAcquired) {
    await job.moveToDelayed(Date.now() + CONCURRENCY_DELAY_MS, job.id);
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
      const fallback = getFallbackMessage();
      appBus.emit('send-message', { tenantId, jid, text: fallback });
    } catch { /* best effort */ }
    throw error;
  } finally {
    await releaseTenantSlot(tenantId, job.id!);
  }
}

function getFallbackMessage(): string {
  return process.env.AI_FALLBACK_MESSAGE || 'Sorry, I had a technical issue. Please try again. 🙏';
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
  const jobId = `ai_${data.tenantId}_${data.jid}_${data.timestamp}`;
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
