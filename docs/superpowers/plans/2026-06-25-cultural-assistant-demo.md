# Cultural Assistant Investor Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an offline-first, investor-ready cultural/linguistic chat assistant (FR/EN/LIN/KIT) with real RAG, community corrections, and polished UI.

**Architecture:** Extend `lokumu-api` with `assistant/` (ex-`agent/`), `community/`, Ollama client, and fixed pgvector RAG; rebuild `lokumu-web` chat as Tailwind demo UI. Three independent packages, no root `package.json`.

**Tech Stack:** NestJS 11, Next.js 14, Prisma 7, PostgreSQL + pgvector, Ollama (`qwen3.5`), BGE-M3 via `@xenova/transformers`, Socket.IO, Tailwind CSS

## Global Constraints

- Languages: `fra`, `eng`, `lin`, `kit` only — Swahili removed everywhere
- 100% offline demo: Ollama `http://localhost:11434`, PostgreSQL local, no mandatory cloud
- Ollama primary model: `qwen3.5`; fallback: `deepseek-coder`
- `COMMUNITY_AUTO_APPROVE=true` for live investor demos
- No root `package.json`, `node_modules`, or npm workspaces at repo root
- Code mode hidden in demo UI; `assistant/` forces chat mode
- BGE-M3 embedding dimension: **1024** (not 384)
- UI language codes: `fr`/`en`/`lin`/`kit`; internal API/DB: `fra`/`eng`/`lin`/`kit`

---

## File Structure

```
lokumu-ai/
├── start-demo.sh                          # bash only, no npm at root
├── data/cultural/                         # user JSON/MD/TXT corpus
├── README.md                              # pre-demo checklist
├── lokumu-api/
│   ├── prisma/
│   │   ├── schema.prisma                  # +CommunityContribution
│   │   ├── migrations/.../migration.sql   # pgvector extension
│   │   └── seed/
│   │       ├── cultural-corpus.ts         # ~30-50 validated entries
│   │       └── index.ts
│   ├── scripts/
│   │   └── ingest-cultural.ts
│   └── src/
│       ├── assistant/                     # renamed from agent/
│       │   ├── assistant.module.ts
│       │   ├── assistant.service.ts
│       │   ├── assistant.controller.ts
│       │   ├── cultural-router.ts         # RAG trigger heuristics
│       │   └── cultural-router.spec.ts
│       ├── community/
│       │   ├── community.module.ts
│       │   ├── community.service.ts
│       │   ├── community.controller.ts
│       │   └── dto/create-contribution.dto.ts
│       ├── shared/i18n/languages.ts
│       ├── prompts/
│       │   ├── multilingual.ts            # no swa, cultural tone
│       │   └── cultural.prompt.ts
│       ├── rag/rag.service.ts             # real BGE-M3 + pgvector
│       ├── model/ollama.client.ts         # HTTP client
│       ├── model/model.service.ts         # delegates to Ollama
│       ├── chat/chat.gateway.ts           # enriched stream events
│       └── health/
│           ├── health.module.ts
│           └── health.controller.ts
└── lokumu-web/
    ├── tailwind.config.ts
    ├── postcss.config.js
    └── src/
        ├── app/chat/page.tsx
        ├── components/chat/*.tsx
        ├── components/demo/*.tsx
        └── lib/{socket,languages,api}.ts
```

---

### Task 1: Structural cleanup & rename `agent/` → `assistant/`

**Files:**

- Rename: `lokumu-api/src/agent/` → `lokumu-api/src/assistant/`
- Modify: `lokumu-api/src/app.module.ts`
- Modify: `lokumu-api/src/chat/chat.gateway.ts`
- Delete: `lokumu-agent/src/runtime/Untitled`
- Delete: `lokumu-api/package-lock.json` (keep `bun.lock` OR npm — pick **npm** since NestJS scripts use npm; delete `bun.lock` in api)
- Delete: root `cat` file if still tracked

**Interfaces:**

- Produces: `AssistantModule`, `AssistantService` (renamed from Agent\*)

- [ ] **Step 1: Rename files and exports**

Rename directory and files:

- `agent.module.ts` → `assistant.module.ts`
- `agent.service.ts` → `assistant.service.ts`
- `agent.controller.ts` → `assistant.controller.ts`
- `agent.service.spec.ts` → `assistant.service.spec.ts`

Update class names: `AgentModule` → `AssistantModule`, `AgentService` → `AssistantService`, `AgentController` → `AssistantController`.

- [ ] **Step 2: Update imports**

```typescript
// lokumu-api/src/app.module.ts
import { AssistantModule } from './assistant/assistant.module';

@Module({
  imports: [PrismaModule, AuthModule, RagModule, ModelModule, AssistantModule, ChatModule],
  // ...
})
```

```typescript
// lokumu-api/src/chat/chat.gateway.ts
import { AssistantService } from '../assistant/assistant.service';

constructor(private assistantService: AssistantService) {}
// replace agentService.processRequest → assistantService.processRequest
```

- [ ] **Step 3: Delete orphan files**

