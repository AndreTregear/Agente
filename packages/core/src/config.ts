import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${key}`);
}

// ── Paths ──
export const DATA_DIR = path.resolve(__dirname, '..', 'data');

// ── Server ──
export const WEB_PORT = Number(process.env.PORT) || 3000;

// ── Database ──
export const DATABASE_URL = requireEnv('DATABASE_URL', 'postgresql://yaya:yaya_secret@localhost:5432/yaya');

// ── Redis ──
export const REDIS_URL = requireEnv('REDIS_URL', 'redis://localhost:6379');

// ── OpenClaw ──
export const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || 'http://localhost:3100/api/v1';
export const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY || '';

// ── Whisper ──
export const WHISPER_BASE_URL = process.env.WHISPER_BASE_URL || 'http://localhost:9300/v1';
export const WHISPER_API_KEY = process.env.WHISPER_API_KEY || '';
export const WHISPER_MODEL = process.env.WHISPER_MODEL || 'large-v3-turbo';
export const WHISPER_LANGUAGE = process.env.WHISPER_LANGUAGE || 'es';

// ── TTS (Kokoro) ──
export const TTS_BASE_URL = process.env.TTS_BASE_URL || 'http://localhost:9400';
export const TTS_API_KEY = process.env.TTS_API_KEY || '';
export const TTS_DEFAULT_VOICE = process.env.TTS_DEFAULT_VOICE || 'af_heart';

// ── Queue ──
export const QUEUE_CONCURRENCY = Number(process.env.QUEUE_CONCURRENCY) || 5;
export const QUEUE_MAX_RETRIES = Number(process.env.QUEUE_MAX_RETRIES) || 3;
