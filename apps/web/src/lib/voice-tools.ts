/**
 * Voice Mode Tool System v2
 *
 * Tools for the voice LLM + async task notification system.
 * When OpenClaw finishes a task, it auto-summarizes and pushes
 * the result to the client via SSE.
 */

import { spawn } from 'child_process';
import { BUSINESS_TOOL_DEFS, handleBusinessTool } from './business-tools';

// ── Task State ──

export interface AgentTask {
  id: string;
  description: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'running' | 'completed' | 'failed';
  agent: string;
  startedAt: number;
  completedAt?: number;
  result?: string;
  error?: string;
  notified: boolean; // Whether the user has been told about the result
}

const tasks = new Map<string, AgentTask>();
let taskCounter = 0;

// SSE listeners — voice clients register here to receive task completions
type TaskListener = (task: AgentTask) => void;
const listeners = new Set<TaskListener>();

export function onTaskComplete(fn: TaskListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getUnnotifiedTasks(): AgentTask[] {
  return Array.from(tasks.values()).filter(
    (t) => (t.status === 'completed' || t.status === 'failed') && !t.notified,
  );
}

export function markNotified(taskId: string): void {
  const t = tasks.get(taskId);
  if (t) t.notified = true;
}

export function getAllTasks(): AgentTask[] {
  return Array.from(tasks.values()).sort((a, b) => b.startedAt - a.startedAt);
}

// ── Tool Definitions ──

export const VOICE_TOOLS = [
  // ── Tier 1: Business tools (System 1 — direct DB, <500ms) ──
  ...BUSINESS_TOOL_DEFS,

  // ── System 2: Agent delegation ──
  {
    type: 'function' as const,
    function: {
      name: 'assign_task',
      description:
        'Assign a complex task to the background agent. Use ONLY for research, analysis, multi-step work, web search, or tasks needing internet. Results delivered automatically. Do NOT use for simple data lookups — use business_metrics, customer_lookup, etc. instead.',
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'What the agent should do — be specific',
          },
          priority: {
            type: 'string',
            enum: ['low', 'normal', 'high', 'urgent'],
          },
        },
        required: ['description'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'check_tasks',
      description:
        'Check status of background tasks. Use when the user asks about progress.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

// ── Tool Handlers ──

// Voice conversation context — set by the API route before tool calls
let _voiceContext = '';

export function setVoiceContext(history: Array<{ role: string; content: string }>): void {
  if (history.length === 0) {
    _voiceContext = '';
    return;
  }
  _voiceContext = history
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Usuario' : 'Agente'}: ${m.content}`)
    .join('\n');
}

const BUSINESS_TOOLS = new Set([
  'business_metrics', 'customer_lookup', 'send_message', 'calendar_today', 'payment_status',
]);

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  // Route business tools to the shared business-tools module
  if (BUSINESS_TOOLS.has(name)) {
    return handleBusinessTool(name, args);
  }

  switch (name) {
    case 'assign_task':
      return assignTask(
        args.description as string,
        (args.priority as AgentTask['priority']) ?? 'normal',
      );
    case 'check_tasks':
      return checkTasks();
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

function assignTask(description: string, priority: AgentTask['priority']): string {
  taskCounter++;
  const id = `task-${taskCounter}`;

  const task: AgentTask = {
    id,
    description,
    priority,
    status: 'running',
    agent: 'yaya-platform',
    startedAt: Date.now(),
    notified: false,
  };

  tasks.set(id, task);

  // Spawn OpenClaw in background
  const OPENCLAW_BIN =
    process.env.OPENCLAW_BIN ?? '/home/yaya/.npm-global/bin/openclaw';

  // Build message with voice conversation context
  const contextBlock = _voiceContext
    ? `[Voice conversation context — the user was discussing this before assigning the task]\n${_voiceContext}\n\n[Task to execute]\n${description}`
    : description;

  const proc = spawn(
    OPENCLAW_BIN,
    [
      'agent',
      '--agent', 'yaya-platform',
      '--message', contextBlock,
      '--local',
      '--thinking', 'off',
      '--timeout', '120',
      '--json',
    ],
    {
      env: {
        ...process.env,
        PATH: '/home/yaya/.npm-global/bin:' + process.env.PATH,
      },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  let output = '';
  proc.stdout?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });

  let stderr = '';
  proc.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  proc.on('close', (code) => {
    const t = tasks.get(id);
    if (!t) return;

    t.completedAt = Date.now();

    if (code === 0) {
      try {
        const jsonStart = output.indexOf('{');
        if (jsonStart >= 0) {
          const data = JSON.parse(output.slice(jsonStart));
          const payloads = data?.payloads ?? data?.result?.payloads ?? [];
          const text = payloads
            .map((p: { text?: string }) => p.text ?? '')
            .filter(Boolean)
            .join('\n');
          t.result = text || 'Task completed (no text output)';
        } else {
          t.result = output.trim() || 'Task completed';
        }
        t.status = 'completed';
      } catch {
        t.result = output.trim() || 'Task completed';
        t.status = 'completed';
      }
    } else {
      t.status = 'failed';
      t.error = stderr.trim() || `Exit code ${code}`;
    }

    // Notify all SSE listeners
    for (const fn of listeners) {
      try {
        fn(t);
      } catch { /* listener error, ignore */ }
    }
  });

  proc.on('error', (err) => {
    const t = tasks.get(id);
    if (t) {
      t.status = 'failed';
      t.error = err.message;
      t.completedAt = Date.now();
      for (const fn of listeners) {
        try { fn(t); } catch { /* ignore */ }
      }
    }
  });

  proc.unref();

  return JSON.stringify({
    task_id: id,
    status: 'assigned',
    message: `Task "${description.slice(0, 60)}" assigned. Results will be delivered automatically when ready.`,
  });
}

function checkTasks(): string {
  const all = getAllTasks().slice(0, 10).map((t) => ({
    id: t.id,
    description: t.description.slice(0, 80),
    status: t.status,
    elapsed: t.completedAt
      ? `${((t.completedAt - t.startedAt) / 1000).toFixed(1)}s`
      : `${((Date.now() - t.startedAt) / 1000).toFixed(0)}s running`,
    hasResult: !!t.result,
  }));

  if (all.length === 0) {
    return JSON.stringify({ message: 'No tasks assigned yet.' });
  }

  return JSON.stringify({ tasks: all });
}
