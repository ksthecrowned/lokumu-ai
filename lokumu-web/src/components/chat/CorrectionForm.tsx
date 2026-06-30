'use client';

import { FormEvent, useState } from 'react';

type CorrectionFormProps = {
  onSubmit: (payload: { correctedAnswer: string; contributorNote?: string }) => Promise<void>;
};

export function CorrectionForm({ onSubmit }: CorrectionFormProps) {
  const [open, setOpen] = useState(false);
  const [correctedAnswer, setCorrectedAnswer] = useState('');
  const [contributorNote, setContributorNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!correctedAnswer.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        correctedAnswer: correctedAnswer.trim(),
        contributorNote: contributorNote.trim() || undefined,
      });
      setCorrectedAnswer('');
      setContributorNote('');
      setOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-zinc-500 transition hover:text-zinc-300"
      >
        Corriger cette reponse
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-2 rounded-xl border border-white/10 bg-[#2f2f2f] p-3"
    >
      <textarea
        value={correctedAnswer}
        onChange={(event) => setCorrectedAnswer(event.target.value)}
        placeholder="Votre correction"
        className="w-full rounded-lg border border-white/10 bg-[#212121] px-3 py-2 text-sm text-zinc-100 outline-none ring-lokumu-primary placeholder:text-zinc-600 focus:ring-2"
        rows={3}
      />
      <input
        type="text"
        value={contributorNote}
        onChange={(event) => setContributorNote(event.target.value)}
        placeholder="Note optionnelle"
        className="w-full rounded-lg border border-white/10 bg-[#212121] px-3 py-2 text-sm text-zinc-100 outline-none ring-lokumu-primary placeholder:text-zinc-600 focus:ring-2"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-900 disabled:opacity-60"
        >
          {isSubmitting ? 'Envoi...' : 'Envoyer'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-400"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
