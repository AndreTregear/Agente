/**
 * Agent Registry — define agents as declarative specs.
 *
 * Agents register at startup. The registry is queried by the router and
 * orchestrator to determine capabilities, queue routing, and concurrency.
 */

export interface AgentSpec {
  /** Unique agent ID (e.g. 'sales-agent', 'analytics-agent') */
  id: string;
  /** Human-readable name */
  name: string;
  /** What this agent does (used by router for delegation decisions) */
  description: string;
  /** System prompt */
  systemPrompt: string;
  /** Which tools this agent can use (by tool name) */
  tools: string[];
  /** Preferred model tier: 'fast' (local 35B) or 'powerful' (HPC 122B) */
  modelTier: 'fast' | 'powerful';
  /** Max LLM steps per invocation */
  maxSteps: number;
  /** Queue to process on (for worker routing) */
  queue: string;
  /** Max concurrent instances of this agent */
  concurrency: number;
}

// Registry is a simple Map — agents register at startup
const registry = new Map<string, AgentSpec>();

/**
 * Register an agent spec. Overwrites if an agent with the same ID exists.
 */
export function registerAgent(spec: AgentSpec): void {
  registry.set(spec.id, Object.freeze({ ...spec }));
}

/**
 * Get an agent spec by ID.
 */
export function getAgent(id: string): AgentSpec | undefined {
  return registry.get(id);
}

/**
 * Get all registered agent specs.
 */
export function getAllAgents(): AgentSpec[] {
  return Array.from(registry.values());
}

/**
 * Get all agents assigned to a specific queue.
 */
export function getAgentsByQueue(queue: string): AgentSpec[] {
  return Array.from(registry.values()).filter((a) => a.queue === queue);
}

/**
 * Remove an agent from the registry. Returns true if it existed.
 */
export function unregisterAgent(id: string): boolean {
  return registry.delete(id);
}

/**
 * Clear all registered agents. Useful for testing.
 */
export function clearRegistry(): void {
  registry.clear();
}
