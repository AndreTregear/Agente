/**
 * Generic platform bootstrap for @yaya/core.
 * Apps import and call startPlatform() with their specific setup.
 */

import { runDatabaseMigrations } from './db/migrate.js';
import { closeRedis } from './queue/redis.js';
import { closePool } from './db/pool.js';
import { startAIWorker, closeAIQueue } from './queue/ai-queue.js';
import { tenantManager } from './bot/tenant-manager.js';
import { startHealthCheck, stopHealthCheck, setTenantManager } from './bot/health-check.js';
import { logger, logStartupBanner } from './shared/logger.js';

export interface PlatformOptions {
  /** Application name for startup banner */
  appName?: string;
  /** Port number (informational, actual server creation is up to the app) */
  port?: number;
  /** Schema files to run on startup */
  schemaFiles?: string[];
  /** Custom setup hook — called after DB migrations, before tenant auto-start */
  onSetup?: () => Promise<void>;
}

/** Start core platform services and return a shutdown function. */
export async function startPlatform(options: PlatformOptions = {}): Promise<() => Promise<void>> {
  const platformStart = Date.now();
  logStartupBanner(options.appName);
  logger.info(`${options.appName || '@yaya/core'} platform starting...`);

  // Run database migrations (idempotent)
  try {
    await runDatabaseMigrations(options.schemaFiles);
    logger.info('Database migrations complete');
  } catch (err) {
    logger.warn(err, 'Database migrations skipped (DB may not be available)');
  }

  // Custom setup hook
  if (options.onSetup) {
    await options.onSetup();
  }

  // Start AI queue worker
  try {
    startAIWorker();
  } catch (err) {
    logger.warn(err, 'AI queue worker skipped (Redis may not be available)');
  }

  // Auto-start WhatsApp tenants
  try {
    await tenantManager.autoStartTenants();
    setTenantManager(tenantManager);
    startHealthCheck();
  } catch (err) {
    logger.warn(err, 'Tenant auto-start skipped (DB may not be available)');
  }

  logger.info({ totalStartupMs: Date.now() - platformStart }, `${options.appName || '@yaya/core'} platform is running`);

  return async () => {
    logger.info(`Shutting down ${options.appName || '@yaya/core'}...`);
    stopHealthCheck();
    await tenantManager.shutdownAll();
    await closeAIQueue();
    await closeRedis();
    await closePool();
  };
}
