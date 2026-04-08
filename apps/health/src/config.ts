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
export const DATABASE_URL = requireEnv('DATABASE_URL', 'postgresql://yaya:yaya_health_secret@localhost:5432/yaya_health');

// ── Redis ──
export const REDIS_URL = requireEnv('REDIS_URL', 'redis://localhost:6379');

// ── Auth ──
export const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || 'dev-secret-change-in-production-32chars!';

// ── OpenClaw ──
export const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || 'http://localhost:3100/api/v1';
export const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY || '';

// ── AI ──
export const AI_API_KEY = requireEnv('AI_API_KEY', 'dummy-key');
export const AI_BASE_URL = process.env.AI_BASE_URL || 'http://c.yaya.sh:8000/v1';
export const AI_MODEL = process.env.AI_MODEL || 'Qwen/Qwen3-32B';
export const AI_MAX_TOKENS = Number(process.env.AI_MAX_TOKENS) || 1024;
export const AI_TEMPERATURE = Number(process.env.AI_TEMPERATURE) || 0.7;

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

// ── Open Food Facts ──
export const OPENFOODFACTS_BASE_URL = process.env.OPENFOODFACTS_BASE_URL || 'https://world.openfoodfacts.org';

// ── Object Storage ──
export const S3_ENDPOINT = process.env.S3_ENDPOINT || 'localhost';
export const S3_PORT = Number(process.env.S3_PORT) || 9000;
export const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || 'minioadmin';
export const S3_SECRET_KEY = process.env.S3_SECRET_KEY || 'minioadmin';
