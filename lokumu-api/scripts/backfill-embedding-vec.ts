import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { RagService } from '../src/rag/rag.service';

const EMBEDDING_BYTES = 1024 * 4;

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const adapter = new PrismaPg(dbUrl);
  const prisma = new PrismaClient({ adapter });
  const rag = new RagService(prisma as any);
  await rag.onModuleInit();

  const chunks = await prisma.chunk.findMany({
    select: { id: true, content: true, embedding: true },
  });

  let copied = 0;
  let regenerated = 0;

  for (const chunk of chunks) {
    const bytes = Buffer.from(chunk.embedding);
    let vectorLiteral: string;

    if (bytes.byteLength === EMBEDDING_BYTES) {
      const floats = new Float32Array(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength / 4,
      );
      vectorLiteral = `[${Array.from(floats).join(',')}]`;
      copied += 1;
    } else {
      const embedding = await rag.generateEmbedding(chunk.content);
      vectorLiteral = `[${embedding.join(',')}]`;
      regenerated += 1;
    }

    await prisma.$executeRawUnsafe(
      'UPDATE "Chunk" SET "embedding_vec" = $1::vector WHERE "id" = $2',
      vectorLiteral,
      chunk.id,
    );
  }

  const [{ n }] = await prisma.$queryRawUnsafe<{ n: number }[]>(
    'SELECT COUNT(*)::int AS n FROM "Chunk" WHERE "embedding_vec" IS NOT NULL',
  );

  console.log(
    `Backfill done: ${copied} copied, ${regenerated} regenerated, ${n} total with embedding_vec`,
  );

  await rag.onModuleDestroy();
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
