# Lokumu Hugging Face Training & Inference Design

**Date:** 2026-06-26  
**Status:** Approved (brainstorming)  
**Scope:** Cloud-based LLM training (AutoTrain) and inference (HF Endpoint/API), with optional Ollama fallback via environment switch  
**Builds on:** [2026-06-25-conversational-lokumu-design.md](./2026-06-25-conversational-lokumu-design.md)

## Vision

Phase 2 assumed LoRA fine-tuning on an external GPU machine and 100% offline Ollama inference. **This spec amends that decision:** the operator has no local GPU, making LoRA + Ollama conversion impractical for day-to-day iteration.

The revised pipeline uses **Hugging Face** for:

1. **Phase A (now):** Quick chat validation via **HF Inference API** with an existing Lingala-capable community model
2. **Phase B (later):** Custom Lokumu SFT via **HF AutoTrain**, deployed to **HF Inference Endpoint** for production

**Unchanged:** local RAG (PostgreSQL + BGE-M3), conversation memory, `/train` dialogue collection, JSONL export, anti-hallucination prompts, Eliet/Kupsala corpus.

---

## Decisions Summary

| Topic | Decision |
| ----- | -------- |
| Why cloud | No local GPU; LoRA + GGUF + Ollama training path too costly |
| Training | **HF AutoTrain** (SFT, manual launch on huggingface.co) |
| Production inference | **HF Inference Endpoint** (or Inference API during Phase A) |
| Dev / offline demo | **Ollama** via `LLM_PROVIDER=ollama` (optional, no custom LoRA required) |
| Provider switch | `LLM_PROVIDER=hf \| ollama` in `.env` |
| Automation (v1) | **Manual** — export JSONL → upload dataset → AutoTrain by hand |
| Phase A priority | **HF inference first** — wire existing Lingala model before AutoTrain |
| Phase A model | `Svngoku/aya-23-8b-afrimmlu-lin` (test); lighter fallback if latency/quota issues |
| Kituba gap | RAG (Eliet) + prompts; HF models skew Lingala/Kikongo |
| RAG from HF datasets | **Deferred** (Phase A bis) — e.g. `Svngoku/central-africa-multilingual-translation` |
| Data privacy | Runtime prompts sent to HF when `LLM_PROVIDER=hf`; `/train` dialogues stay local until manual export |

---

## 1. Architecture

### 1.1 Two-phase cloud pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE A — Quick test (no training)                          │
├─────────────────────────────────────────────────────────────┤
│  LLM_PROVIDER=hf                                             │
│  HF_MODEL_ID=Svngoku/aya-23-8b-afrimmlu-lin                  │
│       ↓                                                      │
│  HfInferenceProvider → HF Inference API (serverless)          │
│  RAG + memory + prompts : local (PostgreSQL, Ollama unused)  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  PHASE B — Custom Lokumu model (manual, huggingface.co)      │
├─────────────────────────────────────────────────────────────┤
│  npm run training:export → lokumu-kit-lin.jsonl              │
│       ↓ manual upload                                        │
│  HF Dataset (private): lokumu/dialogues                      │
│       ↓ HF AutoTrain SFT                                     │
│  HF Model: lokumu/lokumu-kit-lin                             │
│       ↓ deploy                                               │
│  HF Inference Endpoint                                       │
│       ↓                                                      │
│  LLM_PROVIDER=hf, HF_ENDPOINT_URL=..., HF_MODEL_ID=...       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  OPTIONAL — Offline demo                                     │
├─────────────────────────────────────────────────────────────┤
│  LLM_PROVIDER=ollama                                         │
│  OLLAMA_MODEL=qwen2.5:7b (base, no LoRA merge required)      │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Runtime (lokumu-api)

```
User → lokumu-web → WebSocket → AssistantService
    ↓
ConversationService (history, persist)
    ↓
RagService (local hybrid search)
    ↓
ModelService
    ↓
LlmProvider interface
    ├── HfInferenceProvider   (LLM_PROVIDER=hf)
    └── OllamaProvider        (LLM_PROVIDER=ollama)  [existing OllamaClient]
```

Phase 2 `AssistantService` flow (fast-path grounded, RAG context, `chatWithHistory`) is preserved; only the LLM backend becomes pluggable.

### 1.3 Package additions

