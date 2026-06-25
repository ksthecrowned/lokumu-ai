import { LanguagePicker } from '../chat/LanguagePicker';
import Link from 'next/link';
import { UiLanguage } from '../../lib/languages';

type DemoHeaderProps = {
  language: UiLanguage;
  onLanguageChange: (language: UiLanguage) => void;
};

export function DemoHeader({ language, onLanguageChange }: DemoHeaderProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold text-slate-900">Lokumu</h1>
        <p className="text-xs text-slate-500">Assistant culturel local</p>
        <div className="mt-1 flex items-center gap-2 text-[11px] font-medium">
          <Link
            href="/chat"
            className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-slate-700"
          >
            Chat
          </Link>
          <Link
            href="/train"
            className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-slate-700"
          >
            Entrainement
          </Link>
        </div>
      </div>
      <div className="ml-auto shrink-0">
        <LanguagePicker value={language} onChange={onLanguageChange} />
      </div>
    </div>
  );
}
