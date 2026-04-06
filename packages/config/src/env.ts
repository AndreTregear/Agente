function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function envOptional(key: string, fallback?: string): string | undefined {
  return process.env[key] ?? fallback;
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  return raw ? parseInt(raw, 10) : fallback;
}

export const config = {
  app: {
    env: env('NODE_ENV', 'development'),
    logLevel: env('LOG_LEVEL', 'info'),
    name: env('APP_NAME', 'yaya'),
  },

  database: {
    url: env('DATABASE_URL', 'postgresql://yaya:yaya_secret@localhost:5432/yaya'),
  },

  redis: {
    url: env('REDIS_URL', 'redis://localhost:6379'),
  },

  vllm: {
    url: env('VLLM_API_BASE', 'http://localhost:8000/v1'),
    apiKey: env('VLLM_API_KEY', ''),
  },

  hpc: {
    gpu1Url: envOptional('HPC_GPU1_URL', 'http://localhost:18080/v1'),
    gpu2Url: envOptional('HPC_GPU2_URL', 'http://localhost:18081/v1'),
    gpu3Url: envOptional('HPC_GPU3_URL', 'http://localhost:18082/v1'),
    gpu4Url: envOptional('HPC_GPU4_URL', 'http://localhost:18083/v1'),
    apiKey: envOptional('HPC_API_KEY', ''),
  },

  openclaw: {
    apiUrl: env('OPENCLAW_API_URL', 'http://localhost:3100/api/v1'),
    apiKey: env('OPENCLAW_API_KEY', ''),
    bin: env('OPENCLAW_BIN', 'openclaw'),
    agent: env('OPENCLAW_AGENT', 'yaya-platform'),
    timeoutMs: envInt('OPENCLAW_TIMEOUT_MS', 120_000),
    privilegedJids: env('PRIVILEGED_JIDS', '').split(',').filter(Boolean),
  },

  whisper: {
    baseUrl: env('WHISPER_BASE_URL', 'http://localhost:9300/v1'),
    apiKey: env('WHISPER_API_KEY', ''),
    model: env('WHISPER_MODEL', 'large-v3-turbo'),
    language: env('WHISPER_LANGUAGE', 'es'),
  },

  asr: {
    provider: env('ASR_PROVIDER', 'whisper') as 'whisper' | 'qwen3',
    qwen: {
      baseUrl: envOptional('QWEN_ASR_BASE_URL'),
      apiKey: envOptional('QWEN_ASR_API_KEY'),
      model: envOptional('QWEN_ASR_MODEL'),
    },
  },

  tts: {
    baseUrl: env('TTS_BASE_URL', 'http://localhost:9400'),
    apiKey: env('TTS_API_KEY', ''),
    defaultVoice: env('TTS_DEFAULT_VOICE', 'af_heart'),
    provider: env('TTS_PROVIDER', 'kokoro') as 'kokoro' | 'qwen3',
    qwen: {
      baseUrl: envOptional('QWEN_TTS_BASE_URL'),
      apiKey: envOptional('QWEN_TTS_API_KEY'),
      voice: envOptional('QWEN_TTS_VOICE'),
      model: envOptional('QWEN_TTS_MODEL'),
    },
  },

  queue: {
    concurrency: envInt('QUEUE_CONCURRENCY', 5),
    maxRetries: envInt('QUEUE_MAX_RETRIES', 3),
    rateLimit: envInt('RATE_LIMIT', 30),
    rateWindowSec: envInt('RATE_WINDOW_SEC', 60),
    aiConcurrency: envInt('AI_CONCURRENCY', 5),
  },

  auth: {
    url: env('AUTH_BACKEND_URL', 'http://localhost:3000'),
    secret: envOptional('AUTH_SECRET'),
  },
} as const;

export type Config = typeof config;
