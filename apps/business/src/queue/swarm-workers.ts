/**
 * Swarm Workers — wires @yaya/swarm workers to the business app.
 *
 * Each specialist agent gets its own BullMQ worker via createSwarmWorker().
 * The processor function:
 *   1. Looks up the agent spec from the registry
 *   2. Resolves model tier (fast -> local, powerful -> hpc) with fallback
 *   3. Creates a Mastra Agent with the spec's prompt and tools
 *   4. Calls the LLM and returns a SwarmResult
 *
 * Workers are started in platform.ts alongside existing queue workers.
 */

import {
  createSwarmWorker,
  createAggregatorWorker,
  closeAllWorkers,
  getAgent,
  getAllAgents,
  aggregateResults,
  type AgentSpec,
  type SwarmTask,
  type SwarmResult,
} from '@yaya/swarm';
import { Agent } from '@mastra/core/agent';
import { SWARM_QUEUES } from '../ai/specialists/index.js';
import { getModel, ensureHealthy, recordLatency, type RouteTarget } from '../ai/model-router.js';
import { allBusinessTools, runWithTenant } from '../ai/agents.js';
import { executeToolsParallel, type ToolExecutor } from '../ai/parallel-tools.js';
import { logger } from '../shared/logger.js';

// ── Tool Registry ──

const toolExecutors: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {};

/**
 * Build the tool executor map from allBusinessTools.
 * Maps both camelCase names and kebab-case IDs to the same executor.
 */
function initToolExecutors(): void {
  if (Object.keys(toolExecutors).length > 0) return;

  const toolEntries = Object.entries(allBusinessTools) as unknown as Array<
    [string, { id?: string; execute?: (args: any) => Promise<unknown> }]
  >;
  for (const [camelName, tool] of toolEntries) {
    if (tool.execute) {
      const exec = tool.execute;
      toolExecutors[camelName] = (args) => exec(args as any);
      if (tool.id && tool.id !== camelName) {
        toolExecutors[tool.id] = (args) => exec(args as any);
      }
    }
  }
}

/**
 * Create a ToolExecutor that can be used by parallel-tools.
 */
function createToolExecutor(): ToolExecutor {
  return async (name: string, args: Record<string, unknown>) => {
    const exec = toolExecutors[name];
    if (!exec) throw new Error(`Unknown tool: ${name}`);
    return exec(args);
  };
}

// ── Resolve Model Tier ──

async function resolveBackend(spec: AgentSpec, forceBackend?: RouteTarget): Promise<RouteTarget> {
  if (forceBackend) return forceBackend;

  const preferred: RouteTarget = spec.modelTier === 'powerful' ? 'hpc' : 'local';
  if (await ensureHealthy(preferred)) return preferred;

  const fallback: RouteTarget = preferred === 'hpc' ? 'local' : 'hpc';
  if (await ensureHealthy(fallback)) {
    logger.warn({ agent: spec.id, preferred, fallback }, 'Preferred backend unhealthy, falling back');
    return fallback;
  }

  logger.error({ agent: spec.id }, 'Both backends unhealthy, trying preferred as last resort');
  return preferred;
}

// ── Resolve Tools ──

/**
 * Map tool name strings from an AgentSpec to Mastra tool objects.
 */
function resolveTools(toolNames: string[]): Record<string, any> {
  if (toolNames.length === 0) return {};

  const resolved: Record<string, any> = {};
  for (const name of toolNames) {
    const tool = (allBusinessTools as Record<string, any>)[name];
    if (tool) {
      resolved[name] = tool;
    } else {
      logger.warn({ tool: name }, 'Swarm agent references unknown tool, skipping');
    }
  }
  return resolved;
}

// ── Task Processor ──

/**
 * Process a SwarmTask: resolve agent, model, tools, and call the LLM.
 * This is the processor function passed to createSwarmWorker().
 */
