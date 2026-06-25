import { Injectable } from '@nestjs/common';
import { ModelService } from '../model/model.service';
import { RagSearchResult, RagService } from '../rag/rag.service';
import { normalizeLanguage } from '../shared/i18n/languages';
import {
  buildCulturalSystemPrompt,
  buildRagPrompt,
} from '../prompts/cultural.prompt';
import { shouldUseRag } from './cultural-router';

@Injectable()
export class AssistantService {
  constructor(
    private modelService: ModelService,
    private ragService: RagService,
  ) {}

  async processRequest(prompt: string, language?: string): Promise<{
    mode: 'chat';
    response: string;
    sources: Array<{
      id: string;
      title: string;
      type: string;
      community: boolean;
      score: number;
    }>;
    messageId: string;
    conversationId: string;
  }> {
    const lang = normalizeLanguage(language);
    let sources: RagSearchResult[] = [];

    if (shouldUseRag(prompt)) {
      const matches = await this.ragService.search({
        query: prompt,
        language: lang,
        limit: 5,
      });
      sources = matches
        .map((item) => ({
          ...item,
          score: item.community ? item.score + 0.1 : item.score,
        }))
        .sort((a, b) => b.score - a.score);
    } else {
      sources = [];
    }

    const contextText = sources
      .map((item) => {
        const sourceTitle =
          typeof item.metadata === 'object' &&
          item.metadata &&
          !Array.isArray(item.metadata)
            ? String((item.metadata as Record<string, unknown>).title ?? 'Corpus')
            : 'Corpus';
        return `${item.content} (source: ${sourceTitle})`;
      })
      .join('\n\n');

    const systemPrompt = buildCulturalSystemPrompt(lang);
    const fullPrompt = `${systemPrompt}\n\n${buildRagPrompt(
      contextText,
      prompt,
      lang,
      '',
    )}`;
    const response = await this.modelService.generate(fullPrompt, {
      temperature: 0.7,
    });

    return {
      mode: 'chat',
      response,
      messageId: crypto.randomUUID(),
      conversationId: crypto.randomUUID(),
      sources: sources.map((item) => {
        const metadata =
          typeof item.metadata === 'object' &&
          item.metadata &&
          !Array.isArray(item.metadata)
            ? (item.metadata as Record<string, unknown>)
            : {};
        return {
          id: item.id,
          title: String(metadata.title ?? 'Corpus culturel'),
          type: String(metadata.type ?? 'cultural'),
          community: item.community,
          score: item.score,
        };
      }),
    };
  }
}
