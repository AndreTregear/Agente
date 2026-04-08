/**
 * Omni Pipeline — uses Qwen3-Omni for combined LLM + TTS in a single call.
 *
 * Instead of: STT → LLM (text) → TTS (audio)  [3 steps]
 * This does:  STT → Qwen3-Omni (text + audio)  [2 steps]
 *
 * Qwen3-Omni returns both text content AND a native audio waveform
 * in every response, eliminating the need for a separate TTS service.
 *
 * Trade-offs vs local 3-step pipeline:
 * - Pros: more natural voice, no separate TTS needed, multimodal capable
 * - Cons: higher latency (~2-3s vs ~1.3s), requires HPC/tunnel
 */

import { createLogger } from '../logger.js';

const log = createLogger('omni-pipeline');

export interface OmniPipelineConfig {
  /** Qwen3-Omni endpoint (e.g. http://localhost:18080/v1) */
  omniUrl: string;
  /** API key */
  omniApiKey?: string;
  /** Model name */
  omniModel?: string;
  /** Whisper STT endpoint */
  sttUrl: string;
  /** STT API key */
  sttApiKey?: string;
  /** STT model */
  sttModel?: string;
  /** System prompt */
  systemPrompt?: string;
  /** Max response tokens */
  maxTokens?: number;
}

export interface OmniPipelineResult {
  /** Transcription of caller's speech */
  transcription: string;
  /** Agent's text response */
  response: string;
  /** Native audio from Qwen3-Omni (WAV 24kHz mono 16-bit) */
  audioBuffer: Buffer;
  /** Timing breakdown */
  timings: {
    sttMs: number;
    omniMs: number;
    totalMs: number;
  };
}

const DEFAULT_SYSTEM_PROMPT = [
  'You are a helpful voice assistant having a live phone call.',
  'Keep responses concise (1-3 sentences) since they will be spoken aloud.',
  'Respond naturally. Use Spanish if the user speaks Spanish.',
  'Never use markdown, code blocks, lists, or formatting.',
  '/no_think',
].join(' ');

export class OmniPipeline {
  private config: OmniPipelineConfig;
  private conversationHistory: Array<{ role: string; content: string }> = [];

  constructor(config: OmniPipelineConfig) {
    this.config = config;
  }

  /**
   * Process a speech segment end-to-end.
   * Whisper STT → Qwen3-Omni (text + audio) in 2 steps.
   */
  async processSpeech(audioBuffer: Buffer): Promise<OmniPipelineResult> {
    const totalStart = Date.now();

    // Step 1: STT
    const sttStart = Date.now();
    const transcription = await this.transcribe(audioBuffer);
    const sttMs = Date.now() - sttStart;

    if (!transcription.trim()) {
      throw new Error('Empty transcription');
    }

    log.debug({ sttMs, text: transcription }, 'STT complete');

    // Step 2: Qwen3-Omni — generates text + audio in one call
    const omniStart = Date.now();
    const { text, audio } = await this.generateWithAudio(transcription);
    const omniMs = Date.now() - omniStart;

    log.debug({ omniMs, textLen: text.length, audioLen: audio.length }, 'Omni complete');

    // Update conversation history
    this.conversationHistory.push(
      { role: 'user', content: transcription },
      { role: 'assistant', content: text },
    );
    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-10);
    }

    const totalMs = Date.now() - totalStart;
    log.info({ sttMs, omniMs, totalMs }, `Omni pipeline: ${totalMs}ms`);

    return {
      transcription,
      response: text,
      audioBuffer: audio,
      timings: { sttMs, omniMs, totalMs },
    };
  }

  /**
   * Generate a greeting with audio.
   */
  async generateGreeting(): Promise<{ text: string; audio: Buffer }> {
    const greeting = '¡Hola! Soy tu asistente de voz. ¿En qué te puedo ayudar?';
    return this.generateWithAudio(greeting);
  }

  /**
   * Call Qwen3-Omni and extract both text and audio from the response.
   */
  private async generateWithAudio(
    userMessage: string,
  ): Promise<{ text: string; audio: Buffer }> {
    const {
      omniUrl,
      omniApiKey,
      omniModel = 'qwen3-omni',
      systemPrompt = DEFAULT_SYSTEM_PROMPT,
      maxTokens = 150,
    } = this.config;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.conversationHistory.slice(-8),
      { role: 'user', content: userMessage },
    ];

    const res = await fetch(`${omniUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(omniApiKey ? { Authorization: `Bearer ${omniApiKey}` } : {}),
      },
      body: JSON.stringify({
        model: omniModel,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
        stream: false,
        chat_template_kwargs: { enable_thinking: false },
      }),
    });

    if (!res.ok) {
      throw new Error(`Omni failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json() as {
      choices: Array<{
        message: {
          content: string | null;
          audio?: { data: string; id: string };
        };
      }>;
    };

    // Extract text (from first choice with content)
    let text = '';
    let audioBuffer = Buffer.alloc(0);

    for (const choice of data.choices) {
      const msg = choice.message;
      if (msg.content && msg.content.trim() && !text) {
        text = msg.content.trim();
      }
      if (msg.audio?.data && audioBuffer.length === 0) {
        audioBuffer = Buffer.from(msg.audio.data, 'base64');
      }
    }

    if (!text) {
      text = 'Lo siento, no pude procesar tu mensaje.';
    }

    return { text, audio: audioBuffer };
  }

  /**
   * Transcribe audio using Whisper STT.
   */
  private async transcribe(audioBuffer: Buffer): Promise<string> {
    const { sttUrl, sttApiKey, sttModel = 'large-v3' } = this.config;

    const formData = new FormData();
    const arrayBuf = audioBuffer.buffer.slice(
      audioBuffer.byteOffset,
      audioBuffer.byteOffset + audioBuffer.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuf], { type: 'audio/webm' });
    formData.append('file', blob, 'speech.webm');
    formData.append('model', sttModel);
    formData.append('language', 'es');

    const res = await fetch(`${sttUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: sttApiKey ? { Authorization: `Bearer ${sttApiKey}` } : {},
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`STT failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json() as { text: string };
    return data.text.trim();
  }

  /**
   * Check if the Omni endpoint is reachable.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch(`${this.config.omniUrl}/models`, {
        headers: this.config.omniApiKey
          ? { Authorization: `Bearer ${this.config.omniApiKey}` }
          : {},
        signal: ctrl.signal,
      });
      clearTimeout(t);
      return res.ok;
    } catch {
      return false;
    }
  }

  resetHistory(): void {
    this.conversationHistory = [];
  }
}
