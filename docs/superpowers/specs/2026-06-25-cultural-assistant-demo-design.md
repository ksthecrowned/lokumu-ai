# Lokumu Cultural Assistant — Investor Demo Design

**Date:** 2026-06-25  
**Status:** Approved (brainstorming)  
**Scope:** Visual multilingual cultural assistant for investor demos (offline-first)

## Vision

Lokumu is a local, sovereign AI for Congolese languages. Long-term goals include a virtual assistant and a code agent. **This spec covers the near-term deliverable:** an investor-ready cultural and linguistic assistant demonstrating:

- Multilingual conversation (French, English, Lingala, Kituba)
- Cultural knowledge grounded in a local corpus (RAG)
- Community enrichment via user corrections (no cloud, no fine-tuning)
- 100% offline operation (Ollama + PostgreSQL + BGE-M3)

**Explicitly out of scope:** Dev Agent Mode, LLM fine-tuning, Swahili, code mode in UI, root-level monorepo tooling.

---

## Decisions Summary

| Topic | Decision |
|-------|----------|
| Demo scenario | Cultural/linguistic assistant (LIN + KIT focus) |
| Content | Natural conversation + cultural corpus (~30–50 entries) |
| Community learning | RAG memory (approved contributions) + user feedback corrections |
| Infrastructure | 100% offline — Ollama + PostgreSQL, no mandatory cloud |
| Languages | `fra`, `eng`, `lin`, `kit` — Swahili removed |
| Approach | Demo Platform: polished UI + real RAG + community memory |
| Repo cleanup | Included in demo scope; no root `package.json` / `node_modules` |

---

## 1. Architecture & Repository Structure

### 1.1 Guiding principle

Three **independent** packages. The repo root contains documentation and optional bash scripts only — no Node dependencies at root.

```
lokumu-ai/                          # NO package.json, NO node_modules
├── ARCHITECTURE.md                 # aligned with actual structure
├── README.md
├── start-demo.sh                   # optional bash launcher (no npm)
├── lokumu-api/                     # NestJS backend
├── lokumu-web/                     # Next.js investor UI
├── lokumu-agent/                   # Dev CLI — phase 2, unchanged
├── data/
│   └── cultural/                   # user-provided content (LIN/KIT/FR/EN)
└── docs/superpowers/
    ├── specs/
    └── plans/
```

Demo startup: three terminals or `./start-demo.sh` invoking commands inside each package.

### 1.2 Structural cleanup (in demo scope)

| Action | Detail |
|--------|--------|
| Rename `lokumu-api/src/agent/` → `assistant/` | Chat orchestration; reserve "agent" for Dev Agent CLI |
| Remove Swahili | UI, prompts, seed, schema comments, README, legacy specs |
| Move seed | `seed-demo-content.ts` → `lokumu-api/prisma/seed/cultural-corpus.ts` |
| Add `data/cultural/` | User content import via `lokumu-api/scripts/ingest-cultural.ts` |
| Delete `lokumu-agent/src/runtime/Untitled` | Orphan file |
| One lockfile per package | `bun.lock` OR `package-lock.json` in `lokumu-api`, not both |
| Update `lokumu-agent/STRUCTURE.md` | Reflect actual file tree |
| Add `shared/i18n/languages.ts` | Single source: `fra`, `eng`, `lin`, `kit`; web maps `fr`/`en` at boundary |

**Not in scope:** root workspaces, extracting `lokumu-rag/` to separate repo.

### 1.3 Runtime architecture

```
User (Investor)
    → lokumu-web (Next.js)
    → WebSocket → lokumu-api (NestJS)
        ├── chat/          WebSocket gateway
        ├── assistant/     Prompt assembly, RAG routing (ex-agent/)
        ├── community/     Feedback → RAG ingestion
        ├── rag/           BGE-M3 embeddings + pgvector search
        ├── model/         Ollama HTTP client
        └── auth/          Optional, not required for demo
    → PostgreSQL + pgvector
    → Ollama (localhost:11434)
    → BGE-M3 (Transformers.js, cached locally)
data/cultural/ → ingest → RAG
```

### 1.4 Request flow

1. User sends message (language selected in UI)
2. `assistant/` decides if RAG is needed (cultural keywords or chip-triggered)
3. `rag/` returns top chunks filtered by language (score > 0.5)
4. Prompt = system prompt + RAG context + last 3 messages
5. `model/` calls Ollama (`qwen3.5`, fallback `deepseek-coder`), streams response
6. UI shows response + source citations
7. Optional: user corrects → `community/` → approve → re-ingest → improved future answers

---

## 2. Cultural Corpus, RAG & Multilingual Prompts

