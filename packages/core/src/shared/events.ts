import { EventEmitter } from 'node:events';

/**
 * Application-wide event bus.
 *
 * Common events:
 *  - 'message-received': { tenantId, jid, body, mediaType? }
 *  - 'qr': QR data URL for WhatsApp pairing
 *  - 'connection-update': (tenantId, status)
 *  - 'tenant-started': (tenantId)
 *  - 'tenant-stopped': (tenantId)
 *  - 'tenant-error': (tenantId, errorMsg)
 *  - 'tenant-health-alert': (tenantId, reason)
 *  - 'send-message': { tenantId, jid, text }
 *  - 'ai-job-enqueued': { tenantId, jid }
 *  - 'ai-job-completed': { tenantId, jid }
 *  - 'ai-rate-limited': { tenantId, jid }
 */
export const appBus = new EventEmitter();
appBus.setMaxListeners(50);
