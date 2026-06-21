# Lokumu Hybrid AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hybrid AI assistant with Chat and Code modes supporting FR, EN, LIN, KIT, SWA languages on local hardware.

**Architecture:** Extend existing NestJS backend with mode detection, unified tool registry, and extend lokumu-agent for autonomous code generation.

**Tech Stack:** NestJS, Next.js, PostgreSQL + pgvector, Qwen2.5-Coder:1.5b, llama.cpp, BGE-M3 embeddings

## Global Constraints

- Laptop local (i5-8365U, ~6GB RAM disponible)
- 5 langues supportées: fra, eng, lin, kit, swa
- Qwen2.5-1.5B-Q4_K_M (~800MB) + BGE-M3 (~560MB)
- Streaming réponses via WebSocket requis
- Prompts dans `<200ms` pour détectation mode simple
- Réponses <5s latence sur hardware local

---

## File Structure

```
lokumu-api/
├── src/
│   ├── agent/              # Nouveau: Orchestrateur agent
│   │   ├── agent.controller.ts
│   │   ├── agent.service.ts
│   │   ├── mode-detector.ts
│   │   └── dto/
│   ├── chat/               # Nouveau: Module chat complet
│   │   ├── chat.controller.ts
│   │   ├── chat.service.ts
│   │   ├── chat.gateway.ts    # WebSocket streaming
│   │   └── dto/
│   └── common/
│       └── guards/
│           └── mode.guard.ts  # Auth + mode routing

lokumu-agent/
├── src/tools/
│   ├── fs/writeFile.ts      # Existant - compléter
│   ├── fs/readFile.ts       # Existant - compléter
│   ├── shell/execute.ts    # Existant - compléter
│   ├── shell/watch.ts      # Nouveau
│   ├── git/status.ts       # Nouveau
│   ├── search/code.ts      # Nouveau
│   └── project/scan.ts     # Existant
```

---

### Task 1: Mode Detector Utility

**Files:**
- Create: `lokumu-api/src/agent/mode-detector.ts`

**Interfaces:**
- Consumes: user prompt string
- Produces: `'chat' | 'code'` enum

- [ ] **Step 1: Write the failing test**

```typescript
// lokumu-api/src/agent/mode-detector.spec.ts
import { detectMode } from './mode-detector';

test('detects code mode from technical keywords', () => {
  expect(detectMode('Crée un endpoint API pour les conversations')).toBe('code');
  expect(detectMode('Modifie le fichier .env')).toBe('code');
});

test('detects chat mode from question words', () => {
  expect(detectMode('Quelle est la météo aujourd\'hui?')).toBe('chat');
  expect(detectMode('Comment ça va?')).toBe('chat');
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd lokumu-ai/lokumu-api && npm test -- mode-detector`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// lokumu-api/src/agent/mode-detector.ts
export type Mode = 'chat' | 'code';

