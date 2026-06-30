'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef } from 'react';

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
};

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M3.4 20.4 21 12 3.4 3.6l1.8 7.2L16 12l-10.8 1.2-1.8 7.2z" />
    </svg>
  );
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = 'Envoyer un message…',
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!disabled && value.trim()) onSubmit();
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!disabled && value.trim()) onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex items-end gap-2 rounded-[26px] border border-white/10 bg-[#2f2f2f] px-4 py-2 shadow-lg shadow-black/20 ring-1 ring-white/5 transition focus-within:border-white/20 focus-within:ring-lokumu-primary/40">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="max-h-[200px] min-h-[24px] flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          aria-label="Envoyer"
          className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
        >
          <SendIcon />
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] text-zinc-600">
        Lokumu peut faire des erreurs. Verifiez les sources culturelles.
      </p>
    </form>
  );
}
