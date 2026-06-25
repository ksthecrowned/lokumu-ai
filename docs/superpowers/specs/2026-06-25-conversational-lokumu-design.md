# Lokumu Conversational Assistant — Phase 2 Design

**Date:** 2026-06-25  
**Status:** Approved (brainstorming)  
**Scope:** Natural Kituba/Lingala conversation, expanded RAG corpus, LoRA fine-tuning pipeline, training dialogue collection UI  
**Builds on:** [2026-06-25-cultural-assistant-demo-design.md](./2026-06-25-cultural-assistant-demo-design.md)

## Vision

Phase 1 delivered a reliable investor demo with grounded corpus responses (proverbs, salutations, translations). Phase 2 evolves Lokumu into a **conversational assistant** that:

- Holds simple multi-turn dialogues in **Kituba and Lingala** (plus FR/EN as interface languages)
- Grounds linguistic facts in an expanded RAG corpus (~2 000 chunks) sourced from Eliet (1953), Kupsala, and community content
- Always routes responses through a **local LLM** (`lokumu-kit-lin`) fine-tuned via LoRA on an external machine, imported into Ollama for offline inference
- Collects **training dialogues** via a client UI to continuously improve conversational fluency

**Relationship to Phase 1:** Phase 1 explicitly excluded fine-tuning. Phase 2 adds fine-tuning as a deliberate evolution while preserving offline inference and RAG grounding.

---

## Decisions Summary

| Topic | Decision |
| ----- | -------- |
| Primary experience | Free chat — greetings, general questions, multi-turn follow-ups |
| Languages (focus) | Kituba (`kit`) + Lingala (`lin`); FR/EN remain interface languages |
| LLM usage | Always pass through Ollama; fast-path grounded templates optional for known chips |
| Grounding strategy | Hybrid: RAG for facts + LoRA for fluency/style + conversation memory |
| Corpus volume | ~2 000 chunks at launch (Eliet + Kupsala + dialogues + seed) |
| Fine-tuning | LoRA on external GPU machine; merged model imported to Ollama offline |
| Training data | Community-submitted multi-turn dialogues via `/train` UI |
| Training moderation | Manual review in production; `TRAINING_AUTO_APPROVE=true` in dev |
| Infrastructure | 100% offline at inference; cloud/external GPU acceptable for training only |

---

## 1. Architecture

### 1.1 Two-phase pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  PREPARATION (external machine, periodic)                   │
├─────────────────────────────────────────────────────────────┤
│  Sources: Eliet 1953, Kupsala, seed, training dialogues     │
│       ↓                                                     │
│  [A] RAG corpus  →  ~2 000 chunks  →  PostgreSQL/pgvector   │
│  [B] LoRA dataset →  JSONL from dialogues + synthetic pairs  │
│       ↓                                                     │
│  Fine-tune LoRA (base: qwen2.5:7b) on external GPU          │
│       ↓                                                     │
│  Merge + export GGUF  →  lokumu-kit-lin:latest in Ollama     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  RUNTIME (100% offline — demo machine)                       │
├─────────────────────────────────────────────────────────────┤
│  User → lokumu-web → WebSocket → AssistantService            │
│       ↓                                                     │
│  1. Resolve/create Conversation; persist user message       │
│  2. Load last 8–12 turns from ChatMessage                   │
│  3. RAG: adaptive top-k from expanded corpus                │
│  4. LLM: system prompt + history + RAG context → Ollama     │
│  5. Post-process: citations, persist assistant + chunk IDs  │
│  6. Stream/emit response → client                           │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Package layout (additions)

```
lokumu-ai/
├── data/
│   ├── cultural/
│   │   ├── raw/                 # Downloaded HTML (Eliet, Kupsala)
│   │   ├── processed/           # Structured Markdown by section
│   │   └── dialogues/           # Synthetic dialogue JSON for RAG + LoRA seed
│   └── training/                # Exported JSONL for LoRA (generated)
├── models/
│   └── lokumu-kit-lin/
│       └── Modelfile            # Ollama model definition (versioned)
├── lokumu-api/
│   ├── scripts/
│   │   ├── parse-eliet-html.ts
│   │   └── export-training-dataset.ts
│   └── src/
│       ├── training/            # TrainingDialogue module (new)
│       └── conversation/        # ConversationService (new)
└── lokumu-web/
    └── src/app/train/           # Training dialogue UI (new)
```

