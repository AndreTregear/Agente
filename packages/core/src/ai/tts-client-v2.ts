/**
 * TTS Client v2 — Unified abstraction over Kokoro and Qwen3-TTS.
 * Switch via TTS_PROVIDER env var: "kokoro" (default) or "qwen3"
 * Both use OpenAI-compatible /v1/audio/speech endpoint.
 */
import { TTS_BASE_URL, TTS_API_KEY, TTS_DEFAULT_VOICE } from '../config.js';
import { logger } from '../shared/logger.js';

// Provider config
const TTS_PROVIDER = process.env.TTS_PROVIDER || 'kokoro';
const QWEN_TTS_BASE_URL = process.env.QWEN_TTS_BASE_URL || 'http://localhost:9500/v1';
const QWEN_TTS_API_KEY = process.env.QWEN_TTS_API_KEY || '';
const QWEN_TTS_VOICE = process.env.QWEN_TTS_VOICE || 'Ryan';
const QWEN_TTS_MODEL = process.env.QWEN_TTS_MODEL || 'qwen3-tts';

const MAX_VOICE_NOTE_CHARS = 500;

interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  voice: string;
  model: string;
}

function getProviderConfig(): ProviderConfig {
  if (TTS_PROVIDER === 'qwen3') {
    return {
      baseUrl: QWEN_TTS_BASE_URL,
      apiKey: QWEN_TTS_API_KEY,
      voice: QWEN_TTS_VOICE,
      model: QWEN_TTS_MODEL,
    };
  }
  return {
    baseUrl: TTS_BASE_URL,
    apiKey: TTS_API_KEY,
    voice: TTS_DEFAULT_VOICE,
    model: 'kokoro',
  };
}

/**
 * Synthesize speech via the configured TTS provider.
 * Returns raw audio bytes (WAV/MP3 depending on provider).
 */
export async function synthesizeSpeech(
  text: string,
  options?: {
    voice?: string;
    speed?: number;
    language?: string;
    format?: 'wav' | 'mp3' | 'opus' | 'ogg';
  },
): Promise<{ audio: Buffer; format: string; provider: string; durationMs: number }> {
  const config = getProviderConfig();
  const truncated = text.length > MAX_VOICE_NOTE_CHARS
    ? text.slice(0, MAX_VOICE_NOTE_CHARS).replace(/\s+\S*$/, '…')
    : text;

  const start = Date.now();
  const format = options?.format || 'mp3';

  logger.debug({
    provider: TTS_PROVIDER, textLength: truncated.length,
    voice: options?.voice || config.voice, format,
  }, 'Synthesizing speech');

  const body: Record<string, unknown> = {
    model: config.model,
    input: truncated,
    voice: options?.voice || config.voice,
    response_format: format,
  };
  if (options?.speed) body.speed = options.speed;
  if (TTS_PROVIDER === 'qwen3' && options?.language) {
    body.language = options.language;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

  const res = await fetch(`${config.baseUrl}/audio/speech`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    logger.error({ status: res.status, provider: TTS_PROVIDER, error: errText }, 'TTS synthesis failed');
    throw new Error(`TTS failed (${TTS_PROVIDER}): ${res.status} ${errText}`);
  }

  const audioBuffer = Buffer.from(await res.arrayBuffer());
  const elapsed = Date.now() - start;

  logger.info({
    provider: TTS_PROVIDER, elapsed, audioSize: audioBuffer.length, format,
  }, 'TTS synthesis complete');

  return { audio: audioBuffer, format, provider: TTS_PROVIDER, durationMs: elapsed };
}

/**
 * Synthesize a WhatsApp-ready voice note.
 */
export async function synthesizeVoiceNote(
  text: string,
  voice?: string,
  speed?: number,
): Promise<{ audio: Buffer; format: string; provider: string }> {
  if (TTS_PROVIDER === 'kokoro') {
    const config = getProviderConfig();
    const truncated = text.length > MAX_VOICE_NOTE_CHARS
      ? text.slice(0, MAX_VOICE_NOTE_CHARS).replace(/\s+\S*$/, '…')
      : text;

    const res = await fetch(`${config.baseUrl.replace('/v1', '')}/v1/audio/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        text: truncated,
        voice: voice || config.voice,
        speed: speed ?? 1.0,
      }),
    });

    if (!res.ok) throw new Error(`Kokoro WhatsApp TTS failed: ${res.status}`);
    const data = await res.json() as { filePath: string; durationSeconds: number };
    const fs = await import('node:fs/promises');
    const audio = await fs.readFile(data.filePath);
    return { audio, format: 'ogg', provider: 'kokoro' };
  }

  return synthesizeSpeech(text, { voice, speed, format: 'mp3' });
}

/** Get the current TTS provider name */
export function getTtsProvider(): string { return TTS_PROVIDER; }

/** Available voices for the current provider */
export function getAvailableVoices(): string[] {
  if (TTS_PROVIDER === 'qwen3') {
    return ['Vivian', 'Serena', 'Uncle_Fu', 'Dylan', 'Eric', 'Ryan', 'Aiden', 'Ono_Anna', 'Sohee'];
  }
  return ['af_heart', 'af_bella', 'am_adam', 'am_michael'];
}
