import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRepo, uploadFiles, type RepoDesignation } from '@huggingface/hub';
import { buildDatasetCard, loadTrainingEnv, type HfTrainingEnv } from './lib';
import { exportApprovedDialogues } from './export-jsonl';

export type UploadOptions = {
  skipExport?: boolean;
  jsonlPath?: string;
  env?: HfTrainingEnv;
};

function toDatasetRepo(datasetId: string): RepoDesignation {
  if (datasetId.startsWith('datasets/')) {
    return datasetId as RepoDesignation;
  }
  return { type: 'dataset', name: datasetId };
}

export async function uploadTrainingDataset(
  options: UploadOptions = {},
): Promise<{ datasetId: string; count: number }> {
  const env = options.env ?? (await loadTrainingEnv());
  const jsonlPath =
    options.jsonlPath ??
    resolve(
      process.env.HF_TRAINING_JSONL_PATH ??
        resolve(__dirname, '../../../data/training/lokumu-kit-lin.jsonl'),
    );

  let count = 0;
  if (options.skipExport) {
    const raw = await readFile(jsonlPath, 'utf8');
    count = raw.trim() ? raw.trim().split('\n').length : 0;
  } else {
    const exported = await exportApprovedDialogues(jsonlPath);
    count = exported.count;
  }

  if (count < env.minDialogues) {
    throw new Error(
      `Only ${count} dialogues (minimum ${env.minDialogues}). Add more via /train before AutoTrain.`,
    );
  }

  const jsonl = await readFile(jsonlPath);

  const repo = toDatasetRepo(env.datasetId);

  await createRepo({
    repo,
    accessToken: env.token,
    visibility: 'private',
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already (exists|created)/i.test(message)) throw error;
  });

  await uploadFiles({
    repo,
    accessToken: env.token,
    files: [
      { path: 'train.jsonl', content: new Blob([jsonl]) },
      { path: 'README.md', content: new Blob([buildDatasetCard()]) },
    ],
    commitTitle: `Lokumu export (${count} dialogues)`,
  });

  return { datasetId: env.datasetId, count };
}

async function main() {
  const skipExport = process.argv.includes('--skip-export');
  const result = await uploadTrainingDataset({ skipExport });
  console.log(`Uploaded dataset: https://huggingface.co/datasets/${result.datasetId}`);
  console.log(`Rows: ${result.count}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
