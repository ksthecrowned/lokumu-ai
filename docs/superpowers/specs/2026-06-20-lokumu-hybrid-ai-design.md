# Lokumu AI Hybrid Design Specification

## Vision
Lokumu est une IA locale multilingue (FR, EN, LIN, KIT, SWA) avec double mode d'interaction:
- **Chat Mode**: Assistant conversationnel avec RAG sur données locales
- **Code Mode**: Agent autonome de développement (CursorCLI-like)

Basé sur `qwen2.5-coder:1.5b` comme modèle principal, optimisé pour matériel local (laptop i5-8365U, RAM ~8GB).

## Architecture

```
┌─────────┐     ┌────────────────┐     ┌──────────────────┐
│   User  │────▶│  Frontend Web  │────▶│  API Gateway     │
└─────────┘     └────────────────┘     └──────────────────┘
                                          │
                                          ▼
                              ┌──────────────────┐
                              │ Agent Orchestrateur│
                              └──────────────────┘
                                          │
                   ┌────────────────────────┴────────────────────────┐
                   ▼                        ▼
          ┌────────────────┐       ┌──────────────────────┐
          │  Chat Mode     │       │   Code Mode          │
          │                │       │                      │
          │ RAG Service    │       │ Code Tools           │
          │ LLM Chat       │       │ LLM Coder            │
          └────────────────┘       └──────────────────────┘
```

## Composants

### 1. Mode Détecteur
Analyse le prompt utilisateur pour déterminer le mode d'interaction.

**Patterns détection:**
- Code: "crée", "modifie", "refactor", "bug", "test", ".ts/.js/.py", "api endpoint", "endpoint", "component"
- Chat: "quelle", "comment", "pourquoi", "explique", "raconte"

**Implémentation:**
```typescript
function detectMode(prompt: string): 'chat' | 'code' {
  const codePatterns = [/crée|modifie|refactor|bug|test|\.ts|\.js|\.py|endpoint|endpoint/i];
  return codePatterns.some(p => p.test(prompt)) ? 'code' : 'chat';
}
```

### 2. LLM Router
Sélectionne le modèle selon le mode détecté.

| Mode | Modèle | Température | Contexte |
|------|--------|-------------|----------|
| Chat | qwen2.5-coder:1.5b | 0.7 | Conversation + RAG |
| Code | qwen2.5-coder:1.5b | 0.1 | Prompts techniques |

### 3. Outils Étendus

**Outils existants (lokumu-agent):**
- `fs.read`, `fs.write`, `fs.edit`
- `shell.execute`, `shell.watch`
- `search.files`, `project.scan`

**Nouveaux outils:**
- `shell.watch`: Surveille les changements fichiers
- `git.status`: Statut dépôt et changements
- `search.code`: Recherche dans le codebase
- `rag.search`, `rag.ingest`: Recherche et ingestion documents

### 4. Mémoire Évolutive

**Stockage conversation:**
- PostgreSQL: conversations, messages, utilisateurs
- Chaque message avec langue détectée (`language` field)

**Contexte code:**
- Fichiers récents manipulés
- Erreurs terminal capturées
- État workspace persistant

**Cache:**
- Redis: embeddings fréquents (1hr TTL)
- Réponses LLM identiques (5min TTL)

### 5. Langues Supportées

| Code | Langue | Niveau | Notes |
|------|--------|--------|-------|
| fra | Français | Complet | Langue principale |
| eng | Anglais | Complet | Langue secondaire |
| lin | Lingala | BGE-M3 | Priorité haute |
| kit | Kituba | BGE-M3 | Priorité haute |
| swa | Swahili | BGE-M3 | Priorité médiane |

## Flux de Travail

### Chat Mode
1. User envoie message
2. Détection langue → RAG recherche contexte
3. Prompt assemblé avec contexte
4. LLM génère réponse
5. Retour avec citations sources

### Code Mode
1. User: "Crée un endpoint API pour les conversations"
2. Mode détecté → Agent décompose tâche
3. Agent génère code avec patterns NestJS existants
4. Outils écrivent fichiers
5. Validation syntaxique automatique
6. Retour avec preview + suggestions

## Stack Technique

| Couche | Technologie | Justification |
|--------|-------------|--------------|
| Frontend | Next.js 14 + TypeScript | SSR/SSG, développement rapide |
| Backend | NestJS monolithe | MVP simple, évolutif |
| DB | PostgreSQL + pgvector | ACID + vectors natifs |
| ORM | Prisma | Type-safe, migrations |
| Embeddings | BGE-M3 (Xenova) | Multilingue, 100+ langues |
| Inference | llama.cpp | CPU-optimized, GGUF |
| Cache | Redis | Embeddings, sessions |

## Contraintes MVP

- Laptop local (i5-8365U, ~6GB RAM disponible)
- Qwen2.5-1.5B-Q4_K_M (~800MB) + BGE-M3 (~560MB)
- 3 langues africaines prioritaires (lin, kit, swa)
- Pas de fine-tuning initial (base model seulement)

## Success Criteria

- [ ] Assistant chat répond en 5 langues supportées
- [ ] Agent code génère/modifie fichiers NestJS
- [ ] RAG fonctionne avec documents locaux
- [ ] Performance <5s latence sur hardware local
- [ ] Streaming réponses via WebSocket