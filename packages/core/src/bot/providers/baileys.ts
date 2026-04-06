/**
 * Baileys WhatsApp provider — manages WhatsApp Web socket connection.
 */
import {
  makeWASocket,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  type WASocket,
  type WAMessage,
  type proto,
  type AuthenticationState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import pino from 'pino';
import { logger } from '../../shared/logger.js';
import type { Channel, MessagingProvider, ProviderState, IncomingMessage } from './types.js';

const BROWSER_NAME = process.env.WA_BROWSER_NAME || 'YayaCore';

export interface BaileysProviderOptions {
  tenantId: string;
  authState: { state: AuthenticationState; saveCreds: () => Promise<void> };
  onQr?: (dataUrl: string) => void;
  onConnectionUpdate?: (state: 'open' | 'connecting' | 'close', phone?: string) => void;
  onMessage?: (msg: IncomingMessage) => void;
  onDisconnect?: (reason: number, loggedOut: boolean) => boolean;
}

export class BaileysProvider implements MessagingProvider {
  readonly name = 'baileys';
  readonly channel: Channel = 'whatsapp';

  private sock: WASocket | null = null;
  private connectionState: 'open' | 'connecting' | 'close' = 'close';
  private phoneNumber: string | null = null;
  private options: BaileysProviderOptions;

  constructor(options: BaileysProviderOptions) {
    this.options = options;
  }

  getState(): ProviderState {
    return {
      connection: this.connectionState,
      phoneNumber: this.phoneNumber,
      running: this.sock !== null,
    };
  }

  async start(): Promise<void> {
    if (this.sock) {
      logger.warn({ tenantId: this.options.tenantId }, 'Baileys provider is already running');
      return;
    }

    this.connectionState = 'connecting';
    this.options.onConnectionUpdate?.('connecting');

    const { state, saveCreds } = this.options.authState;
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }) as any,
      browser: [BROWSER_NAME, 'Chrome', '1.0.0'],
    });
    this.sock = sock;

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const dataUrl = await QRCode.toDataURL(qr, { width: 300 });
        this.options.onQr?.(dataUrl);
        logger.info({ tenantId: this.options.tenantId }, 'QR code generated — scan with WhatsApp');
      }

      if (connection === 'open') {
        this.connectionState = 'open';
        this.phoneNumber = this.sock?.user?.id?.split('@')[0]?.split(':')[0] ?? null;
        this.options.onConnectionUpdate?.('open', this.phoneNumber ?? undefined);
        logger.info({ tenantId: this.options.tenantId }, `Connected as ${this.phoneNumber}`);
      }

      if (connection === 'close') {
        this.connectionState = 'close';
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode ?? 0;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        this.sock = null;
        this.options.onConnectionUpdate?.('close');

        const shouldReconnect = this.options.onDisconnect?.(statusCode, loggedOut) ?? false;
        if (!shouldReconnect) {
          logger.info({ tenantId: this.options.tenantId }, 'Baileys provider stopped (no reconnect)');
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const raw of messages) {
        const msg = await this.normalizeMessage(raw);
        if (msg) this.options.onMessage?.(msg);
      }
    });
  }

  async stop(): Promise<void> {
    if (this.sock) {
      this.sock.end(undefined);
      this.sock = null;
    }
    this.connectionState = 'close';
    this.phoneNumber = null;
    logger.info({ tenantId: this.options.tenantId }, 'Baileys provider stopped');
  }

  async reset(): Promise<void> {
    await this.stop();
    await this.start();
  }

  async sendText(contactId: string, text: string): Promise<void> {
    if (!this.sock) throw new Error('Not connected');
    await this.sock.sendMessage(contactId, { text });
  }

  async sendImage(contactId: string, imagePath: string, caption?: string): Promise<void> {
    if (!this.sock) throw new Error('Not connected');
    await this.sock.sendMessage(contactId, {
      image: { url: imagePath },
      caption: caption || undefined,
    });
  }

  async sendVoiceNote(contactId: string, filePath: string, duration?: number): Promise<void> {
    if (!this.sock) throw new Error('Not connected');
    await this.sock.sendMessage(contactId, {
      audio: { url: filePath },
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true,
      seconds: duration,
    });
  }

  async sendPresenceUpdate(jid: string, type: 'composing' | 'paused'): Promise<void> {
    if (!this.sock) return;
    await this.sock.presenceSubscribe(jid);
    await this.sock.sendPresenceUpdate(type, jid);
  }

  private async normalizeMessage(raw: proto.IWebMessageInfo): Promise<IncomingMessage | null> {
    if (!raw.key || !raw.key.remoteJid || !raw.message) return null;

    const remoteJid = raw.key.remoteJid;
    if (remoteJid === 'status@broadcast') return null;

    const selfPhone = this.sock?.user?.id?.split('@')[0]?.split(':')[0] ?? '';
    const selfLid = (this.sock?.user as any)?.lid?.split('@')[0]?.split(':')[0] ?? '';
    const remoteLocal = remoteJid.split('@')[0];
    const isSelfJid = remoteLocal === selfPhone || (!!selfLid && remoteLocal === selfLid);

    if (raw.key.fromMe && !isSelfJid) return null;

    const locMsg = raw.message.locationMessage || raw.message.liveLocationMessage;
    let location: IncomingMessage['location'] = null;
    let text: string | null = null;
    let image: IncomingMessage['image'] = null;
    let audio: IncomingMessage['audio'] = null;

    if (locMsg) {
      const lat = locMsg.degreesLatitude ?? 0;
      const lng = locMsg.degreesLongitude ?? 0;
      const locName = ('name' in locMsg ? locMsg.name : null) || null;
      const locAddress = ('address' in locMsg ? locMsg.address : null) || null;
      location = { lat, lng, name: locName, address: locAddress };
    } else if (raw.message.imageMessage) {
      try {
        const buffer = await downloadMediaMessage(raw as WAMessage, 'buffer', {}) as Buffer;
        const mimetype = raw.message.imageMessage.mimetype || 'image/jpeg';
        const caption = raw.message.imageMessage.caption || null;
        image = { buffer, mimetype, caption };
        text = caption;
      } catch (err) {
        logger.warn({ tenantId: this.options.tenantId, err }, 'Failed to download image');
        text = '[Image could not be downloaded]';
      }
    } else if (raw.message.audioMessage) {
      try {
        const buffer = await downloadMediaMessage(raw as WAMessage, 'buffer', {}) as Buffer;
        const mimetype = raw.message.audioMessage.mimetype || 'audio/ogg';
        const seconds = raw.message.audioMessage.seconds ?? null;
        audio = { buffer, mimetype, seconds };
      } catch (err) {
        logger.warn({ tenantId: this.options.tenantId, err }, 'Failed to download audio');
        text = '[Audio could not be downloaded]';
      }
    } else {
      text = raw.message.conversation || raw.message.extendedTextMessage?.text || null;
    }

    return {
      id: raw.key.id || '',
      channel: this.channel,
      contactId: remoteJid,
      contactName: raw.pushName || null,
      fromMe: (raw.key.fromMe ?? false) || isSelfJid,
      isGroup: remoteJid.endsWith('@g.us'),
      text,
      location,
      image,
      audio,
    };
  }
}
