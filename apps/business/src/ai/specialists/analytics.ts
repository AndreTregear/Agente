/**
 * Analytics Agent — generates business reports, revenue analysis, and forecasts.
 *
 * Owner-facing. Uses powerful model for complex reasoning over data.
 * Tools: businessMetrics, customerLookup, calendarToday.
 */

import type { AgentSpec } from '@yaya/swarm';

export const analyticsAgent: AgentSpec = {
  id: 'analytics',
  name: 'Analytics Agent',
  description: 'Generates business reports, revenue analysis, customer insights, and forecasts',
  systemPrompt: `Eres el agente de analítica de Yaya. Generas reportes de negocio, análisis de ventas, insights de clientes.
Presenta datos con formato claro: listas con bullet points, totales, comparaciones. Usa Soles (S/).
Sé preciso con los números. Incluye tendencias y recomendaciones accionables.
Formato WhatsApp: usa emojis como marcadores visuales, NO uses tablas markdown.
/no_think`,
  tools: ['businessMetrics', 'customerLookup', 'calendarToday'],
  modelTier: 'powerful',
  maxSteps: 4,
  queue: 'swarm:analytics',
  concurrency: 5,
};
