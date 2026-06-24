import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AuthModule } from '../auth/auth.module';
import { ModelModule } from '../model/model.module';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [AuthModule, ModelModule, RagModule],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
