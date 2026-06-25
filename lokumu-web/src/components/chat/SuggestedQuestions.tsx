import { UiLanguage } from '../../lib/languages';

const SUGGESTIONS: Record<UiLanguage, string[]> = {
  fr: ['Donne-moi un proverbe lingala', 'Comment dit-on merci en kituba ?'],
  en: ['Tell me a Lingala proverb', 'How do you greet in Kituba?'],
  lin: ['Lobi proverbe moko ya lingala', 'Ndenge nini ya kopesa mbote'],
  kit: ['Pesa mono proverbe ya kituba', 'Ndenge nini ya kupesa mbote'],
};

type SuggestedQuestionsProps = {
  language: UiLanguage;
  onSelect: (question: string) => void;
};

export function SuggestedQuestions({ language, onSelect }: SuggestedQuestionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {SUGGESTIONS[language].map((question) => (
        <button
          key={question}
          type="button"
          onClick={() => onSelect(question)}
          className="rounded-full border border-lokumu-primary/30 bg-white px-3 py-1.5 text-xs font-medium text-lokumu-primary transition hover:bg-lokumu-primary hover:text-white"
        >
          {question}
        </button>
      ))}
    </div>
  );
}
