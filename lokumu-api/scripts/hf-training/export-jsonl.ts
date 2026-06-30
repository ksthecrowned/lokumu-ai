import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { getSystemPrompt } from '../../src/prompts/multilingual';

export type ExportResult = {
  path: string;
  count: number;
  dialogueIds: string[];
};

export async function exportApprovedDialogues(
  outPath = resolve(__dirname, '../../../data/training/lokumu-kit-lin.jsonl'),
  markExported = true,
): Promise<ExportResult> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
  const rows = await prisma.trainingDialogue.findMany({
    where: { status: 'approved' },
    orderBy: { createdAt: 'asc' },
  });

  const lines: string[] = [];
  for (const row of rows) {
    const turns = row.turns as Array<{ role: string; content: string }>;
    const messages = [
      { role: 'system', content: getSystemPrompt(row.language) },
      ...turns.map((turn) => ({ role: turn.role, content: turn.content })),
    ];
    lines.push(JSON.stringify({ messages, language: row.language }));
  }

  await mkdir(resolve(outPath, '..'), { recursive: true });
  if (lines.length === 0) {
    console.warn(
      `No approved dialogues to export — leaving existing file untouched: ${outPath}`,
    );
  } else {
    await writeFile(outPath, `${lines.join('\n')}\n`);
  }

  if (markExported && rows.length > 0) {
    await prisma.trainingDialogue.updateMany({
      where: { id: { in: rows.map((row) => row.id) } },
      data: { status: 'exported', exportedAt: new Date() },
    });
  }

  await prisma.$disconnect();

  return {
    path: outPath,
    count: lines.length,
    dialogueIds: rows.map((row) => row.id),
  };
}
