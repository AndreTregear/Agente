import type { IncomingMessage as ProviderIncomingMessage } from '../bot/providers/types.js';

// Re-export provider IncomingMessage for backward compatibility
export type { ProviderIncomingMessage };

// ── Legacy IncomingMessage (used by handler.ts) ──

export interface IncomingMessage {
  tenantId: string;
  jid: string;
  body: string;
  mediaType?: 'image' | 'audio' | 'video' | 'document';
  mediaUrl?: string;
  pushName?: string;
  timestamp: Date;
}

export interface OutgoingMessage {
  jid: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: string;
}

export interface TenantConfig {
  id: string;
  name: string;
  phone: string;
  active: boolean;
}

// ── Tenant Session ──

export interface TenantSession {
  tenantId: string;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  lastConnectedAt: string | null;
  lastQrAt: string | null;
  reconnectAttempts: number;
  errorMessage: string | null;
  updatedAt: string;
}

// ── Worker Command / Event types ──

export type WorkerCommand =
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'send-message'; jid: string; text: string; requestId?: string }
  | { type: 'send-image'; jid: string; imagePath: string; caption?: string; requestId?: string }
  | { type: 'send-voice-note'; jid: string; filePath: string; duration?: number; requestId?: string }
  | { type: 'send-presence'; jid: string; presenceType: 'composing' | 'paused' }
  | { type: 'health-check' };

export type WorkerEvent =
  | { type: 'ready' }
  | { type: 'qr'; dataUrl: string }
  | { type: 'connection-update'; status: 'open' | 'connecting' | 'close'; phone?: string }
  | { type: 'message'; message: ProviderIncomingMessage }
  | { type: 'error'; error: string }
  | { type: 'heartbeat'; timestamp: number }
  | { type: 'send-result'; requestId: string; success: boolean; error?: string }
  | { type: 'stopped' };

// ── Tenant DB row ──

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  status: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
