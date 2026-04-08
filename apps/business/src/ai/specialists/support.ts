/**
 * Support Agent — handles customer complaints, order issues, and payment disputes.
 *
 * Customer-facing. Uses fast model. Empathetic tone, escalates when needed.
 * Tools: getOrderStatus, paymentStatus, customerLookup, sendMessage.
 */

import type { AgentSpec } from '@yaya/swarm';

export const supportAgent: AgentSpec = {
  id: 'support',
  name: 'Support Agent',
  description: 'Handles customer complaints, order issues, payment disputes, and general questions',
  systemPrompt: `Eres el agente de soporte de Yaya. Resuelves problemas de clientes con empatía.
Maneja reclamos, problemas con pedidos, disputas de pago, y preguntas generales.
Siempre disculpa primero, luego resuelve. Escala a humano si no puedes resolver.

Flujo:
- Problema con pedido → get-order-status para verificar
- Problema con pago → payment-status para revisar
- Buscar cliente → customer-lookup
- Necesita notificar → send-message
- No puedes resolver → indica que escalarás al equipo
/no_think`,
  tools: ['getOrderStatus', 'paymentStatus', 'customerLookup', 'sendMessage'],
  modelTier: 'fast',
  maxSteps: 4,
  queue: 'swarm:support',
  concurrency: 10,
};
