import { access, readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

type CorpusSeedEntry = {
  id: string;
  type: string;
  language: string;
  title: string;
  content: string;
  translation_fr?: string;
  tags: string[];
  source: string;
};

async function resolveDialoguesDir(): Promise<string> {
  const candidates = [
    resolve(process.cwd(), 'data/cultural/dialogues'),
    resolve(process.cwd(), '../data/cultural/dialogues'),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try next candidate path.
    }
  }

  throw new Error('Unable to find data/cultural/dialogues from current working directory');
}

async function main() {
  const dir = await resolveDialoguesDir();
  const files = (await readdir(dir))
    .filter((file) => file.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));

  let totalEntries = 0;

  for (const file of files) {
    const raw = await readFile(join(dir, file), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    const typedEntries = entries as CorpusSeedEntry[];
    totalEntries += typedEntries.length;
    console.log(`${file}: ${typedEntries.length} entries`);
  }

  console.log(`Dialogue seed files: ${files.length}, entries: ${totalEntries}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
