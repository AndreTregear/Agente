/**
 * AgentContext — immutable context passed through the entire agent pipeline.
 *
 * Replaces the mutable global _currentTenantId pattern. Every agent invocation
 * receives a frozen context that scopes DB queries, tool calls, and tracing.
 */

export interface AgentContext {
  /** Tenant ID — scopes all DB queries and tool calls */
  tenantId: string;
  /** Channel the request came from */
  channel: 'whatsapp' | 'web' | 'api' | 'internal';
  /** User JID or session ID */
  userId: string;
  /** Unique request ID for tracing */
  requestId: string;
  /** Parent task ID if this is a sub-task */
  parentTaskId?: string;
  /** Timestamp of original request */
  timestamp: number;
  /** Whether this is an owner/CEO request (affects model routing) */
  isOwner: boolean;
  /** Maximum cost budget for this request (in USD) */
  maxCostUsd?: number;
  /** Priority: 1 = interactive (chat/voice), 5 = background (swarm) */
  priority: 1 | 2 | 3 | 4 | 5;
  /** Metadata bag for passing structured data between agents */
  metadata: Record<string, unknown>;
}

/**
 * Create an AgentContext with sensible defaults.
 * Only tenantId and userId are required — everything else has defaults.
 */
export function createContext(
  partial: Partial<AgentContext> & { tenantId: string; userId: string },
): AgentContext {
  return Object.freeze({
    channel: 'whatsapp' as const,
    requestId: crypto.randomUUID(),
    timestamp: Date.now(),
    isOwner: false,
    priority: 3 as const,
    metadata: {},
    ...partial,
  });
}

/**
 * Derive a child context from a parent (for sub-tasks).
 * Inherits tenant, channel, user — gets a new requestId and parentTaskId.
 */
export function deriveContext(
  parent: AgentContext,
  overrides?: Partial<AgentContext>,
): AgentContext {
  return Object.freeze({
    ...parent,
    requestId: crypto.randomUUID(),
    parentTaskId: parent.requestId,
    metadata: { ...parent.metadata },
    ...overrides,
  });
}
