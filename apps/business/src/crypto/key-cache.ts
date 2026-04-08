import crypto from 'node:crypto';
import { getRedisConnection } from '../queue/redis.js';
import { logger } from '../shared/logger.js';

const DEK_PREFIX = 'dek:';
const DEFAULT_TTL = 7 * 24 * 60 * 60; // 7 days (match session TTL)

// Cache encryption key derived from BETTER_AUTH_SECRET or a dedicated env var
const CACHE_KEY = crypto.createHash('sha256')
  .update(process.env.BETTER_AUTH_SECRET || process.env.DEK_CACHE_KEY || '')
  .digest();

function encryptForCache(dek: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', CACHE_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();
  // iv(12) + tag(16) + ciphertext
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptFromCache(cached: string): Buffer {
  const buf = Buffer.from(cached, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', CACHE_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Cache a DEK in Redis (memory only, never persisted to disk by default).
 */
export async function cacheDEK(tenantId: string, dek: Buffer, ttlSeconds?: number): Promise<void> {
  const redis = getRedisConnection();
  await redis.set(
    DEK_PREFIX + tenantId,
    encryptForCache(dek),
    'EX',
    ttlSeconds ?? DEFAULT_TTL,
  );
  logger.debug({ tenantId, ttl: ttlSeconds ?? DEFAULT_TTL }, 'DEK cached in Redis');
}

/**
 * Retrieve a cached DEK from Redis.
 * Returns null if expired or not found (tenant must re-authenticate).
 */
export async function getCachedDEK(tenantId: string): Promise<Buffer | null> {
  const redis = getRedisConnection();
  const encoded = await redis.get(DEK_PREFIX + tenantId);
  if (!encoded) return null;
  return decryptFromCache(encoded);
}

/**
 * Evict a DEK from Redis (on logout or session expiry).
 */
export async function evictDEK(tenantId: string): Promise<void> {
  const redis = getRedisConnection();
  await redis.del(DEK_PREFIX + tenantId);
  logger.debug({ tenantId }, 'DEK evicted from Redis');
}

/**
 * Check if a DEK is cached (tenant has an active session).
 */
export async function hasCachedDEK(tenantId: string): Promise<boolean> {
  const redis = getRedisConnection();
  return (await redis.exists(DEK_PREFIX + tenantId)) === 1;
}
