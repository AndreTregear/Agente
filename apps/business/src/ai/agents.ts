/**
 * Shared Mastra Agents — single source of truth for all AI agents.
 *
 * Used by:
 *   - WhatsApp message processing (mastra-bridge.ts)
 *   - Express API routes (api-agente.ts)
 *   - Background task execution (task engine)
 *
 * All tools use autobot's pg pool (query returns pg.QueryResult, access .rows).
 */

import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getDevicesByTenant } from '../db/devices-repo.js';
import { getEffectiveSetting } from '../db/settings-repo.js';
import { query as dbQuery, queryOne as dbQueryOne, transaction as dbTransaction } from '../db/pool.js';
import { logger } from '../shared/logger.js';
import { checkYapePayment, confirmYapePayment, setCurrentTenantId as setYapeTenantId } from './tools/yape-tools.js';
import { knowledgeSearch, pageIndexLookup, knowledgeGraphQuery, knowledgeAnnotate } from './tools/knowledge-tools.js';
import { getModel, backends } from './model-router.js';

// ── LLM Models ──

/** Local model (35B) — fast, good for simple queries. */
export const localModel = getModel('local');

/** HPC model (122B) — accurate, good for complex/agentic tasks. */
export const hpcModel = getModel('hpc');

// ── Tenant Context ──
// Mutable tenant ID — set per-request before calling the agent.
// For CEO/dashboard use, defaults to DEFAULT_TENANT_ID env var.

let _currentTenantId = '';

export function setTenantId(id: string): void {
  _currentTenantId = id;
  setYapeTenantId(id); // sync Yape tools context
}

export function getTenantId(): string {
  return _currentTenantId || process.env.DEFAULT_TENANT_ID || '';
}

// ── Business Tools ──

export const businessMetrics = createTool({
  id: 'business-metrics',
  description: 'Get revenue, orders, payments for today/week/month.',
  inputSchema: z.object({
    period: z.enum(['today', 'week', 'month']).default('today'),
  }),
  execute: async ({ period }) => {
    const tenantId = getTenantId();
    if (!tenantId) return { error: 'No tenant configured' };

    const intervalMap: Record<string, string> = { week: '7 days', month: '30 days', today: '0 days' };
    const p = period ?? 'today';
    const interval = intervalMap[p] || '0 days';
    const useInterval = p === 'week' || p === 'month';
    const dateFilter = useInterval
      ? 'o.created_at >= NOW() - $2::interval'
      : 'o.created_at::date = CURRENT_DATE';
    const dateParams = useInterval ? [tenantId, interval] : [tenantId];
    const periodLabel = p === 'week' ? 'ultimos 7 dias' : p === 'month' ? 'ultimos 30 dias' : 'hoy';

    // For payment query, tenant_id is $1 and interval (if used) shifts to $2
    const paymentDateFilter = useInterval
      ? 'o.created_at >= NOW() - $2::interval'
      : 'o.created_at::date = CURRENT_DATE';

    const [rev, statuses, payments, pending, customers] = await Promise.all([
      dbQueryOne<any>(
        `SELECT COALESCE(SUM(total),0) as total_revenue, COUNT(*) as order_count FROM orders o WHERE tenant_id=$1 AND ${dateFilter}`,
        dateParams,
      ),
      dbQuery<any>(
        `SELECT status, COUNT(*) as count FROM orders o WHERE tenant_id=$1 AND ${dateFilter} GROUP BY status ORDER BY count DESC`,
        dateParams,
      ),
      dbQuery<any>(
        `SELECT p.method, COALESCE(SUM(p.amount),0) as total, COUNT(*) as count FROM payments p JOIN orders o ON p.order_id=o.id AND o.tenant_id=p.tenant_id WHERE p.tenant_id=$1 AND p.status='confirmed' AND ${paymentDateFilter} GROUP BY p.method ORDER BY total DESC`,
        dateParams,
      ),
      dbQueryOne<any>(
        `SELECT COUNT(*) as count FROM orders WHERE tenant_id=$1 AND status IN ('pending','payment_requested')`,
        [tenantId],
      ),
      dbQueryOne<any>(
        `SELECT COUNT(*) as count FROM customers WHERE tenant_id=$1`,
        [tenantId],
      ),
    ]);

    return {
      period: periodLabel,
      revenue: rev?.total_revenue ?? '0',
      order_count: rev?.order_count ?? '0',
      pending_orders: pending?.count ?? '0',
      total_customers: customers?.count ?? '0',
      orders_by_status: statuses?.rows ?? [],
      payments_by_method: payments?.rows ?? [],
    };
  },
});