```bash
rm -f lokumu-agent/src/runtime/Untitled
rm -f lokumu-api/package-lock.json
```

- [ ] **Step 4: Verify build**

Run: `cd lokumu-api && npm run build`
Expected: PASS (no import errors)

- [ ] **Step 5: Commit**

```bash
git add -A lokumu-api/src/assistant lokumu-api/src/app.module.ts lokumu-api/src/chat/chat.gateway.ts
git rm -r lokumu-api/src/agent 2>/dev/null || true
git commit -m "refactor(api): rename agent module to assistant"
```

---

### Task 2: Centralized language codes (`shared/i18n/languages.ts`)

**Files:**

- Create: `lokumu-api/src/shared/i18n/languages.ts`
- Create: `lokumu-api/src/shared/i18n/languages.spec.ts`
- Create: `lokumu-web/src/lib/languages.ts`

**Interfaces:**

- Produces: `normalizeLanguage(uiCode: string): InternalLanguage`, `SUPPORTED_LANGUAGES`, `InternalLanguage`, `UiLanguage`

- [ ] **Step 1: Write failing API test**

```typescript
// lokumu-api/src/shared/i18n/languages.spec.ts
import { normalizeLanguage, SUPPORTED_INTERNAL } from "./languages";

describe("languages", () => {
  it("maps UI codes to ISO 639-3", () => {
    expect(normalizeLanguage("fr")).toBe("fra");
    expect(normalizeLanguage("en")).toBe("eng");
    expect(normalizeLanguage("lin")).toBe("lin");
    expect(normalizeLanguage("kit")).toBe("kit");
  });

  it("supports only 4 languages", () => {
    expect(SUPPORTED_INTERNAL).toEqual(["fra", "eng", "lin", "kit"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd lokumu-api && npm test -- shared/i18n/languages.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```typescript
// lokumu-api/src/shared/i18n/languages.ts
export type InternalLanguage = "fra" | "eng" | "lin" | "kit";
export type UiLanguage = "fr" | "en" | "lin" | "kit";

export const SUPPORTED_INTERNAL: InternalLanguage[] = [
  "fra",
  "eng",
  "lin",
  "kit",
];

const UI_TO_INTERNAL: Record<string, InternalLanguage> = {
  fr: "fra",
  fra: "fra",
  en: "eng",
  eng: "eng",
  lin: "lin",
  lg: "lin",
  kit: "kit",
};

export function normalizeLanguage(code?: string): InternalLanguage {
  if (!code) return "fra";
  const key = code.toLowerCase().slice(0, 3);
  return UI_TO_INTERNAL[key] ?? UI_TO_INTERNAL[code.toLowerCase()] ?? "fra";
}

export const LANGUAGE_LABELS: Record<UiLanguage, string> = {
  fr: "Français",
  en: "English",
  lin: "Lingála",
  kit: "Kitúba",
};
```

```typescript
// lokumu-web/src/lib/languages.ts
export type UiLanguage = "fr" | "en" | "lin" | "kit";

export const UI_LANGUAGES: { code: UiLanguage; label: string }[] = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "lin", label: "Lingála" },
  { code: "kit", label: "Kitúba" },
];
```

- [ ] **Step 4: Run test**

Run: `cd lokumu-api && npm test -- shared/i18n/languages.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lokumu-api/src/shared lokumu-web/src/lib/languages.ts
git commit -m "feat: centralize language code mapping (4 languages)"
```

---

### Task 3: Remove Swahili & update multilingual prompts

**Files:**

- Modify: `lokumu-api/src/prompts/multilingual.ts`
- Modify: `lokumu-api/src/prompts/multilingual.spec.ts`
- Create: `lokumu-api/src/prompts/cultural.prompt.ts`
- Modify: `lokumu-web/src/app/chat/page.tsx` (remove swa until full UI rewrite)
- Modify: `README.md`

- [ ] **Step 1: Update failing tests (remove swa)**

```typescript
// lokumu-api/src/prompts/multilingual.spec.ts
// Remove the swa/sw test block entirely
// Add test for cultural prompt inclusion:
import { buildCulturalSystemPrompt } from "./cultural.prompt";

