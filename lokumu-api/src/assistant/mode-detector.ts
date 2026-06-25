export type Mode = 'chat' | 'code';

export function detectMode(prompt: string): Mode {
  const normalized = prompt.toLowerCase();

  const codePatterns = [
    /crée|créer|modifie|modifier|refactor|bug|test|generate/,
    /\.ts|\.js|\.py|\.java|\.go/,
    /endpoint|api|composant|component/,
    /génère|generate/i,
  ];

  const chatPatterns = [
    /\b(quelle|comment|pourquoi|quoi|qui|quand|où)\b/,
    /\b(explique|raconte|dis-moi|aide-moi)\b/,
  ];

  if (codePatterns.some((p) => p.test(normalized))) return 'code';
  if (chatPatterns.some((p) => p.test(normalized))) return 'chat';

  return 'chat';
}
