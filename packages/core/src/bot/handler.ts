/**
 * Message handler — routes incoming WhatsApp messages.
 * Intent detection is pluggable via setIntentPatterns().
 */

import { logger } from '../shared/logger.js';
import { enqueueAIJob } from '../queue/ai-queue.js';
import type { IncomingMessage } from '../shared/types.js';

export interface IntentPattern {
  intent: string;
  patterns: RegExp[];
}

let intentPatterns: IntentPattern[] = [];

/**
 * Set custom intent patterns for message routing.
 */
export function setIntentPatterns(patterns: IntentPattern[]): void {
  intentPatterns = [...patterns];
}

/**
 * Get current intent patterns.
 */
export function getIntentPatterns(): IntentPattern[] {
  return [...intentPatterns];
}

/**
 * Detect the user's intent from their message.
 */
export function detectIntent(body: string): string {
  for (const { intent, patterns } of intentPatterns) {
    if (patterns.some((p) => p.test(body))) {
      return intent;
    }
  }
  return 'general';
}

/**
 * Handle an incoming message — detect intent and enqueue for AI processing.
 */
export async function handleMessage(msg: IncomingMessage): Promise<void> {
  const intent = detectIntent(msg.body);
  logger.info({ jid: msg.jid, intent, preview: msg.body.substring(0, 40) }, 'Message received');

  await enqueueAIJob({
    tenantId: msg.tenantId,
    jid: msg.jid,
    pushName: msg.pushName ?? null,
    text: msg.body,
    timestamp: Date.now(),
    intent,
    mediaType: msg.mediaType,
    mediaUrl: msg.mediaUrl,
  });
}
