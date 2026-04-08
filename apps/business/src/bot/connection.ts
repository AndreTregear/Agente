import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import pino from 'pino';
import { AUTH_DIR } from '../config.js';
import { appBus } from '../shared/events.js';
import { logger } from '../shared/logger.js';
import { handleIncomingMessage } from './handler.js';

let sock: WASocket | null = null;
let shouldReconnect = true;
let connectionState: 'open' | 'connecting' | 'close' = 'close';
let startedAt: Date | null = null;
let messagesHandled = 0;
let phoneNumber: string | null = null;
/** Stored listener removal functions for cleanup */
let listenerCleanups: Array<() => void> = [];

export function getBotState(): {
  socket: WASocket | null;
  connectionState: 'open' | 'connecting' | 'close';
  startedAt: Date | null;
  messagesHandled: number;
  phoneNumber: string | null;
  running: boolean;
} {
  return {
    socket: sock,
    connectionState,
    startedAt,
    messagesHandled,
    phoneNumber,
    running: sock !== null,
  };
}

export function incrementMessagesHandled(): void {
  messagesHandled++;
}

export async function startBot(): Promise<void> {
  if (sock) {
    logger.warn('Bot is already running');
    return;
  }

  shouldReconnect = true;
  startedAt = new Date();
  connectionState = 'connecting';
  appBus.emit('connection-update', 'single-tenant', 'connecting');

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }) as any,
    browser: ['Autobot', 'Chrome', '1.0.0'],
  });

  // Store listener references for cleanup
  listenerCleanups = [];

  const onConnectionUpdate = async (update: any) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const dataUrl = await QRCode.toDataURL(qr, { width: 300 });
      appBus.emit('qr', 'single-tenant', dataUrl);
      logger.info('QR code generated — scan with WhatsApp');
    }

    if (connection === 'open') {
      connectionState = 'open';
      phoneNumber = sock?.user?.id?.split(':')[0] ?? null;
      appBus.emit('connection-update', 'single-tenant', 'open');
      appBus.emit('bot-started');
      logger.info(`Connected as ${phoneNumber}`);
    }

    if (connection === 'close') {
      connectionState = 'close';
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        shouldReconnect = false;
        logger.warn('Logged out — will not reconnect. Restart to re-pair.');
      }

      // Remove listeners before nullifying sock
      removeListeners();
      sock = null;
      appBus.emit('connection-update', 'single-tenant', 'close');

      if (shouldReconnect) {
        logger.info('Reconnecting in 3 seconds...');
        setTimeout(() => startBot(), 3000);
      } else {
        appBus.emit('bot-stopped');
      }
    }
  };

  const onCredsUpdate = saveCreds;

  const onMessagesUpsert = async ({ messages, type }: { messages: any[]; type: string }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      await handleIncomingMessage(sock!, msg);
    }
  };

  sock.ev.on('connection.update', onConnectionUpdate);
  sock.ev.on('creds.update', onCredsUpdate);
  sock.ev.on('messages.upsert', onMessagesUpsert);

  listenerCleanups.push(
    () => sock?.ev.off('connection.update', onConnectionUpdate),
    () => sock?.ev.off('creds.update', onCredsUpdate),
    () => sock?.ev.off('messages.upsert', onMessagesUpsert),
  );
}

function removeListeners(): void {
  for (const cleanup of listenerCleanups) {
    try { cleanup(); } catch { /* socket may already be gone */ }
  }
  listenerCleanups = [];
}

export async function stopBot(): Promise<void> {
  shouldReconnect = false;
  if (sock) {
    removeListeners();
    sock.end(undefined);
    sock = null;
  }
  connectionState = 'close';
  startedAt = null;
  messagesHandled = 0;
  phoneNumber = null;
  appBus.emit('bot-stopped');
  appBus.emit('connection-update', 'single-tenant', 'close');
  logger.info('Bot stopped');
}
