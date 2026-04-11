import { Router } from 'express';
import crypto from 'node:crypto';
import * as tenantsRepo from '../../db/tenants-repo.js';
import * as devicesRepo from '../../db/devices-repo.js';
import * as paymentService from '../../services/payment-service.js';
import { requireDeviceAuth } from '../middleware/device-auth.js';
import { BETTER_AUTH_SECRET } from '../../config.js';
import { logger } from '../../shared/logger.js';
import { validateBody, getTenantId, getDeviceId } from '../../shared/validate.js';
import { deviceRegisterSchema, paymentSyncSchema, batchPaymentSyncSchema } from '../../shared/validation.js';
import { encryptRecord } from '../../crypto/middleware.js';
import { queryOne } from '../../db/pool.js';
import * as orderService from '../../services/order-service.js';

const router = Router();

// --- Health check (no auth) ---

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// --- Device registration (no auth — uses API key in body) ---

router.post('/devices/register', validateBody(deviceRegisterSchema), async (req, res) => {
  const { businessName, phoneNumber, deviceId, apiKey } = req.body;

  const tenant = await tenantsRepo.getTenantByApiKey(apiKey);
  if (!tenant || tenant.status !== 'active') {
    res.status(401).json({ error: 'Invalid or inactive API key' });
    return;
  }

  const token = crypto
    .createHmac('sha256', BETTER_AUTH_SECRET)
    .update(`${deviceId}:${tenant.id}:${Date.now()}`)
    .digest('hex');

  const device = await devicesRepo.createDevice(tenant.id, deviceId, businessName, phoneNumber, token);

  logger.info({ tenantId: tenant.id, deviceId }, 'Agente device registered');

  res.status(201).json({
    businessId: tenant.id,
    token: device.token,
  });
});

// --- Payment sync (device auth required) ---

router.post('/payments/sync', requireDeviceAuth, validateBody(paymentSyncSchema), async (req, res) => {
  const tenantId = getTenantId(req);
  const deviceId = getDeviceId(req);
  const { senderName, amount, capturedAt, notificationHash } = req.body;

  // Encrypt sender_name before persisting
  const encrypted = await encryptRecord(tenantId, 'yape_notifications', { sender_name: senderName });
  const result = await paymentService.syncYapeNotification(
    tenantId, deviceId, encrypted.sender_name as string, Number(amount), new Date(capturedAt), notificationHash,
  );

  res.json({ id: String(result.notificationId), status: result.status });
});

// --- Batch payment sync (device auth required) ---

router.post('/payments/sync/batch', requireDeviceAuth, validateBody(batchPaymentSyncSchema), async (req, res) => {
  const tenantId = getTenantId(req);
  const deviceId = getDeviceId(req);
  const { payments } = req.body;

  const results: { id: string; status: string }[] = [];

  // Process sequentially to avoid race conditions in matching
  for (const p of payments) {
    const { senderName, amount, capturedAt, notificationHash } = p;
    // Encrypt sender_name before persisting
    const encrypted = await encryptRecord(tenantId, 'yape_notifications', { sender_name: senderName });
    const result = await paymentService.syncYapeNotification(
      tenantId, deviceId, encrypted.sender_name as string, Number(amount), new Date(capturedAt), notificationHash,
    );
    results.push({ id: String(result.notificationId), status: result.status });
  }

  res.json({ results });
});

router.post('/webhook', async (req, res) => {
  try {
    // Verify webhook signature (HMAC-SHA256)
    const webhookSecret = process.env.YAPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('YAPE_WEBHOOK_SECRET not configured — rejecting webhook');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    const signature = req.headers['x-webhook-signature'] as string;
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }

    // Use raw body if available (set by express.json verify option), else re-serialize
    const bodyForHmac = (req as any).rawBody ?? JSON.stringify(req.body);
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(bodyForHmac)
      .digest('hex');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      logger.warn('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { type, data } = req.body;
    if (type === 'payment_intent.succeeded' && data?.clientReferenceId) {
      const orderIdMatch = data.clientReferenceId.match(/order_(\d+)/);
      if (orderIdMatch) {
        const orderId = parseInt(orderIdMatch[1], 10);
        const row = await queryOne<{ tenant_id: string }>('SELECT tenant_id FROM orders WHERE id = $1', [orderId]);
        if (row) {
          await orderService.markPaid(row.tenant_id, orderId, 0, `yaya_pay:${data.id}`);
        }
      }
    }
    res.json({ received: true });
  } catch (err) {
    logger.error({ err }, 'Webhook processing failed');
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export { router as yapeRouter };
