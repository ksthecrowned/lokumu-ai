// Multilingual system prompts for Lokumu AI agent

export const SYSTEM_PROMPTS = {
  fra: `Tu es Lokumu, un assistant IA français. Réponds de manière claire et concise.
Si tu n'es pas sûr, dis-le. Sois utile et amical.`,

  eng: `You are Lokumu, an AI assistant. Respond clearly and concisely.
If unsure, acknowledge it. Be helpful and friendly.`,

  lin: `Ozali mpo Lokumu, oni AI ya français. Bongo kokoka kosalela mpe kosalela nsala.
 Sango okokoka, koloba. Kolola mpe kolola mpe mabe.`,

  kit: `Okili na Lokumu, oni AI ya mfina. Bonga kokola mpe kokola nsala.
 Sango okokola, koloba. Kolola mpe kolola mpe mabe.`,

  swa: `Wewe ni Lokumu, msaidizi wa AI. Jibu wazi na haraka.
 Ikiwa huna uhakika, usiambie hivyo. Kuwa na msaada na rafiki.`,
} as const;

export type SupportedLanguage = keyof typeof SYSTEM_PROMPTS;

const LANGUAGE_MAP: Record<string, SupportedLanguage> = {
  fra: 'fra', fr: 'fra',
  eng: 'eng', en: 'eng',
  lin: 'lin', lg: 'lin',
  kit: 'kit',
  swa: 'swa', sw: 'swa',
};

export function getSystemPrompt(language?: string): string {
  if (!language) return SYSTEM_PROMPTS.fra;
  const normalized = language.toLowerCase().substring(0, 3) as keyof typeof LANGUAGE_MAP;
  const lang = LANGUAGE_MAP[normalized] || 'fra';
  return SYSTEM_PROMPTS[lang];
}

export const RAG_CONTEXT_TEMPLATE = (context: string, language?: string): string => {
  return `[CONTEXTE]\n${context}\n[/CONTEXTE]\n\n${
    language && ['lin', 'kit', 'swa'].includes(language.toLowerCase().substring(0, 3))
      ? `Question ya mpo: {prompt}\n\nJibu mpo na ${language}:`
      : `Question: {prompt}\n\nAnswer${language ? ' in ' + language : ''}:`
  }`;
};