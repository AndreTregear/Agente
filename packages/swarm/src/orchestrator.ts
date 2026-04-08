/**
 * Swarm Orchestrator — fan-out/fan-in via BullMQ Flows.
 *
 * Decomposes complex tasks into sub-tasks, fans them out to specialist agents
 * via BullMQ FlowProducer, and aggregates the results.
 */

import { FlowProducer, Queue, type FlowJob } from 'bullmq';
import type { AgentContext } from './context.js';
import { getAgent } from './registry.js';
import { getConnection } from './connection.js';

// ── Types ──

export interface SwarmTask {
  /** Unique task ID */
  id: string;
  /** Which agent should process this */
  agentId: string;
  /** The input/prompt for the agent */
  input: string;
  /** Context for scoping and tracing */
  context: AgentContext;
  /** Data from parent task (if this is a sub-task) */
  parentData?: Record<string, unknown>;
}

export interface SwarmResult {
  /** Task ID that produced this result */
  taskId: string;
  /** Agent that processed the task */
  agentId: string;
  /** The agent's output text */
  output: string;
  /** Tool calls made during execution */
  toolCalls: Array<{ name: string; args: unknown; result: unknown }>;
  /** Token usage */
  tokens: { input: number; output: number };
  /** End-to-end latency in ms */
  latencyMs: number;
  /** Error message if the task failed */
  error?: string;
}

export interface SwarmPlan {
  /** The main task description */
  objective: string;
  /** Sub-tasks to fan out */
  tasks: Array<{
    /** Agent to handle this sub-task */
    agentId: string;
    /** Input/prompt for the sub-task */
    input: string;
    /** Dependencies — task indices that must complete before this one */
    dependsOn?: string[];
  }>;
  /** How to aggregate results */
  aggregation: 'concat' | 'synthesize' | 'vote' | 'first-success';
}

// ── Queue Names ──

const AGGREGATOR_QUEUE = 'swarm:aggregator';
const SINGLE_QUEUE = 'swarm:single';

function getAgentQueueName(agentId: string): string {
  const spec = getAgent(agentId);
  return `swarm:${spec?.queue ?? 'default'}`;
}

// ── FlowProducer (lazy singleton) ──

let flowProducer: FlowProducer | null = null;

function getFlowProducer(): FlowProducer {
  if (!flowProducer) {
    flowProducer = new FlowProducer({ connection: getConnection() as any });
  }
  return flowProducer;
}

// ── Single-task Queue (lazy singleton) ──

let singleQueue: Queue | null = null;

function getSingleQueue(): Queue {
  if (!singleQueue) {
    singleQueue = new Queue(SINGLE_QUEUE, {
      connection: getConnection() as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 1000 },
      },
    });
  }
  return singleQueue;
}

// ── Public API ──

/**
 * Execute a swarm plan — fans out to specialist agents via BullMQ Flows,
 * waits for all to complete, then aggregates results.
 *
 * Uses BullMQ's FlowProducer: the aggregator job is the parent, and each
 * sub-task is a child. BullMQ ensures children complete before the parent
 * is processed, giving us automatic fan-out/fan-in.
 */
export async function executeSwarm(
  plan: SwarmPlan,
  ctx: AgentContext,
): Promise<{ flowJobId: string; plan: SwarmPlan }> {
  const fp = getFlowProducer();

  // Build child jobs from the plan's tasks
  const children: FlowJob[] = plan.tasks.map((task, index) => {
    const taskId = `${ctx.requestId}:${index}`;
    const swarmTask: SwarmTask = {
      id: taskId,
      agentId: task.agentId,
      input: task.input,
      context: ctx,
    };

    return {
      name: task.agentId,
      queueName: getAgentQueueName(task.agentId),
      data: { task: swarmTask },
      opts: {
        jobId: taskId,
        priority: ctx.priority,
      },
    };
  });

  // Parent aggregator job — processes after all children complete
  const flow = await fp.add({
    name: 'aggregate',
    queueName: AGGREGATOR_QUEUE,
    data: {
      plan,
      ctx,
      aggregation: plan.aggregation,
    },
    opts: {
      jobId: `${ctx.requestId}:aggregate`,
    },
    children,
  });

  return {
    flowJobId: flow.job.id ?? ctx.requestId,
    plan,
  };
}

/**
 * Execute a single agent task (no fan-out).
 * Enqueues the task on the single-task queue for processing by a worker.
 */
