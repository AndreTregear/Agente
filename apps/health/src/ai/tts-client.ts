/**
 * TTS client for Kokoro TTS server.
 * Synthesizes voice notes (OGG Opus) for WhatsApp replies.
 */

import { TTS_BASE_URL, TTS_API_KEY, TTS_DEFAULT_VOICE } from '../config.js';
import { logger } from '../shared/logger.js';

const MAX_VOICE_NOTE_CHARS = 500;

export interface VoiceNoteResult {
  filePath: string;
  durationSeconds: number;
}

/**
 * Synthesize a WhatsApp-ready voice note (OGG Opus).
 * Calls the /v1/audio/whatsapp endpoint which saves to disk and returns metadata.
 */
export async function synthesizeVoiceNote(
  text: string,
  voice?: string,
  speed?: number,
): Promise<VoiceNoteResult> {
  const start = Date.now();
  const truncated = text.length > MAX_VOICE_NOTE_CHARS
    ? text.slice(0, MAX_VOICE_NOTE_CHARS).replace(/\s+\S*$/, '…')
    : text;

  const res = await fetch(`${TTS_BASE_URL}/v1/audio/whatsapp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TTS_API_KEY}`,
    },
    body: JSON.stringify({
      text: truncated,
      voice: voice || TTS_DEFAULT_VOICE,
      speed: speed ?? 1.0,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`TTS synthesis failed: ${res.status} ${body}`);
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
  logger.info(
    { latencyMs, durationSeconds: data.duration_seconds, textLength: truncated.length, voice: voice || TTS_DEFAULT_VOICE },
    'TTS voice note synthesized',
  );

  return {
    filePath: data.file_path,
    durationSeconds: data.duration_seconds,
  };
}

/**
 * Synthesize raw audio buffer (for non-WhatsApp use cases).
 */
export async function synthesizeSpeech(
  text: string,
  format: string = 'mp3',
  voice?: string,
): Promise<Buffer> {
  const start = Date.now();

  const res = await fetch(`${TTS_BASE_URL}/v1/audio/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TTS_API_KEY}`,
    },
    body: JSON.stringify({
      input: text,
      voice: voice || TTS_DEFAULT_VOICE,
      response_format: format,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`TTS speech failed: ${res.status} ${body}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const latencyMs = Date.now() - start;
  logger.info({ latencyMs, format, sizeBytes: buffer.length }, 'TTS speech synthesized');

  return buffer;
}

/**
 * List available TTS voices.
 */
export async function listVoices(): Promise<string[]> {
  const res = await fetch(`${TTS_BASE_URL}/v1/audio/voices`, {
    headers: { Authorization: `Bearer ${TTS_API_KEY}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to list voices: ${res.status}`);
  }

  const data = (await res.json()) as { voices: Array<{ id: string }> };
  return data.voices.map((v) => v.id);
}
