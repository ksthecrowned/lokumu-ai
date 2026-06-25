# Lokumu AI

Lokumu is a local-first cultural assistant demo for Congo-focused language and culture support.
The demo supports exactly four UI languages: `fr`, `en`, `lin`, `kit`.

## Packages

- `lokumu-api/` - NestJS API, RAG, health endpoint, WebSocket stream, community corrections
- `lokumu-web/` - Next.js investor demo UI
- `lokumu-agent/` - standalone agent package

## Quick start

```bash
# API
cd lokumu-api
npm install
npm run start:dev

# Web
cd ../lokumu-web
npm install
npm run dev
```

## Demo launcher

Use the repo launcher to start API + web together (no root npm usage):

```bash
./start-demo.sh
```

## Pre-demo checklist

Before an investor demo, verify each point:

| Step | Verification |
|------|--------------|
| PostgreSQL running | `psql` connects |
| Ollama running | `qwen3.5` appears in `curl localhost:11434/api/tags` |
| Migrate + seed | ~30-50 chunks in DB |
| Import user content | `cd lokumu-api && npm run ingest:cultural` logs OK |
| API | `GET http://localhost:3001/health` returns 200 |
| Web | Offline badge is green on `/chat` |
| BGE-M3 cached | Model exists in `~/.cache/huggingface/` for strict offline mode |

## Supported languages

- French (`fra` / `fr`)
- English (`eng` / `en`)
- Lingala (`lin`)
- Kituba (`kit`)
