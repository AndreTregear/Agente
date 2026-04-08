export interface ModelConfig {
  id: string
  name: string
  apiBase: string
  apiKey: string
  model: string
  tag: 'local' | 'hpc'
}

export const MODELS: ModelConfig[] = [
  {
    id: 'qwen3.5-35b-a3b-local',
    name: 'Qwen 3.5 35B-A3B',
    apiBase: process.env.VLLM_API_BASE || 'http://localhost:8000/v1',
    apiKey: process.env.VLLM_API_KEY || '',
    model: process.env.VLLM_MODEL || 'qwen3.5-35b-a3b',
    tag: 'local',
  },
  {
    id: 'qwen3.5-122b-hpc',
    name: 'Qwen 3.5 122B-A10B',
    apiBase: process.env.HPC_GPU1_URL || 'http://localhost:18080/v1',
    apiKey: process.env.HPC_API_KEY || '',
    model: 'qwen3.5-122b',
    tag: 'hpc',
  },
]

export const DEFAULT_MODEL_ID = 'qwen3.5-35b-a3b-local'
