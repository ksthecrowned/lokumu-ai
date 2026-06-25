# Conversational Lokumu Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve Lokumu from grounded corpus chips into a multi-turn Kituba/Lingala conversational assistant with ~2 000 RAG chunks, LLM reactivation, training dialogue collection UI, and LoRA export pipeline.

**Architecture:** Extend existing NestJS `assistant/`, `rag/`, `model/`, and `community/` modules with `conversation/` and `training/` services. Ingest Eliet (1953) + Kupsala into PostgreSQL/pgvector. Re-enable Ollama with conversation history + adaptive RAG top-k. Collect training dialogues via `/train` UI; export JSONL for external LoRA fine-tuning; import `lokumu-kit-lin` model offline.

**Tech Stack:** NestJS 11, Next.js 14, Prisma 7, PostgreSQL + pgvector, Ollama (`lokumu-kit-lin:latest`, fallback `qwen2.5:7b`), BGE-M3 (`@xenova/transformers`, dim 1024), Socket.IO, Tailwind CSS

## Global Constraints

- Languages: `fra`, `eng`, `lin`, `kit` only — Swahili removed everywhere
- 100% offline at inference: Ollama + PostgreSQL local; no mandatory cloud at runtime
- Fine-tuning runs on external GPU machine; only merged model imported to Ollama offline
- Ollama primary model: `lokumu-kit-lin:latest`; fallback: `qwen2.5:7b`
- `TRAINING_AUTO_APPROVE=true` and `COMMUNITY_AUTO_APPROVE=true` in dev only
- `CONVERSATION_HISTORY_TURNS=10`, `RAG_TOP_K_VAGUE=8`, `RAG_TOP_K_PRECISE=3`
- `OLLAMA_TIMEOUT_MS=120000`
- No root `package.json`, `node_modules`, or npm workspaces at repo root
- BGE-M3 embedding dimension: **1024**
- UI language codes: `fr`/`en`/`lin`/`kit`; internal API/DB: `fra`/`eng`/`lin`/`kit`
- Corpus target at launch: **≥2 000 chunks**
- Training dialogue minimum: 2 turns (one user, one assistant); primary language `kit` or `lin`

---

## File Structure

```
lokumu-ai/
├── data/
│   ├── cultural/
│   │   ├── raw/                          # Eliet HTML download
│   │   ├── processed/eliet-1953/         # Parsed Markdown sections
│   │   └── dialogues/                    # Synthetic JSON dialogue seeds
│   └── training/                         # Generated JSONL (gitignored)
├── models/
│   └── lokumu-kit-lin/
│       ├── Modelfile
│       └── README.md                     # External LoRA training steps
├── lokumu-api/
│   ├── prisma/
│   │   ├── schema.prisma                 # +TrainingDialogue
│   │   └── migrations/.../
│   ├── scripts/
│   │   ├── parse-eliet-html.ts
│   │   ├── generate-corpus-seeds.ts      # dialogues + comparative pairs
│   │   ├── ingest-cultural.ts            # extended for processed MD
│   │   └── export-training-dataset.ts
│   └── src/
│       ├── conversation/
│       │   ├── conversation.module.ts
│       │   ├── conversation.service.ts
│       │   └── conversation.service.spec.ts
│       ├── training/
│       │   ├── training.module.ts
│       │   ├── training.service.ts
│       │   ├── training.controller.ts
│       │   ├── dto/create-training-dialogue.dto.ts
│       │   └── training.service.spec.ts
│       ├── assistant/
│       │   ├── assistant.service.ts      # LLM + memory + fast-path
│       │   ├── cultural-router.ts        # +resolveRagLimit, query classifiers
│       │   ├── prompt-builder.ts         # NEW: system + RAG context assembly
│       │   └── prompt-builder.spec.ts
│       ├── prompts/multilingual.ts       # enriched anti-hallucination prompts
│       ├── model/model.service.ts        # +chatWithHistory
│       └── chat/chat.gateway.ts          # conversationId + training:submit
└── lokumu-web/
    └── src/
        ├── app/train/page.tsx
        ├── components/train/TrainingDialogueForm.tsx
        └── app/chat/page.tsx             # conversationId + save-for-training
```

---

### Task 1: Environment & npm scripts

**Files:**

- Modify: `lokumu-api/.env.example`
- Modify: `lokumu-api/package.json`
- Modify: `lokumu-web/.env.example`

**Interfaces:**

- Produces: npm scripts `parse:eliet`, `corpus:generate`, `training:export`

- [ ] **Step 1: Update `lokumu-api/.env.example`**

Add after existing Ollama vars:

```env
OLLAMA_MODEL=lokumu-kit-lin:latest
OLLAMA_FALLBACK_MODEL=qwen2.5:7b
OLLAMA_TIMEOUT_MS=120000
CONVERSATION_HISTORY_TURNS=10
RAG_TOP_K_VAGUE=8
RAG_TOP_K_PRECISE=3
TRAINING_AUTO_APPROVE=true
DEMO_USER_ID=
```

- [ ] **Step 2: Add npm scripts to `lokumu-api/package.json`**

```json
"parse:eliet": "ts-node scripts/parse-eliet-html.ts",
"corpus:generate": "ts-node scripts/generate-corpus-seeds.ts",
"training:export": "ts-node scripts/export-training-dataset.ts",
"corpus:ingest-all": "npm run parse:eliet && npm run corpus:generate && npm run ingest:cultural"
```

- [ ] **Step 3: Commit**

```bash
git add lokumu-api/.env.example lokumu-api/package.json lokumu-web/.env.example
git commit -m "chore(api): add Phase 2 env vars and corpus scripts"
```

---

