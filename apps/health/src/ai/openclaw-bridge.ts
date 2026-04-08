/**
 * OpenClaw Bridge — calls the yaya-health OpenClaw agent via CLI.
 *
 * Uses `openclaw agent --agent yaya-health --message "..." --json`
 * to invoke the local OpenClaw agent.
 *
 * Adapted from yaya_platform for health context:
 * - Patient context instead of business/tenant context
 * - Health worker routing instead of owner routing
 * - No subscription checks, no tenant-provisioner, no business-context-repo
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from '../shared/logger.js';
import * as patientRepo from '../db/repos/patient-repo.js';

const execFileAsync = promisify(execFile);

export interface OpenClawBridgeResult {
  reply: string;
}

const OPENCLAW_BIN = process.env.OPENCLAW_BIN || 'openclaw';
const OPENCLAW_AGENT = process.env.OPENCLAW_AGENT || 'yaya-health';
const OPENCLAW_TIMEOUT_MS = Number(process.env.OPENCLAW_TIMEOUT_MS) || 120_000;

// Health worker JIDs (comma-separated in env, e.g. "51999999999@s.whatsapp.net,51888888888@s.whatsapp.net")
const HEALTH_WORKER_JIDS = new Set(
  (process.env.HEALTH_WORKER_JIDS || '').split(',').map(j => j.trim()).filter(Boolean),
);

interface OpenClawResponse {
  result?: {
    payloads?: Array<{ text: string; mediaUrl?: string | null }>;
    meta?: {
      durationMs?: number;
      agentMeta?: { model?: string; sessionId?: string };
    };
  };
  error?: string;
}

type CallErrorType = 'timeout' | 'empty' | 'parse_error' | 'agent_error';

/**
 * Call the OpenClaw agent and return its reply.
 */
async function callOpenClaw(message: string, sessionId?: string): Promise<{ reply: string; durationMs: number; error?: CallErrorType }> {
  const startTime = Date.now();

  const args = [
    'agent',
    '--agent', OPENCLAW_AGENT,
    '--message', message,
    '--json',
  ];

  if (sessionId) {
    args.push('--session-id', sessionId);
  }

  try {
    logger.debug({ agent: OPENCLAW_AGENT, messageLength: message.length, sessionId }, 'Calling OpenClaw agent');

    const { stdout, stderr } = await execFileAsync(OPENCLAW_BIN, args, {
      timeout: OPENCLAW_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
      env: { ...process.env },
    });

    if (stderr) {
      logger.debug({ stderr: stderr.slice(0, 500) }, 'OpenClaw stderr');
    }

    // Parse JSON — openclaw may output non-JSON before the actual JSON
    const jsonStart = stdout.indexOf('{');
    if (jsonStart === -1) {
      logger.error({ stdout: stdout.slice(0, 500) }, 'OpenClaw returned no JSON');
      return { reply: '', durationMs: Date.now() - startTime, error: 'empty' };
    }

    const jsonStr = stdout.slice(jsonStart);
    let data: OpenClawResponse;
    try {
      data = JSON.parse(jsonStr);
    } catch {
      logger.error({ jsonStr: jsonStr.slice(0, 500) }, 'OpenClaw returned invalid JSON');
      return { reply: '', durationMs: Date.now() - startTime, error: 'parse_error' };
    }

    if (data.error) {
      logger.error({ error: data.error }, 'OpenClaw agent error');
      return { reply: '', durationMs: Date.now() - startTime, error: 'agent_error' };
    }

    const text = data.result?.payloads?.[0]?.text || '';

    if (!text || text.trim().length === 0) {
      logger.warn({ agent: OPENCLAW_AGENT }, 'OpenClaw returned empty reply');
      return { reply: '', durationMs: Date.now() - startTime, error: 'empty' };
    }

    logger.info({
      agent: OPENCLAW_AGENT,
      model: data.result?.meta?.agentMeta?.model,
      replyLength: text.length,
      modelDurationMs: data.result?.meta?.durationMs || 0,
      totalDurationMs: Date.now() - startTime,
    }, 'OpenClaw agent replied');

    return { reply: text, durationMs: Date.now() - startTime };
  } catch (err: unknown) {
    const error = err as { killed?: boolean; message?: string; code?: string };
    if (error.killed) {
      logger.error({ timeoutMs: OPENCLAW_TIMEOUT_MS }, 'OpenClaw agent timed out');
      return { reply: '', durationMs: Date.now() - startTime, error: 'timeout' };
    }
    logger.error({ err: error.message, code: error.code }, 'OpenClaw agent call failed');
    return { reply: '', durationMs: Date.now() - startTime, error: 'agent_error' };
  }
}

