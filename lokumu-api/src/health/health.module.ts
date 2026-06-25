import { Module } from '@nestjs/common';
import { ModelModule } from '../model/model.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RagModule } from '../rag/rag.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PrismaModule, RagModule, ModelModule],
  controllers: [HealthController],
})
export class HealthModule {}
