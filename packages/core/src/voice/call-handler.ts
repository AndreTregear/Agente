/**
 * WhatsApp Call Handler
 *
 * Baileys can detect incoming calls but cannot answer them.
 * Strategy: reject the call and prompt the user to send a voice message instead,
 * then process voice messages with ultra-low latency for a conversation-like experience.
 */

import { logger } from '../shared/logger.js';

export interface WACallEvent {
  chatId: string;
  from: string;
  isGroup?: boolean;
  groupJid?: string;
  id: string;
  date: Date;
  isVideo?: boolean;
  status: 'offer' | 'ringing' | 'timeout' | 'reject' | 'accept' | 'terminate';
  offline: boolean;
  latencyMs?: number;
}

export interface CallHandlerOptions {
  /** Function to reject a call */
  rejectCall: (callId: string, callFrom: string) => Promise<void>;
  /** Function to send a text message */
  sendMessage: (jid: string, text: string) => Promise<void>;
  /** Function to send a voice note */
  sendVoiceNote?: (jid: string, audioPath: string, duration?: number) => Promise<void>;
  /** Custom message to send when rejecting a call */
  rejectMessage?: string;
  /** Whether to auto-reject calls (default: true) */
  autoReject?: boolean;
  /** Callback when a call is detected */
  onCallDetected?: (event: WACallEvent) => void;
}

const DEFAULT_REJECT_MESSAGE = [
  '📞 ¡Vi tu llamada! Aún no puedo contestar llamadas, pero estoy aquí.',
  '',
  '🎤 *Envíame un mensaje de voz* y te respondo al instante con audio.',
  '',
  'Es como una conversación — solo mantén presionado el micrófono y habla. 🚀',
].join('\n');

/**
 * Create a call handler that integrates with a Baileys socket.
 *
 * Usage:
 * ```ts
 * const handler = createCallHandler({
 *   rejectCall: sock.rejectCall,
 *   sendMessage: (jid, text) => sock.sendMessage(jid, { text }),
 * });
 *
 * sock.ev.on('call', handler.handleCallEvents);
 * ```
 */
export function createCallHandler(options: CallHandlerOptions) {
  const {
    rejectCall,
    sendMessage,
    rejectMessage = DEFAULT_REJECT_MESSAGE,
    autoReject = true,
    onCallDetected,
  } = options;

  // Track which calls we've already handled (prevent duplicate messages)
  const handledCalls = new Set<string>();

  async function handleCallEvents(events: WACallEvent[]): Promise<void> {
    for (const event of events) {
      if (event.status === 'offer' && !handledCalls.has(event.id)) {
        handledCalls.add(event.id);

        logger.info({
          callId: event.id,
          from: event.from,
          isVideo: event.isVideo,
          isGroup: event.isGroup,
        }, 'Incoming WhatsApp call detected');

        onCallDetected?.(event);

        if (autoReject) {
          try {
            await rejectCall(event.id, event.from);
            logger.info({ callId: event.id }, 'Call rejected');

            // Send the prompt message
            await sendMessage(event.from, rejectMessage);
            logger.info({ to: event.from }, 'Voice prompt message sent');
          } catch (err) {
            logger.error({ err, callId: event.id }, 'Failed to handle call');
          }
        }
      }

      // Clean up old call IDs (keep last 100)
      if (handledCalls.size > 100) {
        const entries = [...handledCalls];
        for (let i = 0; i < entries.length - 50; i++) {
          handledCalls.delete(entries[i]);
        }
      }
    }
  }

  return { handleCallEvents };
}