export async function executeAgent(
  task: SwarmTask,
): Promise<{ jobId: string; taskId: string }> {
  const queue = getSingleQueue();

  const job = await queue.add(task.agentId, { task }, {
    jobId: task.id,
    priority: task.context.priority,
  });

  return {
    jobId: job.id ?? task.id,
    taskId: task.id,
  };
}

/**
 * Decompose a complex task into a SwarmPlan.
 *
 * Currently uses rule-based decomposition. In the future, this can call
 * a cheap/fast model to analyze the request and split it intelligently.
 *
 * For now, creates a single-agent plan pointing at the default agent.
 * Override this with a custom decomposer for production use.
 */
export async function decompose(
  objective: string,
  ctx: AgentContext,
  decomposer?: (objective: string, ctx: AgentContext) => Promise<SwarmPlan>,
): Promise<SwarmPlan> {
  // If a custom decomposer is provided, use it
  if (decomposer) {
    return decomposer(objective, ctx);
  }

  // Default: single-agent plan (no decomposition)
  return {
    objective,
    tasks: [
      {
        agentId: 'general',
        input: objective,
      },
    ],
    aggregation: 'concat',
  };
}

/**
 * Aggregate results from completed sub-tasks.
 * Called by the aggregator worker when all children have finished.
 */
export function aggregateResults(
  results: SwarmResult[],
  aggregation: SwarmPlan['aggregation'],
): SwarmResult {
  const totalTokens = results.reduce(
    (acc, r) => ({
      input: acc.input + r.tokens.input,
      output: acc.output + r.tokens.output,
    }),
    { input: 0, output: 0 },
  );

  const totalLatency = Math.max(...results.map((r) => r.latencyMs));
  const allToolCalls = results.flatMap((r) => r.toolCalls);
  const errors = results.filter((r) => r.error).map((r) => r.error!);

  switch (aggregation) {
    case 'concat': {
      const output = results
        .map((r) => r.output)
        .filter(Boolean)
        .join('\n\n---\n\n');
      return {
        taskId: 'aggregate',
        agentId: 'aggregator',
        output,
        toolCalls: allToolCalls,
        tokens: totalTokens,
        latencyMs: totalLatency,
        error: errors.length > 0 ? errors.join('; ') : undefined,
      };
    }

    case 'first-success': {
      const success = results.find((r) => !r.error && r.output);
      if (success) return success;
      // All failed — return the first result with combined errors
      return {
        taskId: 'aggregate',
        agentId: 'aggregator',
        output: '',
        toolCalls: allToolCalls,
        tokens: totalTokens,
        latencyMs: totalLatency,
        error: errors.join('; ') || 'All sub-tasks failed',
      };
    }

    case 'vote': {
      // Simple majority vote — pick the most common output
      const counts = new Map<string, number>();
      for (const r of results) {
        if (r.output) {
          counts.set(r.output, (counts.get(r.output) ?? 0) + 1);
        }
      }
      let bestOutput = '';
      let bestCount = 0;
      for (const [output, count] of counts) {
        if (count > bestCount) {
          bestOutput = output;
          bestCount = count;
        }
      }
      return {
        taskId: 'aggregate',
        agentId: 'aggregator',
        output: bestOutput,
        toolCalls: allToolCalls,
        tokens: totalTokens,
        latencyMs: totalLatency,
        error: errors.length > 0 ? errors.join('; ') : undefined,
      };
    }

    case 'synthesize': {
      // Synthesize requires an LLM call — for now, fall back to concat
      // with a header indicating synthesis is needed.
      const output = [
        '[Synthesized from multiple agent results]',
        ...results.map((r, i) => `## Result ${i + 1} (${r.agentId})\n${r.output}`),
      ].join('\n\n');
      return {
        taskId: 'aggregate',
        agentId: 'aggregator',
        output,
        toolCalls: allToolCalls,
        tokens: totalTokens,
        latencyMs: totalLatency,
        error: errors.length > 0 ? errors.join('; ') : undefined,
      };
    }

    default: {
      const _exhaustive: never = aggregation;
      throw new Error(`Unknown aggregation: ${_exhaustive}`);
    }
  }
}

/**
 * Close the flow producer and queues. Call during graceful shutdown.
 */
export async function closeOrchestrator(): Promise<void> {
  if (flowProducer) {
    await flowProducer.close();
    flowProducer = null;
  }
  if (singleQueue) {
    await singleQueue.close();
    singleQueue = null;
  }
}
