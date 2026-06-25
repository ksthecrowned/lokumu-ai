export type ModelType = 'chat' | 'code';

export interface ModelConfig {
  path: string;
  type: ModelType;
  defaultName: string;
}

export const MODEL_REGISTRY: Record<ModelType, ModelConfig> = {
  code: {
    path: process.env.MODEL_DIR
      ? `${process.env.MODEL_DIR}/qwen2.5-coder-1.5b-q4_k_m.gguf`
      : './models/qwen2.5-coder-1.5b-q4_k_m.gguf',
    type: 'code',
    defaultName: 'qwen2.5-coder-1.5b-q4_k_m.gguf',
  },
  chat: {
    path: process.env.MODEL_DIR
      ? `${process.env.MODEL_DIR}/phi-3-mini-4k-q4_k_m.gguf`
      : './models/phi-3-mini-4k-q4_k_m.gguf',
    type: 'chat',
    defaultName: 'phi-3-mini-4k-q4_k_m.gguf',
  },
};

export function getModelConfig(type: ModelType): ModelConfig {
  return MODEL_REGISTRY[type];
}
