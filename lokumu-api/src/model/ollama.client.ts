export type OllamaMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type OllamaChatOptions = {
  temperature?: number;
  stream?: boolean;
  timeoutMs?: number;
};

export class OllamaClient {
  private readonly timeoutMs: number;

  constructor(
    private readonly baseUrl = process.env.OLLAMA_BASE_URL ??
      'http://localhost:11434',
    timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS ?? 180_000),
  ) {
    this.timeoutMs = Number.isFinite(timeoutMs) ? timeoutMs : 180_000;
  }

  async chat(
    model: string,
    messages: OllamaMessage[],
    options: OllamaChatOptions = {},
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { temperature: options.temperature ?? 0.7 },
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`ollama_unavailable:${response.status}`);
    }

    const payload = (await response.json()) as {
      message?: { content?: string };
    };
    return payload.message?.content ?? '';
  }

  async *chatStream(
    model: string,
    messages: OllamaMessage[],
    options: OllamaChatOptions = {},
  ): AsyncGenerator<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: { temperature: options.temperature ?? 0.7 },
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? this.timeoutMs),
    });

    if (!response.ok || !response.body) {
      throw new Error(`ollama_unavailable:${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const parsed = JSON.parse(line) as {
          message?: { content?: string };
          done?: boolean;
        };
        if (parsed.message?.content) {
          yield parsed.message.content;
        }
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3_000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async hasModel(name: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3_000),
      });
      if (!response.ok) return false;
      const payload = (await response.json()) as {
        models?: Array<{ name?: string }>;
      };
      return (payload.models ?? []).some((model) =>
        (model.name ?? '').startsWith(name),
      );
    } catch {
      return false;
    }
  }
}
