/**
 * TTS Client v2 — Unified text-to-speech abstraction
 *
 * Supports two backends behind one interface:
 *   - kokoro  → Kokoro TTS via OpenAI-compatible API (default)
 *   - qwen3   → Qwen3-TTS via OpenAI-compatible API
 *
 * Switch via env: TTS_PROVIDER=kokoro|qwen3
 *
 * Both backends implement the OpenAI /v1/audio/speech endpoint.
 * This layer adds:
 *   1. Provider switching (env or per-call)
 *   2. Language-aware voice selection (Quechua, Spanish, English)
 *   3. WhatsApp voice note support (OGG Opus via /v1/audio/whatsapp)
 *   4. Retry logic, logging, and health checks
 *   5. Backward-compatible with existing tts-client.ts functions
 */

import {
  TTS_BASE_URL, TTS_API_KEY, TTS_DEFAULT_VOICE,
} from '../config.js';
import { logger } from '../shared/logger.js';

// ── Types ───────────────────────────────────────────────────────────

export type TTSProvider = 'kokoro' | 'qwen3';

export interface VoiceNoteResult {
  filePath: string;
  durationSeconds: number;
  provider: TTSProvider;
}

export interface SpeechResult {
  audio: Buffer;
  provider: TTSProvider;
  latencyMs: number;
}

export interface SynthesizeOptions {
  voice?: string;
  speed?: number;
  /** Override provider for this call only */
  provider?: TTSProvider;
  /** Language hint — used for auto voice selection */
  language?: string;
}

// ── Provider config ─────────────────────────────────────────────────

const TTS_PROVIDER: TTSProvider =
  (process.env.TTS_PROVIDER as TTSProvider) || 'kokoro';

// Qwen3-TTS config
const QWEN_TTS_BASE_URL = process.env.QWEN_TTS_BASE_URL || 'http://localhost:9600/v1';
const QWEN_TTS_API_KEY = process.env.QWEN_TTS_API_KEY || TTS_API_KEY;
const QWEN_TTS_MODEL = process.env.QWEN_TTS_MODEL || 'qwen3-tts';

// Kokoro model name (for the /v1/audio/speech endpoint)
const KOKORO_MODEL = process.env.TTS_MODEL || 'kokoro';

const MAX_VOICE_NOTE_CHARS = 500;
const MAX_RETRIES = 2;
const TIMEOUT_MS = 30_000;

// ── Voice Maps ──────────────────────────────────────────────────────

/**
 * Language → preferred voice per provider.
 * Extend as new voices become available.
 */
const VOICE_MAP: Record<TTSProvider, Record<string, string>> = {
  kokoro: {
    en: 'af_heart',
    es: 'af_heart',        // Kokoro's default — works well for Spanish
    qu: 'af_heart',        // Quechua — fall back to default (closest phonemes)
    default: 'af_heart',
  },
  qwen3: {
    en: 'en-female-1',
    es: 'es-female-1',
    qu: 'es-female-1',     // Quechua — Spanish voice as closest match
    default: 'en-female-1',
  },
};

// ── Helpers ─────────────────────────────────────────────────────────

function resolveBackend(provider: TTSProvider): { baseUrl: string; apiKey: string; model: string } {
  switch (provider) {
    case 'qwen3':
      return { baseUrl: QWEN_TTS_BASE_URL, apiKey: QWEN_TTS_API_KEY, model: QWEN_TTS_MODEL };
    case 'kokoro':
    default:
      return { baseUrl: TTS_BASE_URL, apiKey: TTS_API_KEY, model: KOKORO_MODEL };
  }
}

/**
 * Pick the right voice: explicit > language-based > config default > provider default.
 */
function resolveVoice(provider: TTSProvider, explicit?: string, language?: string): string {
  if (explicit) return explicit;
  const map = VOICE_MAP[provider] || VOICE_MAP.kokoro;
  if (language && map[language]) return map[language];
  // Use the configured default for Kokoro, provider default for qwen3
  if (provider === 'kokoro') return TTS_DEFAULT_VOICE;
  return map.default;
}

// ── Core synthesis ──────────────────────────────────────────────────

/**
 * Synthesize a WhatsApp-ready voice note (OGG Opus).
 * Uses the /v1/audio/whatsapp endpoint which saves to disk.
 * Drop-in replacement for the original synthesizeVoiceNote().
 */
