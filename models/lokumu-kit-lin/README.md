# lokumu-kit-lin

Ollama model definition and **Hugging Face** training/inference guide for Lokumu Phase 2.

## MVP sans paiement (recommandé)

En phase MVP, **ne lancez pas** `training:autotrain` ni `training:pipeline` jusqu’à la fin : le fine-tuning sur GPU Hugging Face est **payant** (crédits prépayés).

| Gratuit / inclus | Payant (plus tard) |
| ---------------- | ------------------ |
| Chat via `LLM_PROVIDER=hf` + `Qwen/Qwen2.5-7B-Instruct` (router HF, quotas gratuits) | AutoTrain sur Space GPU (`spaces-a10g-large`, etc.) |
| RAG local (Eliet 1953, dialogues, ~4k chunks) | Inference Endpoint dédié |
| `training:seed`, `training:export`, `training:upload` (dataset privé sur le Hub) | |
| Ollama local (`qwen2.5:7b`) si machine assez puissante | |

Configuration MVP dans `lokumu-api/.env` :

```env
LLM_PROVIDER=hf
HF_TOKEN=hf_...          # token inference (gratuit avec limites)
HF_MODEL_ID=Qwen/Qwen2.5-7B-Instruct
HF_AUTOTRAIN_ALLOW_PAID=false
```

Continuer à enrichir le corpus (`/train`, `training:seed`) prépare le fine-tuning futur sans coût.

Quand vous serez prêt à payer : crédits sur [billing HF](https://huggingface.co/settings/billing), puis `HF_AUTOTRAIN_ALLOW_PAID=true` et `npm run training:autotrain -- --train-only`.

---

## Phase A — Quick test with Hugging Face Inference (no GPU)

Set in `lokumu-api/.env`:

```env
LLM_PROVIDER=hf
HF_TOKEN=hf_xxxxxxxx
HF_MODEL_ID=Qwen/Qwen2.5-7B-Instruct
```

Restart the API. Lokumu uses the [HF Inference Providers router](https://huggingface.co/docs/inference-providers) (`https://router.huggingface.co/v1`) for chat; the legacy `api-inference.huggingface.co` endpoint is decommissioned.

See [Phase A E2E checklist](../../docs/superpowers/plans/2026-06-26-huggingface-phase-a-e2e.md).

Design spec: [2026-06-26-huggingface-training-inference-design.md](../../docs/superpowers/specs/2026-06-26-huggingface-training-inference-design.md).

---

## Offline demo (Ollama)

```bash
# From repo root
ollama pull qwen2.5:7b
ollama create lokumu-kit-lin -f models/lokumu-kit-lin/Modelfile
```

Set `OLLAMA_MODEL=lokumu-kit-lin:latest` in `lokumu-api/.env`.

## Phase B — AutoTrain Qwen2.5-7B-Instruct (automated, **payant**)

> Nécessite des crédits HF et `HF_AUTOTRAIN_ALLOW_PAID=true`. Ignorer en MVP.

Fine-tune on approved Lokumu dialogues via **HF AutoTrain** on cloud GPU (no local GPU).

### Prerequisites

1. **HF write token** with dataset + model + space permissions ([settings/tokens](https://huggingface.co/settings/tokens))
2. At least **5 approved dialogues** (`TRAINING_AUTO_APPROVE=true` in dev, or approve via API)

**Python is optional.** The default launcher uses TypeScript + the HF Space API (no local `autotrain-advanced` install).  
If you prefer the Python launcher: use **Python 3.11 or 3.12** only — Python 3.13 on Windows fails to build `sentencepiece`.

```bash
# Optional Python path (3.11/3.12 only)
py -3.12 -m venv .venv-autotrain
.venv-autotrain/Scripts/activate   # Windows
pip install -r scripts/autotrain/requirements.txt
```

### Configure `.env`

```env
HF_TOKEN=hf_xxxxxxxx          # write token
HF_USERNAME=your-hf-username  # optional — inferred from token
HF_DATASET_ID=your-username/lokumu-dialogues
HF_AUTOTRAIN_BASE_MODEL=Qwen/Qwen2.5-7B-Instruct
HF_AUTOTRAIN_PROJECT=lokumu-kit-lin-qwen
HF_AUTOTRAIN_BACKEND=spaces-a10g-large   # cloud GPU (~$1/hr, verify HF pricing)
HF_AUTOTRAIN_EPOCHS=2
HF_AUTOTRAIN_MIN_DIALOGUES=5
```

### One-command pipeline

From `lokumu-api/`:

```bash
# 1. Seed training dialogues from Eliet 1953 + greeting corpus (first time)
npm run training:seed

# 2. Export, upload, launch AutoTrain
npm run training:pipeline
```

This will:

1. Export approved dialogues → `data/training/lokumu-kit-lin.jsonl`
2. Upload `train.jsonl` to your private HF dataset
3. Launch **AutoTrain SFT** (LoRA + merge) on `Qwen/Qwen2.5-7B-Instruct`

### Step-by-step

| Command | Action |
| ------- | ------ |
| `npm run training:seed` | Import Eliet + dialogues JSON → DB (approved) |
| `npm run training:export` | Export JSONL only |
| `npm run training:upload` | Export + upload to HF dataset |
| `npm run training:autotrain -- --train-only` | AutoTrain only (dataset already on Hub) |
| `npm run training:autotrain -- --python` | Use Python launcher (needs 3.11/3.12 + autotrain-advanced) |
| `npm run training:autotrain -- --dry-run` | Show config without running |

### After training

1. Monitor on `https://huggingface.co/{HF_USERNAME}/{HF_AUTOTRAIN_PROJECT}`
2. Create an **Inference Endpoint** for the fine-tuned model (recommended for production)
3. Update `lokumu-api/.env`:

```env
LLM_PROVIDER=hf
HF_MODEL_ID=your-username/lokumu-kit-lin-qwen
HF_ENDPOINT_URL=https://...   # optional — dedicated endpoint URL
```

4. Restart the API and test in chat.

### Cost note

`spaces-a10g-large` bills per GPU hour on Hugging Face. Use `spaces-t4-medium` for cheaper/smaller runs if quality allows.

---

## External LoRA fine-tuning workflow (legacy / offline)

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
