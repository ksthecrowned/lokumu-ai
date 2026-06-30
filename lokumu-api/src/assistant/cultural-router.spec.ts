import {
  classifyQueryIntent,
  isGreetingConversationQuery,
  isProverbQuery,
  resolveRagLimit,
  resolveReplyLanguage,
  resolveSearchLanguage,
  shouldUseRag,
} from './cultural-router';
import {
  buildGroundedResponse,
  formatGroundedProverbResponse,
  tryFormatGroundedResponse,
} from './cultural-response';

describe('cultural-router', () => {
  it('forces RAG for cultural keywords', () => {
    expect(shouldUseRag('Donne-moi un proverbe lingala')).toBe(true);
    expect(shouldUseRag('Comment dit-on mbote en kituba')).toBe(true);
  });

  it('skips RAG for general chat', () => {
    expect(shouldUseRag('Quel temps fait-il a Kinshasa')).toBe(false);
  });

  it('targets lingala corpus for lingala proverb requests', () => {
    expect(resolveSearchLanguage('Donne-moi un proverbe lingala', 'fra')).toBe(
      'lin',
    );
    expect(resolveSearchLanguage('Pesa mono proverbe ya kituba', 'fra')).toBe(
      'kit',
    );
  });

  it('detects proverb queries', () => {
    expect(isProverbQuery('Donne-moi un proverbe lingala')).toBe(true);
  });

  it('classifies greeting queries', () => {
    expect(classifyQueryIntent('Mbote, ozali malamu?')).toBe('greeting');
  });

  it('detects conversational greeting queries', () => {
    expect(isGreetingConversationQuery('Mbote, ozali malamu?')).toBe(true);
    expect(isGreetingConversationQuery('mbote')).toBe(false);
    expect(isGreetingConversationQuery('Comment dit-on mbote en kituba ?')).toBe(
      false,
    );
  });

  it('resolves reply language from prompt markers', () => {
    expect(resolveReplyLanguage('Mbote, ozali malamu?', 'fra')).toBe('lin');
    expect(resolveReplyLanguage('Mbote, nge me kwenda mbote?', 'fra')).toBe(
      'kit',
    );
  });

  it('uses precise top-k for conversational greetings', () => {
    expect(resolveRagLimit('Mbote, ozali malamu?')).toBe(3);
  });

  it('uses vague top-k for greetings', () => {
    expect(resolveRagLimit('bonjour')).toBe(8);
  });

  it('uses precise top-k for grammar', () => {
    expect(resolveRagLimit('conjugaison du verbe être en kituba')).toBe(3);
  });
});

describe('cultural-response', () => {
  const source = {
    id: '1',
    content:
      'Mosapi moko ekokanga te nse.\n\n(FR: Un seul doigt ne peut pas ecraser un pou.)',
    metadata: {
      title: 'Un seul doigt ne tue pas un pou',
      type: 'proverb',
    },
    language: 'lin',
    score: 0.8,
    community: false,
  };

  it('formats proverb from corpus without inventing text', () => {
    const response = formatGroundedProverbResponse(source as any, 'fra');
    expect(response).toContain('Mosapi moko ekokanga te nse.');
    expect(response).toContain('Traduction : Un seul doigt ne peut pas ecraser un pou.');
    expect(response).not.toContain('Pentsele');
    expect(response).not.toContain('**');
  });

  it('formats translation queries from corpus', () => {
    const expression = {
      id: '2',
      content: 'Matondo mingi.',
      metadata: {
        title: 'Remercier',
        type: 'expression',
        translation_fr: 'Merci beaucoup.',
      },
      language: 'kit',
      score: 0.9,
      community: false,
    };

    const response = tryFormatGroundedResponse(
      [expression as any],
      'Comment dit-on merci en kituba ?',
      'fra',
    );

    expect(response).toContain('Matondo mingi.');
    expect(response).toContain('kituba');
    expect(response).toContain('« merci »');
    expect(response).toContain('→ Merci beaucoup.');
    expect(response).not.toContain('merci en kituba');
    expect(response).not.toContain('**');
  });

  it('returns a single grounded source for proverb queries', () => {
    const sources = [
      {
        id: '1',
        content: 'Mosapi moko ekokanga te nse.',
        metadata: { title: 'Un seul doigt ne tue pas un pou', type: 'proverb' },
        language: 'lin',
        score: 1,
        community: false,
      },
      {
        id: '2',
        content: 'Nzete moko esalaka zamba te.',
        metadata: { title: 'Un seul arbre ne fait pas la foret', type: 'proverb' },
        language: 'lin',
        score: 0.9,
        community: false,
      },
    ];

    const grounded = buildGroundedResponse(
      sources as any,
      'Donne-moi un proverbe lingala',
      'fra',
    );

    expect(grounded?.source?.id).toBe('1');
    expect(grounded?.response).toContain('Traduction :');
  });

  it('formats bonjour in kituba from corpus', () => {
    const greeting = {
      id: 'g1',
      content: 'Mbote.',
      metadata: { title: 'Salutation de base', type: 'greeting' },
      language: 'kit',
      score: 0.9,
      community: false,
    };

    const response = tryFormatGroundedResponse(
      [greeting as any],
      'Comment dit-on bonjour en kituba ?',
      'fra',
    );

    expect(response).toContain('Mbote.');
    expect(response).toContain('→ Bonjour.');
  });

  it('replies in lingala for wellness greetings', () => {
    const greeting = {
      id: 'g2',
      content: 'Nazali malamu.',
      metadata: { title: 'Reponse tout va bien', type: 'greeting' },
      language: 'lin',
      score: 0.9,
      community: false,
    };

    const grounded = buildGroundedResponse(
      [greeting as any],
      'Mbote, ozali malamu?',
      'fra',
    );

    expect(grounded?.response).toContain('Nazali malamu');
    expect(grounded?.response).not.toContain('signifie');
    expect(grounded?.source?.id).toBe('g2');
  });
});
