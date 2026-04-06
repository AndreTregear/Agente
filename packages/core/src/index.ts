// @yaya/core — shared infrastructure for Yaya platform apps

// ── Config ──
export * from './config.js';

// ── Shared ──
export { logger, logStartupBanner } from './shared/logger.js';
export { appBus } from './shared/events.js';
export type {
  IncomingMessage,
  OutgoingMessage,
  TenantConfig,
  TenantSession,
  Tenant,
  WorkerCommand,
  WorkerEvent,
  ProviderIncomingMessage,
} from './shared/types.js';

// ── Database ──
export { pool, query, transaction, closePool } from './db/pool.js';
export { runDatabaseMigrations } from './db/migrate.js';

// ── Crypto ──
export { deriveKEK, generateDEK, generateSalt, encryptDEK, decryptDEK } from './crypto/envelope.js';
export { encryptField, decryptField, isEncrypted } from './crypto/field-crypto.js';
export { encryptRow, decryptRow, setEncryptedColumns, getEncryptedColumns } from './crypto/middleware.js';

// ── Queue ──
export { getRedis, getRedisConnection, closeRedis } from './queue/redis.js';
export { QueueFactory, registerQueue, getQueueFactory, closeAllQueues } from './queue/queue-factory.js';
export type { QueueFactoryOptions } from './queue/queue-factory.js';
export {
  checkAndIncrementRateLimit,
  getRateLimitStatus,
  acquireTenantSlot,
  releaseTenantSlot,
} from './queue/rate-limiter.js';
export { getAIQueue, enqueueAIJob, startAIWorker, closeAIQueue } from './queue/ai-queue.js';
export { AI_QUEUE_NAME } from './queue/types.js';
export type { AIJobData, AIJobResult } from './queue/types.js';

// ── AI ──
export {
  processWithOpenClaw,
  processPrivilegedWithOpenClaw,
  isPrivilegedUser,
  setContextBuilder,
  setFallbackMessageFn,
} from './ai/openclaw-bridge.js';
export type { OpenClawBridgeResult, ContextBuilder } from './ai/openclaw-bridge.js';

// ── Bot ──
export { handleMessage, detectIntent, setIntentPatterns, getIntentPatterns } from './bot/handler.js';
export type { IntentPattern } from './bot/handler.js';
export { startHealthCheck, stopHealthCheck, setTenantManager } from './bot/health-check.js';
export type { TenantManagerLike } from './bot/health-check.js';
export { tenantManager } from './bot/tenant-manager.js';
export type { MessageHandler, TenantRepo, SessionsRepo } from './bot/tenant-manager.js';
export { WorkerBridge, setSessionPersistence } from './bot/worker-bridge.js';
export type { SessionPersistence } from './bot/worker-bridge.js';

// ── Providers ──
export { BaileysProvider } from './bot/providers/baileys.js';
export type { BaileysProviderOptions } from './bot/providers/baileys.js';
export { usePostgresAuthState, clearAuthState } from './bot/providers/pg-auth-state.js';
export type {
  Channel,
  IncomingMessage as ProviderMessage,
  ProviderState,
  MessagingProvider,
} from './bot/providers/types.js';

// ── Platform ──
export { startPlatform } from './platform.js';
export type { PlatformOptions } from './platform.js';

// ── Voice (WhatsApp calls + fast voice pipeline) ──
export { createCallHandler } from './voice/call-handler.js';
export type { WACallEvent, CallHandlerOptions } from './voice/call-handler.js';
export { createVoicePipeline } from './voice/fast-voice-pipeline.js';
export type { VoicePipelineConfig, VoicePipelineResult } from './voice/fast-voice-pipeline.js';
