import { normalizeLanguage, InternalLanguage } from '../shared/i18n/languages';

export const SYSTEM_PROMPTS: Record<InternalLanguage, string> = {
  fra: `Tu es Lokumu, un assistant IA français. Réponds de manière claire et concise.
Si tu n'es pas sûr, dis-le. Sois utile et amical.`,

  eng: `You are Lokumu, an AI assistant. Respond clearly and concisely.
If unsure, acknowledge it. Be helpful and friendly.`,

  lin: `Ozali Lokumu, mokambi ya AI. Yaká na lingála na ndenge ya polele.
Soki ozali kozanga confiance, koloba. Sala malamu.`,

  kit: `Wewe ni Lokumu, muntu ya AI. Sungula na kituba na ndenge ya polele.
Soki vandaka na doute, koloba. Sala malamu.`,
};

export type SupportedLanguage = InternalLanguage;

export function getSystemPrompt(language?: string): string {
  const lang = normalizeLanguage(language);
  return SYSTEM_PROMPTS[lang];
}

export const RAG_CONTEXT_TEMPLATE = (context: string, language?: string): string => {
  const lang = normalizeLanguage(language);
  return `[CONTEXTE]\n${context}\n[/CONTEXTE]\n\n${
    lang === 'lin' || lang === 'kit'
      ? `Question ya mpo: {prompt}\n\nJibu mpo na ${lang}:`
      : `Question: {prompt}\n\nAnswer in ${lang}:`
  }`;
};
