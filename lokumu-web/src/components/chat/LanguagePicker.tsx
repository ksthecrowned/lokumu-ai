import { UI_LANGUAGES, UiLanguage } from '../../lib/languages';

type LanguagePickerProps = {
  value: UiLanguage;
  onChange: (language: UiLanguage) => void;
  compact?: boolean;
};

export function LanguagePicker({
  value,
  onChange,
  compact = false,
}: LanguagePickerProps) {
  return (
    <label
      className={
        compact
          ? 'flex items-center'
          : 'flex items-center gap-2 text-sm text-zinc-400'
      }
    >
      {!compact ? <span className="font-medium">Langue</span> : null}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as UiLanguage)}
        aria-label="Langue de l'interface"
        className="rounded-lg border border-white/10 bg-[#2f2f2f] px-2 py-1.5 text-xs text-zinc-200 outline-none transition hover:border-white/20 focus:border-lokumu-primary/50 focus:ring-1 focus:ring-lokumu-primary/40 sm:px-3 sm:text-sm"
      >
        {UI_LANGUAGES.map((language) => (
          <option key={language.code} value={language.code} className="bg-[#2f2f2f]">
            {language.label}
          </option>
        ))}
      </select>
    </label>
  );
}
