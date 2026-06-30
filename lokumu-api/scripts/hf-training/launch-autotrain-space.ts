import { uploadFiles, type RepoDesignation, type SpaceHardwareFlavor } from '@huggingface/hub';
import type { HfTrainingEnv } from './lib';

function mvpBillingMessage(): string {
  return [
    'Credits Hugging Face requis pour un Space GPU (erreur 402).',
    'MVP sans paiement : gardez Qwen de base + RAG, sans AutoTrain.',
    'Dataset deja utilisable : npm run training:export / training:upload.',
    'Plus tard : credits sur https://huggingface.co/settings/billing puis HF_AUTOTRAIN_ALLOW_PAID=true',
  ].join('\n');
}

const HARDWARE_MAP: Record<string, SpaceHardwareFlavor> = {
  'spaces-a10g-large': 'a10g-large',
  'spaces-a10g-small': 'a10g-small',
  'spaces-a100-large': 'a100-large',
  'spaces-t4-medium': 't4-medium',
  'spaces-t4-small': 't4-small',
  'spaces-cpu-upgrade': 'cpu-upgrade',
  'spaces-cpu-basic': 'cpu-basic',
  'spaces-l4x1': 'l4x1',
  'spaces-l4x4': 'l4x4',
  'spaces-l40sx1': 'l40sx1',
  'spaces-l40sx4': 'l40sx4',
  'spaces-l40sx8': 'l40sx8',
  'spaces-a10g-largex2': 'a10g-largex2',
  'spaces-a10g-largex4': 'a10g-largex4',
};

const DOCKERFILE = `FROM huggingface/autotrain-advanced:latest

CMD pip uninstall -y autotrain-advanced && pip install -U autotrain-advanced && autotrain api --port 7860 --host 0.0.0.0
`;

const LLM_TASK_ID = '9';

function buildReadme(projectName: string): string {
  return `---
title: ${projectName}
emoji: 🚀
colorFrom: green
colorTo: indigo
sdk: docker
pinned: false
tags:
- autotrain
duplicated_from: autotrain-projects/autotrain-advanced
---
`;
}

function buildLlmParams(env: HfTrainingEnv): Record<string, unknown> {
  return {
    model: env.baseModel,
    project_name: env.projectName,
    data_path: env.datasetId,
    train_split: 'train',
    valid_split: null,
    add_eos_token: true,
    block_size: 2048,
    model_max_length: 4096,
    padding: 'right',
    trainer: 'sft',
    use_flash_attention_2: false,
    log: 'tensorboard',
    disable_gradient_checkpointing: false,
    logging_steps: -1,
    eval_strategy: 'epoch',
    save_total_limit: 1,
    auto_find_batch_size: false,
    mixed_precision: 'bf16',
    lr: 2e-5,
    epochs: env.epochs,
    batch_size: 1,
    warmup_ratio: 0.1,
    gradient_accumulation: 8,
    optimizer: 'paged_adamw_8bit',
    scheduler: 'cosine',
    weight_decay: 0,
    max_grad_norm: 1,
    seed: 42,
    chat_template: 'tokenizer',
    quantization: 'int4',
    target_modules: 'all-linear',
    merge_adapter: true,
    peft: true,
    lora_r: 16,
    lora_alpha: 32,
    lora_dropout: 0.05,
    model_ref: null,
    dpo_beta: 0.1,
    max_prompt_length: 128,
    max_completion_length: null,
    prompt_text_column: null,
    text_column: 'messages',
    rejected_text_column: null,
    push_to_hub: true,
    username: env.username,
    token: env.token,
    unsloth: false,
    distributed_backend: null,
  };
}

async function hfApi(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`https://huggingface.co/api/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}

async function addSpaceSecret(
  spaceId: string,
  key: string,
  value: string,
  token: string,
): Promise<void> {
  const response = await hfApi(`spaces/${spaceId}/secrets`, token, {
    method: 'POST',
    body: JSON.stringify({ key, value }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to set secret ${key} (${response.status}): ${body}`);
  }
}

async function setSpaceSleepTime(
  spaceId: string,
  token: string,
  sleepTimeSeconds = 604800,
): Promise<void> {
  const response = await hfApi(`spaces/${spaceId}/sleeptime`, token, {
    method: 'POST',
    body: JSON.stringify({ seconds: sleepTimeSeconds }),
  });
  if (!response.ok) {
    const body = await response.text();
    console.warn(`Could not set space sleep time: ${body}`);
  }
}

async function createSpaceRepo(
  spaceId: string,
  hardware: SpaceHardwareFlavor,
  token: string,
): Promise<void> {
  const name = spaceId.split('/').pop();
  if (!name) throw new Error(`Invalid space id: ${spaceId}`);

  const response = await hfApi('repos/create', token, {
    method: 'POST',
    body: JSON.stringify({
      name,
      type: 'space',
      visibility: 'private',
      sdk: 'docker',
      hardware,
    }),
  });

  if (response.ok) return;

  const body = await response.text();
  if (response.status === 402) {
    throw new Error(`${mvpBillingMessage()}\n\n${body}`);
  }
  if (response.status === 409 || /already (exists|created)/i.test(body)) return;

  throw new Error(`Failed to create Space (${response.status}): ${body}`);
}

export async function launchAutotrainSpace(
  env: HfTrainingEnv,
): Promise<{ spaceId: string; modelId: string }> {
  const hardware = HARDWARE_MAP[env.backend];
  if (!hardware) {
    throw new Error(`Unsupported backend: ${env.backend}`);
  }

  const spaceId = `${env.username}/autotrain-${env.projectName}`;
  const modelId = `${env.username}/${env.projectName}`;
  const params = buildLlmParams(env);
  const paramsSecret = JSON.stringify(JSON.stringify(params));
  const repo: RepoDesignation = { type: 'space', name: spaceId };

  console.log(`Creating AutoTrain Space: ${spaceId}`);
  console.log(`Hardware: ${hardware}`);
  console.log(`Dataset: ${env.datasetId}`);
  console.log(`Base model: ${env.baseModel}`);

  await createSpaceRepo(spaceId, hardware, env.token);

  const secrets: Array<[string, string]> = [
    ['HF_TOKEN', env.token],
    ['AUTOTRAIN_USERNAME', env.username],
    ['PROJECT_NAME', env.projectName],
    ['TASK_ID', LLM_TASK_ID],
    ['PARAMS', paramsSecret],
    ['DATA_PATH', env.datasetId],
    ['MODEL', env.baseModel],
  ];

  for (const [key, value] of secrets) {
    await addSpaceSecret(spaceId, key, value, env.token);
  }

  await setSpaceSleepTime(spaceId, env.token);

  await uploadFiles({
    repo,
    accessToken: env.token,
    files: [
      { path: 'README.md', content: new Blob([buildReadme(env.projectName)]) },
      { path: 'Dockerfile', content: new Blob([DOCKERFILE]) },
    ],
    commitTitle: 'Initialize AutoTrain Space',
  });

  return { spaceId, modelId };
}