export const customerLookup = createTool({
  id: 'customer-lookup',
  description: 'Search customer by name or phone. Returns contact info and recent orders.',
  inputSchema: z.object({
    query: z.string().describe('Customer name or phone number'),
  }),
  execute: async ({ query: q }) => {
    const tenantId = getTenantId();
    if (!tenantId) return { customers: [], error: 'No tenant configured' };

    const result = await dbQuery<any>(
      `SELECT c.id, c.name, c.phone, c.jid, c.tags, c.created_at,
              COALESCE(json_agg(json_build_object(
                'id', o.id, 'status', o.status, 'total', o.total, 'created_at', o.created_at
              ) ORDER BY o.created_at DESC) FILTER (WHERE o.id IS NOT NULL), '[]') as recent_orders
       FROM customers c
       LEFT JOIN LATERAL (
         SELECT * FROM orders WHERE tenant_id = c.tenant_id AND customer_id = c.id
         ORDER BY created_at DESC LIMIT 3
       ) o ON true
       WHERE c.tenant_id=$1 AND (c.name ILIKE $2 OR c.phone LIKE $3 OR c.jid LIKE $3)
       GROUP BY c.id
       ORDER BY c.updated_at DESC
       LIMIT 5`,
      [tenantId, `%${q}%`, `%${q}%`],
    );

    if (result.rows.length === 0) return { customers: [], message: `No customer found matching "${q}".` };

    return { customers: result.rows };
  },
});

export const paymentStatus = createTool({
  id: 'payment-status',
  description: 'Check pending payments or a specific order payment status.',
  inputSchema: z.object({
    order_id: z.number().optional(),
    customer_name: z.string().optional(),
  }),
  execute: async ({ order_id, customer_name }) => {
    const tenantId = getTenantId();
    if (!tenantId) return { error: 'No tenant configured' };

    if (order_id) {
      const order = await dbQueryOne<any>(
        `SELECT o.id, o.status, o.total, o.created_at, c.name as customer_name FROM orders o LEFT JOIN customers c ON c.id=o.customer_id AND c.tenant_id=o.tenant_id WHERE o.tenant_id=$1 AND o.id=$2`,
        [tenantId, order_id],
      );
      if (!order) return { message: `Order #${order_id} not found.` };
      const paymentsResult = await dbQuery<any>(
        `SELECT method, amount, status, created_at FROM payments WHERE tenant_id=$1 AND order_id=$2 ORDER BY created_at DESC`,
        [tenantId, order_id],
      );
      return { order, payments: paymentsResult.rows };
    }

    const params: unknown[] = [tenantId];
    let filter = '';
    if (customer_name) { filter = ' AND c.name ILIKE $2'; params.push(`%${customer_name}%`); }

    const pendingResult = await dbQuery<any>(
      `SELECT o.id as order_id, c.name as customer_name, o.total, o.status, o.created_at FROM orders o LEFT JOIN customers c ON c.id=o.customer_id AND c.tenant_id=o.tenant_id WHERE o.tenant_id=$1 AND o.status IN ('pending','payment_requested')${filter} ORDER BY o.created_at DESC LIMIT 10`,
      params,
    );

    if (pendingResult.rows.length === 0) {
      return { message: customer_name ? `No pending payments for "${customer_name}".` : 'No pending payments!' };
    }

    const total = pendingResult.rows.reduce((s: number, p: any) => s + parseFloat(p.total), 0).toFixed(2);
    return { pending_count: pendingResult.rows.length, total_pending: total, orders: pendingResult.rows };
  },
});

export const calendarToday = createTool({
  id: 'calendar-today',
  description: "Get today's appointments and schedule.",
  inputSchema: z.object({}),
  execute: async () => {
    const tenantId = getTenantId();
    if (!tenantId) return { message: 'No tenant configured' };

    const result = await dbQuery<any>(
      `SELECT a.id, a.service_name, a.scheduled_at, a.duration_minutes, a.status, a.notes, c.name as customer_name FROM appointments a LEFT JOIN customers c ON c.id=a.customer_id AND c.tenant_id=a.tenant_id WHERE a.tenant_id=$1 AND a.scheduled_at::date=CURRENT_DATE AND a.status NOT IN ('cancelled') ORDER BY a.scheduled_at`,
      [tenantId],
    );

    if (result.rows.length === 0) return { message: 'No appointments scheduled for today.' };
    return { count: result.rows.length, appointments: result.rows };
  },
});

