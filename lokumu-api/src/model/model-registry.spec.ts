import { getModelConfig, ModelType, MODEL_REGISTRY } from './model-registry';

describe('ModelRegistry', () => {
  it('returns config for code model', () => {
    const config = getModelConfig('code');
    expect(config).toHaveProperty('path');
    expect(config.type).toBe('code');
  });

  it('returns config for chat model', () => {
    const config = getModelConfig('chat');
    expect(config).toHaveProperty('path');
    expect(config.type).toBe('chat');
  });

  it('has correct paths in registry', () => {
    expect(MODEL_REGISTRY.code.defaultName).toContain('coder');
    expect(MODEL_REGISTRY.chat.defaultName).toContain('phi');
  });
});