/**
 * Get the appropriate Spanish fallback message for an error type.
 */
function getFallbackMessage(error?: CallErrorType): string {
  switch (error) {
    case 'timeout':
      return 'Estoy procesando tu consulta, dame un momento por favor... 🏥';
    case 'empty':
    case 'parse_error':
    case 'agent_error':
    default:
      return 'Lo siento, tuve un problema técnico. ¿Podrías repetirme tu consulta? 🙏';
  }
}

/**
 * Build context string for the agent from patient data.
 * Includes patient info (if known) for personalized health responses.
 */
async function buildPatientContext(tenantId: string, jid: string, pushName?: string | null): Promise<string> {
  const parts: string[] = [];
  parts.push(`[Yaya Salud — Asistente de salud por WhatsApp]`);
  parts.push(`[Tenant: ${tenantId}]`);

  // Try to find existing patient by phone
  const phone = jid.split('@')[0];
  try {
    const patient = await patientRepo.findPatientByPhone(tenantId, phone);
    if (patient) {
      parts.push(`[Paciente registrado: ${patient.full_name} (ID: ${patient.id})]`);
      if (patient.date_of_birth) parts.push(`[Fecha de nacimiento: ${patient.date_of_birth}]`);
      if (patient.sex) parts.push(`[Sexo: ${patient.sex}]`);

      // Get children info
      const children = await patientRepo.getChildrenByPatient(tenantId, patient.id);
      if (children.length > 0) {
        const childrenInfo = children.map(c =>
          `${c.full_name} (${c.sex}, nacido: ${c.date_of_birth})`
        ).join('; ');
        parts.push(`[Hijos registrados: ${childrenInfo}]`);
      }
    } else {
      parts.push(`[Paciente: ${pushName || phone} (no registrado)]`);
    }
  } catch {
    parts.push(`[Paciente: ${pushName || phone}]`);
  }

  return parts.join(' ');
}

/**
 * Process a patient message through OpenClaw.
 * Called from ai-queue.ts for incoming WhatsApp messages.
 * Never throws — all errors return a friendly fallback.
 */
export async function processWithOpenClaw(
  tenantId: string,
  jid: string,
  text: string,
  onChunk: (chunk: string) => Promise<void>,
  pushName?: string | null,
  mediaUrl?: string,
): Promise<OpenClawBridgeResult> {
  try {
    const context = await buildPatientContext(tenantId, jid, pushName);
    const sessionId = `p-${tenantId.slice(0, 8)}-${Date.now()}`;

    let fullMessage = text;
    if (mediaUrl) {
      fullMessage += `\n[Paciente envió una imagen: ${mediaUrl}]`;
    }

    const messageWithContext = `${context}\n\nMensaje del paciente: ${fullMessage}`;

    const { reply, error } = await callOpenClaw(messageWithContext, sessionId);

    if (!reply) {
      const fallback = getFallbackMessage(error);
      await onChunk(fallback);
      return { reply: fallback };
    }

    await onChunk(reply);
    return { reply };
  } catch (err) {
    logger.error({ err, tenantId, jid }, 'OpenClaw bridge processWithOpenClaw failed');
    const fallback = getFallbackMessage();
    try { await onChunk(fallback); } catch { /* best effort */ }
    return { reply: fallback };
  }
}

/**
 * Process a health worker message through OpenClaw.
 * Health workers get elevated context (like owner mode in yaya_platform).
 * Never throws — all errors return a friendly fallback.
 */
export async function processHealthWorkerWithOpenClaw(
  tenantId: string,
  jid: string,
  text: string,
): Promise<{ reply: string }> {
  try {
    const sessionId = `hw-${tenantId.slice(0, 8)}-${Date.now()}`;

    const parts: string[] = [];
    parts.push(`[Yaya Salud — Modo Trabajador de Salud]`);
    parts.push(`[Tenant: ${tenantId}]`);
    parts.push(`[Este es un trabajador de salud registrado hablando contigo directamente]`);
    parts.push(`[Puede pedir reportes, estadísticas, datos de pacientes, y administrar el sistema]`);

    const messageWithContext = `${parts.join(' ')}\n\nMensaje del trabajador de salud: ${text}`;

    const { reply, error } = await callOpenClaw(messageWithContext, sessionId);

    return { reply: reply || getFallbackMessage(error) };
  } catch (err) {
    logger.error({ err, tenantId, jid }, 'OpenClaw bridge processHealthWorkerWithOpenClaw failed');
    return { reply: getFallbackMessage() };
  }
}

/**
 * Check if a JID is a registered health worker.
 */
export function isHealthWorker(jid: string): boolean {
  return HEALTH_WORKER_JIDS.has(jid);
}
