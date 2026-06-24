import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { RagModule } from './rag/rag.module';
import { ModelModule } from './model/model.module';
import { AgentModule } from './agent/agent.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [PrismaModule, AuthModule, RagModule, ModelModule, AgentModule, ChatModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
