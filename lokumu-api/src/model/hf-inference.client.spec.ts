import { HfInferenceClient } from './hf-inference.client';

describe('HfInferenceClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.HF_ENDPOINT_URL;
    delete process.env.HF_INFERENCE_URL;
  });

  it('calls chat completions API and returns assistant content', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Mbote!' } }],
      }),
    }) as jest.Mock;

    const client = new HfInferenceClient({
      token: 'hf_test',
      modelId: 'Svngoku/aya-23-8b-afrimmlu-lin',
    });

    const result = await client.chat([{ role: 'user', content: 'Mbote' }]);

    expect(result).toBe('Mbote!');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api-inference.huggingface.co/models/Svngoku/aya-23-8b-afrimmlu-lin/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer hf_test',
        }),
      }),
    );
  });

  it('uses HF_ENDPOINT_URL when set', () => {
    process.env.HF_ENDPOINT_URL = 'https://xyz.us-east-1.aws.endpoints.huggingface.cloud';

    const client = new HfInferenceClient({
      token: 'hf_test',
      modelId: 'lokumu/lokumu-kit-lin',
    });

    expect(client.resolveChatUrl()).toBe(
      'https://xyz.us-east-1.aws.endpoints.huggingface.cloud/v1/chat/completions',
    );
  });

  it('throws hf_unavailable on HTTP error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'model loading',
    }) as jest.Mock;

    const client = new HfInferenceClient({
      token: 'hf_test',
      modelId: 'test/model',
    });

    await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(
      'hf_unavailable:503',
    );
  });
});
