import { appBus } from '../shared/events.js';
import { tenantManager } from '../bot/tenant-manager.js';
import { query as dbQuery } from '../db/pool.js';
import { logger } from '../shared/logger.js';

appBus.on('order-paid', async (tenantId: string, orderId: number, customerJid: string) => {
  try {
    const rulesResult = await dbQuery<any>(
      `SELECT action_type, action_payload FROM tenant_rules WHERE tenant_id = $1 AND trigger_event = $2`,
      [tenantId, 'order.paid']
    );

    for (const rule of rulesResult.rows) {
      if (rule.action_type === 'send_message') {
        const payload = typeof rule.action_payload === 'string' ? JSON.parse(rule.action_payload) : rule.action_payload;
        if (payload && payload.message) {
          await tenantManager.sendMessage(tenantId, customerJid, payload.message);
        }
      } else if (rule.action_type === 'webhook') {
        logger.info({ tenantId, rule }, 'Webhook rule triggered for order.paid');
      }
    }
  } catch (err) {
    logger.error({ err, tenantId, orderId }, 'Error executing tenant rules for order-paid');
  }
});
