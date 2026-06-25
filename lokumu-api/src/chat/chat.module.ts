import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { AssistantModule } from '../assistant/assistant.module';
import { CommunityModule } from '../community/community.module';
import { TrainingModule } from '../training/training.module';

@Module({
  imports: [AssistantModule, CommunityModule, TrainingModule],
  providers: [ChatGateway],
})
export class ChatModule {}