it("builds cultural system prompt for lin", () => {
  expect(buildCulturalSystemPrompt("lin")).toContain("Lokumu");
  expect(buildCulturalSystemPrompt("lin")).toContain("local");
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd lokumu-api && npm test -- prompts/multilingual.spec.ts`
Expected: FAIL on new cultural prompt import

- [ ] **Step 3: Implement**

```typescript
// lokumu-api/src/prompts/cultural.prompt.ts
import { InternalLanguage } from "../shared/i18n/languages";

const CULTURAL_PROMPTS: Record<InternalLanguage, string> = {
  fra: `Tu es Lokumu, assistant culturel et linguistique congolais.
- Réponds en français
- Si du contexte culturel est fourni, appuie-toi dessus et cite les sources
- Si tu n'es pas certain, dis-le — ne fabrique pas
- Tu fonctionnes 100 % en local, sans cloud`,
  eng: `You are Lokumu, a Congolese cultural and linguistic assistant.
- Respond in English
- If cultural context is provided, use it and cite sources
- If unsure, say so — do not fabricate
- You run 100% locally, no cloud`,
  lin: `Ozali Lokumu, mokambi ya culture mpe lokota ya Kongo.
- Yaká na lingála
- Soki contexte ya culture ezali, salá na yango mpe koloba source
- Soki ozali kozanga confiance, koloba — kobimisa te
- Osalaka 100% na esika, sans cloud`,
  kit: `Wewe ni Lokumu, muntu ya culture na minuku ya Kongo.
- Sungula na kituba
- Soki contexte ya culture vandaka, sala na yandi mpe koloba source
- Soki vandaka na doute, koloba — kuyidika te
- Osalaka 100% na ndaku, sans cloud`,
};

export function buildCulturalSystemPrompt(lang: InternalLanguage): string {
  return CULTURAL_PROMPTS[lang];
}

export function buildRagPrompt(
  context: string,
  userMessage: string,
  lang: InternalLanguage,
  history: string,
): string {
  const contextBlock = context
    ? `[CONTEXTE CULTUREL]\n${context}\n[/CONTEXTE CULTUREL]\n\n`
    : "";
  return `${contextBlock}Historique:\n${history}\n\nQuestion: ${userMessage}\n\nRéponds en ${lang}. Cite les sources du contexte quand pertinent.`;
}
```

Remove `swa` from `multilingual.ts` `SYSTEM_PROMPTS` and `LANGUAGE_MAP`.

- [ ] **Step 4: Run tests**

Run: `cd lokumu-api && npm test -- prompts/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lokumu-api/src/prompts README.md lokumu-web/src/app/chat/page.tsx
git commit -m "feat: cultural prompts and remove Swahili support"
```

---

### Task 4: Prisma schema — CommunityContribution + pgvector

**Files:**

- Modify: `lokumu-api/prisma/schema.prisma`
- Create: `lokumu-api/prisma/migrations/20260625120000_community_pgvector/migration.sql`

**Interfaces:**

- Produces: `CommunityContribution` Prisma model, pgvector `vector(1024)` on `Chunk.embedding`

- [ ] **Step 1: Add model to schema**

```prisma
// Add to lokumu-api/prisma/schema.prisma

model CommunityContribution {
  id              String    @id @default(uuid())
  conversationId  String?
  messageId       String?
  language        String
  originalQuery   String
  originalAnswer  String
  correctedAnswer String
  contributorNote String?
  status          String    @default("pending")
  reviewedAt      DateTime?
  ingestedAt      DateTime?
  chunkId         String?
  createdAt       DateTime  @default(now())

  @@index([status, language])
  @@index([createdAt])
}
```

Update `Chunk` comment: `// ISO 639-3: fra, lin, kit, eng` (remove swa).

- [ ] **Step 2: Create pgvector migration SQL**

```sql
-- lokumu-api/prisma/migrations/20260625120000_community_pgvector/migration.sql
CREATE EXTENSION IF NOT EXISTS vector;

-- CommunityContribution table (Prisma will also generate; keep in sync)
CREATE TABLE IF NOT EXISTS "CommunityContribution" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT,
  "messageId" TEXT,
  "language" TEXT NOT NULL,
  "originalQuery" TEXT NOT NULL,
  "originalAnswer" TEXT NOT NULL,
  "correctedAnswer" TEXT NOT NULL,
  "contributorNote" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "reviewedAt" TIMESTAMP(3),
  "ingestedAt" TIMESTAMP(3),
  "chunkId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityContribution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CommunityContribution_status_language_idx"
  ON "CommunityContribution"("status", "language");
CREATE INDEX IF NOT EXISTS "CommunityContribution_createdAt_idx"
  ON "CommunityContribution"("createdAt");

-- Convert embedding storage to pgvector (1024 dims for BGE-M3)
ALTER TABLE "Chunk" ADD COLUMN IF NOT EXISTS "embedding_vec" vector(1024);

-- Backfill: if embedding bytea exists, skip backfill on empty DB
-- New ingests write to embedding_vec directly via raw SQL
```

- [ ] **Step 3: Run migration**

Run: `cd lokumu-api && npx prisma migrate dev --name community_pgvector`
Expected: migration applied

- [ ] **Step 4: Commit**

```bash
git add lokumu-api/prisma
git commit -m "feat(db): add CommunityContribution and pgvector column"
```

---

### Task 5: Cultural corpus seed & ingest script

**Files:**

- Create: `data/cultural/.gitkeep`
- Create: `data/cultural/README.md`
- Create: `lokumu-api/prisma/seed/cultural-corpus.ts`
- Create: `lokumu-api/prisma/seed/index.ts`
- Create: `lokumu-api/scripts/ingest-cultural.ts`
- Modify: `lokumu-api/package.json` (add seed + ingest scripts)
- Delete: `lokumu-api/seed-demo-content.ts` (moved)

**Interfaces:**

- Produces: `CULTURAL_ENTRIES` array, `npm run seed`, `npm run ingest:cultural`

- [ ] **Step 1: Create seed data file with 30+ entries**

```typescript
// lokumu-api/prisma/seed/cultural-corpus.ts
export interface CulturalEntry {
  id: string;
  type: "proverb" | "greeting" | "expression" | "cultural_note" | "dialogue";
  language: "fra" | "eng" | "lin" | "kit";
  title: string;
  content: string;
  translation_fr?: string;
  tags: string[];
  source: string;
}

export const CULTURAL_ENTRIES: CulturalEntry[] = [
  {
    id: "greeting-lin-001",
    type: "greeting",
    language: "lin",
    title: "Salutation courante",
    content: "Mbote! Ezali ndenge nini?",
    translation_fr: "Bonjour! Comment ça va?",
    tags: ["salutation"],
    source: "seed",
  },
  {
    id: "greeting-kit-001",
    type: "greeting",
    language: "kit",
    title: "Salutation kituba",
    content: "Mbote! Ngeyi kufwana?",
    translation_fr: "Bonjour! Comment vas-tu?",
    tags: ["salutation"],
    source: "seed",
  },
  // ... add 28+ more entries (12-15 lin, 12-15 kit, 5-8 fra, 3-5 eng)
  // Each proverb/expression must be validated Lingala/Kituba — no placeholder garbage
];
```

- [ ] **Step 2: Seed runner**

```typescript
// lokumu-api/prisma/seed/index.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { RagService } from "../../src/rag/rag.service";
import { PrismaService } from "../../src/prisma/prisma.service";
import { CULTURAL_ENTRIES } from "./cultural-corpus";

async function main() {
  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });
  const prismaService = prisma as unknown as PrismaService;
  const rag = new RagService(prismaService);
  await rag.onModuleInit();

  for (const entry of CULTURAL_ENTRIES) {
    const body = entry.translation_fr
      ? `${entry.content}\n\n(FR: ${entry.translation_fr})`
      : entry.content;
    await rag.ingestDocument({
      source: `seed://${entry.id}`,
      title: entry.title,
      language: entry.language,
      content: body,
    });
    console.log(`Seeded: ${entry.id}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 3: Ingest script for data/cultural/**

```typescript
// lokumu-api/scripts/ingest-cultural.ts
import { readdir, readFile } from "fs/promises";
import { join, extname } from "path";
// Parse .json files matching CulturalEntry schema
// Call RagService.ingestDocument for each
// Usage: npx ts-node scripts/ingest-cultural.ts ../data/cultural
```

- [ ] **Step 4: Add package.json scripts**

```json
"seed": "ts-node prisma/seed/index.ts",
"ingest:cultural": "ts-node scripts/ingest-cultural.ts"
```

- [ ] **Step 5: Run seed**

Run: `cd lokumu-api && npm run seed`
Expected: 30+ documents logged

- [ ] **Step 6: Commit**

```bash
git add data/cultural lokumu-api/prisma/seed lokumu-api/scripts/ingest-cultural.ts lokumu-api/package.json
git rm -f lokumu-api/seed-demo-content.ts
git commit -m "feat: cultural corpus seed and ingest script"
```

---

### Task 6: RAG service — real BGE-M3 embeddings + pgvector search

**Files:**

- Modify: `lokumu-api/src/rag/rag.service.ts`
- Modify: `lokumu-api/src/rag/rag.service.spec.ts`

**Interfaces:**

- Consumes: `normalizeLanguage` from `shared/i18n/languages.ts`
- Produces: `search()` returning `{ id, content, metadata, language, score, community: boolean }[]`
- Produces: `ingestDocument()` writing to `embedding_vec` column

- [ ] **Step 1: Write failing search test**

```typescript
// lokumu-api/src/rag/rag.service.spec.ts
it("returns chunks ordered by similarity score", async () => {
  const results = await service.search({
    query: "mbote salutation",
    language: "lin",
    limit: 3,
  });
  expect(results.length).toBeGreaterThan(0);
  expect(results[0]).toHaveProperty("score");
  expect(results[0].score).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd lokumu-api && npm test -- rag/rag.service.spec.ts`
Expected: FAIL — no score field

- [ ] **Step 3: Implement real embeddings on init**

```typescript
// lokumu-api/src/rag/rag.service.ts — onModuleInit
async onModuleInit() {
  console.log('Loading embedding model...');
  this.featureExtractor = await pipeline('feature-extraction', this.EMBEDDING_MODEL, {
    quantized: false,
  });
  console.log('Embedding model loaded');
}
```

Remove mock hash fallback in production path; keep hash fallback only when `process.env.EMBEDDING_FALLBACK_MOCK === 'true'` for CI without model.

- [ ] **Step 4: Implement vector search**

```typescript
async search({ query, language, limit = 5 }: {
  query: string;
  language?: string;
  limit?: number;
}) {
  const internalLang = language ? normalizeLanguage(language) : undefined;
  const queryEmbedding = await this.generateEmbedding(query);
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;

  const results = await this.prisma.$queryRawUnsafe<
    { id: string; content: string; metadata: unknown; language: string; score: number }[]
  >(
    `SELECT c.id, c.content, c.metadata, c.language,
            1 - (c."embedding_vec" <=> $1::vector) AS score
     FROM "Chunk" c
     WHERE c."embedding_vec" IS NOT NULL
       AND ($2::text IS NULL OR c.language = $2)
     ORDER BY c."embedding_vec" <=> $1::vector
     LIMIT $3`,
    vectorLiteral,
    internalLang ?? null,
    limit,
  );

  const MIN_SCORE = 0.5;
  return results
    .filter((r) => r.score >= MIN_SCORE)
    .map((r) => ({
      ...r,
      community: typeof r.metadata === 'object' &&
        r.metadata !== null &&
        String((r.metadata as any).source ?? '').startsWith('community://'),
    }));
}
```

- [ ] **Step 5: Update ingest to write embedding_vec**

After creating chunk via Prisma, run:

```typescript
await this.prisma.$executeRawUnsafe(
  `UPDATE "Chunk" SET "embedding_vec" = $1::vector WHERE id = $2`,
  `[${chunk.embedding.join(",")}]`,
  chunkId,
);
```

- [ ] **Step 6: Run tests**

Run: `cd lokumu-api && npm test -- rag/rag.service.spec.ts`
Expected: PASS (or skip integration test if no DB in CI — mark with `@jest-environment` note)

- [ ] **Step 7: Commit**

```bash
git add lokumu-api/src/rag
git commit -m "feat(rag): real BGE-M3 embeddings and pgvector search"
```

---

### Task 7: Ollama client & ModelService migration

**Files:**

- Create: `lokumu-api/src/model/ollama.client.ts`
- Create: `lokumu-api/src/model/ollama.client.spec.ts`
- Modify: `lokumu-api/src/model/model.service.ts`
- Modify: `lokumu-api/.env.example`

**Interfaces:**

- Produces: `OllamaClient.chat(messages, { stream, model })` → `AsyncGenerator<string>` or `Promise<string>`
- Produces: `ModelService.generate()` and `ModelService.generateStream()` using Ollama

- [ ] **Step 1: Write failing Ollama client test (mocked fetch)**

```typescript
// lokumu-api/src/model/ollama.client.spec.ts
import { OllamaClient } from "./ollama.client";

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ message: { content: "Mbote!" } }),
}) as jest.Mock;

