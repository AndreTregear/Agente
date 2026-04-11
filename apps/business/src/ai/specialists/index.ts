/**
 * Specialist Agent Registry — registers all specialist agents at startup.
 *
 * Call registerAllAgents() once during platform init (in platform.ts).
 * After registration, agents are available via getAgent(id) from @yaya/swarm.
 */

import { registerAgent } from '@yaya/swarm';
import { routerAgent } from './router.js';
import { salesAgent } from './sales.js';
import { analyticsAgent } from './analytics.js';
import { supportAgent } from './support.js';
import { researcherAgent } from './researcher.js';
import { knowledgeAgent } from './knowledge.js';

// Re-export individual specs for direct access
export { routerAgent } from './router.js';
export { salesAgent } from './sales.js';
export { analyticsAgent } from './analytics.js';
export { supportAgent } from './support.js';
export { researcherAgent } from './researcher.js';
export { knowledgeAgent } from './knowledge.js';

/** All specialist agent specs, keyed by ID. */
export const specialists = {
  router: routerAgent,
  sales: salesAgent,
  analytics: analyticsAgent,
  support: supportAgent,
  researcher: researcherAgent,
  knowledge: knowledgeAgent,
} as const;

/** All specialist queue names for worker startup. */
export const SWARM_QUEUES = [
  routerAgent.queue,
  salesAgent.queue,
  analyticsAgent.queue,
  supportAgent.queue,
  researcherAgent.queue,
  knowledgeAgent.queue,
] as const;

/**
 * Register all specialist agents into the @yaya/swarm registry.
 * Call once at startup. Idempotent — safe to call multiple times.
 */
export function registerAllAgents(): void {
  registerAgent(routerAgent);
  registerAgent(salesAgent);
  registerAgent(analyticsAgent);
  registerAgent(supportAgent);
  registerAgent(researcherAgent);
  registerAgent(knowledgeAgent);
}
