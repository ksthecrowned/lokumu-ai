import { AssistantService } from './assistant.service';

jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn(),
}));

describe('AssistantService', () => {
  const ragResults = [
    {
      id: 'chunk-1',
      content:
        'Mosapi moko ekokanga te nse.\n\n(FR: Un seul doigt ne peut pas ecraser un pou.)',
      metadata: {
        title: 'Un seul doigt ne tue pas un pou',
        type: 'proverb',
        source: 'seed://1',
      },
      language: 'lin',
      score: 0.7,
      community: false,
    },
  ];

  const ragService = {
    search: jest.fn().mockResolvedValue(ragResults),
    rerankByMetadata: jest.fn().mockImplementation((rows: any[]) => rows),
  };

  const conversationService = {
    resolveConversation: jest
      .fn()
      .mockResolvedValue({ id: 'conv-1', isNew: false }),
    appendMessage: jest.fn().mockResolvedValue('msg-1'),
    getRecentHistory: jest.fn().mockResolvedValue([]),
    maybeSetTitle: jest.fn().mockResolvedValue(undefined),
  };

  const modelService = {
    chatWithHistory: jest.fn().mockResolvedValue('Mbote! Nazali malamu.'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns grounded proverb from corpus for high-confidence matches', async () => {
    ragService.search.mockResolvedValueOnce([
      {
        ...ragResults[0],
        score: 0.92,
      },
    ]);
    const service = new AssistantService(
      ragService as any,
      conversationService as any,
      modelService as any,
    );
    const result = await service.processRequest(
      'Donne-moi un proverbe lingala',
      'fra',
      'conv-1',
    );

    expect(result.mode).toBe('chat');
    expect(result.response).toContain('Mosapi moko ekokanga te nse.');
    expect(result.sources).toHaveLength(1);
    expect(modelService.chatWithHistory).not.toHaveBeenCalled();
    expect(conversationService.appendMessage).toHaveBeenCalledTimes(2);
    expect(result.messageId).toBe('msg-1');
    expect(result.conversationId).toBe('conv-1');
  });

  it('calls ModelService for non-fast-path queries', async () => {
    ragService.search.mockResolvedValueOnce([
      {
        ...ragResults[0],
        score: 0.6,
      },
    ]);
    const service = new AssistantService(
      ragService as any,
      conversationService as any,
      modelService as any,
    );

    const result = await service.processRequest(
      'Parle-moi de la culture congolaise',
      'fra',
      'c1',
    );

    expect(modelService.chatWithHistory).toHaveBeenCalled();
    expect(result.response).toContain('Mbote');
    expect(result.conversationId).toBe('conv-1');
  });

  it('falls back to demo response when ollama chat fails', async () => {
    ragService.search.mockResolvedValueOnce([]);
    modelService.chatWithHistory.mockRejectedValueOnce(
      new Error('ollama_unavailable'),
    );
    const service = new AssistantService(
      ragService as any,
      conversationService as any,
      modelService as any,
    );

    const result = await service.processRequest('Bonjour', 'fra', 'c1');

    expect(modelService.chatWithHistory).toHaveBeenCalled();
    expect(result.response).toContain('assistant culturel congolais');
  });
});
