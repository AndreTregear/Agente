/**
 * Voice Agent — the main orchestrator for live WhatsApp voice calls
 *
 * Flow:
 * 1. Launch WhatsApp Web in Playwright (persistent session)
 * 2. Wait for incoming call
 * 3. Auto-answer
 * 4. Capture caller's audio via WebRTC interception
 * 5. VAD detects end of speech → flush to Whisper STT
 * 6. STT text → LLM (vLLM) → generate response
 * 7. Response text → Kokoro TTS → audio buffer
 * 8. Inject TTS audio back into WebRTC outgoing track
 * 9. Repeat until call ends
 */

import { WAWebSessionManager } from '../session/wa-web-session.js';
import { CallManager } from '../call/call-manager.js';
import { AudioBridge } from '../audio/audio-bridge.js';
import { OmniPipeline } from '../audio/omni-pipeline.js';
import type { VoiceAgentConfig, ConversationTurn, VoicePipelineMode } from '../types.js';
import { createLogger } from '../logger.js';

const log = createLogger('voice-agent');

const DEFAULT_SYSTEM_PROMPT = [
  'You are a helpful voice assistant having a live phone call.',
  'Keep responses concise (1-3 sentences) since they will be spoken aloud.',
  'Respond naturally as if having a conversation.',
  'Use Spanish if the user speaks Spanish.',
  'Never use markdown, code blocks, or formatting — plain spoken language only.',
  'Do not use emojis or special characters.',
  '/no_think',
].join(' ');

export class VoiceAgent {
  private config: VoiceAgentConfig;
  private session: WAWebSessionManager | null = null;
  private callManager: CallManager | null = null;
  private audioBridge: AudioBridge | null = null;
  private omniPipeline: OmniPipeline | null = null;
  private activePipeline: VoicePipelineMode = 'local';
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private isRunning = false;
  private turnCount = 0;

  constructor(config: VoiceAgentConfig) {
    this.config = config;
  }

  /**
   * Determine which pipeline to use: local (STT→LLM→TTS) or HPC (STT→Omni).
   */
  private async selectPipeline(): Promise<VoicePipelineMode> {
    const mode = this.config.pipeline ?? 'auto';

    if (mode === 'local') return 'local';
    if (mode === 'hpc') return 'hpc';

    // Auto mode: try HPC first, fall back to local
    if (this.config.omniUrl) {
      const omni = new OmniPipeline({
        omniUrl: this.config.omniUrl,
        omniApiKey: this.config.omniApiKey,
        omniModel: this.config.omniModel,
        sttUrl: this.config.audio.sttUrl,
        sttApiKey: this.config.audio.sttApiKey,
        sttModel: this.config.audio.sttModel,
        systemPrompt: this.config.systemPrompt,
        maxTokens: this.config.maxTokens,
      });

      if (await omni.isAvailable()) {
        this.omniPipeline = omni;
        log.info('Using HPC Omni pipeline (2-step: STT → Omni text+audio)');
        return 'hpc';
      }
    }

    log.info('Using local pipeline (3-step: STT → LLM → TTS)');
    return 'local';
  }

