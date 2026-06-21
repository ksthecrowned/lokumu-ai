import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { ModelModule } from '../model/model.module';
import { RagModule } from '../rag/rag.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [ModelModule, RagModule],
  controllers: [AgentController],
  providers: [AgentService, PrismaService],
  exports: [AgentService],
})
export class AgentModule {}