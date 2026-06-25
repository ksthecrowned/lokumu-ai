import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg(databaseUrl),
  });

  try {
    const count = await prisma.chunk.count();
    console.log(`Total chunks: ${count}`);

    if (count < 2000) {
      console.warn(`WARNING: below target of 2000 (current: ${count})`);
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Failed to count corpus chunks', error);
  process.exit(1);
});
