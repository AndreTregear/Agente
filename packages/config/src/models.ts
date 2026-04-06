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
      id: 'qwen3.5-27b-local',
      name: 'Qwen 3.5 27B',
      provider: 'vllm-local',
      apiBase: config.vllm.url,
      apiKey: config.vllm.apiKey,
      model: 'qwen3.5-27b',
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
