import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AuthModule } from '../auth/auth.module';
import { ModelModule } from '../model/model.module';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [AuthModule, ModelModule, RagModule],
  controllers: [AssistantController],
  providers: [AssistantService],
  exports: [AssistantService],
})
export class AssistantModule {}
