import http from 'node:http';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../shared/logger.js';
import { tenantManager } from '../bot/tenant-manager.js';
import * as tenantsRepo from '../db/repos/tenants-repo.js';
import * as sessionsRepo from '../db/repos/sessions-repo.js';
import * as messagesRepo from '../db/repos/messages-repo.js';
import { pool } from '../db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createWebServer(port: number): http.Server {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // ── Static files ──
  app.use(express.static(path.resolve(__dirname, 'public')));

  // ── Request logging ──
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      if (req.path === '/health' || req.path === '/api/v1/health') return;
      if (!req.path.startsWith('/api/')) return;
      logger.debug({ method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start }, 'HTTP');
    });
    next();
  });

  // ── Health check ──
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'yaya-health', timestamp: new Date().toISOString() });
  });

  // ── API v1 routes ──
  const api = express.Router();

  // ── Health check (API version) ──
  api.get('/health', async (_req, res) => {
    const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

    try {
      const start = Date.now();
      await pool.query('SELECT 1');
      checks.postgres = { status: 'ok', latencyMs: Date.now() - start };
    } catch (e: any) {
      checks.postgres = { status: 'error', error: e.message };
    }

    const allOk = Object.values(checks).every(c => c.status === 'ok');
    res.status(allOk ? 200 : 503).json({
      status: allOk ? 'healthy' : 'unhealthy',
      service: 'yaya-health',
      timestamp: new Date().toISOString(),
      checks,
    });
  });

  // ════════════════════════════════════════════════════════════════
  // TENANT ROUTES
  // ════════════════════════════════════════════════════════════════

  // GET /api/v1/tenants — list all tenants
  api.get('/tenants', async (_req, res, next) => {
    try {
      const tenants = await tenantsRepo.getAllTenants();
      res.json({ tenants });
    } catch (err) { next(err); }
  });

  // POST /api/v1/tenants — create a new tenant
  api.post('/tenants', async (req, res, next) => {
    try {
      const { name, phone, status } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'name is required' });
      }
      const tenant = await tenantsRepo.createTenant(name, phone ?? null, status ?? 'active');
      res.status(201).json({ tenant });
    } catch (err) { next(err); }
  });

  // GET /api/v1/tenants/:id — get a single tenant
  api.get('/tenants/:id', async (req, res, next) => {
    try {
      const tenant = await tenantsRepo.getTenantById(req.params.id);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      res.json({ tenant });
    } catch (err) { next(err); }
  });

  // PATCH /api/v1/tenants/:id — update tenant fields
  api.patch('/tenants/:id', async (req, res, next) => {
    try {
      const { name, phone, status } = req.body;
      const tenant = await tenantsRepo.updateTenant(req.params.id, { name, phone, status });
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      res.json({ tenant });
    } catch (err) { next(err); }
  });

  // ════════════════════════════════════════════════════════════════
  // WHATSAPP CONNECTION ROUTES
  // ════════════════════════════════════════════════════════════════

  // POST /api/v1/tenants/:id/start — start WhatsApp connection
  api.post('/tenants/:id/start', async (req, res, next) => {
    try {
      const tenant = await tenantsRepo.getTenantById(req.params.id);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      await tenantManager.startTenant(tenant.id);
      res.json({ status: 'connecting', tenantId: tenant.id });
    } catch (err) { next(err); }
  });

  // POST /api/v1/tenants/:id/stop — stop WhatsApp connection
  api.post('/tenants/:id/stop', async (req, res, next) => {
    try {
      const tenant = await tenantsRepo.getTenantById(req.params.id);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      await tenantManager.stopTenant(tenant.id);
      res.json({ status: 'disconnected', tenantId: tenant.id });
    } catch (err) { next(err); }
  });

  // POST /api/v1/tenants/:id/reset — reset WhatsApp auth
  api.post('/tenants/:id/reset', async (req, res, next) => {
    try {
      const tenant = await tenantsRepo.getTenantById(req.params.id);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      await tenantManager.resetTenant(tenant.id);
      res.json({ status: 'reset', tenantId: tenant.id });
    } catch (err) { next(err); }
  });

  // GET /api/v1/tenants/:id/qr — get QR code for pairing
  api.get('/tenants/:id/qr', async (req, res, next) => {
    try {
      const tenant = await tenantsRepo.getTenantById(req.params.id);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      const qr = tenantManager.getQr(tenant.id);
      if (!qr) {
        return res.status(404).json({ error: 'No QR available. Start the connection first.' });
      }
      res.json({ qr, tenantId: tenant.id });
    } catch (err) { next(err); }
  });

  // GET /api/v1/tenants/:id/status — connection status
  api.get('/tenants/:id/status', async (req, res, next) => {
    try {
      const tenant = await tenantsRepo.getTenantById(req.params.id);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      const session = await tenantManager.getStatus(tenant.id);
      res.json({
        tenantId: tenant.id,
        connected: tenantManager.getBridge(tenant.id)?.isRunning() ?? false,
        session,
      });
    } catch (err) { next(err); }
  });

  // POST /api/v1/tenants/:id/send — send a message
  api.post('/tenants/:id/send', async (req, res, next) => {
    try {
      const { jid, text } = req.body;
      if (!jid || !text) {
        return res.status(400).json({ error: 'jid and text are required' });
      }
      const tenant = await tenantsRepo.getTenantById(req.params.id);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      if (!tenantManager.getBridge(tenant.id)?.isRunning()) {
        return res.status(409).json({ error: 'Tenant is not connected to WhatsApp' });
      }
      await tenantManager.sendMessage(tenant.id, jid, text);
      res.json({ status: 'sent', tenantId: tenant.id, jid });
    } catch (err) { next(err); }
  });

  // ════════════════════════════════════════════════════════════════
  // HEALTH-DOMAIN PLACEHOLDER ROUTES (existing)
  // ════════════════════════════════════════════════════════════════

  api.get('/patients', async (_req, res) => {
    // TODO: List patients for tenant
    res.json({ patients: [] });
  });

  api.post('/growth', async (req, res) => {
    // TODO: Record growth measurement
    res.json({ success: true, message: 'Growth measurement recorded' });
  });

  api.post('/food-log', async (req, res) => {
    // TODO: Process food log
    res.json({ success: true, message: 'Food log recorded' });
  });

  api.post('/health-reading', async (req, res) => {
    // TODO: Record health reading
    res.json({ success: true, message: 'Health reading recorded' });
  });

  api.get('/medications/:patientId', async (req, res) => {
    // TODO: List medications for patient
    res.json({ medications: [] });
  });

  app.use('/api/v1', api);

  // ── Global error handler ──
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err: err.message, stack: err.stack }, 'Unhandled route error');
    res.status(500).json({ error: 'Internal server error' });
  });

  const server = app.listen(port, () => {
    logger.info({ port }, 'Web server listening');
  });
  return server;
}
