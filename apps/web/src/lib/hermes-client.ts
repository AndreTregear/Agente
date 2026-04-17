/**
 * Hermes Agent client — connects to the hermes-agent API server on Lambda.
 *
 * Hermes runs on the same machine (Lambda) as an autonomous agent OS with:
 * - WhatsApp bridge (Baileys, live connection)
 * - Cron scheduler for recurring tasks
 * - Multi-model mixture-of-agents for complex reasoning
 * - Persistent memory across sessions
 *
 * Integration: OpenAI-compatible API at localhost:8642
 */

const HERMES_BASE_URL = process.env.HERMES_BASE_URL ?? 'http://127.0.0.1:8642';
const HERMES_API_KEY = process.env.HERMES_API_KEY ?? '';

// ── Health ──

export async function hermesHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${HERMES_BASE_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Chat Completion (sync task) ──

export interface HermesMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface HermesCompletionResponse {
  id: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
}

export async function hermesChat(
  messages: HermesMessage[],
  opts?: { sessionId?: string; stream?: boolean },
): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (HERMES_API_KEY) headers['Authorization'] = `Bearer ${HERMES_API_KEY}`;
  if (opts?.sessionId) headers['X-Hermes-Session-Id'] = opts.sessionId;

  const res = await fetch(`${HERMES_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'hermes-agent',
      messages,
      stream: false,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) throw new Error(`Hermes HTTP ${res.status}`);
  const data = (await res.json()) as HermesCompletionResponse;
  return data.choices[0]?.message?.content ?? '';
}

// ── Async Run (fire-and-stream) ──

export interface HermesRunResponse {
  run_id: string;
}

export async function hermesStartRun(
  input: string,
  instructions?: string,
): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (HERMES_API_KEY) headers['Authorization'] = `Bearer ${HERMES_API_KEY}`;

  const res = await fetch(`${HERMES_BASE_URL}/v1/runs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      input,
      instructions: instructions ?? 'Eres un asistente CEO para agente.ceo. Responde en espanol.',
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`Hermes run HTTP ${res.status}`);
  const data = (await res.json()) as HermesRunResponse;
  return data.run_id;
}

// ── Cron Jobs ──

export interface HermesCronJob {
  id?: string;
  name: string;
  schedule: string; // cron expression
  prompt: string;
  deliver?: string; // 'local' | 'whatsapp' | 'telegram'
  repeat?: number | null; // null = indefinite
}

export async function hermesCreateCronJob(job: HermesCronJob): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (HERMES_API_KEY) headers['Authorization'] = `Bearer ${HERMES_API_KEY}`;

  const res = await fetch(`${HERMES_BASE_URL}/api/jobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify(job),
    signal: AbortSignal.timeout(5_000),
  });

  if (!res.ok) throw new Error(`Hermes cron HTTP ${res.status}`);
  const data = await res.json();
  return data.id ?? data.name;
}

export async function hermesListCronJobs(): Promise<HermesCronJob[]> {
  const headers: Record<string, string> = {};
  if (HERMES_API_KEY) headers['Authorization'] = `Bearer ${HERMES_API_KEY}`;

  const res = await fetch(`${HERMES_BASE_URL}/api/jobs`, { headers });
  if (!res.ok) return [];
  return res.json();
}

export async function hermesDeleteCronJob(jobId: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (HERMES_API_KEY) headers['Authorization'] = `Bearer ${HERMES_API_KEY}`;

  await fetch(`${HERMES_BASE_URL}/api/jobs/${jobId}`, {
    method: 'DELETE',
    headers,
  });
}

// ── WhatsApp via Hermes ──

export async function hermesSendWhatsApp(
  phone: string,
  message: string,
): Promise<string> {
  return hermesChat([
    {
      role: 'system',
      content: 'Eres un asistente que envia mensajes por WhatsApp. Usa la herramienta send_message para enviar el mensaje.',
    },
    {
      role: 'user',
      content: `Envia este mensaje por WhatsApp al numero ${phone}: "${message}"`,
    },
  ]);
}
