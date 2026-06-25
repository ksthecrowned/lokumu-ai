import { buildCulturalSystemPrompt } from './cultural.prompt';

describe('cultural prompts', () => {
  it('includes Lokumu identity for each language', () => {
    expect(buildCulturalSystemPrompt('fra')).toContain('Lokumu');
    expect(buildCulturalSystemPrompt('eng')).toContain('Lokumu');
    expect(buildCulturalSystemPrompt('lin')).toContain('Lokumu');
    expect(buildCulturalSystemPrompt('kit')).toContain('Lokumu');
  });
});
