import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { AssistantModule } from '../assistant/assistant.module';
import { CommunityModule } from '../community/community.module';

@Module({
  imports: [AssistantModule, CommunityModule],
  providers: [ChatGateway],
})
export class ChatModule {}