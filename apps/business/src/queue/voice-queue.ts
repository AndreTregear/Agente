/**
 * Voice Queue — disaggregated TTS processing via BullMQ.
 *
 * The AI queue enqueues a voice job after text processing completes.
 * This worker synthesizes speech and sends the audio back to the user,
 * freeing the AI worker thread from the 2-5s TTS blocking call.
 */
import type { Job } from 'bullmq';
import { QueueFactory, registerQueue } from './queue-factory.js';
import { synthesizeSpeech } from '../voice/voice-pipeline.js';
import { tenantManager } from '../bot/tenant-manager.js';
import { logger } from '../shared/logger.js';

// ── Queue name & types ──

export const VOICE_QUEUE_NAME = 'yaya:voice';

export interface VoiceJobData {
  tenantId: string;
  jid: string;
  text: string;
  replyToMessageId?: string;
}

interface VoiceJobResult {
  audioSize: number;
}

// ── Concurrency from env ──

const VOICE_QUEUE_CONCURRENCY = Number(process.env.VOICE_QUEUE_CONCURRENCY) || 3;

// ── Processor ──

async function processVoiceJob(job: Job<VoiceJobData, VoiceJobResult>): Promise<VoiceJobResult> {
  const { tenantId, jid, text } = job.data;

  logger.info({ tenantId, jid, jobId: job.id, textLength: text.length }, 'Processing voice TTS job');

  const voiceAudio = await synthesizeSpeech(text);
  await tenantManager.sendAudio(tenantId, jid, voiceAudio, 'audio/mpeg', true);

  logger.info({ tenantId, jid, jobId: job.id, audioSize: voiceAudio.length }, 'Voice TTS reply sent');

  return { audioSize: voiceAudio.length };
}

// ── Factory & registration ──

const voiceQueueFactory = new QueueFactory({
  name: VOICE_QUEUE_NAME,
  processor: processVoiceJob,
  concurrency: VOICE_QUEUE_CONCURRENCY,
});

registerQueue(VOICE_QUEUE_NAME, voiceQueueFactory);

// ── Public API ──

export const getVoiceQueue = () => voiceQueueFactory.getQueue();

export async function enqueueVoiceJob(data: VoiceJobData): Promise<void> {
  const jobId = `voice_${data.tenantId}_${data.jid}_${Date.now()}`;
  await voiceQueueFactory.add('synthesize', data, { jobId });
  logger.debug({ tenantId: data.tenantId, jid: data.jid, jobId }, 'Voice TTS job enqueued');
}

export function startVoiceWorker(): void {
  const worker = voiceQueueFactory.getWorker();
  if (!worker) return;

  worker.on('completed', (job) => {
    if (job) logger.debug({ jobId: job.id, tenantId: job.data.tenantId }, 'Voice TTS job completed');
  });

  worker.on('failed', (job, err) => {
    if (!job) return;
    logger.warn({ jobId: job.id, tenantId: job.data.tenantId, err }, 'Voice TTS job failed (text reply already sent)');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Voice queue worker error');
  });

  logger.info({ concurrency: VOICE_QUEUE_CONCURRENCY }, 'Voice queue worker started');
}

export async function closeVoiceQueue(): Promise<void> {
  await voiceQueueFactory.close();
  logger.info('Voice queue closed');
}
