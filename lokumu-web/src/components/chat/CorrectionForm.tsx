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
        className="text-xs font-medium text-lokumu-primary underline decoration-dotted"
      >
        Corriger cette reponse
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <textarea
        value={correctedAnswer}
        onChange={(event) => setCorrectedAnswer(event.target.value)}
        placeholder="Votre correction"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-lokumu-primary focus:ring-2"
        rows={3}
      />
      <input
        type="text"
        value={contributorNote}
        onChange={(event) => setContributorNote(event.target.value)}
        placeholder="Note optionnelle"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-lokumu-primary focus:ring-2"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-lokumu-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {isSubmitting ? 'Envoi...' : 'Envoyer'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