### Task 2: `TrainingDialogue` Prisma model

**Files:**

- Modify: `lokumu-api/prisma/schema.prisma`
- Create: migration via `npx prisma migrate dev`

**Interfaces:**

- Produces: `TrainingDialogue` Prisma model with fields from spec §3.2

- [ ] **Step 1: Add model to schema**

```prisma
model TrainingDialogue {
  id              String    @id @default(uuid())
  title           String
  language        String
  turns           Json
  tags            String[]  @default([])
  source          String    @default("community")
  status          String    @default("pending")
  contributorNote String?
  reviewedAt      DateTime?
  exportedAt      DateTime?
  createdAt       DateTime  @default(now())

  @@index([status, language])
  @@index([createdAt])
}
```

- [ ] **Step 2: Run migration**

Run: `cd lokumu-api && npx prisma migrate dev --name training_dialogue`
Expected: migration SQL created and applied

- [ ] **Step 3: Commit**

```bash
git add lokumu-api/prisma/
git commit -m "feat(api): add TrainingDialogue schema"
```

---

### Task 3: `ConversationService` — multi-turn persistence

**Files:**

- Create: `lokumu-api/src/conversation/conversation.module.ts`
- Create: `lokumu-api/src/conversation/conversation.service.ts`
- Create: `lokumu-api/src/conversation/conversation.service.spec.ts`
- Modify: `lokumu-api/src/app.module.ts`

**Interfaces:**

- Consumes: Prisma `Conversation`, `ChatMessage`, `User`
- Produces:
  - `getOrCreateDemoUser(): Promise<string>`
  - `resolveConversation(conversationId: string | undefined, language: string): Promise<{ id: string; isNew: boolean }>`
  - `appendMessage(conversationId: string, role: 'user' | 'assistant', content: string, language: string, usedChunkIds?: string[]): Promise<string>`
  - `getRecentHistory(conversationId: string, limit: number): Promise<Array<{ role: string; content: string }>>`
  - `maybeSetTitle(conversationId: string, firstUserPrompt: string): Promise<void>`

- [ ] **Step 1: Write failing test**

```typescript
// lokumu-api/src/conversation/conversation.service.spec.ts
import { ConversationService } from './conversation.service';

describe('ConversationService', () => {
  const prisma = {
    user: { upsert: jest.fn().mockResolvedValue({ id: 'demo-user-1' }) },
    conversation: {
      create: jest.fn().mockResolvedValue({ id: 'conv-1' }),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    chatMessage: {
      create: jest.fn().mockResolvedValue({ id: 'msg-1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  it('creates a new conversation when id is missing', async () => {
    const service = new ConversationService(prisma as any);
    const result = await service.resolveConversation(undefined, 'kit');
    expect(result.isNew).toBe(true);
    expect(prisma.conversation.create).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd lokumu-api && npm test -- conversation.service.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `ConversationService`**

```typescript
// lokumu-api/src/conversation/conversation.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeLanguage } from '../shared/i18n/languages';

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateDemoUser(): Promise<string> {
    const email = 'demo@lokumu.local';
    const user = await this.prisma.user.upsert({
      where: { email },
      create: { email, language: 'fr' },
      update: {},
    });
    return user.id;
  }

  async resolveConversation(
    conversationId: string | undefined,
    language: string,
  ): Promise<{ id: string; isNew: boolean }> {
    if (conversationId) {
      const existing = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      if (existing) return { id: existing.id, isNew: false };
    }

    const userId = await this.getOrCreateDemoUser();
    const created = await this.prisma.conversation.create({
      data: {
        userId,
        language: normalizeLanguage(language),
      },
    });
    return { id: created.id, isNew: true };
  }

  async appendMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    language: string,
    usedChunkIds: string[] = [],
  ): Promise<string> {
    const message = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        role,
        content,
        language: normalizeLanguage(language),
        usedChunkIds,
      },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return message.id;
  }

  async getRecentHistory(
    conversationId: string,
    limit: number,
  ): Promise<Array<{ role: string; content: string }>> {
    const rows = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    return rows.reverse().map((row) => ({
      role: row.role,
      content: row.content,
    }));
  }

  async maybeSetTitle(conversationId: string, firstUserPrompt: string): Promise<void> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv || conv.title !== 'Nouvelle conversation') return;
    const title = firstUserPrompt.trim().slice(0, 60) || 'Conversation';
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
    });
  }
}
```

```typescript
// lokumu-api/src/conversation/conversation.module.ts
import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';

