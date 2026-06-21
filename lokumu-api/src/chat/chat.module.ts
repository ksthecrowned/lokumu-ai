import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [AgentModule],
  providers: [ChatGateway],
})
export class ChatModule {}