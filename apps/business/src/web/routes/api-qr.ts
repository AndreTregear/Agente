import { Router, type Request, type Response } from 'express';
import { appBus } from '../../shared/events.js';
import { logger } from '../../shared/logger.js';

const router = Router();

// Per-tenant QR state
const tenantQRs = new Map<string, string>(); // tenantId → QR data URL
const tenantConnected = new Set<string>();     // set of connected tenantIds

appBus.on('qr', (tenantId: string, dataUrl: string) => {
  logger.debug({ tenantId, qrLength: dataUrl?.length }, 'QR code event received');
  tenantQRs.set(tenantId, dataUrl);
  tenantConnected.delete(tenantId);
});

appBus.on('connection-update', (tenantId: string, state: string) => {
  logger.debug({ tenantId, state }, 'QR route: connection-update event');
  if (state === 'open') {
    tenantQRs.delete(tenantId);
    tenantConnected.add(tenantId);
  } else if (state === 'close') {
    tenantConnected.delete(tenantId);
  }
});

router.get('/', (req: Request, res: Response) => {
  // Get tenant from auth middleware (requireTenantOwner sets this)
  const tenantId = (req as any).tenantId;

  if (!tenantId) {
    res.json({ status: 'disconnected', qr: null });
    return;
  }

  const isConnected = tenantConnected.has(tenantId);
  const qr = tenantQRs.get(tenantId) || null;

  if (isConnected) {
    res.json({ status: 'connected', qr: null });
  } else if (qr) {
    res.json({ status: 'waiting', qr });
  } else {
    res.json({ status: 'disconnected', qr: null });
  }
});

export { router as qrRouter };
