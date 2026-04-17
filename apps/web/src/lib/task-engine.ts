/**
 * Task Engine v4 — Postgres-backed
 *
 * Replaces v3's in-memory Map with Postgres persistence.
 * Tasks survive process restarts. Same API surface for voice tools.
 *
 * Features:
 *   - Postgres-backed priority queue with cancel/reprioritize
 *   - Task dependencies (blockedBy chain)
 *   - Progress updates (SSE events + Postgres)
 *   - Task templates for common CEO operations
 *   - Shared between voice mode, chat, and dashboard
 */

import { directAgent } from '@/mastra';
import {
  type AgentTask,
  getAllTasks as dbGetAllTasks,
  getTask as dbGetTask,
  insertTask,
  updateTaskStatus,
  updateTaskProgress,
  updateTaskPriority,
  markTaskNotified,
  getUnnotifiedTasks as dbGetUnnotifiedTasks,
  getTaskSummary as dbGetTaskSummary,
  generateTaskId,
} from '@/lib/task-store';

// Re-export the type
export type { AgentTask } from '@/lib/task-store';

// ── In-process state (for SSE events + active abort controllers) ──

const abortControllers = new Map<string, AbortController>();

// ── Listeners (SSE) ──

export type TaskEvent =
  | { type: 'task-created'; task: AgentTask }
  | { type: 'task-progress'; taskId: string; progress: string }
  | { type: 'task-complete'; task: AgentTask }
  | { type: 'task-failed'; task: AgentTask }
  | { type: 'task-cancelled'; taskId: string }
  | { type: 'task-started'; taskId: string };

type TaskListener = (event: TaskEvent) => void;
const listeners = new Set<TaskListener>();

export function onTaskEvent(fn: TaskListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function onTaskComplete(fn: (task: AgentTask) => void): () => void {
  return onTaskEvent((evt) => {
    if (evt.type === 'task-complete' && 'task' in evt) fn(evt.task);
  });
}

function emit(event: TaskEvent) {
  for (const fn of listeners) {
    try { fn(event); } catch { /* ignore listener errors */ }
  }
}

// ── Task Templates ──

export interface TaskTemplate {
  id: string;
  name: string;
  nameEs: string;
  description: string;
  prompt: string;
  priority: AgentTask['priority'];
  estimatedTime: string;
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'daily-summary',
    name: 'Daily Summary',
    nameEs: 'Resumen del dia',
    description: 'Resumen completo de la actividad del negocio hoy',
    prompt: 'Genera un resumen completo de la actividad del negocio hoy: ventas, pedidos, pagos pendientes, clientes nuevos, citas completadas. Incluye recomendaciones para manana.',
    priority: 'normal',
    estimatedTime: '30s',
  },
  {
    id: 'payment-followup',
    name: 'Payment Follow-up',
    nameEs: 'Seguimiento de pagos',
    description: 'Revisar y dar seguimiento a pagos pendientes',
    prompt: 'Revisa todos los pagos pendientes. Para cada uno, identifica cuanto tiempo lleva pendiente y sugiere una accion: enviar recordatorio, marcar como urgente, o cerrar.',
    priority: 'high',
    estimatedTime: '20s',
  },
  {
    id: 'market-research',
    name: 'Market Research',
    nameEs: 'Investigacion de mercado',
    description: 'Investigar competidores y tendencias del mercado',
    prompt: 'Investiga el mercado local para mi tipo de negocio. Busca tendencias, precios de la competencia, y oportunidades. Enfocate en el mercado peruano / latinoamericano.',
    priority: 'normal',
    estimatedTime: '60s',
  },
  {
    id: 'customer-analysis',
    name: 'Customer Analysis',
    nameEs: 'Analisis de clientes',
    description: 'Analizar patrones de clientes y mejores clientes',
    prompt: 'Analiza los patrones de clientes: quienes compran mas, frecuencia de compra, productos favoritos, clientes que no han comprado recientemente. Sugiere estrategias de retencion.',
    priority: 'normal',
    estimatedTime: '30s',
  },
  {
    id: 'weekly-report',
    name: 'Weekly Report',
    nameEs: 'Reporte semanal',
    description: 'Reporte semanal completo del negocio',
    prompt: 'Genera un reporte semanal completo: ingresos totales, comparacion con semana anterior, top clientes, productos mas vendidos, pagos cobrados vs pendientes, citas realizadas.',
    priority: 'normal',
    estimatedTime: '45s',
  },
];

// ── Public API ──

export async function getAllTasks(userId: string, statusFilter?: string): Promise<AgentTask[]> {
  return dbGetAllTasks(userId, statusFilter);
}

export async function getTask(taskId: string): Promise<AgentTask | null> {
  return dbGetTask(taskId);
}

export async function getTaskSummary(userId: string) {
  return dbGetTaskSummary(userId);
}

