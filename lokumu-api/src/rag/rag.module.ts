import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';

@Module({
  imports: [PrismaModule],
  providers: [RagService],
  controllers: [RagController],
  exports: [RagService],
})
export class RagModule {}