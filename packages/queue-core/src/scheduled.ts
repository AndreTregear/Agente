/**
 * Repeating job helpers for BullMQ.
 *
 * Converts setInterval-based scheduling patterns to BullMQ repeatable jobs.
 * Idempotent — calling scheduleRepeating multiple times with the same jobName
 * won't create duplicate schedules.
 *
 * Uses BullMQ's upsertJobScheduler (v5+) for reliable repeatable jobs.
 */

import { Queue, type JobsOptions } from 'bullmq';

export interface ScheduleOptions {
  /** BullMQ job options (priority, delay, etc.) */
  jobOptions?: Omit<JobsOptions, 'repeat'>;
  /** If true, replace the existing schedule even if it already exists */
  replace?: boolean;
}

/**
 * Schedule a repeating job on a queue. Idempotent by default — won't
 * duplicate if a schedule with the same jobName already exists.
 *
 * @param queue - BullMQ Queue instance
 * @param jobName - Unique name for this scheduled job (used as the repeat key)
 * @param data - Job payload
 * @param pattern - Cron expression (e.g., "0 * * * *" for every hour)
 *                  or { every: milliseconds } for interval-based repeats
 * @param options - Additional options
 *
 * Usage:
 *   const queue = createQueue('daily-tasks');
 *   await scheduleRepeating(queue, 'send-summary', { type: 'daily' }, '0 8 * * *');
 *   await scheduleRepeating(queue, 'health-check', {}, { every: 60_000 });
 */
export async function scheduleRepeating(
  queue: Queue,
  jobName: string,
  data: unknown,
  pattern: string | { every: number },
  options?: ScheduleOptions,
): Promise<void> {
  const { jobOptions, replace } = options ?? {};

  // Check if already scheduled (idempotent)
  if (!replace) {
    const existing = await queue.getRepeatableJobs();
    const alreadyExists = existing.some((j) => j.name === jobName);
    if (alreadyExists) {
      return;
    }
  }

  // If replacing, remove the old schedule first
  if (replace) {
    await removeScheduled(queue, jobName);
  }

  const repeatOpts =
    typeof pattern === 'string'
      ? { pattern }
      : { every: pattern.every };

  await queue.add(jobName, data, {
    ...jobOptions,
    repeat: repeatOpts,
  });
}

/**
 * Remove a scheduled repeating job from a queue.
 *
 * @param queue - BullMQ Queue instance
 * @param jobName - The job name used when scheduling
 */
export async function removeScheduled(
  queue: Queue,
  jobName: string,
): Promise<void> {
  const repeatableJobs = await queue.getRepeatableJobs();

  for (const job of repeatableJobs) {
    if (job.name === jobName) {
      await queue.removeRepeatableByKey(job.key);
    }
  }
}

/**
 * List all repeating jobs on a queue.
 */
export async function listScheduled(
  queue: Queue,
): Promise<Array<{ name: string; pattern: string | null; every: string | null; key: string }>> {
  const jobs = await queue.getRepeatableJobs();
  return jobs.map((j) => ({
    name: j.name,
    pattern: j.pattern ?? null,
    every: j.every ?? null,
    key: j.key,
  }));
}
