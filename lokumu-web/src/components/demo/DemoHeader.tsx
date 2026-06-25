import { LanguagePicker } from '../chat/LanguagePicker';
import { UiLanguage } from '../../lib/languages';

type DemoHeaderProps = {
  language: UiLanguage;
  onLanguageChange: (language: UiLanguage) => void;
};

export function DemoHeader({ language, onLanguageChange }: DemoHeaderProps) {
  return (
    <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Lokumu Cultural Assistant
          </h1>
          <p className="text-sm text-slate-600">
            Demo local hors-ligne (fr, en, lin, kit)
          </p>
        </div>
        <LanguagePicker value={language} onChange={onLanguageChange} />
      </div>
    </header>
  );
}
