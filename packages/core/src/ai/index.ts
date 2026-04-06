// ── OpenClaw Bridge ──
export {
  processWithOpenClaw,
  processPrivilegedWithOpenClaw,
  isPrivilegedUser,
  setContextBuilder,
  setFallbackMessageFn,
} from './openclaw-bridge.js';
export type { OpenClawBridgeResult } from './openclaw-bridge.js';

// ── ASR (Speech-to-Text) — unified provider (Whisper / Qwen3) ──
export { transcribeAudio, detectAudioLanguage, getAsrProvider } from './asr-client.js';

// ── TTS (Text-to-Speech) — unified provider (Kokoro / Qwen3) ──
export {
  synthesizeSpeech,
  synthesizeVoiceNote,
  getTtsProvider,
  getAvailableVoices,
} from './tts-client-v2.js';

// ── Voice Routing ──
export { shouldSendAsVoice, formatForVoice, splitForVoice } from './voice-router.js';
export type { VoiceContext } from './voice-router.js';

// ── Language Detection ──
export {
  detectLanguage, detectLanguageDetailed,
  isQuechua, isSpanish, isEnglish,
} from './language-detector.js';
export type { DetectedLanguage, LanguageDetectionResult } from './language-detector.js';
