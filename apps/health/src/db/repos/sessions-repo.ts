/**
 * WhatsApp session tracking — connection status per tenant.
 */

import { query } from '../pool.js';
import { logger } from '../../shared/logger.js';

export interface TenantSession {
  tenant_id: string;
  phone: string | null;
  connection_status: 'connected' | 'disconnected' | 'qr_pending' | 'connecting';
  error_message: string | null;
  reconnect_attempts: number;
  last_connected_at: string | null;
  last_qr_at: string | null;
  updated_at: string;
}

export async function getSession(tenantId: string): Promise<TenantSession | null> {
  const result = await query<TenantSession>(
    `SELECT * FROM tenant_sessions WHERE tenant_id = $1`,
    [tenantId],
  );
  return result.rows[0] ?? null;
}

export async function upsertSession(
  tenantId: string,
  phone: string | null,
  status: TenantSession['connection_status'],
): Promise<TenantSession> {
  const result = await query<TenantSession>(
    `INSERT INTO tenant_sessions (tenant_id, phone, connection_status, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (tenant_id) DO UPDATE SET
       phone = COALESCE($2, tenant_sessions.phone),
       connection_status = $3,
       error_message = NULL,
       updated_at = now()
     RETURNING *`,
    [tenantId, phone, status],
  );

  logger.info({ tenantId, status }, 'Session upserted');
  return result.rows[0] ?? null;
}

export async function updateConnectionStatus(
  tenantId: string,
  status: TenantSession['connection_status'],
  phone?: string,
): Promise<void> {
  const extra = status === 'connected' ? ', last_connected_at = now(), reconnect_attempts = 0' : '';
  await query(
    `UPDATE tenant_sessions SET connection_status = $1, error_message = NULL, updated_at = now()${extra} WHERE tenant_id = $2`,
    [status, tenantId],
  );

  if (phone) {
    await query('UPDATE tenants SET phone = $1, updated_at = now() WHERE id = $2', [phone, tenantId]);
  }
}

export async function updateQrTimestamp(tenantId: string): Promise<void> {
  await query(
    'UPDATE tenant_sessions SET last_qr_at = now(), updated_at = now() WHERE tenant_id = $1',
    [tenantId],
  );
}

export async function incrementReconnectAttempts(tenantId: string, errorMessage?: string): Promise<number> {
  const result = await query<{ reconnect_attempts: number }>(
    `UPDATE tenant_sessions SET reconnect_attempts = reconnect_attempts + 1,
     error_message = COALESCE($1, error_message), updated_at = now()
     WHERE tenant_id = $2 RETURNING reconnect_attempts`,
    [errorMessage ?? null, tenantId],
  );
  return result.rows[0]?.reconnect_attempts ?? 0;
}

export async function setSessionError(tenantId: string, error: string): Promise<void> {
  await query(
    "UPDATE tenant_sessions SET connection_status = 'disconnected', error_message = $1, updated_at = now() WHERE tenant_id = $2",
    [error, tenantId],
  );
}
