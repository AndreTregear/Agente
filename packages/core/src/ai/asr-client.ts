/**
 * ASR Client — Unified abstraction over Whisper and Qwen3-ASR.
 * Switch via ASR_PROVIDER env var: "whisper" (default) or "qwen3"
 */
import {
  WHISPER_BASE_URL, WHISPER_API_KEY, WHISPER_MODEL,
} from '../config.js';
import { logger } from '../shared/logger.js';

// Provider config
const ASR_PROVIDER = process.env.ASR_PROVIDER || 'whisper';
const QWEN_ASR_BASE_URL = process.env.QWEN_ASR_BASE_URL || 'http://localhost:9500/v1';
const QWEN_ASR_API_KEY = process.env.QWEN_ASR_API_KEY || '';
const QWEN_ASR_MODEL = process.env.QWEN_ASR_MODEL || 'Qwen/Qwen3-ASR-1.7B';

function mimetypeToExt(mimetype: string): string {
  if (mimetype.includes('ogg')) return 'ogg';
  if (mimetype.includes('mp4')) return 'm4a';
  if (mimetype.includes('mpeg')) return 'mp3';
  if (mimetype.includes('wav')) return 'wav';
  if (mimetype.includes('webm')) return 'webm';
  return 'ogg';
}

function getProviderConfig() {
  if (ASR_PROVIDER === 'qwen3') {
    return { baseUrl: QWEN_ASR_BASE_URL, apiKey: QWEN_ASR_API_KEY, model: QWEN_ASR_MODEL };
  }
  return { baseUrl: WHISPER_BASE_URL, apiKey: WHISPER_API_KEY, model: WHISPER_MODEL };
}

/**
 * Transcribe audio via the configured ASR provider.
 * Both Whisper and Qwen3-ASR use OpenAI-compatible /audio/transcriptions endpoint.
 */
export async function transcribeAudio(
  buffer: Buffer,
  mimetype: string,
  language?: string,
): Promise<{ text: string; language?: string; provider: string }> {
  const config = getProviderConfig();
  const ext = mimetypeToExt(mimetype);
  const startTime = Date.now();

  logger.debug({
    provider: ASR_PROVIDER, mimetype, ext, bufferSize: buffer.length,
    model: config.model, language, baseUrl: config.baseUrl,
  }, 'Transcribing audio');

  const formData = new FormData();
  const arrayBuf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuf], { type: mimetype });
  formData.append('file', blob, `audio.${ext}`);
  formData.append('model', config.model);
  if (language) formData.append('language', language);

  const headers: Record<string, string> = {};
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

  const response = await fetch(`${config.baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'unknown');
    logger.error({ status: response.status, provider: ASR_PROVIDER, error: errText }, 'ASR transcription failed');
    throw new Error(`ASR failed (${ASR_PROVIDER}): ${response.status} ${errText}`);
  }

  const result = await response.json() as { text?: string; language?: string };
  const elapsed = Date.now() - startTime;

  logger.info({
    provider: ASR_PROVIDER, elapsed, textLength: result.text?.length ?? 0,
    detectedLanguage: result.language,
  }, 'ASR transcription complete');

  return {
    text: result.text ?? '',
    language: result.language,
    provider: ASR_PROVIDER,
  };
}

/**
 * Detect language from audio (uses ASR with no language hint).
 */
export async function detectAudioLanguage(
  buffer: Buffer,
  mimetype: string,
): Promise<string | undefined> {
  const result = await transcribeAudio(buffer, mimetype);
  return result.language;
}

/** Get the current ASR provider name */
export function getAsrProvider(): string { return ASR_PROVIDER; }