it("calls Ollama chat API", async () => {
  const client = new OllamaClient("http://localhost:11434");
  const result = await client.chat("qwen3.5", [
    { role: "user", content: "Bonjour" },
  ]);
  expect(result).toBe("Mbote!");
});
```

- [ ] **Step 2: Implement OllamaClient**

```typescript
// lokumu-api/src/model/ollama.client.ts
export class OllamaClient {
  constructor(
    private baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  ) {}

  async chat(
    model: string,
    messages: { role: string; content: string }[],
    options: { temperature?: number; stream?: boolean } = {},
  ): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { temperature: options.temperature ?? 0.7 },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`ollama_unavailable: ${res.status}`);
    const data = await res.json();
    return data.message?.content ?? "";
  }

  async *chatStream(
    model: string,
    messages: { role: string; content: string }[],
  ): AsyncGenerator<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`ollama_unavailable: ${res.status}`);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const parsed = JSON.parse(line);
        if (parsed.message?.content) yield parsed.message.content;
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(7000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async hasModel(name: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/api/tags`);
    if (!res.ok) return false;
    const data = await res.json();
    return (data.models ?? []).some((m: { name: string }) =>
      m.name.startsWith(name),
    );
  }
}
```

- [ ] **Step 3: Refactor ModelService**

```typescript
// lokumu-api/src/model/model.service.ts
@Injectable()
export class ModelService {
  private ollama = new OllamaClient();

  async generate(
    prompt: string,
    options?: { temperature?: number },
  ): Promise<string> {
    const primary = process.env.OLLAMA_MODEL ?? "qwen3.5";
    const fallback = process.env.OLLAMA_FALLBACK_MODEL ?? "deepseek-coder";
    try {
      if (await this.ollama.hasModel(primary)) {
        return await this.ollama.chat(
          primary,
          [{ role: "user", content: prompt }],
          options,
        );
      }
      return await this.ollama.chat(
        fallback,
        [{ role: "user", content: prompt }],
        options,
      );
    } catch (e) {
      throw new Error("ollama_unavailable");
    }
  }

  generateStream(prompt: string): AsyncGenerator<string> {
    const model = process.env.OLLAMA_MODEL ?? "qwen3.5";
    return this.ollama.chatStream(model, [{ role: "user", content: prompt }]);
  }
}
```

- [ ] **Step 4: Run tests**

Run: `cd lokumu-api && npm test -- model/ollama.client.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lokumu-api/src/model lokumu-api/.env.example
git commit -m "feat(model): migrate inference to Ollama HTTP client"
```

---

### Task 8: Cultural router & AssistantService (chat-only demo)

**Files:**

- Create: `lokumu-api/src/assistant/cultural-router.ts`
- Create: `lokumu-api/src/assistant/cultural-router.spec.ts`
- Modify: `lokumu-api/src/assistant/assistant.service.ts`

**Interfaces:**

- Produces: `shouldUseRag(prompt: string): boolean`
- Produces: `AssistantService.processRequest()` → `{ response, sources, messageId, conversationId }`

- [ ] **Step 1: Write failing cultural router test**

```typescript
// lokumu-api/src/assistant/cultural-router.spec.ts
import { shouldUseRag } from "./cultural-router";

it("forces RAG for cultural keywords", () => {
  expect(shouldUseRag("Donne-moi un proverbe lingala")).toBe(true);
  expect(shouldUseRag("Comment dit-on mbote")).toBe(true);
});

it("skips RAG for general chat", () => {
  expect(shouldUseRag("Quel temps fait-il")).toBe(false);
});
```

- [ ] **Step 2: Implement cultural-router**

```typescript
// lokumu-api/src/assistant/cultural-router.ts
const CULTURAL_PATTERNS = [
  /proverbe|ndakisa|salut|mbote|tradition|culture/i,
  /comment dit-on|how do you say|lobi|zola/i,
  /lingala|kituba|lingála/i,
];

export function shouldUseRag(prompt: string): boolean {
  return CULTURAL_PATTERNS.some((p) => p.test(prompt));
}
```

- [ ] **Step 3: Refactor AssistantService for demo (chat only)**

```typescript
// lokumu-api/src/assistant/assistant.service.ts
async processRequest(prompt: string, language?: string) {
  const lang = normalizeLanguage(language);
  let sources: RagSearchResult[] = [];

  if (shouldUseRag(prompt)) {
    sources = await this.ragService.search({ query: prompt, language: lang, limit: 5 });
    // Apply +0.1 community bonus
    sources = sources.map((s) => ({
      ...s,
      score: s.community ? s.score + 0.1 : s.score,
    })).sort((a, b) => b.score - a.score);
  }

  const contextText = sources
    .map((s) => `${s.content} (source: ${(s.metadata as any)?.title ?? 'corpus'})`)
    .join('\n\n');

  const systemPrompt = buildCulturalSystemPrompt(lang);
  const fullPrompt = `${systemPrompt}\n\n${buildRagPrompt(contextText, prompt, lang, '')}`;

  const response = await this.modelService.generate(fullPrompt, { temperature: 0.7 });

  return {
    mode: 'chat' as const,
    response,
    sources: sources.map((s) => ({
      id: s.id,
      title: (s.metadata as any)?.title ?? 'Corpus culturel',
      type: (s.metadata as any)?.type ?? 'cultural',
      community: s.community ?? false,
    })),
  };
}
```

Remove `handleCodeMode` from demo path (keep `mode-detector.ts` file for phase 2 but unused).

- [ ] **Step 4: Run tests**

Run: `cd lokumu-api && npm test -- assistant/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lokumu-api/src/assistant
git commit -m "feat(assistant): cultural RAG routing and chat-only demo mode"
```

---

### Task 9: Community module

**Files:**

- Create: `lokumu-api/src/community/community.module.ts`
- Create: `lokumu-api/src/community/community.service.ts`
- Create: `lokumu-api/src/community/community.controller.ts`
- Create: `lokumu-api/src/community/dto/create-contribution.dto.ts`
- Create: `lokumu-api/src/community/community.service.spec.ts`
- Modify: `lokumu-api/src/app.module.ts`

**Interfaces:**

- Produces: `CommunityService.submit(dto)`, `approve(id)`, `getStats()`
- Consumes: `RagService.ingestDocument`

- [ ] **Step 1: Write failing approve test**

```typescript
// lokumu-api/src/community/community.service.spec.ts
it("approves contribution and sets ingestedAt", async () => {
  const contribution = await service.submit({
    language: "lin",
    originalQuery: "Mbote?",
    originalAnswer: "wrong",
    correctedAnswer: "Mbote !",
  });
  const approved = await service.approve(contribution.id);
  expect(approved.status).toBe("approved");
  expect(approved.ingestedAt).not.toBeNull();
});
```

- [ ] **Step 2: Implement CommunityService**

```typescript
// lokumu-api/src/community/community.service.ts
@Injectable()
export class CommunityService {
  constructor(
    private prisma: PrismaService,
    private rag: RagService,
  ) {}

  async submit(dto: CreateContributionDto) {
    const contribution = await this.prisma.communityContribution.create({
      data: { ...dto, status: "pending" },
    });
    if (process.env.COMMUNITY_AUTO_APPROVE === "true") {
      return this.approve(contribution.id);
    }
    return contribution;
  }

  async approve(id: string) {
    const c = await this.prisma.communityContribution.findUniqueOrThrow({
      where: { id },
    });
    const doc = await this.rag.ingestDocument({
      source: `community://${id}`,
      title: `Correction: ${c.originalQuery.slice(0, 80)}`,
      language: normalizeLanguage(c.language),
      content: `Q: ${c.originalQuery}\nR: ${c.correctedAnswer}\nNote: ${c.contributorNote ?? ""}`,
    });
    const chunkId = doc.chunks?.[0]?.id ?? null;
    return this.prisma.communityContribution.update({
      where: { id },
      data: {
        status: "approved",
        reviewedAt: new Date(),
        ingestedAt: new Date(),
        chunkId,
      },
    });
  }

  async getStats() {
    const [total, approved, pending] = await Promise.all([
      this.prisma.communityContribution.count(),
      this.prisma.communityContribution.count({
        where: { status: "approved" },
      }),
      this.prisma.communityContribution.count({ where: { status: "pending" } }),
    ]);
    return { totalContributions: total, approved, pending };
  }
}
```

- [ ] **Step 3: REST controller**

```typescript
@Controller('community')
export class CommunityController {
  @Post('contributions') submit(@Body() dto: CreateContributionDto) { ... }
  @Patch('contributions/:id/approve') approve(@Param('id') id: string) { ... }
  @Get('stats') stats() { ... }
}
```

- [ ] **Step 4: Register in AppModule**

- [ ] **Step 5: Run tests & commit**

```bash
git add lokumu-api/src/community lokumu-api/src/app.module.ts
git commit -m "feat(community): user corrections with RAG ingest"
```

---

### Task 10: Health endpoint & enriched ChatGateway

**Files:**

- Create: `lokumu-api/src/health/health.module.ts`
- Create: `lokumu-api/src/health/health.controller.ts`
- Modify: `lokumu-api/src/chat/chat.gateway.ts`
- Modify: `lokumu-api/src/app.module.ts`

**Interfaces:**

- Produces: `GET /health` JSON per spec
- Produces: WebSocket `stream` events with `sources`, `messageId`; `contribution:submit` handler

- [ ] **Step 1: Health controller**

```typescript
@Controller("health")
export class HealthController {
  @Get()
  async check() {
    const ollama = await this.ollama.isAvailable();
    let database = false;
    let chunksCount = 0;
    let embeddings = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = true;
      chunksCount = await this.prisma.chunk.count();
      embeddings = !!this.rag.isModelLoaded();
    } catch {}
    const status =
      ollama && database ? (embeddings ? "ok" : "degraded") : "down";
    return { status, ollama, database, embeddings, chunksCount };
  }
}
```

- [ ] **Step 2: Update ChatGateway for Ollama streaming**

```typescript
@SubscribeMessage('message')
async handleMessage(@MessageBody() data: { prompt: string; language?: string }) {
  const result = await this.assistantService.processRequest(data.prompt, data.language);
  for await (const chunk of this.modelService.generateStream(/* prompt */)) {
    this.server.emit('stream', {
      chunk,
      done: false,
      sources: result.sources,
    });
  }
  this.server.emit('stream', { chunk: '', done: true, sources: result.sources });
}

