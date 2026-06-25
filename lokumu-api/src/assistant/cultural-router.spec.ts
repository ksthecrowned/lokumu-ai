import { shouldUseRag } from './cultural-router';

describe('shouldUseRag', () => {
  it('forces RAG for cultural keywords', () => {
    expect(shouldUseRag('Donne-moi un proverbe lingala')).toBe(true);
    expect(shouldUseRag('Comment dit-on mbote en kituba')).toBe(true);
  });

  it('skips RAG for general chat', () => {
    expect(shouldUseRag('Quel temps fait-il a Kinshasa')).toBe(false);
  });
});
