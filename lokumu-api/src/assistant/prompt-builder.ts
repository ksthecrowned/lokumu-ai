import { OllamaMessage } from '../model/ollama.client';
import { getSystemPrompt } from '../prompts/multilingual';
import { RagSearchResult } from '../rag/rag.service';
import { InternalLanguage } from '../shared/i18n/languages';
import { QueryIntent } from './cultural-router';

const GREETING_CONVERSATION_HINT =
  'L utilisateur te salue ou demande des nouvelles. Reponds en 1 ou 2 phrases, dans la MEME langue que son message (lingala ou kituba), comme un interlocuteur poli. Ne donne pas de cours de grammaire ni d explication en francais sauf si on te le demande.';

export function buildConversationalSystemPrompt(
  language: InternalLanguage,
  intent?: QueryIntent,
): string {
  const base = getSystemPrompt(language);
  if (intent === 'greeting') {
    return `${base}\n\n${GREETING_CONVERSATION_HINT}`;
  }
  return base;
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
  intent?: QueryIntent;
}): OllamaMessage[] {
  const system = buildConversationalSystemPrompt(input.language, input.intent);
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
