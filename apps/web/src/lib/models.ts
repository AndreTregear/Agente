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
    id: 'qwen3.5-27b-local',
    name: 'Qwen 3.5 27B',
    apiBase: process.env.VLLM_API_BASE || 'http://localhost:8000/v1',
    apiKey: process.env.VLLM_API_KEY || '',
    model: 'qwen3.5-27b',
    tag: 'local',
  },
  {
    id: 'qwen3-omni-gpu1',
    name: 'Qwen3 Omni 30B',
    apiBase: process.env.HPC_GPU1_URL || 'http://localhost:18080/v1',
    apiKey: process.env.HPC_API_KEY || '',
    model: 'qwen3-omni',
    tag: 'hpc',
  },
  {
    id: 'qwen3-omni-gpu2',
    name: 'Qwen3 Omni 30B (GPU 2)',
    apiBase: process.env.HPC_GPU2_URL || 'http://localhost:18081/v1',
    apiKey: process.env.HPC_API_KEY || '',
    model: 'qwen3-omni',
    tag: 'hpc',
  },
  {
    id: 'qwen3-omni-gpu3',
    name: 'Qwen3 Omni 30B (GPU 3)',
    apiBase: process.env.HPC_GPU3_URL || 'http://localhost:18082/v1',
    apiKey: process.env.HPC_API_KEY || '',
    model: 'qwen3-omni',
    tag: 'hpc',
  },
  {
    id: 'qwen3-omni-gpu4',
    name: 'Qwen3 Omni 30B (GPU 4)',
    apiBase: process.env.HPC_GPU4_URL || 'http://localhost:18083/v1',
    apiKey: process.env.HPC_API_KEY || '',
    model: 'qwen3-omni',
    tag: 'hpc',
  },
]

export const DEFAULT_MODEL_ID = 'qwen3.5-27b-local'