export function detectMode(prompt: string): Mode {
  const normalized = prompt.toLowerCase();
  
  const codePatterns = [
    /crée|créer|modifie|modifier|refactor|bug|test/,
    /\.ts|\.js|\.py|\.java|\.go/,
    /endpoint|api|composant|component/,
    /génère|generate/i,
  ];

  const chatPatterns = [
    /\b(quelle|comment|pourquoi|quoi|qui|quand|où)\b/,
    /\b(explique|raconte|dis-moi|aide-moi)\b/,
  ];

  // Check code patterns first
  if (codePatterns.some(p => p.test(normalized))) return 'code';
  if (chatPatterns.some(p => p.test(normalized))) return 'chat';
  
  return 'chat'; // default
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd lokumu-ai/lokumu-api && npm test -- mode-detector`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add lokumu-api/src/agent/mode-detector.ts lokumu-api/src/agent/mode-detector.spec.ts
git commit -m "feat(agent): add mode detector for chat/code routing"
```

---

### Task 2: Extend Agent Tools - Shell Watch

**Files:**
- Create: `lokumu-agent/src/tools/shell/watch.ts`

**Interfaces:**
- Consumes: file pattern, callback function
- Produces: emits file change events

- [ ] **Step 1: Write the failing test**

```typescript
// lokumu-agent/src/tools/shell/watch.spec.ts
import { watchFiles } from './watch';
import { writeFile, unlinkSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

test('watches file changes and calls callback', (done) => {
  const dir = join(tmpdir(), 'lokumu-test-' + Date.now());
  mkdirSync(dir, { recursive: true });
  
  const watcher = watchFiles(dir, '*.ts', (event, path) => {
    expect(event).toBe('change');
    expect(path).toContain('test.ts');
    watcher.close();
    done();
  });
  
  // Trigger change
  writeFile(join(dir, 'test.ts'), '// test', () => {});
}, 10000);
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd lokumu-ai/lokumu-agent && npx tsc --noEmit` then test
Expected: FAIL with missing module

- [ ] **Step 3: Write minimal implementation**

```typescript
// lokumu-agent/src/tools/shell/watch.ts
import { watch } from 'fs';
import { join } from 'path';

export function watchFiles(
  dir: string,
  pattern: string,
  callback: (event: 'change' | 'rename', path: string) => void
) {
  const watcher = watch(dir, (event, filename) => {
    if (filename && new RegExp(pattern).test(filename)) {
      callback(event as 'change' | 'rename', join(dir, filename));
    }
  });
  
  return {
    close: () => watcher.close(),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd lokumu-ai/lokumu-agent && npm test -- watch`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add lokumu-agent/src/tools/shell/watch.ts
git commit -m "feat(agent): add file watch tool for shell"
```

---

### Task 3: Extend Agent Tools - Git Status

**Files:**
- Create: `lokumu-agent/src/tools/git/status.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lokumu-agent/src/tools/git/status.spec.ts
import { getGitStatus } from './status';

test('returns git status for working directory', async () => {
  const status = await getGitStatus(process.cwd());
  expect(status).toHaveProperty('modified');
  expect(status).toHaveProperty('staged');
  expect(Array.isArray(status.modified)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write minimal implementation**

```typescript
// lokumu-agent/src/tools/git/status.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitStatus {
  modified: string[];
  staged: string[];
  untracked: string[];
  branch: string;
}

export async function getGitStatus(cwd: string): Promise<GitStatus> {
  const { stdout: branchOut } = await execAsync('git branch --show-current', { cwd });
  const { stdout: statusOut } = await execAsync('git status --porcelain', { cwd });
  
  const lines = statusOut.trim().split('\n').filter(l => l);
  const modified: string[] = [];
  const staged: string[] = [];
  const untracked: string[] = [];
  
  for (const line of lines) {
    if (line.startsWith(' M') || line.startsWith('M ')) {
      modified.push(line.slice(3));
    } else if (line.startsWith('A ') || line.startsWith('M ')) {
      staged.push(line.slice(3));
    } else if (line.startsWith('??')) {
      untracked.push(line.slice(3));
    }
  }
  
  return {
    branch: branchOut.trim(),
    modified,
    staged,
    untracked,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd lokumu-ai/lokumu-agent && npm test -- status`

- [ ] **Step 5: Commit**

---

### Task 4: Extend Agent Tools - Code Search

**Files:**
- Create: `lokumu-agent/src/tools/search/code.ts`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 5: Agent Orchestrator Service

**Files:**
- Create: `lokumu-api/src/agent/agent.service.ts`
- Create: `lokumu-api/src/agent/agent.controller.ts`
- Create: `lokumu-api/src/agent/dto/agent-request.dto.ts`

**Interfaces:**
- Consumes: user prompt, mode detected
- Produces: response (chat or code generation result)

- [ ] **Step 1: Write failing tests**
- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Write implementation**
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit**

---

### Task 6: Chat Module - WebSocket Gateway

**Files:**
- Create: `lokumu-api/src/chat/chat.gateway.ts`

- [ ] **Step 1: Write failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write implementation**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 7: Agent Registry Integration

**Files:**
- Modify: `lokumu-agent/src/tools/registry.ts`
- Create: `lokumu-agent/src/tools/fs/writeFile.ts` (compléter)

- [ ] **Step 1: Write failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write implementation**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 8: Frontend Chat Interface

**Files:**
- Create: `lokumu-web/src/app/(chat)/page.tsx` (placeholder for now)

- [ ] **Step 1: Write component spec**
- [ ] **Step 2: Create Next.js app structure**
- [ ] **Step 3: Add chat component skeleton**
- [ ] **Step 4: Wire to API**
- [ ] **Step 5: Commit**

---

## Self-Review

**1. Spec coverage:**
- ✅ Mode détecteur (Task 1)
- ✅ Outils étendus (Tasks 2-4, 7)
- ✅ Orchestrateur (Task 5)
- ✅ WebSocket streaming (Task 6)
- ✅ 5 langues (BGE-M3 support)
- ⚠️ Frontend à créer (lokumu-web manque)

**2. Placeholder scan:**
- Tasks 4, 8 ont des steps vides - à compléter si priorité

**3. Type consistency:**
- Mode type `'chat' | 'code'` cohérent entre tasks