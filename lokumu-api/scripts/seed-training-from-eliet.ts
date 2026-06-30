import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

type TrainingTurn = { role: 'user' | 'assistant'; content: string };

type SeedDialogue = {
  title: string;
  language: 'kit' | 'lin';
  turns: TrainingTurn[];
  tags: string[];
  source: string;
};

function repoRoot(): string {
  return resolve(__dirname, '../..');
}

function cleanElietTokens(line: string): string {
  return line
    .replace(/(\p{L})\d+/gu, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDialogueLines(content: string): TrainingTurn[] {
  const turns: TrainingTurn[] = [];
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    const match = line.match(/^([AB]):\s*(.+)$/i);
    if (!match) continue;
    turns.push({
      role: match[1].toUpperCase() === 'A' ? 'user' : 'assistant',
      content: match[2].trim(),
    });
  }
  return turns;
}

function parseMarkdownTablePairs(
  markdown: string,
): Array<{ fr: string; kit: string }> {
  const pairs: Array<{ fr: string; kit: string }> = [];
  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || trimmed.includes('---')) continue;
    const cols = trimmed
      .split('|')
      .map((col) => col.trim())
      .filter(Boolean);
    if (cols.length < 2) continue;
    const fr = cols[0];
    const kit = cols[cols.length - 1];
    if (!fr || !kit || /^comment/i.test(fr)) continue;
    pairs.push({ fr, kit });
  }
  return pairs;
}

function parseBilingualExamples(markdown: string): Array<{ fr: string; kit: string }> {
  const pairs: Array<{ fr: string; kit: string }> = [];
  const lines = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#') && !line.startsWith('---'));

  for (let index = 0; index < lines.length - 1; index += 1) {
    const current = lines[index];
    const next = lines[index + 1];
    if (current.startsWith('|') || next.startsWith('|')) continue;
    if (/^N\.B\./i.test(current) || /^Litt\./i.test(current)) continue;
    if (!/[àâäéèêëïîôùûç]/i.test(current) && !/\b(je|tu|nous|il|la|le|pas)\b/i.test(current)) {
      continue;
    }
    if (!/\b(ke|me|na|mu|nge|betu|yandi|mbote|ve)\b/i.test(next)) continue;
    pairs.push({
      fr: cleanElietTokens(current.replace(/\s*-\s*.+$/, '')),
      kit: cleanElietTokens(next.replace(/\s*-\s*.+$/, '')),
    });
    index += 1;
  }
  return pairs;
}

function parseInlineQa(markdown: string): Array<{ fr: string; kit: string }> {
  const pairs: Array<{ fr: string; kit: string }> = [];
  const qaRegex = /([^\n?]{4,}\?)\s*[-–—]\s*([^\n]+)/g;
  for (const match of markdown.matchAll(qaRegex)) {
    const fr = cleanElietTokens(match[1]);
    const kit = cleanElietTokens(match[2]);
    if (fr && kit && /\b(ke|mu|nge|e[, ]|mbote)\b/i.test(kit)) {
      pairs.push({ fr, kit });
    }
  }
  return pairs;
}

async function loadDialogueJsonSeeds(): Promise<SeedDialogue[]> {
  const dir = join(repoRoot(), 'data/cultural/dialogues');
  const files = (await readdir(dir)).filter((file) => file.endsWith('.json'));
  const seeds: SeedDialogue[] = [];

  for (const file of files) {
    if (file.includes('comparative')) continue;
    const raw = JSON.parse(await readFile(join(dir, file), 'utf8')) as Array<{
      title: string;
      language: string;
      content: string;
      tags?: string[];
      source?: string;
    }>;

    for (const entry of raw) {
      const turns = parseDialogueLines(entry.content);
      if (turns.length < 2) continue;
      seeds.push({
        title: entry.title,
        language: entry.language === 'lin' ? 'lin' : 'kit',
        turns,
        tags: [...(entry.tags ?? []), 'greeting', 'corpus-seed'],
        source: entry.source ?? `corpus://${file}`,
      });
    }
  }

  return seeds;
}

async function loadElietSeeds(): Promise<SeedDialogue[]> {
  const processedDir = join(repoRoot(), 'data/cultural/processed/eliet-1953');
  const files = await readdir(processedDir);
  const seeds: SeedDialogue[] = [];

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const markdown = await readFile(join(processedDir, file), 'utf8');
    const section = file.replace(/\.md$/, '');

    for (const { fr, kit } of parseMarkdownTablePairs(markdown)) {
      seeds.push({
        title: `Lexique: ${fr.slice(0, 60)}`,
        language: 'kit',
        turns: [
          { role: 'user', content: `Comment dit-on « ${fr.replace(/\?$/, '')} » en kituba ?` },
          { role: 'assistant', content: kit },
        ],
        tags: ['translation', 'kituba', 'eliet-1953', section],
        source: `eliet-1953://${section}`,
      });
    }

    for (const { fr, kit } of [
      ...parseInlineQa(markdown),
      ...parseBilingualExamples(markdown),
    ]) {
      if (fr.length < 4 || kit.length < 3) continue;
      seeds.push({
        title: `Eliet: ${fr.slice(0, 50)}`,
        language: 'kit',
        turns: [
          { role: 'user', content: fr.endsWith('?') ? fr : `${fr}?` },
          { role: 'assistant', content: kit },
        ],
        tags: ['grammar', 'kituba', 'eliet-1953', section],
        source: `eliet-1953://${section}`,
      });
    }
  }

  return seeds;
}

function dedupeSeeds(seeds: SeedDialogue[]): SeedDialogue[] {
  const seen = new Set<string>();
  return seeds.filter((seed) => {
    const key = `${seed.language}:${seed.turns.map((turn) => turn.content).join('|')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
  const dialogueSeeds = await loadDialogueJsonSeeds();
  const elietSeeds = await loadElietSeeds();
  const seeds = dedupeSeeds([...dialogueSeeds, ...elietSeeds]);

  const reapprove = process.argv.includes('--reapprove');

  if (reapprove) {
    const reset = await prisma.trainingDialogue.updateMany({
      where: { status: 'exported' },
      data: { status: 'approved', exportedAt: null, reviewedAt: new Date() },
    });
    console.log(`Re-approved ${reset.count} exported dialogues.`);
  }

  let inserted = 0;
  let skipped = 0;

  for (const seed of seeds) {
    const existing = await prisma.trainingDialogue.findFirst({
      where: {
        title: seed.title,
        language: seed.language,
      },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.trainingDialogue.create({
      data: {
        title: seed.title,
        language: seed.language,
        turns: seed.turns,
        tags: seed.tags,
        source: seed.source,
        status: 'approved',
        reviewedAt: new Date(),
      },
    });
    inserted += 1;
  }

  const approved = await prisma.trainingDialogue.count({
    where: { status: 'approved' },
  });

  console.log(`Dialogue JSON seeds: ${dialogueSeeds.length}`);
  console.log(`Eliet-derived seeds: ${elietSeeds.length}`);
  console.log(`Unique seeds: ${seeds.length}`);
  console.log(`Inserted: ${inserted}, skipped (existing): ${skipped}`);
  console.log(`Approved dialogues in DB: ${approved}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
