import { detectMode } from './mode-detector';

describe('AssistantService - mode detection only', () => {
  // Basic test without full NestJS module setup
  it('should have access to mode detector', () => {
    expect(detectMode('test')).toBeDefined();
  });

  it('should detect chat mode', () => {
    expect(detectMode('Quelle heure est-il?')).toBe('chat');
  });

  it('should detect code mode', () => {
    expect(detectMode('Crée un fichier .ts')).toBe('code');
  });
});