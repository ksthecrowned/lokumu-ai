import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeLanguage } from '../shared/i18n/languages';

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateDemoUser(): Promise<string> {
    const email = 'demo@lokumu.local';
    const user = await this.prisma.user.upsert({
      where: { email },
      create: { email, language: 'fr' },
      update: {},
    });
    return user.id;
  }

  async resolveConversation(
    conversationId: string | undefined,
    language: string,
  ): Promise<{ id: string; isNew: boolean }> {
    if (conversationId) {
      const existing = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      if (existing) {
        return { id: existing.id, isNew: false };
      }
    }

    const userId = await this.getOrCreateDemoUser();
    const created = await this.prisma.conversation.create({
      data: {
        userId,
        language: normalizeLanguage(language),
      },
    });

    return { id: created.id, isNew: true };
  }

  async appendMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    language: string,
    usedChunkIds: string[] = [],
  ): Promise<string> {
    const message = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        role,
        content,
        language: normalizeLanguage(language),
        usedChunkIds,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message.id;
  }

  async getRecentHistory(
    conversationId: string,
    limit: number,
  ): Promise<Array<{ role: string; content: string }>> {
    const rows = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return rows.reverse().map((row) => ({
      role: row.role,
      content: row.content,
    }));
  }

  async maybeSetTitle(
    conversationId: string,
    firstUserPrompt: string,
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.title !== 'Nouvelle conversation') {
      return;
    }

    const title = firstUserPrompt.trim().slice(0, 60) || 'Conversation';
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
    });
  }
}
