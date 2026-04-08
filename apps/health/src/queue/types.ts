/**
 * Queue type definitions for Yaya Salud.
 */

export const AI_QUEUE_NAME = 'health-ai';

export interface AIJobData {
  tenantId: string;
  jid: string;
  pushName: string | null;
  text: string;
  timestamp: number;
  /** Detected intent from message handler */
  intent?: string;
  /** Media type if message contains media */
  mediaType?: 'image' | 'audio' | 'video' | 'document';
  /** URL/path to media attachment */
  mediaUrl?: string;
  /** Already-transcribed audio text */
  audioTranscription?: string;
  /** True when message is from a registered health worker */
  fromHealthWorker?: boolean;
  /** True when the incoming message was a voice note */
  isVoiceMessage?: boolean;
  /** Internal counter for offline delay retries */
  _delayCount?: number;
}

export interface AIJobResult {
  reply: string;
  chunksSent: number;
}

export interface HealthJobData {
  tenantId: string;
  jid: string;
  body: string;
  pushName?: string;
  intent: string;
  mediaType?: string;
  mediaUrl?: string;
  timestamp: string;
}
