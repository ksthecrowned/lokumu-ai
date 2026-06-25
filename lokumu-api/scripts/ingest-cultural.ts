import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { RagService } from '../src/rag/rag.service';
import {
  type CulturalEntry,
  CULTURAL_ENTRIES,
} from '../prisma/seed/cultural-corpus';

function isSupportedLanguage(language: string): language is CulturalEntry['language'] {
  return ['fra', 'eng', 'lin', 'kit'].includes(language);
}

function normalizeJsonEntries(input: unknown, sourcePath: string): CulturalEntry[] {
  const list = Array.isArray(input) ? input : [input];
  return list.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Invalid JSON entry at ${sourcePath} [${index}]`);
    }
    const candidate = entry as Partial<CulturalEntry>;
    if (!candidate.language || !isSupportedLanguage(candidate.language)) {
      throw new Error(`Unsupported language in ${sourcePath} [${index}]`);
    }
    if (!candidate.id || !candidate.title || !candidate.content || !candidate.type) {
      throw new Error(`Missing required fields in ${sourcePath} [${index}]`);
    }
    return {
      id: candidate.id,
      type: candidate.type,
      language: candidate.language,
      title: candidate.title,
      content: candidate.content,
      translation_fr: candidate.translation_fr,
      tags: candidate.tags ?? [],
      source: candidate.source ?? 'file-ingest',
    };
  });
}

async function loadEntries(inputDir: string): Promise<CulturalEntry[]> {
  const files = await readdir(inputDir);
  const entries: CulturalEntry[] = [];

  for (const file of files) {
    const fullPath = join(inputDir, file);
    const extension = extname(file).toLowerCase();

    if (extension === '.json') {
      const parsed = JSON.parse(await readFile(fullPath, 'utf8')) as unknown;
      entries.push(...normalizeJsonEntries(parsed, fullPath));
      continue;
    }

    if (extension === '.md' || extension === '.txt') {
      const body = (await readFile(fullPath, 'utf8')).trim();
      if (!body) continue;
      entries.push({
        id: `file-${file.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
        type: 'cultural_note',
        language: 'fra',
        title: file,
        content: body,
        tags: ['file-import'],
        source: `file://${file}`,
      });
    }
  }

  return entries;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL environment variable is not set');

  const inputDir = resolve(process.argv[2] ?? '../data/cultural');
  const adapter = new PrismaPg(dbUrl);
  const prisma = new PrismaClient({ adapter });
  const rag = new RagService(prisma as any);

  await rag.onModuleInit();
  const fileEntries = await loadEntries(inputDir);
  const allEntries = [...CULTURAL_ENTRIES, ...fileEntries];

  for (const entry of allEntries) {
    const content = entry.translation_fr
      ? `${entry.content}\n\n(FR: ${entry.translation_fr})`
      : entry.content;

    await rag.ingestDocument({
      source: `ingest://${entry.id}`,
      title: entry.title,
      language: entry.language,
      content,
      metadata: {
        type: entry.type,
        tags: entry.tags,
        source: entry.source,
      },
    });
    console.log(`Ingested: ${entry.id}`);
  }

  await rag.onModuleDestroy();
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
