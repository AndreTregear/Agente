/**
 * Audio Bridge — bidirectional audio routing between browser and Node.js
 *
 * Incoming path: Browser MediaRecorder → base64 chunks → Node.js → STT
 * Outgoing path: TTS audio buffer → Node.js → Browser replaceTrack()
 *
 * Uses Voice Activity Detection (VAD) in the browser to detect when the
 * caller stops speaking, then flushes accumulated audio to STT.
 */

import type { Page } from 'playwright';
import type { AudioBridgeConfig, AudioChunk } from '../types.js';
import { createLogger } from '../logger.js';

const log = createLogger('audio-bridge');

export class AudioBridge {
  private page: Page;
  private config: AudioBridgeConfig;
  private onSpeechEndCallback: ((audio: Buffer) => Promise<void>) | null = null;
  private onAudioChunkCallback: ((chunk: AudioChunk) => void) | null = null;
  private isActive = false;

  constructor(page: Page, config: AudioBridgeConfig) {
    this.page = page;
    this.config = config;
  }

  /**
   * Set up the audio bridge — expose Node.js functions to the browser.
   */
  async setup(): Promise<void> {
    log.info('Setting up audio bridge...');

    // Expose function: browser calls this when a speech segment ends (VAD)
    await this.page.exposeFunction(
      '__waVoiceOnSpeechEnd',
      async (base64Audio: string, totalMs: number) => {
        if (!this.isActive) return;

        const buffer = Buffer.from(base64Audio, 'base64');
        log.debug({ size: buffer.length, totalMs }, 'Speech segment received');

        if (this.onSpeechEndCallback) {
          await this.onSpeechEndCallback(buffer);
        }
      },
    );

    // Expose function: browser calls this for each audio chunk (streaming)
    await this.page.exposeFunction(
      '__waVoiceOnAudioData',
      async (base64Audio: string, durationMs: number) => {
        if (!this.isActive) return;

        const buffer = Buffer.from(base64Audio, 'base64');
        this.onAudioChunkCallback?.({
          data: buffer,
          timestamp: Date.now(),
          durationMs,
        });
      },
    );

    // Wire up the browser-side interceptor to call our exposed functions
    await this.page.evaluate(() => {
      const waVoice = (window as any).__waVoice;
      if (!waVoice) {
        console.error('[wa-voice] Interceptor not loaded — __waVoice missing');
        return;
      }

      waVoice.onSpeechEnd = async (base64: string, totalMs: number) => {
        await (window as any).__waVoiceOnSpeechEnd(base64, totalMs);
      };

      waVoice.onAudioData = async (base64: string, durationMs: number) => {
        await (window as any).__waVoiceOnAudioData(base64, durationMs);
      };

      console.log('[wa-voice] Audio bridge wired up');
    });

    this.isActive = true;
    log.info('Audio bridge ready');
  }

  /**
   * Register callback for when caller finishes speaking (VAD-triggered).
   */
  onSpeechEnd(callback: (audio: Buffer) => Promise<void>): void {
    this.onSpeechEndCallback = callback;
  }

  /**
   * Register callback for raw audio chunks (for streaming STT).
   */
  onAudioChunk(callback: (chunk: AudioChunk) => void): void {
    this.onAudioChunkCallback = callback;
  }

  /**
   * Inject TTS audio into the outgoing WebRTC track.
   * The audio will be heard by the caller.
   */
  async injectAudio(audioBuffer: Buffer): Promise<boolean> {
    if (!this.isActive) {
      log.warn('Audio bridge not active — cannot inject audio');
      return false;
    }

    const base64 = audioBuffer.toString('base64');

    try {
      const success = await this.page.evaluate(async (b64: string) => {
        const inject = (window as any).__waVoiceInjectAudio;
        if (!inject) {
          console.error('[wa-voice] Audio injection function not available');
          return false;
        }
        return await inject(b64);
      }, base64);

      if (success) {
        log.debug({ size: audioBuffer.length }, 'TTS audio injected');
      } else {
        log.warn('Audio injection returned false');
      }

      return success as boolean;
    } catch (err) {
      log.error({ err }, 'Failed to inject audio');
      return false;
    }
  }

  /**
   * Transcribe audio using Whisper STT.
   */
  async transcribe(audioBuffer: Buffer): Promise<string> {
    const { sttUrl, sttApiKey, sttModel = 'large-v3' } = this.config;

    const formData = new FormData();
    const arrayBuf = audioBuffer.buffer.slice(
      audioBuffer.byteOffset,
      audioBuffer.byteOffset + audioBuffer.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuf], { type: 'audio/webm' });
    formData.append('file', blob, 'speech.webm');
    formData.append('model', sttModel);
    formData.append('language', 'es'); // Spanish primary, Whisper auto-detects

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
   * Synthesize text to audio using Kokoro TTS.
   */
  async synthesize(text: string): Promise<Buffer> {
    const { ttsUrl, ttsApiKey, ttsVoice = 'ef_dora' } = this.config;

    // Truncate for voice (keep it concise)
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
        lang_code: 'e',
        response_format: 'wav', // WAV for AudioContext.decodeAudioData
      }),
    });

    if (!res.ok) {
      throw new Error(`TTS failed: ${res.status} ${await res.text()}`);
    }

    return Buffer.from(await res.arrayBuffer());
  }

  /**
   * Stop the audio bridge.
   */
  stop(): void {
    this.isActive = false;
    this.onSpeechEndCallback = null;
    this.onAudioChunkCallback = null;
    log.info('Audio bridge stopped');
  }
}
