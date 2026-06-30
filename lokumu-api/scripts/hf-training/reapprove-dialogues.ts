import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });

  const before = await prisma.trainingDialogue.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  const result = await prisma.trainingDialogue.updateMany({
    where: { status: 'exported' },
    data: {
      status: 'approved',
      exportedAt: null,
      reviewedAt: new Date(),
    },
  });

  const after = await prisma.trainingDialogue.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  console.log('Before:', before);
  console.log(`Re-approved ${result.count} exported dialogues.`);
  console.log('After:', after);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
