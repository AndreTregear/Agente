/**
 * Fast Voice Pipeline — sub-3-second voice message response
 *
 * Optimized pipeline for voice-message-based conversations:
 * 1. Receive audio buffer from WhatsApp voice message
 * 2. Transcribe with Whisper STT
 * 3. Process with LLM (OpenClaw or direct vLLM)
 * 4. Synthesize response with Kokoro TTS
 * 5. Send back as WhatsApp voice note
 *
 * Target: < 3 seconds total round-trip
 */

import { logger } from '../shared/logger.js';

export interface VoicePipelineConfig {
  /** Whisper STT endpoint */
  whisperUrl: string;
  whisperApiKey: string;
  whisperModel?: string;
  /** vLLM endpoint for direct LLM calls (faster than OpenClaw CLI) */
  vllmUrl: string;
  vllmApiKey: string;
  vllmModel?: string;
  /** Kokoro TTS endpoint */
  ttsUrl: string;
  ttsApiKey?: string;
  ttsVoice?: string;
  /** System prompt for the voice assistant */
  systemPrompt?: string;
  /** Max response tokens (shorter = faster TTS) */
  maxTokens?: number;
}

export interface VoicePipelineResult {
  transcription: string;
  response: string;
  audioBuffer: Buffer;
  timings: {
    sttMs: number;
    llmMs: number;
    ttsMs: number;
    totalMs: number;
  };
}

const DEFAULT_SYSTEM_PROMPT = [
  'You are a helpful voice assistant. Keep responses concise (1-3 sentences) since they will be spoken aloud.',
  'Respond naturally as if having a conversation. Use Spanish if the user speaks Spanish.',
  'Never use markdown, code blocks, or formatting — plain spoken language only.',
].join(' ');

export function createVoicePipeline(config: VoicePipelineConfig) {
  const {
    whisperUrl,
    whisperApiKey,
    whisperModel = 'large-v3-turbo',
    vllmUrl,
    vllmApiKey,
    vllmModel = 'qwen3.5-27b',
    ttsUrl,
    ttsApiKey = '',
    ttsVoice = 'af_heart',
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    maxTokens = 150,
  } = config;

  /**
   * Process a voice message end-to-end.
   * Returns the response audio buffer ready to send as a WhatsApp voice note.
   */
  async function processVoiceMessage(
    audioBuffer: Buffer,
    mimetype: string,
    context?: { previousMessages?: Array<{ role: string; content: string }> },
  ): Promise<VoicePipelineResult> {
    const totalStart = Date.now();

    // Step 1: STT — transcribe audio
    const sttStart = Date.now();
    const transcription = await transcribe(audioBuffer, mimetype);
    const sttMs = Date.now() - sttStart;

    if (!transcription.trim()) {
      throw new Error('Empty transcription — no speech detected');
    }

    logger.debug({ sttMs, textLength: transcription.length }, 'STT complete');

    // Step 2: LLM — generate response (direct vLLM call, not OpenClaw CLI)
    const llmStart = Date.now();
    const response = await generateResponse(transcription, context?.previousMessages);
    const llmMs = Date.now() - llmStart;

    logger.debug({ llmMs, responseLength: response.length }, 'LLM complete');

    // Step 3: TTS — synthesize audio
    const ttsStart = Date.now();
    const responseAudio = await synthesize(response);
    const ttsMs = Date.now() - ttsStart;

    logger.debug({ ttsMs, audioSize: responseAudio.length }, 'TTS complete');

    const totalMs = Date.now() - totalStart;

    logger.info({
      sttMs, llmMs, ttsMs, totalMs,
      inputChars: transcription.length,
      outputChars: response.length,
      audioSize: responseAudio.length,
    }, `Voice pipeline: ${totalMs}ms total`);

    return {
      transcription,
      response,
      audioBuffer: responseAudio,
      timings: { sttMs, llmMs, ttsMs, totalMs },
    };
  }

  async function transcribe(buffer: Buffer, mimetype: string): Promise<string> {
    const ext = mimetype.includes('ogg') ? 'ogg' : mimetype.includes('mp4') ? 'm4a' : 'ogg';
    const formData = new FormData();
    const arrayBuf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const blob = new Blob([arrayBuf], { type: mimetype });
    formData.append('file', blob, `voice.${ext}`);
    formData.append('model', whisperModel);
    formData.append('language', 'es');

    const res = await fetch(`${whisperUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: whisperApiKey ? { Authorization: `Bearer ${whisperApiKey}` } : {},
      body: formData,
    });

    if (!res.ok) throw new Error(`STT failed: ${res.status} ${await res.text()}`);
    const data = await res.json() as { text: string };
    return data.text;
  }

  async function generateResponse(
    userMessage: string,
    previousMessages?: Array<{ role: string; content: string }>,
  ): Promise<string> {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(previousMessages?.slice(-4) ?? []),  // last 2 exchanges for context
      { role: 'user', content: userMessage },
    ];

    const res = await fetch(`${vllmUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(vllmApiKey ? { Authorization: `Bearer ${vllmApiKey}` } : {}),
      },
      body: JSON.stringify({
        model: vllmModel,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
        stream: false,
      }),
    });

    if (!res.ok) throw new Error(`LLM failed: ${res.status} ${await res.text()}`);
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content?.trim() ?? 'No response';
  }

  async function synthesize(text: string): Promise<Buffer> {
    // Truncate for voice (500 char max)
    const truncated = text.length > 500
      ? text.slice(0, 500).replace(/\s+\S*$/, '...')
      : text;

    const res = await fetch(`${ttsUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ttsApiKey ? { Authorization: `Bearer ${ttsApiKey}` } : {}),
      },
      body: JSON.stringify({
        model: 'kokoro',
        input: truncated,
        voice: ttsVoice,
        response_format: 'mp3',
      }),
    });

    if (!res.ok) throw new Error(`TTS failed: ${res.status} ${await res.text()}`);
    return Buffer.from(await res.arrayBuffer());
  }

  return { processVoiceMessage, transcribe, generateResponse, synthesize };
}
