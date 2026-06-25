import { normalizeLanguage, SUPPORTED_INTERNAL } from './languages';

describe('languages', () => {
  it('maps UI codes to ISO 639-3', () => {
    expect(normalizeLanguage('fr')).toBe('fra');
    expect(normalizeLanguage('en')).toBe('eng');
    expect(normalizeLanguage('lin')).toBe('lin');
    expect(normalizeLanguage('kit')).toBe('kit');
  });

  it('supports only 4 languages', () => {
    expect(SUPPORTED_INTERNAL).toEqual(['fra', 'eng', 'lin', 'kit']);
  });
});