export const sendMessage = createTool({
  id: 'send-message',
  description: 'Send a WhatsApp message to a customer by name or phone number.',
  inputSchema: z.object({
    phone: z.string().describe('Customer name or phone number'),
    message: z.string().describe('Message text to send'),
  }),
  execute: async ({ phone, message }) => {
    const tenantId = getTenantId();
    if (!tenantId) return { to: phone, message, error: 'No tenant configured' };

    let jid = phone;
    let displayName = phone;

    if (!/\d{5,}/.test(phone)) {
      const customer = await dbQueryOne<any>(
        `SELECT jid, name FROM customers WHERE tenant_id=$1 AND name ILIKE $2 LIMIT 1`,
        [tenantId, `%${phone}%`],
      );
      if (!customer) return { to: phone, message, error: `No customer found matching "${phone}".` };
      jid = customer.jid;
      displayName = customer.name;
    } else {
      jid = `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
    }

    const gatewayUrl = process.env.WHATSAPP_GATEWAY_URL ?? 'http://localhost:3284';
    const account = process.env.WHATSAPP_ACCOUNT ?? 'default';

    try {
      const res = await fetch(`${gatewayUrl}/api/sessions/${account}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: jid, type: 'text', text: { body: message } }),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) return { sent: true, to: displayName, message: message.slice(0, 100) };
    } catch { /* gateway not available */ }

    return { queued: true, to: displayName, message: message.slice(0, 100) };
  },
});

// ── Product / Catalog Tools ──

export const productCatalog = createTool({
  id: 'product-catalog',
  description: 'List products, search by name/category, get prices and stock. Use this when customers ask about menu, prices, or availability.',
  inputSchema: z.object({
    query: z.string().optional().describe('Product name or category to search'),
    category: z.string().optional().describe('Filter by category'),
  }),
  execute: async ({ query: q, category }) => {
    const tenantId = getTenantId();
    if (!tenantId) return { error: 'No tenant configured' };

    const params: unknown[] = [tenantId];
    let where = 'WHERE tenant_id=$1 AND active=true';
    if (q) { where += ' AND (name ILIKE $2 OR category ILIKE $2)'; params.push(`%${q}%`); }
    else if (category) { where += ' AND category ILIKE $2'; params.push(`%${category}%`); }

    const result = await dbQuery<any>(
      `SELECT name, price, category, stock, description FROM products ${where} ORDER BY category, name LIMIT 20`,
      params,
    );

    if (result.rows.length === 0) {
      return { message: q ? `No encontré productos con "${q}".` : 'No hay productos en el catálogo.' };
    }

    return {
      count: result.rows.length,
      products: result.rows.map((p: any) => ({
        name: p.name,
        price: `S/${Number(p.price).toFixed(2)}`,
        category: p.category,
        stock: p.stock ?? 'unlimited',
        description: p.description || undefined,
      })),
    };
  },
});

