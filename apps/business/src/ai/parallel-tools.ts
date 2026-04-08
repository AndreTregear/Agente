/**
 * Parallel Tool Execution — execute multiple tool calls concurrently when safe.
 *
 * Strategy:
 *   - Read-only tools (queries, lookups) run in parallel via Promise.allSettled
 *   - Write tools (create order, send message) run sequentially to preserve ordering
 *   - Unknown tools default to sequential for safety
 *
 * Results are always returned in the original call order regardless of
 * execution order, so the LLM sees a consistent response sequence.
 */

// ── Tool Classification ──

const READ_ONLY_TOOLS = new Set([
  'businessMetrics',
  'customerLookup',
  'paymentStatus',
  'calendarToday',
  'productCatalog',
  'getOrderStatus',
  'checkYapePayment',
]);

const WRITE_TOOLS = new Set([
  'createOrder',
  'sendMessage',
  'confirmYapePayment',
]);

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  result: unknown;
  error?: string;
  durationMs: number;
}

export type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<unknown>;

/**
 * Execute an array of tool calls with read-parallelism and write-sequencing.
 *
 * @param toolCalls - Array of tool calls to execute
 * @param executor  - Function that executes a single tool by name
 * @returns Results in the same order as the input toolCalls
 */
export async function executeToolsParallel(
  toolCalls: ToolCall[],
  executor: ToolExecutor,
): Promise<ToolResult[]> {
  if (toolCalls.length === 0) return [];

  // Single tool call — no parallelism needed
  if (toolCalls.length === 1) {
    const tc = toolCalls[0];
    const start = Date.now();
    try {
      const result = await executor(tc.name, tc.args);
      return [{ name: tc.name, result, durationMs: Date.now() - start }];
    } catch (err) {
      return [{
        name: tc.name,
        result: null,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      }];
    }
  }

  // Tag each call with its original index and classification
  const tagged = toolCalls.map((tc, index) => ({
    ...tc,
    index,
    isReadOnly: READ_ONLY_TOOLS.has(tc.name),
    isWrite: WRITE_TOOLS.has(tc.name),
  }));

  const reads = tagged.filter(t => t.isReadOnly);
  const sequential = tagged.filter(t => !t.isReadOnly); // writes + unknown

  // Results array — fill in by original index
  const results: ToolResult[] = new Array(toolCalls.length);

  // Execute all read-only tools in parallel
  if (reads.length > 0) {
    const readPromises = reads.map(async (tc) => {
      const start = Date.now();
      try {
        const result = await executor(tc.name, tc.args);
        return { index: tc.index, name: tc.name, result, durationMs: Date.now() - start };
      } catch (err) {
        return {
          index: tc.index,
          name: tc.name,
          result: null,
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - start,
        };
      }
    });

    const settled = await Promise.allSettled(readPromises);
    for (const s of settled) {
      if (s.status === 'fulfilled') {
        const r = s.value;
        results[r.index] = { name: r.name, result: r.result, error: r.error, durationMs: r.durationMs };
      } else {
        // Should not happen since we catch inside, but handle gracefully
        // We don't know which index this was — mark all unfilled reads as errored
      }
    }
  }

  // Execute write/unknown tools sequentially (preserves ordering guarantees)
  for (const tc of sequential) {
    const start = Date.now();
    try {
      const result = await executor(tc.name, tc.args);
      results[tc.index] = { name: tc.name, result, durationMs: Date.now() - start };
    } catch (err) {
      results[tc.index] = {
        name: tc.name,
        result: null,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
    }
  }

  return results;
}

/**
 * Check if a tool is classified as read-only (safe for parallel execution).
 */
export function isReadOnlyTool(name: string): boolean {
  return READ_ONLY_TOOLS.has(name);
}

/**
 * Check if a tool is classified as a write tool (must run sequentially).
 */
export function isWriteTool(name: string): boolean {
  return WRITE_TOOLS.has(name);
}
