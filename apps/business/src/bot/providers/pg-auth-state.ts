import crypto from 'node:crypto';
import { proto } from '@whiskeysockets/baileys';
import { query, queryOne } from '../../db/pool.js';
import { BufferJSON, initAuthCreds } from '@whiskeysockets/baileys';
import { logger } from '../../shared/logger.js';

// Encryption key for auth state at rest, derived from env secret
const AUTH_STATE_KEY = crypto.createHash('sha256')
  .update(process.env.BETTER_AUTH_SECRET || process.env.AUTH_STATE_KEY || '')
  .digest();

function encryptForStorage(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', AUTH_STATE_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // iv(12) + tag(16) + ciphertext
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptFromStorage(encoded: string): string {
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', AUTH_STATE_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Creates a Baileys auth state that persists to PostgreSQL.
 * Replaces useMultiFileAuthState — no filesystem dependency.
 */
export async function usePostgresAuthState(tenantId: string) {
  const writeData = async (data: unknown): Promise<string> => {
    const json = JSON.stringify(data, BufferJSON.replacer);
    return encryptForStorage(json);
  };

  const readData = async (data: string): Promise<unknown> => {
    // Try decrypting first; fall back to plaintext for migration
    let json: string;
    try {
      json = decryptFromStorage(data);
    } catch {
      // Legacy unencrypted data — parse directly, will be re-encrypted on next write
      json = data;
    }
    return JSON.parse(json, BufferJSON.reviver);
  };

  // Load or initialize creds
  const credsRow = await queryOne<any>(
    'SELECT creds FROM tenant_auth_creds WHERE tenant_id = $1',
    [tenantId],
  );

  let creds: any;
  if (credsRow?.creds) {
    const raw = typeof credsRow.creds === 'string' ? credsRow.creds : JSON.stringify(credsRow.creds);
    try {
      creds = await readData(raw);
    } catch {
      logger.warn({ tenantId }, 'Failed to parse/decrypt auth creds, re-initializing');
      creds = initAuthCreds();
    }
  } else {
    creds = initAuthCreds();
    await query(
      `INSERT INTO tenant_auth_creds (tenant_id, creds) VALUES ($1, $2)
       ON CONFLICT(tenant_id) DO UPDATE SET creds = $2, updated_at = now()`,
      [tenantId, await writeData(creds)],
    );
  }

  const saveCreds = async () => {
    await query(
      `INSERT INTO tenant_auth_creds (tenant_id, creds) VALUES ($1, $2)
       ON CONFLICT(tenant_id) DO UPDATE SET creds = $2, updated_at = now()`,
      [tenantId, await writeData(creds)],
    );
  };

  const state = {
    creds,
    keys: {
      get: async (type: string, ids: string[]) => {
        const data: Record<string, any> = {};
        if (ids.length === 0) return data;

        // Build parameterized query for multiple IDs
        const placeholders = ids.map((_, i) => `$${i + 3}`).join(', ');
        const result = await query<any>(
          `SELECT key_id, key_data FROM tenant_auth_keys
           WHERE tenant_id = $1 AND key_type = $2 AND key_id IN (${placeholders})`,
          [tenantId, type, ...ids],
        );

        for (const row of result.rows) {
          const raw = typeof row.key_data === 'string' ? row.key_data : JSON.stringify(row.key_data);
          let value: unknown;
          try {
            value = await readData(raw);
          } catch {
            logger.warn({ tenantId, keyType: type, keyId: row.key_id }, 'Failed to decrypt/parse auth key, skipping');
            continue;
          }
          if (type === 'app-state-sync-key' && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value);
          }
          data[row.key_id] = value;
        }
        return data;
      },

      set: async (data: Record<string, Record<string, unknown>>) => {
        for (const [type, entries] of Object.entries(data)) {
          for (const [id, value] of Object.entries(entries)) {
            if (value) {
              const serialized = await writeData(value);
              await query(
                `INSERT INTO tenant_auth_keys (tenant_id, key_type, key_id, key_data)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT(tenant_id, key_type, key_id) DO UPDATE SET key_data = $4`,
                [tenantId, type, id, serialized],
              );
            } else {
              await query(
                'DELETE FROM tenant_auth_keys WHERE tenant_id = $1 AND key_type = $2 AND key_id = $3',
                [tenantId, type, id],
              );
            }
          }
        }
      },
    },
  };

  return { state, saveCreds };
}

/**
 * Clears all auth data for a tenant (for reset/re-pair).
 */
export async function clearAuthState(tenantId: string): Promise<void> {
  await query('DELETE FROM tenant_auth_creds WHERE tenant_id = $1', [tenantId]);
  await query('DELETE FROM tenant_auth_keys WHERE tenant_id = $1', [tenantId]);
}
