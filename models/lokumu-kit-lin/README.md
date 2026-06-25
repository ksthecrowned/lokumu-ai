# lokumu-kit-lin

Ollama model definition for Lokumu Phase 2 conversational assistant (Kituba / Lingala).

The checked-in `Modelfile` uses `qwen2.5:7b` as the base until a LoRA adapter is fine-tuned externally and merged. At runtime the API prefers `lokumu-kit-lin:latest` and falls back to `qwen2.5:7b` if the custom model is missing or times out.

## Quick start (demo machine)

```bash
# From repo root
ollama pull qwen2.5:7b
ollama create lokumu-kit-lin -f models/lokumu-kit-lin/Modelfile
```

Set `OLLAMA_MODEL=lokumu-kit-lin:latest` in `lokumu-api/.env`.

## External LoRA fine-tuning workflow

Fine-tuning runs on a separate GPU machine. Only the merged model is copied back for offline Ollama inference.

### 1. Export approved training dialogues

On the Lokumu API machine (with database access):

```bash
cd lokumu-api
npm run training:export
```

This writes `data/training/lokumu-kit-lin.jsonl` — one JSON object per line in chat format:

```json
{"messages":[{"role":"system","content":"..."},{"role":"user","content":"Mbote"},{"role":"assistant","content":"Mbote! Nazali malamu."}],"language":"kit"}
```

Only dialogues with status `approved` are exported; records are marked `exported` after a successful run.

### 2. Copy dataset to the GPU machine

Transfer the JSONL file securely (USB, SCP, etc.):

```bash
scp data/training/lokumu-kit-lin.jsonl user@gpu-host:/path/to/training/
```

### 3. Fine-tune LoRA on qwen2.5:7b

Use [LLaMA-Factory](https://github.com/hiyouga/LLaMA-Factory) or [Unsloth](https://github.com/unslothai/unsloth) with base model `Qwen/Qwen2.5-7B-Instruct` (equivalent to Ollama `qwen2.5:7b`).

Typical settings:

- Task: supervised fine-tuning (SFT) on the `messages` field
- Base: `qwen2.5:7b` / Qwen2.5-7B-Instruct
- LoRA rank: 8–64 (start with 16)
- Epochs: 1–3 depending on dataset size

Consult your trainer’s docs for exact YAML/config; map each JSONL line to a multi-turn chat example.

### 4. Merge adapter and export GGUF

After training:

1. Merge LoRA weights into the base model (trainer-specific `merge` or `export_merged` step).
2. Convert the merged weights to GGUF (e.g. `llama.cpp` `convert_hf_to_gguf.py` or your trainer’s export command).
3. Quantize if needed (Q4_K_M is a common balance for 7B on consumer hardware).

### 5. Update the Modelfile

Point `FROM` at the merged GGUF (or a local Ollama tag you created from it):

```
FROM ./lokumu-kit-lin-q4_k_m.gguf

PARAMETER temperature 0.7
PARAMETER num_ctx 8192

SYSTEM """
Tu es Lokumu, assistant culturel et linguistique congolais.
Tu parles kituba, lingala, français et anglais.
Pour les faits linguistiques, reste fidèle au contexte fourni.
"""
```

Keep the system prompt aligned with `getSystemPrompt()` in `lokumu-api/src/prompts/multilingual.ts` for consistent behaviour between training export and inference.

### 6. Import into Ollama on the demo machine

Copy the GGUF and updated `Modelfile` to the offline demo machine, then:

```bash
cd models/lokumu-kit-lin
ollama create lokumu-kit-lin -f Modelfile
ollama run lokumu-kit-lin "Mbote, ozali malamu?"
```

Verify `OLLAMA_MODEL=lokumu-kit-lin:latest` in `lokumu-api/.env` and restart the API.

## Re-training cadence

Re-run the cycle when you have a meaningful batch of new approved dialogues (e.g. every ~100 submissions or before a demo). Export marks dialogues as exported; new approvals accumulate until the next export.

## Related

- Export script: `lokumu-api/scripts/export-training-dataset.ts`
- Training UI: `/train` and “Enregistrer pour l’entraînement” in chat
- Env vars: `OLLAMA_MODEL`, `OLLAMA_FALLBACK_MODEL` in `lokumu-api/.env.example`
