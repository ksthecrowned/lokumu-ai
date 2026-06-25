import { getSystemPrompt, SYSTEM_PROMPTS } from '../prompts/multilingual';
import { buildCulturalSystemPrompt } from '../prompts/cultural.prompt';

describe('Multilingual Prompts', () => {
  it('returns French prompt by default for unknown language', () => {
    expect(getSystemPrompt('xyz')).toBe(SYSTEM_PROMPTS.fra);
  });

  it('returns French prompt for fra/fr', () => {
    expect(getSystemPrompt('fra')).toBe(SYSTEM_PROMPTS.fra);
    expect(getSystemPrompt('fr')).toBe(SYSTEM_PROMPTS.fra);
  });

  it('returns English prompt for eng/en', () => {
    expect(getSystemPrompt('eng')).toBe(SYSTEM_PROMPTS.eng);
    expect(getSystemPrompt('en')).toBe(SYSTEM_PROMPTS.eng);
  });

  it('returns Lingala prompt for lin/lg', () => {
    expect(getSystemPrompt('lin')).toBe(SYSTEM_PROMPTS.lin);
  });

  it('returns Kituba prompt for kit', () => {
    expect(getSystemPrompt('kit')).toBe(SYSTEM_PROMPTS.kit);
  });

  it('builds cultural system prompt for lin', () => {
    expect(buildCulturalSystemPrompt('lin')).toContain('Lokumu');
    expect(buildCulturalSystemPrompt('lin')).toContain('sans cloud');
  });
});
