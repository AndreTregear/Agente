/**
 * TenantManager — orchestrates all tenant workers from the main thread.
 * Genericized from yaya_health. Message handling is fully pluggable.
 */
import { WorkerBridge } from './worker-bridge.js';
import { clearAuthState } from './providers/pg-auth-state.js';
import { query } from '../db/pool.js';
import { DATABASE_URL } from '../config.js';
import { logger } from '../shared/logger.js';
import type { IncomingMessage } from './providers/types.js';
import type { Tenant, TenantSession } from '../shared/types.js';

export type MessageHandler = (tenantId: string, msg: IncomingMessage) => void;

/** Minimal tenant repo functions needed by manager. */
export interface TenantRepo {
  getTenantById(id: string): Promise<Tenant | null>;
  getActiveTenants(): Promise<Tenant[]>;
}

/** Minimal sessions repo functions needed by manager. */
export interface SessionsRepo {
  getSession(tenantId: string): Promise<TenantSession | null>;
}

/** Default tenant repo using direct queries. */
const defaultTenantRepo: TenantRepo = {
  async getTenantById(id: string) {
    const result = await query<Tenant>('SELECT * FROM tenants WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  },
  async getActiveTenants() {
    const result = await query<Tenant>("SELECT * FROM tenants WHERE status = 'active'");
    return result.rows;
  },
};

class TenantManagerImpl {
  private bridges = new Map<string, WorkerBridge>();
  private messageHandler: MessageHandler | null = null;
  private tenantRepo: TenantRepo = defaultTenantRepo;
  private sessionsRepo: SessionsRepo | null = null;

  /**
   * Set the handler called when a message arrives from any tenant.
   */
  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  /**
   * Set custom tenant repository.
   */
  setTenantRepo(repo: TenantRepo): void {
    this.tenantRepo = repo;
  }

  /**
   * Set custom sessions repository.
   */
  setSessionsRepo(repo: SessionsRepo): void {
    this.sessionsRepo = repo;
  }

  getBridge(tenantId: string): WorkerBridge | undefined {
    return this.bridges.get(tenantId);
  }

  getAllBridges(): Map<string, WorkerBridge> {
    return this.bridges;
  }

  async startTenant(tenantId: string): Promise<void> {
    const startTime = Date.now();
    logger.debug({ tenantId }, 'Starting tenant...');

    const tenant = await this.tenantRepo.getTenantById(tenantId);
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);
    if (tenant.status !== 'active') throw new Error(`Tenant ${tenantId} is ${tenant.status}`);

    let bridge = this.bridges.get(tenantId);
    if (bridge?.isRunning()) {
      logger.warn({ tenantId }, 'Tenant already running');
      return;
    }

    bridge = new WorkerBridge(tenantId);

    bridge.setMessageHandler((tid, msg) => {
      if (this.messageHandler) {
        this.messageHandler(tid, msg);
      } else {
        logger.warn({ tenantId: tid }, 'No message handler set — message dropped');
      }
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
    startedAt: Date | null;
    messagesHandled: number;
    qrAvailable: boolean;
  }> {
    const bridge = this.bridges.get(tenantId);

    return {
      running: bridge?.isRunning() ?? false,
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
    const tenants = await this.tenantRepo.getActiveTenants();
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
