/**
 * @yaya/wa-voice — WhatsApp Web voice call handler
 *
 * Live AI voice conversations via Playwright + WebRTC interception.
 *
 * Architecture:
 *   Incoming Call → WhatsApp Web (Playwright) → Auto-answer
 *     → RTCPeerConnection intercept → capture incoming audio
 *       → Streaming STT (Whisper) → LLM (vLLM) → TTS (Kokoro)
 *         → replaceTrack() → outgoing audio back to caller
 */

// ── Voice Agent (main entry point) ──
export { VoiceAgent } from './agent/voice-agent.js';

// ── Session ──
export { WAWebSessionManager } from './session/wa-web-session.js';

// ── Call ──
export { CallManager } from './call/call-manager.js';

// ── Audio ──
export { AudioBridge } from './audio/audio-bridge.js';
export { OmniPipeline } from './audio/omni-pipeline.js';
export type { OmniPipelineConfig, OmniPipelineResult } from './audio/omni-pipeline.js';

// ── Browser ──
export { getInterceptorScript } from './browser/interceptor.js';
export { DEFAULT_SELECTORS, mergeSelectors } from './browser/selectors.js';

// ── Types ──
export type {
  WAWebSessionConfig,
  WAWebSession,
  CallDirection,
  CallState,
  CallInfo,
  CallManagerConfig,
  AudioBridgeConfig,
  AudioChunk,
  VoicePipelineMode,
  VoiceAgentConfig,
  ConversationTurn,
  WAWebSelectors,
} from './types.js';

// ── Logger ──
export { createLogger, logger } from './logger.js';
