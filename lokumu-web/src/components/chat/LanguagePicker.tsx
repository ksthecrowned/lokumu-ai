import { UI_LANGUAGES, UiLanguage } from '../../lib/languages';

type LanguagePickerProps = {
  value: UiLanguage;
  onChange: (language: UiLanguage) => void;
};

export function LanguagePicker({ value, onChange }: LanguagePickerProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <span className="font-medium">Langue</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as UiLanguage)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-lokumu-primary transition focus:ring-2"
      >
        {UI_LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
          </option>
        ))}
      </select>
    </label>
  );
}
