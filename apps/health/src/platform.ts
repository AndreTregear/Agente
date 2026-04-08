import { createWebServer } from './web/server.js';
import { runDatabaseMigrations } from './db/migrate.js';
import { startHealthWorker, closeHealthQueue } from './queue/health-queue.js';
import { startReminderScheduler, stopReminderScheduler } from './queue/reminder-scheduler.js';
import { closeRedis } from './queue/redis.js';
import { closePool } from './db/pool.js';
import { tenantManager } from './bot/tenant-manager.js';
import { startHealthCheck, stopHealthCheck } from './bot/health-check.js';
import { logger, logStartupBanner } from './shared/logger.js';

/** Start all platform services and return a shutdown function. */
export async function startPlatform(port: number): Promise<() => Promise<void>> {
  const platformStart = Date.now();
  logStartupBanner();
  logger.info('Yaya Health platform starting...');

  // Run database migrations (idempotent)
  try {
    await runDatabaseMigrations();
    logger.info('Database migrations complete');
  } catch (err) {
    logger.warn(err, 'Database migrations skipped (DB may not be available)');
  }

  // Start web server
  const server = createWebServer(port);

  // Start background workers
  try {
    startHealthWorker();
    startReminderScheduler();
  } catch (err) {
    logger.warn(err, 'Queue workers skipped (Redis may not be available)');
  }

  // Auto-start WhatsApp tenants
  try {
    await tenantManager.autoStartTenants();
    startHealthCheck();
  } catch (err) {
    logger.warn(err, 'Tenant auto-start skipped (DB may not be available)');
  }

  logger.info({ totalStartupMs: Date.now() - platformStart }, 'Yaya Health platform is running');

  return async () => {
    logger.info('Shutting down Yaya Health...');
    server.close();
    stopHealthCheck();
    await tenantManager.shutdownAll();
    await stopReminderScheduler();
    await closeHealthQueue();
    await closeRedis();
    await closePool();
  };
}
