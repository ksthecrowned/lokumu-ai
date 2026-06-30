import { SuggestedQuestions } from './SuggestedQuestions';
import { UiLanguage } from '../../lib/languages';

type WelcomeScreenProps = {
  language: UiLanguage;
  disabled?: boolean;
  onSelect: (question: string) => void;
};

export function WelcomeScreen({
  language,
  disabled = false,
  onSelect,
}: WelcomeScreenProps) {
  return (
    <div className="flex min-h-[min(70vh,560px)] flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-lokumu-primary text-2xl font-bold text-white shadow-lg shadow-lokumu-primary/25">
        L
      </div>
      <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
        Mbote
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400 sm:text-[15px]">
        Assistant culturel congolais — proverbes, salutations et dialogues en
        français, anglais, lingala et kituba.
      </p>
      <div className="mt-8 w-full max-w-2xl">
        <SuggestedQuestions
          language={language}
          disabled={disabled}
          variant="cards"
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}