### 2.1 Corpus entry format

JSON files in `data/cultural/`:

```json
{
  "id": "proverbe-lin-001",
  "type": "proverb | greeting | expression | cultural_note | dialogue",
  "language": "lin",
  "title": "Proverbe sur la patience",
  "content": "Molili mpiko, osopá eloko...",
  "translation_fr": "Celui qui a de la patience obtient ce qu'il veut.",
  "tags": ["sagesse", "patience"],
  "source": "oral tradition / user-provided"
}
```

**Target volume:** 30–50 entries

| Language | Count | Priority types |
|----------|-------|----------------|
| `lin` | 12–15 | proverbs, greetings, common expressions |
| `kit` | 12–15 | same |
| `fra` | 5–8 | translations + DRC cultural context |
| `eng` | 3–5 | translations for international investors |

User content goes in `data/cultural/`. Seed script fills gaps with validated content (replace current low-quality Kituba placeholder in seed).

### 2.2 Ingestion paths

| Path | Command | Use |
|------|---------|-----|
| Seed | `cd lokumu-api && npm run seed` | Guaranteed demo baseline |
| Import | `npm run ingest:cultural -- ../data/cultural/` | User `.json` / `.md` / `.txt` files |

Chunking: paragraph split, ~256 token max. One JSON entry = one document. Metadata in `Chunk.metadata`: `{ type, tags, translation_fr, source }`.

### 2.3 RAG fixes (from current state)

Current `rag.service.ts` uses mock embeddings and `LIMIT 5` without vector similarity. Demo requires:

**a) Real BGE-M3 embeddings**

- Load `Xenova/bge-m3` on API startup (currently disabled)
- First load ~1–2 GB RAM; model cached in `~/.cache/huggingface/`
- Fully offline after initial download

**b) pgvector similarity search**

```sql
SELECT c.id, c.content, c.metadata, c.language,
       1 - (c.embedding <=> $query_embedding) AS score
FROM "Chunk" c
WHERE ($language IS NULL OR c.language = $language)
ORDER BY c.embedding <=> $query_embedding
LIMIT 5
```

Minimum score threshold: `0.5`. Below threshold: free conversation without citations.

**c) RAG routing in `assistant/`**

| Signal | Action |
|--------|--------|
| Cultural keywords (`proverbe`, `ndakisa`, `salut`, `tradition`, `comment dit-on`, etc.) | Force RAG |
| Simple greeting (`mbote`, `bonjour`) | Optional RAG (greeting chunks) |
| General non-cultural question | No RAG, system prompt only |

### 2.4 Prompts

Files: `lokumu-api/src/prompts/multilingual.ts`, `cultural.prompt.ts`

System prompt (per language):

```
Tu es Lokumu, assistant culturel et linguistique congolais.
- Réponds dans la langue demandée ({language})
- Pour le Lingala et le Kituba : registre courant, respectueux
- Si du contexte culturel est fourni, appuie-toi dessus et cite les sources
- Si tu n'es pas certain, dis-le — ne fabrique pas
- Tu fonctionnes 100 % en local, sans cloud
```

RAG template:

```
[CONTEXTE CULTUREL]
{chunk_1} (source: {title})
{chunk_2}
[/CONTEXTE CULTUREL]

Historique: {last_3_messages}
Question: {user_message}

Réponds en {language}. Cite les sources du contexte quand pertinent.
```

### 2.5 Language codes

| Internal (API/DB) | UI (web) | Display |
|-------------------|----------|---------|
| `fra` | `fr` | Français |
| `eng` | `en` | English |
| `lin` | `lin` | Lingála |
| `kit` | `kit` | Kitúba |

Centralized in `shared/i18n/languages.ts`.

### 2.6 LLM — Ollama migration

Replace llama.cpp CLI with Ollama HTTP client for demo simplicity.

| Parameter | Value |
|-----------|--------|
| Base URL | `http://localhost:11434` |
| Endpoint | `POST /api/chat` |
| Primary model | `qwen3.5` |
| Fallback | `deepseek-coder` |
| Temperature (chat) | `0.7` |
| Stream | `true` (native WebSocket) |

`llama.cpp` remains available via env for future use.

### 2.7 Realistic quality expectations

| Capability | Demo expectation | Mechanism |
|------------|------------------|-----------|
| Corpus proverbs/expressions | Reliable | RAG + citation |
| Common greetings | Good | RAG + prompt |
| Free LIN/KIT conversation | Variable (model limits) | Prompt + UI disclaimer |
| FR ↔ LIN/KIT translation (known content) | Good | RAG |