export async function synthesizeVoiceNote(
  text: string,
  options?: SynthesizeOptions,
): Promise<VoiceNoteResult> {
  const provider = options?.provider || TTS_PROVIDER;
  const { baseUrl, apiKey } = resolveBackend(provider);
  const voice = resolveVoice(provider, options?.voice, options?.language);

  const truncated = text.length > MAX_VOICE_NOTE_CHARS
    ? text.slice(0, MAX_VOICE_NOTE_CHARS).replace(/\s+\S*$/, '…')
    : text;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const start = Date.now();
    try {
      const res = await fetch(`${baseUrl}/v1/audio/whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          text: truncated,
          voice,
          speed: options?.speed ?? 1.0,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`TTS voice note failed: ${res.status} ${body}`);
      }

      const data = (await res.json()) as {
        ok: boolean;
        file_path: string;
        duration_seconds: number;
        error?: string;
      };

      if (!data.ok) {
        throw new Error(`TTS synthesis error: ${data.error || 'unknown'}`);
      }

      const latencyMs = Date.now() - start;
      logger.info({
        provider, latencyMs,
        durationSeconds: data.duration_seconds,
        textLength: truncated.length,
        voice,
      }, 'TTS voice note synthesized');

      return {
        filePath: data.file_path,
        durationSeconds: data.duration_seconds,
        provider,
      };
    } catch (err: any) {
      lastError = err;
      if (err?.message?.includes('failed: 4')) throw err;
      if (attempt < MAX_RETRIES) {
        const delay = 500 * (attempt + 1);
        logger.warn({ attempt, delay, error: err?.message, provider }, 'TTS voice note retry');
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error('TTS voice note failed after retries');
}

/**
 * Synthesize raw audio buffer.
 * Drop-in replacement for the original synthesizeSpeech().
 */
export async function synthesizeSpeech(
  text: string,
  format: string = 'mp3',
  options?: SynthesizeOptions,
): Promise<SpeechResult> {
  const provider = options?.provider || TTS_PROVIDER;
  const { baseUrl, apiKey, model } = resolveBackend(provider);
  const voice = resolveVoice(provider, options?.voice, options?.language);

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const start = Date.now();
    try {
      const res = await fetch(`${baseUrl}/v1/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: text,
          voice,
          speed: options?.speed ?? 1.0,
          response_format: format,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`TTS speech failed: ${res.status} ${body}`);
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      const latencyMs = Date.now() - start;

      logger.info({
        provider, latencyMs, format,
        sizeBytes: buffer.length, voice,
      }, 'TTS speech synthesized');

      return { audio: buffer, provider, latencyMs };
    } catch (err: any) {
      lastError = err;
      if (err?.message?.includes('failed: 4')) throw err;
      if (attempt < MAX_RETRIES) {
        const delay = 500 * (attempt + 1);
        logger.warn({ attempt, delay, error: err?.message, provider }, 'TTS speech retry');
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error('TTS speech failed after retries');
}

/**
 * Synthesize with language-aware defaults for health contexts.
 * Slightly slower pacing for medical content — clarity matters.
 */
export async function synthesizeHealthVoiceNote(
  text: string,
  language: string,
  options?: Omit<SynthesizeOptions, 'language'>,
): Promise<VoiceNoteResult> {
  // Slower for Quechua (oral tradition, unfamiliar medical terms)
  const speed = options?.speed ?? (language === 'qu' ? 0.9 : 0.95);

  return synthesizeVoiceNote(text, {
    ...options,
    language,
    speed,
  });
}

/**
 * List available TTS voices from active backend.
 */
export async function listVoices(provider?: TTSProvider): Promise<string[]> {
  const p = provider || TTS_PROVIDER;
  const { baseUrl, apiKey } = resolveBackend(p);

  try {
    const res = await fetch(`${baseUrl}/v1/audio/voices`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];
    const data = (await res.json()) as { voices: Array<{ id: string }> };
    return data.voices.map((v) => v.id);
  } catch {
    return [];
  }
}

/**
 * Get the currently active TTS provider.
 */
export function getTTSProvider(): TTSProvider {
  return TTS_PROVIDER;
}

/**
 * Health check against the active or specified backend.
 */
export async function healthCheck(
  provider?: TTSProvider,
): Promise<{ ok: boolean; provider: TTSProvider; latencyMs: number }> {
  const p = provider || TTS_PROVIDER;
  const { baseUrl, apiKey } = resolveBackend(p);
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}/v1/audio/voices`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    return { ok: res.ok, provider: p, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, provider: p, latencyMs: Date.now() - start };
  }
}