export function markNotified(taskId: string): void {
  markTaskNotified(taskId).catch(() => {});
}

export async function getUnnotifiedTasks(userId: string): Promise<AgentTask[]> {
  return dbGetUnnotifiedTasks(userId);
}

export async function cancelTask(taskId: string): Promise<boolean> {
  const task = await dbGetTask(taskId);
  if (!task || task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
    return false;
  }

  await updateTaskStatus(taskId, 'cancelled', { completedAt: Date.now() });

  const ac = abortControllers.get(taskId);
  if (ac) {
    ac.abort();
    abortControllers.delete(taskId);
  }

  emit({ type: 'task-cancelled', taskId });
  return true;
}

export async function reprioritize(taskId: string, priority: AgentTask['priority']): Promise<boolean> {
  const task = await dbGetTask(taskId);
  if (!task || task.status === 'completed' || task.status === 'failed') return false;
  await updateTaskPriority(taskId, priority);
  return true;
}

// ── Task Creation (from dashboard or voice) ──

export async function createTaskFromAPI(userId: string, opts: {
  description: string;
  priority?: AgentTask['priority'];
  template?: string;
  after?: string;
}): Promise<AgentTask> {
  const template = opts.template ? TASK_TEMPLATES.find(t => t.id === opts.template) : undefined;
  const taskDesc = template ? template.prompt : opts.description;
  const taskPriority = template?.priority ?? opts.priority ?? 'normal';
  const taskId = generateTaskId();

  const task: AgentTask = {
    id: taskId,
    userId,
    description: template?.nameEs ?? opts.description,
    priority: taskPriority,
    status: opts.after ? 'pending' : 'running',
    agent: 'ceo-direct',
    template: opts.template,
    startedAt: Date.now(),
    notified: false,
    progressHistory: [],
    blockedBy: opts.after,
  };

  await insertTask(task);
  emit({ type: 'task-created', task });

  if (opts.after) {
    // Wait for parent task to complete via polling
    const pollParent = setInterval(async () => {
      const parent = await dbGetTask(opts.after!);
      if (!parent || parent.status === 'completed') {
        clearInterval(pollParent);
        await updateTaskStatus(taskId, 'running');
        task.status = 'running';
        task.startedAt = Date.now();
        emit({ type: 'task-started', taskId });
        executeTask(taskId, taskDesc, userId);
      } else if (parent.status === 'failed' || parent.status === 'cancelled') {
        clearInterval(pollParent);
        await updateTaskStatus(taskId, 'failed', {
          error: `Blocked by failed task ${opts.after}`,
          completedAt: Date.now(),
        });
        task.status = 'failed';
        task.error = `Blocked by failed task ${opts.after}`;
        emit({ type: 'task-failed', task });
      }
    }, 3000);
  } else {
    executeTask(taskId, taskDesc, userId);
  }

  return task;
}

// ── Task Execution ──

function executeTask(taskId: string, prompt: string, userId: string): void {
  const ac = new AbortController();
  abortControllers.set(taskId, ac);

  updateTaskProgress(taskId, 'Procesando...').catch(() => {});
  emit({ type: 'task-progress', taskId, progress: 'Procesando...' });

  (async () => {
    try {
      const result = await directAgent.generate(prompt, {
        maxSteps: 8,
        abortSignal: ac.signal,
        onStepFinish: (step: any) => {
          if (step.toolCalls?.length > 0) {
            const toolNames = step.toolCalls.map((tc: any) => tc.toolName).join(', ');
            const progress = `Usando: ${toolNames}`;
            updateTaskProgress(taskId, progress).catch(() => {});
            emit({ type: 'task-progress', taskId, progress });
          }
        },
      });

      abortControllers.delete(taskId);

      const text = result.text || 'Tarea completada.';
      await updateTaskStatus(taskId, 'completed', {
        result: text,
        completedAt: Date.now(),
      });

      const task = await dbGetTask(taskId);
      if (task) emit({ type: 'task-complete', task });
    } catch (err) {
      abortControllers.delete(taskId);

      const message = err instanceof Error ? err.message : String(err);
      await updateTaskStatus(taskId, 'failed', {
        error: message,
        completedAt: Date.now(),
      });

      const task = await dbGetTask(taskId);
      if (task) emit({ type: 'task-failed', task });
    }
  })();
}

// ── Voice Tool Definitions (for LLM function calling) ──

export const VOICE_TASK_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'assign_task',
      description: 'Assign a complex task to the background agent.',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'What the agent should do' },
          priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
          template: { type: 'string', description: 'Template ID: daily-summary, payment-followup, market-research, customer-analysis, weekly-report' },
        },
        required: ['description'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'check_tasks',
      description: 'Check status of background tasks.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'cancel_task',
      description: 'Cancel a running background task.',
      parameters: {
        type: 'object',
        properties: { task_id: { type: 'string' } },
        required: ['task_id'],
      },
    },
  },
];
