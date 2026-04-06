export const PORTS = {
  // Application services
  business: 3000,
  auth: 3000,       // Better Auth runs inside yaya-business
  calcom: 3002,
  metabase: 3003,
  sparkyfitness: 3004,
  web: 3005,         // unified Next.js app (agente-ceo + landing + fit)
  campusgenie: 3200, // university agent web UI
  health: 3100,
  lago: 3010,
  lagoApi: 8080,

  // Infrastructure
  postgres: 5432,
  redis: 6379,
  vllm: 8000,
  minio: 9001,
  authentik: 9090,
  whisper: 9300,
  tts: 9400,

  // HPC GPUs (via SSH tunnel)
  hpcGpu1: 18080,
  hpcGpu2: 18081,
  hpcGpu3: 18082,
  hpcGpu4: 18083,

  // Internal
  openclawGateway: 18789,
  staticSites: 4400,
} as const;

export type PortName = keyof typeof PORTS;
