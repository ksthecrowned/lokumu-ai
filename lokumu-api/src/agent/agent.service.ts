import { Injectable } from '@nestjs/common';
import { detectMode, Mode } from './mode-detector';
import { ModelService } from '../model/model.service';
import { RagService } from '../rag/rag.service';

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

  private async handleChatMode(prompt: string, language?: string) {
    // Get RAG context
    const sources = await this.ragService.search({
      query: prompt,
      language,
      limit: 5,
    });

    // Build prompt with context
    const contextText = sources.map((s: any) => s.content).join('\n\n');
    const fullPrompt = language
      ? `[CONTEXT]\n${contextText}\n[/CONTEXT]\n\nUser question: ${prompt}\n\nAnswer in ${language}:`
      : `[CONTEXT]\n${contextText}\n[/CONTEXT]\n\nUser question: ${prompt}`;

    const response = await this.modelService.generate(fullPrompt, {
      n_predict: 128,
      temperature: 0.7,
    });

    return {
      mode: 'chat',
      response,
      sources,
    };
  }

  private async handleCodeMode(prompt: string) {
    // For code mode, generate code-focused response
    const systemPrompt = `You are Lokumu Code Agent. Generate clean, working code.
Available tools after response: read_file, write_file, search_code, shell_execute`;

    const fullPrompt = `${systemPrompt}\n\nUser request: ${prompt}\n\nGenerate the code:`;

    const response = await this.modelService.generate(fullPrompt, {
      n_predict: 256,
      temperature: 0.1,
    });

    return {
      mode: 'code',
      response,
    };
  }
}