```
lokumu-api/
├── src/model/
│   ├── llm-provider.interface.ts
│   ├── hf-inference.provider.ts
│   ├── ollama.provider.ts          # thin wrapper over OllamaClient
│   └── model.service.ts            # routes by LLM_PROVIDER
└── .env.example                    # HF_* + LLM_PROVIDER

models/lokumu-kit-lin/
└── README.md                       # rewritten: AutoTrain + Endpoint workflow
docs/superpowers/specs/
└── 2026-06-26-huggingface-training-inference-design.md  (this file)
```

---

## 2. Phase A — HF Inference (quick test)

### 2.1 Goal

Validate multi-turn Kituba/Lingala conversation in Lokumu UI **without training**, using a community HF model, before investing in AutoTrain.

### 2.2 Recommended starter model

| Model | HF ID | Notes |
| ----- | ----- | ----- |
| Primary test | [`Svngoku/aya-23-8b-afrimmlu-lin`](https://huggingface.co/Svngoku/aya-23-8b-afrimmlu-lin) | Lingala fine-tune on Aya-23-8B; good for chat/math-style prompts in Lingala |
| Lighter fallback | `Qwen/Qwen2.5-7B-Instruct` | Via Inference API; system prompt in Lingala/Kituba |

8B models may hit cold-start latency on serverless Inference API; acceptable for Phase A testing. Phase B Endpoint reduces this.

### 2.3 Environment variables

```env
LLM_PROVIDER=hf
HF_TOKEN=hf_xxxxxxxx
HF_MODEL_ID=Svngoku/aya-23-8b-afrimmlu-lin
HF_INFERENCE_URL=                    # optional override; default serverless API
HF_ENDPOINT_URL=                     # Phase B: dedicated endpoint URL
HF_TIMEOUT_MS=120000
HF_FALLBACK_TO_OLLAMA=false          # true = try Ollama if HF fails
OLLAMA_MODEL=qwen2.5:7b              # when LLM_PROVIDER=ollama or fallback
```

### 2.4 HfInferenceProvider behaviour

1. Accept `OllamaMessage[]` (system / user / assistant) from `ModelService.chatWithHistory`
2. Prefer **OpenAI-compatible chat completions** if supported:
   - `POST https://api-inference.huggingface.co/models/{HF_MODEL_ID}/v1/chat/completions`
3. Else flatten to **text-generation** prompt (system block + `[CONTEXTE]` + history + user)
4. Map HF errors to existing `ollama_unavailable`-style user messages (rate limit, model loading, timeout)
5. Return assistant text string to `AssistantService`

### 2.5 Known Phase A limits

| Limit | Mitigation |
| ----- | ---------- |
| Model biased to Lingala | RAG Eliet for Kituba facts; system prompt asks for Kituba when requested |
| Serverless rate limits / cold start | Retry once; document HF Pro if needed; Endpoint in Phase B |
| Prompts leave local machine | No PII in prompts; document in README |
| Not a cultural assistant out of the box | RAG grounding + refusal instructions unchanged |

### 2.6 Success criteria (Phase A)

| Scenario | Expected |
| -------- | -------- |
| `LLM_PROVIDER=hf`, send « Mbote, ozali malamu? » | Natural Lingala reply within timeout |
| Multi-turn follow-up | Uses conversation history |
| Translation with RAG hit | Grounded answer + citation |
| Switch `LLM_PROVIDER=ollama` | Works with base Qwen without HF token |
| HF token missing / invalid | Clear error in UI, no silent hang |

---

## 3. Phase B — AutoTrain custom Lokumu model

### 3.1 Goal

Fine-tune a chat model on **approved Lokumu dialogues** (+ optional synthetic cultural pairs) using **HF AutoTrain**, deploy to **Inference Endpoint**, point `HF_MODEL_ID` / `HF_ENDPOINT_URL` at the result.

### 3.2 Manual workflow (v1)

| Step | Action |
| ---- | ------ |
| 1 | Collect dialogues via `/train` UI; approve (auto in dev) |
| 2 | `cd lokumu-api && npm run training:export` |
| 3 | Create **private** HF dataset; upload `data/training/lokumu-kit-lin.jsonl` |
| 4 | Open **AutoTrain** on huggingface.co → SFT → select base model (e.g. `Qwen/Qwen2.5-7B-Instruct` or `CohereForAI/aya-23-8B`) |
| 5 | Map JSONL `messages` field to chat format |
| 6 | Train → publish model to Hub (e.g. `lokumu/lokumu-kit-lin`) |
| 7 | Create **Inference Endpoint** for that model |
| 8 | Set `HF_ENDPOINT_URL`, `HF_MODEL_ID` in production `.env` |

Re-training: repeat when ~100+ new approved dialogues accumulate (same export script).

### 3.3 Base model recommendations (AutoTrain)

| Base | Pros | Cons |
| ---- | ---- | ---- |
| `Qwen/Qwen2.5-7B-Instruct` | Smaller, cheaper Endpoint | Less native African language prior |
| `CohereForAI/aya-23-8B` | Strong multilingual / African coverage | Heavier, costlier |

Start with **Qwen2.5-7B-Instruct** unless Lingala quality from Phase A tests favours Aya.

### 3.4 Optional future: HF datasets for RAG (Phase A bis)

Not in Phase A scope. When ready:

| Dataset | Use |
| ------- | --- |
| [`Svngoku/central-africa-multilingual-translation`](https://huggingface.co/datasets/Svngoku/central-africa-multilingual-translation) | Bulk FR↔LIN/Kikongo pairs → RAG chunks |
| [`michsethowusu/french-lingala_sentence-pairs`](https://huggingface.co/datasets/michsethowusu/french-lingala_sentence-pairs) | Smaller sample ingest |
| [`michsethowusu/french-kongo_sentence-pairs`](https://huggingface.co/datasets/michsethowusu/french-kongo_sentence-pairs) | Kituba-adjacent lexicon |

Script: `ingest-hf-sample.ts` (future task), not part of this spec’s implementation plan.

---

## 4. Relationship to Phase 2 spec

| Phase 2 | This spec |
| ------- | --------- |
| LoRA on external GPU | **Replaced** by HF AutoTrain |
| Merge + GGUF + Ollama import | **Optional** for offline demo only |
| `lokumu-kit-lin` Ollama Modelfile | Kept for `LLM_PROVIDER=ollama` demo; not required for cloud path |
| 100% offline inference | **Relaxed** — cloud HF default; Ollama optional via env |
| JSONL export, `/train`, RAG, memory | **Unchanged** |
| `OLLAMA_MODEL=lokumu-kit-lin:latest` | Default prod becomes `LLM_PROVIDER=hf` |

---

## 5. Security & operations

- **`HF_TOKEN`:** read-only inference token for Phase A; write token only on machine used for dataset upload / AutoTrain
- **Never commit** tokens; `.env` only
- **Endpoint:** prefer private Endpoint with auth header in Phase B prod
- **Logging:** do not log full prompts containing user PII in production
- **Cost:** monitor HF billing; 8B Endpoint ~$0.5–2/hr depending on hardware (verify current HF pricing)

---

## 6. Testing strategy

**Unit tests**

- `HfInferenceProvider`: mock HTTP, chat vs text-generation fallback, error mapping
- `ModelService`: routes to HF vs Ollama based on `LLM_PROVIDER`

**Integration tests**

- Mock HF API; `AssistantService` returns response with history + RAG context

**Manual E2E (Phase A)**

1. Set `LLM_PROVIDER=hf`, valid `HF_TOKEN`, `HF_MODEL_ID=Svngoku/aya-23-8b-afrimmlu-lin`
2. `./start-demo.sh` — chat « Mbote » + follow-up
3. Toggle `LLM_PROVIDER=ollama` — verify fallback path
4. Invalid token — user-visible error

---

## 7. Out of scope

- Automated CI: export → push dataset → trigger AutoTrain
- HF dataset ingest into RAG (Phase A bis)
- Replacing local RAG with HF embeddings
- Swahili
- Real-time training on every dialogue submission

---

## 8. Implementation order (high level)

1. **Phase A:** `LlmProvider` abstraction + `HfInferenceProvider` + env switch + docs
2. **Manual validation** with `aya-23-8b-afrimmlu-lin`
3. **Phase B docs:** update `models/lokumu-kit-lin/README.md` with AutoTrain + Endpoint steps
4. **Phase B (operator):** first AutoTrain run when dialogue corpus is ready
5. **Phase A bis (optional):** HF dataset sample ingest for RAG

---

## 9. Risks & mitigations

| Risk | Mitigation |
| ---- | ---------- |
| HF Inference API slow/unavailable | `HF_FALLBACK_TO_OLLAMA`, clear UI timeout message |
| 8B model cost/latency | Qwen2.5-7B fallback; Endpoint sizing in Phase B |
| Kituba weak on HF models | Local Eliet RAG + future AutoTrain on Kituba dialogues |
| Community model quality | Phase A is throwaway validation; Phase B trains on Lokumu data |
| Cloud vs sovereignty narrative | Ollama path remains for offline demos; RAG stays local |
