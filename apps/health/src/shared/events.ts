import { EventEmitter } from 'node:events';

/**
 * Application-wide event bus for health platform.
 *
 * Events:
 *  - 'message-received': { tenantId, jid, body, mediaType? }
 *  - 'growth-alert': { childId, flags, assessment }
 *  - 'health-alert': { patientId, readingType, classification }
 *  - 'reminder-due': { reminderId, patientId, medication? }
 *  - 'food-logged': { patientId, summary }
 *  - 'qr': QR data URL for WhatsApp pairing
 *  - 'connection-update': (tenantId, status)
 *  - 'tenant-started': (tenantId)
 *  - 'tenant-stopped': (tenantId)
 *  - 'tenant-error': (tenantId, errorMsg)
 *  - 'tenant-health-alert': (tenantId, reason)
 */
export const appBus = new EventEmitter();
appBus.setMaxListeners(50);
