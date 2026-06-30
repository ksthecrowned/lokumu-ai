import Link from 'next/link';
import { LanguagePicker } from './LanguagePicker';
import { OfflineBadge } from '../demo/OfflineBadge';
import { UiLanguage } from '../../lib/languages';

type ChatHeaderProps = {
  language: UiLanguage;
  onLanguageChange: (language: UiLanguage) => void;
  onNewChat: () => void;
  title?: string;
};

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

export function ChatHeader({
  language,
  onLanguageChange,
  onNewChat,
  title = 'Lokumu',
}: ChatHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#212121]/90 px-3 backdrop-blur-md sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onNewChat}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
          aria-label="Nouvelle conversation"
          title="Nouvelle conversation"
        >
          <PlusIcon />
        </button>
        <h1 className="truncate text-sm font-semibold text-zinc-100">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <nav className="hidden items-center gap-1 sm:flex">
          <Link
            href="/train"
            className="rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
          >
            Entrainement
          </Link>
        </nav>
        <LanguagePicker value={language} onChange={onLanguageChange} compact />
        <OfflineBadge />
      </div>
    </header>
  );
}
