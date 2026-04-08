import { config } from './env.js';

export interface ModelDefinition {
  id: string;
  name: string;
  provider: string;
  apiBase: string;
  apiKey: string;
  model: string;
  tag: 'local' | 'hpc';
  isDefault?: boolean;
}

export function getAvailableModels(): ModelDefinition[] {
  const models: ModelDefinition[] = [
    {
      id: 'qwen3.5-35b-a3b-local',
      name: 'Qwen 3.5 35B-A3B (Local)',
      provider: 'vllm-local',
      apiBase: config.vllm.url,
      apiKey: config.vllm.apiKey,
      model: config.vllm.model,
      tag: 'local',
      isDefault: true,
    },
  ];

  const gpuUrls = [
    config.hpc.gpu1Url,
    config.hpc.gpu2Url,
    config.hpc.gpu3Url,
    config.hpc.gpu4Url,
  ];

  gpuUrls.forEach((url, i) => {
    if (url && config.hpc.apiKey) {
      models.push({
        id: `qwen3-omni-gpu${i + 1}`,
        name: i === 0 ? 'Qwen3 Omni 30B' : `Qwen3 Omni 30B (GPU ${i + 1})`,
        provider: 'hpc',
        apiBase: url,
        apiKey: config.hpc.apiKey,
        model: 'qwen3-omni',
        tag: 'hpc',
      });
    }
  });

  return models;
}

export function getDefaultModel(): ModelDefinition {
  const models = getAvailableModels();
  return models.find((m) => m.isDefault) ?? models[0];
}

export function getModelById(id: string): ModelDefinition | undefined {
  return getAvailableModels().find((m) => m.id === id);
}

/**
 * Get a model with automatic fallback.
 * Priority: requested model → HPC → local.
 * Tests connectivity before returning.
 */
export async function getModelWithFallback(
  preferredId?: string,
): Promise<ModelDefinition> {
  const models = getAvailableModels();

  // If a specific model was requested, try it first
  if (preferredId) {
    const preferred = models.find((m) => m.id === preferredId);
    if (preferred && (await isModelReachable(preferred))) {
      return preferred;
    }
  }

  // Try HPC models first (faster, more powerful)
  const hpcModels = models.filter((m) => m.tag === 'hpc');
  for (const hpc of hpcModels) {
    if (await isModelReachable(hpc)) {
      return hpc;
    }
  }

  // Fall back to local
  const local = models.find((m) => m.tag === 'local');
  if (local) return local;

  return getDefaultModel();
}

/**
 * Quick health check — does the model endpoint respond?
 */
async function isModelReachable(model: ModelDefinition): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${model.apiBase}/models`, {
      headers: model.apiKey ? { Authorization: `Bearer ${model.apiKey}` } : {},
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}
