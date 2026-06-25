import { ConversationService } from './conversation.service';

describe('ConversationService', () => {
  const prisma = {
    user: { upsert: jest.fn() },
    conversation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    chatMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.upsert.mockResolvedValue({ id: 'demo-user-1' });
    prisma.conversation.create.mockResolvedValue({ id: 'conv-1' });
    prisma.conversation.findUnique.mockResolvedValue(null);
    prisma.conversation.update.mockResolvedValue({ id: 'conv-1' });
    prisma.chatMessage.create.mockResolvedValue({ id: 'msg-1' });
    prisma.chatMessage.findMany.mockResolvedValue([]);
  });

  it('creates a new conversation when id is missing', async () => {
    const service = new ConversationService(prisma as any);
    const result = await service.resolveConversation(undefined, 'kit');

    expect(result.isNew).toBe(true);
    expect(result.id).toBe('conv-1');
    expect(prisma.conversation.create).toHaveBeenCalled();
  });

  it('returns existing conversation when id exists', async () => {
    prisma.conversation.findUnique.mockResolvedValue({ id: 'conv-existing' });
    const service = new ConversationService(prisma as any);

    const result = await service.resolveConversation('conv-existing', 'fr');

    expect(result).toEqual({ id: 'conv-existing', isNew: false });
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });

  it('upserts and returns demo user id', async () => {
    const service = new ConversationService(prisma as any);

    const userId = await service.getOrCreateDemoUser();

    expect(userId).toBe('demo-user-1');
    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { email: 'demo@lokumu.local' },
      create: { email: 'demo@lokumu.local', language: 'fr' },
      update: {},
    });
  });

  it('appends message and bumps conversation updatedAt', async () => {
    const service = new ConversationService(prisma as any);

    const messageId = await service.appendMessage(
      'conv-1',
      'assistant',
      'Mbote',
      'lin',
      ['chunk-1'],
    );

    expect(messageId).toBe('msg-1');
    expect(prisma.chatMessage.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conv-1',
        role: 'assistant',
        content: 'Mbote',
        language: 'lin',
        usedChunkIds: ['chunk-1'],
      },
    });
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it('returns recent history in chronological order', async () => {
    prisma.chatMessage.findMany.mockResolvedValue([
      { role: 'assistant', content: 'B' },
      { role: 'user', content: 'A' },
    ]);
    const service = new ConversationService(prisma as any);

    const history = await service.getRecentHistory('conv-1', 2);

    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
      where: { conversationId: 'conv-1' },
      orderBy: { timestamp: 'desc' },
      take: 2,
    });
    expect(history).toEqual([
      { role: 'user', content: 'A' },
      { role: 'assistant', content: 'B' },
    ]);
  });

  it('sets title from first user prompt only for default titles', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv-1',
      title: 'Nouvelle conversation',
    });
    const service = new ConversationService(prisma as any);

    await service.maybeSetTitle('conv-1', '   Prompt title   ');

    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: { title: 'Prompt title' },
    });
  });

  it('does not set title when conversation already renamed', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv-1',
      title: 'Custom title',
    });
    const service = new ConversationService(prisma as any);

    await service.maybeSetTitle('conv-1', 'Should not apply');

    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });
});