UI disclaimer: *« Réponses culturelles ancrées dans le corpus local. Conversation libre en cours d'enrichissement communautaire. »*

---

## 3. Community Memory

### 3.1 Principle

User corrections enrich the RAG corpus — no LLM fine-tuning. Demonstrates community learning in live demos.

```
User corrects response → Contribution (pending) → Validation → RAG ingest → available for future queries
```

### 3.2 Data model

```prisma
model CommunityContribution {
  id              String   @id @default(uuid())
  conversationId  String?
  messageId       String?
  language        String           // fra | eng | lin | kit
  originalQuery   String
  originalAnswer  String
  correctedAnswer String
  contributorNote String?
  status          String   @default("pending")  // pending | approved | rejected
  reviewedAt      DateTime?
  ingestedAt      DateTime?
  chunkId         String?
  createdAt       DateTime @default(now())

  @@index([status, language])
  @@index([createdAt])
}
```

No required User link for demo (guest mode).

### 3.3 API — `community/` module

| Endpoint | Method | Role |
|----------|--------|------|
| `/community/contributions` | POST | Submit correction |
| `/community/contributions` | GET | List (filter status, language) |
| `/community/contributions/:id/approve` | PATCH | Validate → trigger RAG ingest |
| `/community/contributions/:id/reject` | PATCH | Reject with optional reason |
| `/community/stats` | GET | Demo metrics counter |

POST payload:

```json
{
  "conversationId": "uuid",
  "messageId": "uuid",
  "language": "lin",
  "originalQuery": "Comment dit-on bonjour ?",
  "originalAnswer": "Mbote na yo",
  "correctedAnswer": "Mbote ! (salutation courante, matin et soir)",
  "contributorNote": "Forme la plus naturelle à Kinshasa"
}
```

### 3.4 Validation modes

| Mode | Env | Behavior |
|------|-----|----------|
| Live demo | `COMMUNITY_AUTO_APPROVE=true` | Immediate ingest |
| Production | `COMMUNITY_AUTO_APPROVE=false` | Manual review before ingest |

On approval:

1. Build document: `source: community://{id}`, Q/R content, language
2. Call `RagService.ingestDocument()`
3. Update contribution: `status=approved`, `ingestedAt`, `chunkId`

### 3.5 WebSocket events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `contribution:submit` | client → server | Submit correction |
| `contribution:status` | server → client | `{ id, status, message }` |

Community chunks get +0.1 score bonus (configurable, can disable).

### 3.6 Safeguards

| Risk | Mitigation |
|------|------------|
| Spam | Rate limit: 5 contributions / session / hour |
| Duplicates | Hash `(originalQuery + language)`; merge if existing score > 0.9 |
| Polluted corpus | `rejected` status; purge by `source: community://` |
| False confidence | UI badge "Enrichi par la communauté" on community citations |

---

## 4. Investor UI (`lokumu-web`)

### 4.1 Goal

Replace inline-style chat prototype with investor-ready demo UI. No auth required. Code mode hidden.

### 4.2 Stack

| Choice | Decision |
|--------|----------|
| Styling | Tailwind CSS (added to `lokumu-web` only) |
| UI i18n | i18next (already installed) for interface labels |
| Auth routes | Kept but not linked from demo chat |
| Code mode | Hidden; `assistant/` forces chat mode |

### 4.3 File structure

```
lokumu-web/src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx              # redirect → /chat
│   └── chat/page.tsx
├── components/
│   ├── chat/
│   │   ├── ChatWindow.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── SourceCitation.tsx
│   │   ├── CorrectionForm.tsx
│   │   ├── LanguagePicker.tsx
│   │   ├── SuggestedQuestions.tsx
│   │   └── TypingIndicator.tsx
│   └── demo/
│       ├── DemoHeader.tsx
│       ├── OfflineBadge.tsx
│       ├── CommunityStats.tsx
│       └── DisclaimerBanner.tsx
├── lib/
│   ├── socket.ts
│   ├── languages.ts
│   └── api.ts
└── styles/globals.css
```

### 4.4 Visual identity

| Token | Value | Usage |
|-------|--------|-------|
| Primary | `#007FFF` | Buttons, accents |
| Accent | `#F7D618` | Offline badge |
| Red | `#CE1126` | Errors |
| Background | `#FAFAFA` | Page |
| Surface | `#FFFFFF` | Cards, bubbles |

### 4.5 Key UI features

- **SuggestedQuestions:** 6 chips per language triggering reliable RAG queries
- **MessageBubble:** streaming, source citations, community badge, "Corriger" button
- **OfflineBadge:** polls `GET /health` — green when API + Ollama OK
- **CommunityStats:** contribution counter from `/community/stats`
- **DisclaimerBanner:** collapsible honesty banner on linguistic limits

