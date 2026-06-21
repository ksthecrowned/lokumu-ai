import { Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [RagService, PrismaService],
  controllers: [RagController],
})
export class RagModule {}