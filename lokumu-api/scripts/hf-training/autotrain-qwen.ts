import 'dotenv/config';

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { exportApprovedDialogues } from './export-jsonl';
import { launchAutotrainSpace } from './launch-autotrain-space';
import { assertAutotrainAllowed, isPaidAutotrainAllowed, loadTrainingEnv, optionalEnv } from './lib';
import { uploadTrainingDataset } from './upload-dataset';

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function resolvePython(): string | null {
  const candidates = [
    process.env.PYTHON?.trim(),
    'py -3.12',
    'py -3.11',
    'python3.12',
    'python3.11',
    'python3',
    'python',
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const parts = candidate.split(' ');
    const probe = spawnSync(parts[0], [...parts.slice(1), '--version'], {
      stdio: 'ignore',
      shell: false,
    });
    if (probe.status === 0) return candidate;
  }

  return null;
}

function runAutotrainPython(env: Awaited<ReturnType<typeof loadTrainingEnv>>): void {
  const script = resolve(__dirname, '../autotrain/train_qwen.py');
  if (!existsSync(script)) {
    throw new Error(`Missing trainer script: ${script}`);
  }

  const python = resolvePython();
  if (!python) {
    throw new Error(
      'Python 3.11/3.12 not found. Use default launcher (no --python) or install Python 3.12.',
    );
  }

  const parts = python.split(' ');
  const childEnv = {
    ...process.env,
    HF_TOKEN: env.token,
    HF_USERNAME: env.username,
    HF_DATASET_ID: env.datasetId,
    HF_AUTOTRAIN_BASE_MODEL: env.baseModel,
    HF_AUTOTRAIN_PROJECT: env.projectName,
    HF_AUTOTRAIN_BACKEND: env.backend,
    HF_AUTOTRAIN_EPOCHS: String(env.epochs),
  };

  console.log('Starting HF AutoTrain via Python...');
  const result = spawnSync(parts[0], [...parts.slice(1), script], {
    stdio: 'inherit',
    env: childEnv,
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function runAutotrain(env: Awaited<ReturnType<typeof loadTrainingEnv>>): Promise<void> {
  assertAutotrainAllowed();

  if (hasFlag('--python')) {
    runAutotrainPython(env);
    return;
  }

  const { spaceId, modelId } = await launchAutotrainSpace(env);
  console.log('');
  console.log('AutoTrain Space created — training starts on Hugging Face GPU.');
  console.log(`Space:  https://huggingface.co/spaces/${spaceId}`);
  console.log(`Model:  https://huggingface.co/${modelId}`);
  console.log('');
  console.log('After training completes, update lokumu-api/.env:');
  console.log(`  HF_MODEL_ID=${modelId}`);
}

async function main() {
  const exportOnly = hasFlag('--export-only');
  const uploadOnly = hasFlag('--upload-only');
  const trainOnly = hasFlag('--train-only');
  const dryRun = hasFlag('--dry-run');

  if (dryRun) {
    const token = process.env.HF_TOKEN?.trim();
    const username = process.env.HF_USERNAME?.trim() || '<from HF token>';
    console.log('Dry run — training configuration:');
    console.log(
      JSON.stringify(
        {
          launcher: hasFlag('--python') ? 'python' : 'typescript (HF Space API)',
          token: token ? `${token.slice(0, 6)}...` : '(missing HF_TOKEN)',
          username,
          datasetId: optionalEnv(
            'HF_DATASET_ID',
            `${username === '<from HF token>' ? '<username>' : username}/lokumu-dialogues`,
          ),
          baseModel: optionalEnv(
            'HF_AUTOTRAIN_BASE_MODEL',
            'Qwen/Qwen2.5-7B-Instruct',
          ),
          projectName: optionalEnv('HF_AUTOTRAIN_PROJECT', 'lokumu-kit-lin-qwen'),
          backend: optionalEnv('HF_AUTOTRAIN_BACKEND', 'spaces-a10g-large'),
          epochs: Number(optionalEnv('HF_AUTOTRAIN_EPOCHS', '2')),
          minDialogues: Number(optionalEnv('HF_AUTOTRAIN_MIN_DIALOGUES', '5')),
        },
        null,
        2,
      ),
    );
    return;
  }

  const env = await loadTrainingEnv();

  const jsonlPath = resolve(
    process.env.HF_TRAINING_JSONL_PATH ??
      resolve(__dirname, '../../../data/training/lokumu-kit-lin.jsonl'),
  );

  if (!trainOnly && !uploadOnly) {
    const exported = await exportApprovedDialogues(jsonlPath);
    console.log(`Exported ${exported.count} approved dialogues to ${jsonlPath}`);
    if (exported.count < env.minDialogues) {
      throw new Error(
        `Need at least ${env.minDialogues} approved dialogues (have ${exported.count}). ` +
          'Run: npm run training:reapprove',
      );
    }
    if (exportOnly) return;
  }

  if (!trainOnly) {
    const uploaded = await uploadTrainingDataset({
      skipExport: true,
      jsonlPath,
      env,
    });
    console.log(
      `Uploaded dataset: https://huggingface.co/datasets/${uploaded.datasetId} (${uploaded.count} rows)`,
    );
    if (uploadOnly) return;
  }

  if (!isPaidAutotrainAllowed()) {
    console.log('');
    console.log('MVP : export + upload termines. AutoTrain GPU non lance (HF_AUTOTRAIN_ALLOW_PAID=false).');
    console.log('Chat MVP : LLM_PROVIDER=hf + Qwen/Qwen2.5-7B-Instruct + RAG local.');
    return;
  }

  await runAutotrain(env);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
