import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { RagModule } from './rag/rag.module';
import { ModelModule } from './model/model.module';
import { AssistantModule } from './assistant/assistant.module';
import { ChatModule } from './chat/chat.module';
import { CommunityModule } from './community/community.module';
import { ConversationModule } from './conversation/conversation.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    RagModule,
    ModelModule,
    AssistantModule,
    ChatModule,
    CommunityModule,
    ConversationModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
