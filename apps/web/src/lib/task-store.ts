/**
 * Postgres-backed task store.
 *
 * Replaces the in-memory Map so tasks survive process restarts.
 * Same API surface as the old in-memory engine — drop-in replacement.
 */

import { query, queryOne } from '@/lib/business-db';

// ── Types ──

export interface AgentTask {
  id: string;
  userId: string;
  description: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  agent: string;
  template?: string;
  startedAt: number;
  completedAt?: number;
  result?: string;
  error?: string;
  progress?: string;
  progressHistory: string[];
  notified: boolean;
  blockedBy?: string;
  childOf?: string;
}

// ── Row ↔ Task mapping ──

interface TaskRow {
  id: string;
  user_id: string;
  description: string;
  priority: string;
  status: string;
  agent: string;
  template: string | null;
  progress: string | null;
  progress_history: string[];
  result: string | null;
  error: string | null;
  blocked_by: string | null;
  child_of: string | null;
  started_at: string;
  completed_at: string | null;
  notified: boolean;
}

function rowToTask(r: TaskRow): AgentTask {
  return {
    id: r.id,
    userId: r.user_id,
    description: r.description,
    priority: r.priority as AgentTask['priority'],
    status: r.status as AgentTask['status'],
    agent: r.agent,
    template: r.template ?? undefined,
    startedAt: new Date(r.started_at).getTime(),
    completedAt: r.completed_at ? new Date(r.completed_at).getTime() : undefined,
    result: r.result ?? undefined,
    error: r.error ?? undefined,
    progress: r.progress ?? undefined,
    progressHistory: r.progress_history ?? [],
    notified: r.notified,
    blockedBy: r.blocked_by ?? undefined,
    childOf: r.child_of ?? undefined,
  };
}

// ── Queries ──

export async function getAllTasks(userId: string, statusFilter?: string): Promise<AgentTask[]> {
  const params: unknown[] = [userId];
  let where = 'user_id = $1';
  if (statusFilter) {
    where += ' AND status = $2';
    params.push(statusFilter);
  }
  const rows = await query<TaskRow>(
    `SELECT * FROM agente_ceo_tasks WHERE ${where}
     ORDER BY
       CASE status WHEN 'running' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
       CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
       started_at DESC
     LIMIT 100`,
    params,
  );
  return rows.map(rowToTask);
}

export async function getTask(taskId: string): Promise<AgentTask | null> {
  const row = await queryOne<TaskRow>(
    'SELECT * FROM agente_ceo_tasks WHERE id = $1',
    [taskId],
  );
  return row ? rowToTask(row) : null;
}

export async function insertTask(task: AgentTask): Promise<void> {
  await query(
    `INSERT INTO agente_ceo_tasks
     (id, user_id, description, priority, status, agent, template, progress, progress_history, blocked_by, child_of, started_at, notified)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      task.id,
      task.userId,
      task.description,
      task.priority,
      task.status,
      task.agent,
      task.template ?? null,
      task.progress ?? null,
      task.progressHistory,
      task.blockedBy ?? null,
      task.childOf ?? null,
      new Date(task.startedAt).toISOString(),
      task.notified,
    ],
  );
}

export async function updateTaskStatus(
  taskId: string,
  status: AgentTask['status'],
  extra?: { result?: string; error?: string; completedAt?: number },
): Promise<void> {
  const sets = ['status = $2'];
  const params: unknown[] = [taskId, status];
  let idx = 3;
  if (extra?.result !== undefined) {
    sets.push(`result = $${idx}`);
    params.push(extra.result);
    idx++;
  }
  if (extra?.error !== undefined) {
    sets.push(`error = $${idx}`);
    params.push(extra.error);
    idx++;
  }
  if (extra?.completedAt !== undefined) {
    sets.push(`completed_at = $${idx}`);
    params.push(new Date(extra.completedAt).toISOString());
    idx++;
  }
  await query(`UPDATE agente_ceo_tasks SET ${sets.join(', ')} WHERE id = $1`, params);
}

export async function updateTaskProgress(
  taskId: string,
  progress: string,
): Promise<void> {
  await query(
    `UPDATE agente_ceo_tasks
     SET progress = $2, progress_history = array_append(progress_history, $2)
     WHERE id = $1`,
    [taskId, progress],
  );
}

export async function updateTaskPriority(
  taskId: string,
  priority: AgentTask['priority'],
): Promise<void> {
  await query(
    `UPDATE agente_ceo_tasks SET priority = $2 WHERE id = $1 AND status NOT IN ('completed','failed')`,
    [taskId, priority],
  );
}

export async function markTaskNotified(taskId: string): Promise<void> {
  await query('UPDATE agente_ceo_tasks SET notified = true WHERE id = $1', [taskId]);
}

export async function getUnnotifiedTasks(userId: string): Promise<AgentTask[]> {
  const rows = await query<TaskRow>(
    `SELECT * FROM agente_ceo_tasks
     WHERE user_id = $1 AND status IN ('completed','failed') AND notified = false
     ORDER BY completed_at DESC LIMIT 20`,
    [userId],
  );
  return rows.map(rowToTask);
}

export async function getTaskSummary(userId: string) {
  const rows = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text as count FROM agente_ceo_tasks
     WHERE user_id = $1 AND started_at > NOW() - INTERVAL '24 hours'
     GROUP BY status`,
    [userId],
  );
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = parseInt(r.count, 10);
  return {
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    running: counts.running ?? 0,
    pending: counts.pending ?? 0,
    completed: counts.completed ?? 0,
    failed: counts.failed ?? 0,
  };
}

/** Generate a unique task ID */
export function generateTaskId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `task_${ts}_${rand}`;
}
