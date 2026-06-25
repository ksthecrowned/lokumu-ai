import { UiLanguage } from '../../lib/languages';

const SUGGESTIONS: Record<UiLanguage, string[]> = {
  fr: [
    'Donne-moi un proverbe lingala',
    'Comment dit-on merci en kituba ?',
    'Comment dit-on bonjour en kituba ?',
  ],
  en: ['Tell me a Lingala proverb', 'How do you greet in Kituba?'],
  lin: ['Lobi proverbe moko ya lingala', 'Ndenge nini ya kopesa mbote'],
  kit: ['Pesa mono proverbe ya kituba', 'Ndenge nini ya kupesa mbote'],
};

type SuggestedQuestionsProps = {
  language: UiLanguage;
  disabled?: boolean;
  onSelect: (question: string) => void;
};

export function SuggestedQuestions({
  language,
  disabled = false,
  onSelect,
}: SuggestedQuestionsProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {SUGGESTIONS[language].map((question) => (
        <button
          key={question}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(question)}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition hover:border-lokumu-primary hover:text-lokumu-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {question}
        </button>
      ))}
    </div>
  );
}
