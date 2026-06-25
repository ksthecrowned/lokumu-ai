import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OllamaClient, OllamaMessage } from './ollama.client';

@Injectable()
export class ModelService implements OnModuleInit {
  private readonly logger = new Logger(ModelService.name);
  private readonly ollama = new OllamaClient();
  private readonly primaryModel = process.env.OLLAMA_MODEL ?? 'qwen3:32b';
  private readonly fallbackModel =
    process.env.OLLAMA_FALLBACK_MODEL ?? 'qwen2.5-coder:1.5b';

  async onModuleInit() {
    const available = await this.ollama.isAvailable();
    if (!available) {
      this.logger.warn(
        'Ollama is unavailable on startup. Expected at OLLAMA_BASE_URL.',
      );
    }
  }

  private async resolveModel(preferred?: string): Promise<string> {
    const primary = preferred ?? this.primaryModel;
    if (await this.ollama.hasModel(primary)) {
      return primary;
    }
    if (await this.ollama.hasModel(this.fallbackModel)) {
      this.logger.warn(`Model ${primary} not found, using ${this.fallbackModel}`);
      return this.fallbackModel;
    }
    throw new Error('ollama_unavailable');
  }

  async generate(
    prompt: string,
    options: {
      temperature?: number;
      model?: string;
      systemPrompt?: string;
    } = {},
  ): Promise<string> {
    const messages: OllamaMessage[] = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const model = await this.resolveModel(options.model);

    try {
      return await this.ollama.chat(model, messages, {
        temperature: options.temperature,
      });
    } catch (error) {
      if (
        this.isTimeoutError(error) &&
        model !== this.fallbackModel &&
        (await this.ollama.hasModel(this.fallbackModel))
      ) {
        this.logger.warn(
          `Model ${model} timed out, falling back to ${this.fallbackModel}`,
        );
        return await this.ollama.chat(this.fallbackModel, messages, {
          temperature: options.temperature,
        });
      }
      this.logger.error('Ollama generation failed', error as Error);
      throw new Error('ollama_unavailable');
    }
  }

  async chatWithHistory(
    messages: OllamaMessage[],
    options: { temperature?: number; model?: string } = {},
  ): Promise<string> {
    const model = await this.resolveModel(options.model);
    const temperature = options.temperature ?? 0.7;

    try {
      return await this.ollama.chat(model, messages, { temperature });
    } catch (error) {
      if (
        this.isTimeoutError(error) &&
        model !== this.fallbackModel &&
        (await this.ollama.hasModel(this.fallbackModel))
      ) {
        this.logger.warn(
          `Model ${model} timed out, falling back to ${this.fallbackModel}`,
        );
        return await this.ollama.chat(this.fallbackModel, messages, {
          temperature,
        });
      }
      this.logger.error('Ollama history chat failed', error as Error);
      throw new Error('ollama_unavailable');
    }
  }

  private isTimeoutError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return (
      error.name === 'TimeoutError' ||
      error.message.toLowerCase().includes('timeout') ||
      error.message.toLowerCase().includes('aborted')
    );
  }

  async *generateStream(
    prompt: string,
    options: {
      temperature?: number;
      model?: string;
      systemPrompt?: string;
    } = {},
  ): AsyncGenerator<string> {
    const messages: OllamaMessage[] = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    const model = await this.resolveModel(options.model);
    yield* this.ollama.chatStream(model, messages, {
      temperature: options.temperature,
    });
  }

  async *chatWithHistoryStream(
    messages: OllamaMessage[],
    options: { temperature?: number; model?: string } = {},
  ): AsyncGenerator<string> {
    const model = await this.resolveModel(options.model);
    yield* this.ollama.chatStream(model, messages, {
      temperature: options.temperature ?? 0.7,
    });
  }

  async loadModel(modelName: string): Promise<boolean> {
    return this.ollama.hasModel(modelName);
  }

  async isAvailable(): Promise<boolean> {
    return this.ollama.isAvailable();
  }
}