export const createOrder = createTool({
  id: 'create-order',
  description: 'Create a new order for a customer. Use when customer confirms they want to buy. Requires customer JID or phone and product list with quantities.',
  inputSchema: z.object({
    customer_phone: z.string().describe('Customer phone number or JID'),
    items: z.array(z.object({
      product_name: z.string().describe('Product name (exact or partial match)'),
      quantity: z.number().min(1).describe('Quantity'),
    })).min(1),
    notes: z.string().optional(),
    delivery_address: z.string().optional(),
  }),
  execute: async ({ customer_phone, items, notes, delivery_address }) => {
    const tenantId = getTenantId();
    if (!tenantId) return { error: 'No tenant configured' };

    // Find or create customer (atomic upsert to prevent duplicate race condition)
    const phoneClean = customer_phone.replace(/\D/g, '');
    let customer = await dbQueryOne<any>(
      `SELECT id, name FROM customers WHERE tenant_id=$1 AND (jid LIKE $2 OR phone LIKE $3) LIMIT 1`,
      [tenantId, `%${phoneClean}%`, `%${phoneClean}%`],
    );
    if (!customer) {
      const jid = phoneClean.includes('@') ? phoneClean : `${phoneClean}@s.whatsapp.net`;
      // ON CONFLICT prevents duplicate customer creation from concurrent orders.
      // Schema has UNIQUE(tenant_id, channel, jid).
      customer = await dbQueryOne<any>(
        `INSERT INTO customers (tenant_id, channel, jid, name, phone)
         VALUES ($1, 'whatsapp', $2, $3, $4)
         ON CONFLICT (tenant_id, channel, jid) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, name`,
        [tenantId, jid, `Cliente ${phoneClean.slice(-4)}`, customer_phone],
      );
    }

    // Wrap product resolution + order creation + stock decrement in a transaction
    // to prevent overselling via check-then-update race condition.
    try {
      const result = await dbTransaction(async (client) => {
        // Resolve products with FOR UPDATE lock to prevent concurrent stock changes
        let total = 0;
        const resolvedItems: Array<{ productId: number; name: string; quantity: number; unitPrice: number }> = [];
        for (const item of items) {
          const productResult = await client.query(
            `SELECT id, name, price, stock FROM products WHERE tenant_id=$1 AND active=true AND name ILIKE $2 LIMIT 1 FOR UPDATE`,
            [tenantId, `%${item.product_name}%`],
          );
          const product = productResult.rows[0] as any;
          if (!product) return { error: `Producto "${item.product_name}" no encontrado en el catálogo.` };
          if (product.stock !== null && product.stock < item.quantity) {
            return { error: `Solo quedan ${product.stock} unidades de "${product.name}".` };
          }
          resolvedItems.push({
            productId: Number(product.id),
            name: product.name,
            quantity: item.quantity,
            unitPrice: Number(product.price),
          });
          total += Number(product.price) * item.quantity;
        }

        // Create order
        const orderResult = await client.query(
          `INSERT INTO orders (tenant_id, customer_id, status, total, delivery_type, delivery_address, notes)
           VALUES ($1, $2, 'pending', $3, $4, $5, $6) RETURNING id`,
          [tenantId, customer.id, total, delivery_address ? 'delivery' : 'none', delivery_address || null, notes || null],
        );
        const orderRow = orderResult.rows[0] as any;
        if (!orderRow?.id) {
          throw new Error('Failed to create order — INSERT returned no rows');
        }
        const orderId = orderRow.id;

        // Batch INSERT order items (multi-row insert instead of N sequential inserts)
        if (resolvedItems.length > 0) {
          const valueClauses: string[] = [];
          const insertParams: unknown[] = [];
          for (let i = 0; i < resolvedItems.length; i++) {
            const offset = i * 4;
            valueClauses.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
            insertParams.push(orderId, resolvedItems[i].productId, resolvedItems[i].quantity, resolvedItems[i].unitPrice);
          }
          await client.query(
            `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ${valueClauses.join(', ')}`,
            insertParams,
          );
        }

        // Batch UPDATE stock (single UPDATE with CASE/WHEN instead of N sequential updates)
        const stockItems = resolvedItems.filter(item => true); // update all; the WHERE clause handles NULL stock
        if (stockItems.length > 0) {
          const whenClauses: string[] = [];
          const ids: number[] = [];
          const updateParams: unknown[] = [];
          for (let i = 0; i < stockItems.length; i++) {
            whenClauses.push(`WHEN id = $${i * 2 + 1} THEN stock - $${i * 2 + 2}`);
            updateParams.push(stockItems[i].productId, stockItems[i].quantity);
            ids.push(stockItems[i].productId);
          }
          const idsParamIdx = updateParams.length + 1;
          updateParams.push(ids);
          await client.query(
            `UPDATE products SET stock = CASE ${whenClauses.join(' ')} ELSE stock END
             WHERE id = ANY($${idsParamIdx}) AND stock IS NOT NULL`,
            updateParams,
          );
        }

        return {
          order_id: orderId,
          total: `S/${total.toFixed(2)}`,
          totalNumeric: total,
          items: resolvedItems.map(i => `${i.quantity}x ${i.name} (S/${i.unitPrice.toFixed(2)})`),
          customer: customer.name,
          status: 'pending',
          message: `Pedido #${orderId} creado por S/${total.toFixed(2)}. Pendiente de pago.`,
        };
      });

      if (!result || 'error' in result) {
        return result;
      }

      const devices = await getDevicesByTenant(tenantId);
      let payment_link = null;
      let qr_data = null;

      if (devices.length > 0) {
        const deviceId = devices[0].deviceId;
        const yapeNumber = await getEffectiveSetting(tenantId, 'yape_number') ?? '';
        try {
          const res = await fetch(`http://localhost:8092/relay/${deviceId}/payment_intents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RELAY_AUTH_TOKEN || ''}` },
            body: JSON.stringify({
              amount: Math.round(result.totalNumeric * 100),
              walletType: 'YAPE',
              description: `Order ${result.order_id}`,
              clientReferenceId: `order_${result.order_id}`,
              recipientId: yapeNumber
            })
          });
          if (res.ok) {
            const data = await res.json() as any;
            payment_link = data.paymentLink;
            qr_data = data.qrData;
          }
        } catch (err) {
          // ignore relay failures
        }
      }

      return {
        ...result,
        payment_link,
        qr_data,
      };
    } catch (err: any) {
      logger.error({ err: err.message, tenantId }, 'createOrder transaction failed');
      return { error: `Error creando pedido: ${err.message}` };
    }
  },
});

