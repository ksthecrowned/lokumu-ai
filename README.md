# Lokumu AI

Une IA locale multilingue (FR, EN, LIN, KIT, SWA) avec double mode:
- **Chat Mode**: Assistant conversationnel avec RAG
- **Code Mode**: Agent autonome de développement

## Structure
- `lokumu-api/` - Backend NestJS
- `lokumu-agent/` - Agent autonome avec outils
- `lokumu-web/` - Frontend Next.js (en développement)

## Démarrage
```bash
# Backend
cd lokumu-api
npm install
npm run start:dev

# Agent
cd lokumu-agent
bun run agent
```

## Langues supportées
- Français (fra)
- Anglais (eng)
- Lingala (lin)
- Kituba (kit)
- Swahili (swa)