  /**
   * Start the voice agent. This will:
   * 1. Launch WhatsApp Web
   * 2. Enter a loop: wait for call → handle call → repeat
   */
  async start(): Promise<void> {
    this.isRunning = true;

    log.info('Starting voice agent...');

    // Initialize WhatsApp Web session
    this.session = new WAWebSessionManager(this.config.session);

    this.session.on('qr-code', () => {
      log.info('=== SCAN QR CODE ON YOUR PHONE TO AUTHENTICATE ===');
    });

    this.session.on('authenticated', () => {
      log.info('WhatsApp Web authenticated');
    });

    await this.session.initialize();

    log.info('Voice agent ready — waiting for calls');

    // Main call loop
    while (this.isRunning) {
      try {
        await this.handleNextCall();
      } catch (err) {
        log.error({ err }, 'Error handling call — will retry');
        // Brief pause before retrying
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  /**
   * Handle a single call from detection to completion.
   */
  private async handleNextCall(): Promise<void> {
    const page = this.session!.getPage();

    // Reset state for new call
    this.conversationHistory = [];
    this.turnCount = 0;

    // Set up call manager
    this.callManager = new CallManager(page, {
      autoAnswer: true,
      maxDurationSec: this.config.call?.maxDurationSec ?? 300, // 5 min default
      onCallStateChange: (info) => {
        log.info({ contact: info.contact, state: info.state }, 'Call state changed');
      },
    });

    // Wait for incoming call and auto-answer
    const callInfo = await this.callManager.waitForCall();
    log.info({ contact: callInfo.contact }, 'Call connected — selecting pipeline');

    // Select pipeline (local 3-step or HPC 2-step)
    this.activePipeline = await this.selectPipeline();

    if (this.activePipeline === 'hpc' && !this.omniPipeline) {
      this.omniPipeline = new OmniPipeline({
        omniUrl: this.config.omniUrl!,
        omniApiKey: this.config.omniApiKey,
        omniModel: this.config.omniModel,
        sttUrl: this.config.audio.sttUrl,
        sttApiKey: this.config.audio.sttApiKey,
        sttModel: this.config.audio.sttModel,
        systemPrompt: this.config.systemPrompt,
        maxTokens: this.config.maxTokens,
      });
    }

    // Set up audio bridge (needed for both pipelines — handles WebRTC)
    this.audioBridge = new AudioBridge(page, this.config.audio);
    await this.audioBridge.setup();

    // Register speech end handler — this is the main processing trigger
    this.audioBridge.onSpeechEnd(async (audioBuffer: Buffer) => {
      await this.processSpeechTurn(audioBuffer);
    });

    // Send initial greeting
    await this.sendGreeting();

    // Wait for call to end
    await this.callManager.waitForCallEnd();

    // Clean up
    this.audioBridge.stop();
    this.callManager.resetCall();

    const duration = callInfo.endedAt
      ? (callInfo.endedAt.getTime() - callInfo.startedAt.getTime()) / 1000
      : 0;

    log.info({
      contact: callInfo.contact,
      durationSec: duration,
      turns: this.turnCount,
    }, 'Call complete');
  }

  /**
   * Process one speech turn using the active pipeline.
   */
  private async processSpeechTurn(audioBuffer: Buffer): Promise<void> {
    this.turnCount++;

    if (this.activePipeline === 'hpc' && this.omniPipeline) {
      await this.processSpeechOmni(audioBuffer);
    } else {
      await this.processSpeechLocal(audioBuffer);
    }
  }

  /**
   * HPC pipeline: STT → Qwen3-Omni (text + audio in one call).
   */
  private async processSpeechOmni(audioBuffer: Buffer): Promise<void> {
    try {
      const result = await this.omniPipeline!.processSpeech(audioBuffer);

      // Inject the native Omni audio into the call
      if (result.audioBuffer.length > 0) {
        await this.audioBridge!.injectAudio(result.audioBuffer);
      } else {
        // Omni didn't return audio — fall back to Kokoro TTS
        const ttsAudio = await this.audioBridge!.synthesize(result.response);
        await this.audioBridge!.injectAudio(ttsAudio);
      }

      const turn: ConversationTurn = {
        userSpeech: result.transcription,
        agentResponse: result.response,
        timings: {
          sttMs: result.timings.sttMs,
          llmMs: result.timings.omniMs,
          ttsMs: 0, // TTS included in Omni call
          totalMs: result.timings.totalMs,
        },
      };

      log.info({
        turn: this.turnCount,
        pipeline: 'hpc',
        ...result.timings,
      }, `Turn ${this.turnCount} (Omni): ${result.timings.totalMs}ms`);

      this.config.onTurn?.(turn);
    } catch (err) {
      log.error({ err, turn: this.turnCount }, 'Omni pipeline error — falling back to local');
      this.activePipeline = 'local';
      await this.processSpeechLocal(audioBuffer);
    }
  }

  /**
   * Local pipeline: STT → LLM (text) → TTS (audio). 3 steps.
   */
  private async processSpeechLocal(audioBuffer: Buffer): Promise<void> {
    const totalStart = Date.now();

    try {
      // Step 1: Speech-to-Text
      const sttStart = Date.now();
      const transcription = await this.audioBridge!.transcribe(audioBuffer);
      const sttMs = Date.now() - sttStart;

      if (!transcription.trim()) {
        log.debug('Empty transcription — skipping turn');
        return;
      }

      log.info({ turn: this.turnCount, sttMs, text: transcription }, 'STT complete');

      // Step 2: LLM — generate response
      const llmStart = Date.now();
      const response = await this.generateResponse(transcription);
      const llmMs = Date.now() - llmStart;

      log.info({ turn: this.turnCount, llmMs, response }, 'LLM complete');

      // Step 3: Text-to-Speech
      const ttsStart = Date.now();
      const ttsAudio = await this.audioBridge!.synthesize(response);
      const ttsMs = Date.now() - ttsStart;

      log.info({ turn: this.turnCount, ttsMs, audioSize: ttsAudio.length }, 'TTS complete');

      // Step 4: Inject audio into call
      await this.audioBridge!.injectAudio(ttsAudio);

      const totalMs = Date.now() - totalStart;

      // Update conversation history
      this.conversationHistory.push(
        { role: 'user', content: transcription },
        { role: 'assistant', content: response },
      );

      // Trim history to last 10 messages (5 exchanges)
      if (this.conversationHistory.length > 10) {
        this.conversationHistory = this.conversationHistory.slice(-10);
      }

      const turn: ConversationTurn = {
        userSpeech: transcription,
        agentResponse: response,
        timings: { sttMs, llmMs, ttsMs, totalMs },
      };

      log.info({
        turn: this.turnCount,
        sttMs, llmMs, ttsMs, totalMs,
      }, `Turn ${this.turnCount}: ${totalMs}ms total`);

      this.config.onTurn?.(turn);
    } catch (err) {
      log.error({ err, turn: this.turnCount }, 'Error processing speech turn');
    }
  }

  /**
   * Generate a response using the LLM.
   */
  private async generateResponse(userMessage: string): Promise<string> {
    const {
      llmUrl,
      llmApiKey,
      llmModel = 'qwen3.5-35b-a3b',
      systemPrompt = DEFAULT_SYSTEM_PROMPT,
      maxTokens = 150,
    } = this.config;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.conversationHistory.slice(-8), // Last 4 exchanges
      { role: 'user', content: userMessage },
    ];

    const res = await fetch(`${llmUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(llmApiKey ? { Authorization: `Bearer ${llmApiKey}` } : {}),
      },
      body: JSON.stringify({
        model: llmModel,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
        stream: false,
        chat_template_kwargs: { enable_thinking: false },
      }),
    });

    if (!res.ok) {
      throw new Error(`LLM failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0]?.message?.content?.trim() ?? 'Lo siento, no pude procesar tu mensaje.';
  }

  /**
   * Send an initial greeting when the call starts.
   */
  private async sendGreeting(): Promise<void> {
    try {
      if (this.activePipeline === 'hpc' && this.omniPipeline) {
        const { text, audio } = await this.omniPipeline.generateGreeting();
        if (audio.length > 0) {
          await this.audioBridge!.injectAudio(audio);
        } else {
          const ttsAudio = await this.audioBridge!.synthesize(text);
          await this.audioBridge!.injectAudio(ttsAudio);
        }
      } else {
        const greeting = '¡Hola! Soy tu asistente de voz. ¿En qué te puedo ayudar?';
        const ttsAudio = await this.audioBridge!.synthesize(greeting);
        await this.audioBridge!.injectAudio(ttsAudio);
        this.conversationHistory.push({ role: 'assistant', content: greeting });
      }

      log.info({ pipeline: this.activePipeline }, 'Greeting sent');
    } catch (err) {
      log.warn({ err }, 'Failed to send greeting');
    }
  }

  /**
   * Stop the voice agent.
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.callManager) {
      await this.callManager.endCall();
      this.callManager.resetCall();
    }

    if (this.audioBridge) {
      this.audioBridge.stop();
    }

    if (this.session) {
      await this.session.close();
    }

    log.info('Voice agent stopped');
  }
}