@Module({
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
```

- [ ] **Step 4: Register in `app.module.ts`**

```typescript
import { ConversationModule } from './conversation/conversation.module';

@Module({
  imports: [/* existing */, ConversationModule],
})
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `cd lokumu-api && npm test -- conversation.service.spec.ts`

- [ ] **Step 6: Commit**

```bash
git add lokumu-api/src/conversation lokumu-api/src/app.module.ts
git commit -m "feat(api): add ConversationService for multi-turn history"
```

---

### Task 4: Adaptive RAG top-k & metadata reranking

**Files:**

- Modify: `lokumu-api/src/assistant/cultural-router.ts`
- Modify: `lokumu-api/src/assistant/cultural-router.spec.ts`
- Modify: `lokumu-api/src/rag/rag.service.ts`

**Interfaces:**

- Produces:
  - `classifyQueryIntent(prompt: string): 'greeting' | 'translation' | 'grammar' | 'proverb' | 'general'`
  - `resolveRagLimit(prompt: string): number`
  - `RagService.rerankByMetadata(results, intent): RagSearchResult[]`

- [ ] **Step 1: Write failing tests**

```typescript
// cultural-router.spec.ts additions
import { classifyQueryIntent, resolveRagLimit } from './cultural-router';

it('classifies greeting queries', () => {
  expect(classifyQueryIntent('Mbote, ozali malamu?')).toBe('greeting');
});

it('uses vague top-k for greetings', () => {
  expect(resolveRagLimit('bonjour')).toBe(8);
});

it('uses precise top-k for grammar', () => {
  expect(resolveRagLimit('conjugaison du verbe être en kituba')).toBe(3);
});
```

- [ ] **Step 2: Implement in `cultural-router.ts`**

```typescript
export type QueryIntent =
  | 'greeting'
  | 'translation'
  | 'grammar'
  | 'proverb'
  | 'general';

export function classifyQueryIntent(prompt: string): QueryIntent {
  if (isSimpleGreetingQuery(prompt) || /mbote|salut|hello|kimia/i.test(prompt)) {
    return 'greeting';
  }
  if (isTranslationQuery(prompt)) return 'translation';
  if (/conjugaison|grammar|grammaire|verbe|pronom/i.test(prompt)) return 'grammar';
  if (isProverbQuery(prompt)) return 'proverb';
  return 'general';
}

export function resolveRagLimit(prompt: string): number {
  const vague = Number(process.env.RAG_TOP_K_VAGUE ?? 8);
  const precise = Number(process.env.RAG_TOP_K_PRECISE ?? 3);
  const intent = classifyQueryIntent(prompt);
  if (intent === 'greeting') return vague;
  if (intent === 'grammar' || intent === 'translation') return precise;
  if (intent === 'proverb') return 5;
  return 5;
}
```

- [ ] **Step 3: Add reranking to `rag.service.ts`**

```typescript
rerankByMetadata(
  results: RagSearchResult[],
  intent: string,
): RagSearchResult[] {
  const typeBoost: Record<string, string[]> = {
    greeting: ['dialogue_example', 'greeting'],
    translation: ['lexicon', 'grammar', 'comparative'],
    grammar: ['grammar'],
    proverb: ['proverb', 'cultural_note'],
    general: ['dialogue_example', 'lexicon'],
  };
  const preferred = typeBoost[intent] ?? [];
  return [...results].sort((a, b) => {
    const aType = String((a.metadata as Record<string, unknown>)?.type ?? '');
    const bType = String((b.metadata as Record<string, unknown>)?.type ?? '');
    const aBoost = preferred.includes(aType) ? 0.15 : 0;
    const bBoost = preferred.includes(bType) ? 0.15 : 0;
    return b.score + bBoost - (a.score + aBoost);
  });
}
```

Call `rerankByMetadata` at end of `search()` before returning.

- [ ] **Step 4: Run tests**

Run: `cd lokumu-api && npm test -- cultural-router.spec.ts rag.service.spec.ts`

- [ ] **Step 5: Commit**

```bash
git add lokumu-api/src/assistant/cultural-router.ts lokumu-api/src/assistant/cultural-router.spec.ts lokumu-api/src/rag/rag.service.ts
git commit -m "feat(api): adaptive RAG top-k and metadata reranking"
```

---

### Task 5: Parse Eliet HTML → structured Markdown

**Files:**

- Create: `lokumu-api/scripts/parse-eliet-html.ts`
- Create: `lokumu-api/scripts/parse-eliet-html.spec.ts`
- Create: `data/cultural/raw/.gitkeep`
- Create: `data/cultural/processed/eliet-1953/.gitkeep`

**Interfaces:**

- Produces: `parseElietHtml(html: string): ParsedSection[]` where `ParsedSection = { slug, title, content, type, section }`
- Input default: `data/cultural/raw/monokotuba.html` (copy from uploads or curl kupsala)
- Output: `data/cultural/processed/eliet-1953/*.md` with YAML frontmatter

- [ ] **Step 1: Write failing test**

```typescript
// lokumu-api/scripts/parse-eliet-html.spec.ts
import { parseElietHtml, inferSectionType } from './parse-eliet-html';

const SAMPLE = `
<h2>Les pronoms</h2>
<p>Monokotuba: mono, lingala: ngai.</p>
<h2>Lexique des termes usuels</h2>
<p>mbote = bonjour</p>
`;

it('splits HTML by h2 sections', () => {
  const sections = parseElietHtml(SAMPLE);
  expect(sections.length).toBe(2);
  expect(sections[0].title).toMatch(/pronoms/i);
});

it('marks lexicon sections', () => {
  expect(inferSectionType('Lexique des termes usuels')).toBe('lexicon');
});
```

- [ ] **Step 2: Implement parser**

```typescript
// lokumu-api/scripts/parse-eliet-html.ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export type ParsedSection = {
  slug: string;
  title: string;
  content: string;
  type: 'grammar' | 'lexicon' | 'cultural_note';
  section: string;
};

export function inferSectionType(title: string): ParsedSection['type'] {
  if (/lexique|vocabulaire/i.test(title)) return 'lexicon';
  return 'grammar';
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function parseElietHtml(html: string): ParsedSection[] {
  const cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  const parts = cleaned.split(/<h2[^>]*>/i).slice(1);
  return parts.map((part) => {
    const titleMatch = part.match(/^([^<]+)/i);
    const title = (titleMatch?.[1] ?? 'section').trim();
    const body = part.replace(/^[^<]+<\/h2>/i, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const section = slugify(title);
    return {
      slug: section,
      title,
      content: body,
      type: inferSectionType(title),
      section,
    };
  }).filter((s) => s.content.length > 40);
}

async function main() {
  const input = resolve(process.argv[2] ?? '../data/cultural/raw/monokotuba.html');
  const outDir = resolve('../data/cultural/processed/eliet-1953');
  await mkdir(outDir, { recursive: true });
  const html = await readFile(input, 'utf8');
  const sections = parseElietHtml(html);
  for (const section of sections) {
    const frontmatter = `---\ntype: ${section.type}\nlanguages: [kit, lin]\nsection: ${section.section}\nsource: eliet-1953://${section.section}\n---\n`;
    await writeFile(join(outDir, `${section.slug}.md`), `${frontmatter}\n# ${section.title}\n\n${section.content}\n`);
  }
  console.log(`Wrote ${sections.length} sections to ${outDir}`);
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 3: Copy Eliet HTML to raw**

Run: `mkdir -p data/cultural/raw && cp uploads/monokotuba-1.html data/cultural/raw/monokotuba.html` (or download from kupsala)

- [ ] **Step 4: Run parser**

Run: `cd lokumu-api && npm run parse:eliet`
Expected: `Wrote N sections` where N ≥ 20

- [ ] **Step 5: Run tests**

Run: `cd lokumu-api && npx jest scripts/parse-eliet-html.spec.ts --config '{"testEnvironment":"node","transform":{"^.+\\.ts$":"ts-jest"}}'`

- [ ] **Step 6: Commit**

```bash
git add lokumu-api/scripts/parse-eliet-html.ts lokumu-api/scripts/parse-eliet-html.spec.ts data/cultural/
git commit -m "feat(corpus): parse Eliet 1953 HTML into structured Markdown"
```

---

### Task 6: Generate synthetic dialogues & comparative pairs

**Files:**

- Create: `lokumu-api/scripts/generate-corpus-seeds.ts`
- Create: `data/cultural/dialogues/greetings-kit.json`
- Create: `data/cultural/dialogues/greetings-lin.json`
- Create: `data/cultural/dialogues/comparative-pairs.json`

**Interfaces:**

- Produces: JSON files matching `CulturalEntry` shape with `type: 'dialogue_example' | 'comparative'`

- [ ] **Step 1: Create seed JSON files**

```json
// data/cultural/dialogues/greetings-kit.json
[
  {
    "id": "dialogue-kit-greeting-001",
    "type": "dialogue_example",
    "language": "kit",
    "title": "Salutation matinale kituba",
    "content": "User: Mbote, ozali malamu?\nAssistant: Mbote! Ee, nazali malamu. Na yo?",
    "translation_fr": "Bonjour, ça va ? — Bonjour ! Oui, je vais bien. Et toi ?",
    "tags": ["greeting", "beginner"],
    "source": "synthetic://dialogue-kit-greeting-001"
  }
]
```

Create at least 20 kituba dialogues, 20 lingala dialogues, 50 comparative pairs in separate JSON files.

- [ ] **Step 2: Implement generator script**

```typescript
// lokumu-api/scripts/generate-corpus-seeds.ts
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

async function main() {
  const dir = resolve('../data/cultural/dialogues');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  let total = 0;
  for (const file of files) {
    const entries = JSON.parse(await readFile(join(dir, file), 'utf8'));
    total += Array.isArray(entries) ? entries.length : 1;
  }
  console.log(`Dialogue seed files: ${files.length}, entries: ${total}`);
}

main();
```

- [ ] **Step 3: Commit seed files**

```bash
git add data/cultural/dialogues lokumu-api/scripts/generate-corpus-seeds.ts
git commit -m "feat(corpus): add synthetic Kituba/Lingala dialogue seeds"
```

---

### Task 7: Extend ingest pipeline for processed Markdown + frontmatter

**Files:**

- Modify: `lokumu-api/scripts/ingest-cultural.ts`

**Interfaces:**

- Consumes: `data/cultural/processed/eliet-1953/*.md` with YAML frontmatter
- Produces: ingested chunks with metadata `{ type, languages, section, source }`

- [ ] **Step 1: Add frontmatter parser and lexicon splitter**

```typescript
function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
  if (!raw.startsWith('---\n')) return { meta: {}, body: raw };
  const end = raw.indexOf('\n---\n', 4);
  if (end === -1) return { meta: {}, body: raw };
  const header = raw.slice(4, end);
  const body = raw.slice(end + 5);
  const meta: Record<string, unknown> = {};
  for (const line of header.split('\n')) {
    const [key, ...rest] = line.split(':');
    if (!key || rest.length === 0) continue;
    meta[key.trim()] = rest.join(':').trim();
  }
  return { meta, body };
}

function splitLexiconEntries(body: string): string[] {
  return body.split(/(?<=[.;])\s+/).filter((s) => s.trim().length > 20);
}
```

For `type: lexicon` files, ingest one chunk per sentence/entry. For grammar, one file = one chunk unless body > 800 tokens (split on paragraph boundaries).

- [ ] **Step 2: Walk processed directory in `loadEntries`**

Add after existing file loop:

```typescript
const processedDir = join(inputDir, 'processed', 'eliet-1953');
// readdir + parse .md with frontmatter → CulturalEntry[]
```

- [ ] **Step 3: Run full ingest**

Run: `cd lokumu-api && npm run corpus:ingest-all`
Expected: hundreds of chunks ingested; log `Ingested: ...` lines

- [ ] **Step 4: Commit**

```bash
git add lokumu-api/scripts/ingest-cultural.ts
git commit -m "feat(corpus): ingest processed Eliet Markdown with metadata"
```

---

### Task 8: Training module (backend)

**Files:**

- Create: `lokumu-api/src/training/dto/create-training-dialogue.dto.ts`
- Create: `lokumu-api/src/training/training.service.ts`
- Create: `lokumu-api/src/training/training.service.spec.ts`
- Create: `lokumu-api/src/training/training.controller.ts`
- Create: `lokumu-api/src/training/training.module.ts`
- Modify: `lokumu-api/src/chat/chat.gateway.ts`
- Modify: `lokumu-api/src/chat/chat.module.ts`
- Modify: `lokumu-api/src/app.module.ts`

**Interfaces:**

- Produces:
  - `TrainingService.submit(dto): Promise<TrainingDialogue>`
  - `TrainingService.approve(id): Promise<TrainingDialogue>`
  - `TrainingService.list(status?: string): Promise<TrainingDialogue[]>`
  - WebSocket event `training:submit` → `training:status`

- [ ] **Step 1: Write failing test**

```typescript
it('rejects dialogues with fewer than 2 turns', async () => {
  await expect(
    service.submit({
      title: 'Bad',
      language: 'kit',
      turns: [{ role: 'user', content: 'Mbote' }],
    }),
  ).rejects.toThrow('minimum_2_turns');
});
```

- [ ] **Step 2: Implement DTO and service**

```typescript
// create-training-dialogue.dto.ts
export type TrainingTurn = { role: 'user' | 'assistant'; content: string };

export class CreateTrainingDialogueDto {
  title!: string;
  language!: 'lin' | 'kit';
  turns!: TrainingTurn[];
  tags?: string[];
  contributorNote?: string;
}
```

```typescript
// training.service.ts — validate turns, auto-approve if TRAINING_AUTO_APPROVE=true
async submit(dto: CreateTrainingDialogueDto) {
  if (!dto.turns || dto.turns.length < 2) throw new Error('minimum_2_turns');
  const hasUser = dto.turns.some((t) => t.role === 'user');
  const hasAssistant = dto.turns.some((t) => t.role === 'assistant');
  if (!hasUser || !hasAssistant) throw new Error('requires_user_and_assistant');

  const dialogue = await this.prisma.trainingDialogue.create({
    data: {
      title: dto.title,
      language: dto.language,
      turns: dto.turns,
      tags: dto.tags ?? [],
      contributorNote: dto.contributorNote,
      status: 'pending',
    },
  });

  if (process.env.TRAINING_AUTO_APPROVE === 'true') {
    return this.approve(dialogue.id);
  }
  return dialogue;
}

async approve(id: string) {
  return this.prisma.trainingDialogue.update({
    where: { id },
    data: { status: 'approved', reviewedAt: new Date() },
  });
}
```

- [ ] **Step 3: Add REST controller and WebSocket handler**

```typescript
// training.controller.ts
@Controller('training/dialogues')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Post()
  submit(@Body() dto: CreateTrainingDialogueDto) {
    return this.trainingService.submit(dto);
  }

  @Get()
  list(@Query('status') status?: string) {
    return this.trainingService.list(status);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.trainingService.approve(id);
  }
}
```

```typescript
// chat.gateway.ts addition
@SubscribeMessage('training:submit')
async handleTrainingSubmit(@ConnectedSocket() client: Socket, @MessageBody() dto: CreateTrainingDialogueDto) {
  const dialogue = await this.trainingService.submit(dto);
  client.emit('training:status', { id: dialogue.id, status: dialogue.status });
  return dialogue;
}
```

- [ ] **Step 4: Run tests and commit**

Run: `cd lokumu-api && npm test -- training.service.spec.ts`

```bash
git add lokumu-api/src/training lokumu-api/src/chat lokumu-api/src/app.module.ts
git commit -m "feat(api): add training dialogue submission and approval"
```

---

### Task 9: Export training dataset to JSONL

**Files:**

- Create: `lokumu-api/scripts/export-training-dataset.ts`
- Create: `data/training/.gitignore` with `*.jsonl`

**Interfaces:**

- Produces: `data/training/lokumu-kit-lin.jsonl`
- Consumes: approved `TrainingDialogue` rows + `getSystemPrompt(language)` from multilingual.ts

- [ ] **Step 1: Implement export script**

```typescript
import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { getSystemPrompt } from '../src/prompts/multilingual';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
  const rows = await prisma.trainingDialogue.findMany({ where: { status: 'approved' } });
  const lines: string[] = [];

  for (const row of rows) {
    const turns = row.turns as Array<{ role: string; content: string }>;
    const messages = [
      { role: 'system', content: getSystemPrompt(row.language) },
      ...turns.map((t) => ({ role: t.role, content: t.content })),
    ];
    lines.push(JSON.stringify({ messages, language: row.language }));
  }

  const outPath = resolve('../data/training/lokumu-kit-lin.jsonl');
  await mkdir(resolve('../data/training'), { recursive: true });
  await writeFile(outPath, lines.join('\n') + '\n');

  await prisma.trainingDialogue.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { status: 'exported', exportedAt: new Date() },
  });

  console.log(`Exported ${lines.length} dialogues to ${outPath}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run export (after seeding a test dialogue)**

Run: `cd lokumu-api && npm run training:export`

- [ ] **Step 3: Commit**

```bash
git add lokumu-api/scripts/export-training-dataset.ts data/training/.gitignore
git commit -m "feat(training): export approved dialogues to LoRA JSONL"
```

---

### Task 10: `ModelService.chatWithHistory`

**Files:**

- Modify: `lokumu-api/src/model/model.service.ts`
- Modify: `lokumu-api/src/model/model.service.spec.ts`

**Interfaces:**

- Produces:
  - `chatWithHistory(messages: OllamaMessage[], options?): Promise<string>`
  - `chatWithHistoryStream(messages: OllamaMessage[], options?): AsyncGenerator<string>`

- [ ] **Step 1: Write failing test**

```typescript
it('chatWithHistory sends full message array to Ollama', async () => {
  const ollama = { hasModel: jest.fn().mockResolvedValue(true), chat: jest.fn().mockResolvedValue('Mbote!') };
  const service = new ModelService();
  (service as any).ollama = ollama;
  const result = await service.chatWithHistory([
    { role: 'system', content: 'Tu es Lokumu' },
    { role: 'user', content: 'Mbote' },
  ]);
  expect(result).toBe('Mbote!');
  expect(ollama.chat).toHaveBeenCalled();
});
```

- [ ] **Step 2: Implement**

```typescript
async chatWithHistory(
  messages: OllamaMessage[],
  options: { temperature?: number; model?: string } = {},
): Promise<string> {
  const model = await this.resolveModel(options.model);
  try {
    return await this.ollama.chat(model, messages, { temperature: options.temperature ?? 0.7 });
  } catch (error) {
    if (this.isTimeoutError(error) && model !== this.fallbackModel && (await this.ollama.hasModel(this.fallbackModel))) {
      return await this.ollama.chat(this.fallbackModel, messages, { temperature: options.temperature ?? 0.7 });
    }
    throw new Error('ollama_unavailable');
  }
}
```

- [ ] **Step 3: Run tests and commit**

Run: `cd lokumu-api && npm test -- model.service.spec.ts`

```bash
git add lokumu-api/src/model/model.service.ts lokumu-api/src/model/model.service.spec.ts
git commit -m "feat(model): add chatWithHistory for multi-turn Ollama calls"
```

---

### Task 11: Prompt builder & enriched system prompts

**Files:**

- Create: `lokumu-api/src/assistant/prompt-builder.ts`
- Create: `lokumu-api/src/assistant/prompt-builder.spec.ts`
- Modify: `lokumu-api/src/prompts/multilingual.ts`

**Interfaces:**

- Produces:
  - `buildConversationalSystemPrompt(language: InternalLanguage): string`
  - `formatRagContext(chunks: RagSearchResult[]): string`
  - `buildOllamaMessages(params): OllamaMessage[]`

- [ ] **Step 1: Enrich system prompts in `multilingual.ts`**

Add to each prompt (example for `kit`):

```typescript
kit: `Wewe ni Lokumu, muntu ya AI ya Kongo. Sungula na kituba to lingala na ndenge ya polele.
Soki question ezali na ndima ya liziba (traduction, grammaire, proverb), tala [CONTEXTE] kaka.
Soki ozui te na contexte, koloba "nazui te" — kobula kosala ba réponse ya lokuta.
Kobula kosalela markdown **. Sungula na ndenge ya conversation.`,
```

Mirror for `lin`, `fra`, `eng`.

- [ ] **Step 2: Implement prompt-builder**

```typescript
export function formatRagContext(chunks: RagSearchResult[]): string {
  if (chunks.length === 0) return '';
  const blocks = chunks.map((c, i) => {
    const meta = c.metadata as Record<string, unknown>;
    const source = String(meta.source ?? `chunk-${c.id}`);
    return `[${i + 1}] (source: ${source})\n${c.content}`;
  });
  return `[CONTEXTE]\n${blocks.join('\n\n')}\n[/CONTEXTE]`;
}

export function buildOllamaMessages(input: {
  language: InternalLanguage;
  history: Array<{ role: string; content: string }>;
  ragContext: string;
  userPrompt: string;
}): OllamaMessage[] {
  const system = getSystemPrompt(input.language);
  const messages: OllamaMessage[] = [{ role: 'system', content: system }];
  if (input.ragContext) {
    messages.push({ role: 'system', content: input.ragContext });
  }
  for (const turn of input.history) {
    if (turn.role === 'user' || turn.role === 'assistant') {
      messages.push({ role: turn.role, content: turn.content });
    }
  }
  messages.push({ role: 'user', content: input.userPrompt });
  return messages;
}
```

- [ ] **Step 3: Tests and commit**

Run: `cd lokumu-api && npm test -- prompt-builder.spec.ts`

```bash
git add lokumu-api/src/assistant/prompt-builder.ts lokumu-api/src/prompts/multilingual.ts
git commit -m "feat(assistant): add conversational prompt builder with RAG context"
```

---

### Task 12: Reactivate LLM in `AssistantService`

**Files:**

- Modify: `lokumu-api/src/assistant/assistant.service.ts`
- Modify: `lokumu-api/src/assistant/assistant.module.ts`
- Modify: `lokumu-api/src/assistant/assistant.service.spec.ts`

**Interfaces:**

- Consumes: `ConversationService`, `ModelService`, `RagService`, `buildGroundedResponse`, `buildOllamaMessages`, `resolveRagLimit`, `classifyQueryIntent`
- Produces: updated `processRequest(prompt, language, conversationId?)` with LLM path

- [ ] **Step 1: Write failing integration test (mocked model)**

```typescript
it('calls ModelService for non-fast-path queries', async () => {
  const modelService = { chatWithHistory: jest.fn().mockResolvedValue('Mbote! Nazali malamu.') };
  const conversationService = {
    resolveConversation: jest.fn().mockResolvedValue({ id: 'c1', isNew: true }),
    appendMessage: jest.fn().mockResolvedValue('m1'),
    getRecentHistory: jest.fn().mockResolvedValue([]),
    maybeSetTitle: jest.fn(),
  };
  // ... construct AssistantService with mocks
  const result = await service.processRequest('Parle-moi de la culture congolaise', 'fra', 'c1');
  expect(modelService.chatWithHistory).toHaveBeenCalled();
  expect(result.response).toContain('Mbote');
});
```

- [ ] **Step 2: Implement LLM path in `processRequest`**

```typescript
async processRequest(prompt: string, language?: string, conversationId?: string) {
  const lang = normalizeLanguage(language);
  const { id: convId, isNew } = await this.conversationService.resolveConversation(conversationId, lang);
  await this.conversationService.appendMessage(convId, 'user', prompt, lang);
  if (isNew) await this.conversationService.maybeSetTitle(convId, prompt);

  const limit = resolveRagLimit(prompt);
  const searchLanguage = resolveSearchLanguage(prompt, lang);
  const rawMatches = await this.ragService.search({ query: prompt, language: searchLanguage, limit });
  const intent = classifyQueryIntent(prompt);
  const sources = this.dedupeSources(this.ragService.rerankByMetadata(rawMatches, intent));

  const top = sources[0];
  if (top && top.score >= 0.85) {
    const grounded = buildGroundedResponse(sources, prompt, lang);
    if (grounded) {
      const messageId = await this.conversationService.appendMessage(convId, 'assistant', grounded.response, lang, [top.id]);
      return this.formatResult(grounded.response, [top], convId, messageId);
    }
  }

  const history = await this.conversationService.getRecentHistory(
    convId,
    Number(process.env.CONVERSATION_HISTORY_TURNS ?? 10),
  );
  const ragContext = formatRagContext(sources.slice(0, limit));
  const messages = buildOllamaMessages({ language: lang, history, ragContext, userPrompt: prompt });

  let response: string;
  try {
    response = await this.modelService.chatWithHistory(messages);
  } catch {
    response = buildDemoFallbackResponse(lang, prompt);
  }

  const messageId = await this.conversationService.appendMessage(
    convId,
    'assistant',
    response,
    lang,
    sources.slice(0, 3).map((s) => s.id),
  );

  return this.formatResult(response, sources.slice(0, 3), convId, messageId);
}
```

- [ ] **Step 3: Update `assistant.module.ts` imports**

```typescript
imports: [RagModule, ModelModule, ConversationModule],
```

- [ ] **Step 4: Run tests**

Run: `cd lokumu-api && npm test -- assistant.service.spec.ts`

- [ ] **Step 5: Commit**

```bash
git add lokumu-api/src/assistant/
git commit -m "feat(assistant): reactivate LLM with RAG context and conversation memory"
```

---

### Task 13: Wire `conversationId` through WebSocket & chat UI

**Files:**

- Modify: `lokumu-api/src/chat/chat.gateway.ts`
- Modify: `lokumu-web/src/app/chat/page.tsx`

**Interfaces:**

- Client sends `{ prompt, language, conversationId? }`
- Server returns stable `conversationId` across turns

- [ ] **Step 1: Update gateway message handler**

```typescript
@MessageBody() data: { prompt: string; language?: string; conversationId?: string }

const result = await this.assistantService.processRequest(
  data.prompt,
  data.language,
  data.conversationId,
);
```

- [ ] **Step 2: Persist conversationId in chat page**

```typescript
const conversationIdRef = useRef<string | undefined>(undefined);

socketRef.current.emit("message", {
  prompt: nextPrompt,
  language: toInternalLanguage(language),
  conversationId: conversationIdRef.current,
});

// in onStream when payload.conversationId arrives:
if (payload.conversationId) {
  conversationIdRef.current = payload.conversationId;
}
```

- [ ] **Step 3: Manual smoke test**

Run demo, send 3 messages in a row, verify same `conversationId` in network payloads.

- [ ] **Step 4: Commit**

```bash
git add lokumu-api/src/chat/chat.gateway.ts lokumu-web/src/app/chat/page.tsx
git commit -m "feat(chat): persist conversationId across multi-turn messages"
```

---

### Task 14: Training UI — `/train` page (manual entry)

**Files:**

- Create: `lokumu-web/src/app/train/page.tsx`
- Create: `lokumu-web/src/components/train/TrainingDialogueForm.tsx`
- Modify: `lokumu-web/src/components/demo/DemoHeader.tsx` (link to /train)

**Interfaces:**

- Consumes: WebSocket `training:submit` or REST `POST /training/dialogues`
- Produces: form with title, language (kit/lin), dynamic turns, tags, submit

- [ ] **Step 1: Build `TrainingDialogueForm`**

```tsx
"use client";

type Turn = { role: "user" | "assistant"; content: string };

export function TrainingDialogueForm({ onSubmit }: { onSubmit: (payload: unknown) => void }) {
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<"kit" | "lin">("kit");
  const [turns, setTurns] = useState<Turn[]>([
    { role: "user", content: "" },
    { role: "assistant", content: "" },
  ]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ title, language, turns }); }}>
      {/* title input, language radio, turn editors, + Ajouter un tour button */}
    </form>
  );
}
```

- [ ] **Step 2: Create `/train` page with status notice**

Submit via socket:

```typescript
socket.emit("training:submit", payload);
socket.on("training:status", (p) => setNotice(p.status === "approved" ? "Dialogue approuvé." : "En attente."));
```

- [ ] **Step 3: Add nav link in DemoHeader**

```tsx
<Link href="/train">Entraînement</Link>
```

- [ ] **Step 4: Commit**

```bash
git add lokumu-web/src/app/train lokumu-web/src/components/train lokumu-web/src/components/demo/DemoHeader.tsx
git commit -m "feat(web): add /train page for training dialogue submission"
```

---

### Task 15: Save conversation for training (from chat)

**Files:**

- Modify: `lokumu-web/src/app/chat/page.tsx`
- Create: `lokumu-web/src/components/train/SaveForTrainingButton.tsx`

**Interfaces:**

- Pre-fills `TrainingDialogueForm` in a modal/drawer from current `messages` state

- [ ] **Step 1: Add button visible when ≥2 messages exist**

```tsx
function SaveForTrainingButton({ messages, language }: { messages: MessageState[]; language: UiLanguage }) {
  const [open, setOpen] = useState(false);
  const turns = messages
    .filter((m) => m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }));

  if (turns.length < 2) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Enregistrer pour l'entraînement</button>
      {open && (
        <TrainingDialogueForm
          initial={{ title: "Conversation chat", language: language === "lin" ? "lin" : "kit", turns }}
          onSubmit={(payload) => { socket.emit("training:submit", payload); setOpen(false); }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Place button below ChatWindow**

- [ ] **Step 3: Commit**

```bash
git add lokumu-web/src/app/chat/page.tsx lokumu-web/src/components/train/SaveForTrainingButton.tsx
git commit -m "feat(web): save chat thread as training dialogue"
```

---

### Task 16: Ollama Modelfile & external LoRA documentation

**Files:**

- Create: `models/lokumu-kit-lin/Modelfile`
- Create: `models/lokumu-kit-lin/README.md`

- [ ] **Step 1: Create Modelfile (base until LoRA merged)**

```
FROM qwen2.5:7b

PARAMETER temperature 0.7
PARAMETER num_ctx 8192

SYSTEM """
Tu es Lokumu, assistant culturel et linguistique congolais.
Tu parles kituba, lingala, français et anglais.
Pour les faits linguistiques, reste fidèle au contexte fourni.
"""
```

- [ ] **Step 2: Document external LoRA workflow in README**

Include steps:
1. `npm run training:export` on lokumu-api machine
2. Copy `data/training/lokumu-kit-lin.jsonl` to GPU machine
3. Fine-tune with LLaMA-Factory or Unsloth on `qwen2.5:7b`
4. Merge adapter → export GGUF
5. Update Modelfile `FROM` path
6. `ollama create lokumu-kit-lin -f Modelfile` on demo machine

- [ ] **Step 3: Commit**

```bash
git add models/lokumu-kit-lin/
git commit -m "docs(models): add Modelfile and external LoRA training guide"
```

---

### Task 17: Corpus volume verification (≥2 000 chunks)

**Files:**

- Create: `lokumu-api/scripts/count-corpus-chunks.ts`

- [ ] **Step 1: Add chunk counter script**

```typescript
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
  const count = await prisma.chunk.count();
  console.log(`Total chunks: ${count}`);
  if (count < 2000) {
    console.warn(`WARNING: below target of 2000 (current: ${count})`);
    process.exitCode = 1;
  }
  await prisma.$disconnect();
}
main();
```

- [ ] **Step 2: Run full pipeline**

```bash
cd lokumu-api
npm run corpus:ingest-all
npx ts-node scripts/count-corpus-chunks.ts
```

If below 2000: expand `data/cultural/dialogues/comparative-pairs.json` and/or split Kupsala word list into additional JSON entries, re-ingest until ≥2000.

- [ ] **Step 3: Commit counter script**

```bash
git add lokumu-api/scripts/count-corpus-chunks.ts
git commit -m "chore(corpus): add chunk count verification script"
```

---

### Task 18: Manual E2E checklist & ARCHITECTURE update

**Files:**

- Modify: `ARCHITECTURE.md`
- Modify: `README.md`
- Create: `docs/superpowers/plans/2026-06-25-conversational-lokumu-e2e.md`

- [ ] **Step 1: Create E2E checklist**

```markdown
# Phase 2 E2E Checklist

