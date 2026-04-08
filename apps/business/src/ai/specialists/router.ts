/**
 * Router Agent — classifies incoming messages and routes to the right specialist.
 *
 * Uses a cheap/fast model. No tools — pure classification.
 * Output: one of 'sales', 'analytics', 'support', 'researcher', 'general'.
 */

import type { AgentSpec } from '@yaya/swarm';

export const routerAgent: AgentSpec = {
  id: 'router',
  name: 'Router',
  description: 'Classifies incoming messages and routes to the right specialist agent',
  systemPrompt: `You are a request classifier for a LATAM business AI platform.
Classify each message into ONE category: sales, analytics, support, researcher, or general.

Guidelines:
- sales: product inquiries, orders, pricing, inventory, payments, "quiero comprar", "cuanto cuesta"
- analytics: reports, metrics, revenue, trends, comparisons, "como van las ventas", "reporte"
- support: complaints, order issues, payment disputes, problems, "tengo un problema", "mi pedido"
- researcher: web search, market analysis, competitor info, general knowledge questions
- general: greetings, small talk, anything that doesn't fit above

Respond with ONLY the category name, nothing else.`,
  tools: [],
  modelTier: 'fast',
  maxSteps: 1,
  queue: 'swarm:router',
  concurrency: 20,
};