export const getOrderStatus = createTool({
  id: 'get-order-status',
  description: 'Get details of an order by ID, or list recent orders for a customer by phone/JID. Use when customer asks about their order.',
  inputSchema: z.object({
    order_id: z.number().optional().describe('Order ID to look up'),
    customer_phone: z.string().optional().describe('Customer phone or JID to find their orders'),
  }),
  execute: async ({ order_id, customer_phone }) => {
    const tenantId = getTenantId();
    if (!tenantId) return { error: 'No tenant configured' };

    if (order_id) {
      const order = await dbQueryOne<any>(
        `SELECT o.id, o.status, o.total, o.delivery_type, o.delivery_address, o.notes, o.created_at,
                c.name as customer_name, c.phone as customer_phone
         FROM orders o LEFT JOIN customers c ON c.id=o.customer_id AND c.tenant_id=o.tenant_id
         WHERE o.tenant_id=$1 AND o.id=$2`,
        [tenantId, order_id],
      );
      if (!order) return { message: `Pedido #${order_id} no encontrado.` };

      const items = await dbQuery<any>(
        `SELECT p.name, oi.quantity, oi.unit_price FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=$1`,
        [order_id],
      );

      return {
        order_id: order.id,
        status: order.status,
        total: `S/${Number(order.total).toFixed(2)}`,
        customer: order.customer_name,
        items: items.rows.map((i: any) => `${i.quantity}x ${i.name} (S/${Number(i.unit_price).toFixed(2)})`),
        delivery: order.delivery_type,
        created_at: order.created_at,
      };
    }

    if (customer_phone) {
      const phoneClean = customer_phone.replace(/\D/g, '');
      const orders = await dbQuery<any>(
        `SELECT o.id, o.status, o.total, o.created_at
         FROM orders o JOIN customers c ON c.id=o.customer_id AND c.tenant_id=o.tenant_id
         WHERE o.tenant_id=$1 AND (c.jid LIKE $2 OR c.phone LIKE $3)
         ORDER BY o.created_at DESC LIMIT 5`,
        [tenantId, `%${phoneClean}%`, `%${phoneClean}%`],
      );
      if (orders.rows.length === 0) return { message: 'No se encontraron pedidos para este cliente.' };
      return {
        count: orders.rows.length,
        orders: orders.rows.map((o: any) => ({
          order_id: o.id,
          status: o.status,
          total: `S/${Number(o.total).toFixed(2)}`,
          date: o.created_at,
        })),
      };
    }

    return { error: 'Necesitas dar un número de pedido o teléfono del cliente.' };
  },
});

export const createRule = createTool({
  id: 'create-rule',
  description: 'Create a tenant rule for events like order.paid.',
  inputSchema: z.object({
    trigger_event: z.enum(['order.paid']).describe('Event that triggers this rule.'),
    action_type: z.enum(['send_message', 'webhook']).describe('Action to take when triggered.'),
    action_payload: z.object({
      message: z.string().max(500).optional().describe('Message to send (for send_message action). Max 500 chars.'),
      url: z.string().url().optional().describe('Webhook URL (for webhook action).'),
    }).describe('Payload for the action.'),
  }),
  execute: async ({ trigger_event, action_type, action_payload }) => {
    const tenantId = getTenantId();
    if (!tenantId) return { error: 'No tenant configured' };

    // Validate payload matches action type
    if (action_type === 'send_message' && !action_payload.message) {
      return { error: 'send_message action requires a "message" field in payload' };
    }
    if (action_type === 'webhook' && !action_payload.url) {
      return { error: 'webhook action requires a "url" field in payload' };
    }

    await dbQuery(
      `INSERT INTO tenant_rules (tenant_id, trigger_event, action_type, action_payload) VALUES ($1, $2, $3, $4)`,
      [tenantId, trigger_event, action_type, JSON.stringify(action_payload)]
    );
    return { success: true, message: 'Rule created successfully' };
  }
});

