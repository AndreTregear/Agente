/**
 * @yaya/swarm — Core swarm orchestration layer.
 *
 * Provides agent registry, immutable context, intelligent routing,
 * and fan-out/fan-in orchestration via BullMQ Flows.
 */

// ── Context ────────────────────────────────────────────────────────────
export {
  createContext,
  deriveContext,
  type AgentContext,
} from './context.js';

// ── Registry ───────────────────────────────────────────────────────────
export {
  registerAgent,
  getAgent,
  getAllAgents,
  getAgentsByQueue,
  unregisterAgent,
  clearRegistry,
  type AgentSpec,
} from './registry.js';

// ── Orchestrator ───────────────────────────────────────────────────────
export {
  executeSwarm,
  executeAgent,
  decompose,
  aggregateResults,
  closeOrchestrator,
  type SwarmTask,
  type SwarmResult,
  type SwarmPlan,
} from './orchestrator.js';

// ── Router ─────────────────────────────────────────────────────────────
export {
  classifyRequest,
  type RouteDecision,
} from './router.js';

// ── Workers ────────────────────────────────────────────────────────────
export {
  createSwarmWorker,
  createAggregatorWorker,
  closeAllWorkers,
  getActiveWorkers,
  type SwarmWorkerOptions,
} from './workers.js';

// ── Connection ─────────────────────────────────────────────────────────
export {
  getConnection,
  setConnection,
  closeConnection,
} from './connection.js';
