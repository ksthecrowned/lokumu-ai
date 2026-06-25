import { InternalLanguage } from '../shared/i18n/languages';

const CULTURAL_PATTERNS: RegExp[] = [
  /proverbe|proverb|ndakisa/i,
  /culture|tradition|coutume/i,
  /lingala|lingála|kituba|kitúba/i,
  /mbote|sango nini|matondo|kimia|bonjour|bonsoir|salut|hello|hi/i,
  /comment dit-on|how do you say|traduire|translate/i,
];

export function isSimpleGreetingQuery(prompt: string): boolean {
  return /^(bonjour|bonsoir|salut|mbote|hello|hi|hey)[\s!.?]*$/i.test(
    prompt.trim(),
  );
}

export type QueryIntent =
  | 'greeting'
  | 'translation'
  | 'grammar'
  | 'proverb'
  | 'general';

export function classifyQueryIntent(prompt: string): QueryIntent {
  if (
    isSimpleGreetingQuery(prompt) ||
    /mbote|sango nini|salut|bonjour|bonsoir|hello|hi|kimia/i.test(prompt)
  ) {
    return 'greeting';
  }
  if (isTranslationQuery(prompt)) {
    return 'translation';
  }
  if (/conjugaison|grammar|grammaire|verbe|pronom/i.test(prompt)) {
    return 'grammar';
  }
  if (isProverbQuery(prompt)) {
    return 'proverb';
  }
  return 'general';
}

function parseTopK(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function resolveRagLimit(prompt: string): number {
  const vague = parseTopK(process.env.RAG_TOP_K_VAGUE, 8);
  const precise = parseTopK(process.env.RAG_TOP_K_PRECISE, 3);
  const intent = classifyQueryIntent(prompt);

  if (intent === 'greeting') return vague;
  if (intent === 'grammar' || intent === 'translation') return precise;
  return 5;
}

export function shouldUseRag(prompt: string): boolean {
  if (!prompt.trim()) return false;
  return CULTURAL_PATTERNS.some((pattern) => pattern.test(prompt));
}

export function resolveSearchLanguage(
  prompt: string,
  uiLanguage: InternalLanguage,
): InternalLanguage | undefined {
  if (/lingala|lingála/i.test(prompt)) return 'lin';
  if (/kituba|kitúba/i.test(prompt)) return 'kit';
  if (/\ben anglais\b|\bin english\b/i.test(prompt)) return 'eng';
  if (/\ben français\b|\bin french\b/i.test(prompt)) return 'fra';
  if (/proverbe|proverb|ndakisa|mbote|sango nini/i.test(prompt)) {
    return uiLanguage === 'fra' || uiLanguage === 'eng'
      ? undefined
      : uiLanguage;
  }
  return uiLanguage;
}

export function isProverbQuery(prompt: string): boolean {
  return /proverbe|proverb|ndakisa/i.test(prompt);
}

export function isTranslationQuery(prompt: string): boolean {
  return /comment dit-on|how do you say|traduire|translate/i.test(prompt);
}

export function targetLanguageLabel(prompt: string): string | null {
  if (/kituba|kitúba/i.test(prompt)) return 'kituba';
  if (/lingala|lingála/i.test(prompt)) return 'lingala';
  if (/\ben anglais\b|\bin english\b/i.test(prompt)) return 'anglais';
  if (/\ben français\b|\bin french\b/i.test(prompt)) return 'français';
  return null;
}