@SubscribeMessage('contribution:submit')
async handleContribution(@MessageBody() dto: CreateContributionDto) {
  const c = await this.communityService.submit(dto);
  this.server.emit('contribution:status', { id: c.id, status: c.status, message: 'Merci !' });
}
```

- [ ] **Step 3: Manual smoke test**

Run API + send WebSocket message; verify `sources` in stream events.

- [ ] **Step 4: Commit**

```bash
git add lokumu-api/src/health lokumu-api/src/chat
git commit -m "feat: health endpoint and enriched chat streaming"
```

---

### Task 11: Tailwind setup & web lib layer

**Files:**

- Create: `lokumu-web/tailwind.config.ts`
- Create: `lokumu-web/postcss.config.js`
- Create: `lokumu-web/src/styles/globals.css`
- Create: `lokumu-web/src/lib/socket.ts`
- Create: `lokumu-web/src/lib/api.ts`
- Modify: `lokumu-web/package.json`
- Modify: `lokumu-web/src/app/layout.tsx`
- Create: `lokumu-web/src/app/page.tsx`

- [ ] **Step 1: Install Tailwind in lokumu-web only**

```bash
cd lokumu-web && npm install -D tailwindcss postcss autoprefixer && npx tailwindcss init -p
```

- [ ] **Step 2: Configure tailwind.config.ts**

```typescript
content: ['./src/**/*.{js,ts,jsx,tsx}'],
theme: {
  extend: {
    colors: {
      lokumu: { primary: '#007FFF', accent: '#F7D618', red: '#CE1126' },
    },
  },
},
```

- [ ] **Step 3: globals.css + layout import**

- [ ] **Step 4: socket.ts singleton**

```typescript
// lokumu-web/src/lib/socket.ts
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:7001");
  }
  return socket;
}
```

- [ ] **Step 5: api.ts**

```typescript
export async function fetchHealth() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`);
  return res.json();
}

export async function fetchCommunityStats() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/community/stats`);
  return res.json();
}
```

- [ ] **Step 6: page.tsx redirect**

```typescript
import { redirect } from "next/navigation";
export default function Home() {
  redirect("/chat");
}
```

- [ ] **Step 7: Commit**

```bash
git add lokumu-web
git commit -m "feat(web): Tailwind setup and lib layer"
```

---

### Task 12: Investor demo UI components

**Files:**

- Create: all files under `lokumu-web/src/components/chat/` and `components/demo/`
- Rewrite: `lokumu-web/src/app/chat/page.tsx`

- [ ] **Step 1: Demo components**

Implement `DemoHeader`, `OfflineBadge` (polls `/health` every 10s), `DisclaimerBanner`, `CommunityStats`.

`OfflineBadge` logic:

- Green: `status === 'ok'`
- Orange: `status === 'degraded'`
- Red: `status === 'down'`

- [ ] **Step 2: Chat components**

`SuggestedQuestions` — chips per language:

```typescript
const SUGGESTIONS: Record<UiLanguage, string[]> = {
  fr: ["Donne-moi un proverbe lingala", "Comment dit-on merci en kituba ?"],
  en: ["Tell me a Lingala proverb", "How do you greet in Kituba?"],
  lin: ["Lobí proverbe moko ya lingala", "Ndenge nini ya kopesa mbote"],
  kit: ["Zola mvutu ya kituta", "Ndenge nini ya kupesa mbote"],
};
```

`MessageBubble` + `SourceCitation` + `CorrectionForm` wired to `contribution:submit`.

- [ ] **Step 3: Compose chat page**

Replace inline styles in `chat/page.tsx` with component tree; remove code mode UI; 4 languages only.

- [ ] **Step 4: Visual check**

Run: `cd lokumu-web && npm run dev`
Open: `http://localhost:7000/chat`
Expected: polished UI, language picker, suggested chips, disclaimer