- [ ] `ollama create lokumu-kit-lin -f models/lokumu-kit-lin/Modelfile` (or use qwen2.5:7b fallback)
- [ ] `./start-demo.sh` — API :7001, web :7000
- [ ] Multi-turn kituba: "Mbote" → follow-up "Na yo?" — same conversationId
- [ ] Translation: "Comment dit-on merci en lingala?" — response + source citation
- [ ] Out-of-corpus: honest refusal, no invented proverb
- [ ] `/train` — submit manual dialogue — status approved (TRAINING_AUTO_APPROVE=true)
- [ ] Chat — "Enregistrer pour l'entraînement" — pre-filled turns
- [ ] `npm run training:export` — JSONL created
- [ ] `npx ts-node scripts/count-corpus-chunks.ts` — ≥2000
```

- [ ] **Step 2: Update ARCHITECTURE.md Phase 2 section**

Document: conversation module, training module, corpus pipeline, LoRA workflow.

- [ ] **Step 3: Commit**

```bash
git add ARCHITECTURE.md README.md docs/superpowers/plans/2026-06-25-conversational-lokumu-e2e.md
git commit -m "docs: add Phase 2 E2E checklist and architecture notes"
```

---

## Spec Coverage Checklist

| Spec requirement | Task |
| ---------------- | ---- |
| ~2 000 RAG chunks | Tasks 5, 6, 7, 17 |
| Eliet + Kupsala ingest | Tasks 5, 7 |
| Adaptive top-k | Task 4 |
| Always LLM (+ fast-path) | Tasks 12, 10, 11 |
| Conversation memory | Tasks 3, 12, 13 |
| TrainingDialogue model | Task 2 |
| `/train` UI both modes | Tasks 14, 15 |
| TRAINING_AUTO_APPROVE | Tasks 1, 8 |
| JSONL export | Task 9 |
| External LoRA + Ollama import | Task 16 |
| Anti-hallucination prompts | Task 11 |
| Offline inference | Tasks 1, 12, 16 |

## Execution Order

```
Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18
```

Tasks 5–7 (corpus) can partially parallelize with 8–9 (training) after Task 2 is done.
Tasks 10–13 (runtime) depend on Tasks 3, 4, 11.
Tasks 14–15 (UI) depend on Task 8.
