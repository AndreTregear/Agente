/**
 * AI client — Whisper STT transcription.
 */
import {
  WHISPER_BASE_URL, WHISPER_API_KEY, WHISPER_MODEL, WHISPER_LANGUAGE,
} from '../config.js';
import { logger } from '../shared/logger.js';

/** Map mimetype to file extension for Whisper API. */
function mimetypeToExt(mimetype: string): string {
  if (mimetype.includes('ogg')) return 'ogg';
  if (mimetype.includes('mp4')) return 'm4a';
  if (mimetype.includes('mpeg')) return 'mp3';
  if (mimetype.includes('wav')) return 'wav';
  if (mimetype.includes('webm')) return 'webm';
  return 'ogg'; // default for WhatsApp voice notes
}

/**
 * Call Whisper API to transcribe audio.
 */
async function callWhisperAPI(buffer: Buffer, mimetype: string, language: string): Promise<string> {
  const ext = mimetypeToExt(mimetype);
  const startTime = Date.now();

  logger.debug({ mimetype, ext, bufferSize: buffer.length, model: WHISPER_MODEL, language, baseUrl: WHISPER_BASE_URL }, 'Transcribing audio via Whisper');

  const formData = new FormData();
  const arrayBuf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuf], { type: mimetype });
  formData.append('file', blob, `audio.${ext}`);
  formData.append('model', WHISPER_MODEL);
  formData.append('language', language);

  const response = await fetch(`${WHISPER_BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${WHISPER_API_KEY}` },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    const latencyMs = Date.now() - startTime;
    logger.error({ status: response.status, error: errText, latencyMs }, 'Whisper API error');
    throw new Error(`Whisper API error ${response.status}: ${errText}`);
  }

  const result = await response.json() as { text: string };
  const latencyMs = Date.now() - startTime;
  logger.debug({ transcriptionLength: result.text.length, latencyMs, language }, 'Whisper transcription complete');
  return result.text;
}

/**
 * Transcribe audio buffer using Whisper API with the configured language (default: Spanish).
 */
export async function transcribeAudio(buffer: Buffer, mimetype: string): Promise<string> {
  return callWhisperAPI(buffer, mimetype, WHISPER_LANGUAGE);
}

/**
 * Transcribe audio trying Quechua first, falling back to Spanish if the result is empty or very short.
 */
export async function transcribeAudioWithQuechua(buffer: Buffer, mimetype: string): Promise<string> {
  try {
    const quechuaText = await callWhisperAPI(buffer, mimetype, 'qu');
    // If Quechua transcription returned meaningful content, use it
    if (quechuaText && quechuaText.trim().length >= 3) {
      logger.debug({ textLength: quechuaText.length }, 'Using Quechua transcription');
      return quechuaText;
    }
  } catch (err) {
    logger.debug({ err }, 'Quechua transcription failed, falling back to Spanish');
  }

  // Fall back to Spanish
  return callWhisperAPI(buffer, mimetype, 'es');
}

// Re-export for convenience
export { mimetypeToExt };