### 1.3 Environment variables (additions)

```env
OLLAMA_MODEL=lokumu-kit-lin:latest
OLLAMA_FALLBACK_MODEL=qwen2.5:7b
OLLAMA_TIMEOUT_MS=120000
TRAINING_AUTO_APPROVE=true       # dev only; false in production
COMMUNITY_AUTO_APPROVE=true      # existing; dev only
CONVERSATION_HISTORY_TURNS=10
RAG_TOP_K_VAGUE=8
RAG_TOP_K_PRECISE=3
```

---

## 2. Corpus & RAG Ingestion (~2 000 chunks)

### 2.1 Source breakdown

| Source | Content | Chunks | Language tags |
| ------ | ------- | ------ | ------------- |
| Eliet lexicon | 1 expression = 1 chunk (KIT + LIN + FR) | ~600 | `kit`, `lin` |
| Eliet grammar | 1 rule or conjugation table = 1 chunk | ~150 | `kit`, `lin` |
| Kupsala word list | 1 entry = 1 chunk | ~800 | `kit`, `eng` |
| Dialogue examples | Greetings, introductions, thanks (2–5 turns) | ~200 | `kit`, `lin` |
| Comparative pairs | "How to say X in kituba vs lingala" | ~200 | `kit`, `lin` |
| Seed + community | Proverbs, expressions, corrections | ~50+ | all |

**Total at launch: ~2 000 chunks**, growing via community and training dialogue export.

Primary references:

