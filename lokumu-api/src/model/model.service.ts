import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OllamaClient, OllamaMessage } from './ollama.client';

@Injectable()
export class ModelService implements OnModuleInit {
  private readonly logger = new Logger(ModelService.name);
  private readonly ollama = new OllamaClient();
  private readonly primaryModel = process.env.OLLAMA_MODEL ?? 'qwen3.5';
  private readonly fallbackModel =
    process.env.OLLAMA_FALLBACK_MODEL ?? 'deepseek-coder';

  async onModuleInit() {
    const available = await this.ollama.isAvailable();
    if (!available) {
      this.logger.warn(
        'Ollama is unavailable on startup. Expected at OLLAMA_BASE_URL.',
      );
    }
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

    const preferred = options.model ?? this.primaryModel;
    const model = (await this.ollama.hasModel(preferred))
      ? preferred
      : this.fallbackModel;

    try {
      return await this.ollama.chat(model, messages, {
        temperature: options.temperature,
      });
    } catch (error) {
      this.logger.error('Ollama generation failed', error as Error);
      throw new Error('ollama_unavailable');
    }
  }

  generateStream(
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
    const model = options.model ?? this.primaryModel;
    return this.ollama.chatStream(model, messages, {
      temperature: options.temperature,
    });
  }

  async loadModel(modelName: string): Promise<boolean> {
    return this.ollama.hasModel(modelName);
  }

  async isAvailable(): Promise<boolean> {
    return this.ollama.isAvailable();
  }
}