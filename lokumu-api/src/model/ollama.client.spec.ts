import { OllamaClient } from './ollama.client';

describe('OllamaClient', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('calls Ollama chat API', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: 'Mbote!' } }),
    });
    (global as any).fetch = fetchMock;

    const client = new OllamaClient('http://localhost:11434');
    const result = await client.chat('qwen3.5', [
      { role: 'user', content: 'Bonjour' },
    ]);

    expect(result).toBe('Mbote!');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('checks model availability with tags API', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [{ name: 'qwen3.5:latest' }, { name: 'deepseek-coder:latest' }],
      }),
    });
    (global as any).fetch = fetchMock;

    const client = new OllamaClient('http://localhost:11434');
    await expect(client.hasModel('qwen3.5')).resolves.toBe(true);
    await expect(client.hasModel('llama3')).resolves.toBe(false);
  });
});