- [Grammaire Eliet (1953) — Monokotuba vs Lingala](https://www.kupsala.net/risto/kongo/monokotuba.html)
- [Kupsala Kongo resource index](https://www.kupsala.net/risto/kongo)

### 2.2 Ingestion pipeline

Extend existing `lokumu-api/scripts/ingest-cultural.ts` with a preprocessing step.

**New script: `parse-eliet-html.ts`**

- Parse HTML by `<h2>` / `<h3>` section boundaries
- Output Markdown files to `data/cultural/processed/eliet-1953/`
- Preserve conjugation tables intact (never split mid-table)
- Attach metadata per section

**Chunking rules**

| Content type | Granularity | Target size |
| ------------ | ----------- | ----------- |
| Lexicon | 1 entry = 1 chunk | Short (50–150 tokens) |
| Grammar | 1 rule/table = 1 chunk | 200–600 tokens |
| Dialogues | 1 exchange = 1 chunk | 200–500 tokens |
| Comparative pairs | 1 pair = 1 chunk | 100–300 tokens |

Avoid chunks under 50 tokens (noise) or over 800 tokens (poor retrieval precision).

### 2.3 Chunk metadata schema

```json
{
  "type": "grammar | lexicon | dialogue_example | proverb | comparative | cultural_note",
  "languages": ["kit", "lin"],
  "section": "pronoms | verbes | lexique | greeting",
  "title": "Les pronoms — Monokotuba vs Lingala",
  "source": "eliet-1953://grammaire/pronoms",
  "tags": ["beginner", "grammar"]
}
```

### 2.4 Adaptive top-k retrieval

| Query signal | top-k | Metadata filter priority |
| ------------ | ----- | ------------------------ |
| Greeting, small talk | 6–8 | `dialogue_example`, `greeting` |
| Translation ("comment dit-on") | 3–4 | `lexicon`, `grammar` |
| Grammar / conjugation | 2–3 | `grammar`, section match |
| Proverb / culture | 3–5 | `proverb`, `cultural_note` |

Use existing hybrid search (keyword + pgvector). Metadata tags drive reranking after initial retrieval.

---

## 3. Training Dialogue Collection

### 3.1 Distinction from community corrections

| | Community correction (existing) | Training dialogue (new) |
| --- | --- | --- |
| Purpose | Fix a wrong answer | Provide an ideal conversation example |
| Destination | RAG chunk (immediate) | LoRA dataset (JSONL export) |
| Format | Q + corrected R | Multi-turn (2–10 messages) |
| UI | `CorrectionForm` on assistant message | `/train` page + "Save for training" from chat |

Approved training dialogues may optionally also be ingested as RAG chunks (`type: dialogue_example`) for double coverage.

### 3.2 Data model

```prisma
model TrainingDialogue {
  id              String    @id @default(uuid())
  title           String
  language        String    // primary: lin | kit
  turns           Json      // [{ role: "user"|"assistant", content: "..." }]
  tags            String[]  @default([])
  source          String    @default("community")
  status          String    @default("pending")  // pending | approved | exported
  contributorNote String?
  reviewedAt      DateTime?
  exportedAt      DateTime?
  createdAt       DateTime  @default(now())

  @@index([status, language])
  @@index([createdAt])
}
```

Validation: minimum 2 turns (one user, one assistant). Primary content language must be `kit` or `lin`.

### 3.3 Client UI (`lokumu-web/src/app/train/`)

**Mode A — From existing chat**

- Button "Enregistrer pour l'entraînement" on a satisfactory conversation thread
- Pre-fills turns from current messages; user edits before submit

**Mode B — Manual entry (linguistic experts)**

- Multi-turn editor: add/remove lines, set language, tags, title
- Submit for validation

**Status display:** pending / approved / exported (mirrors community contribution UX).

### 3.4 Backend API

| Endpoint | Method | Purpose |
| -------- | ------ | ------- |
| `/training/dialogues` | POST | Submit dialogue |
| `/training/dialogues` | GET | List (filter by status) |
| `/training/dialogues/:id/approve` | POST | Approve for export |
| WebSocket `training:submit` | emit | Alternative to REST (consistent with chat) |

When `TRAINING_AUTO_APPROVE=true`, submissions are approved immediately (dev only).

### 3.5 Export for LoRA

**Script: `export-training-dataset.ts`**

- Reads approved `TrainingDialogue` records
- Outputs `data/training/lokumu-kit-lin.jsonl` in chat format:

```jsonl
{"messages":[{"role":"system","content":"..."},{"role":"user","content":"Mbote"},{"role":"assistant","content":"Mbote! Nazali Lokumu..."}],"language":"kit"}
```

- Marks exported records with `exportedAt` timestamp
- Optionally merges synthetic pairs generated from Eliet lexicon during corpus build

### 3.6 LoRA training cycle (external machine)

1. Copy `data/training/lokumu-kit-lin.jsonl` to external GPU machine
2. Fine-tune LoRA on `qwen2.5:7b` (Unsloth, LLaMA-Factory, or equivalent)
3. Merge adapter weights into base model
4. Export GGUF and create Ollama model via `models/lokumu-kit-lin/Modelfile`
5. Copy model artifact to offline demo machine: `ollama create lokumu-kit-lin -f Modelfile`

Re-train periodically (e.g., every 100 approved dialogues or before investor demo). Not on every submission.

---

## 4. Runtime Conversation Flow

### 4.1 Request flow

1. Client sends `{ prompt, language, conversationId? }` via WebSocket
2. `ConversationService` resolves or creates `Conversation`; persists user `ChatMessage`
3. Load last `CONVERSATION_HISTORY_TURNS` (default 10) messages
4. `RagService.search()` with adaptive top-k based on query classification
5. Assemble Ollama messages:
   - **System:** Lokumu identity + anti-hallucination rules + language instruction
   - **Context block:** formatted RAG chunks with `[source: …]` headers
   - **History:** prior turns
   - **User:** current prompt
6. `ModelService.generate()` → `lokumu-kit-lin:latest` (fallback `qwen2.5:7b`)
7. Post-process: extract cited sources, persist assistant message with `usedChunkIds`
8. Emit response via WebSocket (streaming if Ollama supports it; full response acceptable in v1)

### 4.2 LLM reactivation

`AssistantService` currently bypasses the LLM for reliability. Phase 2 re-enables `ModelService` for all non-fast-path requests.

**Fast-path (optional, preserves demo latency):**

- If RAG score > 0.85 on exact lexicon/proverb match, use existing `buildGroundedResponse()` template
- All other queries go through LLM

### 4.3 Conversation persistence

Existing schema (`Conversation`, `ChatMessage`) is used. Changes:

- Client sends and reuses `conversationId` across turns (partially wired today)
- `ChatGateway` delegates persistence to `ConversationService`
- Auto-generate conversation title after first exchange
- Store `usedChunkIds` on assistant messages for citation traceability

### 4.4 System prompt (Kituba / Lingala focus)

Extend `lokumu-api/src/prompts/multilingual.ts`:

- Lokumu identity; supported languages: fra, eng, lin, kit
- For linguistic facts (translations, conjugations, definitions): rely on `[CONTEXTE]`; if absent, say "nazangi te" / "nazui te" rather than invent
- Conversational tone; no markdown bold (`**`)
- Respond in user's language or explicitly requested language

---

## 5. Anti-Hallucination Guardrails

1. **Context-first for facts** — system prompt requires alignment with injected RAG chunks for translations, grammar, definitions
2. **Source citations in UI** — display 1–3 sources when chunks are injected (existing `SourceCitation` component)
3. **Fast-path grounded** — high-confidence RAG matches skip LLM (optional latency optimization)
4. **Explicit refusal** — no relevant chunk: LLM responds with honest "not in my corpus" + suggested questions
5. **Training moderation** — dialogues reviewed before LoRA export (auto-approve in dev via `.env`)

---

## 6. Success Criteria

| Scenario | Expected outcome |
| -------- | ---------------- |
| "Mbote, ozali malamu?" (kituba) | Natural 2–3 turn reply, no timeout |
| "Comment dit-on merci en lingala?" | Correct translation + lexicon citation |
| 5-turn greeting thread | Coherent follow-ups using conversation history |
| Out-of-corpus question | Honest refusal, no invented proverb or translation |
| Submit dialogue via `/train` | Visible, approved (auto in dev), exportable to JSONL |
| Full offline inference | Ollama + PostgreSQL only; no cloud at runtime |
| Corpus size | ≥2 000 chunks ingested and searchable |

---

## 7. Out of Scope (Phase 2)

- Dev Agent Mode (remains phase 3+)
- Swahili
- Real-time re-training on every dialogue submission
- Cloud inference or mandatory cloud dependency at runtime
- Root monorepo tooling
- Authentication required for demo (optional auth remains optional)

---

## 8. Migration from Phase 1

| Phase 1 behavior | Phase 2 change |
| ---------------- | -------------- |
| LLM disabled in `AssistantService` | Re-enabled with `lokumu-kit-lin` |
| ~34 seed chunks | ~2 000 chunks via Eliet + Kupsala ingest |
| Random `conversationId` per request | Persistent multi-turn conversations |
| Community corrections only | + Training dialogue collection |
| No fine-tuning | LoRA pipeline (external train, offline infer) |

Phase 1 grounded templates and hybrid RAG search remain; they become fast-path optimizations rather than the only response path.

---

## 9. Testing Strategy

**Unit tests**

- `parse-eliet-html.ts`: section extraction, metadata, no mid-table splits
- Adaptive top-k routing in `cultural-router.ts`
- `TrainingDialogue` validation (min 2 turns, language check)
- `export-training-dataset.ts`: JSONL format correctness

**Integration tests**

- Conversation persistence across multiple WebSocket messages
- RAG retrieval returns grammar chunks for conjugation queries
- Training submit → approve → export pipeline

**Manual E2E**

- Multi-turn kituba greeting thread
- Translation with citation
- Submit training dialogue from chat and manual editor
- Verify offline operation with `lokumu-kit-lin` model loaded

---

## 10. Risks & Mitigations

| Risk | Mitigation |
| ---- | ---------- |
| LLM hallucination on LIN/KIT | RAG context injection + refusal instructions + fast-path for high-confidence matches |
| `qwen2.5:7b` too slow on demo machine | Fast-path templates; fallback model; reduce history turns |
| LoRA quality insufficient | Start with RAG-heavy hybrid; iterate LoRA with more approved dialogues |
| Kupsala HTML parsing fragile | Manual review of processed Markdown before ingest |
| Lingala coverage weaker than Kituba | Eliet comparisons + comparative pair chunks + community dialogues |
| 2 000 chunks hurt retrieval precision | Adaptive top-k + metadata reranking; chunk size discipline |