async function processTask(task: SwarmTask): Promise<SwarmResult> {
  const startTime = Date.now();

  const spec = getAgent(task.agentId);
  if (!spec) {
    return {
      taskId: task.id,
      agentId: task.agentId,
      output: '',
      toolCalls: [],
      tokens: { input: 0, output: 0 },
      latencyMs: Date.now() - startTime,
      error: `Unknown agent: ${task.agentId}`,
    };
  }

  try {
    return await runWithTenant(task.context.tenantId, async () => {
    // Resolve backend (fast -> local, powerful -> hpc)
    const backend = await resolveBackend(spec);
    const model = getModel(backend);

    // Create a Mastra Agent with the spec's system prompt and resolved tools
    const agent = new Agent({
      id: `swarm-${spec.id}`,
      name: spec.name,
      instructions: spec.systemPrompt,
      model,
      tools: resolveTools(spec.tools),
    });

    // Call the LLM
    const result = await agent.generate(task.input, {
      maxSteps: spec.maxSteps,
    });

    // Extract tool calls from the result steps
    const toolCalls: SwarmResult['toolCalls'] = [];
    if (result.steps) {
      for (const step of result.steps) {
        if (step.toolCalls) {
          for (const tc of step.toolCalls) {
            toolCalls.push({
              name: (tc as any).toolName ?? (tc as any).name ?? 'unknown',
              args: (tc as any).args ?? {},
              result: (tc as any).result ?? null,
            });
          }
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    recordLatency(backend, latencyMs);

    const output = result.text || '';

    logger.info({
      agent: spec.id,
      tenantId: task.context.tenantId,
      userId: task.context.userId,
      backend,
      latencyMs,
      tools: toolCalls.map((t: { name: string }) => t.name),
      outputLength: output.length,
    }, 'Swarm agent completed');

    return {
      taskId: task.id,
      agentId: task.agentId,
      output,
      toolCalls,
      tokens: {
        input: (result.usage as any)?.promptTokens ?? (result.usage as any)?.inputTokens ?? 0,
        output: (result.usage as any)?.completionTokens ?? (result.usage as any)?.outputTokens ?? 0,
      },
      latencyMs,
    };
    }); // end runWithTenant
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const error = err instanceof Error ? err.message : String(err);
    logger.error({
      err: error, agent: spec.id,
      tenantId: task.context.tenantId,
      latencyMs,
    }, 'Swarm agent failed');

    return {
      taskId: task.id,
      agentId: task.agentId,
      output: '',
      toolCalls: [],
      tokens: { input: 0, output: 0 },
      latencyMs,
      error,
    };
  }
}

// ── Worker Lifecycle ──

/**
 * Start all swarm workers — one per specialist queue, plus the aggregator.
 * Call once during platform startup.
 */
export function startSwarmWorkers(): void {
  initToolExecutors();

  for (const queueName of SWARM_QUEUES) {
    // Find the agent spec for this queue to get concurrency
    const agents = getAllAgents().filter((a: { queue: string }) => a.queue === queueName);
    const concurrency = agents[0]?.concurrency ?? 5;

    const worker = createSwarmWorker(queueName, processTask, { concurrency });

    worker.on('completed', (job: any) => {
      if (job) logger.debug({ queue: queueName, jobId: job.id }, 'Swarm job completed');
    });

    worker.on('failed', (job: any, err: Error) => {
      if (job) {
        logger.error({ queue: queueName, jobId: job.id, err: err.message }, 'Swarm job failed');
      }
    });

    worker.on('error', (err: Error) => {
      logger.error({ queue: queueName, err: err.message }, 'Swarm worker error');
    });

    logger.info({ queue: queueName, concurrency }, 'Swarm worker started');
  }

  // Start the aggregator worker for fan-out/fan-in flows
  const aggregator = createAggregatorWorker(async (childResults: SwarmResult[], plan: { objective: string; aggregation: string }) => {
    return aggregateResults(childResults, plan.aggregation as any);
  });

  aggregator.on('error', (err: Error) => {
    logger.error({ err: err.message }, 'Aggregator worker error');
  });

  logger.info({ queues: SWARM_QUEUES.length }, 'All swarm workers started');
}

/**
 * Gracefully stop all swarm workers.
 */
export async function stopSwarmWorkers(): Promise<void> {
  logger.info('Stopping swarm workers...');
  await closeAllWorkers();
  logger.info('All swarm workers stopped');
}
