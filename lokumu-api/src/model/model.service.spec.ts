import { detectMode } from '../assistant/mode-detector';

describe('AssistantService - mode detection', () => {
  // Tests focus on mode detection since full service requires DB/redis
  it('should detect chat mode for questions', () => {
    expect(detectMode('Quelle heure est-il?')).toBe('chat');
    expect(detectMode('Comment ça va?')).toBe('chat');
  });

  it('should detect code mode for technical prompts', () => {
    expect(detectMode('Crée un endpoint API')).toBe('code');
    expect(detectMode('Modifie le fichier .ts')).toBe('code');
  });
});