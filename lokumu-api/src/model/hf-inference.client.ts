import { OllamaMessage } from './ollama.client';

export type HfInferenceConfig = {
  token: string;
  modelId: string;
  baseUrl?: string;
  timeoutMs?: number;
};

export class HfInferenceClient {
  constructor(private readonly config: HfInferenceConfig) {}

  resolveChatUrl(): string {
    const endpoint = process.env.HF_ENDPOINT_URL?.trim();
    if (endpoint) {
      return `${endpoint.replace(/\/$/, '')}/v1/chat/completions`;
    }

    const override =
      this.config.baseUrl ?? process.env.HF_INFERENCE_URL?.trim();
    if (override) {
      const base = override.replace(/\/$/, '');
      return base.endsWith('/v1/chat/completions')
        ? base
        : `${base}/v1/chat/completions`;
    }

    return 'https://router.huggingface.co/v1/chat/completions';
  }

  async chat(
    messages: OllamaMessage[],
    options: { temperature?: number; maxTokens?: number } = {},
  ): Promise<string> {
    const response = await fetch(this.resolveChatUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.modelId,
        messages,
        max_tokens: options.maxTokens ?? 512,
        temperature: options.temperature ?? 0.7,
      }),
      signal: AbortSignal.timeout(
        this.config.timeoutMs ?? Number(process.env.HF_TIMEOUT_MS ?? 120_000),
      ),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `hf_unavailable:${response.status}:${body.slice(0, 200)}`,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('hf_unavailable:empty_response');
    }
    return content;
  }
}
