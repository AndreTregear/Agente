/**
 * Tasks REST API — Postgres-backed
 *
 * GET  /api/tasks              — list tasks (with ?status= filter)
 * GET  /api/tasks?action=templates — list templates
 * GET  /api/tasks?id=X         — get single task
 * POST /api/tasks              — create / cancel / reprioritize
 */

import { NextRequest } from 'next/server';
import {
  getAllTasks,
  getTask,
  getTaskSummary,
  createTaskFromAPI,
  cancelTask,
  reprioritize,
  TASK_TEMPLATES,
  type AgentTask,
} from '@/lib/task-engine';
import { withActiveSubscription, type GatedContext } from '@/lib/billing/entitlement';

export const dynamic = 'force-dynamic';

async function getImpl(req: NextRequest, ctx: GatedContext) {
  const url = new URL(req.url);
  const userId = ctx.session.user.id;
  const action = url.searchParams.get('action');

  if (action === 'templates') {
    return Response.json({ templates: TASK_TEMPLATES });
  }

  const taskId = url.searchParams.get('id');
  if (taskId) {
    const task = await getTask(taskId);
    if (!task || task.userId !== userId) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }
    return Response.json({ task: formatTask(task) });
  }

  const statusFilter = url.searchParams.get('status') || undefined;
  const [tasks, summary] = await Promise.all([
    getAllTasks(userId, statusFilter),
    getTaskSummary(userId),
  ]);

  return Response.json({
    tasks: tasks.map(formatTask),
    summary,
  });
}

async function postImpl(req: NextRequest, ctx: GatedContext) {
  const body = await req.json();
  const userId = ctx.session.user.id;
  const { action } = body;

  switch (action) {
    case 'create': {
      const task = await createTaskFromAPI(userId, {
        description: body.description,
        priority: body.priority,
        template: body.template,
        after: body.after,
      });
      return Response.json({ task: formatTask(task) }, { status: 201 });
    }

    case 'cancel': {
      // Verify ownership
      const task = await getTask(body.taskId);
      if (!task || task.userId !== userId) {
        return Response.json({ error: 'Task not found' }, { status: 404 });
      }
      const ok = await cancelTask(body.taskId);
      if (!ok) return Response.json({ error: 'Cannot cancel this task' }, { status: 400 });
      return Response.json({ cancelled: true, taskId: body.taskId });
    }

    case 'reprioritize': {
      const task = await getTask(body.taskId);
      if (!task || task.userId !== userId) {
        return Response.json({ error: 'Task not found' }, { status: 404 });
      }
      const ok = await reprioritize(body.taskId, body.priority);
      if (!ok) return Response.json({ error: 'Cannot reprioritize this task' }, { status: 400 });
      return Response.json({ reprioritized: true, taskId: body.taskId, priority: body.priority });
    }

    default:
      if (body.description) {
        const task = await createTaskFromAPI(userId, {
          description: body.description,
          priority: body.priority,
          template: body.template,
          after: body.after,
        });
        return Response.json({ task: formatTask(task) }, { status: 201 });
      }
      return Response.json({ error: 'Missing action or description' }, { status: 400 });
  }
}

function formatTask(t: AgentTask) {
  return {
    id: t.id,
    description: t.description,
    priority: t.priority,
    status: t.status,
    template: t.template,
    progress: t.progress,
    progressHistory: t.progressHistory,
    result: t.result?.slice(0, 4000),
    error: t.error,
    elapsed: t.completedAt
      ? `${((t.completedAt - t.startedAt) / 1000).toFixed(1)}s`
      : `${((Date.now() - t.startedAt) / 1000).toFixed(0)}s`,
    startedAt: t.startedAt,
    completedAt: t.completedAt,
    blockedBy: t.blockedBy,
  };
}

export const GET = withActiveSubscription(getImpl);
export const POST = withActiveSubscription(postImpl);
