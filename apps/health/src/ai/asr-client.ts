/**
 * ASR Client — Unified speech-to-text abstraction
 *
 * Supports two backends behind one interface:
 *   - whisper  → OpenAI-compatible Whisper API (default, battle-tested)
 *   - qwen3   → Qwen3-ASR via OpenAI-compatible API
 *
 * Switch via env: ASR_PROVIDER=whisper|qwen3
 *
 * Both backends use the same OpenAI /v1/audio/transcriptions endpoint.
 * This abstraction adds:
 *   1. Centralised provider switching
 *   2. Language detection with Quechua awareness (delegates to language-detector)
 *   3. Consistent error handling, retry logic, and logging
 *   4. Backward-compatible with existing client.ts (transcribeAudio/transcribeAudioWithQuechua)
 */

import {
  WHISPER_BASE_URL, WHISPER_API_KEY, WHISPER_MODEL, WHISPER_LANGUAGE,
} from '../config.js';
import { logger } from '../shared/logger.js';
import { detectLanguage as detectTextLanguage } from './language-detector.js';

// ── Types ───────────────────────────────────────────────────────────

export type ASRProvider = 'whisper' | 'qwen3';

export interface TranscriptionResult {
  text: string;
  language: string;
  provider: ASRProvider;
  latencyMs: number;
}

export interface TranscribeOptions {
  /** Override language hint (ISO 639-1). If omitted, uses config default. */
  language?: string;
  /** Override MIME type (default: audio/ogg for WhatsApp) */
  mimetype?: string;
  /** Override provider for this call only */
  provider?: ASRProvider;
}

// ── Provider config ─────────────────────────────────────────────────

const ASR_PROVIDER: ASRProvider =
  (process.env.ASR_PROVIDER as ASRProvider) || 'whisper';

// Qwen3-ASR config
const QWEN_ASR_BASE_URL = process.env.QWEN_ASR_BASE_URL || 'http://localhost:9500/v1';
const QWEN_ASR_API_KEY = process.env.QWEN_ASR_API_KEY || WHISPER_API_KEY;
const QWEN_ASR_MODEL = process.env.QWEN_ASR_MODEL || 'qwen3-asr';

const MAX_RETRIES = 2;
const TIMEOUT_MS = 30_000;

// ── Helpers ─────────────────────────────────────────────────────────

/** Map mimetype to file extension for the ASR API. */
function mimetypeToExt(mimetype: string): string {
  if (mimetype.includes('ogg')) return 'ogg';
  if (mimetype.includes('mp4')) return 'm4a';
  if (mimetype.includes('mpeg')) return 'mp3';
  if (mimetype.includes('wav')) return 'wav';
  if (mimetype.includes('webm')) return 'webm';
  return 'ogg'; // default for WhatsApp voice notes
}

function resolveBackend(provider: ASRProvider): { baseUrl: string; apiKey: string; model: string } {
  switch (provider) {
    case 'qwen3':
      return { baseUrl: QWEN_ASR_BASE_URL, apiKey: QWEN_ASR_API_KEY, model: QWEN_ASR_MODEL };
    case 'whisper':
    default:
      return { baseUrl: WHISPER_BASE_URL, apiKey: WHISPER_API_KEY, model: WHISPER_MODEL };
  }
}

// ── Core transcription ──────────────────────────────────────────────

/**
 * Low-level: call the ASR API with retries.
 */
