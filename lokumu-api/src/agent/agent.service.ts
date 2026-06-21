import { Injectable } from '@nestjs/common';
import { detectMode, Mode } from './mode-detector';
import { ModelService } from '../model/model.service';
import { RagService } from '../rag/rag.service';
import { getSystemPrompt, RAG_CONTEXT_TEMPLATE } from '../prompts/multilingual';

@Injectable()
export class AgentService {
  constructor(
    private modelService: ModelService,
    private ragService: RagService,
  ) {}

  async processRequest(prompt: string, language?: string): Promise<{
    mode: Mode;
    response: string;
    sources?: any[];
  }> {
    const mode = detectMode(prompt);

    if (mode === 'chat') {
      return this.handleChatMode(prompt, language);
    } else {
      return this.handleCodeMode(prompt);
    }
  }

  private async handleChatMode(prompt: string, language?: string): Promise<{ mode: Mode; response: string; sources: any[] }> {
    const sources = await this.ragService.search({
      query: prompt,
      language,
      limit: 5,
    }) as any[];

    const contextText = sources.map((s: any) => s.content).join('\n\n');
    const systemPrompt = getSystemPrompt(language);
    const fullPrompt = `${systemPrompt}\n\n${RAG_CONTEXT_TEMPLATE(contextText, language).replace('{prompt}', prompt)}`;

    const response = await this.modelService.generate(fullPrompt, {
      n_predict: 128,
      temperature: 0.7,
      modelType: 'chat',
    });

    return {
      mode: 'chat' as Mode,
      response,
      sources,
    };
  }

  private async handleCodeMode(prompt: string): Promise<{ mode: Mode; response: string }> {
    const systemPrompt = `You are Lokumu Code Agent. Generate clean, working code.
Available tools after response: read_file, write_file, search_code, shell_execute`;

    const fullPrompt = `${systemPrompt}\n\nUser request: ${prompt}\n\nGenerate the code:`;

    const response = await this.modelService.generate(fullPrompt, {
      n_predict: 256,
      temperature: 0.1,
      modelType: 'code',
    });

    return {
      mode: 'code' as Mode,
      response,
    };
  }
}