import { Injectable } from '@nestjs/common';
import { RagSearchResult, RagService } from '../rag/rag.service';
import { ConversationService } from '../conversation/conversation.service';
import { ModelService } from '../model/model.service';
import { normalizeLanguage } from '../shared/i18n/languages';
import {
  buildDemoFallbackResponse,
  buildGroundedResponse,
} from './cultural-response';
import {
  classifyQueryIntent,
  resolveRagLimit,
  resolveSearchLanguage,
} from './cultural-router';
import { buildOllamaMessages, formatRagContext } from './prompt-builder';

@Injectable()
export class AssistantService {
  constructor(
    private readonly ragService: RagService,
    private readonly conversationService: ConversationService,
    private readonly modelService: ModelService,
  ) {}

  async processRequest(
    prompt: string,
    language?: string,
    conversationId?: string,
  ): Promise<{
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
    const { id: convId, isNew } = await this.conversationService.resolveConversation(
      conversationId,
      lang,
    );

    await this.conversationService.appendMessage(convId, 'user', prompt, lang);

    if (isNew) {
      await this.conversationService.maybeSetTitle(convId, prompt);
    }

    const limit = resolveRagLimit(prompt);
    const searchLanguage = resolveSearchLanguage(prompt, lang);
    const rawMatches = await this.ragService.search({
      query: prompt,
      language: searchLanguage,
      limit,
    });
    const intent = classifyQueryIntent(prompt);
    const sources = this.dedupeSources(
      this.ragService.rerankByMetadata(rawMatches, intent),
    );

    const top = sources[0];
    if (top && top.score >= 0.85) {
      const grounded = buildGroundedResponse(sources, prompt, lang);
      if (grounded) {
        const messageId = await this.conversationService.appendMessage(
          convId,
          'assistant',
          grounded.response,
          lang,
          [top.id],
        );
        return this.formatResult(grounded.response, [top], convId, messageId);
      }
    }

    const historyLimit = Number(process.env.CONVERSATION_HISTORY_TURNS ?? 10);
    const history = await this.conversationService.getRecentHistory(
      convId,
      historyLimit,
    );
    const ragContext = formatRagContext(sources.slice(0, limit));
    const messages = buildOllamaMessages({
      language: lang,
      history,
      ragContext,
      userPrompt: prompt,
    });

    let response: string;
    try {
      response = await this.modelService.chatWithHistory(messages);
    } catch {
      response = buildDemoFallbackResponse(lang, prompt);
    }

    const citedSources = sources.slice(0, 3);
    const messageId = await this.conversationService.appendMessage(
      convId,
      'assistant',
      response,
      lang,
      citedSources.map((source) => source.id),
    );

    return this.formatResult(response, citedSources, convId, messageId);
  }

  private dedupeSources(sources: RagSearchResult[]): RagSearchResult[] {
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();

    return sources.filter((item) => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);

      const metadata =
        typeof item.metadata === 'object' &&
        item.metadata &&
        !Array.isArray(item.metadata)
          ? (item.metadata as Record<string, unknown>)
          : {};
      const title = String(metadata.title ?? item.id);
      if (seenTitles.has(title)) return false;
      seenTitles.add(title);

      return true;
    });
  }

  private formatResult(
    response: string,
    sources: RagSearchResult[],
    conversationId: string,
    messageId: string,
  ): {
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
  } {
    return {
      mode: 'chat',
      response,
      messageId,
      conversationId,
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
