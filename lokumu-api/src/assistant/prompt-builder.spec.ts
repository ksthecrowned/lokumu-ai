import {
  buildConversationalSystemPrompt,
  buildOllamaMessages,
  formatRagContext,
} from './prompt-builder';
import { SYSTEM_PROMPTS } from '../prompts/multilingual';
import { RagSearchResult } from '../rag/rag.service';

describe('prompt-builder', () => {
  it('builds conversational system prompt from language', () => {
    expect(buildConversationalSystemPrompt('fra')).toBe(SYSTEM_PROMPTS.fra);
    expect(buildConversationalSystemPrompt('lin')).toBe(SYSTEM_PROMPTS.lin);
  });

  it('returns empty rag context when there are no chunks', () => {
    expect(formatRagContext([])).toBe('');
  });

  it('formats rag context with numbered chunks and source fallback', () => {
    const chunks: RagSearchResult[] = [
      {
        id: 'a1',
        content: 'Premier extrait',
        metadata: { source: 'seed://greetings' },
        language: 'fra',
        score: 0.9,
        community: false,
      },
      {
        id: 'b2',
        content: 'Deuxieme extrait',
        metadata: {},
        language: 'fra',
        score: 0.7,
        community: true,
      },
    ];

    expect(formatRagContext(chunks)).toBe(
      '[CONTEXTE]\n' +
        '[1] (source: seed://greetings)\nPremier extrait\n\n' +
        '[2] (source: chunk-b2)\nDeuxieme extrait\n' +
        '[/CONTEXTE]',
    );
  });

  it('builds ollama messages with system, rag context, filtered history, and user prompt', () => {
    const messages = buildOllamaMessages({
      language: 'eng',
      history: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'system', content: 'Ignored system turn' },
        { role: 'tool', content: 'Ignored tool turn' },
      ],
      ragContext: '[CONTEXTE]\n[1] (source: s)\nChunk\n[/CONTEXTE]',
      userPrompt: 'How do you say thanks in Lingala?',
    });

    expect(messages).toEqual([
      { role: 'system', content: SYSTEM_PROMPTS.eng },
      {
        role: 'system',
        content: '[CONTEXTE]\n[1] (source: s)\nChunk\n[/CONTEXTE]',
      },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
      { role: 'user', content: 'How do you say thanks in Lingala?' },
    ]);
  });

  it('omits rag context system message when rag context is empty', () => {
    const messages = buildOllamaMessages({
      language: 'kit',
      history: [],
      ragContext: '',
      userPrompt: 'Mbote',
    });

    expect(messages).toEqual([
      { role: 'system', content: SYSTEM_PROMPTS.kit },
      { role: 'user', content: 'Mbote' },
    ]);
  });
});
