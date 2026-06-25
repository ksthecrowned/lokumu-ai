import { AssistantService } from './assistant.service';

jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn(),
}));

describe('AssistantService', () => {
  const modelService = {
    generate: jest.fn().mockResolvedValue('Réponse locale'),
  };
  const ragService = {
    search: jest.fn().mockResolvedValue([
      {
        id: 'chunk-1',
        content: 'Mbote na yo',
        metadata: { title: 'Salutations', type: 'greeting', source: 'seed://1' },
        language: 'lin',
        score: 0.7,
        community: false,
      },
    ]),
  };

  it('returns chat-only response payload', async () => {
    const service = new AssistantService(modelService as any, ragService as any);
    const result = await service.processRequest(
      'Donne-moi un proverbe lingala',
      'lin',
    );
    expect(result.mode).toBe('chat');
    expect(result.response).toBe('Réponse locale');
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.messageId).toBeDefined();
    expect(result.conversationId).toBeDefined();
  });
});