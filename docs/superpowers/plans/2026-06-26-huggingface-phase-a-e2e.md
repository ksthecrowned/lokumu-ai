# Hugging Face Phase A — Manual E2E Checklist

- [ ] Set in `lokumu-api/.env`:
  - `LLM_PROVIDER=hf`
  - `HF_TOKEN=hf_...` (read token from huggingface.co/settings/tokens)
  - `HF_MODEL_ID=Svngoku/aya-23-8b-afrimmlu-lin`
- [ ] `./start-demo.sh`
- [ ] `GET http://localhost:7001/health` → `llm.provider === "hf"` and `llm.available === true`
- [ ] Chat at `http://localhost:7000/chat`: « Mbote, ozali malamu? » → Lingala response
- [ ] Multi-turn: follow-up « Na yo? » uses same conversation
- [ ] Set `LLM_PROVIDER=ollama` → chat works with local Ollama (if running)
- [ ] Invalid `HF_TOKEN` → clear error message in chat UI

## Optional

- [ ] `HF_FALLBACK_TO_OLLAMA=true` — HF failure falls back to Ollama
- [ ] Phase B: AutoTrain on exported JSONL → `HF_ENDPOINT_URL` for dedicated Endpoint
