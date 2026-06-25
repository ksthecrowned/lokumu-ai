import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { RagService } from '../../src/rag/rag.service';
import { CULTURAL_ENTRIES } from './cultural-corpus';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const adapter = new PrismaPg(dbUrl);
  const prisma = new PrismaClient({ adapter });
  const rag = new RagService(prisma as any);

  await rag.onModuleInit();

  for (const entry of CULTURAL_ENTRIES) {
    const content = entry.translation_fr
      ? `${entry.content}\n\n(FR: ${entry.translation_fr})`
      : entry.content;

    await rag.ingestDocument({
      source: `seed://${entry.id}`,
      title: entry.title,
      language: entry.language,
      content,
      metadata: {
        type: entry.type,
        tags: entry.tags,
        source: entry.source,
      },
    });

    console.log(`Seeded: ${entry.id}`);
  }

  await rag.onModuleDestroy();
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
