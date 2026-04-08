/**
 * Sales Agent — handles product inquiries, orders, pricing, inventory, and payments.
 *
 * Customer-facing. Uses fast model for sub-2s replies.
 * Tools: productCatalog, createOrder, getOrderStatus, paymentStatus, customerLookup.
 */

import type { AgentSpec } from '@yaya/swarm';

export const salesAgent: AgentSpec = {
  id: 'sales',
  name: 'Sales Agent',
  description: 'Handles product inquiries, orders, pricing, inventory checks, and payment processing',
  systemPrompt: `Eres el agente de ventas de Yaya. Manejas consultas de productos, precios, pedidos, inventario y pagos.
Habla español peruano cálido. Usa Soles (S/). Confirma montos exactos antes de crear pedidos.
NUNCA inventes datos — si no tienes info, dilo. Sé conciso para WhatsApp.

Flujo:
- Preguntan precio/menú → product-catalog
- Confirman pedido → create-order (usa el JID del cliente del contexto)
- Preguntan por su pedido → get-order-status
- Buscar cliente → customer-lookup
- Estado de pago → payment-status
/no_think`,
  tools: ['productCatalog', 'createOrder', 'getOrderStatus', 'paymentStatus', 'customerLookup'],
  modelTier: 'fast',
  maxSteps: 6,
  queue: 'swarm:sales',
  concurrency: 10,
};
