/**
 * OpenClaw Bridge — calls an OpenClaw agent via CLI.
 *
 * Uses `openclaw agent --agent <name> --message "..." --json`
 * Context building is pluggable — set via setContextBuilder().
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from '../shared/logger.js';

const execFileAsync = promisify(execFile);

export interface OpenClawBridgeResult {
  reply: string;
}

const OPENCLAW_BIN = process.env.OPENCLAW_BIN || 'openclaw';
const OPENCLAW_AGENT = process.env.OPENCLAW_AGENT || 'yaya';
const OPENCLAW_TIMEOUT_MS = Number(process.env.OPENCLAW_TIMEOUT_MS) || 120_000;

// Privileged user JIDs (comma-separated in env)
const PRIVILEGED_JIDS = new Set(
  (process.env.PRIVILEGED_JIDS || '').split(',').map(j => j.trim()).filter(Boolean),
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
 * Pluggable context builder. Set this to customize the context
 * prepended to user messages before sending to OpenClaw.
 */
export type ContextBuilder = (tenantId: string, jid: string, pushName?: string | null) => Promise<string>;

let contextBuilder: ContextBuilder = async (tenantId, jid, pushName) => {
  const phone = jid.split('@')[0];
  return `[Tenant: ${tenantId}] [User: ${pushName || phone}]`;
};

/**
 * Set a custom context builder for the OpenClaw bridge.
 */
export function setContextBuilder(builder: ContextBuilder): void {
  contextBuilder = builder;
}

/**
 * Pluggable fallback message generator.
 */
let fallbackMessageFn: (error?: CallErrorType) => string = (error) => {
  return process.env.AI_FALLBACK_MESSAGE || 'Sorry, I had a technical issue. Please try again. 🙏';
};

export function setFallbackMessageFn(fn: (error?: CallErrorType) => string): void {
  fallbackMessageFn = fn;
}

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
 * Process a user message through OpenClaw.
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
    const context = await contextBuilder(tenantId, jid, pushName);
    const sessionId = `u-${tenantId.slice(0, 8)}-${Date.now()}`;

    let fullMessage = text;
    if (mediaUrl) {
      fullMessage += `\n[User sent media: ${mediaUrl}]`;
    }

    const messageWithContext = `${context}\n\nUser message: ${fullMessage}`;

    const { reply, error } = await callOpenClaw(messageWithContext, sessionId);

    if (!reply) {
      const fallback = fallbackMessageFn(error);
      await onChunk(fallback);
      return { reply: fallback };
    }

    await onChunk(reply);
    return { reply };
  } catch (err) {
    logger.error({ err, tenantId, jid }, 'OpenClaw bridge processWithOpenClaw failed');
    const fallback = fallbackMessageFn();
    try { await onChunk(fallback); } catch { /* best effort */ }
    return { reply: fallback };
  }
}

/**
 * Process a privileged user message through OpenClaw.
 * Privileged users get elevated context (admin mode).
 * Never throws — all errors return a friendly fallback.
 */
export async function processPrivilegedWithOpenClaw(
  tenantId: string,
  jid: string,
  text: string,
): Promise<{ reply: string }> {
  try {
    const sessionId = `priv-${tenantId.slice(0, 8)}-${Date.now()}`;

    const parts: string[] = [];
    parts.push(`[Admin Mode]`);
    parts.push(`[Tenant: ${tenantId}]`);
    parts.push(`[This is a privileged/admin user speaking directly]`);
    parts.push(`[Can request reports, statistics, data, and manage the system]`);

    const messageWithContext = `${parts.join(' ')}\n\nAdmin message: ${text}`;

    const { reply, error } = await callOpenClaw(messageWithContext, sessionId);

    return { reply: reply || fallbackMessageFn(error) };
  } catch (err) {
    logger.error({ err, tenantId, jid }, 'OpenClaw bridge processPrivilegedWithOpenClaw failed');
    return { reply: fallbackMessageFn() };
  }
}

/**
 * Check if a JID is a privileged user.
 */
export function isPrivilegedUser(jid: string): boolean {
  return PRIVILEGED_JIDS.has(jid);
}