### 4.6 Enriched WebSocket contract

```typescript
// stream event
{
  chunk: string;
  done: boolean;
  sources?: { id: string; title: string; type: string; community: boolean }[];
  messageId?: string;
  conversationId?: string;
}
```

### 4.7 Removed from current UI

- Swahili selector
- Code mode display
- Inline styles
- Generic placeholder text

---

## 5. Demo Script, Errors & Success Criteria

### 5.1 Pre-demo checklist

| Step | Verification |
|------|--------------|
| PostgreSQL running | `psql` connects |
| Ollama running | `qwen3.5` in `curl localhost:11434/api/tags` |
| Migrate + seed | ~30–50 chunks in DB |
| Import user content | `npm run ingest:cultural` logs OK |
| API | `GET /health` → 200 |
| Web | Offline badge green |
| BGE-M3 cached | Model in `~/.cache/huggingface/` for strict offline |

### 5.2 Investor demo script (~8 min)

| Min | Action | Key message |
|-----|--------|-------------|
| 0–1 | Open `/chat`, show offline badge + languages | 100% local, data never leaves machine |
| 1–2 | Chip "Proverbe lingala" → response + citation | Grounded in Congolese cultural corpus |
| 2–3 | Switch to Kituba, greeting question | Four languages, one AI |
| 3–4 | French cultural question | FR ↔ local language bridge |
| 4–6 | Correct a response → re-ask same question | Community enriches AI without cloud |
| 6–7 | Show CommunityStats | Participatory learning, data sovereignty |
| 7–8 | Short free Lingala chat | Continuous enrichment vision |

**Plan B:** If free LIN/KIT is weak, stay on suggested chips and correction flow.

### 5.3 Error handling

| Scenario | API | UI |
|----------|-----|-----|
| Ollama down | `503 ollama_unavailable` | Red badge + instructions |
| Model missing | fallback `deepseek-coder`; else error | Toast with model name |
| PostgreSQL down | `503 database_unavailable` | Error message |
| BGE-M3 not loaded | hash fallback + warning log | Orange banner: degraded search |
| Empty RAG | chat without context | Disclaimer visible |
| Ollama timeout (>30s) | abort | "Réponse trop longue" |
| Contribution spam | `429` | Rate limit message |

**Health endpoint** (`GET /health`):

```json
{
  "status": "ok | degraded | down",
  "ollama": true,
  "database": true,
  "embeddings": true,
  "chunksCount": 42
}
```

### 5.4 Environment variables

**`lokumu-api/.env`**

```env
DATABASE_URL=postgresql://...
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3.5
OLLAMA_FALLBACK_MODEL=deepseek-coder
COMMUNITY_AUTO_APPROVE=true
EMBEDDING_MODEL=Xenova/bge-m3
PORT=3001
```

**`lokumu-web/.env.local`**

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

### 5.5 Minimal tests

| Level | Target |
|-------|--------|
| Unit | `languages.ts`, multilingual prompts, cultural keyword routing |
| Integration | ingest → search with score > threshold |
| Integration | contribution → approve → chunk retrievable |
| Manual E2E | Section 5.2 script on offline machine |

### 5.6 Definition of Done

- [ ] Polished chat UI, 4 languages, no Swahili
- [ ] Offline badge green on disconnected laptop
- [ ] ≥ 30 cultural entries with real embeddings
- [ ] ≥ 3 chip questions return correct source citations
- [ ] Correction → re-ask → improved answer in < 60s
- [ ] CommunityStats counter visible
- [ ] Structural cleanup complete (`assistant/`, seed, `data/cultural/`)
- [ ] No root `package.json` / `node_modules`
- [ ] README updated with pre-demo checklist

### 5.7 Post-demo roadmap (not implemented)

1. Phase 2 — Dev Agent Mode (`lokumu agent "..."`)
2. Phase 3 — Community moderation + admin dashboard
3. Phase 4 — Fine-tuning adapters on validated corpus

---

## Appendix: Naming conventions

| Layer | Convention | Example |
|-------|------------|---------|
| Packages | `lokumu-{role}` | `lokumu-api`, `lokumu-web` |
| NestJS modules | lowercase domain | `assistant/`, `community/` |
| Language codes (internal) | ISO 639-3 | `fra`, `eng`, `lin`, `kit` |
| Language codes (UI) | Short codes | `fr`, `en`, `lin`, `kit` |
| Community sources | URI scheme | `community://{contributionId}` |
| Cultural data | `data/cultural/` | JSON, MD, TXT |
