import { EventEmitter } from 'node:events';
import type { MessageLog } from './types.js';
import type { ConfirmationAction, ConfirmationFields } from '../bot/flows/types.js';

type EventMap = {
  qr: [tenantId: string, dataUrl: string];
  'connection-update': [tenantId: string, state: 'open' | 'connecting' | 'close'];
  'message-logged': [msg: MessageLog];
  'bot-started': [];
  'bot-stopped': [];
  'tenant-error': [tenantId: string, error: string];
  'tenant-stopped': [tenantId: string];
  'tenant-started': [tenantId: string];
  'tenant-health-alert': [tenantId: string, message: string];
  'yape-payment-matched': [tenantId: string, paymentId: number, orderId: number, customerJid: string];
  'yape-payment-synced': [tenantId: string, notificationId: number];
  'low-stock-alert': [tenantId: string, productId: number, productName: string, currentStock: number];
  'out-of-stock': [tenantId: string, productId: number, productName: string];
  'ai-job-enqueued': [tenantId: string, jid: string];
  'ai-job-failed': [tenantId: string, jid: string, reason: string];
  'ai-job-completed': [tenantId: string, jid: string];
  'human-handoff-requested': [tenantId: string, customerJid: string, reason: string];
  'daily-summary-ready': [tenantId: string, data: { title: string; body: string; data: Record<string, unknown> }];
  'order-created': [tenantId: string, orderId: number, customerJid: string];
  'order-cancelled': [tenantId: string, orderId: number, reason?: string];
  'order-paid': [tenantId: string, orderId: number, customerJid: string];
  'order-refunded': [tenantId: string, orderId: number, amount: number];
  'order-delivered': [tenantId: string, orderId: number, customerJid: string];
  'appointment-booked': [tenantId: string, appointmentId: number, customerJid: string];
  'appointment-cancelled': [tenantId: string, appointmentId: number];
  'rider-assigned': [tenantId: string, orderId: number, riderId: number];
  'delivery-completed': [tenantId: string, orderId: number, assignmentId: number];
  // Confirmation flow events
  'confirmation-requested': [tenantId: string, jid: string, confirmationId: string, action: ConfirmationAction];
  'confirmation-accepted': [tenantId: string, jid: string, confirmationId: string, action: ConfirmationAction, fields: ConfirmationFields];
  'confirmation-cancelled': [tenantId: string, jid: string, confirmationId: string];
  // Knowledge graph events
  'knowledge-node-created': [tenantId: string | null, nodeId: number, nodeType: string];
  'knowledge-indexed': [sourceType: string, sourceRef: string, nodesCreated: number];
};

class TypedEmitter extends EventEmitter {
  override emit<K extends keyof EventMap>(event: K, ...args: EventMap[K]): boolean {
    return super.emit(event, ...args);
  }

  override on<K extends keyof EventMap>(event: K, listener: (...args: EventMap[K]) => void): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }
}

export const appBus = new TypedEmitter();
// Multi-tenant: many subsystems listen on the same bus. Default 10 is too low for 100+ tenants.
appBus.setMaxListeners(200);
