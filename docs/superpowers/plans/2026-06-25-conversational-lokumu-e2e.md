# Phase 2 E2E Checklist

Manual verification before an investor demo or release candidate sign-off.

- [ ] `ollama create lokumu-kit-lin -f models/lokumu-kit-lin/Modelfile` (or use qwen2.5:7b fallback)
- [ ] `./start-demo.sh` — API :7001, web :7000
- [ ] Multi-turn kituba: "Mbote" → follow-up "Na yo?" — same conversationId
- [ ] Translation: "Comment dit-on merci en lingala?" — response + source citation
- [ ] Out-of-corpus: honest refusal, no invented proverb
- [ ] `/train` — submit manual dialogue — status approved (TRAINING_AUTO_APPROVE=true)
- [ ] Chat — "Enregistrer pour l'entraînement" — pre-filled turns
- [ ] `npm run training:export` — JSONL created
- [ ] `npx ts-node scripts/count-corpus-chunks.ts` — ≥2000