- [ ] **Step 5: Commit**

```bash
git add lokumu-web/src
git commit -m "feat(web): investor demo chat UI"
```

---

### Task 13: Demo launcher, docs & agent STRUCTURE.md

**Files:**

- Create: `start-demo.sh`
- Modify: `README.md`
- Modify: `lokumu-agent/STRUCTURE.md`
- Modify: `lokumu-api/.env.example`
- Create: `lokumu-web/.env.example` (update)

- [ ] **Step 1: start-demo.sh (bash only, no root npm)**

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

if ! curl -sf http://localhost:11434/api/tags >/dev/null; then
  echo "ERROR: Ollama not running. Start with: ollama serve"
  exit 1
fi

(cd "$ROOT/lokumu-api" && npm run start:dev) &
API_PID=$!
(cd "$ROOT/lokumu-web" && npm run dev) &
WEB_PID=$!

echo "API PID: $API_PID | Web PID: $WEB_PID"
echo "Demo: http://localhost:7000/chat"
wait
```

- [ ] **Step 2: Update README with pre-demo checklist** (from spec section 5.1)

- [ ] **Step 3: Update lokumu-agent/STRUCTURE.md** to match actual tree

- [ ] **Step 4: chmod +x and commit**

```bash
chmod +x start-demo.sh
git add start-demo.sh README.md lokumu-agent/STRUCTURE.md lokumu-api/.env.example lokumu-web/.env.example
git commit -m "docs: demo launcher script and pre-demo checklist"
```

---

### Task 14: Manual E2E verification (Definition of Done)

- [ ] **Step 1: Full offline checklist**

1. Disconnect network (or block outbound)
2. `ollama serve` + `ollama pull qwen3.5`
3. `cd lokumu-api && npx prisma migrate deploy && npm run seed`
4. `./start-demo.sh`
5. Verify offline badge green

- [ ] **Step 2: Demo script walkthrough** (spec 5.2, 8 minutes)

- [ ] **Step 3: Verify DoD items**

| Criterion                  | Pass? |
| -------------------------- | ----- |
| 4 languages, no Swahili    |       |
| ≥ 30 cultural chunks       |       |
| ≥ 3 chips return citations |       |
| Correction flow < 60s      |       |
| CommunityStats visible     |       |
| No root package.json       |       |

- [ ] **Step 4: Final commit if any fixes**

```bash
git commit -m "fix: address E2E demo verification issues"
```

---

## Spec Coverage Checklist

| Spec section               | Task                        |
| -------------------------- | --------------------------- |
| 1.1 No root package.json   | Task 13, Global Constraints |
| 1.2 Rename agent→assistant | Task 1                      |
| 1.2 Remove SWA             | Task 3                      |
| 1.2 Seed relocation        | Task 5                      |
| 1.2 data/cultural/         | Task 5                      |
| 2.1 Corpus format          | Task 5                      |
| 2.3 RAG BGE-M3 + pgvector  | Task 6                      |
| 2.4 Prompts                | Task 3                      |
| 2.6 Ollama                 | Task 7                      |
| 3 Community Memory         | Task 9                      |
| 4 Investor UI              | Tasks 11–12                 |
| 5.1 Pre-demo checklist     | Task 13                     |
| 5.3 Error handling         | Task 10                     |
| 5.6 Definition of Done     | Task 14                     |

## Self-Review Notes

- BGE-M3 dimension corrected to 1024 throughout (spec implied via ARCHITECTURE.md; old code wrongly used 384)
- `embedding_vec` column added alongside legacy `embedding` Bytes to avoid breaking existing Prisma client until ingest migration complete
- Code mode preserved in codebase but not exposed in demo UI (phase 2)
- No root `package.json` — `start-demo.sh` uses bash only
