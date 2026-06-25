import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { AssistantModule } from '../assistant/assistant.module';

@Module({
  imports: [AssistantModule],
  providers: [ChatGateway],
})
export class ChatModule {}