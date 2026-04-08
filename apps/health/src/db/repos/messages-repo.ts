/**
 * WhatsApp message logging — stores all inbound/outbound messages.
 */

import { query } from '../pool.js';

export interface WaMessage {
  id: string;
  tenant_id: string;
  channel: string;
  jid: string;
  push_name: string | null;
  direction: 'incoming' | 'outgoing';
  body: string | null;
  timestamp: string;
}

export async function logMessage(msg: {
  tenantId: string;
  channel: string;
  jid: string;
  pushName: string | null;
  direction: 'incoming' | 'outgoing';
  body: string;
  timestamp: string;
}): Promise<void> {
  await query(
    `INSERT INTO wa_messages (tenant_id, channel, jid, push_name, direction, body, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [msg.tenantId, msg.channel, msg.jid, msg.pushName, msg.direction, msg.body, msg.timestamp],
  );
}

export async function getRecentMessages(
  tenantId: string,
  jid: string,
  limit: number = 20,
): Promise<WaMessage[]> {
  const result = await query<WaMessage>(
    `SELECT * FROM wa_messages
     WHERE tenant_id = $1 AND jid = $2
     ORDER BY timestamp DESC
     LIMIT $3`,
    [tenantId, jid, limit],
  );
  return result.rows;
}

export async function getMessagesByTenant(
  tenantId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<{ messages: WaMessage[]; total: number }> {
  const countResult = await query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM wa_messages WHERE tenant_id = $1',
    [tenantId],
  );
  const total = Number(countResult.rows[0]?.count ?? 0);

  const result = await query<WaMessage>(
    `SELECT * FROM wa_messages
     WHERE tenant_id = $1
     ORDER BY timestamp DESC
     LIMIT $2 OFFSET $3`,
    [tenantId, limit, offset],
  );

  return { messages: result.rows, total };
}
