/**
 * HealthCheckService — monitors all tenant workers periodically.
 * Detects dead workers and attempts recovery.
 */
import { appBus } from '../shared/events.js';
import { logger } from '../shared/logger.js';

const CHECK_INTERVAL_MS = 30_000;        // 30 seconds
const RESPAWN_COOLDOWN_MS = 60_000;       // 1 minute minimum between respawns

/** Track last respawn time per tenant. */
const lastRespawn = new Map<string, number>();

let interval: ReturnType<typeof setInterval> | null = null;

export interface TenantManagerLike {
  getAllBridges(): Map<string, { isRunning(): boolean; isAlive(): boolean }>;
  stopTenant(tenantId: string): Promise<void>;
  startTenant(tenantId: string): Promise<void>;
}

let manager: TenantManagerLike | null = null;

/**
 * Set the tenant manager to monitor.
 */
export function setTenantManager(tm: TenantManagerLike): void {
  manager = tm;
}

export function startHealthCheck(): void {
  if (interval) return;
  if (!manager) {
    logger.warn('Cannot start health check — no tenant manager set');
    return;
  }

  const tm = manager;

  interval = setInterval(async () => {
    const bridges = tm.getAllBridges();

    for (const [tenantId, bridge] of bridges) {
      if (!bridge.isRunning()) continue;

      if (!bridge.isAlive()) {
        const now = Date.now();
        const last = lastRespawn.get(tenantId) ?? 0;
        if (now - last < RESPAWN_COOLDOWN_MS) continue;

        logger.warn({ tenantId }, 'Health check: worker appears dead, attempting respawn');
        appBus.emit('tenant-health-alert', tenantId, 'Worker unresponsive, respawning');
        lastRespawn.set(tenantId, now);

        try {
          await tm.stopTenant(tenantId);
          await tm.startTenant(tenantId);
          logger.info({ tenantId }, 'Health check: tenant respawned successfully');
        } catch (err) {
          logger.error({ tenantId, err }, 'Health check: respawn failed, will retry next cycle');
        }
      } else {
        lastRespawn.delete(tenantId);
      }
    }
  }, CHECK_INTERVAL_MS);

  logger.info('Health check service started');
}

export function stopHealthCheck(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
    logger.info('Health check service stopped');
  }
}
