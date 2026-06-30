import 'dotenv/config';

export type HfTrainingEnv = {
  token: string;
  username: string;
  datasetId: string;
  baseModel: string;
  projectName: string;
  backend: string;
  epochs: number;
  minDialogues: number;
};

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function isPaidAutotrainAllowed(): boolean {
  return process.env.HF_AUTOTRAIN_ALLOW_PAID === 'true';
}

export function assertAutotrainAllowed(): void {
  if (isPaidAutotrainAllowed()) return;

  throw new Error(
    [
      'AutoTrain GPU sur Hugging Face est desactive (MVP sans paiement).',
      'HF Spaces avec GPU (a10g, t4, etc.) exige des credits prepayes.',
      '',
      'MVP gratuit :',
      '  - LLM_PROVIDER=hf + Qwen/Qwen2.5-7B-Instruct (inference router)',
      '  - RAG local (Eliet, dialogues, 3974+ chunks)',
      '  - npm run training:seed / training:export / training:upload (dataset Hub)',
      '',
      'Pour lancer un fine-tuning payant plus tard : HF_AUTOTRAIN_ALLOW_PAID=true dans .env',
      'Voir models/lokumu-kit-lin/README.md section MVP.',
    ].join('\n'),
  );
}

export async function resolveHfUsername(token: string): Promise<string> {
  const configured = process.env.HF_USERNAME?.trim();
  if (configured) return configured;

  const response = await fetch('https://huggingface.co/api/whoami-v2', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(
      `HF token invalid or missing write scope (${response.status}). Set HF_USERNAME manually if needed.`,
    );
  }
  const payload = (await response.json()) as { name?: string };
  if (!payload.name) {
    throw new Error('Could not resolve HF username from token');
  }
  return payload.name;
}

export async function loadTrainingEnv(): Promise<HfTrainingEnv> {
  const token = requireEnv('HF_TOKEN');
  const username = await resolveHfUsername(token);
  return {
    token,
    username,
    datasetId: optionalEnv('HF_DATASET_ID', `${username}/lokumu-dialogues`),
    baseModel: optionalEnv('HF_AUTOTRAIN_BASE_MODEL', 'Qwen/Qwen2.5-7B-Instruct'),
    projectName: optionalEnv('HF_AUTOTRAIN_PROJECT', 'lokumu-kit-lin-qwen'),
    backend: optionalEnv('HF_AUTOTRAIN_BACKEND', 'spaces-a10g-large'),
    epochs: Number(optionalEnv('HF_AUTOTRAIN_EPOCHS', '2')),
    minDialogues: Number(optionalEnv('HF_AUTOTRAIN_MIN_DIALOGUES', '5')),
  };
}

export function buildDatasetCard(): string {
  return `---
language:
- fr
- ln
- sw
license: mit
task_categories:
- text-generation
---

# Lokumu dialogues (Kituba / Lingala)

Chat-formatted SFT data exported from Lokumu \`/train\` and chat corrections.

Each row has a \`messages\` array compatible with Qwen2.5-Instruct chat templates.

\`\`\`json
{"messages":[{"role":"system","content":"..."},{"role":"user","content":"Mbote"},{"role":"assistant","content":"Mbote! Nazali malamu."}],"language":"lin"}
\`\`\`
`;
}