async function callASR(
  buffer: Buffer,
  mimetype: string,
  language: string,
  provider: ASRProvider,
): Promise<{ text: string; latencyMs: number }> {
  const { baseUrl, apiKey, model } = resolveBackend(provider);
  const ext = mimetypeToExt(mimetype);
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const startTime = Date.now();
    try {
      logger.debug({
        provider, mimetype, ext, bufferSize: buffer.length,
        model, language, baseUrl, attempt,
      }, 'ASR transcription attempt');

      const formData = new FormData();
      const arrayBuf = buffer.buffer.slice(
        buffer.byteOffset, buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer;
      const blob = new Blob([arrayBuf], { type: mimetype });
      formData.append('file', blob, `audio.${ext}`);
      formData.append('model', model);
      formData.append('language', language);

      const response = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        const errText = await response.text();
        const latencyMs = Date.now() - startTime;
        logger.error({ status: response.status, error: errText, latencyMs, provider }, 'ASR API error');
        throw new Error(`ASR API error ${response.status}: ${errText}`);
      }

      const result = (await response.json()) as { text: string };
      const latencyMs = Date.now() - startTime;

      logger.debug({
        provider, transcriptionLength: result.text.length,
        latencyMs, language,
      }, 'ASR transcription complete');

      return { text: result.text, latencyMs };
    } catch (err: any) {
      lastError = err;
      // Don't retry 4xx errors
      if (err?.message?.includes('ASR API error 4')) throw err;
      if (attempt < MAX_RETRIES) {
        const delay = 500 * (attempt + 1);
        logger.warn({ attempt, delay, error: err?.message, provider }, 'ASR retry');
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error('ASR request failed after retries');
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Transcribe audio buffer to text.
 * Drop-in replacement for the original client.ts transcribeAudio().
 */
export async function transcribeAudio(
  buffer: Buffer,
  mimetype: string,
  options?: TranscribeOptions,
): Promise<TranscriptionResult> {
  const provider = options?.provider || ASR_PROVIDER;
  const language = options?.language || WHISPER_LANGUAGE;

  const { text, latencyMs } = await callASR(buffer, mimetype, language, provider);

  return { text, language, provider, latencyMs };
}

/**
 * Transcribe with Quechua-first strategy.
 * Tries Quechua, falls back to Spanish if result is too short.
 * Drop-in replacement for the original transcribeAudioWithQuechua().
 */
export async function transcribeAudioWithQuechua(
  buffer: Buffer,
  mimetype: string,
  options?: { provider?: ASRProvider },
): Promise<TranscriptionResult> {
  const provider = options?.provider || ASR_PROVIDER;

  try {
    const quResult = await callASR(buffer, mimetype, 'qu', provider);
    if (quResult.text && quResult.text.trim().length >= 3) {
      logger.debug({ textLength: quResult.text.length, provider }, 'Using Quechua transcription');
      return { text: quResult.text, language: 'qu', provider, latencyMs: quResult.latencyMs };
    }
  } catch (err) {
    logger.debug({ err, provider }, 'Quechua transcription failed, falling back to Spanish');
  }

  // Fall back to Spanish
  const esResult = await callASR(buffer, mimetype, 'es', provider);
  return { text: esResult.text, language: 'es', provider, latencyMs: esResult.latencyMs };
}

/**
 * Transcribe with auto language detection.
 * Transcribes first (with default language), then uses text-based detection
 * to identify Quechua. If Quechua is detected, re-transcribes with 'qu' hint.
 */
export async function transcribeWithAutoDetect(
  buffer: Buffer,
  mimetype: string,
  options?: { provider?: ASRProvider },
): Promise<TranscriptionResult> {
  const provider = options?.provider || ASR_PROVIDER;

  // First pass: transcribe with default language
  const initial = await callASR(buffer, mimetype, WHISPER_LANGUAGE, provider);

  // Detect language from transcribed text
  const detectedLang = detectTextLanguage(initial.text);

  // If Quechua detected, re-transcribe with Quechua hint for better accuracy
  if (detectedLang === 'qu') {
    try {
      const quResult = await callASR(buffer, mimetype, 'qu', provider);
      if (quResult.text && quResult.text.trim().length >= 3) {
        return {
          text: quResult.text,
          language: 'qu',
          provider,
          latencyMs: initial.latencyMs + quResult.latencyMs,
        };
      }
    } catch {
      // Fall through to initial result
    }
  }

  return {
    text: initial.text,
    language: detectedLang,
    provider,
    latencyMs: initial.latencyMs,
  };
}

/**
 * Get the currently active ASR provider.
 */
export function getASRProvider(): ASRProvider {
  return ASR_PROVIDER;
}

/**
 * Health check against the active or specified backend.
 */
export async function healthCheck(
  provider?: ASRProvider,
): Promise<{ ok: boolean; provider: ASRProvider; latencyMs: number }> {
  const p = provider || ASR_PROVIDER;
  const { baseUrl, apiKey } = resolveBackend(p);
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    return { ok: res.ok, provider: p, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, provider: p, latencyMs: Date.now() - start };
  }
}

// Re-export for backward compatibility
export { mimetypeToExt };
