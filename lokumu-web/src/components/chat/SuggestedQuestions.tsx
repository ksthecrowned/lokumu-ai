import { UiLanguage } from '../../lib/languages';

const SUGGESTIONS: Record<UiLanguage, string[]> = {
  fr: [
    'Donne-moi un proverbe lingala',
    'Comment dit-on merci en kituba ?',
    'Mbote, ozali malamu?',
    'Comment dit-on bonjour en kituba ?',
  ],
  en: [
    'Tell me a Lingala proverb',
    'How do you greet in Kituba?',
    'Mbote, ozali malamu?',
  ],
  lin: [
    'Lobi proverbe moko ya lingala',
    'Mbote, ozali malamu?',
    'Ndenge nini ya kopesa mbote',
  ],
  kit: [
    'Pesa mono proverbe ya kituba',
    'Mbote, nge me kwenda mbote?',
    'Ndenge nini ya kupesa mbote',
  ],
};

type SuggestedQuestionsProps = {
  language: UiLanguage;
  disabled?: boolean;
  variant?: 'chips' | 'cards';
  onSelect: (question: string) => void;
};

export function SuggestedQuestions({
  language,
  disabled = false,
  variant = 'chips',
  onSelect,
}: SuggestedQuestionsProps) {
  const items = SUGGESTIONS[language];

  if (variant === 'cards') {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((question) => (
          <button
            key={question}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(question)}
            className="rounded-2xl border border-white/10 bg-[#2f2f2f] px-4 py-3.5 text-left text-sm leading-snug text-zinc-300 transition hover:border-white/20 hover:bg-[#383838] hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {question}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {items.slice(0, 3).map((question) => (
        <button
          key={question}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(question)}
          className="rounded-full border border-white/10 bg-[#2f2f2f] px-3 py-1.5 text-xs text-zinc-400 transition hover:border-white/20 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {question}
        </button>
      ))}
    </div>
  );
}
