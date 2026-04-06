export { tenantManager } from './tenant-manager.js';
export type { MessageHandler, TenantRepo, SessionsRepo } from './tenant-manager.js';
export { WorkerBridge, setSessionPersistence } from './worker-bridge.js';
export type { SessionPersistence } from './worker-bridge.js';
export { startHealthCheck, stopHealthCheck, setTenantManager } from './health-check.js';
export type { TenantManagerLike } from './health-check.js';
export { handleMessage, detectIntent, setIntentPatterns, getIntentPatterns } from './handler.js';
export type { IntentPattern } from './handler.js';
export {
  BaileysProvider,
  usePostgresAuthState,
  clearAuthState,
} from './providers/index.js';
export type {
  BaileysProviderOptions,
  Channel,
  IncomingMessage,
  ProviderState,
  MessagingProvider,
} from './providers/index.js';
