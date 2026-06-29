import { ModelService } from './model.service';
import { OllamaClient } from './ollama.client';
import { HfInferenceClient } from './hf-inference.client';

describe('ModelService', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('falls back to smaller model when primary times out', async () => {
    const timeoutError = new Error('timeout');
    timeoutError.name = 'TimeoutError';
    const chat = jest
      .fn()
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce('Reponse fallback');
    const hasModel = jest.fn().mockResolvedValue(true);

    jest.spyOn(OllamaClient.prototype, 'chat').mockImplementation(chat);
    jest.spyOn(OllamaClient.prototype, 'hasModel').mockImplementation(hasModel);

    const service = new ModelService();
    const response = await service.generate('Bonjour', {
      model: 'qwen3:32b',
      systemPrompt: 'Tu es Lokumu',
    });

    expect(response).toBe('Reponse fallback');
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it('chatWithHistory sends full message array to Ollama', async () => {
    const hasModel = jest.fn().mockResolvedValue(true);
    const chat = jest.fn().mockResolvedValue('Mbote!');

    jest.spyOn(OllamaClient.prototype, 'hasModel').mockImplementation(hasModel);
    jest.spyOn(OllamaClient.prototype, 'chat').mockImplementation(chat);

    const service = new ModelService();
    const messages = [
      { role: 'system' as const, content: 'Tu es Lokumu' },
      { role: 'user' as const, content: 'Mbote' },
    ];

    const result = await service.chatWithHistory(messages);

    expect(result).toBe('Mbote!');
    expect(chat).toHaveBeenCalledWith(
      expect.any(String),
      messages,
      expect.objectContaining({ temperature: 0.7 }),
    );
  });

  it('chatWithHistoryStream yields chunks from Ollama stream', async () => {
    const hasModel = jest.fn().mockResolvedValue(true);
    async function* fakeStream() {
      yield 'Mbo';
      yield 'te';
    }
    const chatStream = jest.fn().mockReturnValue(fakeStream());

    jest.spyOn(OllamaClient.prototype, 'hasModel').mockImplementation(hasModel);
    jest
      .spyOn(OllamaClient.prototype, 'chatStream')
      .mockImplementation(chatStream);

    const service = new ModelService();
    const messages = [{ role: 'user' as const, content: 'Mbote' }];

    const chunks: string[] = [];
    for await (const chunk of service.chatWithHistoryStream(messages)) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Mbo', 'te']);
    expect(chatStream).toHaveBeenCalledWith(
      expect.any(String),
      messages,
      expect.objectContaining({ temperature: 0.7 }),
    );
  });

  it('uses HF client when LLM_PROVIDER=hf', async () => {
    process.env.LLM_PROVIDER = 'hf';
    process.env.HF_TOKEN = 'hf_test';
    process.env.HF_MODEL_ID = 'Svngoku/aya-23-8b-afrimmlu-lin';

    const hfChat = jest.fn().mockResolvedValue('Mbote na yo!');
    jest.spyOn(HfInferenceClient.prototype, 'chat').mockImplementation(hfChat);

    const service = new ModelService();
    const result = await service.chatWithHistory([
      { role: 'user', content: 'Mbote' },
    ]);

    expect(result).toBe('Mbote na yo!');
    expect(hfChat).toHaveBeenCalled();
  });
});
