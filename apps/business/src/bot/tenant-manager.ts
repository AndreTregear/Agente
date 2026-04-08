/**
 * TenantManager — orchestrates all tenant workers from the main thread.
 */
import { WorkerBridge } from './worker-bridge.js';
import { clearAuthState } from './providers/pg-auth-state.js';
import * as tenantsRepo from '../db/tenants-repo.js';
import * as sessionsRepo from '../db/sessions-repo.js';
import { enqueueAIJob } from '../queue/ai-queue.js';
import { saveMedia } from '../media/storage.js';
import { enqueueMediaJob } from '../media/media-queue.js';
import * as mediaAssetsRepo from '../db/media-assets-repo.js';
import { S3_BUCKET_RAW } from '../config.js';
import { transcribeAudio } from '../ai/client.js';
import { DATABASE_URL } from '../config.js';
import { logger } from '../shared/logger.js';
import { prepareAudioAudit, finalizeAudioDeletion } from '../voice/audio-compliance.js';
import { handleFlowResponse } from './flows/confirmation-flow.js';
import type { TenantSession, WACallEvent } from '../shared/types.js';

function mimetypeToExtension(mimetype: string): string {
  const m = mimetype.toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) return '.jpg';
  if (m.includes('png')) return '.png';
  if (m.includes('gif')) return '.gif';
  if (m.includes('webp')) return '.webp';
  if (m.startsWith('audio/ogg') || m.includes('opus')) return '.ogg';
  if (m.startsWith('audio/mp4') || m.startsWith('audio/m4a') || m.startsWith('audio/aac')) return '.m4a';
  if (m.startsWith('audio/mpeg') || m.startsWith('audio/mp3')) return '.mp3';
  if (m.startsWith('audio/wav') || m.startsWith('audio/x-wav')) return '.wav';
  if (m.startsWith('video/mp4')) return '.mp4';
  if (m.startsWith('video/')) return '.mp4';
  return '.bin';
}

class TenantManagerImpl {
  private bridges = new Map<string, WorkerBridge>();
  private onCallHandler: ((tenantId: string, events: WACallEvent[]) => void) | null = null;

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


    bridge.setMessageHandler((tid, msg) => {
      const hasText = !!msg.text;
      const hasImage = !!msg.image;
      const hasAudio = !!msg.audio;
      logger.debug({ tenantId: tid, contactId: msg.contactId, channel: msg.channel, hasText, hasImage, hasAudio, fromMe: msg.fromMe }, 'Incoming message received');
      if (!msg.text && !msg.image && !msg.audio) return;

      (async () => {
        let imageMediaPath: string | undefined;
        let audioTranscription: string | undefined;

        // Save image if present → MinIO + media_assets record
        if (msg.image?.buffer) {
          try {
            const ext = mimetypeToExtension(msg.image.mimetype);
            imageMediaPath = await saveMedia(tid, 'image', msg.image.buffer, ext, msg.image.mimetype);
            const asset = await mediaAssetsRepo.createAsset({
              tenantId: tid,
              category: 'image',
              originalKey: imageMediaPath,
              mimeType: msg.image.mimetype,
              sizeBytes: msg.image.buffer.length,
            });
            await mediaAssetsRepo.updateProcessingStatus(asset.id, 'completed');
            logger.debug({ tenantId: tid, assetId: asset.id, key: imageMediaPath }, 'Saved image to S3');
          } catch (err) {
            logger.warn({ tenantId: tid, err }, 'Failed to save image media');
          }
        }

        // Ley 29733 compliance: transcribe audio, then immediately destroy.
        // Voice = biometric data — NO persistent audio storage.
        // Capture audio flag BEFORE finalize zeroes the buffer
        const hadAudio = !!msg.audio?.buffer;
        if (msg.audio?.buffer) {
          const audit = prepareAudioAudit(msg.audio.buffer, msg.audio.mimetype);
          try {
            // Transcribe audio to text (only text is retained)
            audioTranscription = await transcribeAudio(msg.audio.buffer, msg.audio.mimetype);
            logger.debug({ tenantId: tid, transcriptionLength: audioTranscription.length }, 'Transcribed audio');
          } catch (err) {
            logger.warn({ tenantId: tid, err }, 'Failed to transcribe audio');
          } finally {
            // ALWAYS zero the audio buffer — even if transcription fails
            finalizeAudioDeletion(msg.audio.buffer, audit, tid, 'whatsapp-incoming');
          }
        }

        // Combine text: audio transcription takes precedence, then image caption/conversation
        let combinedText = msg.text || '';
        if (audioTranscription) {
          combinedText = audioTranscription + (combinedText ? ' ' + combinedText : '');
        }

        // Check for active confirmation flow — intercept before AI queue.
        // Button/list response IDs take priority, then combined text.
        const flowInput = msg.buttonResponseId || msg.listResponseId || combinedText;
        if (flowInput && !msg.fromMe) {
          const flowResult = handleFlowResponse(tid, msg.contactId, flowInput);
          if (flowResult.handled) {
            if (flowResult.reply) {
              try {
                // Try interactive buttons for confirmation messages, fall back to text
                const isConfirmScreen = flowResult.reply.includes('Confirmar') && flowResult.reply.includes('CANCELAR');
                if (isConfirmScreen) {
                  await this.sendButtons(tid, msg.contactId, flowResult.reply, [
                    { id: 'cf_confirm', text: 'OK Confirmar' },
                    { id: 'cf_edit', text: 'Editar' },
                    { id: 'cf_cancel', text: 'Cancelar' },
                  ]);
                } else {
                  await this.sendMessage(tid, msg.contactId, flowResult.reply);
                }
              } catch (err) {
                logger.warn({ tenantId: tid, err }, 'Failed to send flow response');
                // Last-resort: try plain text
                try { await this.sendMessage(tid, msg.contactId, flowResult.reply); } catch { /* give up */ }
              }
            }
            logger.debug({ tenantId: tid, contactId: msg.contactId }, 'Message handled by confirmation flow');
            return; // Message consumed by flow — do NOT enqueue AI job
          }
        }

        await enqueueAIJob({
          tenantId: tid,
          channel: msg.channel,
          jid: msg.contactId,
          pushName: msg.contactName,
          text: combinedText,
          timestamp: Date.now(),
          imageMediaPath,
          isVoiceMessage: hadAudio,
          fromMe: msg.fromMe,
        });
      })().catch(err => logger.error({ tenantId: tid, err }, 'Failed to process incoming message'));
    });

