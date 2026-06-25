import { detectMode } from './mode-detector';

test('detects code mode from technical keywords', () => {
  expect(detectMode('Crée un endpoint API pour les conversations')).toBe(
    'code',
  );
  expect(detectMode('Modifie le fichier .env')).toBe('code');
  expect(detectMode('Refactor ce component')).toBe('code');
  expect(detectMode('Fix this bug in the test file')).toBe('code');
});

test('detects chat mode from question words', () => {
  expect(detectMode("Quelle est la météo aujourd'hui?")).toBe('chat');
  expect(detectMode('Comment ça va?')).toBe('chat');
  expect(detectMode('Pourquoi le ciel est bleu?')).toBe('chat');
});

test('detects code mode from file extensions', () => {
  expect(detectMode('Analyse ce fichier .ts')).toBe('code');
  expect(detectMode('modifie le .js')).toBe('code');
});

test('defaults to chat mode for ambiguous prompts', () => {
  expect(detectMode('Bonjour')).toBe('chat');
  expect(detectMode('hello world')).toBe('chat');
});
