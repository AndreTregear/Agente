/**
 * @yaya/wa-voice — Type definitions
 *
 * WhatsApp Web voice call handling via Playwright + WebRTC interception.
 */

// ── Session ──

export interface WAWebSessionConfig {
  /** Directory to persist browser state (cookies, localStorage) */
  storageDir: string;
  /** Whether to run headless (requires Xvfb for WebRTC) */
  headless?: boolean;
  /** Path to a WAV file for initial fake audio capture (silence) */
  silenceWavPath?: string;
  /** Browser executable path override */
  executablePath?: string;
  /** User agent override */
  userAgent?: string;
}

export interface WAWebSession {
  /** Navigate to WhatsApp Web and wait for auth */
  initialize(): Promise<void>;
  /** Get the current Playwright page */
  getPage(): import('playwright').Page;
  /** Save session state for reuse */
  saveSession(): Promise<void>;
  /** Close browser and clean up */
  close(): Promise<void>;
  /** Whether WhatsApp Web is authenticated and ready */
  isReady(): boolean;
}

// ── Call ──

export type CallDirection = 'incoming' | 'outgoing';
export type CallState = 'ringing' | 'active' | 'ended' | 'missed' | 'rejected';

export interface CallInfo {
  /** Caller/callee phone number or name (from DOM) */
  contact: string;
  /** Call direction */
  direction: CallDirection;
  /** Current state */
  state: CallState;
  /** Whether it's a video call */
  isVideo: boolean;
  /** Call start time */
  startedAt: Date;
  /** Call end time */
  endedAt?: Date;
}

export interface CallManagerConfig {
  /** Auto-answer incoming calls */
  autoAnswer?: boolean;
  /** Max call duration in seconds (0 = unlimited) */
  maxDurationSec?: number;
  /** Callback when call state changes */
  onCallStateChange?: (info: CallInfo) => void;
}

// ── Audio ──

export interface AudioBridgeConfig {
  /** Whisper STT endpoint */
  sttUrl: string;
  /** STT API key */
  sttApiKey?: string;
  /** Whisper model */
  sttModel?: string;
  /** Kokoro TTS endpoint */
  ttsUrl: string;
  /** TTS API key */
  ttsApiKey?: string;
  /** TTS voice */
  ttsVoice?: string;
  /** Audio chunk interval in ms for STT (default: 100) */
  chunkIntervalMs?: number;
  /** Silence threshold in ms — how long to wait after speech stops (default: 800) */
  silenceThresholdMs?: number;
  /** Sample rate for audio processing (default: 16000) */
  sampleRate?: number;
}

export interface AudioChunk {
  /** Raw audio data (webm/opus from MediaRecorder) */
  data: Buffer;
  /** Timestamp when chunk was captured */
  timestamp: number;
  /** Duration in ms */
  durationMs: number;
}

// ── Voice Agent ──

export type VoicePipelineMode = 'local' | 'hpc' | 'auto';

export interface VoiceAgentConfig {
  /** WhatsApp Web session config */
  session: WAWebSessionConfig;
  /** Audio bridge config (STT/TTS endpoints) */
  audio: AudioBridgeConfig;
  /** Call manager config */
  call?: CallManagerConfig;
  /** Pipeline mode: 'local' (STT→LLM→TTS), 'hpc' (STT→Omni), 'auto' (try HPC, fall back to local) */
  pipeline?: VoicePipelineMode;
  /** LLM endpoint (vLLM OpenAI-compatible) — used in 'local' mode */
  llmUrl: string;
  /** LLM API key */
  llmApiKey?: string;
  /** LLM model name */
  llmModel?: string;
  /** Qwen3-Omni endpoint — used in 'hpc' mode */
  omniUrl?: string;
  /** Omni API key */
  omniApiKey?: string;
  /** Omni model name */
  omniModel?: string;
  /** System prompt for the voice assistant */
  systemPrompt?: string;
  /** Max response tokens */
  maxTokens?: number;
  /** Callback for each conversation turn */
  onTurn?: (turn: ConversationTurn) => void;
}

export interface ConversationTurn {
  /** What the caller said (STT transcription) */
  userSpeech: string;
  /** What the agent responded */
  agentResponse: string;
  /** Timing breakdown */
  timings: {
    sttMs: number;
    llmMs: number;
    ttsMs: number;
    totalMs: number;
  };
}

// ── DOM Selectors ──

export interface WAWebSelectors {
  /** Chat list container (indicates WhatsApp is loaded) */
  chatList: string;
  /** QR code element (indicates need to scan) */
  qrCode: string;
  /** Incoming call notification container */
  incomingCall: string;
  /** Accept/answer call button */
  acceptCall: string;
  /** Decline/reject call button */
  declineCall: string;
  /** End call button */
  endCall: string;
  /** Call duration timer (indicates call is active) */
  callTimer: string;
  /** Caller name/number in call UI */
  callerInfo: string;
  /** Mute button (to verify call controls are visible) */
  muteButton: string;
}
