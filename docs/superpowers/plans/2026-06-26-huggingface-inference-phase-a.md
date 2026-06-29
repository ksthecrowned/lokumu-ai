# Hugging Face Inference Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Lokumu to Hugging Face Inference API for chat (Phase A quick test) with `LLM_PROVIDER=hf|ollama` switch, starting with `Svngoku/aya-23-8b-afrimmlu-lin`.

**Architecture:** Add `HfInferenceClient` alongside existing `OllamaClient`. `ModelService.chatWithHistory` routes to HF when `LLM_PROVIDER=hf`. Optional Ollama fallback via `HF_FALLBACK_TO_OLLAMA=true`. RAG, conversation memory, and AssistantService unchanged.

**Tech Stack:** NestJS 11, native `fetch`, existing `OllamaMessage` type, HF Inference API (OpenAI-compatible chat completions)

## Global Constraints

- `LLM_PROVIDER=hf|ollama` (default `ollama` for backward compatibility)
- Phase A model: `HF_MODEL_ID=Svngoku/aya-23-8b-afrimmlu-lin`
- `HF_TOKEN` required when `LLM_PROVIDER=hf`; never commit tokens
- `HF_TIMEOUT_MS=120000`
- `HF_FALLBACK_TO_OLLAMA=false` by default
- Phase B `HF_ENDPOINT_URL` optional override for dedicated Endpoint
- Existing Ollama path must keep working unchanged when `LLM_PROVIDER=ollama`
- Error code surfaced to gateway: `llm_unavailable` (generic) or keep `ollama_unavailable` mapping extended for HF

---

### Task 1: Environment variables

**Files:**
- Modify: `lokumu-api/.env.example`

- [ ] **Step 1: Add HF block to `.env.example`**

```env
# LLM provider: ollama | hf
LLM_PROVIDER=ollama
HF_TOKEN=
HF_MODEL_ID=Svngoku/aya-23-8b-afrimmlu-lin
HF_INFERENCE_URL=
HF_ENDPOINT_URL=
HF_TIMEOUT_MS=120000
HF_FALLBACK_TO_OLLAMA=false
```

- [ ] **Step 2: Commit**

```bash
git add lokumu-api/.env.example
git commit -m "chore(api): add Hugging Face env vars for LLM provider switch"
```

---

### Task 2: `HfInferenceClient`

**Files:**
- Create: `lokumu-api/src/model/hf-inference.client.ts`
- Create: `lokumu-api/src/model/hf-inference.client.spec.ts`

**Interfaces:**
- Produces: `HfInferenceClient.chat(messages, options): Promise<string>`

- [ ] **Step 1: Write failing test**

```typescript
import { HfInferenceClient } from './hf-inference.client';

describe('HfInferenceClient', () => {
  it('calls chat completions API and returns assistant content', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Mbote!' } }],
      }),
    }) as jest.Mock;

    const client = new HfInferenceClient({
      token: 'hf_test',
      modelId: 'Svngoku/aya-23-8b-afrimmlu-lin',
    });

    const result = await client.chat([
      { role: 'user', content: 'Mbote' },
    ]);

    expect(result).toBe('Mbote!');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('aya-23-8b-afrimmlu-lin'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer hf_test',
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Implement client**

```typescript
import { OllamaMessage } from './ollama.client';

export class HfInferenceClient {
  constructor(
    private readonly config: {
      token: string;
      modelId: string;
      baseUrl?: string;
      timeoutMs?: number;
    },
  ) {}

  resolveChatUrl(): string {
    const endpoint = process.env.HF_ENDPOINT_URL?.trim();
    if (endpoint) {
      return `${endpoint.replace(/\/$/, '')}/v1/chat/completions`;
    }
    const override = this.config.baseUrl ?? process.env.HF_INFERENCE_URL?.trim();
    if (override) {
      return `${override.replace(/\/$/, '')}/v1/chat/completions`;
    }
    return `https://api-inference.huggingface.co/models/${this.config.modelId}/v1/chat/completions`;
  }

