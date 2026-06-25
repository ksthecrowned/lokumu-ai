export type InternalLanguage = 'fra' | 'eng' | 'lin' | 'kit';
export type UiLanguage = 'fr' | 'en' | 'lin' | 'kit';

export const SUPPORTED_INTERNAL: InternalLanguage[] = ['fra', 'eng', 'lin', 'kit'];

const UI_TO_INTERNAL: Record<string, InternalLanguage> = {
  fr: 'fra',
  fra: 'fra',
  en: 'eng',
  eng: 'eng',
  lin: 'lin',
  lg: 'lin',
  kit: 'kit',
};

export function normalizeLanguage(code?: string): InternalLanguage {
  if (!code) return 'fra';
  const lower = code.toLowerCase();
  const key = lower.slice(0, 3);
  return UI_TO_INTERNAL[key] ?? UI_TO_INTERNAL[lower] ?? 'fra';
}

export const LANGUAGE_LABELS: Record<UiLanguage, string> = {
  fr: 'Français',
  en: 'English',
  lin: 'Lingála',
  kit: 'Kitúba',
};
