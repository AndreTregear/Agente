/**
 * TenantManager — orchestrates all tenant workers from the main thread.
 * Adapted from yaya_platform for health context.
 * Simplified: no MinIO/S3 media storage, text + basic images + audio transcription.
 */
import { WorkerBridge } from './worker-bridge.js';
import { clearAuthState } from './providers/pg-auth-state.js';
import * as tenantsRepo from '../db/repos/tenants-repo.js';
import * as sessionsRepo from '../db/repos/sessions-repo.js';
import { enqueueAIJob } from '../queue/ai-queue.js';
import { transcribeAudio } from '../ai/client.js';
import { DATABASE_URL } from '../config.js';
import { logger } from '../shared/logger.js';
import type { TenantSession } from '../db/repos/sessions-repo.js';

class TenantManagerImpl {
  private bridges = new Map<string, WorkerBridge>();

  getBridge(tenantId: string): WorkerBridge | undefined {
    return this.bridges.get(tenantId);
  }

  getAllBridges(): Map<string, WorkerBridge> {
    return this.bridges;
  }

  async startTenant(tenantId: string): Promise<void> {
    const startTime = Date.now();
    logger.debug({ tenantId }, 'Starting tenant...');

    const tenant = await tenantsRepo.getTenantById(tenantId);
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);
    if (tenant.status !== 'active') throw new Error(`Tenant ${tenantId} is ${tenant.status}`);

    let bridge = this.bridges.get(tenantId);
    if (bridge?.isRunning()) {
      logger.warn({ tenantId }, 'Tenant already running');
      return;
    }

    bridge = new WorkerBridge(tenantId);

    // Set up message handler → enqueue to AI queue
    bridge.setMessageHandler((tid, msg) => {
      const hasText = !!msg.text;
      const hasImage = !!msg.image;
      const hasAudio = !!msg.audio;
      logger.debug({ tenantId: tid, contactId: msg.contactId, channel: msg.channel, hasText, hasImage, hasAudio, fromMe: msg.fromMe }, 'Incoming message received');

      if (!msg.text && !msg.image && !msg.audio) return;

      (async () => {
        let audioTranscription: string | undefined;

        // Transcribe audio if present
        if (msg.audio?.buffer) {
          try {
            audioTranscription = await transcribeAudio(msg.audio.buffer, msg.audio.mimetype);
            logger.debug({ tenantId: tid, transcriptionLength: audioTranscription.length }, 'Transcribed audio');
          } catch (err) {
            logger.warn({ tenantId: tid, err }, 'Failed to transcribe audio');
            // Send friendly error to user and bail out
            try {
              const b = this.bridges.get(tid);
              if (b?.isRunning()) {
                await b.sendMessage(msg.contactId, 'No pude escuchar bien tu mensaje de voz. ¿Puedes escribirme?');
              }
            } catch (sendErr) {
              logger.warn({ tenantId: tid, sendErr }, 'Failed to send transcription error message');
            }
            return;
          }
        }

        // Combine text: audio transcription with prefix
        let combinedText = msg.text || '';
        if (audioTranscription) {
          const prefixed = `[Mensaje de voz transcrito]: ${audioTranscription}`;
          combinedText = prefixed + (combinedText ? ' ' + combinedText : '');
        }

        // Image caption is already in msg.text (set by Baileys normalizer)
        // For images without text, note it
        if (msg.image && !combinedText) {
          combinedText = '[Imagen recibida]';
        }

        await enqueueAIJob({
          tenantId: tid,
          jid: msg.contactId,
          pushName: msg.contactName,
          text: combinedText,
          timestamp: Date.now(),
          audioTranscription: audioTranscription,
          isVoiceMessage: !!msg.audio,
        });
      })().catch(err => logger.error({ tenantId: tid, err }, 'Failed to process incoming message'));
    });

    this.bridges.set(tenantId, bridge);

    await bridge.start(DATABASE_URL);
    await bridge.startSession();
    logger.info({ tenantId, latencyMs: Date.now() - startTime }, 'Tenant started');
  }

  async stopTenant(tenantId: string): Promise<void> {
    logger.debug({ tenantId }, 'Stopping tenant...');
    const bridge = this.bridges.get(tenantId);
    if (!bridge) return;

    try {
      await bridge.stopSession();
      await new Promise(resolve => setTimeout(resolve, 2000));
      await bridge.terminate();
    } catch (err) {
      logger.warn({ tenantId, err }, 'stopSession failed, forcing terminate');
      await bridge.terminate();
    }

    this.bridges.delete(tenantId);
    logger.info({ tenantId }, 'Tenant stopped');
  }

  async resetTenant(tenantId: string): Promise<void> {
    await this.stopTenant(tenantId);
    await clearAuthState(tenantId);
    logger.info({ tenantId }, 'Tenant auth cleared');
    await this.startTenant(tenantId);
  }

  async sendMessage(tenantId: string, jid: string, text: string): Promise<void> {
    logger.debug({ tenantId, jid, textLength: text.length }, 'Sending message');
    const bridge = this.bridges.get(tenantId);
    if (!bridge?.isRunning()) throw new Error(`Tenant ${tenantId} is not running`);
    await bridge.sendMessage(jid, text);
  }

  async sendImage(tenantId: string, jid: string, imagePath: string, caption?: string): Promise<void> {
    const bridge = this.bridges.get(tenantId);
    if (!bridge?.isRunning()) throw new Error(`Tenant ${tenantId} is not running`);
    await bridge.sendImage(jid, imagePath, caption);
  }

  async sendVoiceNote(tenantId: string, jid: string, filePath: string, duration?: number): Promise<void> {
    const bridge = this.bridges.get(tenantId);
    if (!bridge?.isRunning()) throw new Error(`Tenant ${tenantId} is not running`);
    await bridge.sendVoiceNote(jid, filePath, duration);
  }

  sendPresenceUpdate(tenantId: string, jid: string, type: 'composing' | 'paused'): void {
    const bridge = this.bridges.get(tenantId);
    if (bridge?.isRunning()) {
      bridge.sendPresenceUpdate(jid, type);
    }
  }

  async getStatus(tenantId: string): Promise<{
    running: boolean;
    session: TenantSession | null;
    startedAt: Date | null;
    messagesHandled: number;
    qrAvailable: boolean;
  }> {
    const bridge = this.bridges.get(tenantId);
    const session = await sessionsRepo.getSession(tenantId);

    return {
      running: bridge?.isRunning() ?? false,
      session,
      startedAt: bridge?.getStartedAt() ?? null,
      messagesHandled: bridge?.getMessagesHandled() ?? 0,
      qrAvailable: bridge?.getLatestQr() !== null,
    };
  }

  getQr(tenantId: string): string | null {
    return this.bridges.get(tenantId)?.getLatestQr() ?? null;
  }

  /**
   * Auto-start all active tenants on server boot.
   */
  async autoStartTenants(): Promise<void> {
    const tenants = await tenantsRepo.getActiveTenants();
    logger.info(`Auto-starting ${tenants.length} active tenant(s)`);

    for (const tenant of tenants) {
      try {
        await this.startTenant(tenant.id);
      } catch (err) {
        logger.error({ tenantId: tenant.id, err }, 'Failed to auto-start tenant');
      }
    }
  }

  async shutdownAll(): Promise<void> {
    const ids = Array.from(this.bridges.keys());
    logger.debug({ tenantCount: ids.length }, 'Shutting down all tenants');
    await Promise.allSettled(ids.map(id => this.stopTenant(id)));
    logger.info('All tenants shut down');
  }
}

export const tenantManager = new TenantManagerImpl();
