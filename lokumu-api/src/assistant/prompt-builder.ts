import { OllamaMessage } from '../model/ollama.client';
import { getSystemPrompt } from '../prompts/multilingual';
import { RagSearchResult } from '../rag/rag.service';
import { InternalLanguage } from '../shared/i18n/languages';

export function buildConversationalSystemPrompt(
  language: InternalLanguage,
): string {
  return getSystemPrompt(language);
}

export function formatRagContext(chunks: RagSearchResult[]): string {
  if (chunks.length === 0) return '';

  const blocks = chunks.map((chunk, index) => {
    const metadata =
      typeof chunk.metadata === 'object' &&
      chunk.metadata &&
      !Array.isArray(chunk.metadata)
        ? (chunk.metadata as Record<string, unknown>)
        : {};
    const source = String(metadata.source ?? `chunk-${chunk.id}`);
    return `[${index + 1}] (source: ${source})\n${chunk.content}`;
  });

  return `[CONTEXTE]\n${blocks.join('\n\n')}\n[/CONTEXTE]`;
}

type MessageTurn = { role: string; content: string };

export function buildOllamaMessages(input: {
  language: InternalLanguage;
  history: MessageTurn[];
  ragContext: string;
  userPrompt: string;
}): OllamaMessage[] {
  const system = buildConversationalSystemPrompt(input.language);
  const messages: OllamaMessage[] = [{ role: 'system', content: system }];

  if (input.ragContext) {
    messages.push({ role: 'system', content: input.ragContext });
  }

  for (const turn of input.history) {
    if (turn.role === 'user' || turn.role === 'assistant') {
      messages.push({ role: turn.role, content: turn.content });
    }
  }

  messages.push({ role: 'user', content: input.userPrompt });
  return messages;
}
