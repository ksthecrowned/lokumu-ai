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

interface IngestEntry {
  id: string;
  type: string;
  language: CulturalEntry['language'];
  title: string;
  content: string;
  translation_fr?: string;
  tags: string[];
  source: string;
  metadata?: Record<string, unknown>;
}

function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
  if (!raw.startsWith('---\n')) return { meta: {}, body: raw };
  const end = raw.indexOf('\n---\n', 4);
  if (end === -1) return { meta: {}, body: raw };
  const header = raw.slice(4, end);
  const body = raw.slice(end + 5);
  const meta: Record<string, unknown> = {};
  for (const line of header.split('\n')) {
    const [key, ...rest] = line.split(':');
    if (!key || rest.length === 0) continue;
    const value = rest.join(':').trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      meta[key.trim()] = value
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      continue;
    }
    meta[key.trim()] = value;
  }
  return { meta, body };
}

function splitLexiconEntries(body: string): string[] {
  const tableRows = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && !/^[-| ]+$/.test(line.replace(/-/g, '')));

  const parsedRows = tableRows
    .map((line) => {
      const columns = line
        .split('|')
        .map((part) => part.trim())
        .filter(Boolean);
      return columns.length >= 2 ? `${columns[0]} => ${columns[1]}` : '';
    })
    .filter((line) => line.length > 20);

  if (parsedRows.length > 0) return parsedRows;

  return body.split(/(?<=[.;?!])\s+/).filter((s) => s.trim().length > 20);
}

function estimateTokenCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function sanitizeIdFragment(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function toLanguage(value: unknown): CulturalEntry['language'] {
  if (typeof value === 'string' && isSupportedLanguage(value)) return value;
  return 'fra';
}

function metadataLanguages(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string') return [value];
  return [];
}

function normalizeJsonEntries(input: unknown, sourcePath: string): IngestEntry[] {
  const list = Array.isArray(input) ? input : [input];
  return list.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Invalid JSON entry at ${sourcePath} [${index}]`);
    }
    const candidate = entry as Record<string, unknown>;
    if (!candidate.language || typeof candidate.language !== 'string') {
      throw new Error(`Unsupported language in ${sourcePath} [${index}]`);
    }
    if (
      !candidate.id ||
      typeof candidate.id !== 'string' ||
      !candidate.title ||
      typeof candidate.title !== 'string' ||
      !candidate.content ||
      typeof candidate.content !== 'string' ||
      !candidate.type ||
      typeof candidate.type !== 'string'
    ) {
      throw new Error(`Missing required fields in ${sourcePath} [${index}]`);
    }
    return {
      id: candidate.id,
      type: candidate.type,
      language: toLanguage(candidate.language),
      title: candidate.title,
      content: candidate.content,
      translation_fr:
        typeof candidate.translation_fr === 'string' ? candidate.translation_fr : undefined,
      tags: Array.isArray(candidate.tags)
        ? candidate.tags.filter((tag): tag is string => typeof tag === 'string')
        : [],
      source: typeof candidate.source === 'string' ? candidate.source : 'file-ingest',
    };
  });
}

async function loadProcessedEntries(inputDir: string): Promise<IngestEntry[]> {
  const processedDir = join(inputDir, 'processed', 'eliet-1953');
  const files = (await readdir(processedDir))
    .filter((file) => extname(file).toLowerCase() === '.md')
    .sort();
  const entries: IngestEntry[] = [];

  for (const file of files) {
    const fullPath = join(processedDir, file);
    const raw = await readFile(fullPath, 'utf8');
    if (!raw.trim()) continue;

    const { meta, body } = parseFrontmatter(raw);
    const type = typeof meta.type === 'string' ? meta.type : 'grammar';
    const section = typeof meta.section === 'string' ? meta.section : file.replace(/\.md$/i, '');
    const source =
      typeof meta.source === 'string' ? meta.source : `eliet-1953://${file.replace(/\.md$/i, '')}`;
    const languages = metadataLanguages(meta.languages);
    const language = toLanguage(languages[0]);
    const normalizedBody = body.trim();

    if (!normalizedBody) continue;

    if (type === 'lexicon') {
      const lexiconEntries = splitLexiconEntries(normalizedBody);
      lexiconEntries.forEach((chunk, index) => {
        entries.push({
          id: `processed-${sanitizeIdFragment(section)}-${index + 1}`,
          type: 'lexicon',
          language,
          title: `${section} (${index + 1})`,
          content: chunk,
          tags: ['processed', 'eliet-1953', 'lexicon'],
          source,
          metadata: { type: 'lexicon', languages, section, source },
        });
      });
      continue;
    }

    if (type === 'grammar' && estimateTokenCount(normalizedBody) > 800) {
      const paragraphs = normalizedBody
        .split(/\n\s*\n/g)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);
      paragraphs.forEach((chunk, index) => {
        entries.push({
          id: `processed-${sanitizeIdFragment(section)}-${index + 1}`,
          type: 'grammar',
          language,
          title: `${section} (${index + 1})`,
          content: chunk,
          tags: ['processed', 'eliet-1953', 'grammar'],
          source,
          metadata: { type: 'grammar', languages, section, source },
        });
      });
      continue;
    }

    entries.push({
      id: `processed-${sanitizeIdFragment(section)}`,
      type: typeof type === 'string' ? type : 'grammar',
      language,
      title: section,
      content: normalizedBody,
      tags: ['processed', 'eliet-1953'],
      source,
      metadata: { type, languages, section, source },
    });
  }

  return entries;
}

async function loadEntries(inputDir: string): Promise<IngestEntry[]> {
  const files = await readdir(inputDir);
  const entries: IngestEntry[] = [];

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
        id: `file-${sanitizeIdFragment(file)}`,
        type: 'cultural_note',
        language: 'fra',
        title: file,
        content: body,
        tags: ['file-import'],
        source: `file://${file}`,
      });
    }
  }

  const dialogueDir = join(inputDir, 'dialogues');
  const dialogueFiles = (await readdir(dialogueDir))
    .filter((file) => extname(file).toLowerCase() === '.json')
    .sort();
  for (const file of dialogueFiles) {
    const fullPath = join(dialogueDir, file);
    const parsed = JSON.parse(await readFile(fullPath, 'utf8')) as unknown;
    entries.push(...normalizeJsonEntries(parsed, fullPath));
  }

  entries.push(...(await loadProcessedEntries(inputDir)));

  return entries;
}

async function main() {
  if (process.env.INGEST_TRANSPILE_ONLY === '1') {
    console.log('Transpile-only check passed.');
    return;
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL environment variable is not set');

  const inputDir = resolve(process.argv[2] ?? '../data/cultural');
  const adapter = new PrismaPg(dbUrl);
  const prisma = new PrismaClient({ adapter });
  const rag = new RagService(prisma as any);

  await rag.onModuleInit();
  const fileEntries = await loadEntries(inputDir);
  const allEntries = [...CULTURAL_ENTRIES, ...fileEntries];
  let ingestedCount = 0;

  for (const entry of allEntries) {
    const metadata = 'metadata' in entry ? entry.metadata : undefined;
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
        ...(metadata ?? {}),
      },
    });
    ingestedCount += 1;
    console.log(`Ingested: ${entry.id}`);
  }
  console.log(`Ingested total chunks: ${ingestedCount}`);

  await rag.onModuleDestroy();
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
