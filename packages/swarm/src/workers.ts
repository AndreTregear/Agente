/**
 * Swarm Workers — BullMQ worker helpers for agent task processing.
 *
 * Each worker processes SwarmTask jobs from a named queue and returns
 * SwarmResult. Workers are created per-queue and can be scaled independently.
 */

import { Worker, type Job } from 'bullmq';
import type { SwarmTask, SwarmResult } from './orchestrator.js';
import { getConnection } from './connection.js';

// ── Types ──

export interface SwarmWorkerOptions {
  /** Max concurrent jobs for this worker (default: 3) */
  concurrency?: number;
  /** Lock duration in ms — how long a job can run before considered stalled (default: 60s) */
  lockDuration?: number;
  /** Limiter — rate limit jobs per interval */
  limiter?: { max: number; duration: number };
}

// ── Worker Registry (for graceful shutdown) ──

const workers = new Map<string, Worker>();

/**
 * Create a swarm worker that processes agent tasks from a specific queue.
 *
 * Each worker:
 *   - Pulls SwarmTask jobs from the named queue
 *   - Calls the processor function
 *   - Returns SwarmResult (which BullMQ stores as the job result)
 *
 * The processor is where you wire in the actual LLM call, tool execution, etc.
 *
 * @param queueName - BullMQ queue name (e.g. 'swarm:chat', 'swarm:analytics')
 * @param processor - Function that processes a SwarmTask and returns a SwarmResult
 * @param options - Worker configuration
 * @returns BullMQ Worker instance
 */
export function createSwarmWorker(
  queueName: string,
  processor: (task: SwarmTask) => Promise<SwarmResult>,
  options?: SwarmWorkerOptions,
): Worker {
  const { concurrency = 3, lockDuration = 60_000, limiter } = options ?? {};

  const worker = new Worker<{ task: SwarmTask }, SwarmResult>(
    queueName,
    async (job: Job<{ task: SwarmTask }, SwarmResult>) => {
      const { task } = job.data;
      const start = Date.now();

      try {
        // Update job progress
        await job.updateProgress({ status: 'running', agentId: task.agentId });

        const result = await processor(task);

        // Ensure latency is recorded
        if (!result.latencyMs) {
          result.latencyMs = Date.now() - start;
        }

        return result;
      } catch (err) {
        // Return a failed SwarmResult rather than throwing
        // (so the aggregator can handle partial failures)
        return {
          taskId: task.id,
          agentId: task.agentId,
          output: '',
          toolCalls: [],
          tokens: { input: 0, output: 0 },
          latencyMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    {
      connection: getConnection() as any,
      concurrency,
      lockDuration,
      ...(limiter ? { limiter } : {}),
    },
  );

  // Register for graceful shutdown
  workers.set(queueName, worker);

  return worker;
}

/**
 * Create an aggregator worker that processes the fan-in step.
 *
 * This worker runs on the 'swarm:aggregator' queue. When all child jobs
 * complete, BullMQ triggers the parent (aggregator) job. The worker
 * collects child results and calls the provided aggregation function.
 *
 * @param aggregator - Function that receives child results and produces a final SwarmResult
 * @param options - Worker configuration
 */
export function createAggregatorWorker(
  aggregator: (
    childResults: SwarmResult[],
    plan: { objective: string; aggregation: string },
  ) => Promise<SwarmResult> | SwarmResult,
  options?: SwarmWorkerOptions,
): Worker {
  const { concurrency = 5, lockDuration = 30_000 } = options ?? {};

  const worker = new Worker(
    'swarm:aggregator',
    async (job) => {
      const { plan } = job.data as {
        plan: { objective: string; aggregation: string };
      };

      // Collect results from child jobs
      const childValues = await job.getChildrenValues();
      const childResults: SwarmResult[] = Object.values(childValues) as SwarmResult[];

      return aggregator(childResults, plan);
    },
    {
      connection: getConnection() as any,
      concurrency,
      lockDuration,
    },
  );

  workers.set('swarm:aggregator', worker);

  return worker;
}

/**
 * Close all swarm workers. Call during graceful shutdown.
 */
export async function closeAllWorkers(): Promise<void> {
  const closing = Array.from(workers.values()).map((w) => w.close());
  await Promise.allSettled(closing);
  workers.clear();
}

/**
 * Get all active worker instances (for health checks / monitoring).
 */
export function getActiveWorkers(): Map<string, Worker> {
  return new Map(workers);
}