  async chat(
    messages: OllamaMessage[],
    options: { temperature?: number; maxTokens?: number } = {},
  ): Promise<string> {
    const response = await fetch(this.resolveChatUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.modelId,
        messages,
        max_tokens: options.maxTokens ?? 512,
        temperature: options.temperature ?? 0.7,
      }),
      signal: AbortSignal.timeout(
        this.config.timeoutMs ?? Number(process.env.HF_TIMEOUT_MS ?? 120_000),
      ),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`hf_unavailable:${response.status}:${body.slice(0, 200)}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('hf_unavailable:empty_response');
    }
    return content;
  }
}
```

- [ ] **Step 3: Run tests**

Run: `cd lokumu-api && npm test -- hf-inference.client.spec.ts`

- [ ] **Step 4: Commit**

```bash
git add lokumu-api/src/model/hf-inference.client.ts lokumu-api/src/model/hf-inference.client.spec.ts
git commit -m "feat(model): add Hugging Face Inference API client"
```

---

### Task 3: Route `ModelService` by `LLM_PROVIDER`

**Files:**
- Modify: `lokumu-api/src/model/model.service.ts`
- Modify: `lokumu-api/src/model/model.service.spec.ts`

- [ ] **Step 1: Add HF routing test**

```typescript
it('uses HF client when LLM_PROVIDER=hf', async () => {
  process.env.LLM_PROVIDER = 'hf';
  process.env.HF_TOKEN = 'hf_test';
  process.env.HF_MODEL_ID = 'Svngoku/aya-23-8b-afrimmlu-lin';

  const hfChat = jest.fn().mockResolvedValue('Mbote na yo!');
  jest.spyOn(HfInferenceClient.prototype, 'chat').mockImplementation(hfChat);

  const service = new ModelService();
  const result = await service.chatWithHistory([
    { role: 'user', content: 'Mbote' },
  ]);

  expect(result).toBe('Mbote na yo!');
  expect(hfChat).toHaveBeenCalled();
});
```

- [ ] **Step 2: Update `ModelService`**

Add private methods:
- `isHfProvider(): boolean` → `process.env.LLM_PROVIDER === 'hf'`
- `createHfClient(): HfInferenceClient` → throws if no `HF_TOKEN`
- In `chatWithHistory`: if HF, call `hfClient.chat(messages)`; on error, if `HF_FALLBACK_TO_OLLAMA=true`, delegate to existing Ollama path
- In `onModuleInit`: if HF, warn when `HF_TOKEN` missing; else existing Ollama check

- [ ] **Step 3: Run tests**

Run: `cd lokumu-api && npm test -- model.service.spec.ts hf-inference.client.spec.ts`

- [ ] **Step 4: Commit**

```bash
git add lokumu-api/src/model/model.service.ts lokumu-api/src/model/model.service.spec.ts
git commit -m "feat(model): route chatWithHistory to Hugging Face when LLM_PROVIDER=hf"
```

---

### Task 4: Health endpoint & chat error messages

**Files:**
- Modify: `lokumu-api/src/health/health.controller.ts`
- Modify: `lokumu-api/src/chat/chat.gateway.ts`

- [ ] **Step 1: Extend health response**

```typescript
const provider = process.env.LLM_PROVIDER ?? 'ollama';
const llm =
  provider === 'hf'
    ? { provider: 'hf', configured: Boolean(process.env.HF_TOKEN), model: process.env.HF_MODEL_ID }
    : { provider: 'ollama', available: await this.modelService.isAvailable() };
return { status: 'ok', llm, /* existing fields */ };
```

- [ ] **Step 2: Map HF errors in gateway**

```typescript
const message =
  error instanceof Error && error.message.startsWith('hf_unavailable')
    ? 'Le modele Hugging Face est indisponible. Verifiez HF_TOKEN et HF_MODEL_ID.'
    : /* existing ollama message */;
```

- [ ] **Step 3: Commit**

```bash
git add lokumu-api/src/health/health.controller.ts lokumu-api/src/chat/chat.gateway.ts
git commit -m "feat(api): expose LLM provider in health and improve HF error messages"
```

---

### Task 5: Documentation & manual smoke test

**Files:**
- Modify: `models/lokumu-kit-lin/README.md` (add Phase A HF section at top)
- Modify: `README.md` (brief HF setup)
- Create: `docs/superpowers/plans/2026-06-26-huggingface-phase-a-e2e.md`

- [ ] **Step 1: E2E checklist**

```markdown
- [ ] Set LLM_PROVIDER=hf, HF_TOKEN, HF_MODEL_ID in lokumu-api/.env
- [ ] ./start-demo.sh
- [ ] GET /health → llm.provider === 'hf'
- [ ] Chat: « Mbote, ozali malamu? » → Lingala response
- [ ] Set LLM_PROVIDER=ollama → chat still works locally
```

- [ ] **Step 2: Commit docs**

```bash
git add models/lokumu-kit-lin/README.md README.md docs/superpowers/plans/2026-06-26-huggingface-phase-a-e2e.md
git commit -m "docs: add Hugging Face Phase A setup and E2E checklist"
```

---

## Spec Coverage

| Spec requirement | Task |
| ---------------- | ---- |
| LLM_PROVIDER switch | 1, 3 |
| HfInferenceProvider | 2 |
| aya-23-8b-afrimmlu-lin default | 1 |
| HF_ENDPOINT_URL support | 2 |
| HF_FALLBACK_TO_OLLAMA | 3 |
| Ollama unchanged | 3 |
| Health / errors | 4 |
| Phase A E2E docs | 5 |

## Execution Order

Task 1 → 2 → 3 → 4 → 5