// ── All tools as a record ──

export const allBusinessTools = {
  businessMetrics,
  customerLookup,
  paymentStatus,
  calendarToday,
  sendMessage,
  productCatalog,
  createOrder,
  getOrderStatus,
  createRule,
  knowledgeSearch,
  pageIndexLookup,
  knowledgeGraphQuery,
  knowledgeAnnotate,
};

/** All tools including Yape payment verification (for WhatsApp agent). */
export const allBusinessToolsWithYape = {
  ...allBusinessTools,
  checkYapePayment,
  confirmYapePayment,
};

// ── Agents ──

const ceoInstructions = `Asistente del CEO. SIEMPRE usa herramientas para responder, nunca inventes datos. Responde corto en español.
- Ventas/ingresos → business-metrics
- Buscar cliente → customer-lookup
- Pagos pendientes → payment-status
- Ver productos → product-catalog
- Citas → calendar-today
/no_think`;

/**
 * Direct agent — CEO/owner-facing, LOCAL 35B as default (always available).
 * mastra-bridge dynamically routes to directAgentHpc when HPC is healthy.
 */
export const directAgent = new Agent({
  id: 'ceo-direct',
  name: 'CEO Direct',
  instructions: ceoInstructions,
  model: localModel,
  tools: allBusinessToolsWithYape,
});

/**
 * HPC variant of CEO agent — 122B for complex reasoning.
 * BUG-001 fix (hpcFetch) makes tool calls work on HPC.
 * Used by mastra-bridge when HPC is healthy.
 */
export const directAgentHpc = new Agent({
  id: 'ceo-direct-hpc',
  name: 'CEO Direct (HPC)',
  instructions: ceoInstructions,
  model: hpcModel,
  tools: allBusinessToolsWithYape,
});

/**
 * WhatsApp agent — customer-facing, closes sales.
 * Uses LOCAL 35B for speed (sub-2s replies).
 * Mastra-bridge can dynamically swap to HPC for complex conversations.
 */
export const whatsappAgent = new Agent({
  id: 'whatsapp-agent',
  name: 'WhatsApp Business Agent',
  instructions: `Vendedor por WhatsApp. Español natural y conciso. NUNCA inventes precios.
- Preguntan precio/menú → product-catalog
- Confirman pedido → create-order (usa el JID del cliente del contexto)
- Preguntan por su pedido → get-order-status
- Dicen que pagaron Yape → check-yape-payment
- Siempre muestra precios reales y calcula totales
/no_think`,
  model: localModel,
  tools: allBusinessToolsWithYape,
});

/**
 * HPC WhatsApp agent — same as whatsappAgent but uses HPC 122B.
 * Used for complex customer conversations (multi-item orders, long history).
 */
export const whatsappAgentHpc = new Agent({
  id: 'whatsapp-agent-hpc',
  name: 'WhatsApp Business Agent (HPC)',
  instructions: `Vendedor por WhatsApp. Español natural y conciso. NUNCA inventes precios.
- Preguntan precio/menú → product-catalog
- Confirman pedido → create-order (usa el JID del cliente del contexto)
- Preguntan por su pedido → get-order-status
- Dicen que pagaron Yape → check-yape-payment
- Siempre muestra precios reales y calcula totales
/no_think`,
  model: hpcModel,
  tools: allBusinessToolsWithYape,
});

/**
 * Reasoning agent — HPC 122B for pure text analysis (no tools).
 * Use for: business summaries, trend analysis, long-context reasoning.
 * Note: HPC tool calls now work (BUG-001 fixed), but this agent
 * intentionally has no tools for pure reasoning tasks.
 */
export const reasoningAgent = new Agent({
  id: 'reasoning-hpc',
  name: 'HPC Reasoning Agent',
  instructions: `Analista de negocios experto. Responde en español conciso. Analiza datos, identifica tendencias, da recomendaciones accionables. /no_think`,
  model: hpcModel,
});

logger.debug({
  directAgent: backends.hpc.model,
  whatsappAgent: backends.local.model,
  whatsappAgentHpc: backends.hpc.model,
  reasoningAgent: backends.hpc.model,
}, 'Shared Mastra agents initialized');
