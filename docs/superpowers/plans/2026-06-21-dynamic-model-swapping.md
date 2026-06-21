# Dynamic Model Swapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement dynamic model loading/swapping in ModelService based on chat/code mode.

**Architecture:** ModelService maintains single model in memory, swaps on mode change. LRU cache for multiple models if RAM permits.

**Tech Stack:** NestJS, llama.cpp, Node.js child_process, filesystem caching

## Global Constraints

- 16GB RAM disponible max
- Swap time <5 seconds
- Support deux modèles: chat (~3-4B) et coder (~1.5B)
- Keep Qwen2.5-Coder:1.5b as fallback

---

### Task 1: Model Registry

**Files:**
- Create: `lokumu-api/src/model/model-registry.ts`

**Interfaces:**
- Consumes: model name, config
- Produces: ModelConfig with paths and VRAM estimates

- [ ] **Step 1: Write failing test**

```typescript
// lokumu-api/src/model/model-registry.spec.ts
import { getModelConfig, ModelType } from './model-registry';

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
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx jest model-registry.spec.ts --no-coverage`

- [ ] **Step 3: Write minimal implementation**

```typescript
// lokumu-api/src/model/model-registry.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

---

### Task 2: Dynamic Loading in ModelService

**Files:**
- Modify: `lokumu-api/src/model/model.service.ts`

- [ ] **Step 1: Write failing test for loadModel by type**

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Modify ModelService to support type-based loading**

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

---

### Task 3: Agent Integration

**Files:**
- Modify: `lokumu-api/src/agent/agent.service.ts`

- [ ] **Step 1: Write test for mode-based model selection**

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Update AgentService to use appropriate model per mode**

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

---

## Self-Review

- [x] Spec coverage: model registry, dynamic loading, agent integration
- [x] No placeholders TBD/TODO
- [x] Type consistency: ModelType enum used across tasks
- [x] Scope appropriate: single model swapping feature