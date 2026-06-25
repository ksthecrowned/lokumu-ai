# Lokumu AI

Une IA locale multilingue (FR, EN, LIN, KIT) avec double mode:
- **Chat Mode**: Assistant conversationnel avec RAG
- **Code Mode**: Agent autonome de développement (CursorCLI-like)

## Stack Technique
- **Package Manager**: Bun (pour l'agent) + npm (pour l'API)
- **Backend**: NestJS + Prisma + PostgreSQL (pgvector)
- **Frontend**: Next.js 14
- **Inference**: llama.cpp avec Qwen2.5-Coder:1.5b
- **Embeddings**: BGE-M3 (multilingue)

## Structure
- `lokumu-api/` - Backend NestJS
- `lokumu-agent/` - Agent autonome avec outils (Bun)
- `lokumu-web/` - Frontend Next.js (en développement)

## Démarrage
```bash
# Backend (npm)
cd lokumu-api
npm install
npm run start:dev

# Agent (Bun)
cd lokumu-agent
bun install
bun run agent

# Frontend
cd lokumu-web
npm install
npm run dev
```

## Tests
```bash
# Backend
cd lokumu-api
npm test

# Agent
cd lokumu-agent
bun test
```

## Langues supportées
- Français (fra)
- Anglais (eng)
- Lingala (lin)
- Kituba (kit)

## Configuration
Copiez `.env.example` vers `.env` et configurez:
- `DATABASE_URL` - Connexion PostgreSQL
- `JWT_SECRET` - Clé secrète pour JWT
- `LLM_MODEL` - Modèle Ollama (défaut: qwen2.5-coder:1.5b)# lokumu-ai
