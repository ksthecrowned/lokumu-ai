import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { getSystemPrompt } from '../src/prompts/multilingual';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
  const rows = await prisma.trainingDialogue.findMany({ where: { status: 'approved' } });
  const lines: string[] = [];

  for (const row of rows) {
    const turns = row.turns as Array<{ role: string; content: string }>;
    const messages = [
      { role: 'system', content: getSystemPrompt(row.language) },
      ...turns.map((t) => ({ role: t.role, content: t.content })),
    ];
    lines.push(JSON.stringify({ messages, language: row.language }));
  }

  const outPath = resolve('../data/training/lokumu-kit-lin.jsonl');
  await mkdir(resolve('../data/training'), { recursive: true });
  await writeFile(outPath, lines.join('\n') + '\n');

  await prisma.trainingDialogue.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { status: 'exported', exportedAt: new Date() },
  });

  console.log(`Exported ${lines.length} dialogues to ${outPath}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