    // Wire call event handler
    if (this.onCallHandler) {
      bridge.setCallHandler(this.onCallHandler);
    }

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
      // Give the worker a moment to clean up, then terminate
      await new Promise(resolve => setTimeout(resolve, 2000));
      await bridge.terminate();
    } catch (err) {
      logger.warn({ tenantId, err }, 'stopSession failed, forcing terminate');
      // Force terminate on error
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

  sendPresenceUpdate(tenantId: string, jid: string, type: 'composing' | 'paused'): void {
    const bridge = this.bridges.get(tenantId);
    if (bridge?.isRunning()) {
      bridge.sendPresenceUpdate(jid, type);
    }
  }

  async sendAudio(tenantId: string, jid: string, audioBuffer: Buffer, mimetype: string = 'audio/mpeg', ptt: boolean = true): Promise<void> {
    const bridge = this.bridges.get(tenantId);
    if (!bridge?.isRunning()) throw new Error(`Tenant ${tenantId} is not running`);
    await bridge.sendAudio(jid, audioBuffer, mimetype, ptt);
  }

  async sendButtons(
    tenantId: string,
    jid: string,
    body: string,
    buttons: Array<{ id: string; text: string }>,
    footer?: string,
  ): Promise<void> {
    const bridge = this.bridges.get(tenantId);
    if (!bridge?.isRunning()) throw new Error(`Tenant ${tenantId} is not running`);
    await bridge.sendButtons(jid, body, buttons, footer);
  }

  async sendList(
    tenantId: string,
    jid: string,
    body: string,
    buttonText: string,
    sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>,
    footer?: string,
  ): Promise<void> {
    const bridge = this.bridges.get(tenantId);
    if (!bridge?.isRunning()) throw new Error(`Tenant ${tenantId} is not running`);
    await bridge.sendList(jid, body, buttonText, sections, footer);
  }

  rejectCall(tenantId: string, callId: string, callFrom: string): void {
    const bridge = this.bridges.get(tenantId);
    if (!bridge?.isRunning()) return; // best-effort
    bridge.rejectCall(callId, callFrom);
  }

  /**
   * Register a handler for incoming WhatsApp call events.
   * Called once during startup, before tenants are started.
   */
  setCallHandler(handler: (tenantId: string, events: WACallEvent[]) => void): void {
    this.onCallHandler = handler;
  }

  async getStatus(tenantId: string): Promise<{
    running: boolean;
    session: TenantSession | undefined;
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
   * Auto-start all active tenants that were previously connected.
   * Called once on server boot.
   */
  async autoStartTenants(): Promise<void> {
    const tenants = await tenantsRepo.getActiveTenants();
    logger.info(`Auto-starting ${tenants.length} active tenant(s)`);
    logger.debug({ tenantIds: tenants.map(t => t.id) }, 'Active tenants to start');

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
    logger.debug({ tenantCount: ids.length, tenantIds: ids }, 'Shutting down all tenants');
    await Promise.allSettled(ids.map(id => this.stopTenant(id)));
    logger.info('All tenants shut down');
  }
}

export const tenantManager = new TenantManagerImpl();
